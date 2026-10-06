# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

RETENTION_TIME_UNITS = [
    ("days", "Days"),
    ("months", "Months"),
    ("years", "Years"),
]

CLOCK_START_SELECTION = [
    ("upload_date", "Upload date"),
    ("document_expiry", "Document expiry"),
    ("employment_end", "Employment end"),
]


class RetentionPolicy(models.Model):
    _name = "doc.retention.policy"
    _description = "Document retention settings (per document type)"
    _order = "document_type_id, id"

    name = fields.Char()
    description = fields.Text()
    document_type_id = fields.Many2one(
        "doc.document.type",
        string="Document type",
        index=True,
        ondelete="restrict",
    )
    retention_value = fields.Integer()
    retention_unit = fields.Selection(RETENTION_TIME_UNITS)
    trigger_event = fields.Selection(
        [
            ("upload_date", "Upload Date"),
            ("expiry_date", "Expiry Date"),
            ("termination_date", "Termination Date"),
        ]
    )
    action_after_expiry = fields.Selection(
        [
            ("archive", "Archive"),
            ("delete", "Delete"),
            ("flag_for_review", "Flag"),
            ("notify_owner", "Notify"),
        ]
    )
    applies_to_folder_ids = fields.Many2many("doc.folder")
    active = fields.Boolean(default=True)

    archive_after_value = fields.Integer(string="Archive after")
    archive_after_unit = fields.Selection(
        RETENTION_TIME_UNITS,
        string="Archive unit",
        default="years",
    )
    delete_after_value = fields.Integer(string="Delete after")
    delete_after_unit = fields.Selection(
        RETENTION_TIME_UNITS,
        string="Delete unit",
        default="years",
    )
    clock_start = fields.Selection(
        CLOCK_START_SELECTION,
        string="Retention clock starts",
        default="upload_date",
    )
    backup_required = fields.Boolean(
        string="Backup required before archive/delete",
        default=False,
    )

    @api.model
    def _delta_days(self, value, unit):
        if not value or value < 0:
            return 0
        if unit == "days":
            return value
        if unit == "months":
            return value * 30
        if unit == "years":
            return value * 365
        return 0

    def compliance_archive_delete_days(self):
        self.ensure_one()
        return (
            self._delta_days(self.archive_after_value, self.archive_after_unit),
            self._delta_days(self.delete_after_value, self.delete_after_unit),
        )

    def is_compliance_complete(self):
        self.ensure_one()
        if not self.document_type_id or not self.active:
            return False
        if not self.clock_start:
            return False
        archive_days, delete_days = self.compliance_archive_delete_days()
        if archive_days <= 0 or delete_days <= 0:
            return False
        if delete_days < archive_days:
            return False
        return True

    @api.model
    def _map_trigger_to_clock(self, trigger_event):
        mapping = {
            "upload_date": "upload_date",
            "expiry_date": "document_expiry",
            "termination_date": "employment_end",
        }
        return mapping.get(trigger_event) or "upload_date"

    @api.model
    def _map_clock_to_trigger(self, clock_start):
        mapping = {
            "upload_date": "upload_date",
            "document_expiry": "expiry_date",
            "employment_end": "termination_date",
        }
        return mapping.get(clock_start) or "upload_date"

    @api.constrains(
        "document_type_id",
        "active",
        "archive_after_value",
        "delete_after_value",
        "archive_after_unit",
        "delete_after_unit",
    )
    def _check_compliance_rule(self):
        for policy in self:
            if not policy.active or not policy.document_type_id:
                continue
            archive_days, delete_days = policy.compliance_archive_delete_days()
            if archive_days and delete_days and delete_days < archive_days:
                raise ValidationError(
                    _(
                        "Delete period must be at least as long as the archive period "
                        "for document type “%s”."
                    )
                    % policy.document_type_id.name
                )
            duplicate = self.search_count(
                [
                    ("id", "!=", policy.id),
                    ("active", "=", True),
                    ("document_type_id", "=", policy.document_type_id.id),
                ]
            )
            if duplicate:
                raise ValidationError(
                    _(
                        "Only one active retention setting is allowed per document type "
                        "(%s)."
                    )
                    % policy.document_type_id.name
                )

    @api.model_create_multi
    def create(self, vals_list):
        prepared = []
        for vals in vals_list:
            vals = dict(vals)
            if vals.get("clock_start") and not vals.get("trigger_event"):
                vals["trigger_event"] = self._map_clock_to_trigger(vals["clock_start"])
            if vals.get("archive_after_value") and not vals.get("retention_value"):
                vals["retention_value"] = vals["archive_after_value"]
                vals["retention_unit"] = vals.get("archive_after_unit") or "years"
            prepared.append(vals)
        return super().create(prepared)

    def write(self, vals):
        vals = dict(vals)
        if vals.get("clock_start"):
            vals["trigger_event"] = self._map_clock_to_trigger(vals["clock_start"])
        if "archive_after_value" in vals or "archive_after_unit" in vals:
            for policy in self:
                archive_value = vals.get("archive_after_value", policy.archive_after_value)
                archive_unit = vals.get("archive_after_unit", policy.archive_after_unit)
                if archive_value:
                    vals.setdefault("retention_value", archive_value)
                    vals.setdefault("retention_unit", archive_unit)
        return super().write(vals)

    def to_api_dict(self):
        self.ensure_one()
        doc_type = self.document_type_id
        return {
            "id": self.id,
            "name": self.name or (doc_type.name if doc_type else ""),
            "description": self.description or "",
            "document_type_id": doc_type.id if doc_type else False,
            "document_type_name": doc_type.name if doc_type else "",
            "archive_after_value": self.archive_after_value or 0,
            "archive_after_unit": self.archive_after_unit or "years",
            "delete_after_value": self.delete_after_value or 0,
            "delete_after_unit": self.delete_after_unit or "years",
            "clock_start": self.clock_start or self._map_trigger_to_clock(self.trigger_event),
            "backup_required": bool(self.backup_required),
            "active": bool(self.active),
            "compliance_complete": self.is_compliance_complete(),
        }

    @api.model
    def rules_for_document_types(self, document_type_ids):
        if not document_type_ids:
            return self.browse()
        return self.search(
            [
                ("active", "=", True),
                ("document_type_id", "in", list(document_type_ids)),
            ]
        )

    def archive_due_date(self, clock_start_date):
        self.ensure_one()
        if not clock_start_date:
            return False
        days, _delete = self.compliance_archive_delete_days()
        if days <= 0:
            return False
        return fields.Date.to_date(clock_start_date) + timedelta(days=days)

    def delete_due_date(self, clock_start_date):
        self.ensure_one()
        if not clock_start_date:
            return False
        _archive, days = self.compliance_archive_delete_days()
        if days <= 0:
            return False
        return fields.Date.to_date(clock_start_date) + timedelta(days=days)

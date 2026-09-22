# -*- coding: utf-8 -*-
import json

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError


class TemplateAssignment(models.Model):
    _name = "doc.template.assignment"
    _description = "Template assignment"
    _order = "id desc"

    template_id = fields.Many2one("doc.template", required=True, ondelete="restrict")
    template_version_id = fields.Many2one("doc.template.version", required=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    status = fields.Selection(
        [
            ("draft", "Draft"),
            ("recipients_selected", "Recipients selected"),
            ("collecting_data", "Collecting data"),
            ("preview_ready", "Preview ready"),
            ("confirmed", "Confirmed"),
            ("dispatched", "Dispatched"),
            ("cancelled", "Cancelled"),
            ("failed", "Failed"),
        ],
        default="draft",
        required=True,
    )
    delivery_method = fields.Selection(
        [
            ("email", "Email"),
            ("workspace", "Workspace"),
            ("both", "Email and workspace"),
        ],
        default="workspace",
    )
    notify = fields.Boolean(default=True)
    field_values = fields.Text()
    client_token = fields.Char(index=True)
    confirmed_at = fields.Datetime()
    recipient_ids = fields.One2many(
        "doc.template.assignment.recipient", "assignment_id"
    )

    def values_map(self):
        self.ensure_one()
        try:
            data = json.loads(self.field_values or "{}")
        except (TypeError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "status": self.status,
            "template_id": self.template_id.id,
            "template_name": self.template_id.name,
            "template_version_id": self.template_version_id.id,
            "merge_fields": self.template_version_id.merge_fields(),
            "delivery_method": self.delivery_method,
            "notify": self.notify,
            "field_values": self.values_map(),
            "recipients": [item.to_dict() for item in self.recipient_ids],
            "confirmed_at": fields.Datetime.to_string(self.confirmed_at) or "",
        }

    @api.model
    def start_assignment(self, template, client_token=None):
        template.ensure_one()
        version = template.current_version_id
        if not version:
            raise ValidationError("This template has no published version.")
        if client_token:
            existing = self.search(
                [
                    ("template_id", "=", template.id),
                    ("client_token", "=", client_token),
                    ("create_uid", "=", self.env.user.id),
                ],
                limit=1,
            )
            if existing:
                return existing
        assignment = self.create(
            {
                "template_id": template.id,
                "template_version_id": version.id,
                "client_token": client_token or False,
            }
        )
        self.env["doc.template.audit.event"].log_event(
            "assignment",
            "started",
            template_ids=template.ids,
            assignment_ids=assignment.ids,
        )
        return assignment

    def action_set_recipients(self, employee_ids):
        self.ensure_one()
        if self.status == "confirmed":
            raise UserError("This assignment is already confirmed.")
        employees = self.env["hr.employee"].browse(employee_ids).exists()
        if not employees:
            raise ValidationError("Select at least one employee.")
        self.recipient_ids.unlink()
        for employee in employees:
            self.env["doc.template.assignment.recipient"].create(
                {
                    "assignment_id": self.id,
                    "employee_id": employee.id,
                }
            )
        self.status = "recipients_selected"
        return self.to_dict()

    def action_set_field_values(self, values):
        self.ensure_one()
        if self.status == "confirmed":
            raise UserError("This assignment is already confirmed.")
        self.field_values = json.dumps(values or {})
        self.status = "collecting_data"
        return self.to_dict()

    def action_preview(self):
        self.ensure_one()
        Document = self.env["doc.template.document"]
        extra = self.values_map()
        previews = []
        auto_count = 0
        schema = self.template_version_id.merge_fields()
        for recipient in self.recipient_ids:
            auto = Document.resolve_context(employee=recipient.employee_id, extra=extra)
            unresolved = []
            resolved = {}
            for field in schema:
                key = field.get("key")
                value = extra.get(key)
                if value in (None, ""):
                    value = auto.get(key)
                    if value not in (None, ""):
                        auto_count += 1
                if value in (None, ""):
                    if field.get("required"):
                        unresolved.append(field.get("label"))
                else:
                    resolved[key] = value
            recipient.write(
                {
                    "resolved_field_values": json.dumps(resolved),
                    "unresolved_fields": json.dumps(unresolved),
                    "preview_text": apply_preview(self.template_version_id, resolved, schema),
                }
            )
            previews.append(recipient.to_dict())
        self.status = "preview_ready"
        return {
            "assignment": self.to_dict(),
            "auto_filled": auto_count,
            "previews": previews,
        }

    def action_confirm(self):
        self.ensure_one()
        if self.status == "confirmed":
            return self.to_dict()
        if not self.recipient_ids:
            raise ValidationError("Select at least one recipient.")
        preview = self.action_preview()
        missing = [
            recipient
            for recipient in self.recipient_ids
            if recipient.unresolved_list()
        ]
        if missing:
            raise ValidationError(
                "Required merge fields are still missing for one or more recipients."
            )
        documents = self.env["doc.template.document"]
        extra = self.values_map()
        for recipient in self.recipient_ids:
            document = self.env["doc.template.document"].generate_from_template(
                self.template_id,
                employee=recipient.employee_id,
                extra=extra,
                client_token="assign-%s-%s" % (self.id, recipient.employee_id.id),
            )
            document.assignment_id = self.id
            recipient.write(
                {
                    "document_id": document.id,
                    "status": "sent",
                    "sent_at": fields.Datetime.now(),
                }
            )
            documents |= document
            if self.notify and self.delivery_method in ("email", "both"):
                self._queue_mail(recipient)
        self.write(
            {
                "status": "confirmed",
                "confirmed_at": fields.Datetime.now(),
            }
        )
        self.env["doc.template.audit.event"].log_event(
            "assignment",
            "confirmed",
            template_ids=self.template_id.ids,
            assignment_ids=self.ids,
            document_ids=documents.ids,
        )
        return self.to_dict()

    def action_cancel(self):
        self.ensure_one()
        if self.status == "confirmed":
            raise UserError("A confirmed assignment cannot be cancelled.")
        self.status = "cancelled"
        return True

    def _queue_mail(self, recipient):
        email = recipient.employee_id.work_email
        if not email:
            return
        self.env["mail.mail"].sudo().create(
            {
                "subject": "A document was assigned to you: %s" % self.template_id.name,
                "body_html": "<p>You have a new HR document: %s</p>"
                % self.template_id.name,
                "email_to": email,
                "auto_delete": False,
            }
        )


def apply_preview(version, resolved, schema):
    from .template import apply_placeholders

    labels = {}
    for field in schema:
        key = field.get("key")
        if key in resolved:
            labels[(field.get("label") or "").lower()] = resolved[key]
    return apply_placeholders(version.extracted_text or "", labels)


class AssignmentRecipient(models.Model):
    _name = "doc.template.assignment.recipient"
    _description = "Assignment recipient"

    assignment_id = fields.Many2one(
        "doc.template.assignment", required=True, ondelete="cascade", index=True
    )
    employee_id = fields.Many2one("hr.employee", required=True, ondelete="restrict")
    status = fields.Selection(
        [
            ("pending", "Pending"),
            ("sent", "Sent"),
            ("viewed", "Viewed"),
            ("submitted", "Submitted"),
            ("completed", "Completed"),
        ],
        default="pending",
    )
    resolved_field_values = fields.Text()
    unresolved_fields = fields.Text()
    preview_text = fields.Text()
    document_id = fields.Many2one("doc.template.document", ondelete="set null")
    sent_at = fields.Datetime()
    viewed_at = fields.Datetime()
    submitted_at = fields.Datetime()
    completed_at = fields.Datetime()

    def unresolved_list(self):
        self.ensure_one()
        try:
            data = json.loads(self.unresolved_fields or "[]")
        except (TypeError, ValueError):
            return []
        return data if isinstance(data, list) else []

    def to_dict(self):
        self.ensure_one()
        employee = self.employee_id
        try:
            resolved = json.loads(self.resolved_field_values or "{}")
        except (TypeError, ValueError):
            resolved = {}
        return {
            "id": self.id,
            "employee_id": employee.id,
            "name": employee.name,
            "email": employee.work_email or "",
            "department": employee.department_id.name or "",
            "role": employee.job_id.name if "job_id" in employee._fields else "",
            "status": self.status,
            "resolved_field_values": resolved if isinstance(resolved, dict) else {},
            "unresolved_fields": self.unresolved_list(),
            "preview_text": self.preview_text or "",
            "document_id": self.document_id.id if self.document_id else False,
        }

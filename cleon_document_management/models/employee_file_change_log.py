# -*- coding: utf-8 -*-
from odoo import _, fields, models


class DocEmployeeFileChangeLog(models.Model):
    _name = "doc.employee.file.change.log"
    _description = "Employee file EMS change audit (EF-E)"
    _order = "changed_at desc, id desc"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    employee_file_id = fields.Many2one(
        "doc.employee.file",
        required=True,
        ondelete="cascade",
        index=True,
    )
    employee_id = fields.Many2one(
        "hr.employee",
        related="employee_file_id.employee_id",
        store=True,
        index=True,
    )
    event_label = fields.Char(required=True, index=True)
    field_name = fields.Char(required=True)
    field_label = fields.Char(required=True)
    old_value = fields.Char()
    new_value = fields.Char()
    changed_at = fields.Datetime(
        required=True,
        default=fields.Datetime.now,
        index=True,
    )
    notified = fields.Boolean(default=False)

    def serialize_for_activity(self):
        self.ensure_one()
        return {
            "id": self.id,
            "kind": "employee_moved"
            if self.event_label == "Employee moved"
            else "ems_change",
            "message": _("%(event)s: %(field)s changed from “%(old)s” to “%(new)s”.")
            % {
                "event": self.event_label,
                "field": self.field_label,
                "old": self.old_value or "—",
                "new": self.new_value or "—",
            },
            "document_id": False,
            "document_name": "",
            "folder_id": False,
            "folder_name": "",
            "folder_type": "employee",
            "employee_id": self.employee_id.id,
            "actor_name": _("EMS"),
            "occurred_at": fields.Datetime.to_string(self.changed_at),
            "old_value": self.old_value or "",
            "new_value": self.new_value or "",
            "field_label": self.field_label,
            "event_label": self.event_label,
        }

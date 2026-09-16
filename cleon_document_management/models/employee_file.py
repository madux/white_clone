# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class DocEmployeeFile(models.Model):
    _name = "doc.employee.file"
    _description = "Employee File (one per EMS employee)"
    _inherit = ["mail.thread"]
    _rec_name = "display_name"
    _order = "employee_id"

    employee_id = fields.Many2one(
        "hr.employee",
        required=True,
        ondelete="restrict",
        index=True,
    )
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    storage_folder_id = fields.Many2one(
        "doc.folder",
        string="Document storage folder",
        ondelete="restrict",
        copy=False,
    )
    active = fields.Boolean(default=True)
    state = fields.Selection(
        [
            ("active", "Active"),
            ("inactive", "Inactive"),
        ],
        default="active",
        required=True,
    )
    document_count = fields.Integer(compute="_compute_counts", store=True)
    attention_count = fields.Integer(compute="_compute_counts", store=True)
    display_name = fields.Char(compute="_compute_display_name", store=True)

    custom_group_ids = fields.Many2many(
        "doc.employee.group",
        "doc_employee_group_member_rel",
        "employee_file_id",
        "group_id",
        string="Custom groups",
        domain=[("group_kind", "=", "custom")],
    )

    favorite_user_ids = fields.Many2many(
        "res.users",
        "doc_employee_file_favorite_rel",
        "employee_file_id",
        "user_id",
        string="Favourited by",
    )

    _sql_constraints = [
        (
            "employee_company_uniq",
            "unique(employee_id, company_id)",
            "Each employee may have only one Employee File per company.",
        ),
    ]

    @api.depends("employee_id", "employee_id.name")
    def _compute_display_name(self):
        for record in self:
            record.display_name = record.employee_id.name or _("Employee File")

    @api.depends("employee_id")
    def _compute_counts(self):
        Issue = self.env["doc.employee.issue"]
        Document = self.env["doc.document"]
        for record in self:
            record.document_count = Document.search_count(
                [
                    ("employee_file_id", "=", record.id),
                    ("active", "=", True),
                ]
            )
            record.attention_count = Issue.search_count(
                [
                    ("employee_file_id", "=", record.id),
                    ("state", "=", "open"),
                ]
            )

    def _ensure_storage_folder(self):
        self.ensure_one()
        if self.storage_folder_id:
            return self.storage_folder_id
        folder = self.env["doc.folder"].sudo().create(
            {
                "folder_name": self.employee_id.name or _("Employee File"),
                "folder_type": "employee",
                "company_id": self.company_id.id,
                "employee_ids": [(6, 0, [self.employee_id.id])],
                "is_employee_file_v3": True,
                "active": True,
            }
        )
        self.sudo().write({"storage_folder_id": folder.id})
        return folder

    def serialize_for_api(self, user=None):
        self.ensure_one()
        employee = self.employee_id
        user = user or self.env.user
        return {
            "id": self.id,
            "employee_id": employee.id,
            "employee_name": employee.name,
            "department_id": employee.department_id.id if employee.department_id else False,
            "department_name": employee.department_id.name if employee.department_id else "",
            "job_title": employee.job_id.name if employee.job_id else "",
            "document_count": self.document_count,
            "attention_count": self.attention_count,
            "state": self.state,
            "favorite": user in self.favorite_user_ids,
            "storage_folder_id": self.storage_folder_id.id if self.storage_folder_id else False,
        }

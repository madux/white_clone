# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

EF_ACTION_FIELDS = (
    "action_view",
    "action_upload",
    "action_approve",
    "action_download",
    "action_archive",
    "action_delete",
    "action_export",
    "action_manage_settings",
)

DEPENDENT_ACTION_FIELDS = tuple(field for field in EF_ACTION_FIELDS if field != "action_view")

CATEGORY_GROUP_SELECTION = [
    ("hr", "Human Resources"),
    ("finance", "Finance"),
    ("legal", "Legal"),
    ("identity", "Identity"),
    ("employment", "Employment"),
    ("medical", "Medical"),
    ("training", "Training"),
    ("other", "Other"),
]


class DocEmployeeFilesRoleLine(models.Model):
    _name = "doc.employee.files.role.line"
    _description = "Employee Files role category permissions"
    _order = "sequence, id"

    role_id = fields.Many2one(
        "doc.employee.files.role",
        required=True,
        ondelete="cascade",
        index=True,
    )
    sequence = fields.Integer(default=10)
    applies_all_categories = fields.Boolean(
        string="All categories",
        default=False,
    )
    document_type_id = fields.Many2one("doc.document.type", string="Document type")
    category_group = fields.Selection(
        selection=CATEGORY_GROUP_SELECTION,
        string="Category group",
    )

    action_view = fields.Boolean(string="View", default=False)
    action_upload = fields.Boolean(string="Upload", default=False)
    action_approve = fields.Boolean(string="Approve", default=False)
    action_download = fields.Boolean(string="Download", default=False)
    action_archive = fields.Boolean(string="Archive", default=False)
    action_delete = fields.Boolean(string="Delete", default=False)
    action_export = fields.Boolean(string="Export", default=False)
    action_manage_settings = fields.Boolean(string="Manage settings", default=False)

    @api.constrains(
        "applies_all_categories",
        "document_type_id",
        "category_group",
        "action_view",
        *DEPENDENT_ACTION_FIELDS,
    )
    def _check_line(self):
        for line in self:
            if not line.applies_all_categories and not line.document_type_id and not line.category_group:
                raise ValidationError(
                    _("Select all categories, a document type, or a category group.")
                )
            for field_name in DEPENDENT_ACTION_FIELDS:
                if line[field_name] and not line.action_view:
                    raise ValidationError(
                        _("View must be enabled before other actions on a category row.")
                    )

    def write(self, vals):
        if vals.get("action_view") is False:
            for field_name in DEPENDENT_ACTION_FIELDS:
                vals[field_name] = False
        return super().write(vals)

    @api.model_create_multi
    def create(self, vals_list):
        cleaned = []
        for vals in vals_list:
            if vals.get("action_view") is False:
                for field_name in DEPENDENT_ACTION_FIELDS:
                    vals[field_name] = False
            cleaned.append(vals)
        return super().create(cleaned)

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "sequence": self.sequence,
            "applies_all_categories": self.applies_all_categories,
            "document_type_id": self.document_type_id.id or False,
            "document_type_name": self.document_type_id.name or "",
            "category_group": self.category_group or "",
            "actions": {
                "view": self.action_view,
                "upload": self.action_upload,
                "approve": self.action_approve,
                "download": self.action_download,
                "archive": self.action_archive,
                "delete": self.action_delete,
                "export": self.action_export,
                "manage_settings": self.action_manage_settings,
            },
        }


class DocEmployeeFilesRole(models.Model):
    _name = "doc.employee.files.role"
    _description = "Employee Files role"
    _order = "name, id"

    name = fields.Char(required=True)
    description = fields.Text()
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    employee_scope = fields.Selection(
        [
            ("own_team", "Own team"),
            ("department", "Department"),
            ("all", "All employees"),
        ],
        required=True,
        default="own_team",
    )
    is_migration_seed = fields.Boolean(
        default=False,
        help="Created automatically when migrating legacy document managers.",
    )
    line_ids = fields.One2many(
        "doc.employee.files.role.line",
        "role_id",
        string="Category permissions",
    )
    user_ids = fields.Many2many(
        "res.users",
        "doc_employee_files_role_user_rel",
        "role_id",
        "user_id",
        string="Assigned users",
    )

    @api.constrains("line_ids")
    def _check_has_lines(self):
        for role in self:
            if role.active and not role.line_ids:
                raise ValidationError(_("Each active role needs at least one category row."))

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "active": self.active,
            "company_id": self.company_id.id,
            "employee_scope": self.employee_scope,
            "is_migration_seed": self.is_migration_seed,
            "lines": [line.serialize_for_api() for line in self.line_ids],
            "assigned_user_ids": self.user_ids.ids,
        }

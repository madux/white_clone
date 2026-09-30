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
    org_access_library = fields.Boolean(
        string="Organizational library",
        default=False,
        help="Browse organizational folders within visibility rules.",
    )
    org_create_folder = fields.Boolean(string="Create folders", default=False)
    org_manage_folders = fields.Boolean(
        string="Manage folders",
        default=False,
        help="Rename, description, colour, lock, duplicate structure.",
    )
    org_share_manage_access = fields.Boolean(
        string="Manage access",
        default=False,
        help="Share / manage folder or document audience.",
    )
    org_folder_archive = fields.Boolean(string="Archive folders", default=False)
    org_folder_delete = fields.Boolean(string="Delete folders", default=False)
    org_upload = fields.Boolean(string="Upload to org folders", default=False)
    org_document_manage = fields.Boolean(
        string="Manage documents",
        default=False,
        help="Link, copy, assign, version, print, edit description.",
    )
    org_document_manage_access = fields.Boolean(
        string="Document manage access",
        default=False,
    )
    org_document_delete = fields.Boolean(string="Delete org documents", default=False)
    user_ids = fields.Many2many(
        "res.users",
        "doc_employee_files_role_user_rel",
        "role_id",
        "user_id",
        string="Assigned users",
    )

    def _has_organizational_capabilities(self):
        self.ensure_one()
        return any(
            self[field_name]
            for field_name in (
                "org_access_library",
                "org_create_folder",
                "org_manage_folders",
                "org_share_manage_access",
                "org_folder_archive",
                "org_folder_delete",
                "org_upload",
                "org_document_manage",
                "org_document_manage_access",
                "org_document_delete",
            )
        )

    @api.constrains("line_ids")
    def _check_has_lines(self):
        for role in self:
            if role.active and not role.line_ids and not role._has_organizational_capabilities():
                raise ValidationError(
                    _(
                        "Each active role needs Employee Files category rows or at least one Organizational Files capability."
                    )
                )

    def _serialize_assigned_users(self):
        self.ensure_one()
        users = self.user_ids.sudo().filtered(lambda user: user.active)
        employees = self.env["hr.employee"].sudo().search(
            [("user_id", "in", users.ids)]
        )
        employee_by_user = {employee.user_id.id: employee for employee in employees}
        metrics_service = self.env["doc.employee.files.service"]
        assigned = []
        for user in users:
            employee = employee_by_user.get(user.id)
            metrics = (
                metrics_service._serialize_employee_metrics(employee) if employee else {}
            )
            assigned.append(
                {
                    "id": user.id,
                    "name": user.name,
                    "login": user.login or "",
                    "employee_id": employee.id if employee else False,
                    "employee_name": employee.name if employee else user.name,
                    "department": metrics.get("department_name") or "",
                    "job_title": metrics.get("job_title") or "",
                    "employment_type": metrics.get("employment_type") or "",
                    "work_location": metrics.get("work_location") or "",
                    "branch": metrics.get("branch") or "",
                    "grade": metrics.get("grade") or "",
                }
            )
        assigned.sort(key=lambda item: (item["employee_name"] or "").lower())
        return assigned

    def serialize_for_api(self):
        self.ensure_one()
        assigned_users = self._serialize_assigned_users()
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "active": self.active,
            "company_id": self.company_id.id,
            "employee_scope": self.employee_scope,
            "is_migration_seed": self.is_migration_seed,
            "lines": [line.serialize_for_api() for line in self.line_ids],
            "assigned_user_ids": [user["id"] for user in assigned_users],
            "assigned_users": assigned_users,
            "organizational_actions": {
                "access_library": self.org_access_library,
                "create_folder": self.org_create_folder,
                "manage_folders": self.org_manage_folders,
                "share_manage_access": self.org_share_manage_access,
                "folder_archive": self.org_folder_archive,
                "folder_delete": self.org_folder_delete,
                "upload": self.org_upload,
                "document_manage": self.org_document_manage,
                "document_manage_access": self.org_document_manage_access,
                "document_delete": self.org_document_delete,
            },
        }

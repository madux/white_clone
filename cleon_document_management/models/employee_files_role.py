# -*- coding: utf-8 -*-
from odoo import _, api, fields, models, tools
from odoo.exceptions import ValidationError

from .dms_permission_catalog import (
    CANONICAL_ORG_ROLE_TEMPLATE_KEYS,
    DMS_PERMISSION_KEYS,
    DMS_ROLE_TEMPLATE_DEFAULTS,
    ORG_PERMISSION_KEYS,
    ROLE_TEMPLATE_KEYS,
    dms_permissions_from_role_record,
    permissions_from_legacy_booleans,
    sync_legacy_fields_from_permissions,
)

_LEGACY_ORG_FIELDS = (
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
    dms_permissions = fields.Json(
        string="Module permissions (DMS)",
        default=dict,
    )
    org_permissions = fields.Json(
        string="Organizational permissions",
        default=dict,
    )
    role_template_key = fields.Selection(
        selection=[(key, key.replace("_", " ").title()) for key in ROLE_TEMPLATE_KEYS],
        string="Role template",
        default="custom",
        required=True,
    )
    is_system_template = fields.Boolean(
        string="Canonical organisational role",
        default=False,
        help="One of the six Section 4 organisational roles; permissions are fixed.",
    )
    is_readonly_template = fields.Boolean(
        string="Fixed permissions",
        default=False,
        help="Organisational permission flags cannot be changed (canonical role).",
    )
    user_ids = fields.Many2many(
        "res.users",
        "doc_employee_files_role_user_rel",
        "role_id",
        "user_id",
        string="Assigned users",
    )

    def get_dms_permissions_dict(self):
        self.ensure_one()
        return dms_permissions_from_role_record(self)

    def get_org_permissions_dict(self):
        self.ensure_one()
        dms = self.get_dms_permissions_dict()
        return {key: bool(dms.get(key)) for key in ORG_PERMISSION_KEYS}

    def _has_organizational_capabilities(self):
        self.ensure_one()
        if any(self.get_org_permissions_dict().values()):
            return True
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

    def _is_canonical_org_role_vals(self, vals):
        return (
            vals.get("is_system_template")
            and vals.get("role_template_key") in CANONICAL_ORG_ROLE_TEMPLATE_KEYS
        )

    def _sync_permissions_from_catalog(self):
        for role in self:
            if (
                not role.is_system_template
                or role.role_template_key not in DMS_ROLE_TEMPLATE_DEFAULTS
            ):
                continue
            perms = dict(DMS_ROLE_TEMPLATE_DEFAULTS[role.role_template_key])
            if dict(role.dms_permissions or {}) == perms:
                continue
            org_slice = {k: v for k, v in perms.items() if k in ORG_PERMISSION_KEYS}
            stub = role.new({"org_permissions": org_slice})
            sync_legacy_fields_from_permissions(stub, org_slice)
            role.with_context(skip_canonical_permission_sync=True).write(
                {
                    "dms_permissions": perms,
                    "org_permissions": org_slice,
                    **{field: stub[field] for field in _LEGACY_ORG_FIELDS},
                }
            )

    @api.model_create_multi
    def create(self, vals_list):
        if (
            not self.env.context.get("allow_employee_files_role_create")
            and not tools.config.get("test_enable")
        ):
            for vals in vals_list:
                if not self._is_canonical_org_role_vals(vals):
                    raise ValidationError(
                        _(
                            "Only the six standard organisational roles are defined. "
                            "Assign users to those roles instead of creating new ones."
                        )
                    )
        cleaned = []
        for vals in vals_list:
            if vals.get("org_permissions"):
                role_stub = self.new(vals)
                sync_legacy_fields_from_permissions(
                    role_stub, role_stub.get_org_permissions_dict()
                )
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
                ):
                    vals[field_name] = role_stub[field_name]
            elif any(
                vals.get(field)
                for field in (
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
            ):
                stub = self.new(vals)
                vals["org_permissions"] = permissions_from_legacy_booleans(stub)
            cleaned.append(vals)
        return super().create(cleaned)

    def write(self, vals):
        vals = dict(vals)
        canonical = self.filtered(
            lambda role: role.is_system_template
            and role.role_template_key in CANONICAL_ORG_ROLE_TEMPLATE_KEYS
        )
        if canonical:
            locked = {
                "dms_permissions",
                "org_permissions",
                "name",
                "role_template_key",
                "is_system_template",
                "is_readonly_template",
                "active",
                *_LEGACY_ORG_FIELDS,
            }
            for key in locked:
                vals.pop(key, None)
        legacy_fields = _LEGACY_ORG_FIELDS
        if vals.get("org_permissions") is not None:
            sample = self[:1]
            stub = sample.new(dict(vals, id=sample.id if sample else False))
            sync_legacy_fields_from_permissions(stub, stub.get_org_permissions_dict())
            for field_name in legacy_fields:
                vals[field_name] = stub[field_name]
        result = super().write(vals)
        if "org_permissions" not in vals and any(field in vals for field in legacy_fields):
            for role in self:
                if role in canonical:
                    continue
                role.with_context(skip_org_legacy_sync=True).write(
                    {"org_permissions": permissions_from_legacy_booleans(role)}
                )
        if canonical and not self.env.context.get("skip_canonical_permission_sync"):
            canonical._sync_permissions_from_catalog()
        return result

    def apply_template_defaults(self, template_key):
        self.ensure_one()
        if template_key not in DMS_ROLE_TEMPLATE_DEFAULTS:
            raise ValidationError(_("Unknown organisational role template."))
        perms = dict(DMS_ROLE_TEMPLATE_DEFAULTS[template_key])
        org_slice = {k: v for k, v in perms.items() if k in ORG_PERMISSION_KEYS}
        sync_legacy_fields_from_permissions(self, org_slice)
        self.write(
            {
                "role_template_key": template_key,
                "dms_permissions": perms,
                "org_permissions": org_slice,
                "org_access_library": self.org_access_library,
                "org_create_folder": self.org_create_folder,
                "org_manage_folders": self.org_manage_folders,
                "org_share_manage_access": self.org_share_manage_access,
                "org_folder_archive": self.org_folder_archive,
                "org_folder_delete": self.org_folder_delete,
                "org_upload": self.org_upload,
                "org_document_manage": self.org_document_manage,
                "org_document_manage_access": self.org_document_manage_access,
                "org_document_delete": self.org_document_delete,
            }
        )

    @api.constrains(
        "line_ids",
        "active",
        "is_system_template",
        "role_template_key",
        "dms_permissions",
        "org_permissions",
        *_LEGACY_ORG_FIELDS,
    )
    def _check_active_role_has_capabilities(self):
        for role in self:
            if (
                role.is_system_template
                and role.role_template_key in CANONICAL_ORG_ROLE_TEMPLATE_KEYS
            ):
                continue
            if role.active and not role.line_ids and not role._has_organizational_capabilities():
                has_ef = any(
                    role.get_dms_permissions_dict().get(key)
                    for key in DMS_PERMISSION_KEYS
                    if key.startswith("ef_")
                )
                if has_ef:
                    continue
                raise ValidationError(
                    _(
                        "Each active role needs Employee Files category rows or at least one module capability."
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
            "role_template_key": self.role_template_key,
            "is_system_template": self.is_system_template,
            "is_readonly_template": self.is_readonly_template,
            "dms_permissions": self.get_dms_permissions_dict(),
            "organizational_permissions": self.get_org_permissions_dict(),
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

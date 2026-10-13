# -*- coding: utf-8 -*-
import logging

from odoo import _, api, models
from odoo.exceptions import UserError

from .dms_permission_catalog import (
    CANONICAL_ORG_ROLE_TEMPLATE_KEYS,
    ORG_PERMISSION_KEYS,
    dms_permissions_from_api_payload,
    sync_legacy_fields_from_permissions,
    validate_dms_permissions_map,
)
from .organizational_permission_catalog import CANONICAL_ORG_ROLE_TEMPLATE_KEYS as ORG_CANONICAL

_logger = logging.getLogger(__name__)

MIGRATION_ROLE_NAME = "Full Employee Files access (migrated)"

_LEGACY_ORG_FIELD_NAMES = (
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


class DocEmployeeFilesRoleService(models.AbstractModel):
    _name = "doc.employee.files.role.service"
    _description = "Employee Files role CRUD and assignment"

    @api.model
    def _permission(self):
        return self.env["doc.employee.files.permission"]

    @api.model
    def _require_author(self):
        self._permission().require_role_authoring(self.env.user)

    @api.model
    def _role_model(self):
        return self.env["doc.employee.files.role"]

    @api.model
    def _assignable_roles_domain(self, company=None):
        company = company or self.env.company
        return [
            ("company_id", "=", company.id),
            ("active", "=", True),
            "|",
            "&",
            ("is_system_template", "=", True),
            ("role_template_key", "in", list(CANONICAL_ORG_ROLE_TEMPLATE_KEYS)),
            ("is_system_template", "=", False),
        ]

    @api.model
    def _search_assignable_roles(self, company=None):
        return self._role_model().search(
            self._assignable_roles_domain(company),
            order="is_system_template desc, role_template_key, name",
        )

    @api.model
    def _is_canonical_role(self, role):
        return (
            role.is_system_template
            and role.role_template_key in CANONICAL_ORG_ROLE_TEMPLATE_KEYS
        )

    @api.model
    def _vals_from_dms_permissions(self, dms_map):
        Role = self._role_model()
        org_slice = {key: bool(dms_map.get(key)) for key in ORG_PERMISSION_KEYS}
        stub = Role.new({"org_permissions": org_slice})
        sync_legacy_fields_from_permissions(stub, org_slice)
        vals = {
            "dms_permissions": dms_map,
            "org_permissions": org_slice,
        }
        for field_name in _LEGACY_ORG_FIELD_NAMES:
            vals[field_name] = stub[field_name]
        return vals

    @api.model
    def _sync_role_lines(self, role, lines_payload):
        if lines_payload is None:
            return
        Line = self.env["doc.employee.files.role.line"]
        commands = [(5, 0, 0)]
        for sequence, item in enumerate(lines_payload or []):
            actions = item.get("actions") or {}
            commands.append(
                (
                    0,
                    0,
                    {
                        "sequence": (sequence + 1) * 10,
                        "applies_all_categories": bool(
                            item.get("applies_all_categories")
                        ),
                        "document_type_id": item.get("document_type_id") or False,
                        "category_group": item.get("category_group") or False,
                        "action_view": bool(actions.get("view")),
                        "action_upload": bool(actions.get("upload")),
                        "action_approve": bool(actions.get("approve")),
                        "action_download": bool(actions.get("download")),
                        "action_archive": bool(actions.get("archive")),
                        "action_delete": bool(actions.get("delete")),
                        "action_export": bool(actions.get("export")),
                        "action_manage_settings": bool(
                            actions.get("manage_settings")
                        ),
                    },
                )
            )
        role.write({"line_ids": commands})

    @api.model
    def _vals_from_custom_payload(self, payload):
        name = (payload.get("name") or "").strip()
        if not name:
            raise UserError(_("Role name is required."))
        scope = payload.get("employee_scope") or "own_team"
        if scope not in ("own_team", "department", "all"):
            raise UserError(_("Select a valid employee scope."))
        dms_map = dms_permissions_from_api_payload(payload.get("dms_permissions") or {})
        validate_dms_permissions_map(dms_map)
        vals = {
            "name": name,
            "description": payload.get("description") or "",
            "active": bool(payload.get("active", True)),
            "employee_scope": scope,
            **self._vals_from_dms_permissions(dms_map),
        }
        return vals

    @api.model
    def ensure_odoo_admin_super_admin_bindings(self, user=None):
        """Assign the Super Admin role to Odoo settings / document admins."""
        Role = self._role_model()
        template_svc = self.env["doc.org.role.template.service"]
        def is_odoo_dms_admin(u):
            if u.has_group("base.group_system"):
                return True
            if u.has_group("cleon_document_management.group_document_admin"):
                return True
            return False

        if user:
            companies = user.company_ids or user.company_id
            users = user
        else:
            companies = self.env["res.company"].search([])
            users = self.env["res.users"].search(
                [("share", "=", False), ("active", "=", True)]
            )
        for company in companies:
            super_role = Role.search(
                [
                    ("company_id", "=", company.id),
                    ("role_template_key", "=", "super_admin"),
                    ("is_system_template", "=", True),
                ],
                limit=1,
            )
            if not super_role:
                template_svc.with_company(company).ensure_canonical_org_roles(company)
                super_role = Role.search(
                    [
                        ("company_id", "=", company.id),
                        ("role_template_key", "=", "super_admin"),
                        ("is_system_template", "=", True),
                    ],
                    limit=1,
                )
            if not super_role:
                continue
            for u in users:
                if not is_odoo_dms_admin(u):
                    continue
                if u.company_id and u.company_id != company:
                    continue
                if super_role not in u.employee_files_role_ids:
                    u.sudo().write({"employee_files_role_ids": [(4, super_role.id)]})

    @api.model
    def list_roles(self):
        self._require_author()
        self.ensure_odoo_admin_super_admin_bindings(self.env.user)
        roles = self._search_assignable_roles()
        return [role.serialize_for_api() for role in roles]

    @api.model
    def save_role(self, payload):
        self._require_author()
        Role = self._role_model()
        role_id = payload.get("id")
        if not role_id:
            vals = self._vals_from_custom_payload(payload)
            vals.update(
                {
                    "company_id": self.env.company.id,
                    "role_template_key": "custom",
                    "is_system_template": False,
                    "is_readonly_template": False,
                }
            )
            role = Role.with_context(allow_employee_files_role_create=True).create(vals)
            self._sync_role_lines(role, payload.get("lines"))
            emitter = self.env.get("doc.audit.emitter.service")
            if emitter:
                perms = dict(role.get_dms_permissions_dict())
                changes = [
                    {"field": key, "before": "", "after": str(value)}
                    for key, value in perms.items()
                    if value
                ]
                emitter.log_settings_changes(
                    role,
                    _("Users & Roles"),
                    _("Settings → Users & Roles → %s") % role.name,
                    changes,
                    action="role_created",
                )
            return role.serialize_for_api()

        role = Role.browse(int(role_id))
        if not role or role.company_id != self.env.company:
            raise UserError(_("Role not found."))

        emitter = self.env.get("doc.audit.emitter.service")
        if self._is_canonical_role(role):
            raise UserError(
                _("System roles are read-only. Clone this role to customise permissions.")
            )

        before_perms = dict(role.get_dms_permissions_dict())
        vals = self._vals_from_custom_payload(payload)
        role.write(vals)
        self._sync_role_lines(role, payload.get("lines"))
        if emitter:
            after_perms = dict(role.get_dms_permissions_dict())
            changes = emitter.diff_dict(before_perms, after_perms)
            emitter.log_settings_changes(
                role,
                _("Users & Roles"),
                _("Settings → Users & Roles → %s") % role.name,
                changes,
                action="role_permission_changed",
            )
        return role.serialize_for_api()

    @api.model
    def reset_role_template(self, role_id, template_key):
        self._require_author()
        role = self._role_model().browse(int(role_id))
        if not role or role.company_id != self.env.company:
            raise UserError(_("Role not found."))
        role.apply_template_defaults(template_key)
        return role.serialize_for_api()

    @api.model
    def delete_role(self, role_id):
        self._require_author()
        role = self._role_model().browse(int(role_id))
        if not role or role.company_id != self.env.company:
            raise UserError(_("Role not found."))
        if self._is_canonical_role(role):
            raise UserError(_("Standard roles cannot be deleted."))
        user_count = len(role.user_ids.filtered(lambda user: user.active))
        if user_count:
            raise UserError(
                _("Move these %(count)s users to another role first.")
                % {"count": user_count}
            )
        role.unlink()
        return True

    @api.model
    def clone_role(self, role_id):
        self._require_author()
        Role = self._role_model()
        source = Role.browse(int(role_id))
        if not source or source.company_id != self.env.company:
            raise UserError(_("Role not found."))
        base_name = _("Copy of %s") % source.name
        name = base_name
        suffix = 2
        while Role.search_count(
            [("company_id", "=", self.env.company.id), ("name", "=", name)]
        ):
            name = "%s (%s)" % (base_name, suffix)
            suffix += 1
        perms = dict(source.get_dms_permissions_dict())
        vals = {
            "name": name,
            "description": source.description or "",
            "active": True,
            "employee_scope": source.employee_scope,
            "company_id": self.env.company.id,
            "role_template_key": "custom",
            "is_system_template": False,
            "is_readonly_template": False,
            **self._vals_from_dms_permissions(perms),
        }
        role = Role.with_context(allow_employee_files_role_create=True).create(vals)
        line_commands = []
        for line in source.line_ids:
            line_commands.append(
                (
                    0,
                    0,
                    {
                        "sequence": line.sequence,
                        "applies_all_categories": line.applies_all_categories,
                        "document_type_id": line.document_type_id.id,
                        "category_group": line.category_group,
                        "action_view": line.action_view,
                        "action_upload": line.action_upload,
                        "action_approve": line.action_approve,
                        "action_download": line.action_download,
                        "action_archive": line.action_archive,
                        "action_delete": line.action_delete,
                        "action_export": line.action_export,
                        "action_manage_settings": line.action_manage_settings,
                    },
                )
            )
        if line_commands:
            role.write({"line_ids": line_commands})
        emitter = self.env.get("doc.audit.emitter.service")
        if emitter:
            emitter.section31(
                "role_created",
                role,
                _("Cloned from %s") % source.name,
                module="settings",
            )
        return role.serialize_for_api()

    @api.model
    def roles_editor_context(self):
        self._require_author()
        settings = self.env["doc.dms.settings.read.service"].build_payload()
        modules = settings.get("modules") or {}
        return {
            "modules_enabled": modules,
            "approval_workflow_active": bool(
                (settings.get("approval_workflow") or {}).get("enabled")
            ),
        }

    @api.model
    def list_members(self, search="", limit=10, offset=0, page=None, page_size=None):
        self._require_author()
        self.ensure_odoo_admin_super_admin_bindings(self.env.user)
        if page is not None:
            page = max(int(page or 1), 1)
            page_size = min(max(int(page_size or limit or 10), 1), 100)
            offset = (page - 1) * page_size
            limit = page_size
        employees, total, limit, offset = self.env[
            "doc.employee.files.service"
        ].search_company_employees(search=search or "", limit=limit, offset=offset)
        roles = self._search_assignable_roles()
        page = (offset // limit) + 1 if limit else 1
        return {
            "roles": [role.serialize_for_api() for role in roles],
            "members": [
                self._serialize_member(employee, roles) for employee in employees
            ],
            "total": total,
            "page": page,
            "page_size": limit,
        }

    @api.model
    def _serialize_member(self, employee, roles):
        user = employee.user_id
        assigned = user.employee_files_role_ids.ids if user else []
        return {
            "employee_id": employee.id,
            "employee_name": employee.name,
            "department": employee.department_id.name or "",
            "job_title": employee.job_title or "",
            "user_id": user.id if user else False,
            "user_name": user.name if user else "",
            "user_login": user.login if user else "",
            "has_login": bool(user),
            "employee_files_role_ids": assigned,
        }

    @api.model
    def assign_user_roles(self, user_id, role_ids):
        self._require_author()
        self.ensure_odoo_admin_super_admin_bindings(self.env.user)
        user = self.env["res.users"].sudo().browse(int(user_id))
        if not user or not user.active:
            raise UserError(_("User not found."))
        if user.company_id and user.company_id != self.env.company:
            raise UserError(_("You can only manage users in your company."))
        roles = self._role_model().browse([int(rid) for rid in role_ids or []])
        assignable = self._search_assignable_roles()
        roles = roles.filtered(lambda role: role in assignable)
        before_ids = set(user.employee_files_role_ids.ids)
        after_ids = set(roles.ids)
        user.write({"employee_files_role_ids": [(6, 0, roles.ids)]})
        emitter = self.env.get("doc.audit.emitter.service")
        if emitter:
            for role_id in after_ids - before_ids:
                role = self._role_model().browse(role_id)
                emitter.section31(
                    "role_assigned",
                    user,
                    _("Assigned role %s") % role.name,
                    module="settings",
                )
            for role_id in before_ids - after_ids:
                role = self._role_model().browse(role_id)
                emitter.section31(
                    "role_removed",
                    user,
                    _("Removed role %s") % role.name,
                    module="settings",
                )
        employee = user.employee_id
        return self._serialize_member(
            employee if employee else self.env["hr.employee"],
            roles,
        )

    @api.model
    def migrate_legacy_document_managers(self):
        """Assign HR Admin to legacy document manager group users without DMS roles."""
        company = self.env.company
        self.env["doc.org.role.template.service"].with_company(
            company
        ).ensure_canonical_org_roles(company)
        self.ensure_odoo_admin_super_admin_bindings()
        Role = self._role_model()
        hr_admin = Role.search(
            [
                ("company_id", "=", company.id),
                ("role_template_key", "=", "hr_admin"),
                ("is_system_template", "=", True),
            ],
            limit=1,
        )
        if not hr_admin:
            return False
        manager_group = self.env.ref(
            "cleon_document_management.group_document_manager",
            raise_if_not_found=False,
        )
        if not manager_group:
            return hr_admin.id
        dms = self.env["doc.dms.permission"]
        users = manager_group.users.filtered(
            lambda user: user.active and user.company_id in (False, company)
        )
        for user in users:
            if dms.user_assigned_roles(user):
                continue
            user.write({"employee_files_role_ids": [(4, hr_admin.id)]})
        return hr_admin.id

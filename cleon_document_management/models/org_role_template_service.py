# -*- coding: utf-8 -*-
from odoo import api, models

from .dms_permission_catalog import (
    CANONICAL_ORG_ROLE_TEMPLATE_KEYS,
    DMS_ROLE_TEMPLATE_DEFAULTS,
    ORG_PERMISSION_KEYS,
    ORG_TEMPLATE_DISPLAY_NAMES,
    TEMPLATE_EMPLOYEE_SCOPE,
    sync_legacy_fields_from_permissions,
)


class DocOrgRoleTemplateService(models.AbstractModel):
    _name = "doc.org.role.template.service"
    _description = "Canonical DMS module roles (fixed permissions)"

    @api.model
    def _dms_permissions_match(self, role, expected_perms):
        current = dict(role.dms_permissions or {})
        return current == dict(expected_perms)

    @api.model
    def _canonical_role_matches_template(self, role, vals):
        """Avoid no-op writes on hot paths (page loads) that contend on role rows."""
        if role.name != vals.get("name"):
            return False
        if role.active != vals.get("active", True):
            return False
        if role.employee_scope != vals.get("employee_scope"):
            return False
        if not self._dms_permissions_match(role, vals.get("dms_permissions") or {}):
            return False
        if role.line_ids:
            return False
        return True

    @api.model
    def _vals_for_template(self, Role, template_key, perms):
        org_slice = {k: v for k, v in perms.items() if k in ORG_PERMISSION_KEYS}
        stub = Role.new({"org_permissions": org_slice})
        sync_legacy_fields_from_permissions(stub, org_slice)
        return {
            "name": ORG_TEMPLATE_DISPLAY_NAMES[template_key],
            "active": True,
            "is_system_template": True,
            "is_readonly_template": True,
            "role_template_key": template_key,
            "employee_scope": TEMPLATE_EMPLOYEE_SCOPE.get(template_key, "all"),
            "dms_permissions": dict(perms),
            "org_permissions": org_slice,
            "org_access_library": stub.org_access_library,
            "org_create_folder": stub.org_create_folder,
            "org_manage_folders": stub.org_manage_folders,
            "org_share_manage_access": stub.org_share_manage_access,
            "org_folder_archive": stub.org_folder_archive,
            "org_folder_delete": stub.org_folder_delete,
            "org_upload": stub.org_upload,
            "org_document_manage": stub.org_document_manage,
            "org_document_manage_access": stub.org_document_manage_access,
            "org_document_delete": stub.org_document_delete,
            "line_ids": [(5, 0, 0)],
        }

    @api.model
    def ensure_canonical_org_roles(self, company=None):
        company = company or self.env.company
        Role = self.env["doc.employee.files.role"].with_company(company)
        for template_key in CANONICAL_ORG_ROLE_TEMPLATE_KEYS:
            perms = DMS_ROLE_TEMPLATE_DEFAULTS[template_key]
            existing = Role.search(
                [
                    ("company_id", "=", company.id),
                    ("role_template_key", "=", template_key),
                ],
                limit=1,
            )
            vals = self._vals_for_template(Role, template_key, perms)
            vals["company_id"] = company.id
            if existing:
                if self._canonical_role_matches_template(existing, vals):
                    continue
                write_vals = dict(vals)
                if not existing.line_ids:
                    write_vals.pop("line_ids", None)
                existing.with_context(
                    allow_employee_files_role_create=True,
                    skip_canonical_permission_sync=True,
                ).write(write_vals)
                existing._sync_permissions_from_catalog()
            else:
                Role.with_context(allow_employee_files_role_create=True).create(vals)

        self._retire_non_canonical_roles(company)

    @api.model
    def _retire_non_canonical_roles(self, company):
        Role = self.env["doc.employee.files.role"].with_company(company)
        hr_admin = Role.search(
            [
                ("company_id", "=", company.id),
                ("role_template_key", "=", "hr_admin"),
                ("is_system_template", "=", True),
            ],
            limit=1,
        )
        legacy_roles = Role.search(
            [
                ("company_id", "=", company.id),
                ("role_template_key", "not in", list(CANONICAL_ORG_ROLE_TEMPLATE_KEYS)),
            ]
        )
        migration_roles = Role.search(
            [
                ("company_id", "=", company.id),
                ("is_migration_seed", "=", True),
            ]
        )
        to_retire = legacy_roles | migration_roles
        if not to_retire:
            return
        for role in to_retire:
            if hr_admin and role.user_ids:
                hr_admin.write({"user_ids": [(4, user.id) for user in role.user_ids]})
            role.write({"active": False})

    @api.model
    def ensure_system_templates(self, company=None):
        return self.ensure_canonical_org_roles(company)

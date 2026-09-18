# -*- coding: utf-8 -*-
import logging

from odoo import _, api, models
from odoo.exceptions import UserError

from .employee_files_role import DEPENDENT_ACTION_FIELDS, EF_ACTION_FIELDS

_logger = logging.getLogger(__name__)

MIGRATION_ROLE_NAME = "Full Employee Files access (migrated)"


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
    def list_roles(self):
        self._require_author()
        roles = self.env["doc.employee.files.role"].search(
            [("company_id", "=", self.env.company.id)],
            order="name",
        )
        return [role.serialize_for_api() for role in roles]

    @api.model
    def _normalize_line_payload(self, payload):
        actions = payload.get("actions") or {}
        view = bool(actions.get("view"))
        line_vals = {
            "sequence": int(payload.get("sequence") or 10),
            "applies_all_categories": bool(payload.get("applies_all_categories")),
            "document_type_id": payload.get("document_type_id") or False,
            "category_group": payload.get("category_group") or False,
            "action_view": view,
        }
        for field_name in EF_ACTION_FIELDS:
            api_key = field_name.replace("action_", "")
            enabled = bool(actions.get(api_key)) if view else False
            line_vals[field_name] = enabled
        if not view:
            for field_name in DEPENDENT_ACTION_FIELDS:
                line_vals[field_name] = False
        return line_vals

    @api.model
    def save_role(self, payload):
        self._require_author()
        Role = self.env["doc.employee.files.role"]
        role_id = payload.get("id")
        values = {
            "name": (payload.get("name") or "").strip(),
            "description": payload.get("description") or "",
            "active": bool(payload.get("active", True)),
            "employee_scope": payload.get("employee_scope") or "own_team",
            "company_id": self.env.company.id,
        }
        if not values["name"]:
            raise UserError(_("Role name is required."))
        lines_payload = payload.get("lines") or []
        line_commands = [(5, 0, 0)]
        for item in lines_payload:
            line_commands.append((0, 0, self._normalize_line_payload(item)))
        values["line_ids"] = line_commands
        if role_id:
            role = Role.browse(int(role_id))
            if not role or role.company_id != self.env.company:
                raise UserError(_("Role not found."))
            role.write({key: val for key, val in values.items() if key != "company_id"})
        else:
            role = Role.create(values)
        return role.serialize_for_api()

    @api.model
    def delete_role(self, role_id):
        self._require_author()
        role = self.env["doc.employee.files.role"].browse(int(role_id))
        if not role or role.company_id != self.env.company:
            raise UserError(_("Role not found."))
        role.unlink()
        return True

    @api.model
    def list_members(self, search="", limit=50):
        self._require_author()
        domain = [
            ("company_id", "in", [False, self.env.company.id]),
            ("active", "=", True),
        ]
        if search:
            domain = [
                "&",
                *domain,
                "|",
                "|",
                ("name", "ilike", search),
                ("work_email", "ilike", search),
                ("user_id.login", "ilike", search),
            ]
        employees = (
            self.env["hr.employee"]
            .sudo()
            .search(domain, order="name", limit=min(int(limit or 50), 200))
        )
        roles = self.env["doc.employee.files.role"].search(
            [("company_id", "=", self.env.company.id), ("active", "=", True)],
            order="name",
        )
        return {
            "roles": [role.serialize_for_api() for role in roles],
            "members": [self._serialize_member(employee, roles) for employee in employees],
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
        user = self.env["res.users"].sudo().browse(int(user_id))
        if not user or not user.active:
            raise UserError(_("User not found."))
        if user.company_id and user.company_id != self.env.company:
            raise UserError(_("You can only manage users in your company."))
        roles = self.env["doc.employee.files.role"].browse([int(rid) for rid in role_ids or []])
        roles = roles.filtered(lambda role: role.company_id == self.env.company and role.active)
        user.write({"employee_files_role_ids": [(6, 0, roles.ids)]})
        employee = user.employee_id
        return self._serialize_member(
            employee if employee else self.env["hr.employee"],
            roles,
        )

    @api.model
    def migrate_legacy_document_managers(self):
        """One-time style migration: seed role and assign to legacy manager group users."""
        company = self.env.company
        Role = self.env["doc.employee.files.role"]
        role = Role.search(
            [
                ("company_id", "=", company.id),
                ("is_migration_seed", "=", True),
            ],
            limit=1,
        )
        if not role:
            role = Role.create(
                {
                    "name": MIGRATION_ROLE_NAME,
                    "description": _(
                        "Automatically assigned to users who previously had Document Manager access."
                    ),
                    "company_id": company.id,
                    "employee_scope": "all",
                    "is_migration_seed": True,
                    "line_ids": [
                        (
                            0,
                            0,
                            {
                                "applies_all_categories": True,
                                "action_view": True,
                                "action_upload": True,
                                "action_approve": True,
                                "action_download": True,
                                "action_archive": True,
                                "action_delete": True,
                                "action_export": True,
                                "action_manage_settings": True,
                            },
                        )
                    ],
                }
            )
        manager_group = self.env.ref(
            "cleon_document_management.group_document_manager",
            raise_if_not_found=False,
        )
        if not manager_group:
            return role.id
        users = manager_group.users.filtered(
            lambda user: user.active and user.company_id in (False, company)
        )
        if users:
            role.write({"user_ids": [(4, user.id) for user in users]})
        return role.id

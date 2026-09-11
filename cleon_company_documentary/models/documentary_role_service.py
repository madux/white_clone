# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError, UserError


class DocumentaryRoleService(models.AbstractModel):
    _name = "documentary.role.service"
    _description = "Company Documentary role assignment service"

    @api.model
    def _require_system_admin(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(
                _("Only system administrators can manage Company Documentary roles.")
            )

    @api.model
    def _definitions(self):
        self._require_system_admin()
        self.env["documentary.role.definition"].sync_registry()
        rows = self.env["documentary.role.definition"].search([])
        return [
            {
                "id": row.id,
                "role_key": row.role_key,
                "label": row.label,
                "description": row.description or "",
                "capabilities": row.capabilities or "",
                "assignable": row.assignable,
                "group_id": row.group_id.id,
            }
            for row in rows
        ]

    @api.model
    def _company_employee_domain(self):
        company = self.env.company
        return [
            ("company_id", "in", [False, company.id]),
            ("active", "=", True),
        ]

    @api.model
    def _serialize_member(self, employee):
        user = employee.user_id
        group_ids = set(user.groups_id.ids) if user else set()
        roles = {}
        for definition in self.env["documentary.role.definition"].search([]):
            roles[definition.role_key] = definition.group_id.id in group_ids
        return {
            "employee_id": employee.id,
            "employee_name": employee.name,
            "department": employee.department_id.name or "",
            "job_title": employee.job_title or "",
            "user_id": user.id if user else False,
            "user_name": user.name if user else "",
            "user_login": user.login if user else "",
            "has_login": bool(user),
            "roles": roles,
        }

    @api.model
    def list_members(self, search="", limit=50):
        self._require_system_admin()
        self.env["documentary.role.definition"].sync_registry()
        domain = self._company_employee_domain()
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
        return [self._serialize_member(employee) for employee in employees]

    @api.model
    def _definition_for(self, role_key):
        definition = self.env["documentary.role.definition"].search(
            [("role_key", "=", role_key)],
            limit=1,
        )
        if not definition:
            raise UserError(_("Unknown role: %s") % role_key)
        return definition

    @api.model
    def _write_audit(self, user, employee, definition, action):
        self.env["documentary.role.assignment.audit"].sudo().create(
            {
                "user_id": user.id,
                "employee_id": employee.id if employee else False,
                "group_id": definition.group_id.id,
                "role_key": definition.role_key,
                "action": action,
                "actor_id": self.env.user.id,
            }
        )

    @api.model
    def assign_roles(self, employee_id, assignments):
        self._require_system_admin()
        self.env["documentary.role.definition"].sync_registry()
        employee = self.env["hr.employee"].sudo().browse(int(employee_id))
        if not employee or not employee.active:
            raise UserError(_("Employee not found."))
        if employee.company_id and employee.company_id != self.env.company:
            raise UserError(_("You can only manage employees in your company."))
        user = employee.user_id
        if not user:
            raise UserError(
                _(
                    "This employee does not have a linked user account. "
                    "Create a user in Odoo Settings before assigning roles."
                )
            )

        for item in assignments or []:
            role_key = item.get("role_key")
            enabled = bool(item.get("enabled"))
            if role_key == "user":
                continue
            definition = self._definition_for(role_key)
            if not definition.assignable:
                raise UserError(_("The %s role cannot be assigned manually.") % definition.label)

            has_group = definition.group_id in user.groups_id
            if enabled and not has_group:
                user.write({"groups_id": [(4, definition.group_id.id)]})
                self._write_audit(user, employee, definition, "grant")
                if role_key == "admin":
                    manager_def = self._definition_for("manager")
                    if manager_def.group_id not in user.groups_id:
                        user.write({"groups_id": [(4, manager_def.group_id.id)]})
                        self._write_audit(user, employee, manager_def, "grant")
            elif not enabled and has_group:
                if role_key == "manager":
                    admin_def = self._definition_for("admin")
                    if admin_def.group_id in user.groups_id:
                        user.write({"groups_id": [(3, admin_def.group_id.id)]})
                        self._write_audit(user, employee, admin_def, "revoke")
                user.write({"groups_id": [(3, definition.group_id.id)]})
                self._write_audit(user, employee, definition, "revoke")

        return self._serialize_member(employee)

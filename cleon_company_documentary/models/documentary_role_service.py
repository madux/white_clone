# -*- coding: utf-8 -*-
from odoo import _, api, models
from odoo.exceptions import AccessError, UserError


class DocumentaryRoleService(models.AbstractModel):
    _name = "documentary.role.service"
    _description = "Company Documentary role assignment service"

    @api.model
    def _require_role_admin(self):
        user = self.env.user
        if user.has_group("base.group_system"):
            return
        if user.has_group("cleon_company_documentary.group_company_documentary_admin"):
            return
        raise AccessError(
            _("Documentary Administrator access is required to manage roles.")
        )

    @api.model
    def _definitions(self):
        self._require_role_admin()
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
    def _member_search_domain(self, search=""):
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
        return domain

    @api.model
    def _member_tier_from_roles(self, roles):
        if roles.get("admin"):
            return "administrator"
        if roles.get("manager"):
            return "supervisor"
        return "employee"

    @api.model
    def list_member_stats(self):
        self._require_role_admin()
        self.env["documentary.role.definition"].sync_registry()
        employees = self.env["hr.employee"].sudo().search(
            self._member_search_domain(),
            order="name",
        )
        counts = {"administrator": 0, "supervisor": 0, "employee": 0}
        for employee in employees:
            tier = self._member_tier_from_roles(self._serialize_member(employee)["roles"])
            counts[tier] += 1
        return {"total": len(employees), **counts}

    @api.model
    def list_members(self, search="", limit=5, offset=0):
        self._require_role_admin()
        self.env["documentary.role.definition"].sync_registry()
        domain = self._member_search_domain(search)
        page_limit = min(max(int(limit or 5), 1), 100)
        page_offset = max(int(offset or 0), 0)
        Employee = self.env["hr.employee"].sudo()
        total = Employee.search_count(domain)
        employees = Employee.search(
            domain,
            order="name",
            limit=page_limit,
            offset=page_offset,
        )
        return {
            "items": [self._serialize_member(employee) for employee in employees],
            "total": total,
            "limit": page_limit,
            "offset": page_offset,
        }

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
        self._require_role_admin()
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

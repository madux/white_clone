# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import AccessError, ValidationError

class HrLeaveAuditLog(models.Model):
    _name = "hr.leave.audit.log"
    _description = "Leave Audit Log"
    _order = "occurred_at desc, id desc"

    leave_id = fields.Many2one(
        "hr.leave",
        string="Leave Request",
        required=False,
        readonly=True,
        ondelete="restrict",
    )
    action = fields.Selection([
        ("submitted", "Request Submitted"),
        ("admin_create", "Leave Request Created by Admin"),
        ("forwarded", "Forwarded to Manager"),
        ("approve", "Approved"),
        ("first_approval", "First Approval"),
        ("final_approval", "Final Approval"),
        ("reject", "Rejected"),
        ("cancelled", "Cancelled"),
        ("escalated", "Escalated"),
        ("override_conflict", "Conflict Override"),
        ("edit", "Request Edited"),
        ("comment", "Comment Added"),
        ("policy_change", "Policy Configuration Changed"),
        ("balance_adjustment", "Leave Balance Adjusted"),
        ("balance_allocation", "Leave Balance Allocated"),
        ("accrual_processed", "Accrual Processed"),
        ("calendar_change", "Calendar Updated"),
        ("settings_change", "Settings Updated"),
        ("failed", "Action Failed"),
    ], string="Action", required=True, readonly=True)

    company_id = fields.Many2one("res.company", required=True, readonly=True, index=True, default=lambda self: self.env.company)
    module_area = fields.Selection([
        ("requests", "Requests"), ("policies", "Policies"), ("balance", "Balance"),
        ("accrual", "Accrual"), ("leave_types", "Leave Types"),
        ("calendar", "Calendar"), ("settings", "Settings"),
    ], required=True, readonly=True, index=True, default="requests")
    entity_type = fields.Selection([
        ("leave_request", "Leave Request"), ("leave_type", "Leave Type"),
        ("policy", "Policy"), ("balance", "Balance"),
        ("accrual_plan", "Accrual Plan"), ("eligibility_rule", "Eligibility Rule"),
        ("system", "System"),
    ], required=True, readonly=True, index=True, default="leave_request")
    entity_name = fields.Char(readonly=True, index=True)
    entity_reference = fields.Char(readonly=True, index=True)
    event_status = fields.Selection([("success", "Success"), ("failed", "Failed"), ("pending", "Pending")], required=True, readonly=True, index=True, default="success")
    source = fields.Selection([("web", "Web"), ("mobile", "Mobile"), ("api", "API"), ("system", "System")], required=True, readonly=True, index=True, default="web")
    before_values = fields.Json(readonly=True)
    after_values = fields.Json(readonly=True)
    description = fields.Text(readonly=True)
    device_browser = fields.Char(readonly=True)

    actor_id = fields.Many2one("res.users", string="Actor", required=False, readonly=True)
    actor_label = fields.Char(string="Actor Name", readonly=True)
    actor_role = fields.Char(string="Actor Role", readonly=True)
    is_system = fields.Boolean(string="Is System Action", readonly=True)

    employee_id = fields.Many2one("hr.employee", string="Employee", required=False, readonly=True)
    leave_type_id = fields.Many2one("hr.leave.type", string="Leave Type", required=False, readonly=True)

    date_from = fields.Date(string="Start Date", readonly=True)
    date_to = fields.Date(string="End Date", readonly=True)
    duration = fields.Float(string="Duration (Days)", readonly=True)

    note = fields.Text(string="Reason / Note", readonly=True)
    occurred_at = fields.Datetime(string="Timestamp", default=fields.Datetime.now, required=True, readonly=True)

    ip_address = fields.Char(string="IP Address", readonly=True)
    session_ref = fields.Char(string="Session Reference", readonly=True)
    department_id = fields.Many2one(related="employee_id.department_id", store=True, readonly=True, index=True)

    @api.model_create_multi
    def create(self, vals_list):
        action_labels = dict(self._fields["action"].selection)
        for vals in vals_list:
            action = vals.get("action", "submitted")
            leave = self.env["hr.leave"].browse(vals.get("leave_id", 0)).exists()
            leave_type = self.env["hr.leave.type"].browse(vals.get("leave_type_id", 0)).exists()
            employee = self.env["hr.employee"].browse(vals.get("employee_id", 0)).exists()
            vals.setdefault("company_id", (employee.company_id or leave.employee_id.company_id or leave_type.company_id or self.env.company).id)
            if action in ("policy_change",):
                vals.setdefault("module_area", "policies"); vals.setdefault("entity_type", "policy")
            elif action in ("balance_adjustment", "balance_allocation"):
                vals.setdefault("module_area", "balance"); vals.setdefault("entity_type", "balance")
            elif action == "accrual_processed":
                vals.setdefault("module_area", "accrual"); vals.setdefault("entity_type", "accrual_plan")
            elif action == "calendar_change":
                vals.setdefault("module_area", "calendar"); vals.setdefault("entity_type", "system")
            elif action == "settings_change":
                vals.setdefault("module_area", "settings"); vals.setdefault("entity_type", "system")
            else:
                vals.setdefault("module_area", "requests"); vals.setdefault("entity_type", "leave_request")
            vals.setdefault("entity_name", leave.display_name if leave else (leave_type.name if leave_type else action_labels.get(action, _("System Event"))))
            vals.setdefault("entity_reference", leave.request_ref if leave else (leave_type.leave_code if leave_type else ""))
            vals.setdefault("description", vals.get("note") or action_labels.get(action, action))
            vals.setdefault("event_status", "failed" if action == "failed" else "success")
            if vals.get("is_system"):
                vals.setdefault("source", "system")
            self._enrich_request_metadata(vals)
        return super().create(vals_list)

    @api.model
    def _enrich_request_metadata(self, vals):
        if vals.get("device_browser") and vals.get("source"):
            return
        try:
            from odoo.http import request
            http_request = request.httprequest if request and getattr(request, "httprequest", None) else None
            user_agent = http_request.headers.get("User-Agent", "") if http_request else ""
            vals.setdefault("ip_address", http_request.remote_addr if http_request else "")
            vals.setdefault("device_browser", user_agent[:255])
            if not vals.get("source"):
                vals["source"] = "mobile" if any(token in user_agent.lower() for token in ("mobile", "android", "iphone")) else "web"
        except Exception:
            vals.setdefault("source", "system" if vals.get("is_system") else "web")

    @api.constrains("action", "leave_id", "employee_id", "leave_type_id")
    def _check_audit_references(self):
        for log in self:
            if log.action in ("policy_change", "balance_adjustment", "balance_allocation", "accrual_processed", "calendar_change", "settings_change", "failed"):
                if log.action in ("balance_adjustment", "balance_allocation") and not log.leave_type_id:
                    raise ValidationError(_("Balance audit logs require a valid Leave Type reference."))
                if log.action in ("balance_adjustment", "balance_allocation") and not log.employee_id:
                    raise ValidationError(_("Balance audit logs require a valid Employee reference."))
            else:
                if not log.leave_id or not log.employee_id or not log.leave_type_id:
                    raise ValidationError(_("Leave audit logs require valid Leave Request, Employee, and Leave Type references."))

    @api.model
    def get_audit_page_data(self, filters=None, sort=None, offset=0, limit=25):
        if not (self.env.user.has_group("base.group_system") or self.env.user.has_group("hr_holidays.group_hr_holidays_manager")):
            raise AccessError(_("Only a Time Off Administrator can access the audit log."))
        filters = filters or {}; domain = [("company_id", "in", self.env.companies.ids)]
        for field_name in ("action", "module_area", "entity_type", "event_status", "source", "department_id"):
            value = filters.get(field_name)
            if value:
                domain.append((field_name, "=", int(value) if field_name == "department_id" else value))
        if filters.get("actor_role"):
            domain.append(("actor_role", "=ilike", filters["actor_role"]))
        if filters.get("date_from"):
            domain.append(("occurred_at", ">=", filters["date_from"] + " 00:00:00"))
        if filters.get("date_to"):
            domain.append(("occurred_at", "<=", filters["date_to"] + " 23:59:59"))
        search = (filters.get("search") or "").strip()
        if search:
            domain += ["|", "|", "|", "|", ("entity_name", "ilike", search), ("entity_reference", "ilike", search), ("actor_label", "ilike", search), ("description", "ilike", search), ("ip_address", "ilike", search)]
        allowed_sort = {"occurred_at", "action", "module_area", "entity_type", "actor_label", "event_status", "source"}
        sort = sort or {}; field_name = sort.get("field") if sort.get("field") in allowed_sort else "occurred_at"
        direction = "asc" if sort.get("direction") == "asc" else "desc"
        total = self.search_count(domain); records = self.search(domain, order="%s %s, id desc" % (field_name, direction), offset=int(offset), limit=int(limit))
        action_labels = dict(self._fields["action"].selection); module_labels = dict(self._fields["module_area"].selection); entity_labels = dict(self._fields["entity_type"].selection)
        rows = [{
            "id": record.id, "timestamp": fields.Datetime.to_string(record.occurred_at),
            "action": record.action, "action_label": action_labels.get(record.action),
            "module_area": record.module_area, "module_label": module_labels.get(record.module_area),
            "entity_type": record.entity_type, "entity_type_label": entity_labels.get(record.entity_type),
            "entity_name": record.entity_name or "", "entity_reference": record.entity_reference or "",
            "actor": record.actor_label or record.actor_id.name or _("System"), "actor_role": record.actor_role or _("System"),
            "employee": record.employee_id.name or "", "employee_code": record.employee_id.employee_number or "",
            "department": record.department_id.name or "", "before": record.before_values or {}, "after": record.after_values or {},
            "description": record.description or record.note or "", "ip_address": record.ip_address or "",
            "device_browser": record.device_browser or "", "source": record.source, "status": record.event_status,
        } for record in records]
        all_records = self.search(domain)
        return {"rows": rows, "total": total, "summary": {"requests": len(all_records.filtered(lambda r: r.module_area == "requests")), "policies": len(all_records.filtered(lambda r: r.module_area == "policies")), "leave_types": len(all_records.filtered(lambda r: r.module_area == "leave_types")), "accrual": len(all_records.filtered(lambda r: r.module_area == "accrual")), "failed": len(all_records.filtered(lambda r: r.event_status == "failed"))}, "departments": [{"id": d.id, "name": d.name} for d in self.env["hr.department"].search([("company_id", "in", self.env.companies.ids)], order="name")], "roles": sorted(set(self.search([("company_id", "in", self.env.companies.ids)]).mapped("actor_role")) - {False}), "actions": [{"key": key, "label": label} for key, label in self._fields["action"].selection]}

    def write(self, vals):
        raise AccessError(_("Leave audit records are immutable and cannot be modified."))

    def unlink(self):
        raise AccessError(_("Leave audit records cannot be deleted."))

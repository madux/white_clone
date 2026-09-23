from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class TimePolicy(models.Model):
    _inherit = "cleon.time.policy"

    overtime_request_mode = fields.Selection([
        ("automatic", "Automatic"), ("manual", "Manual Request"), ("both", "Automatic and Manual"),
    ], default="both", required=True)

    overtime_auto_approve_max_hours = fields.Float(string="Max Auto-Approve Hours", default=2.0)

    @api.model
    def get_payroll_handoff_data(self, date_from=None, date_to=None, state_filter="ready", preview_mode=False):
        """Outbound payroll handoff contract for approved overtime records.

        Preview calls without dates are scoped to the current calendar month. A final
        handoff must always name its exact accounting period. Any overlap with an
        administratively locked period blocks the complete final handoff; records are
        never silently omitted from a requested range.
        """
        if not self._tm_can_configure() and self._tm_role() not in ("hr_manager", "system_admin"):
            raise AccessError(_("Only HR Administrators and Managers can export payroll handoff data."))

        company = self.env.company
        policy = self.search([("company_id", "=", company.id)], limit=1)

        if not preview_mode and not (policy and policy.payroll_integration):
            raise UserError(_("Payroll integration is disabled in Time Management policy settings."))

        if not date_from and not date_to:
            if not preview_mode:
                raise ValidationError(_("A date range is required for a final payroll handoff."))
            date_from = fields.Date.today().replace(day=1)
            next_month = (date_from.replace(day=28) + timedelta(days=4)).replace(day=1)
            date_to = next_month - timedelta(days=1)
        elif not date_from or not date_to:
            raise ValidationError(_("Both start and end dates are required for payroll handoff."))

        date_from = fields.Date.to_date(date_from)
        date_to = fields.Date.to_date(date_to)
        if date_from > date_to:
            raise ValidationError(_("Payroll handoff start date cannot be after its end date."))

        target_state_filter = state_filter if state_filter in ("ready", "transferred", "all") else "ready"
        domain = [("company_id", "=", company.id), ("state", "=", "approved")]
        if target_state_filter == "ready":
            domain.append(("payroll_state", "=", "ready"))
        elif target_state_filter == "transferred":
            domain.append(("payroll_state", "=", "transferred"))
        else:
            domain.append(("payroll_state", "in", ["ready", "transferred"]))

        if date_from:
            domain.append(("date", ">=", date_from))
        if date_to:
            domain.append(("date", "<=", date_to))

        ot_records = self.env["cleon.overtime.request"].search(domain)
        ApprovalInstance = self.env.get("cleon.approval.instance")
        StepModel = self.env.get("cleon.approval.instance.step")

        items = []
        unresolved_codes_count = 0

        for ot in ot_records:
            emp = ot.employee_id.sudo()
            code = emp.employee_number or False
            has_missing_code = not bool(code)
            if has_missing_code:
                unresolved_codes_count += 1

            app_inst = False
            if "approval_instance_id" in ot._fields and ot.approval_instance_id:
                app_inst = ot.approval_instance_id
            elif ApprovalInstance is not None:
                app_inst = ApprovalInstance.sudo().search([
                    ("res_model", "=", "cleon.overtime.request"),
                    ("res_id", "=", ot.id),
                ], limit=1, order="id desc")

            decision_src = app_inst.decision_source if (app_inst and app_inst.decision_source) else "human"

            final_step = False
            if app_inst and StepModel is not None:
                steps = StepModel.sudo().search([("instance_id", "=", app_inst.id)])
                if steps:
                    decided = steps.filtered(lambda s: s.state in ("approved", "rejected") or s.decision_user_id)
                    if decided:
                        final_step = decided.sorted(lambda s: (s.sequence, s.id), reverse=True)[0]

            final_approver_name = "System Automation Engine"
            if final_step and final_step.decision_user_id:
                final_approver_name = final_step.decision_user_id.sudo().name
            elif ot.approver_id:
                final_approver_name = ot.approver_id.sudo().name

            decision_time = False
            if final_step and final_step.decision_at:
                decision_time = fields.Datetime.to_string(final_step.decision_at)
            elif app_inst and app_inst.write_date:
                decision_time = fields.Datetime.to_string(app_inst.write_date)
            elif ot.decision_at:
                decision_time = fields.Datetime.to_string(ot.decision_at)
            else:
                decision_time = fields.Datetime.to_string(ot.create_date)

            approval_ref = app_inst.name if hasattr(app_inst, "name") and app_inst.name else (f"APP-INST-{app_inst.id}" if app_inst else f"OT-APPROVAL-{ot.id}")

            items.append({
                "id": ot.id,
                "employee_id": emp.id,
                "employee_name": emp.name,
                "employee_code": code,
                "missing_code": has_missing_code,
                "readiness_error": _("Missing payroll employee code") if has_missing_code else False,
                "date": fields.Date.to_string(ot.date),
                "overtime_hours": ot.overtime_hours,
                "regular_hours": ot.regular_hours,
                "overtime_type": getattr(ot, "category", "daily"),
                "payroll_state": ot.payroll_state,
                "approval_instance_id": app_inst.id if app_inst else False,
                "approval_reference": approval_ref,
                "final_decision_at": decision_time,
                "decision_source": decision_src,
                "final_approver": final_approver_name,
            })

        period_lock_records = []
        if "cleon.time.period.lock" in self.env:
            lock_domain = [("company_id", "=", company.id), ("state", "=", "locked")]
            if date_from:
                lock_domain.append(("date_to", ">=", date_from))
            if date_to:
                lock_domain.append(("date_from", "<=", date_to))
            period_lock_records = self.env["cleon.time.period.lock"].search(lock_domain)

        is_period_locked = len(period_lock_records) > 0
        locked_lock_name = period_lock_records[0].name if period_lock_records else False

        if is_period_locked and not preview_mode:
            raise UserError(_("Selected handoff date range overlaps with locked period '%s'. Final payroll export is blocked.") % locked_lock_name)

        return {
            "company_id": company.id,
            "company_name": company.name,
            "payroll_integration": bool(policy and policy.payroll_integration),
            "preview_mode": preview_mode,
            "state_filter": target_state_filter,
            "date_from": date_from,
            "date_to": date_to,
            "total_records": len(items),
            "total_overtime_hours": sum(i["overtime_hours"] for i in items),
            "unresolved_employee_codes_count": unresolved_codes_count,
            "period_locked": is_period_locked,
            "period_locked_count": len(period_lock_records),
            "period_lock_name": locked_lock_name,
            "records": items,
        }

    @api.model
    def _installed_time_features(self):
        return dict(super()._installed_time_features(), overtime=True)

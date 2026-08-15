from collections import defaultdict
from datetime import timedelta

from dateutil.relativedelta import relativedelta

from odoo import _, api, fields, models
from odoo.exceptions import AccessError, UserError, ValidationError


class HrClaim(models.Model):
    _name = "hr.claim"
    _description = "Employee Expense Claim"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "submitted_date desc, id desc"
    _check_company_auto = True

    name = fields.Char(default="New", readonly=True, copy=False, index=True)
    title = fields.Char(required=True, tracking=True)
    description = fields.Text(tracking=True)
    employee_id = fields.Many2one(
        "hr.employee",
        required=True,
        default=lambda self: self._default_employee(),
        tracking=True,
        index=True,
        check_company=True,
    )
    department_id = fields.Many2one(
        related="employee_id.department_id", store=True, readonly=True, index=True
    )
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    currency_id = fields.Many2one(
        related="company_id.currency_id", store=True, readonly=True
    )
    claim_type_id = fields.Many2one(
        "hr.claim.type",
        required=True,
        tracking=True,
        domain="[('active', '=', True), ('company_id', '=', company_id)]",
        check_company=True,
    )
    money_type = fields.Selection(
        [("personal", "Personal"), ("company", "Company"), ("hybrid", "Hybrid")],
        required=True,
        default="personal",
        tracking=True,
    )
    reimbursement_method = fields.Selection(
        [
            ("bank", "Bank Transfer"),
            ("payroll", "Via Payroll"),
            ("cheque", "Cheque"),
            ("card", "Expense Card Top-up"),
            ("cash", "Cash Payment"),
        ],
        default="bank",
        required=True,
        tracking=True,
    )
    expense_start_date = fields.Date(tracking=True)
    expense_end_date = fields.Date(tracking=True)
    submitted_date = fields.Datetime(readonly=True, copy=False, tracking=True)
    line_ids = fields.One2many(
        "hr.claim.line", "claim_id", string="Expense Items", copy=True
    )
    amount_total = fields.Monetary(
        compute="_compute_amount_total", store=True, tracking=True
    )
    attachment_ids = fields.Many2many(
        "ir.attachment",
        "hr_claim_attachment_rel",
        "claim_id",
        "attachment_id",
        string="Receipts & Attachments",
        copy=False,
    )
    receipt_attachment_count = fields.Integer(
        string="Receipt Count", compute="_compute_attachment_count"
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("submitted", "Submitted"),
            ("returned", "Returned"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("paid", "Paid"),
            ("cancelled", "Cancelled"),
        ],
        required=True,
        default="draft",
        tracking=True,
        copy=False,
        index=True,
    )
    approval_comment = fields.Text(copy=False)
    rejection_reason = fields.Text(readonly=True, copy=False, tracking=True)
    return_reason = fields.Text(readonly=True, copy=False, tracking=True)
    approved_by_id = fields.Many2one("res.users", readonly=True, copy=False)
    approved_date = fields.Datetime(readonly=True, copy=False, tracking=True)
    paid_date = fields.Datetime(readonly=True, copy=False, tracking=True)
    payment_ids = fields.One2many("hr.claim.payment", "claim_id", string="Payments")
    amount_paid = fields.Monetary(
        compute="_compute_payment_totals", store=True, currency_field="currency_id"
    )
    residual_amount = fields.Monetary(
        compute="_compute_payment_totals", store=True, currency_field="currency_id"
    )
    payment_state = fields.Selection(
        [("not_paid", "Not Paid"), ("partial", "Partially Paid"), ("paid", "Paid")],
        compute="_compute_payment_totals",
        store=True,
    )
    audit_ids = fields.One2many("hr.claim.audit", "claim_id", string="Audit Trail")

    _sql_constraints = [
        ("name_unique", "unique(name)", "Claim reference must be unique."),
    ]

    @api.model
    def _default_employee(self):
        return self.env["hr.employee"].search(
            [("user_id", "=", self.env.user.id), ("company_id", "=", self.env.company.id)],
            limit=1,
        )

    @api.depends("line_ids.amount")
    def _compute_amount_total(self):
        for claim in self:
            claim.amount_total = sum(claim.line_ids.mapped("amount"))

    @api.depends("attachment_ids")
    def _compute_attachment_count(self):
        for claim in self:
            claim.receipt_attachment_count = len(claim.attachment_ids)

    @api.depends("payment_ids.amount", "payment_ids.state", "amount_total")
    def _compute_payment_totals(self):
        for claim in self:
            paid = sum(claim.payment_ids.filtered(lambda p: p.state == "completed").mapped("amount"))
            claim.amount_paid = paid
            claim.residual_amount = max(claim.amount_total - paid, 0.0)
            if paid <= 0:
                claim.payment_state = "not_paid"
            elif claim.currency_id.compare_amounts(paid, claim.amount_total) >= 0:
                claim.payment_state = "paid"
            else:
                claim.payment_state = "partial"

    @api.onchange("claim_type_id")
    def _onchange_claim_type_id(self):
        if self.claim_type_id:
            self.reimbursement_method = self.claim_type_id.payment_method

    @api.constrains("expense_start_date", "expense_end_date")
    def _check_expense_dates(self):
        for claim in self:
            if (
                claim.expense_start_date
                and claim.expense_end_date
                and claim.expense_start_date > claim.expense_end_date
            ):
                raise ValidationError("Expense period start must be before its end.")

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", "New") == "New":
                vals["name"] = self.env["ir.sequence"].next_by_code("hr.claim") or "New"
            if vals.get("employee_id") and not self.env.user.has_group(
                "hr_claims.group_hr_claim_admin"
            ):
                employee = self.env["hr.employee"].browse(vals["employee_id"])
                if employee.user_id != self.env.user:
                    raise AccessError("You can only create claims for yourself.")
        records = super().create(vals_list)
        for record in records:
            record._log_action("created", _("Claim saved as draft."))
        return records

    def _is_admin(self):
        return self.env.user.has_group("hr_claims.group_hr_claim_admin")

    def _is_manager(self):
        return self.env.user.has_group("hr_claims.group_hr_claim_manager")

    def _is_finance(self):
        return self.env.user.has_group("hr_claims.group_hr_claim_finance")

    def _is_owner(self):
        self.ensure_one()
        return self.employee_id.user_id == self.env.user

    def _ensure_user_can_edit(self):
        for claim in self:
            if claim._is_admin():
                continue
            if not claim._is_owner() or claim.state not in ("draft", "returned"):
                raise AccessError("Only the owner can edit a Draft or Returned claim.")

    def write(self, vals):
        if not self.env.su and not self.env.context.get("hr_claim_workflow"):
            if "state" in vals:
                raise AccessError("Claim states can only be changed through workflow actions.")
            self._ensure_user_can_edit()
        return super().write(vals)

    def unlink(self):
        if not self._is_admin():
            for claim in self:
                if not claim._is_owner() or claim.state != "draft":
                    raise AccessError("Only your own Draft claims can be deleted.")
        return super().unlink()

    def _log_action(self, action, description):
        for claim in self:
            self.env["hr.claim.audit"].create(
                {
                    "claim_id": claim.id,
                    "action": action,
                    "description": description,
                    "user_id": self.env.user.id,
                }
            )

    def _check_owner_or_admin(self):
        for claim in self:
            if not claim._is_admin() and not claim._is_owner():
                raise AccessError("You can only perform this action on your own claim.")

    def _validate_for_submission(self):
        today = fields.Date.context_today(self)
        for claim in self:
            if not claim.line_ids or claim.amount_total <= 0:
                raise UserError("Add at least one expense item with a positive amount.")
            claim_type = claim.claim_type_id
            if not claim_type.is_employee_eligible(claim.employee_id):
                raise UserError("You are not eligible for this claim type.")
            if claim_type.amount_type == "fixed" and claim.currency_id.compare_amounts(
                claim.amount_total, claim_type.fixed_amount
            ) != 0:
                raise UserError(
                    _("This fixed claim type requires a total of %s.")
                    % claim_type.fixed_amount
                )
            if claim_type.minimum_amount and claim.currency_id.compare_amounts(
                claim.amount_total, claim_type.minimum_amount
            ) < 0:
                raise UserError("The claim is below the configured minimum amount.")
            limits = [
                amount
                for amount in (claim_type.maximum_amount, claim_type.maximum_per_claim)
                if amount
            ]
            if limits and claim.currency_id.compare_amounts(claim.amount_total, min(limits)) > 0:
                raise UserError("The claim exceeds the configured maximum amount.")
            if claim_type.receipt_policy == "required" and not claim.attachment_ids:
                raise UserError("A receipt or supporting document is required.")
            if (
                claim_type.receipt_policy == "conditional"
                and claim.amount_total > claim_type.receipt_threshold
                and not claim.attachment_ids
            ):
                raise UserError("A receipt is required because this claim exceeds the threshold.")
            submission_windows = claim_type.window_ids.filtered(
                lambda w: w.active and w.window_type == "submission"
            )
            dated_windows = submission_windows.filtered(lambda w: w.start_date or w.end_date)
            if dated_windows and not any(
                (not window.start_date or today >= window.start_date)
                and (not window.end_date or today <= window.end_date)
                for window in dated_windows
            ):
                raise UserError("The submission window for this claim type is closed.")
            window_days = claim_type.submission_window_days
            if claim.expense_end_date and window_days and claim.expense_end_date < today - timedelta(
                days=window_days
            ):
                raise UserError("This expense falls outside the allowed submission window.")

    def action_submit(self):
        self._check_owner_or_admin()
        for claim in self:
            if claim.state not in ("draft", "returned"):
                raise UserError("Only Draft or Returned claims can be submitted.")
        self._validate_for_submission()
        for claim in self:
            was_returned = claim.state == "returned"
            claim.with_context(hr_claim_workflow=True).write(
                {"state": "submitted", "submitted_date": fields.Datetime.now()}
            )
            action = "resubmitted" if was_returned else "submitted"
            message = _("Claim resubmitted for approval.") if was_returned else _(
                "Claim submitted for approval."
            )
            claim._log_action(action, message)
            claim.message_post(body=message)
        return True

    def _check_approver(self):
        if not (self._is_manager() or self._is_admin()):
            raise AccessError("Only a Claims Manager or Administrator can make approval decisions.")

    def action_approve(self):
        self._check_approver()
        for claim in self:
            if claim.state != "submitted":
                raise UserError("Only Submitted claims can be approved.")
            claim.with_context(hr_claim_workflow=True).write(
                {
                    "state": "approved",
                    "approved_by_id": self.env.user.id,
                    "approved_date": fields.Datetime.now(),
                    "rejection_reason": False,
                    "return_reason": False,
                }
            )
            claim._log_action("approved", _("Claim approved."))
            claim.message_post(body=_("Claim approved by %s.") % self.env.user.display_name)
        return True

    def action_open_reject_wizard(self):
        self._check_approver()
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Reject Claim"),
            "res_model": "hr.claim.reject.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {"default_claim_id": self.id, "default_decision": "reject"},
        }

    def action_open_return_wizard(self):
        self._check_approver()
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Return Claim"),
            "res_model": "hr.claim.reject.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {"default_claim_id": self.id, "default_decision": "return"},
        }

    def _apply_negative_decision(self, decision, reason):
        self._check_approver()
        if not reason or not reason.strip():
            raise UserError("A reason is required.")
        for claim in self:
            if claim.state != "submitted":
                raise UserError("Only Submitted claims can be rejected or returned.")
            if decision == "reject":
                values = {"state": "rejected", "rejection_reason": reason}
                action, message = "rejected", _("Claim rejected: %s") % reason
            else:
                values = {"state": "returned", "return_reason": reason}
                action, message = "returned", _("Claim returned for correction: %s") % reason
            claim.with_context(hr_claim_workflow=True).write(values)
            claim._log_action(action, message)
            claim.message_post(body=message)
        return True

    def action_withdraw(self):
        self._check_owner_or_admin()
        for claim in self:
            if claim.state != "submitted":
                raise UserError("Only Submitted claims can be withdrawn.")
            claim.with_context(hr_claim_workflow=True).write({"state": "cancelled"})
            claim._log_action("withdrawn", _("Claim withdrawn by employee."))
            claim.message_post(body=_("Claim withdrawn."))
        return True

    def action_cancel(self):
        self._check_owner_or_admin()
        for claim in self:
            if claim.state not in ("draft", "returned"):
                raise UserError("Only Draft or Returned claims can be cancelled.")
            claim.with_context(hr_claim_workflow=True).write({"state": "cancelled"})
            claim._log_action("cancelled", _("Claim cancelled."))
        return True

    def action_reset_to_draft(self):
        self._check_owner_or_admin()
        for claim in self:
            if claim.state not in ("returned", "rejected", "cancelled"):
                raise UserError("This claim cannot be reset to Draft.")
            claim.with_context(hr_claim_workflow=True).write({"state": "draft"})
        return True

    def action_open_payment_wizard(self):
        if not (self._is_finance() or self._is_admin()):
            raise AccessError("Only Finance or an Administrator can process payments.")
        self.ensure_one()
        if self.state != "approved" or not self.claim_type_id.reimbursable:
            raise UserError("Only approved reimbursable claims can be paid.")
        return {
            "type": "ir.actions.act_window",
            "name": _("Register Claim Payment"),
            "res_model": "hr.claim.payment.wizard",
            "view_mode": "form",
            "target": "new",
            "context": {
                "default_claim_id": self.id,
                "default_amount": self.residual_amount,
                "default_payment_method": self.reimbursement_method,
            },
        }

    @api.model
    def get_dashboard_data(self):
        claims = self.search([])
        company_currency = self.env.company.currency_id
        state_labels = dict(self._fields["state"].selection)
        counts = defaultdict(int)
        values = defaultdict(float)
        for claim in claims:
            counts[claim.state] += 1
            values[claim.state] += claim.currency_id._convert(
                claim.amount_total, company_currency, claim.company_id, fields.Date.today()
            )

        start = fields.Date.start_of(fields.Date.today(), "month") - relativedelta(months=5)
        monthly = []
        for offset in range(6):
            month_start = start + relativedelta(months=offset)
            month_end = month_start + relativedelta(months=1)
            submitted = claims.filtered(
                lambda c: c.submitted_date
                and month_start <= c.submitted_date.date() < month_end
            )
            approved = submitted.filtered(lambda c: c.state in ("approved", "paid"))
            paid = claims.filtered(
                lambda c: c.paid_date and month_start <= c.paid_date.date() < month_end
            )
            monthly.append(
                {
                    "label": month_start.strftime("%b %Y"),
                    "submitted": sum(submitted.mapped("amount_total")),
                    "approved": sum(approved.mapped("amount_total")),
                    "paid": sum(paid.mapped("amount_total")),
                }
            )

        by_department = defaultdict(float)
        for claim in claims.filtered(lambda c: c.state in ("approved", "paid")):
            by_department[claim.department_id.display_name or _("No Department")] += claim.amount_total

        pending_claims = claims.filtered(lambda c: c.state == "submitted")
        today = fields.Date.today()
        pending_ages = [
            (today - claim.submitted_date.date()).days
            for claim in pending_claims
            if claim.submitted_date
        ]
        decided_count = counts["approved"] + counts["paid"] + counts["rejected"]
        approved_count = counts["approved"] + counts["paid"]
        recent = claims.sorted(key=lambda c: (c.submitted_date or c.create_date, c.id), reverse=True)[:8]
        return {
            "currency": {"symbol": company_currency.symbol, "position": company_currency.position},
            "role": {
                "employee": True,
                "manager": self.env.user.has_group("hr_claims.group_hr_claim_manager"),
                "finance": self.env.user.has_group("hr_claims.group_hr_claim_finance"),
                "admin": self.env.user.has_group("hr_claims.group_hr_claim_admin"),
            },
            "kpis": {
                "total": len(claims),
                "submitted": counts["submitted"],
                "approved": counts["approved"],
                "paid": counts["paid"],
                "rejected": counts["rejected"],
                "payable_count": len(
                    claims.filtered(
                        lambda c: c.state == "approved" and c.claim_type_id.reimbursable
                    )
                ),
                "total_value": sum(claims.mapped("amount_total")),
                "approved_value": values["approved"] + values["paid"],
                "paid_value": values["paid"],
                "approval_rate": round(100 * approved_count / decided_count, 1)
                if decided_count
                else 0,
                "rejection_rate": round(100 * counts["rejected"] / decided_count, 1)
                if decided_count
                else 0,
                "average_pending_age": round(sum(pending_ages) / len(pending_ages), 1)
                if pending_ages
                else 0,
            },
            "status": [
                {"key": key, "label": state_labels[key], "count": counts[key]}
                for key, _label in self._fields["state"].selection
            ],
            "monthly": monthly,
            "departments": [
                {"name": name, "amount": amount}
                for name, amount in sorted(
                    by_department.items(), key=lambda item: item[1], reverse=True
                )[:8]
            ],
            "recent": [
                {
                    "id": claim.id,
                    "name": claim.name,
                    "title": claim.title,
                    "employee": claim.employee_id.display_name,
                    "amount": claim.amount_total,
                    "state": claim.state,
                    "state_label": state_labels[claim.state],
                    "submitted": fields.Datetime.to_string(claim.submitted_date)
                    if claim.submitted_date
                    else "",
                }
                for claim in recent
            ],
        }


class HrClaimLine(models.Model):
    _name = "hr.claim.line"
    _description = "Claim Expense Item"
    _order = "sequence, id"
    _check_company_auto = True

    claim_id = fields.Many2one(
        "hr.claim", required=True, ondelete="cascade", index=True, check_company=True
    )
    sequence = fields.Integer(default=10)
    description = fields.Char(required=True)
    category = fields.Selection(
        [
            ("mileage", "Mileage"),
            ("per_diem", "Per Diem"),
            ("accommodation", "Accommodation"),
            ("meals", "Meals & Entertainment"),
            ("transport", "Transport"),
            ("supplies", "Supplies"),
            ("communication", "Communication"),
            ("equipment", "Equipment"),
            ("other", "Other"),
        ],
        required=True,
        default="other",
    )
    amount = fields.Monetary(required=True, currency_field="currency_id")
    expense_date = fields.Date(required=True, default=fields.Date.context_today)
    receipt_reference = fields.Char()
    currency_id = fields.Many2one(
        related="claim_id.currency_id", store=True, readonly=True
    )
    company_id = fields.Many2one(
        related="claim_id.company_id", store=True, readonly=True, index=True
    )

    @api.constrains("amount")
    def _check_amount(self):
        if any(line.amount <= 0 for line in self):
            raise ValidationError("Expense item amounts must be positive.")

    @api.model_create_multi
    def create(self, vals_list):
        if not self.env.su:
            claims = self.env["hr.claim"].browse(
                [vals["claim_id"] for vals in vals_list if vals.get("claim_id")]
            )
            claims._ensure_user_can_edit()
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.su:
            self.mapped("claim_id")._ensure_user_can_edit()
        return super().write(vals)

    def unlink(self):
        if not self.env.su:
            self.mapped("claim_id")._ensure_user_can_edit()
        return super().unlink()

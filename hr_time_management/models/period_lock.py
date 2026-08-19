from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CleonTimePeriodLock(models.Model):
    _name = "cleon.time.period.lock"
    _description = "CleonHR Time Management Administrative Period Lock"
    _order = "date_from desc, id desc"

    name = fields.Char(string="Reference", required=True, copy=False, readonly=True, default=lambda self: _("New Period Lock"))
    company_id = fields.Many2one("res.company", string="Company", required=True, default=lambda self: self.env.company, index=True)
    date_from = fields.Date(string="Lock Start Date", required=True, index=True)
    date_to = fields.Date(string="Lock End Date", required=True, index=True)
    state = fields.Selection([
        ("draft", "Draft"), ("locked", "Locked"), ("unlocked", "Unlocked")
    ], string="Lock State", default="locked", required=True, index=True)
    reason = fields.Text(string="Lock Reason / Justification", required=True)
    locked_by = fields.Many2one("res.users", string="Locked By", default=lambda self: self.env.user, readonly=True)
    locked_at = fields.Datetime(string="Locked At", default=fields.Datetime.now, readonly=True)

    _sql_constraints = [
        ("date_range_check", "CHECK(date_to >= date_from)", "The period lock end date must be on or after the start date."),
    ]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get("name", _("New Period Lock")) == _("New Period Lock"):
                vals["name"] = self.env["ir.sequence"].next_by_code("cleon.time.period.lock") or _("LOCK/%s") % fields.Date.today().year
        return super().create(vals_list)

    @api.constrains("date_from", "date_to", "company_id", "state")
    def _check_overlapping_locks(self):
        for lock in self.filtered(lambda l: l.state == "locked"):
            overlap = self.search([
                ("id", "!=", lock.id),
                ("company_id", "=", lock.company_id.id),
                ("state", "=", "locked"),
                ("date_from", "<=", lock.date_to),
                ("date_to", ">=", lock.date_from),
            ])
            if overlap:
                raise ValidationError(_("An active period lock already exists for company %s covering date range %s to %s.") % (
                    lock.company_id.name, lock.date_from, lock.date_to
                ))

    @api.model
    def check_period_range(self, company_id, date_from, date_to, model_display_name="record", override_reason=False):
        """Server-side administrative period lock range check helper.

        Blocks mutation if any locked period overlaps with [date_from, date_to] for company.
        """
        if not date_from or not date_to or not company_id:
            return True
        c_id = company_id.id if isinstance(company_id, models.BaseModel) else company_id
        d_from = fields.Date.to_date(date_from)
        d_to = fields.Date.to_date(date_to)

        lock = self.sudo().search([
            ("company_id", "=", c_id),
            ("state", "=", "locked"),
            ("date_from", "<=", d_to),
            ("date_to", ">=", d_from),
        ], limit=1)

        if not lock:
            return True

        user = self.env.user
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role(user)
        is_authorized_admin = role in ("system_admin", "hr_admin") or user.has_group("base.group_system")

        if is_authorized_admin and override_reason and str(override_reason).strip():
            self.env["cleon.time.audit.log"].sudo().create({
                "user_id": user.id,
                "action": "modified",
                "reason": _("Administrative period lock override for %s range (%s to %s): %s") % (
                    model_display_name, d_from, d_to, override_reason
                ),
                "company_id": c_id,
            })
            return True

        raise AccessError(_(
            "The period from %(start)s to %(end)s is administratively locked for company %(company)s (Reason: %(reason)s). "
            "Modification of %(model)s overlapping %(d_from)s to %(d_to)s is denied."
        ) % {
            "start": lock.date_from,
            "end": lock.date_to,
            "company": lock.company_id.name,
            "reason": lock.reason,
            "model": model_display_name,
            "d_from": d_from,
            "d_to": d_to,
        })

    @api.model
    def check_period_lock(self, company_id, target_date, model_display_name="record", override_reason=False):
        """Server-side administrative period lock check helper.

        Blocks mutation of Attendance, Regularization, Timesheets, and Overtime
        if target_date falls inside a locked period for the company.
        Supports authorized HR Admin / System Admin override with audit log.
        """
        if not target_date or not company_id:
            return True
        c_id = company_id.id if isinstance(company_id, models.BaseModel) else company_id
        t_date = fields.Date.to_date(target_date)

        lock = self.sudo().search([
            ("company_id", "=", c_id),
            ("state", "=", "locked"),
            ("date_from", "<=", t_date),
            ("date_to", ">=", t_date),
        ], limit=1)

        if not lock:
            return True

        # Check for authorized HR Admin / System Admin override
        user = self.env.user
        Policy = self.env["cleon.time.policy"]
        role = Policy._tm_role(user)
        is_authorized_admin = role in ("system_admin", "hr_admin") or user.has_group("base.group_system")

        if is_authorized_admin and override_reason and str(override_reason).strip():
            # Log audit trail of administrative override
            self.env["cleon.time.audit.log"].sudo().create({
                "user_id": user.id,
                "action": "modified",
                "reason": _("Administrative period lock override for %s on %s: %s") % (model_display_name, t_date, override_reason),
                "company_id": c_id,
            })
            return True

        raise AccessError(_(
            "The period from %(start)s to %(end)s is administratively locked for company %(company)s (Reason: %(reason)s). "
            "Modification of %(model)s on %(date)s is denied."
        ) % {
            "start": lock.date_from,
            "end": lock.date_to,
            "company": lock.company_id.name,
            "reason": lock.reason,
            "model": model_display_name,
            "date": t_date,
        })

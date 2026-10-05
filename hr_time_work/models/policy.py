from datetime import timedelta
from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class TimePolicy(models.Model):
    _inherit = "cleon.time.policy"

    billable_tracking_enabled = fields.Boolean(default=True, string="Enable Billable Tracking")

    default_billing_rate = fields.Monetary(default=150.0, currency_field="currency_id", string="Default Billing Rate")

    @api.model
    def _installed_time_features(self):
        return dict(super()._installed_time_features(), tracking=True)

    @api.model
    def get_employee_workspace(self):
        data = super().get_employee_workspace()
        today = fields.Date.context_today(self)
        start = today - timedelta(days=today.weekday())
        lines = self.env["account.analytic.line"].search([
            ("employee_id", "=", self.env.user.employee_id.id),
            ("date", ">=", start), ("date", "<=", start + timedelta(days=6)),
        ])
        hours = sum(lines.mapped("unit_amount"))
        expected = data["summary"]["weekly_expected_hours"]
        data["summary"].update(weekly_timesheet_hours=round(hours, 2),
                               weekly_timesheet_percent=round(hours / expected * 100) if expected else 0,
                               weekly_missing_hours=max(0, expected - hours))
        return data

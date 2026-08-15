from odoo import api, fields, models
from odoo.exceptions import ValidationError


class HrClaimWindow(models.Model):
    _name = "hr.claim.window"
    _description = "Claim Processing Window"
    _order = "window_type, name"
    _check_company_auto = True

    name = fields.Char(required=True, translate=True)
    window_type = fields.Selection(
        [
            ("submission", "Submission"),
            ("approval", "Approval"),
            ("payment", "Payment"),
            ("cutoff", "Cut-off"),
        ],
        required=True,
        default="submission",
        index=True,
    )
    duration_days = fields.Integer(default=30, required=True)
    start_date = fields.Date()
    end_date = fields.Date()
    description = fields.Text(translate=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    claim_type_ids = fields.Many2many(
        "hr.claim.type",
        "hr_claim_type_window_rel",
        "window_id",
        "claim_type_id",
        string="Claim Types",
        check_company=True,
    )

    @api.constrains("duration_days", "start_date", "end_date")
    def _check_window(self):
        for window in self:
            if window.duration_days < 0:
                raise ValidationError("Window duration cannot be negative.")
            if window.start_date and window.end_date and window.start_date > window.end_date:
                raise ValidationError("The window start date must be before its end date.")


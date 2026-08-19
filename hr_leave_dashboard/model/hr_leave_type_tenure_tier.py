from odoo import models, fields, api, _
from odoo.exceptions import ValidationError

class HrLeaveTypeTenureTier(models.Model):
    _name = "hr.leave.type.tenure.tier"
    _description = "Tenure-Based Accrual Scaling Tier"
    _order = "year_from asc, id asc"

    leave_type_id = fields.Many2one(
        "hr.leave.type",
        string="Leave Type",
        required=True,
        ondelete="cascade",
        index=True,
    )
    year_from = fields.Integer(string="From Service Year", required=True, default=1)
    year_to = fields.Integer(string="To Service Year", help="Leave empty or 0 for unlimited years")
    days_per_year = fields.Float(string="Days Allocated Per Year", required=True, default=20.0)

    @api.constrains("year_from", "year_to", "days_per_year", "leave_type_id")
    def _check_tenure_tier_validity(self):
        for tier in self:
            if tier.year_from < 1:
                raise ValidationError(_("Tier 'From Year' must be at least 1."))
            if tier.year_to and tier.year_to < tier.year_from:
                raise ValidationError(_("Tier 'To Year' (%s) cannot be less than 'From Year' (%s).") % (tier.year_to, tier.year_from))
            if tier.days_per_year < 0:
                raise ValidationError(_("Tier 'Days Allocated Per Year' cannot be negative."))

            # Overlap check with other tiers of the same leave type
            other_tiers = self.search([
                ("leave_type_id", "=", tier.leave_type_id.id),
                ("id", "!=", tier.id),
            ])
            t_from = tier.year_from
            t_to = tier.year_to or 999
            for ot in other_tiers:
                ot_from = ot.year_from
                ot_to = ot.year_to or 999
                if max(t_from, ot_from) <= min(t_to, ot_to):
                    raise ValidationError(
                        _("Tenure tier range (%s - %s) overlaps with existing tier (%s - %s) for leave type '%s'.")
                        % (tier.year_from, tier.year_to or "Unlimited", ot.year_from, ot.year_to or "Unlimited", tier.leave_type_id.name)
                    )

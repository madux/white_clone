from odoo import fields, models


class CompanyDocumentaryLike(models.Model):
    _name = "company.documentary.like"
    _description = "Company Documentary Like"
    _order = "create_date desc"

    media_id = fields.Many2one(
        "company.documentary.media", required=True, ondelete="cascade", index=True
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, index=True
    )

    _sql_constraints = [
        ("media_user_uniq", "unique(media_id, user_id)", "You can only like a video once."),
    ]

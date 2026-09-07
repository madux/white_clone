from odoo import fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    document_onboarding_state = fields.Json(
        string="Document Management Onboarding",
        default=lambda self: {
            "completed_steps": [],
            "dismissed": False,
            "completed": False,
        },
    )

from odoo import fields, models


class ResUsers(models.Model):
    _inherit = "res.users"

    document_onboarding_state = fields.Json(
        string="Document Management Onboarding",
        default=lambda self: self._default_document_onboarding_state(),
    )

    def _default_document_onboarding_state(self):
        from odoo.addons.cleon_document_management.controllers.onboarding_state import (
            default_onboarding_state,
        )

        return default_onboarding_state()

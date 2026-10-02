from odoo import api, models


class ResUsers(models.Model):
    _inherit = "res.users"

    @api.model
    def get_employee_portal_leave_access(self):
        enabled = self.env["hr.leave"].check_access_rights("read", raise_exception=False)
        # Retain the existing integration/subscription switch when Time is present.
        if "cleon.time.policy" in self.env:
            enabled = enabled and self.env["cleon.time.policy"].get_cleon_access()["portalModules"]["leave"]
        return {"enabled": bool(enabled)}

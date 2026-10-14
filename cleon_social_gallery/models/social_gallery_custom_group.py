from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class SocialGalleryCustomGroup(models.Model):
    _name = "social.gallery.custom.group"
    _description = "Social Gallery Custom Group"
    _order = "name"

    name = fields.Char(required=True)
    description = fields.Text()
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    employee_ids = fields.Many2many(
        "hr.employee",
        "social_gallery_custom_group_employee_rel",
        "group_id",
        "employee_id",
    )

    @api.constrains("employee_ids")
    def _check_members(self):
        for group in self:
            if not group.employee_ids:
                raise ValidationError(_("Custom groups must include at least one member."))

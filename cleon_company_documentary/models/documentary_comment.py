from odoo import fields, models, _
from odoo.exceptions import AccessError


class CompanyDocumentaryComment(models.Model):
    _name = "company.documentary.comment"
    _description = "Company Documentary Comment"
    _order = "create_date asc"

    media_id = fields.Many2one("company.documentary.media", required=True, ondelete="cascade", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, readonly=True)
    body = fields.Text(required=True)
    active = fields.Boolean(default=True)

    def unlink(self):
        for comment in self:
            if comment.user_id != self.env.user and not self.env.user.has_group(
                "cleon_company_documentary.group_company_documentary_manager"
            ):
                raise AccessError(_("You can only delete your own comments."))
        return super().unlink()

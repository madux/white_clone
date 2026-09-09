from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class SocialGalleryComment(models.Model):
    _name = "social.gallery.comment"
    _description = "Social Gallery Comment"
    _order = "create_date asc"

    media_id = fields.Many2one(
        "social.gallery.media", required=True, ondelete="cascade", index=True
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    body = fields.Text(required=True)
    parent_id = fields.Many2one("social.gallery.comment", ondelete="cascade", index=True)
    child_ids = fields.One2many("social.gallery.comment", "parent_id")
    mentioned_user_ids = fields.Many2many(
        "res.users", "social_gallery_comment_mention_rel", "comment_id", "user_id"
    )
    is_hidden = fields.Boolean(default=False)
    is_edited = fields.Boolean(default=False)
    active = fields.Boolean(default=True)

    @api.constrains("body")
    def _check_body(self):
        for comment in self:
            if not (comment.body or "").strip():
                raise ValidationError(_("Comment body cannot be empty."))

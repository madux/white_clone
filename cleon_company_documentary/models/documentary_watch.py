from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class CompanyDocumentaryWatch(models.Model):
    _name = "company.documentary.watch"
    _description = "Company Documentary Watch Progress"
    _order = "last_watched_at desc"

    media_id = fields.Many2one("company.documentary.media", required=True, ondelete="cascade", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, index=True)
    employee_id = fields.Many2one("hr.employee", required=True, index=True)
    position_seconds = fields.Float(default=0)
    watched_seconds = fields.Float(default=0)
    completion_percent = fields.Float(default=0)
    completed = fields.Boolean(default=False, index=True)
    view_count = fields.Integer(default=0)
    first_watched_at = fields.Datetime(default=fields.Datetime.now, readonly=True)
    last_watched_at = fields.Datetime(default=fields.Datetime.now)
    completed_at = fields.Datetime(readonly=True)
    _sql_constraints = [
        (
            "company_documentary_watch_media_user_uniq",
            "unique(media_id, user_id)",
            "A user can have one watch-progress record per video.",
        )
    ]

    @api.constrains("completion_percent", "position_seconds", "watched_seconds")
    def _check_progress(self):
        for record in self:
            if not 0 <= record.completion_percent <= 100:
                raise ValidationError(_("Completion must be between 0 and 100 percent."))
            if record.position_seconds < 0 or record.watched_seconds < 0:
                raise ValidationError(_("Watch times cannot be negative."))

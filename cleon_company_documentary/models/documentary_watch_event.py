from odoo import fields, models


class CompanyDocumentaryWatchEvent(models.Model):
    _name = "company.documentary.watch.event"
    _description = "Company Documentary Watch Event"
    _order = "happened_at desc"

    media_id = fields.Many2one("company.documentary.media", required=True, ondelete="cascade", index=True)
    user_id = fields.Many2one("res.users", required=True, index=True)
    employee_id = fields.Many2one("hr.employee", required=True, index=True)
    department_id = fields.Many2one(related="employee_id.department_id", store=True, index=True)
    grade_id = fields.Many2one(related="employee_id.grade_id", store=True, index=True)
    session_id = fields.Char(index=True)
    event_type = fields.Selection([
        ("start", "Started"),
        ("progress", "Progress"),
        ("complete", "Completed"),
        ("favorite", "Favorited"),
        ("comment", "Commented"),
        ("download", "Downloaded"),
    ], required=True, index=True)
    position_seconds = fields.Float(default=0)
    delta_seconds = fields.Float(default=0)
    completion_percent = fields.Float(default=0)
    happened_at = fields.Datetime(default=fields.Datetime.now, required=True, index=True)


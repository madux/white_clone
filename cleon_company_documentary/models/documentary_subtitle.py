from odoo import fields, models


class CompanyDocumentarySubtitle(models.Model):
    _name = "company.documentary.subtitle"
    _description = "Company Documentary Subtitle Track"
    _order = "language, id"

    name = fields.Char(required=True)
    media_id = fields.Many2one("company.documentary.media", required=True, ondelete="cascade")
    language = fields.Char(required=True, default="en")
    format = fields.Selection([("vtt", "WebVTT"), ("srt", "SubRip")], required=True, default="vtt")
    storage_key = fields.Char(required=True, copy=False)
    is_default = fields.Boolean(default=False)
    active = fields.Boolean(default=True)

from odoo import fields, models


class CompanyDocumentaryVersion(models.Model):
    _name = "company.documentary.version"
    _description = "Company Documentary Version History"
    _order = "version_number desc, id desc"

    media_id = fields.Many2one(
        "company.documentary.media",
        required=True,
        ondelete="cascade",
        index=True,
    )
    company_id = fields.Many2one(related="media_id.company_id", store=True, index=True)
    version_number = fields.Integer(required=True, index=True)
    is_live = fields.Boolean(default=False, index=True)
    storage_key = fields.Char(required=True)
    variants = fields.Json(default=dict)
    thumbnail_key = fields.Char()
    duration_seconds = fields.Float()
    resolution = fields.Char()
    codec = fields.Char()
    file_size = fields.Integer()
    transcript_snapshot = fields.Text()
    captions_snapshot = fields.Json(default=list)
    change_note = fields.Text()
    review_outcome = fields.Char()
    created_by_id = fields.Many2one("res.users", required=True, readonly=True)
    live_from = fields.Datetime()
    live_to = fields.Datetime()

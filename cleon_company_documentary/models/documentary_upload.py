from datetime import timedelta

from odoo import api, fields, models


class CompanyDocumentaryUpload(models.Model):
    _name = "company.documentary.upload"
    _description = "Company Documentary Multipart Upload"
    _order = "create_date desc"

    name = fields.Char(required=True)
    media_id = fields.Many2one("company.documentary.media", required=True, ondelete="cascade")
    folder_id = fields.Many2one(related="media_id.folder_id", store=True, index=True)
    company_id = fields.Many2one(related="media_id.company_id", store=True, index=True)
    initiated_by = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user, readonly=True
    )
    provider = fields.Selection([("cloudflare_r2", "Cloudflare R2")], default="cloudflare_r2", required=True)
    object_key = fields.Char(required=True, copy=False, index=True)
    provider_upload_id = fields.Char(required=True, copy=False, index=True)
    part_size = fields.Integer(required=True, default=8 * 1024 * 1024)
    total_parts = fields.Integer(required=True)
    uploaded_parts = fields.Json(default=dict, copy=False)
    state = fields.Selection(
        [("initiated", "Initiated"), ("completed", "Completed"), ("aborted", "Aborted"), ("expired", "Expired")],
        default="initiated", required=True, index=True,
    )
    expires_at = fields.Datetime(
        required=True,
        default=lambda self: fields.Datetime.now() + timedelta(hours=24),
        index=True,
    )

    @api.model
    def _cron_expire_stale_uploads(cls):
        # The provider multipart abort is performed by the API cancellation
        # endpoint. This cron closes abandoned Odoo sessions so they cannot be
        # resumed after their signed URL window has elapsed.
        stale = cls.sudo().search([
            ("state", "=", "initiated"),
            ("expires_at", "<", fields.Datetime.now()),
        ])
        stale.write({"state": "expired"})

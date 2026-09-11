from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    documentary_require_upload_approval = fields.Boolean(
        string="Require Upload Approval",
        default=False,
    )
    documentary_default_mandatory = fields.Boolean(
        string="Default Mandatory Training",
        default=False,
    )
    documentary_default_comments_enabled = fields.Boolean(
        string="Default Comments Enabled",
        default=False,
    )
    documentary_default_allow_download = fields.Boolean(
        string="Default Allow Downloads",
        default=False,
    )
    documentary_default_completion_threshold = fields.Float(default=85.0)
    documentary_deleted_retention_days = fields.Integer(
        string="Recycle Bin Retention (days)",
        default=365,
    )
    documentary_auto_transcription = fields.Boolean(default=False)

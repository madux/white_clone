from odoo import fields, models


class ResCompany(models.Model):
    _inherit = "res.company"

    documentary_require_upload_approval = fields.Boolean(
        string="Require Upload Approval",
        default=True,
    )
    documentary_department_restrictions = fields.Boolean(
        string="Enforce Department Restrictions",
        default=True,
        help="When enabled, employees only see documentaries in their EMS department audience.",
    )
    documentary_employee_download = fields.Boolean(
        string="Allow Employee Download",
        default=False,
    )
    documentary_external_sharing = fields.Boolean(
        string="Allow External Sharing",
        default=False,
    )
    documentary_max_upload_mb = fields.Integer(string="Max Upload Size (MB)", default=2048)
    documentary_storage_quota_gb = fields.Integer(string="Storage Quota (GB)", default=500)
    documentary_default_resolution = fields.Selection(
        [("720", "720p"), ("1080", "1080p"), ("original", "Original")],
        default="1080",
    )
    documentary_restore_window_days = fields.Integer(
        string="Recycle Bin Restore Window (days)",
        default=30,
    )
    documentary_retention_years = fields.Integer(
        string="Retention After Deletion (years)",
        default=7,
    )
    documentary_auto_archive_months = fields.Integer(
        string="Auto-archive After (months)",
        default=0,
        help="0 = off. Moves published documentaries to archived after N months.",
    )
    documentary_disposition_review = fields.Boolean(
        string="Disposition Review Required",
        default=False,
    )
    documentary_compliance_analytics = fields.Boolean(
        string="Compliance analytics tab",
        default=True,
        help="When disabled, the Compliance tab is hidden from Documentary analytics.",
    )
    documentary_deleted_retention_days = fields.Integer(
        string="Legacy purge horizon (days)",
        default=2555,
        help="Deprecated: use retention years; kept for migration.",
    )

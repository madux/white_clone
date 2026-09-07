from odoo import fields, models


class CompanyDocumentaryAudit(models.Model):
    _name = "company.documentary.audit"
    _description = "Company Documentary Audit Event"
    _order = "create_date desc"

    event_type = fields.Selection(
        [
            ("folder_created", "Folder Created"),
            ("folder_updated", "Folder Updated"),
            ("folder_archived", "Folder Archived"),
            ("folder_deleted", "Folder Deleted"),
            ("media_uploaded", "Media Uploaded"),
            ("media_updated", "Media Updated"),
            ("media_archived", "Media Archived"),
            ("media_deleted", "Media Deleted"),
            ("access_changed", "Access Changed"),
            ("streamed", "Streamed"),
            ("downloaded", "Downloaded"),
            ("progress_updated", "Progress Updated"),
        ],
        required=True,
        index=True,
    )
    folder_id = fields.Many2one("company.documentary.folder", ondelete="set null", index=True)
    media_id = fields.Many2one("company.documentary.media", ondelete="set null", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, index=True)
    employee_id = fields.Many2one("hr.employee", index=True)
    metadata = fields.Json(default=dict)

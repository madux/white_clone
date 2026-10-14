from odoo import api, fields, models


class CompanyDocumentaryMigrate(models.AbstractModel):
    _name = "company.documentary.migrate"
    _description = "Company Documentary data migration helpers"

    @api.model
    def migrate_legacy_statuses(self):
        Media = self.env["company.documentary.media"].sudo()
        for media in Media.search([]):
            if media.status and media.status not in ("processing", "draft"):
                continue
            if media.status == "draft" and media.processing_state == "ready":
                continue
            status = "draft"
            if media.deleted_at:
                status = "deleted"
            elif media.processing_state == "failed":
                status = "processing_failed"
            elif media.processing_state in ("uploading", "processing"):
                status = "processing"
            elif media.approval_status == "pending":
                status = "pending_review"
            elif media.approval_status == "rejected":
                status = "returned"
            elif media.approval_status == "approved" and media.published_at:
                status = "published" if media.active else "archived"
            elif media.approval_status == "approved":
                status = "approved"
            else:
                status = "draft"
            media.with_context(lifecycle_write=True).write({"status": status})
            if status == "deleted" and not media.purge_date and media.deleted_at:
                media.with_context(lifecycle_write=True).write({
                    "purge_date": media._compute_purge_date(fields.Datetime.from_string(media.deleted_at)),
                })

import logging
from datetime import timedelta

from odoo import _, api, fields, models

_logger = logging.getLogger(__name__)

MANAGER_GROUP = "cleon_social_gallery.group_social_gallery_manager"
ADMIN_GROUP = "cleon_social_gallery.group_social_gallery_admin"


class SocialGalleryNotify(models.AbstractModel):
    _name = "social.gallery.notify"
    _description = "Social Gallery Notification Helpers"

    def _gallery_manager_users(self, company):
        group_ids = [
            self.env.ref(MANAGER_GROUP).id,
            self.env.ref(ADMIN_GROUP).id,
        ]
        return self.env["res.users"].sudo().search([
            ("company_id", "=", company.id),
            ("groups_id", "in", group_ids),
            ("active", "=", True),
        ])

    def _send_mail(self, recipients, subject, body_html):
        recipients = recipients.filtered(lambda u: u.email)
        if not recipients:
            return
        Mail = self.env["mail.mail"].sudo()
        for user in recipients:
            try:
                Mail.create({
                    "subject": subject,
                    "body_html": body_html,
                    "email_to": user.email,
                    "auto_delete": True,
                }).send()
            except Exception:
                _logger.exception("Social Gallery mail failed for %s", user.email)

    def notify_new_upload(self, media):
        company = media.company_id
        if not company.sg_notify_new_upload:
            return
        managers = self._gallery_manager_users(company)
        subject = _("New gallery upload: %s") % media.display_name
        body = _(
            "<p>%s uploaded <strong>%s</strong> to Social Gallery.</p>"
            "<p>Status: %s</p>"
        ) % (media.uploaded_by.name, media.display_name, media.approval_status)
        self._send_mail(managers, subject, body)

    def notify_approval_request(self, media):
        company = media.company_id
        if not company.sg_notify_approval_request:
            return
        if media.approval_status != "pending":
            return
        managers = self._gallery_manager_users(company)
        subject = _("Gallery approval needed: %s") % media.display_name
        body = _(
            "<p><strong>%s</strong> is waiting for review.</p>"
            "<p>Uploaded by %s.</p>"
        ) % (media.display_name, media.uploaded_by.name)
        self._send_mail(managers, subject, body)

    def notify_comment(self, comment):
        media = comment.media_id
        company = media.company_id
        if not company.sg_notify_comments:
            return
        owner = media.uploaded_by
        if comment.user_id == owner:
            return
        subject = _("New comment on %s") % media.display_name
        body = _(
            "<p>%s commented on <strong>%s</strong>:</p><p>%s</p>"
        ) % (comment.user_id.name, media.display_name, comment.body)
        self._send_mail(owner, subject, body)

    def notify_content_report(self, report):
        media = report.media_id
        company = media.company_id
        if not company.sg_notify_content_reports:
            return
        managers = self._gallery_manager_users(company)
        subject = _("Gallery content reported: %s") % media.display_name
        body = _(
            "<p><strong>%s</strong> was reported by %s.</p>"
            "<p>Reason: %s</p>"
            "<p>%s</p>"
        ) % (
            media.display_name,
            report.reporter_id.name,
            report.reason,
            report.details or "",
        )
        self._send_mail(managers, subject, body)

    def notify_like(self, media, liker):
        company = media.company_id
        if not company.sg_notify_likes:
            return
        if liker == media.uploaded_by:
            return
        batch_size = company.sg_like_batch_size or 5
        Like = self.env["social.gallery.like"].sudo()
        recent = Like.search([
            ("media_id", "=", media.id),
            ("user_id", "!=", media.uploaded_by.id),
        ], order="create_date desc", limit=batch_size)
        if len(recent) < batch_size:
            return
        names = ", ".join(recent.mapped("user_id.name"))
        subject = _("Your media received %s likes") % len(recent)
        body = _(
            "<p><strong>%s</strong> has been liked by %s and others.</p>"
        ) % (media.display_name, names)
        self._send_mail(media.uploaded_by, subject, body)

    @api.model
    def _cron_weekly_digest(self):
        Media = self.env["social.gallery.media"].sudo()
        Album = self.env["social.gallery.album"].sudo()
        for company in self.env["res.company"].search([]):
            if not company.sg_weekly_digest:
                continue
            managers = self._gallery_manager_users(company)
            if not managers:
                continue
            week_ago = fields.Datetime.now() - timedelta(days=7)
            uploads = Media.search_count([
                ("company_id", "=", company.id),
                ("create_date", ">=", week_ago),
                ("deleted_at", "=", False),
            ])
            pending = Media.search_count([
                ("company_id", "=", company.id),
                ("approval_status", "=", "pending"),
                ("deleted_at", "=", False),
            ])
            albums = Album.search_count([
                ("company_id", "=", company.id),
                ("active", "=", True),
            ])
            subject = _("Social Gallery weekly digest — %s") % company.name
            body = _(
                "<p>Weekly summary for <strong>%s</strong>:</p>"
                "<ul>"
                "<li>%s new uploads</li>"
                "<li>%s pending approvals</li>"
                "<li>%s active albums</li>"
                "</ul>"
            ) % (company.name, uploads, pending, albums)
            self._send_mail(managers, subject, body)

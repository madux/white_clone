from odoo import _, api, models


class CompanyDocumentaryNotificationService(models.AbstractModel):
    _name = "company.documentary.notification.service"
    _description = "Company Documentary lifecycle notifications"

    @api.model
    def _manager_users(self, company):
        group = self.env.ref(
            "cleon_company_documentary.group_company_documentary_manager",
            raise_if_not_found=False,
        )
        if not group:
            return self.env["res.users"]
        return group.users.filtered(lambda user: user.active and user.company_id == company)

    @api.model
    def notify_lifecycle(self, media, event, extra=None):
        """Post in-app chatter notes for key lifecycle events."""
        if not hasattr(media, "message_post"):
            return
        extra = extra or {}
        company = media.company_id
        managers = self._manager_users(company)
        uploader = media.uploaded_by
        submitter = media.submitted_by_id

        if event == "submitted":
            recipients = managers
            body = _(
                "%(title)s was submitted for review by %(user)s.",
                title=media.name,
                user=media.env.user.name,
            )
        elif event == "returned":
            recipients = submitter or uploader
            reason = extra.get("reason") or media.return_reason or ""
            body = _(
                "%(title)s was returned for correction: %(reason)s",
                title=media.name,
                reason=reason,
            )
        elif event == "approved":
            recipients = submitter or uploader
            body = _("%(title)s was approved.", title=media.name)
        elif event == "published":
            recipients = (submitter | uploader) if submitter else uploader
            body = _("%(title)s is now published.", title=media.name)
        elif event == "processing_failed":
            recipients = uploader | managers
            body = _(
                "Processing failed for %(title)s: %(reason)s",
                title=media.name,
                reason=extra.get("reason") or media.processing_error or _("Unknown error"),
            )
        else:
            return

        partners = recipients.mapped("partner_id").ids
        if not partners:
            return
        media.message_post(
            body=body,
            partner_ids=partners,
            message_type="comment",
            subtype_xmlid="mail.mt_comment",
        )

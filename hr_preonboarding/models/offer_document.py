# -*- coding: utf-8 -*-
import uuid

from odoo import models, fields, api, _
from odoo.exceptions import UserError


class OfferDocument(models.Model):
    _name = "offer.document"
    _description = "Pre-Onboarding Offer Document"
    _inherit = ["mail.thread"]
    _rec_name = "document_name"
    _order = "id desc"

    preboarding_id = fields.Many2one(
        "hr.preonboarding",
        string="Pre-Onboarding",
        required=True,
        ondelete="cascade",
    )
    candidate_id = fields.Many2one(
        "hr.applicant",
        string="Candidate",
        required=True,
    )
    document_name = fields.Char(string="Document Name", required=True)
    document = fields.Binary(string="Attachment", attachment=True)
    document_filename = fields.Char(string="File Name")

    state = fields.Selection(
        [
            ("draft", "To Upload"),
            ("requested", "Request Sent"),
            ("uploaded", "Uploaded"),
        ],
        default="draft",
        required=True,
        tracking=True,
        copy=False,
    )

    access_token = fields.Char(copy=False, readonly=True, index=True)
    request_date = fields.Datetime(readonly=True, copy=False)
    uploaded_date = fields.Datetime(readonly=True, copy=False)

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            # Auto-fill candidate from the pre-onboarding record if not set.
            if vals.get("preboarding_id") and not vals.get("candidate_id"):
                preboarding = self.env["hr.preonboarding"].browse(
                    vals["preboarding_id"]
                )
                vals["candidate_id"] = preboarding.candidate_id.id
        return super().create(vals_list)

    def _get_access_token(self):
        self.ensure_one()
        if not self.access_token:
            self.access_token = uuid.uuid4().hex
        return self.access_token

    def _get_portal_url(self):
        self.ensure_one()
        base_url = self.env["ir.config_parameter"].sudo().get_param(
            "web.base.url"
        )
        return "%s/offer-document/%s/view?access_token=%s" % (
            base_url,
            self.id,
            self._get_access_token(),
        )

    # ------------------------------------------------------------------
    # Actions
    # ------------------------------------------------------------------
    def action_send_request(self):
        """Email the candidate a secure link where they can upload the
        requested document themselves.
        """
        for rec in self:
            candidate = rec.candidate_id
            email = candidate.email_from
            if not email:
                raise UserError(
                    _("Candidate %s has no email address on file. Cannot "
                      "send document request.") % candidate.partner_name
                )

            url = rec._get_portal_url()
            template = self.env.ref(
                "hr_preonboarding.mail_template_offer_document_request",
                raise_if_not_found=False,
            )
            if template:
                template.with_context(document_url=url).send_mail(
                    rec.id, force_send=True
                )
            else:
                # Fallback plain-text email if the template is missing.
                mail_values = {
                    "subject": _("Document Requested: %s") % rec.document_name,
                    "email_to": email,
                    "body_html": _(
                        "<p>Hello %(name)s,</p>"
                        "<p>Please upload the following document: "
                        "<b>%(doc)s</b>.</p>"
                        "<p><a href='%(url)s'>Click here to upload</a></p>"
                    )
                    % {
                        "name": candidate.partner_name or "",
                        "doc": rec.document_name,
                        "url": url,
                    },
                }
                self.env["mail.mail"].sudo().create(mail_values).send()

            rec.write(
                {
                    "state": "requested",
                    "request_date": fields.Datetime.now(),
                }
            )
            rec.message_post(
                body=_("Document request for '%s' sent to %s.")
                % (rec.document_name, email)
            )
            if rec.preboarding_id.state == "offer_accepted":
                rec.preboarding_id.state = "document_request"

    def action_mark_uploaded(self, file_data=None, filename=None, notify=True):
        """Flip the document to 'uploaded', optionally storing the file
        content at the same time. Used both by the public controller
        (candidate submits their file) and internally when HR attaches a
        file directly to the binary field in the backend.

        :param file_data: base64-encoded file content (optional, only
            needed when the binary hasn't already been written)
        :param filename: original filename (optional)
        :param notify: whether to notify the record creator/followers
        """
        for rec in self:
            vals = {
                "state": "uploaded",
                "uploaded_date": fields.Datetime.now(),
            }
            if file_data:
                vals["document"] = file_data
            if filename:
                vals["document_filename"] = filename
            super(OfferDocument, rec).write(vals)

            if notify:
                partners = rec.preboarding_id.create_uid.partner_id
                follower_partners = rec.preboarding_id.follower_ids.mapped(
                    "work_contact_id"
                )
                rec.message_post(
                    body=_("Document '%s' has been uploaded.")
                    % rec.document_name,
                    partner_ids=(partners | follower_partners).ids,
                )
            if rec.preboarding_id.state == "document_request":
                rec.preboarding_id.state = "document_received"

    def write(self, vals):
        # If someone uploads the binary directly in the backend (rather
        # than through the public link) while still in "To Upload"
        # state, flip the state to "uploaded" automatically. Guarded by
        # a context flag to avoid recursing through action_mark_uploaded.
        res = super().write(vals)
        if vals.get("document") and not self.env.context.get(
            "skip_auto_upload_state"
        ):
            to_flip = self.filtered(lambda r: r.state == "draft")
            if to_flip:
                to_flip.with_context(
                    skip_auto_upload_state=True
                ).action_mark_uploaded(notify=True)
        return res

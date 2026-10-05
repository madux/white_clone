# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocQuarantineFile(models.Model):
    _name = "doc.quarantine.file"
    _description = "Quarantined upload (malware scan)"
    _order = "create_date desc"

    name = fields.Char(required=True)
    document_id = fields.Many2one("doc.document", ondelete="set null", index=True)
    folder_id = fields.Many2one("doc.folder", ondelete="set null", index=True)
    attachment_id = fields.Many2one("ir.attachment", ondelete="restrict")
    scan_engine = fields.Char(default="clamav")
    threat_name = fields.Char()
    scan_details = fields.Text()
    state = fields.Selection(
        [
            ("quarantined", "Quarantined"),
            ("released", "Released"),
            ("deleted", "Deleted"),
        ],
        default="quarantined",
        required=True,
    )
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    @api.model
    def cleanup_for_documents(self, documents):
        """Remove quarantine rows so document attachments can be purged."""
        if not documents:
            return
        attachment_ids = list(
            set(documents.mapped("attachment_id").ids)
            | set(documents.mapped("pending_attachment_id").ids)
        )
        domain = [("document_id", "in", documents.ids)]
        if attachment_ids:
            domain = [
                "|",
                ("document_id", "in", documents.ids),
                ("attachment_id", "in", attachment_ids),
            ]
        records = self.sudo().search(domain)
        if records:
            records.unlink()

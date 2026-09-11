from odoo import fields, models


class DocumentVersion(models.Model):
    _name = "doc.document.version"
    _description = "Document Version"
    _order = "version_number desc, id desc"

    document_id = fields.Many2one(
        "doc.document",
        string="Document",
        required=True,
        ondelete="cascade",
        index=True,
    )

    version_number = fields.Integer(
        string="Version Number",
        required=True,
    )

    file_attachment = fields.Many2one(
        "ir.attachment",
        string="File",
        required=True,
        ondelete="restrict",
    )

    uploaded_by = fields.Many2one(
        "res.users",
        string="Uploaded By",
        default=lambda self: self.env.user,
        readonly=True,
    )

    upload_date = fields.Datetime(
        string="Upload Date",
        default=fields.Datetime.now,
        readonly=True,
    )

    change_note = fields.Char(
        string="Change Note",
    )

    active = fields.Boolean(
        default=True,
    )

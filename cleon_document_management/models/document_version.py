from odoo import _, fields, models
from odoo.exceptions import AccessError


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

    def _user_can_manage(self):
        self.ensure_one()
        if self.env.user.has_group("cleon_document_management.group_document_manager"):
            return True
        document = self.document_id
        if document.owner_id == self.env.user:
            return True
        employee_user = document.employee_id.user_id
        return bool(employee_user and employee_user == self.env.user)

    def unlink(self):
        for version in self:
            if not version._user_can_manage():
                raise AccessError(_("You do not have permission to delete this version."))
        attachments = self.mapped("file_attachment")
        result = super().unlink()
        attachments.sudo().unlink()
        return result

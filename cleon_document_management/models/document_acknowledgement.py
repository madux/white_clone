from odoo import api, fields, models, _
from odoo.exceptions import AccessError


class DocumentAcknowledgement(models.Model):
    _name = "doc.document.acknowledgement"
    _description = "Document Acknowledgement"
    _order = "acknowledged_at desc"

    document_id = fields.Many2one("doc.document", required=True, ondelete="cascade", index=True)
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, ondelete="cascade", index=True)
    acknowledged_at = fields.Datetime(required=True, default=fields.Datetime.now, readonly=True)
    employee_id = fields.Many2one("hr.employee", related="user_id.employee_id", store=True, readonly=True)

    _sql_constraints = [("document_user_unique", "unique(document_id, user_id)", "This document has already been acknowledged.")]

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if not self.env.user.has_group("cleon_document_management.group_document_manager"):
                vals["user_id"] = self.env.user.id
            document = self.env["doc.document"].browse(vals.get("document_id")).exists()
            if not document or document.folder_id.folder_type != "organizational" or document.state == "draft":
                raise AccessError(_("Only active organizational documents can be acknowledged."))
        acknowledgements = super().create(vals_list)
        admins = self.env.ref("cleon_document_management.group_document_admin").users
        for acknowledgement in acknowledgements:
            acknowledgement.document_id.sudo().message_post(
                body=_("%s acknowledged this document.") % acknowledgement.user_id.name,
                partner_ids=admins.mapped("partner_id").ids,
                subtype_xmlid="mail.mt_note",
            )
        return acknowledgements

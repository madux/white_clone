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

    def serialize_for_activity(self):
        self.ensure_one()
        document = self.document_id
        actor = self.user_id.name or _("Someone")
        return {
            "id": 20_000_000 + self.id,
            "kind": "acknowledgement",
            "message": _("%(actor)s acknowledged %(document)s")
            % {
                "actor": actor,
                "document": document.name,
            },
            "document_id": document.id,
            "document_name": document.name,
            "folder_id": document.folder_id.id,
            "folder_name": document.folder_id.folder_name,
            "folder_type": document.folder_id.folder_type or "organizational",
            "employee_id": self.employee_id.id or False,
            "actor_name": actor,
            "occurred_at": fields.Datetime.to_string(self.acknowledged_at),
        }

    def _post_on_employee_file(self):
        self.ensure_one()
        employee = self.employee_id
        if not employee:
            return
        employee_file = (
            self.env["doc.employee.file"]
            .sudo()
            .search(
                [
                    ("employee_id", "=", employee.id),
                    ("company_id", "=", employee.company_id.id or self.env.company.id),
                ],
                limit=1,
            )
        )
        if not employee_file:
            return
        employee_file.message_post(
            body=_("%s acknowledged %s.")
            % (self.user_id.name, self.document_id.name),
            subtype_xmlid="mail.mt_note",
        )

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
            acknowledgement._post_on_employee_file()
        return acknowledgements

# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocDocumentSignatureRequest(models.Model):
    _name = "doc.document.signature.request"
    _description = "E-signature request (EF-D9 / EF-F8 adapter)"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
    )
    document_id = fields.Many2one("doc.document", required=True, ondelete="cascade")
    employee_file_id = fields.Many2one("doc.employee.file", index=True)
    signer_employee_id = fields.Many2one("hr.employee", required=True)
    requested_by_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    state = fields.Selection(
        [
            ("requested", "Requested"),
            ("completed", "Completed"),
            ("declined", "Declined"),
            ("expired", "Expired"),
        ],
        default="requested",
    )
    external_reference = fields.Char(help="Provider-specific request id.")
    provider = fields.Char()

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "document_id": self.document_id.id,
            "signer_employee_id": self.signer_employee_id.id,
            "signer_name": self.signer_employee_id.name,
            "state": self.state,
            "provider": self.provider or "",
        }

    def action_request_via_provider(self):
        """Hook for external e-sign module; no-op stub when provider unavailable."""
        self.ensure_one()
        config = self.env["doc.employee.files.config"].get_for_company(self.company_id)
        if not config.enable_esign:
            return False
        self.write({"provider": config.esign_provider or "stub"})
        return True

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        emitter = self.env.get("doc.audit.emitter.service")
        if emitter:
            for request in records:
                emitter.log_signature_state(request, request.state or "requested")
        return records

    def write(self, vals):
        previous = {record.id: record.state for record in self}
        result = super().write(vals)
        if "state" in vals:
            emitter = self.env.get("doc.audit.emitter.service")
            if emitter:
                for request in self:
                    if previous.get(request.id) != request.state:
                        emitter.log_signature_state(request, request.state)
        if vals.get("state") == "completed":
            Automation = self.env["doc.document.automation"]
            for request in self:
                document = request.document_id
                if document.folder_id.folder_type not in ("organizational", "employee"):
                    continue
                Automation.search([("document_id", "=", document.id)]).execute(
                    "document_signed"
                )
        return result

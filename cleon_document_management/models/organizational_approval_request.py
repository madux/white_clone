# -*- coding: utf-8 -*-
import json

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class DocOrganizationalApprovalRequest(models.Model):
    _name = "doc.organizational.approval.request"
    _description = "Organizational Files approval request"
    _order = "create_date desc"

    name = fields.Char(required=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    requested_by_id = fields.Many2one(
        "res.users",
        required=True,
        default=lambda self: self.env.user,
        index=True,
    )
    action_key = fields.Char(required=True, index=True)
    payload_json = fields.Text()
    folder_id = fields.Many2one("doc.folder", ondelete="set null", index=True)
    document_id = fields.Many2one("doc.document", ondelete="set null", index=True)
    state = fields.Selection(
        [
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("cancelled", "Cancelled"),
            ("expired", "Expired"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    approver_id = fields.Many2one("res.users", ondelete="set null")
    delegated_from_id = fields.Many2one("res.users", ondelete="set null")
    decision_note = fields.Text()
    due_at = fields.Datetime(index=True)
    reminded_at = fields.Datetime()
    escalated_at = fields.Datetime()
    executed_at = fields.Datetime()
    staging_attachment_ids = fields.Many2many(
        "ir.attachment",
        "doc_org_approval_request_staging_attachment_rel",
        "request_id",
        "attachment_id",
        string="Staged upload files",
        help="Temporary files held until an upload or replace-version request is approved.",
    )

    def get_payload(self):
        self.ensure_one()
        if not self.payload_json:
            return {}
        try:
            return json.loads(self.payload_json)
        except (TypeError, ValueError):
            return {}

    def set_payload(self, payload):
        self.ensure_one()
        self.payload_json = json.dumps(payload or {})

    def write(self, vals):
        res = super().write(vals)
        if vals.get("state") in ("rejected", "cancelled", "expired"):
            for request in self:
                if request.state in ("rejected", "cancelled", "expired"):
                    request.staging_attachment_ids.sudo().unlink()
        return res

    def serialize_for_api(self):
        self.ensure_one()
        display_state = self.state
        if self.state == "pending" and self.escalated_at:
            display_state = "escalated"
        payload = self.get_payload()
        target_label = self.name
        if self.document_id:
            target_label = self.document_id.name
        elif self.folder_id:
            target_label = self.folder_id.folder_name
        elif payload.get("name") or payload.get("nameElm"):
            target_label = payload.get("name") or payload.get("nameElm")
        return {
            "id": self.id,
            "name": self.name,
            "action_key": self.action_key,
            "state": self.state,
            "display_state": display_state,
            "requested_by_id": self.requested_by_id.id,
            "requested_by_name": self.requested_by_id.name,
            "folder_id": self.folder_id.id or False,
            "document_id": self.document_id.id or False,
            "approver_id": self.approver_id.id or False,
            "approver_name": self.approver_id.name if self.approver_id else "",
            "delegated_from_id": self.delegated_from_id.id or False,
            "delegated_from_name": self.delegated_from_id.name if self.delegated_from_id else "",
            "decision_note": self.decision_note or "",
            "due_at": fields.Datetime.to_string(self.due_at) if self.due_at else "",
            "escalated_at": fields.Datetime.to_string(self.escalated_at)
            if self.escalated_at
            else "",
            "target_label": target_label,
            "payload": payload,
            "create_date": fields.Datetime.to_string(self.create_date),
        }

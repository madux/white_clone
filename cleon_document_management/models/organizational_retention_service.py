# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models


class DocOrganizationalRetentionService(models.AbstractModel):
    _name = "doc.organizational.retention.service"
    _description = "Retention review and disposal for organisational documents"

    @api.model
    def cron_retention_review(self):
        today = fields.Date.context_today(self)
        policies = self.env["doc.retention.policy"].search([("active", "=", True)])
        Document = self.env["doc.document"]
        for policy in policies:
            if not policy.retention_value:
                continue
            delta_days = policy.retention_value
            if policy.retention_unit == "months":
                delta_days = policy.retention_value * 30
            elif policy.retention_unit == "years":
                delta_days = policy.retention_value * 365
            cutoff = today - timedelta(days=delta_days)
            domain = [
                ("folder_id.folder_type", "=", "organizational"),
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("create_date", "<=", fields.Datetime.to_string(cutoff)),
            ]
            if policy.document_type_id:
                domain.append(("document_type_id", "=", policy.document_type_id.id))
            if policy.applies_to_folder_ids:
                domain.append(("folder_id", "in", policy.applies_to_folder_ids.ids))
            documents = Document.search(domain, limit=500)
            if policy.action_after_expiry == "flag_for_review":
                documents.write({"retention_review_due": True})
            elif policy.action_after_expiry == "archive":
                documents.write({"state": "expired"})
            elif policy.action_after_expiry == "delete":
                for document in documents:
                    if not document.legal_hold_active:
                        document.write({"deleted_at": fields.Datetime.now(), "active": False})

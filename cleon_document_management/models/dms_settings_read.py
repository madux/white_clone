# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocDmsSettingsReadService(models.AbstractModel):
    _name = "doc.dms.settings.read.service"
    _description = "Settings read contract (C8)"

    @api.model
    def build_payload(self):
        params = self.env["ir.config_parameter"].sudo()
        config = self.env["doc.employee.files.config"].get_for_company()
        categories = self.env["doc.document.category"].search(
            [], order="sequence, name"
        )
        types = self.env["doc.document.type"].with_context(active_test=False).search(
            [], order="sequence, name"
        )
        retention_rules = self.env["doc.retention.policy"].search([])
        return {
            "version": "v1",
            "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
            "general": {
                "platform_name": self.env.company.name,
                "timezone": self.env.company.partner_id.tz or "UTC",
                "recycle_bin_retention_days": int(
                    params.get_param(
                        "cleon_document_management.recycle_bin_retention_days", "30"
                    )
                ),
                "mail_smtp_host": params.get_param(
                    "cleon_document_management.mail_smtp_host", ""
                ),
                "mail_smtp_port": params.get_param(
                    "cleon_document_management.mail_smtp_port", "587"
                ),
                "mail_from_address": params.get_param(
                    "cleon_document_management.mail_from_address", ""
                ),
                "mail_from_name": params.get_param(
                    "cleon_document_management.mail_from_name", ""
                ),
            },
            "approval_workflow": {
                "enabled": params.get_param(
                    "cleon_document_management.approval_workflow_enabled", "0"
                )
                == "1",
                "default_require_upload_approval": params.get_param(
                    "cleon_document_management.default_require_upload_approval", "0"
                )
                == "1",
                "default_approval_flow": params.get_param(
                    "cleon_document_management.default_approval_flow", "any"
                ),
                "default_approver_ids": [
                    int(value)
                    for value in params.get_param(
                        "cleon_document_management.default_approver_ids", ""
                    ).split(",")
                    if value.isdigit()
                ],
                "org_approval_delegate_user_id": config.org_approval_delegate_user_id.id
                or False,
                "org_approval_delegate_until": fields.Datetime.to_string(
                    config.org_approval_delegate_until
                )
                if config.org_approval_delegate_until
                else False,
            },
            "files_and_uploads": {
                "max_file_size_mb": config.max_file_size_mb or 25,
                "allowed_extensions": config.allowed_file_types or "",
                "virus_scan_required": True,
            },
            "document_categories": [
                item.serialize_for_api() for item in categories
            ],
            "document_types": [
                self._serialize_type_spec(item) for item in types
            ],
            "retention_summary": {
                "rule_count": len(retention_rules),
                "default_retention_period": params.get_param(
                    "cleon_document_management.default_retention_period", "7"
                ),
            },
            "notification_rules": self._notification_rules_payload(),
            "modules": {
                "employee_files": True,
                "organizational_files": True,
                "compliance": True,
                "document_intelligence": True,
            },
            "registry_index": self.env["doc.registry.service"].index_status(),
        }

    @api.model
    def _notification_rules_payload(self):
        if "doc.notification.catalog.service" in self.env:
            self.env["doc.notification.catalog.service"].ensure_default_notification_rules()
        company = self.env.company
        return [
            rule.serialize_for_api()
            for rule in self.env["doc.notification.rule"].search(
                [("company_id", "=", company.id)],
                order="sequence, id",
            )
        ]

    @api.model
    def _serialize_type_spec(self, document_type):
        reminder_days = 30
        return {
            "id": document_type.id,
            "name": document_type.name,
            "category_id": document_type.category_id.id or False,
            "category_name": document_type.category_id.name
            if document_type.category_id
            else "",
            "category": document_type.category,
            "active": document_type.active,
            "expires": document_type.expiry_applicable,
            "expiry_date_required": document_type.require_issue_date
            if document_type.expiry_applicable
            else False,
            "expiry_reminder_days": document_type.expiry_reminder_days or reminder_days,
        }

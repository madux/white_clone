# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocDmsSettingsReadService(models.AbstractModel):
    _name = "doc.dms.settings.read.service"
    _description = "Settings read contract (C8)"

    @api.model
    def build_payload(self):
        params = self.env["ir.config_parameter"].sudo()
        config = self.env["doc.employee.files.config"].get_for_company()
        company = self.env.company
        catalog = self.env["doc.document.catalog.service"]
        catalog.ensure_default_catalog(company)
        category_domain = catalog.category_domain(company)
        categories = self.env["doc.document.category"].search(
            category_domain, order="sequence, name"
        )
        types = self.env["doc.document.type"].with_context(active_test=False).search(
            [("category_id", "in", categories.ids)],
            order="sequence, name",
        )
        retention_rules = self.env["doc.retention.policy"].search([])
        return {
            "version": "v1",
            "generated_at": fields.Datetime.to_string(fields.Datetime.now()),
            "general": self._general_payload(params),
            "approval_workflow": self.env[
                "doc.approval.workflow.service"
            ].settings_payload(),
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
            "modules": self.env[
                "doc.dms.tenant.modules.service"
            ].read_modules(company),
            "registry_index": self.env["doc.registry.service"].index_status(),
        }

    @api.model
    def _general_payload(self, params):
        payload = self.env["doc.dms.general.service"].build_general_payload()
        payload["platform_name"] = payload.get("organisation_name")
        payload["recycle_bin_retention_days"] = int(
            params.get_param(
                "cleon_document_management.recycle_bin_retention_days", "30"
            )
        )
        return payload

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

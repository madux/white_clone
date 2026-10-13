# -*- coding: utf-8 -*-
from odoo import api, models


class DocDmsStorageUsageService(models.AbstractModel):
    _name = "doc.dms.storage.usage.service"
    _description = "DMS storage usage summary (General settings)"

    @api.model
    def _attachment_bytes(self, attachment):
        if not attachment:
            return 0
        return int(attachment.file_size or 0)

    @api.model
    def _sum_version_bytes_for_documents(self, documents):
        Version = self.env["doc.document.version"].sudo()
        versions = Version.search(
            [("document_id", "in", documents.ids), ("active", "=", True)]
        )
        attachment_ids = versions.mapped("file_attachment").ids
        attachments = self.env["ir.attachment"].sudo().browse(attachment_ids)
        total = sum(self._attachment_bytes(item) for item in attachments)
        doc_with_versions = versions.mapped("document_id")
        missing = documents - doc_with_versions
        for document in missing:
            total += self._attachment_bytes(document.attachment_id)
        return total

    @api.model
    def general_storage_payload(self, company=None):
        company = company or self.env.company
        params = self.env["ir.config_parameter"].sudo()
        try:
            quota_gb = float(
                params.get_param(
                    "cleon_document_management.org_storage_quota_gb", "100"
                )
            )
        except (TypeError, ValueError):
            quota_gb = 100.0
        quota_bytes = int(quota_gb * 1024 * 1024 * 1024)

        Document = self.env["doc.document"].sudo()
        employee_docs = Document.search(
            [
                ("folder_id.folder_type", "=", "employee"),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        org_docs = Document.search(
            [
                ("folder_id.folder_type", "=", "organizational"),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        employee_bytes = self._sum_version_bytes_for_documents(employee_docs)
        org_bytes = self._sum_version_bytes_for_documents(org_docs)

        Template = self.env.get("doc.template")
        template_bytes = 0
        if Template:
            templates = Template.sudo().search(
                [
                    "|",
                    ("company_id", "=", company.id),
                    ("company_id", "=", False),
                ]
            )
            for template in templates:
                template_bytes += int(template.file_size or 0)
                if template.source_attachment_id:
                    template_bytes += self._attachment_bytes(
                        template.source_attachment_id
                    )

        Signature = self.env.get("doc.document.signature.request")
        signature_bytes = 0
        if Signature:
            sig_docs = Signature.sudo().search(
                [("company_id", "=", company.id)]
            ).mapped("document_id")
            signature_bytes = self._sum_version_bytes_for_documents(sig_docs)

        di_docs = Document.search(
            [
                ("folder_id.folder_name", "=", "Document Intelligence uploads"),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ]
        )
        di_bytes = self._sum_version_bytes_for_documents(di_docs)

        breakdown = [
            {"key": "employee_files", "label": "Employee Files", "bytes": employee_bytes},
            {"key": "org_files", "label": "Org Files", "bytes": org_bytes},
            {"key": "templates", "label": "Templates", "bytes": template_bytes},
            {"key": "signatures", "label": "Signatures", "bytes": signature_bytes},
            {"key": "di_exports", "label": "DI exports", "bytes": di_bytes},
        ]
        used_bytes = sum(item["bytes"] for item in breakdown)

        Folder = self.env["doc.folder"].sudo()
        largest = []
        for folder in Folder.search(
            [
                ("folder_type", "in", ("employee", "organizational")),
                ("active", "=", True),
            ],
            limit=200,
        ):
            docs = Document.search(
                [
                    ("folder_id", "child_of", folder.id),
                    ("active", "=", True),
                    ("deleted_at", "=", False),
                ]
            )
            folder_bytes = self._sum_version_bytes_for_documents(docs)
            if folder_bytes:
                largest.append(
                    {
                        "id": folder.id,
                        "name": folder.folder_name,
                        "bytes": folder_bytes,
                    }
                )
        largest.sort(key=lambda item: item["bytes"], reverse=True)
        largest = largest[:8]

        used_pct = (used_bytes / quota_bytes * 100.0) if quota_bytes else 0.0
        return {
            "used_bytes": used_bytes,
            "quota_bytes": quota_bytes,
            "quota_gb": quota_gb,
            "used_percent": round(used_pct, 1),
            "alert_thresholds": [80, 95],
            "breakdown": breakdown,
            "largest_folders": largest,
        }

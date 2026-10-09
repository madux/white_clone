# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.osv import expression


class DocRegistryService(models.AbstractModel):
    _name = "doc.registry.service"
    _description = "Document registry and search (C6)"

    @api.model
    def _source_module_for_document(self, document):
        folder = document.folder_id
        if not folder:
            return "unknown"
        if folder.folder_type == "employee":
            return "employee_files"
        if folder.folder_type == "organizational":
            return "organizational_files"
        return "document_management"

    @api.model
    def _location_path(self, document):
        folder = document.folder_id
        if not folder:
            return ""
        parts = []
        current = folder
        while current:
            parts.append(current.folder_name or current.display_name or str(current.id))
            current = current.parent_id
        return " / ".join(reversed(parts))

    @api.model
    def sync_document_registry(self, documents):
        """Refresh registry metadata on documents (idempotent)."""
        for document in documents:
            processing = "text_extracted"
            if document.ask_index_state == "waiting":
                processing = "pending_text"
            elif document.ask_index_state in ("indexing",):
                processing = "processing"
            elif document.ask_index_state == "skipped":
                processing = "no_text"
            elif document.ocr_state == "failed":
                processing = "ocr_failed"
            values = {
                "registry_source_module": self._source_module_for_document(document),
                "registry_location_path": self._location_path(document),
                "registry_processing_state": processing,
                "registry_synced_at": fields.Datetime.now(),
            }
            if document.linked_template_document_id:
                values["registry_template_id"] = document.linked_template_document_id.id
            document.sudo().write(values)

    @api.model
    def _permission_domain(self, user):
        """Documents the user may open (conservative stub)."""
        employee = user.employee_id
        own = [
            ("owner_id", "=", user.id),
            ("folder_id.folder_type", "=", "employee"),
        ]
        if employee:
            own = expression.OR(
                [
                    own,
                    [("employee_id", "=", employee.id)],
                ]
            )
        base = expression.AND(
            [
                [("active", "=", True), ("deleted_at", "=", False)],
                expression.OR([own, [("folder_id.folder_type", "=", "organizational")]]),
            ]
        )
        return base

    @api.model
    def _filter_accessible(self, documents, user):
        org = documents.filtered(lambda d: d.folder_id.folder_type == "organizational")
        rest = documents - org
        if org:
            org = org.filter_for_organizational_access(user)
        employee = user.employee_id
        if employee:
            emp_docs = rest.filtered(
                lambda d: d.folder_id.folder_type == "employee"
                and (
                    d.owner_id == user
                    or d.employee_id == employee
                )
            )
        else:
            emp_docs = rest.filtered(
                lambda d: d.folder_id.folder_type == "employee" and d.owner_id == user
            )
        return emp_docs | org

    @api.model
    def search_documents(self, query="", filters=None, page=1, page_size=25):
        user = self.env.user
        filters = filters or {}
        domain = self._permission_domain(user)
        term = (query or "").strip()
        if term:
            domain = expression.AND(
                [
                    domain,
                    [
                        "|",
                        "|",
                        ("name", "ilike", term),
                        ("document_type_id.name", "ilike", term),
                        ("employee_id.name", "ilike", term),
                    ],
                ]
            )
        if filters.get("module") == "employee_files":
            domain = expression.AND(
                [domain, [("folder_id.folder_type", "=", "employee")]]
            )
        elif filters.get("module") == "organizational_files":
            domain = expression.AND(
                [domain, [("folder_id.folder_type", "=", "organizational")]]
            )
        if not filters.get("include_archived"):
            domain = expression.AND([domain, [("state", "!=", "expired")]])
        page = max(int(page or 1), 1)
        page_size = min(max(int(page_size or 25), 1), 100)
        Document = self.env["doc.document"]
        total = Document.search_count(domain)
        offset = (page - 1) * page_size
        records = Document.search(domain, limit=page_size, offset=offset, order="write_date desc")
        records = self._filter_accessible(records, user)
        items = [self._serialize_registry_entry(doc) for doc in records]
        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
            "query": query,
        }

    @api.model
    def get_document(self, document_id):
        document = self.env["doc.document"].browse(int(document_id)).exists()
        if not document:
            return None
        allowed = self._filter_accessible(document, self.env.user)
        if not allowed:
            self.env["doc.object.audit"].sudo().log(
                document,
                "registry_access_denied",
                "Registry get_document refused",
            )
            return None
        return self._serialize_registry_entry(document, include_actions=True)

    @api.model
    def _serialize_registry_entry(self, document, include_actions=False):
        processing = document.registry_processing_state or "unknown"
        text_searchable = document.ask_index_state == "indexed"
        entry = {
            "document_id": document.id,
            "name": document.name,
            "document_type": document.document_type_id.name
            if document.document_type_id
            else "",
            "source_module": document.registry_source_module
            or self._source_module_for_document(document),
            "location_path": document.registry_location_path or self._location_path(document),
            "status": document.state,
            "approval_state": document.approval_state,
            "version": getattr(document, "current_version_number", None) or 1,
            "employee_id": document.employee_id.id or False,
            "employee_name": document.employee_id.name if document.employee_id else "",
            "folder_id": document.folder_id.id if document.folder_id else False,
            "processing_state": processing,
            "text_searchable": text_searchable,
            "text_search_label": ""
            if text_searchable
            else "Text not yet searchable",
            "legal_hold": bool(document.legal_hold_active),
            "archived": document.state == "expired" or bool(document.deleted_at),
            "modified_at": fields.Datetime.to_string(document.write_date),
        }
        if include_actions:
            entry["actions"] = ["open", "preview", "download"]
        return entry

    @api.model
    def index_status(self):
        Document = self.env["doc.document"]
        base = [("active", "=", True), ("deleted_at", "=", False)]
        return {
            "indexed": Document.search_count(base + [("ask_index_state", "=", "indexed")]),
            "waiting": Document.search_count(base + [("ask_index_state", "=", "waiting")]),
            "indexing": Document.search_count(base + [("ask_index_state", "=", "indexing")]),
            "failed": Document.search_count(base + [("ocr_state", "=", "failed")]),
            "registry_synced": Document.search_count(
                base + [("registry_synced_at", "!=", False)]
            ),
            "total_documents": Document.search_count(base),
        }

# -*- coding: utf-8 -*-
import json
import logging
import re

from odoo import fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request
from odoo.osv import expression

from odoo.addons.cleon_document_management.controllers.access import user_is_document_admin
from odoo.addons.cleon_document_management.models import organizational_openrouter

_logger = logging.getLogger(__name__)


def _as_int_ids(value):
    if value in (None, False, ""):
        return []
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except (TypeError, ValueError):
            value = [value]
    if isinstance(value, (int, float)):
        return [int(value)]
    if not isinstance(value, (list, tuple)):
        return []
    ids = []
    for item in value:
        try:
            ids.append(int(item))
        except (TypeError, ValueError):
            continue
    return ids


class OrganizationalFilesController(http.Controller):
    @staticmethod
    def _perm():
        return request.env["doc.organizational.files.permission"]

    @http.route(
        "/api/organizational/defaults",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def organizational_defaults(self, **kwargs):
        perm = self._perm()
        user = request.env.user
        if not (
            perm.user_can_access_org_library(user)
            or perm.user_can_create_folder(user)
        ):
            return {"success": False, "message": "Organizational library access is required."}
        config = request.env["doc.employee.files.config"].get_for_company()
        return {
            "success": True,
            "data": {
                "default_org_access_scope": config.default_org_access_scope or "private",
                "default_org_restricted_scope": config.default_org_restricted_scope
                or "department",
            },
        }

    @http.route(
        "/api/organizational/document-access",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_document_access(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document_access(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to manage document access.",
            }
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document or document.folder_id.folder_type != "organizational":
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        try:
            document.folder_id.assert_unlocked()
            values = document._prepare_organizational_access_values(
                org_use_folder_access=kwargs.get("org_use_folder_access", True),
                org_access_scope=kwargs.get("org_access_scope"),
                department_ids=kwargs.get("org_department_ids"),
                grade_ids=kwargs.get("org_grade_ids"),
                employee_ids=kwargs.get("org_employee_ids"),
                folder=document.folder_id,
            )
        except (ValidationError, UserError) as error:
            return {"success": False, "message": error.args[0]}
        previous_access = document._organizational_access_summary()
        document.write(values)
        document.action_record_organizational_access_audit(previous_access)
        return {
            "success": True,
            "data": document.serialize_for_api(request.env.user),
        }

    @http.route(
        "/api/organizational/assign-policy-template",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assign_policy_template(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to link policies or templates.",
            }
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        policy_id = kwargs.get("linked_policy_id")
        template_id = kwargs.get("linked_template_document_id")
        values = {}
        if policy_id is not None:
            policy = request.env["doc.compliance.policy"].browse(int(policy_id or 0)).exists()
            values["linked_policy_id"] = policy.id if policy else False
        if template_id is not None:
            template = request.env["doc.document"].browse(int(template_id or 0)).exists()
            values["linked_template_document_id"] = template.id if template else False
        if values:
            document.write(values)
        return {
            "success": True,
            "data": document.serialize_for_api(request.env.user),
        }

    @http.route(
        "/api/organizational/copy-document",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def copy_document(self, document_id=None, folder_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to copy documents.",
            }
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document:
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        destination = document.folder_id
        if folder_id:
            destination = request.env["doc.folder"].browse(int(folder_id)).exists()
        if not destination or destination.folder_type != "organizational":
            return {"success": False, "message": "Destination folder not found."}
        try:
            destination.assert_unlocked(for_upload=True)
            if not destination._user_can_access(request.env.user):
                return {"success": False, "message": "Destination folder is not accessible."}
            copy = document.with_context(org_document_copy=True).copy(
                default={
                    "folder_id": destination.id,
                    "name": f"{document.name} (Copy)",
                }
            )
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        return {
            "success": True,
            "data": copy.serialize_for_api(request.env.user),
        }

    @http.route(
        "/api/organizational/suggest-description",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def suggest_description(self, name=None, visibility=None, description=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_suggest_folder_description(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to suggest a folder description.",
            }
        folder_name = (name or "").strip()
        if not folder_name:
            return {"success": False, "message": "Folder name is required."}
        if len(folder_name) > 100:
            return {
                "success": False,
                "message": "Folder name must be 100 characters or fewer.",
            }
        try:
            suggested = organizational_openrouter.suggest_folder_description(
                request.env,
                folder_name,
                visibility=visibility,
                description=description,
            )
        except ValueError as error:
            return {"success": False, "message": error.args[0]}
        except RuntimeError as error:
            return {"success": False, "message": error.args[0]}
        return {
            "success": True,
            "data": {"description": suggested},
        }

    @http.route(
        "/api/organizational/summarize-document",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def summarize_document(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to summarize this document.",
            }
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document or document.folder_id.folder_type != "organizational":
            return {"success": False, "message": "Document not found."}
        document.check_access_rule("read")
        if not document._organizational_user_can_access(request.env.user):
            return {
                "success": False,
                "message": "You do not have access to this document.",
            }
        attachment = document._effective_preview_attachment()
        if not attachment:
            return {
                "success": False,
                "message": "This document has no file to summarize.",
            }
        from odoo.addons.cleon_document_management.models.intelligence_pipeline import (
            extract_document_text,
        )

        text, _source, _pages = extract_document_text(
            attachment, ocr_fallback=False, env=request.env
        )
        try:
            summary = organizational_openrouter.summarize_document_text(
                request.env,
                document.name,
                text,
                document_type=document.document_type_id.name,
            )
        except ValueError as error:
            return {"success": False, "message": error.args[0]}
        except RuntimeError as error:
            return {"success": False, "message": error.args[0]}
        return {
            "success": True,
            "data": {"summary": summary},
        }

    def _org_document(self, document_id):
        document = request.env["doc.document"].browse(int(document_id or 0)).exists()
        if not document or document.folder_id.folder_type != "organizational":
            return None
        document.check_access_rule("read")
        return document

    def _org_folder(self, folder_id):
        folder = request.env["doc.folder"].browse(int(folder_id or 0)).exists()
        if not folder or folder.folder_type != "organizational":
            return None
        folder.check_access_rule("read")
        return folder

    @http.route(
        "/api/organizational/rename-document",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def rename_document(self, document_id=None, name=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to rename this document."}
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        trimmed = (name or "").strip()
        if not trimmed:
            return {"success": False, "message": "Document name is required."}
        try:
            document.folder_id.assert_unlocked()
            document.write({"name": trimmed})
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(document, "rename", f"Renamed to {trimmed}")
        return {"success": True, "data": document.serialize_for_api(request.env.user)}

    @http.route(
        "/api/organizational/create-shortcut",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_shortcut(self, document_id=None, folder_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to add a shortcut."}
        document = self._org_document(document_id)
        destination = self._org_folder(folder_id)
        if not document or not destination:
            return {"success": False, "message": "Document or destination folder not found."}
        try:
            destination.assert_unlocked(for_upload=True)
            if not destination._user_can_access(request.env.user):
                return {"success": False, "message": "Destination folder is not accessible."}
            values = {
                "name": document.name,
                "folder_id": destination.id,
                "document_type_id": document.document_type_id.id,
                "description": document.description or "",
                "is_shortcut": True,
                "shortcut_of_id": document.shortcut_of_id.id or document.id,
                "source_url": document.source_url or False,
                "org_use_folder_access": True,
            }
            if document.attachment_id:
                attachment = document.attachment_id.copy(
                    {"res_model": "doc.document", "res_id": False}
                )
                values["attachment_id"] = attachment.id
            shortcut = document.with_context(org_document_copy=True).copy(default=values)
            if document.attachment_id and shortcut.attachment_id:
                shortcut.attachment_id.write(
                    {"res_model": shortcut._name, "res_id": shortcut.id}
                )
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            shortcut, "shortcut", f"Shortcut of document {document.id}"
        )
        return {"success": True, "data": shortcut.serialize_for_api(request.env.user)}

    @http.route(
        "/api/organizational/move-folder",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def move_folder(self, folder_id=None, parent_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_folders(request.env.user):
            return {"success": False, "message": "You do not have permission to move this folder."}
        folder = self._org_folder(folder_id)
        if not folder:
            return {"success": False, "message": "Folder not found."}
        parent = False
        if parent_id:
            parent = self._org_folder(parent_id)
            if not parent:
                return {"success": False, "message": "Destination folder not found."}
        try:
            folder.action_move_folder(parent)
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            folder,
            "move",
            f"Moved under {parent.folder_name if parent else 'library root'}",
        )
        return {"success": True, "data": {"id": folder.id, "parent_id": folder.parent_id.id or False}}

    @http.route(
        "/api/organizational/link-status",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def refresh_link_status(self, document_id=None, **kwargs):
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        from odoo.addons.cleon_document_management.models.organizational_library import (
            probe_source_url,
        )

        status = probe_source_url(document.source_url)
        document.write({"link_status": status})
        return {"success": True, "data": {"link_status": status, "source_url": document.source_url or ""}}

    @http.route(
        "/api/organizational/policies-templates",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_policies_templates(self, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {"success": False, "message": "You do not have permission to browse this library."}
        OrgPolicy = request.env["doc.organizational.policy"]
        org_policies = OrgPolicy.search(
            [
                ("active", "=", True),
                ("lifecycle_status", "=", "active"),
            ],
            order="name",
            limit=200,
        )
        templates = request.env["doc.document"].search(
            [
                ("is_template", "=", True),
                ("folder_id.folder_type", "=", "organizational"),
                ("active", "=", True),
            ],
            limit=100,
        )
        return {
            "success": True,
            "data": {
                "policies": [
                    {
                        "id": policy.id,
                        "name": policy.name,
                        "lifecycle_status": policy.lifecycle_status,
                        "category": policy.category or "",
                        "document_id": document.id,
                        "document_name": document.name,
                    }
                    for policy in org_policies
                    for document in [policy.assignable_document()]
                    if document
                ],
                "templates": [
                    {"id": template.id, "name": template.name, "folder_id": template.folder_id.id}
                    for template in templates
                ],
            },
        }

    @http.route(
        "/api/organizational/suggested-files",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def suggested_files(self, name=None, folder_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {"success": False, "message": "You do not have permission to browse this library."}
        query = (name or "").strip()
        if len(query) < 2:
            return {"success": True, "data": {"items": []}}
        domain = [
            ("folder_id.folder_type", "=", "organizational"),
            ("active", "=", True),
            ("is_shortcut", "=", False),
            ("is_template", "=", False),
            "|",
            ("name", "ilike", query),
            ("description", "ilike", query),
        ]
        if folder_id:
            domain.append(("folder_id", "!=", int(folder_id)))
        documents = request.env["doc.document"].search(domain, limit=20)
        items = [
            document.serialize_for_api(request.env.user)
            for document in documents
            if document._organizational_user_can_access(request.env.user)
        ]
        return {"success": True, "data": {"items": items[:20]}}

    @staticmethod
    def _policy_match_text(value):
        text = (value or "").lower()
        return re.sub(r"[\s\-_.]+", " ", text).strip()

    @classmethod
    def _policy_query_words(cls, query):
        normalized = cls._policy_match_text(query)
        return [word for word in normalized.split() if len(word) >= 2]

    @staticmethod
    def _policy_suggestion_match_reason(document, query):
        haystack = OrganizationalFilesController._policy_match_text(
            f"{document.name or ''} {document.description or ''}"
        )
        needle = OrganizationalFilesController._policy_match_text(query)
        if needle and needle in haystack:
            return "name"
        words = OrganizationalFilesController._policy_query_words(query)
        if words and all(word in haystack for word in words):
            return "name"
        return "policy_keyword"

    @classmethod
    def _document_matches_policy_name_query(cls, document, query):
        query = (query or "").strip()
        if not query:
            return True
        haystack = cls._policy_match_text(
            f"{document.name or ''} {document.description or ''}"
        )
        needle = cls._policy_match_text(query)
        if needle and needle in haystack:
            return True
        words = cls._policy_query_words(query)
        if not words:
            return False
        return all(word in haystack for word in words)

    @classmethod
    def _policy_suggestion_word_domain(cls, query):
        words = cls._policy_query_words(query)
        if not words:
            return []
        word_groups = []
        for word in words:
            word_groups.append(
                [
                    "|",
                    ("name", "ilike", f"%{word}%"),
                    ("description", "ilike", f"%{word}%"),
                ]
            )
        if len(word_groups) == 1:
            return word_groups[0]
        return expression.AND(word_groups)

    @staticmethod
    def _policy_suggestion_name_domain(query):
        query = (query or "").strip()
        if len(query) < 2:
            return [("name", "ilike", "%policy%")]
        return [
            "|",
            ("name", "ilike", f"%{query}%"),
            ("description", "ilike", f"%{query}%"),
        ]

    @classmethod
    def _policy_suggestion_base_domain(cls, registered_doc_ids, adopt_mode=False):
        domain = [
            ("folder_id.folder_type", "=", "organizational"),
            ("active", "=", True),
            ("is_shortcut", "=", False),
            ("is_template", "=", False),
            ("id", "not in", registered_doc_ids or [0]),
            "|",
            ("folder_id.folder_kind", "=", False),
            ("folder_id.folder_kind", "!=", "policy"),
        ]
        if not adopt_mode:
            domain.append(("is_policy", "=", False))
        return domain

    @classmethod
    def _search_policy_suggestion_documents(
        cls,
        env,
        query,
        adopt_mode=False,
        folder_id=None,
        adopt_folder_id=None,
        browse_library=False,
    ):
        Policy = env["doc.organizational.policy"]
        registered_doc_ids = Policy.registered_primary_document_ids()
        domain = cls._policy_suggestion_base_domain(registered_doc_ids, adopt_mode)
        if folder_id:
            domain.append(("folder_id", "!=", int(folder_id)))
        if adopt_folder_id:
            domain.append(("folder_id", "!=", int(adopt_folder_id)))

        Document = env["doc.document"]
        limit = 500 if browse_library else 300
        if browse_library:
            if query:
                name_domain = cls._policy_suggestion_name_domain(query)
                search_domain = expression.AND([domain, name_domain])
                documents = Document.search(search_domain, order="name", limit=limit)
            else:
                documents = Document.search(domain, order="name", limit=limit)
            return documents
        if adopt_mode and query:
            word_domain = cls._policy_suggestion_word_domain(query)
            search_domain = (
                expression.AND([domain, word_domain]) if word_domain else domain
            )
            documents = Document.search(search_domain, order="name", limit=500)
            if not documents:
                documents = Document.search(domain, order="name", limit=2000)
        else:
            name_domain = cls._policy_suggestion_name_domain(query)
            search_domain = expression.AND([domain, name_domain])
            documents = Document.search(search_domain, limit=300, order="name")
        return documents

    @classmethod
    def _build_policy_suggestion_items(
        cls,
        env,
        documents,
        query,
        adopt_mode=False,
        user=None,
        max_items=50,
        require_name_match=False,
    ):
        user = user or env.user
        items = []
        for document in documents:
            if (
                require_name_match
                and query
                and not cls._document_matches_policy_name_query(document, query)
            ):
                continue
            if not document._eligible_for_policy_adoption(user):
                continue
            payload = document.serialize_for_api(user)
            payload["match_reason"] = cls._policy_suggestion_match_reason(
                document, query
            )
            payload["folder_path"] = [
                crumb.get("name") or ""
                for crumb in (payload.get("folder_path") or [])
            ]
            items.append(payload)
        if query:
            needle = query.lower()

            def _rank(payload):
                doc_name = (payload.get("name") or "").lower()
                if needle in doc_name:
                    return 0
                if payload.get("match_reason") == "name":
                    return 1
                return 2

            items.sort(key=_rank)
        return items[:max_items]

    @http.route(
        "/api/organizational/suggested-policy-files",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def suggested_policy_files(self, name=None, folder_id=None, policy_folder_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to browse this library.",
            }
        query = (name or "").strip()
        adopt_folder_id = policy_folder_id or kwargs.get("policy_folder_id")
        preview_suggestions = bool(kwargs.get("preview_suggestions"))
        browse_library = bool(kwargs.get("browse_library"))
        adopt_mode = bool(adopt_folder_id) or preview_suggestions or browse_library
        documents = self._search_policy_suggestion_documents(
            request.env,
            query,
            adopt_mode=adopt_mode,
            folder_id=folder_id,
            adopt_folder_id=adopt_folder_id,
            browse_library=browse_library,
        )
        items = self._build_policy_suggestion_items(
            request.env,
            documents,
            query,
            adopt_mode=adopt_mode,
            user=request.env.user,
            max_items=200 if browse_library else 50,
            require_name_match=adopt_mode
            and bool(query)
            and preview_suggestions
            and not browse_library,
        )
        return {"success": True, "data": {"items": items}}

    @staticmethod
    def _serialize_policy_folder(folder):
        return {
            "id": folder.id,
            "folder_name": folder.folder_name,
            "folder_type": folder.folder_type,
            "folder_kind": folder.folder_kind or "policy",
            "parent_id": folder.parent_id.id if folder.parent_id else False,
            "collection_code": folder.collection_code or "",
        }

    @http.route(
        "/api/organizational/create-policy-folder",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_policy_folder(self, name=None, document_ids=None, **kwargs):
        perm = self._perm()
        user = request.env.user
        if not perm.user_can_create_folder(user):
            return {
                "success": False,
                "message": "You do not have permission to create folders.",
            }
        if not perm.user_can_manage_org_document(user):
            return {
                "success": False,
                "message": "You do not have permission to manage organizational documents.",
            }
        title = (name or "").strip()
        if not title:
            return {"success": False, "message": "Enter a policy name."}
        if len(title) > 100:
            return {
                "success": False,
                "message": "Policy name must be 100 characters or fewer.",
            }
        ids = _as_int_ids(document_ids)
        if not ids and kwargs.get("document_id"):
            ids = _as_int_ids(kwargs.get("document_id"))
        Policy = request.env["doc.organizational.policy"]
        duplicate = Policy.find_duplicate_by_name(title)
        if duplicate:
            return {
                "success": False,
                "code": "duplicate_name",
                "message": "A policy with this name already exists.",
                "data": {
                    "policy_id": duplicate.id,
                    "policy": duplicate.serialize_for_api(user),
                },
            }
        documents = (
            request.env["doc.document"].browse(ids).exists()
            if ids
            else request.env["doc.document"]
        )
        if ids and len(documents) != len(set(ids)):
            return {"success": False, "message": "One or more selected files were not found."}
        for document in documents:
            if not document._eligible_for_policy_adoption(user):
                return {
                    "success": False,
                    "message": f"{document.name} cannot be added to a new policy.",
                }
        parent = self._org_folder(kwargs.get("parent_folder_id"))
        if kwargs.get("parent_folder_id") and not parent:
            return {"success": False, "message": "Parent folder not found."}
        visibility = kwargs.get("visibility") or kwargs.get("policy_visibility") or "employees"
        if visibility not in ("employees", "hr_only"):
            visibility = "employees"
        effective_date = kwargs.get("effective_date") or False
        category = (kwargs.get("category") or "").strip()
        description = (kwargs.get("description") or "").strip()
        access_scope = kwargs.get("access_scope")
        if not access_scope and parent:
            access_scope = parent.access_scope
        access_scope = access_scope or "all_staff"
        Folder = request.env["doc.folder"]
        folder_vals = {
            "folder_name": title,
            "folder_type": "organizational",
            "folder_kind": "policy",
            "access_scope": access_scope,
            "organize_by": "none",
        }
        if parent:
            folder_vals["parent_id"] = parent.id
            if not kwargs.get("department_ids") and parent.department_ids:
                folder_vals["department_ids"] = [(6, 0, parent.department_ids.ids)]
            if not kwargs.get("grade_ids") and parent.grade_ids:
                folder_vals["grade_ids"] = [(6, 0, parent.grade_ids.ids)]
            if not kwargs.get("employee_ids") and parent.employee_ids:
                folder_vals["employee_ids"] = [(6, 0, parent.employee_ids.ids)]
        try:
            if parent:
                parent.assert_unlocked(for_upload=True)
            for document in documents:
                document.folder_id.assert_unlocked(for_upload=True)
            folder = Folder.create(folder_vals)
            folder.assert_unlocked(for_upload=True)
            policy_vals = {
                "name": title,
                "folder_id": folder.id,
                "category": category,
                "description": description,
                "lifecycle_status": "draft",
                "policy_visibility": visibility,
                "effective_date": effective_date or False,
                "company_id": request.env.company.id,
            }
            if documents:
                doc_values = {
                    "is_policy": True,
                    "policy_visibility": visibility,
                    "effective_date": effective_date or False,
                    "folder_id": folder.id,
                }
                documents.write(doc_values)
                policy_vals["document_id"] = documents[0].id
            policy = Policy.create(policy_vals)
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            folder,
            "create_policy_folder",
            "Created policy folder with %s document(s)" % len(documents),
        )
        payload = {
            "folder": self._serialize_policy_folder(folder),
            "policy": policy.serialize_for_api(user),
            "documents": [document.serialize_for_api(user) for document in documents],
        }
        if documents:
            payload["document"] = documents[0].serialize_for_api(user)
        return {"success": True, "data": payload}

    @http.route(
        "/api/organizational/adopt-policy-files",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def adopt_policy_files(self, policy_id=None, document_ids=None, **kwargs):
        perm = self._perm()
        user = request.env.user
        if not perm.user_can_manage_org_document(user):
            return {
                "success": False,
                "message": "You do not have permission to manage organizational documents.",
            }
        policy = request.env["doc.organizational.policy"].browse(int(policy_id or 0)).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        folder = policy.folder_id
        if folder.folder_kind != "policy":
            return {"success": False, "message": "Policy folder not found."}
        folder.check_access_rule("read")
        ids = _as_int_ids(document_ids)
        if not ids:
            return {"success": True, "data": {"policy": policy.serialize_for_api(user), "documents": []}}
        documents = request.env["doc.document"].browse(ids).exists()
        if len(documents) != len(set(ids)):
            return {"success": False, "message": "One or more selected files were not found."}
        visibility = policy.policy_visibility or "employees"
        effective_date = policy.effective_date or False
        try:
            folder.assert_unlocked(for_upload=True)
            for document in documents:
                if not document._eligible_for_policy_adoption(user):
                    return {
                        "success": False,
                        "message": f"{document.name} cannot be added to this policy.",
                    }
                document.folder_id.assert_unlocked(for_upload=True)
            documents.write(
                {
                    "is_policy": True,
                    "policy_visibility": visibility,
                    "effective_date": effective_date,
                    "folder_id": folder.id,
                }
            )
            if not policy.document_id:
                policy.write({"document_id": documents[0].id})
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            folder,
            "adopt_policy_files",
            "Adopted %s file(s) into policy %s" % (len(documents), policy.id),
        )
        return {
            "success": True,
            "data": {
                "policy": policy.serialize_for_api(user),
                "documents": [document.serialize_for_api(user) for document in documents],
            },
        }

    @http.route(
        "/api/organizational/create-policy-scratch-draft",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_policy_scratch_draft(self, **kwargs):
        perm = self._perm()
        user = request.env.user
        try:
            perm.require_upload_org(user)
        except AccessError as error:
            return {"success": False, "message": str(error)}
        folder_id = int(kwargs.get("folder_id") or 0)
        document_type_id = int(kwargs.get("document_type_id") or 0)
        name = (kwargs.get("name") or "").strip()
        if not folder_id or not document_type_id or not name:
            return {
                "success": False,
                "message": "folder_id, document_type_id, and name are required.",
            }
        folder = request.env["doc.folder"].browse(folder_id).exists()
        if not folder or folder.folder_type != "organizational":
            return {"success": False, "message": "Folder not found."}
        if (folder.folder_kind or "folder") != "policy":
            return {"success": False, "message": "Scratch drafts must be created in a policy folder."}
        folder.check_access_rule("read")
        Document = request.env["doc.document"]
        try:
            hr_document, editor_document = Document.create_policy_scratch_draft(
                folder, name, document_type_id
            )
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            folder,
            "create_policy_scratch_draft",
            "Started scratch policy document %s" % hr_document.id,
        )
        return {
            "success": True,
            "data": {
                "folder_id": folder.id,
                "hr_document_id": hr_document.id,
                "editor_document_id": editor_document.id,
                "document": hr_document.serialize_for_api(user),
            },
        }

    @http.route(
        "/api/organizational/policy-editor/<int:hr_document_id>/sync-attachment",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def sync_policy_editor_attachment(self, hr_document_id, **kwargs):
        perm = self._perm()
        user = request.env.user
        try:
            perm.require_upload_org(user)
        except AccessError as error:
            return {"success": False, "message": str(error)}
        hr_document = request.env["doc.document"].browse(int(hr_document_id)).exists()
        if not hr_document or not hr_document.policy_editor_document_id:
            return {"success": False, "message": "Policy editor document not found."}
        hr_document.check_access_rule("write")
        rendered_text = kwargs.get("rendered_text")
        if rendered_text is None:
            rendered_text = hr_document.policy_editor_document_id.rendered_text
        synced = hr_document._sync_policy_editor_pdf(rendered_text)
        return {
            "success": True,
            "data": {
                "synced": bool(synced),
                "document": hr_document.serialize_for_api(user),
            },
        }

    @http.route(
        "/api/organizational/active-templates-forms",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_active_templates_forms(self, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to browse this library.",
            }
        Template = request.env["doc.template"]
        params = {"q": kwargs.get("q") or ""}
        domain = Template.library_domain(kwargs.get("kind") or "template", params)
        domain.append(("status", "=", "published"))
        templates = Template.search(domain, limit=50, order="name asc")
        return {
            "success": True,
            "data": {
                "templates": [item.to_library_dict() for item in templates],
            },
        }

    @http.route(
        "/api/organizational/policies",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def list_organizational_policies(self, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to browse this library.",
            }
        domain = [("active", "=", True)]
        status = (kwargs.get("lifecycle_status") or kwargs.get("status") or "").strip()
        if status and status != "all":
            domain.append(("lifecycle_status", "=", status))
        visibility = (kwargs.get("visibility") or kwargs.get("policy_visibility") or "").strip()
        if visibility in ("employees", "hr_only"):
            domain.append(("policy_visibility", "=", visibility))
        query = (kwargs.get("search") or kwargs.get("name") or "").strip()
        if query:
            domain.extend(
                [
                    "|",
                    ("name", "ilike", query),
                    ("category", "ilike", query),
                ]
            )
        policies = request.env["doc.organizational.policy"].search(
            domain, order="write_date desc", limit=200
        )
        user = request.env.user
        items = []
        seen_folder_ids = set()
        for policy in policies:
            folder = policy.folder_id
            if not folder.active or folder.deleted_at:
                continue
            if (folder.folder_kind or "folder") != "policy":
                continue
            if folder.id in seen_folder_ids:
                continue
            if not policy.user_can_view(user):
                continue
            seen_folder_ids.add(folder.id)
            items.append(policy.serialize_for_api(user))
        return {
            "success": True,
            "data": {"items": items, "count": len(items)},
        }

    @http.route(
        "/api/organizational/policies/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_organizational_policy(self, policy_id=None, **kwargs):
        perm = self._perm()
        user = request.env.user
        if not perm.user_can_manage_org_policy_lifecycle(user):
            return {
                "success": False,
                "message": "You do not have permission to manage organizational policies.",
            }
        policy = request.env["doc.organizational.policy"].browse(int(policy_id or 0)).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        values = {}
        if "lifecycle_status" in kwargs:
            status = (kwargs.get("lifecycle_status") or "").strip()
            if status not in ("draft", "active", "archived"):
                return {"success": False, "message": "Invalid policy status."}
            values["lifecycle_status"] = status
        for field in ("name", "category", "description", "policy_visibility"):
            if field in kwargs:
                values[field] = kwargs[field]
        if "effective_date" in kwargs:
            values["effective_date"] = kwargs.get("effective_date") or False
        if not values:
            return {"success": False, "message": "No changes provided."}
        try:
            policy.write(values)
            if "policy_visibility" in values:
                visibility = policy.policy_visibility or "employees"
                docs = request.env["doc.document"].search(
                    [
                        ("folder_id", "=", policy.folder_id.id),
                        ("is_policy", "=", True),
                    ]
                )
                if docs:
                    docs.write({"policy_visibility": visibility})
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            policy.folder_id,
            "update_organizational_policy",
            "Updated policy registry %s" % policy.id,
        )
        return {
            "success": True,
            "data": {"policy": policy.serialize_for_api(user)},
        }

    @http.route(
        "/api/organizational/generate-from-template",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def generate_from_template(self, template_id=None, folder_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user) and not perm.user_can_upload_org(
            request.env.user
        ):
            return {"success": False, "message": "You do not have permission to generate from a template."}
        template = self._org_document(template_id)
        destination = self._org_folder(folder_id)
        if not template or not template.is_template or not destination:
            return {"success": False, "message": "Template or destination folder not found."}
        try:
            destination.assert_unlocked(for_upload=True)
            copy = template.with_context(org_document_copy=True).copy(
                default={
                    "folder_id": destination.id,
                    "is_template": False,
                    "linked_template_document_id": template.id,
                    "name": template.name,
                }
            )
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        request.env["doc.object.audit"].log(
            copy, "generate_template", f"Generated from template {template.id}"
        )
        return {"success": True, "data": copy.serialize_for_api(request.env.user)}

    @http.route(
        "/api/organizational/create-template",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_template(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to create a template."}
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        document.write({"is_template": True})
        request.env["doc.object.audit"].log(document, "create_template", "Marked as master template")
        return {"success": True, "data": document.serialize_for_api(request.env.user)}

    @http.route(
        "/api/organizational/import-policy",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def import_policy(self, document_id=None, **kwargs):
        """Deprecated: use analyze-policy-document + confirm-policy-import."""
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to import a policy."}
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        return {
            "success": False,
            "message": "Use analyze and review before importing. Update the app and try again.",
        }

    @http.route(
        "/api/organizational/analyze-policy-document",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def analyze_policy_document(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to import a policy.",
            }
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        if document.env["doc.organizational.policy"].search_count(
            [("document_id", "=", document.id)]
        ):
            return {
                "success": False,
                "message": "This file is already registered as an organizational policy.",
            }
        attachment = document._effective_preview_attachment()
        if not attachment:
            return {
                "success": False,
                "message": "This document has no file to analyze.",
            }
        from odoo.addons.cleon_document_management.models.intelligence_pipeline import (
            extract_document_text,
        )

        try:
            text, _source, _pages = extract_document_text(
                attachment, ocr_fallback=True, env=request.env
            )
        except Exception:
            _logger.exception(
                "Policy import text extraction failed for document %s",
                document.id,
            )
            return {
                "success": False,
                "message": (
                    "Could not read this file. Try a PDF or Word document with "
                    "selectable text, or upload a clearer copy."
                ),
            }
        try:
            proposal = organizational_openrouter.propose_policy_from_document_text(
                request.env,
                document.name,
                text,
                document_type_name=document.document_type_id.name,
            )
        except ValueError as error:
            return {"success": False, "message": error.args[0]}
        except RuntimeError as error:
            return {"success": False, "message": str(error)}
        if document.document_type_id and document.document_type_id.id not in (
            proposal.get("document_type_ids") or []
        ):
            proposal.setdefault("document_type_ids", []).append(
                document.document_type_id.id
            )
        return {
            "success": True,
            "data": {
                "document_id": document.id,
                "document_name": document.name,
                "proposal": proposal,
            },
        }

    @http.route(
        "/api/organizational/confirm-policy-import",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def confirm_policy_import(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {
                "success": False,
                "message": "You do not have permission to import a policy.",
            }
        return {
            "success": False,
            "message": (
                "Organizational policies are created from + New → Create policy. "
                "Compliance rules are managed under Employee Files → Compliance."
            ),
        }

    @http.route(
        "/api/organizational/ai-policy-draft",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ai_policy_draft(self, name=None, **kwargs):
        """Return AI proposal only; policy is created after user confirms in review."""
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user) and not user_is_document_admin(
            request.env.user
        ):
            return {"success": False, "message": "You do not have permission to draft a policy."}
        title = (name or "").strip()
        if not title:
            return {"success": False, "message": "Enter a policy name."}
        try:
            proposal = organizational_openrouter.propose_policy_from_brief(
                request.env,
                title,
                brief=kwargs.get("description"),
                policy_type_id=kwargs.get("policy_type_id"),
                document_type_ids=_as_int_ids(kwargs.get("document_type_ids"))
                or _as_int_ids(kwargs.get("document_type_id")),
            )
        except (RuntimeError, ValueError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": proposal}

    @http.route(
        "/api/organizational/automations",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def automations(self, document_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to manage automations."}
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        op = kwargs.get("op") or "list"
        Automation = request.env["doc.document.automation"]
        if op == "create":
            required = (kwargs.get("name") or "").strip()
            if not required or not kwargs.get("trigger") or not kwargs.get("action"):
                return {"success": False, "message": "Name, trigger and action are required."}
            rule = Automation.create(
                {
                    "name": required,
                    "document_id": document.id,
                    "trigger": kwargs.get("trigger"),
                    "condition": kwargs.get("condition") or False,
                    "action": kwargs.get("action"),
                    "status": kwargs.get("status") or "active",
                }
            )
            request.env["doc.object.audit"].log(document, "automation", f"Saved automation {rule.name}")
            return {"success": True, "data": rule.serialize_for_api()}
        if op == "update":
            rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
            if not rule or rule.document_id != document:
                return {"success": False, "message": "Automation not found."}
            values = {}
            for field in ("name", "trigger", "condition", "action", "status"):
                if field in kwargs:
                    values[field] = kwargs.get(field)
            if values:
                rule.write(values)
            return {"success": True, "data": rule.serialize_for_api()}
        if op == "delete":
            rule = Automation.browse(int(kwargs.get("id") or 0)).exists()
            if rule and rule.document_id == document:
                rule.unlink()
            return {"success": True, "data": {"deleted": True}}
        rules = Automation.search([("document_id", "=", document.id)])
        return {"success": True, "data": {"items": [rule.serialize_for_api() for rule in rules]}}

    @http.route(
        "/api/organizational/connectors",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def connectors(self, **kwargs):
        Connector = request.env["doc.organizational.connector"]
        service = request.env["doc.organizational.cloud.import"]
        op = kwargs.get("op") or "list"
        if op == "set":
            if not request.env.user.has_group("cleon_document_management.group_document_admin"):
                return {"success": False, "message": "Administrator access is required."}
            data = Connector.set_connected(kwargs.get("provider"), bool(kwargs.get("connected")))
            return {"success": True, "data": data}
        items = Connector.list_for_company()
        for item in items:
            item["oauth_configured"] = service.provider_configured(item.get("provider"))
        return {"success": True, "data": {"items": items}}

    @http.route(
        "/api/organizational/import-from-connector",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def import_from_connector(
        self,
        folder_id=None,
        provider=None,
        file_id=None,
        document_type_id=None,
        name=None,
        **kwargs,
    ):
        perm = self._perm()
        if not perm.user_can_upload_org(request.env.user):
            return {"success": False, "message": "You do not have permission to import files."}
        destination = self._org_folder(folder_id)
        if not destination:
            return {"success": False, "message": "Destination folder not found."}
        if provider not in ("google_drive", "onedrive", "sharepoint", "dropbox"):
            return {"success": False, "message": "Unknown source."}
        if not file_id:
            return {"success": False, "message": "Select a file to import."}
        document_type = request.env["doc.document.type"].browse(
            int(document_type_id or 0)
        ).exists()
        if not document_type:
            return {"success": False, "message": "A document type is required."}
        try:
            document = request.env["doc.organizational.cloud.import"].import_file_copy(
                request.env.user,
                destination,
                provider,
                file_id,
                document_type,
                display_name=(name or "").strip(),
            )
        except (UserError, AccessError, ValidationError) as error:
            return {"success": False, "message": error.args[0]}
        return {"success": True, "data": document.serialize_for_api(request.env.user)}

    @http.route(
        "/api/organizational/assign-policy-employee",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def assign_policy_employee(self, policy_id=None, employee_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user) and not request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            return {"success": False, "message": "You do not have permission to assign policies."}
        employee = request.env["hr.employee"].browse(int(employee_id or 0)).exists()
        if not employee:
            return {"success": False, "message": "Employee not found."}
        org_policy_id = int(
            kwargs.get("organizational_policy_id") or policy_id or 0
        )
        org_policy = request.env["doc.organizational.policy"].browse(org_policy_id).exists()
        if not org_policy:
            return {"success": False, "message": "Policy not found."}
        if org_policy.lifecycle_status != "active" or not org_policy.active:
            return {"success": False, "message": "Only active policies can be assigned."}
        folder = org_policy.folder_id
        if not folder.active or folder.deleted_at:
            return {"success": False, "message": "Policy folder is not available."}
        document = org_policy.assignable_document()
        if not document:
            return {
                "success": False,
                "message": "This policy has no policy document to assign. Add a policy file to the folder first.",
            }
        if not document._assignable_as_employee_policy():
            return {
                "success": False,
                "message": "Only policy documents can be assigned to an employee.",
            }
        assignment = request.env["doc.policy.employee.assignment"].create(
            {
                "organizational_policy_id": org_policy.id,
                "employee_id": employee.id,
                "document_id": document.id,
                "requested_signature": bool(kwargs.get("requested_signature")),
            }
        )
        try:
            assignment.action_notify()
        except Exception:  # noqa: BLE001
            pass
        request.env["doc.object.audit"].log(
            document,
            "assign_policy",
            f"Assigned organizational policy {org_policy.id} to employee {employee.id}",
        )
        return {"success": True, "data": assignment.serialize_for_api()}

    @http.route(
        "/api/organizational/employee-policies",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def employee_policies(self, employee_id=None, **kwargs):
        employee = request.env["hr.employee"].browse(int(employee_id or 0)).exists()
        if not employee:
            return {"success": False, "message": "Employee not found."}
        assignments = request.env["doc.policy.employee.assignment"].search(
            [("employee_id", "=", employee.id)]
        )
        return {
            "success": True,
            "data": {"items": [item.serialize_for_api() for item in assignments]},
        }

    @http.route(
        "/api/organizational/object-audit",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def object_audit(self, res_model=None, res_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_access_org_library(request.env.user):
            return {"success": False, "message": "You do not have permission to view audit history."}
        rows = request.env["doc.object.audit"].search(
            [("res_model", "=", res_model), ("res_id", "=", int(res_id or 0))],
            limit=50,
        )
        return {"success": True, "data": {"items": [row.serialize_for_api() for row in rows]}}

    @http.route(
        "/api/organizational/restore-version",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def restore_version(self, version_id=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to restore versions."}
        version = request.env["doc.document.version"].browse(int(version_id or 0)).exists()
        if not version:
            return {"success": False, "message": "Version not found."}
        document = version.document_id
        if document.folder_id.folder_type != "organizational":
            return {"success": False, "message": "Version not found."}
        try:
            document.folder_id.assert_unlocked()
            version.action_restore_as_new_version()
        except UserError as error:
            return {"success": False, "message": error.args[0]}
        return {"success": True, "data": document.serialize_for_api(request.env.user)}

# -*- coding: utf-8 -*-
import json

from odoo import fields, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from odoo.addons.cleon_document_management.controllers.access import user_is_document_admin
from odoo.addons.cleon_document_management.models import organizational_openrouter


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
        document.write(values)
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
        policies = request.env["doc.compliance.policy"].search(
            [("active", "=", True), ("lifecycle_status", "in", ["active", False])]
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
                        "lifecycle_status": policy.lifecycle_status or "active",
                        "category": policy.policy_category or "",
                    }
                    for policy in policies
                    if (policy.lifecycle_status or "active") == "active"
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
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user):
            return {"success": False, "message": "You do not have permission to import a policy."}
        document = self._org_document(document_id)
        if not document:
            return {"success": False, "message": "Document not found."}
        document.write({"is_policy": True})
        policy_type = request.env["doc.compliance.policy.type"].search([], limit=1)
        if not policy_type:
            return {"success": False, "message": "No policy type is configured."}
        policy = request.env["doc.compliance.policy"].create(
            {
                "name": document.name,
                "policy_type_id": policy_type.id,
                "document_type_ids": [(6, 0, document.document_type_id.ids)],
                "applies_to": "all",
                "source_document_id": document.id,
                "lifecycle_status": "active",
                "description": document.description or "",
            }
        )
        document.write({"linked_policy_id": policy.id})
        request.env["doc.object.audit"].log(document, "import_policy", f"Imported as policy {policy.id}")
        return {
            "success": True,
            "data": {"policy_id": policy.id, "document": document.serialize_for_api(request.env.user)},
        }

    @http.route(
        "/api/organizational/ai-policy-draft",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ai_policy_draft(self, name=None, **kwargs):
        perm = self._perm()
        if not perm.user_can_manage_org_document(request.env.user) and not user_is_document_admin(
            request.env.user
        ):
            return {"success": False, "message": "You do not have permission to draft a policy."}
        title = (name or "").strip()
        if not title:
            return {"success": False, "message": "Enter a policy name."}
        brief = (kwargs.get("description") or "").strip()
        try:
            description = organizational_openrouter.draft_policy_description(
                request.env, title, brief
            )
        except (RuntimeError, ValueError) as error:
            return {"success": False, "message": str(error)}
        PolicyType = request.env["doc.compliance.policy.type"]
        DocumentType = request.env["doc.document.type"]
        policy_type = PolicyType.browse(int(kwargs.get("policy_type_id") or 0)).exists()
        if not policy_type:
            policy_type = PolicyType.search([], limit=1)
        document_types = DocumentType.browse(_as_int_ids(kwargs.get("document_type_ids"))).exists()
        if not document_types:
            document_types = DocumentType.browse(
                _as_int_ids(kwargs.get("document_type_id"))
            ).exists()
        if not document_types:
            document_types = DocumentType.search([], limit=1)
        if not policy_type or not document_types:
            return {"success": False, "message": "Policy types are not configured."}
        try:
            policy = (
                request.env["doc.compliance.policy"]
                .sudo()
                .with_context(skip_policy_admin_check=True)
                .create(
                    {
                        "name": title,
                        "policy_type_id": policy_type.id,
                        "document_type_ids": [fields.Command.set(document_types.ids)],
                        "applies_to": "all",
                        "description": description,
                        "lifecycle_status": "draft",
                        "active": False,
                        "ai_drafted": True,
                        "schedule": False,
                    }
                )
            )
        except (AccessError, ValidationError, UserError) as error:
            return {"success": False, "message": error.args[0]}
        return {
            "success": True,
            "data": {
                "policy_id": policy.id,
                "name": policy.name,
                "description": description,
            },
        }

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
        policy = request.env["doc.compliance.policy"].browse(int(policy_id or 0)).exists()
        employee = request.env["hr.employee"].browse(int(employee_id or 0)).exists()
        if not policy or not employee:
            return {"success": False, "message": "Policy or employee not found."}
        if (policy.lifecycle_status or "active") != "active" or not policy.active:
            return {"success": False, "message": "Only active policies can be assigned."}
        assignment = request.env["doc.policy.employee.assignment"].create(
            {
                "policy_id": policy.id,
                "employee_id": employee.id,
                "document_id": policy.source_document_id.id or False,
                "requested_signature": bool(kwargs.get("requested_signature")),
            }
        )
        try:
            assignment.action_notify()
        except Exception:  # noqa: BLE001
            pass
        request.env["doc.object.audit"].log(
            policy.source_document_id or policy,
            "assign_policy",
            f"Assigned to employee {employee.id}",
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

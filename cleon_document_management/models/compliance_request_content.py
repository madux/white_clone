# -*- coding: utf-8 -*-
"""Compliance request: linkable org content search and audience coverage."""

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class DocDocumentComplianceLink(models.Model):
    _inherit = "doc.document"

    _COMPLIANCE_LINK_EXCLUDED_SCOPES = frozenset(
        {"private", "admin_only", "company_owned"}
    )

    def _compliance_effective_access_scope(self):
        self.ensure_one()
        folder = self.folder_id
        if self.org_use_folder_access or not self.org_access_scope:
            return folder.access_scope or "all_staff"
        return self.org_access_scope

    def _compliance_request_link_excluded(self):
        """True when this document must not be linked to a compliance request task."""
        self.ensure_one()
        document = self.sudo()
        if not document._is_organizational_library_document():
            return True
        folder = document.folder_id
        if not folder.active or folder.deleted_at:
            return True
        if not document.active or document.deleted_at:
            return True
        if document.state == "draft" or document.distribution_status != "active":
            return True
        if (document.policy_visibility or "employees") == "hr_only":
            return True
        if (folder.folder_kind or "folder") == "policy":
            org_policy = self.env["doc.organizational.policy"].for_folder(folder)
            if org_policy:
                if not org_policy.active or org_policy.lifecycle_status != "active":
                    return True
                if org_policy.policy_visibility == "hr_only":
                    return True
        scope = document._compliance_effective_access_scope()
        if scope in self._COMPLIANCE_LINK_EXCLUDED_SCOPES:
            return True
        return False

    def _compliance_assignment_grants_access(self, user):
        self.ensure_one()
        employee = user.employee_id
        if not employee:
            return False
        Assignment = self.env["doc.policy.employee.assignment"].sudo()
        return bool(
            Assignment.search_count(
                [
                    ("employee_id", "=", employee.id),
                    ("compliance_cycle_id.state", "=", "open"),
                    ("document_id", "=", self.id),
                ],
                limit=1,
            )
        )


class CompliancePolicyLinkableContent(models.Model):
    _inherit = "doc.compliance.policy"

    @api.model
    def _policy_for_linkable_audience(self, policy_id=None, audience_payload=None):
        Policy = self.env["doc.compliance.policy"]
        if policy_id:
            policy = Policy.browse(int(policy_id)).exists()
            if not policy:
                raise ValidationError(_("Compliance policy not found."))
            return policy
        payload = audience_payload or {}
        department_ids = payload.get("department_ids") or []
        grade_ids = payload.get("grade_ids") or []
        employee_ids = payload.get("employee_ids") or []
        work_location_ids = payload.get("work_location_ids") or []
        employment_type_ids = payload.get("employment_type_ids") or []
        branch_ids = payload.get("branch_ids") or []
        return Policy.new(
            {
                "applies_to": payload.get("applies_to") or "all",
                "department_ids": [(6, 0, list(department_ids))],
                "grade_ids": [(6, 0, list(grade_ids))],
                "employee_ids": [(6, 0, list(employee_ids))],
                "work_location_ids": [(6, 0, list(work_location_ids))],
                "employment_type_ids": [(6, 0, list(employment_type_ids))],
                "branch_ids": [(6, 0, list(branch_ids))],
            }
        )

    def _compliance_audience_employees(self):
        self.ensure_one()
        return self._target_employees().filtered(
            lambda employee: self._applies_to_employee(employee)
        )

    def _document_covers_compliance_audience(self, document):
        self.ensure_one()
        document = document.sudo().exists()
        if not document:
            return False
        employees = self._compliance_audience_employees()
        if not employees:
            return True
        for employee in employees:
            user = employee.user_id
            if not user:
                return False
            if not document._organizational_user_can_access(user):
                return False
        return True

    def _org_policy_covers_compliance_audience(self, org_policy):
        self.ensure_one()
        org_policy = org_policy.sudo().exists()
        if not org_policy:
            return False
        document = org_policy.assignable_document()
        if not document:
            return False
        return self._document_covers_compliance_audience(document)

    def validate_compliance_request_link(
        self, org_policy=None, document=None, user=None
    ):
        """Raise ValidationError when link is invalid for this policy audience."""
        self.ensure_one()
        user = user or self.env.user
        if org_policy:
            org_policy = org_policy.sudo().exists()
        else:
            org_policy = self.env["doc.organizational.policy"]
        if document:
            document = document.sudo().exists()
        else:
            document = self.env["doc.document"]
        if org_policy and document:
            raise ValidationError(
                _("Link organizational content using either a policy or a document, not both.")
            )
        if not org_policy and not document:
            raise ValidationError(_("Select organizational content for this task."))
        if org_policy:
            if not org_policy.user_can_view(user):
                raise ValidationError(_("You cannot use this organizational policy."))
            if org_policy.lifecycle_status != "active" or not org_policy.active:
                raise ValidationError(_("Only active organizational policies can be linked."))
            document = org_policy.assignable_document()
            if not document:
                raise ValidationError(
                    _("This organizational policy has no active document to link.")
                )
        if document._compliance_request_link_excluded():
            raise ValidationError(
                _("This document cannot be used for compliance request tasks.")
            )
        if not document._organizational_user_can_access(user):
            raise ValidationError(_("You do not have access to this document."))
        if not self._document_covers_compliance_audience(document):
            raise ValidationError(
                _(
                    "This content does not cover everyone in the policy audience. "
                    "Adjust document access or narrow Applies to."
                )
            )

    def _resolve_task_definition_document(self, definition):
        self.ensure_one()
        if definition.linked_document_id:
            return definition.linked_document_id
        if definition.linked_org_policy_id:
            return definition.linked_org_policy_id.assignable_document()
        return self.env["doc.document"]

    def search_compliance_linkable_content(self, search="", user=None, limit=50):
        """Org policies and documents eligible for compliance request task linking."""
        self.ensure_one()
        user = user or self.env.user
        perm = self.env["doc.organizational.files.permission"]
        if not perm.user_can_access_org_library(user):
            return []
        query = (search or "").strip()
        limit = max(1, min(int(limit or 50), 200))
        items = []
        OrgPolicy = self.env["doc.organizational.policy"]
        domain = [
            ("active", "=", True),
            ("lifecycle_status", "=", "active"),
            ("policy_visibility", "=", "employees"),
        ]
        if query:
            domain.extend(
                [
                    "|",
                    ("name", "ilike", query),
                    ("category", "ilike", query),
                ]
            )
        seen_doc_ids = set()
        for org_policy in OrgPolicy.search(domain, order="name", limit=limit * 2):
            folder = org_policy.folder_id
            if not folder.active or folder.deleted_at:
                continue
            if (folder.folder_kind or "folder") != "policy":
                continue
            if not org_policy.user_can_view(user):
                continue
            document = org_policy.assignable_document()
            if not document or document._compliance_request_link_excluded():
                continue
            if not self._org_policy_covers_compliance_audience(org_policy):
                continue
            seen_doc_ids.add(document.id)
            items.append(
                {
                    "kind": "org_policy",
                    "id": org_policy.id,
                    "name": org_policy.name,
                    "document_id": document.id,
                    "folder_id": folder.id,
                    "folder_name": folder.folder_name or folder.name,
                    "access_summary": document._organizational_access_summary(),
                }
            )
        Document = self.env["doc.document"]
        doc_domain = [
            ("folder_id.folder_type", "=", "organizational"),
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("folder_id.active", "=", True),
            ("folder_id.deleted_at", "=", False),
            ("state", "!=", "draft"),
            ("distribution_status", "=", "active"),
        ]
        if query:
            doc_domain.append(("name", "ilike", query))
        documents = Document.search(doc_domain, order="name", limit=limit * 3)
        documents = documents.filter_for_organizational_access(user)
        for document in documents:
            if document.id in seen_doc_ids:
                continue
            if document._compliance_request_link_excluded():
                continue
            if not self._document_covers_compliance_audience(document):
                continue
            folder = document.folder_id
            items.append(
                {
                    "kind": "document",
                    "id": document.id,
                    "name": document.name,
                    "document_id": document.id,
                    "folder_id": folder.id,
                    "folder_name": folder.folder_name or folder.name,
                    "access_summary": document._organizational_access_summary(),
                }
            )
            if len(items) >= limit:
                break
        items.sort(key=lambda row: (row.get("name") or "").lower())
        return items[:limit]

    def _grant_compliance_content_access_for_cycle(self, cycle, employee):
        self.ensure_one()
        Assignment = self.env["doc.policy.employee.assignment"].sudo()
        for definition in self.request_task_definition_ids:
            if definition.task_type not in ("read", "acknowledge"):
                continue
            document = self._resolve_task_definition_document(definition)
            if not document:
                continue
            user = employee.user_id
            if user and document._organizational_user_can_access(user):
                continue
            Assignment.create_compliance_content_assignment(
                cycle=cycle,
                employee=employee,
                compliance_policy=self,
                org_policy=definition.linked_org_policy_id,
                document=document,
            )

    def _revoke_compliance_content_assignments(self, cycle):
        self.ensure_one()
        Assignment = self.env["doc.policy.employee.assignment"].sudo()
        assignments = Assignment.search([("compliance_cycle_id", "=", cycle.id)])
        for assignment in assignments:
            document = assignment.document_id
            assignment.unlink()
            if document:
                self.env["doc.object.audit"].sudo().log(
                    document,
                    "compliance_share_revoke",
                    _("Revoked compliance content access for cycle %s") % cycle.id,
                )

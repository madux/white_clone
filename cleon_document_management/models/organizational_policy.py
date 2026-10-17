# -*- coding: utf-8 -*-
import re

from odoo import api, fields, models
from odoo.exceptions import ValidationError
from odoo.tools.translate import _


class DocOrganizationalPolicy(models.Model):
    _name = "doc.organizational.policy"
    _description = "Organizational policy registry"
    _order = "write_date desc, id desc"

    name = fields.Char(required=True, index=True)
    folder_id = fields.Many2one(
        "doc.folder",
        string="Policy folder",
        required=True,
        ondelete="cascade",
        index=True,
    )
    document_id = fields.Many2one(
        "doc.document",
        string="Primary document",
        ondelete="restrict",
        index=True,
    )
    category = fields.Char(string="Category")
    category_id = fields.Many2one(
        "doc.document.category",
        string="Document category",
        ondelete="set null",
        index=True,
    )
    policy_code = fields.Char(string="Policy code", copy=False, index=True)
    review_interval_months = fields.Integer(
        string="Review interval (months)",
        default=12,
    )
    description = fields.Text()
    lifecycle_status = fields.Selection(
        [
            ("draft", "Draft"),
            ("active", "Active"),
            ("archived", "Archived"),
        ],
        string="Status",
        default="draft",
        required=True,
        index=True,
    )
    policy_visibility = fields.Selection(
        [
            ("employees", "Visible to Employees"),
            ("hr_only", "HR Only"),
        ],
        default="employees",
        required=True,
    )
    effective_date = fields.Date()
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "document_id_unique",
            "unique(document_id)",
            "Each document can only be registered once as an organizational policy.",
        ),
        (
            "folder_id_unique",
            "unique(folder_id)",
            "Each policy folder can only have one registry entry.",
        ),
    ]

    @api.model
    def _generate_policy_code(self, category=None):
        code = "GEN"
        if category:
            code = (category.code or category.name or "GEN").upper()
            code = re.sub(r"[^A-Z0-9]+", "-", code).strip("-")[:16] or "GEN"
        prefix = f"POL-{code}"
        existing = self.search(
            [("policy_code", "=like", f"{prefix}%")],
            order="policy_code desc",
            limit=1,
        )
        suffix = 1
        if existing and existing.policy_code:
            tail = existing.policy_code.rsplit("-", 1)[-1]
            if tail.isdigit():
                suffix = int(tail) + 1
        return f"{prefix}-{suffix:03d}"

    @api.model_create_multi
    def create(self, vals_list):
        Category = self.env["doc.document.category"]
        for vals in vals_list:
            category = Category.browse(vals.get("category_id")) if vals.get("category_id") else Category
            if vals.get("category_id") and category:
                vals.setdefault("category", category.name)
            if not vals.get("policy_code"):
                vals["policy_code"] = self._generate_policy_code(
                    category if vals.get("category_id") else None
                )
        return super().create(vals_list)

    @api.constrains("folder_id")
    def _check_policy_folder_kind(self):
        for policy in self:
            folder = policy.folder_id
            if folder.folder_type != "organizational" or folder.folder_kind != "policy":
                raise ValidationError(
                    _("Organizational policies must use a policy folder.")
                )

    @api.model
    def _normalize_name(self, name):
        cleaned = (name or "").strip().lower()
        return re.sub(r"\s+", " ", cleaned)

    @api.model
    def find_duplicate_by_name(self, name, company=None):
        company = company or self.env.company
        normalized = self._normalize_name(name)
        if not normalized:
            return self.browse()
        candidates = self.search(
            [
                ("company_id", "=", company.id),
                ("lifecycle_status", "in", ["draft", "active"]),
                ("active", "=", True),
            ]
        )
        return candidates.filtered(
            lambda row: self._normalize_name(row.name) == normalized
            and self._counts_as_active_duplicate(row)
        )[:1]

    @api.model
    def _counts_as_active_duplicate(self, policy):
        if not policy.active:
            return False
        if policy.lifecycle_status not in ("draft", "active"):
            return False
        folder = policy.folder_id
        if not folder or not folder.active or folder.deleted_at:
            return False
        return True

    @api.model
    def archive_for_recycled_folders(self, folders):
        policies = self.with_context(active_test=False).search(
            [("folder_id", "in", folders.ids)]
        )
        if policies:
            policies.write({"active": False, "lifecycle_status": "archived"})

    @api.model
    def restore_for_recycled_folders(self, folders):
        policies = self.with_context(active_test=False).search(
            [("folder_id", "in", folders.ids)]
        )
        if policies:
            policies.write({"active": True, "lifecycle_status": "draft"})

    @api.model
    def registered_primary_document_ids(self):
        """Primary documents tied to active registry rows (exclude recycled/archived)."""
        doc_ids = []
        for policy in self.with_context(active_test=False).search(
            [("document_id", "!=", False)]
        ):
            if self._counts_as_active_duplicate(policy):
                doc_ids.append(policy.document_id.id)
        return doc_ids

    @api.model
    def policy_blocks_document_adoption(self, document):
        if not document:
            return False
        policy = self.with_context(active_test=False).search(
            [("document_id", "=", document.id)],
            limit=1,
        )
        return bool(policy) and self._counts_as_active_duplicate(policy)

    @api.model
    def unlink_for_folders(self, folders):
        if not folders:
            return
        policies = self.sudo().with_context(active_test=False).search(
            [("folder_id", "in", folders.ids)]
        )
        if policies:
            policies.unlink()

    @api.model
    def clear_primary_document_references(self, documents):
        """Drop policy registry pointers before permanently deleting documents."""
        if not documents:
            return
        policies = self.sudo().with_context(active_test=False).search(
            [("document_id", "in", documents.ids)]
        )
        if policies:
            policies.write({"document_id": False})

    @api.model
    def for_folder(self, folder):
        if not folder or folder.folder_kind != "policy":
            return self.browse()
        return self.search([("folder_id", "=", folder.id)], limit=1)

    @api.model
    def apply_folder_document_defaults(self, folder, vals):
        """Mark new uploads/links in a policy folder as policy documents."""
        if not folder or folder.folder_kind != "policy":
            return
        policy = self.for_folder(folder)
        vals["is_policy"] = True
        if policy:
            vals.setdefault("policy_visibility", policy.policy_visibility)

    @api.model
    def register_primary_document_if_empty(self, folder, document):
        policy = self.for_folder(folder)
        if policy and document and not policy.document_id:
            policy.write({"document_id": document.id})

    def assignable_document(self):
        """Primary or first policy-classified document in this policy folder."""
        self.ensure_one()
        Document = self.env["doc.document"]
        primary = self.document_id
        if primary and primary._assignable_as_employee_policy():
            return primary
        return Document.search(
            [
                ("folder_id", "=", self.folder_id.id),
                ("is_policy", "=", True),
                ("active", "=", True),
                ("is_shortcut", "=", False),
                ("is_template", "=", False),
            ],
            order="id",
            limit=1,
        )

    def user_can_manage_lifecycle(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return self.env["doc.organizational.files.permission"].user_can_manage_org_policy_lifecycle(
            user
        )

    def user_can_view(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        perm = self.env["doc.organizational.files.permission"]
        if self.lifecycle_status == "draft" and not perm.user_can_manage_org_policy_lifecycle(
            user
        ):
            return False
        if self.policy_visibility == "hr_only" and not perm.user_can_view_hr_only_org_policy(
            user
        ):
            return False
        folder = self.folder_id
        if not folder.active or folder.deleted_at:
            return False
        if (folder.folder_kind or "folder") != "policy":
            return False
        document = self.document_id
        if document:
            return document._organizational_user_can_access(user)
        return folder._user_can_access(user)

    def write(self, vals):
        result = super().write(vals)
        if {"lifecycle_status", "active"} & set(vals):
            self._sync_folder_documents_for_lifecycle()
        return result

    def _sync_folder_documents_for_lifecycle(self):
        Document = self.env["doc.document"]
        for policy in self:
            folder = policy.folder_id
            if not folder:
                continue
            documents = Document.search([("folder_id", "=", folder.id)])
            if not documents:
                continue
            if policy.active and policy.lifecycle_status == "active":
                continue
            documents._demote_to_policy_folder_draft()

    def serialize_for_api(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        document = self.document_id
        folder = self.folder_id
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category or "",
            "category_id": self.category_id.id or False,
            "category_code": self.category_id.code if self.category_id else "",
            "policy_code": self.policy_code or "",
            "review_interval_months": self.review_interval_months or 12,
            "description": self.description or "",
            "lifecycle_status": self.lifecycle_status,
            "policy_visibility": self.policy_visibility,
            "effective_date": (
                fields.Date.to_string(self.effective_date)
                if self.effective_date
                else False
            ),
            "folder_id": folder.id,
            "folder_name": folder.folder_name,
            "document_id": document.id or False,
            "document_name": document.name if document else "",
            "updated_at": fields.Datetime.to_string(self.write_date),
        }


class DocOrganizationalPolicyComplianceReopen(models.Model):
    _inherit = "doc.organizational.policy"

    def write(self, vals):
        res = super().write(vals)
        if not {"document_id", "lifecycle_status", "active"} & set(vals.keys()):
            return res
        policies = self.env["doc.compliance.policy"].search(
            [
                ("policy_type_id.code", "=", "compliance_request"),
                ("reopen_on_content_change", "=", True),
                ("active", "=", True),
            ]
        )
        for org_policy in self:
            for compliance_policy in policies:
                compliance_policy.reopen_tasks_for_content(org_policy=org_policy)
        return res

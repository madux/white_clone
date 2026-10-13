# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


APPROVER_MODES = [
    ("line_manager", "Line manager"),
    ("folder_owner", "Folder owner"),
    ("role", "Role"),
    ("specific_users", "Specific people"),
]

FALLBACK_MODES = [
    ("default_hr_admin", "HR Admin (default)"),
    ("role", "Role"),
    ("specific_users", "Specific people"),
]


class DocApprovalWorkflowService(models.AbstractModel):
    _name = "doc.approval.workflow.service"
    _description = "Global approval workflow (Settings → Approval Workflow)"

    @api.model
    def _company_config(self):
        return self.env["doc.employee.files.config"].get_for_company()

    @api.model
    def is_enabled(self):
        config = self._company_config()
        if config.approval_workflow_enabled:
            return True
        return (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("cleon_document_management.approval_workflow_enabled", "0")
            == "1"
        )

    @api.model
    def _sync_legacy_enabled_param(self, enabled):
        self.env["ir.config_parameter"].sudo().set_param(
            "cleon_document_management.approval_workflow_enabled",
            "1" if enabled else "0",
        )
        self.env["ir.config_parameter"].sudo().set_param(
            "cleon_document_management.default_require_upload_approval",
            "1" if enabled else "0",
        )

    @api.model
    def add_working_days(self, start_dt, days):
        """Count organisation working days from start (exclusive)."""
        return self.env["doc.dms.working.calendar.service"].add_working_days(
            start_dt,
            days,
            self.env.company,
        )

    @api.model
    def _hr_admin_users(self, company):
        Role = self.env["doc.employee.files.role"].sudo().with_company(company)
        hr_admin = Role.search(
            [
                ("company_id", "=", company.id),
                ("role_template_key", "=", "hr_admin"),
                ("active", "=", True),
            ],
            limit=1,
        )
        if hr_admin and hr_admin.user_ids:
            return hr_admin.user_ids
        admins = self.env.ref(
            "cleon_document_management.group_document_admin", raise_if_not_found=False
        )
        if admins:
            return admins.users.filtered(lambda user: user.active)
        return self.env["res.users"]

    @api.model
    def _users_for_role(self, role, company):
        if not role:
            return self.env["res.users"]
        role = role.sudo().with_company(company)
        return role.user_ids.filtered(lambda user: user.active)

    @api.model
    def _line_manager_user(self, requester, folder=None, document=None):
        employee = requester.employee_id
        if document and document.employee_id:
            employee = document.employee_id
        if employee and employee.parent_id and employee.parent_id.user_id:
            return employee.parent_id.user_id
        if folder and folder.folder_type == "employee" and folder.employee_id:
            emp = folder.employee_id
            if emp.parent_id and emp.parent_id.user_id:
                return emp.parent_id.user_id
        return self.env["res.users"]

    @api.model
    def _resolve_users_from_rule(
        self,
        mode,
        role,
        user_ids,
        requester,
        folder=None,
        document=None,
        company=None,
    ):
        company = company or self.env.company
        Users = self.env["res.users"]
        if mode == "line_manager":
            mgr = self._line_manager_user(requester, folder=folder, document=document)
            return mgr if mgr else Users
        if mode == "folder_owner":
            owner = folder.owner_id if folder and folder.owner_id else Users
            return owner if owner else Users
        if mode == "role":
            return self._users_for_role(role, company)
        if mode == "specific_users":
            return Users.browse(user_ids or []).exists().filtered(lambda user: user.active)
        return Users

    @api.model
    def _matching_exception(self, folder=None, category=None):
        Exception = self.env["doc.approval.workflow.exception"].sudo()
        company = self.env.company
        if folder:
            current = folder
            while current:
                match = Exception.search(
                    [
                        ("company_id", "=", company.id),
                        ("active", "=", True),
                        ("scope", "=", "folder"),
                        ("folder_id", "=", current.id),
                    ],
                    limit=1,
                )
                if match:
                    return match
                current = current.parent_id
        if category:
            match = Exception.search(
                [
                    ("company_id", "=", company.id),
                    ("active", "=", True),
                    ("scope", "=", "category"),
                    ("category_id", "=", category.id),
                ],
                limit=1,
            )
            if match:
                return match
        return Exception.browse()

    @api.model
    def resolve_approver_users(
        self,
        requester,
        folder=None,
        document=None,
        category=None,
    ):
        """Return active users who may approve (requester excluded)."""
        config = self._company_config()
        company = config.company_id
        exception = self._matching_exception(folder=folder, category=category)
        if exception:
            users = self._resolve_users_from_rule(
                exception.approver_mode,
                exception.role_id,
                exception.approver_user_ids.ids,
                requester,
                folder=folder,
                document=document,
                company=company,
            )
        else:
            users = self._resolve_users_from_rule(
                config.approval_default_approver_mode,
                config.approval_default_role_id,
                config.approval_default_user_ids.ids,
                requester,
                folder=folder,
                document=document,
                company=company,
            )
        return users.filtered(lambda user: user.id != requester.id and user.active)

    @api.model
    def resolve_fallback_users(self, requester):
        config = self._company_config()
        company = config.company_id
        mode = config.approval_fallback_mode or "default_hr_admin"
        if mode == "default_hr_admin":
            users = self._hr_admin_users(company)
        elif mode == "role":
            users = self._users_for_role(config.approval_fallback_role_id, company)
        else:
            users = config.approval_fallback_user_ids
        return users.filtered(lambda user: user.id != requester.id and user.active)

    @api.model
    def respond_working_days(self):
        config = self._company_config()
        return max(1, min(int(config.approval_respond_working_days or 2), 10))

    @api.model
    def get_upload_approval_config(self):
        """Employee upload path when global workflow is enabled."""
        users = self.env["res.users"]
        if not self.is_enabled():
            return {
                "require_upload_approval": False,
                "approval_flow": "any",
                "approvers": users,
            }
        return {
            "require_upload_approval": True,
            "approval_flow": "any",
            "approvers": users,
        }

    @api.model
    def get_upload_approvers_for_document(self, document, requester):
        if not self.is_enabled():
            return self.env["res.users"]
        folder = document.folder_id
        category = (
            document.document_type_id.category_id
            if document.document_type_id
            else False
        )
        approvers = self.resolve_approver_users(
            requester,
            folder=folder,
            document=document,
            category=category,
        )
        return approvers

    @api.model
    def _migrate_legacy_params_into_config(self):
        config = self._company_config()
        params = self.env["ir.config_parameter"].sudo()
        updates = {}
        if params.get_param("cleon_document_management.approval_workflow_enabled", "0") == "1":
            if not config.approval_workflow_enabled:
                updates["approval_workflow_enabled"] = True
        raw = params.get_param("cleon_document_management.default_approver_ids", "")
        legacy_ids = [int(value) for value in raw.split(",") if value.isdigit()]
        if legacy_ids and not config.approval_default_user_ids:
            updates["approval_default_approver_mode"] = "specific_users"
            updates["approval_default_user_ids"] = [(6, 0, legacy_ids)]
        if updates:
            config.sudo().write(updates)

    @api.model
    def settings_payload(self):
        self._migrate_legacy_params_into_config()
        config = self._company_config()
        company = config.company_id
        Exception = self.env["doc.approval.workflow.exception"].sudo()
        exceptions = Exception.search(
            [("company_id", "=", company.id), ("active", "=", True)],
            order="id",
        )
        Role = self.env["doc.employee.files.role"].sudo().with_company(company)
        roles = Role.search(
            [("active", "=", True), ("company_id", "=", company.id)],
            order="name, id",
        )
        folders = self.env["doc.folder"].sudo().search(
            [
                ("folder_type", "=", "organizational"),
                ("active", "=", True),
                ("is_employee_file_v3", "=", False),
                ("legacy_employee_folder", "=", False),
            ],
            order="folder_name",
            limit=300,
        )
        self.env["doc.document.catalog.service"].ensure_default_catalog(company)
        categories = self.env["doc.document.category"].sudo().search(
            [("active", "=", True), ("company_id", "=", company.id)],
            order="sequence, name",
        )
        users = self.env["res.users"].sudo().search(
            [("share", "=", False), ("active", "=", True)],
            order="name",
            limit=500,
        )
        return {
            "require_approval": bool(config.approval_workflow_enabled),
            "default_approver_mode": config.approval_default_approver_mode
            or "line_manager",
            "default_role_id": config.approval_default_role_id.id or False,
            "default_user_ids": config.approval_default_user_ids.ids,
            "respond_working_days": self.respond_working_days(),
            "fallback_mode": config.approval_fallback_mode or "default_hr_admin",
            "fallback_role_id": config.approval_fallback_role_id.id or False,
            "fallback_user_ids": config.approval_fallback_user_ids.ids,
            "exceptions": [item.serialize_for_api() for item in exceptions],
            "options": {
                "roles": [
                    {"id": role.id, "name": role.name} for role in roles
                ],
                "users": [
                    {
                        "id": user.id,
                        "name": user.name,
                        "email": user.email or user.login,
                    }
                    for user in users
                ],
                "folders": [
                    {
                        "id": folder.id,
                        "name": folder.folder_name,
                        "path": folder.folder_name,
                    }
                    for folder in folders
                ],
                "categories": [
                    {"id": cat.id, "name": cat.name} for cat in categories
                ],
            },
        }

    @api.model
    def save_settings(self, payload):
        if not self.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            return {"success": False, "message": _("Access denied.")}
        config = self._company_config().sudo()
        require = bool(payload.get("require_approval"))
        days = int(payload.get("respond_working_days") or 2)
        days = max(1, min(days, 10))
        mode = payload.get("default_approver_mode") or "line_manager"
        if require and mode == "role" and not payload.get("default_role_id"):
            return {
                "success": False,
                "message": _("Select a role for “Who approves?”."),
            }
        if require and mode == "specific_users" and not (
            payload.get("default_user_ids") or []
        ):
            return {
                "success": False,
                "message": _("Select at least one person for “Who approves?”."),
            }
        fallback_mode = payload.get("fallback_mode") or "default_hr_admin"
        if fallback_mode == "role" and not payload.get("fallback_role_id"):
            return {
                "success": False,
                "message": _("Select a fallback role or choose HR Admin default."),
            }
        if fallback_mode == "specific_users" and not (
            payload.get("fallback_user_ids") or []
        ):
            return {
                "success": False,
                "message": _("Select fallback people or choose HR Admin default."),
            }

        emitter = self.env.get("doc.audit.emitter.service")
        track_fields = [
            "approval_workflow_enabled",
            "approval_default_approver_mode",
            "approval_default_role_id",
            "approval_respond_working_days",
            "approval_fallback_mode",
            "approval_fallback_role_id",
            "org_approval_sla_hours",
        ]
        before = (
            emitter.snapshot_record(config, track_fields) if emitter else {}
        )
        config.write(
            {
                "approval_workflow_enabled": require,
                "approval_default_approver_mode": mode,
                "approval_default_role_id": int(payload.get("default_role_id") or 0)
                or False,
                "approval_default_user_ids": [
                    (6, 0, [int(value) for value in payload.get("default_user_ids") or []])
                ],
                "approval_respond_working_days": days,
                "approval_fallback_mode": fallback_mode,
                "approval_fallback_role_id": int(payload.get("fallback_role_id") or 0)
                or False,
                "approval_fallback_user_ids": [
                    (6, 0, [int(value) for value in payload.get("fallback_user_ids") or []])
                ],
                "org_approval_sla_hours": days * 24,
            }
        )
        self._sync_legacy_enabled_param(require)
        if require:
            self.env["doc.approval.workflow.migration"].clear_type_level_approval_config(
                deactivate_exceptions=False
            )
        if emitter:
            after = emitter.snapshot_record(config, track_fields)
            changes = emitter.diff_dict(before, after, track_fields)
            emitter.log_settings_changes(
                config,
                _("Approval Workflow"),
                _("Settings → Approval Workflow"),
                changes,
            )

        company = config.company_id
        Exception = self.env["doc.approval.workflow.exception"].sudo()
        Exception.search([("company_id", "=", company.id)]).unlink()
        for index, row in enumerate(payload.get("exceptions") or []):
            scope = row.get("scope")
            if scope not in ("folder", "category"):
                continue
            folder_id = int(row.get("folder_id") or 0) or False
            category_id = int(row.get("category_id") or 0) or False
            if scope == "folder" and not folder_id:
                continue
            if scope == "category" and not category_id:
                continue
            approver_mode = row.get("approver_mode") or "folder_owner"
            role_id = int(row.get("role_id") or 0) or False
            user_ids = [int(value) for value in row.get("user_ids") or []]
            if approver_mode == "role" and not role_id:
                continue
            if approver_mode == "specific_users" and not user_ids:
                continue
            dup_domain = [
                ("company_id", "=", company.id),
                ("scope", "=", scope),
            ]
            if scope == "folder":
                dup_domain.append(("folder_id", "=", folder_id))
            else:
                dup_domain.append(("category_id", "=", category_id))
            if Exception.search(dup_domain, limit=1):
                continue
            Exception.create(
                {
                    "name": row.get("name")
                    or _("Exception %(index)s", index=index + 1),
                    "company_id": company.id,
                    "scope": scope,
                    "folder_id": folder_id if scope == "folder" else False,
                    "category_id": category_id if scope == "category" else False,
                    "approver_mode": approver_mode,
                    "role_id": role_id,
                    "approver_user_ids": [(6, 0, user_ids)],
                    "active": True,
                }
            )
        return {"success": True, "data": self.settings_payload()}

    @api.model
    def approver_label(self, mode, role=None, users=None):
        labels = {
            "line_manager": _("The person's line manager"),
            "folder_owner": _("Folder owner"),
            "role": role.name if role else _("Role"),
            "specific_users": ", ".join(users.mapped("name"))
            if users
            else _("Specific people"),
        }
        return labels.get(mode, mode)


class DocApprovalWorkflowException(models.Model):
    _name = "doc.approval.workflow.exception"
    _description = "Approval workflow exception (folder or category)"

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company, index=True
    )
    scope = fields.Selection(
        [
            ("folder", "Folder"),
            ("category", "Category"),
            ("document_type", "Document type (legacy)"),
        ],
        required=True,
        default="folder",
    )
    folder_id = fields.Many2one("doc.folder", ondelete="cascade", index=True)
    category_id = fields.Many2one("doc.document.category", ondelete="cascade", index=True)
    document_type_id = fields.Many2one(
        "doc.document.type", ondelete="cascade", help="Legacy rows only."
    )
    approver_mode = fields.Selection(
        selection=APPROVER_MODES,
        required=True,
        default="folder_owner",
    )
    role_id = fields.Many2one("doc.employee.files.role", ondelete="set null")
    approver_user_ids = fields.Many2many(
        "res.users",
        "doc_approval_workflow_exception_user_rel",
        "exception_id",
        "user_id",
        string="Approvers",
    )
    # Legacy fields kept for DB compatibility
    require_upload_approval = fields.Boolean(default=True)
    approval_flow = fields.Selection(
        [
            ("any", "Single approver"),
            ("sequential", "Sequential"),
            ("random", "All approvers"),
        ],
        default="any",
    )
    approver_ids = fields.Many2many(
        "res.users",
        "doc_approval_workflow_exception_approver_legacy_rel",
        "exception_id",
        "user_id",
        string="Legacy approvers",
    )
    respond_within_hours = fields.Integer(default=48)

    @api.constrains("scope", "folder_id", "category_id", "company_id")
    def _check_scope_target(self):
        for record in self:
            if record.scope == "folder" and not record.folder_id:
                raise ValidationError(_("Folder exceptions require a folder."))
            if record.scope == "category" and not record.category_id:
                raise ValidationError(_("Category exceptions require a category."))

    def serialize_for_api(self):
        self.ensure_one()
        service = self.env["doc.approval.workflow.service"]
        applies_to = ""
        if self.scope == "folder" and self.folder_id:
            applies_to = _("Folder: %s (and subfolders)") % self.folder_id.folder_name
        elif self.scope == "category" and self.category_id:
            applies_to = _("Category: %s") % self.category_id.name
        who = service.approver_label(
            self.approver_mode,
            role=self.role_id,
            users=self.approver_user_ids,
        )
        return {
            "id": self.id,
            "scope": self.scope,
            "folder_id": self.folder_id.id or False,
            "category_id": self.category_id.id or False,
            "approver_mode": self.approver_mode,
            "role_id": self.role_id.id or False,
            "user_ids": self.approver_user_ids.ids,
            "applies_to_label": applies_to,
            "who_approves_label": who,
        }


class DocApprovalWorkflowMigration(models.AbstractModel):
    _name = "doc.approval.workflow.migration"
    _description = "Migrate legacy per-type approval settings to global workflow"

    @api.model
    def clear_type_level_approval_config(self, deactivate_exceptions=True):
        """Remove per-type approvers; does not change document approval state."""
        types = self.env["doc.document.type"].sudo().search([])
        if types:
            types.write(
                {
                    "require_upload_approval": False,
                    "approval_flow": "any",
                    "approver_ids": [fields.Command.clear()],
                }
            )
        if deactivate_exceptions:
            self.env["doc.approval.workflow.exception"].sudo().search([]).write(
                {"active": False}
            )

    @api.model
    def _merge_legacy_type_approvers_into_settings(self):
        config = self.env["doc.employee.files.config"].get_for_company()
        if config.approval_default_user_ids:
            return
        params = self.env["ir.config_parameter"].sudo()
        raw = params.get_param("cleon_document_management.default_approver_ids", "")
        existing = [int(value) for value in raw.split(",") if value.isdigit()]
        if existing:
            config.sudo().write(
                {
                    "approval_default_approver_mode": "specific_users",
                    "approval_default_user_ids": [(6, 0, existing)],
                }
            )
            return
        legacy_ids = set()
        for document_type in self.env["doc.document.type"].search(
            [("require_upload_approval", "=", True)]
        ):
            legacy_ids.update(document_type.approver_ids.ids)
        if legacy_ids:
            config.sudo().write(
                {
                    "approval_default_approver_mode": "specific_users",
                    "approval_default_user_ids": [(6, 0, sorted(legacy_ids))],
                }
            )

    @api.model
    def migrate_document_types_to_workflow(self):
        Retention = self.env["doc.retention.policy"].sudo()
        config = self.env["doc.employee.files.config"].get_for_company()
        self._merge_legacy_type_approvers_into_settings()
        for document_type in self.env["doc.document.type"].search([]):
            years = document_type.default_retention_years or 0
            if years and not Retention.search(
                [("document_type_id", "=", document_type.id)], limit=1
            ):
                Retention.create(
                    {
                        "name": document_type.name,
                        "document_type_id": document_type.id,
                        "archive_after_value": years,
                        "archive_after_unit": "years",
                        "delete_after_value": years,
                        "delete_after_unit": "years",
                        "clock_start": "upload_date",
                        "retention_value": years,
                        "retention_unit": "years",
                        "active": True,
                    }
                )
        self.clear_type_level_approval_config()
        if not config.approval_workflow_enabled:
            self.env["doc.approval.workflow.service"]._sync_legacy_enabled_param(False)
        return {"type_approval_cleared": True}

import base64
import logging
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.osv import expression

_logger = logging.getLogger(__name__)


class Document(models.Model):
    _name = "doc.document"
    _description = "Employee Document"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "create_date desc"

    name = fields.Char(
        string="Document Name",
        required=True,
    )

    description = fields.Text(string="Description")

    source_url = fields.Char(
        string="Source URL",
        help="External link when this record is a linked file rather than an uploaded attachment.",
    )

    is_policy = fields.Boolean(
        string="Is Policy",
        default=False,
    )

    policy_visibility = fields.Selection(
        [
            ("employees", "Visible to Employees"),
            ("hr_only", "HR Only"),
        ],
        string="Policy Visibility",
        default="employees",
    )

    policy_content = fields.Html(string="Policy Content")

    effective_date = fields.Date(string="Effective Date")

    folder_id = fields.Many2one(
        "doc.folder",
        required=True,
        ondelete="restrict",
    )

    recycle_origin_folder_id = fields.Many2one(
        "doc.folder",
        string="Recycle Origin Folder",
        ondelete="set null",
        help="Employee folder this document belonged to before its folder was moved to the recycle bin.",
    )

    employee_id = fields.Many2one(
        "hr.employee",
        ondelete="restrict",
        string="Employee",
        index=True,
    )

    employee_file_id = fields.Many2one(
        "doc.employee.file",
        string="Employee File",
        ondelete="set null",
        index=True,
    )

    classification_state = fields.Selection(
        [
            ("classified", "Classified"),
            ("pending", "Pending Classification"),
        ],
        default="classified",
    )

    document_type_id = fields.Many2one(
        "doc.document.type",
        required=True,
        ondelete="restrict",
    )

    attachment_id = fields.Many2one(
        "ir.attachment",
        string="File",
        required=True,
        ondelete="restrict",
    )

    uploaded_by = fields.Many2one(
        "res.users",
        string="Uploaded By",
        default=lambda self: self.env.user,
        readonly=True,
    )
    submitted_on_behalf_by = fields.Many2one(
        "res.users",
        string="Submitted on behalf by",
        readonly=True,
        copy=False,
        help="Set when HR uploads a document for an employee.",
    )

    owner_id = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        readonly=True,
    )

    favorite_user_ids = fields.Many2many(
        "res.users",
        "doc_document_favorite_user_rel",
        "document_id",
        "user_id",
        string="Favorite By",
    )

    pinned_user_ids = fields.Many2many(
        "res.users",
        "doc_document_pinned_user_rel",
        "document_id",
        "user_id",
        string="Pinned By",
    )

    allowed_user_ids = fields.Many2many(
        "res.users",
        "doc_document_allowed_user_rel",
        "document_id",
        "user_id",
        string="Allowed Users",
    )

    org_use_folder_access = fields.Boolean(
        string="Use folder access",
        default=True,
        help="When enabled, document visibility follows the parent folder.",
    )
    org_access_scope = fields.Selection(
        [
            ("all_staff", "All Staff"),
            ("department", "By Department"),
            ("grade", "By Grade Level"),
            ("individual", "Individual Employees"),
            ("admin_only", "Admin Only"),
            ("private", "Private (owner and administrators)"),
            ("company_owned", "Company owned"),
        ],
        string="Document access scope",
    )
    org_department_ids = fields.Many2many(
        "hr.department",
        "doc_document_org_department_rel",
        "document_id",
        "department_id",
    )
    org_grade_ids = fields.Many2many(
        "hr.grade",
        "doc_document_org_grade_rel",
        "document_id",
        "grade_id",
    )
    org_employee_ids = fields.Many2many(
        "hr.employee",
        "doc_document_org_employee_rel",
        "document_id",
        "employee_id",
    )
    linked_policy_id = fields.Many2one(
        "doc.compliance.policy",
        string="Linked policy",
        ondelete="set null",
    )
    linked_template_document_id = fields.Many2one(
        "doc.document",
        string="Linked template",
        ondelete="set null",
        domain="[('folder_id.folder_type', '=', 'organizational')]",
    )
    policy_editor_document_id = fields.Many2one(
        "doc.template.document",
        string="Policy editor session",
        ondelete="set null",
        copy=False,
    )
    editor_source = fields.Selection(
        [
            ("none", "None"),
            ("policy_scratch", "Policy scratch"),
        ],
        default="none",
        index=True,
    )
    is_template = fields.Boolean(string="Master template", default=False, index=True)
    is_shortcut = fields.Boolean(string="Shortcut", default=False)
    shortcut_of_id = fields.Many2one(
        "doc.document",
        string="Shortcut of",
        ondelete="cascade",
        index=True,
    )
    link_status = fields.Selection(
        [
            ("none", "Not a link"),
            ("ok", "Reachable"),
            ("broken", "Broken"),
            ("unchecked", "Unchecked"),
        ],
        default="none",
        index=True,
    )
    imported_from = fields.Selection(
        [
            ("native", "Native"),
            ("google_drive", "Google Drive"),
            ("onedrive", "OneDrive"),
            ("sharepoint", "SharePoint"),
            ("dropbox", "Dropbox"),
            ("scan", "Scan"),
        ],
        default="native",
    )

    allowed_group_ids = fields.Many2many(
        "res.groups",
        "doc_document_allowed_group_rel",
        "document_id",
        "group_id",
        string="Allowed Roles",
    )

    has_expiry = fields.Boolean(
        string="Has Expiry Date",
        default=False,
    )

    expiry_date = fields.Date(
        string="Expiry Date",
    )

    issue_date = fields.Date(string="Issue Date")

    pending_attachment_id = fields.Many2one(
        "ir.attachment",
        string="Pending Replacement File",
        ondelete="set null",
        copy=False,
    )
    pending_description = fields.Text(copy=False)
    pending_issue_date = fields.Date(copy=False)
    pending_expiry_date = fields.Date(copy=False)
    pending_has_expiry = fields.Boolean(default=False, copy=False)
    pending_change_note = fields.Char(copy=False)

    expiry_notified = fields.Boolean(
        default=False,
    )

    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("processing", "Processing"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("expired", "Expired"),
        ],
        default="draft",
        required=True,
        tracking=True,
    )

    mime_type = fields.Char(
        related="attachment_id.mimetype",
        store=True,
        readonly=True,
    )

    file_size = fields.Integer(
        related="attachment_id.file_size",
        store=True,
        readonly=True,
    )

    checksum = fields.Char(
        related="attachment_id.checksum",
        store=True,
        readonly=True,
        index=True,
    )

    extracted_text = fields.Text(readonly=True)
    ask_index_stamp = fields.Char(index=True)
    ask_index_state = fields.Selection(
        [
            ("waiting", "Waiting"),
            ("indexing", "Indexing"),
            ("indexed", "Indexed"),
            ("skipped", "No text"),
        ],
        index=True,
    )
    ask_chunk_ids = fields.One2many(
        "doc.intelligence.library.chunk",
        "document_id",
        string="Ask index chunks",
    )
    ocr_state = fields.Selection(
        [
            ("pending", "Pending"),
            ("processing", "Processing"),
            ("completed", "Completed"),
            ("failed", "Failed"),
        ],
        default="pending",
        required=True,
        tracking=True,
    )
    ocr_error = fields.Text(readonly=True)

    processing_status = fields.Selection(
        [
            ("pending_scan", "Pending scan"),
            ("scanning", "Scanning"),
            ("ready", "Ready"),
            ("quarantined", "Quarantined"),
            ("scan_failed", "Scan failed"),
        ],
        default="pending_scan",
        index=True,
    )
    legal_hold_ids = fields.One2many(
        "doc.legal.hold",
        "document_id",
        string="Legal holds",
    )
    legal_hold_active = fields.Boolean(compute="_compute_legal_hold_active")
    retention_review_due = fields.Boolean(default=False, index=True)
    backup_confirmed_at = fields.Datetime(
        string="Retention backup confirmed",
        copy=False,
        help="Set when backup is confirmed so compliance retention can archive or delete.",
    )

    approval_ids = fields.One2many(
        "doc.document.approval",
        "document_id",
        string="Approvals",
    )

    acknowledgement_ids = fields.One2many(
        "doc.document.acknowledgement", "document_id", string="Acknowledgements"
    )

    @api.depends("legal_hold_ids.active", "folder_id")
    def _compute_legal_hold_active(self):
        Hold = self.env["doc.legal.hold"]
        for document in self:
            domain = [
                ("active", "=", True),
                "|",
                ("document_id", "=", document.id),
                ("folder_id", "=", document.folder_id.id),
            ]
            document.legal_hold_active = bool(Hold.search_count(domain))

    version_ids = fields.One2many(
        "doc.document.version",
        "document_id",
        string="Versions",
    )

    approval_state = fields.Selection(
        [
            ("not_required", "Not Required"),
            ("pending", "Pending"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        default="not_required",
        required=True,
    )

    rejection_reason = fields.Text(
        string="Last rejection reason",
        copy=False,
        help="Reason from the most recent review rejection visible to the uploader.",
    )

    last_review_decision = fields.Selection(
        [
            ("approved", "Approved"),
            ("rejected", "Rejected"),
        ],
        copy=False,
    )

    review_decision_unread = fields.Boolean(
        string="Uploader review alert unread",
        default=False,
        copy=False,
    )

    is_locked = fields.Boolean(default=False)
    active = fields.Boolean(default=True)
    distribution_status = fields.Selection(
        [("active", "Active"), ("archived", "Archived"), ("deactivated", "Deactivated")],
        default="active", required=True, index=True,
    )
    deleted_at = fields.Datetime(string="Moved to Recycle Bin", readonly=True, index=True)
    deleted_by = fields.Many2one("res.users", string="Deleted By", readonly=True)
    recycle_bin_until = fields.Datetime(
        string="Recycle Bin Retention Until", readonly=True, index=True
    )

    @api.constrains("has_expiry", "expiry_date")
    def _check_expiry_date(self):
        for document in self:
            if document.has_expiry and not document.expiry_date:
                raise ValidationError(
                    _("An expiry date is required when expiry is enabled.")
                )

    @api.constrains("is_policy", "folder_id")
    def _check_policy_folder(self):
        for document in self:
            if (
                document.is_policy
                and document.folder_id.folder_type != "organizational"
            ):
                raise ValidationError(
                    _("Policy documents must be stored in an organizational folder.")
                )

    @api.constrains("folder_id", "document_type_id")
    def _check_allowed_document_category(self):
        for document in self:
            allowed_categories = document.folder_id.allowed_document_type_ids

            if (
                allowed_categories
                and document.document_type_id not in allowed_categories
            ):
                raise ValidationError(
                    _("This document category is not allowed in the selected folder.")
                )

    def action_toggle_favorite(self):
        for document in self:
            command = (
                fields.Command.unlink(self.env.user.id)
                if self.env.user in document.favorite_user_ids
                else fields.Command.link(self.env.user.id)
            )
            document.write({"favorite_user_ids": [command]})

    def action_toggle_pin(self):
        for document in self:
            command = (
                fields.Command.unlink(self.env.user.id)
                if self.env.user in document.pinned_user_ids
                else fields.Command.link(self.env.user.id)
            )
            document.write({"pinned_user_ids": [command]})

    def _ef_permission(self):
        return self.env["doc.employee.files.permission"]

    def _is_document_manager(self):
        perm = self._ef_permission()
        user = self.env.user
        if perm.user_is_platform_admin(user) or perm.user_has_legacy_manager(user):
            return True
        return perm.user_can_access_ef_home(user)

    def _can_ef_manage_document(self, action_field):
        self.ensure_one()
        perm = self._ef_permission()
        user = self.env.user
        folder = self.folder_id
        if folder.folder_type == "employee" and self.employee_id:
            return perm.user_can_on_document(user, self, action_field)
        return perm.user_is_platform_admin(user) or perm.user_has_legacy_manager(user)

    def _employee_self_service_write_fields(self):
        """Fields a non-manager may update on their own documents."""
        return {"favorite_user_ids", "pinned_user_ids"}

    def _mail_thread_internal_write_fields(self, vals):
        """Mail/activity fields written automatically during create or subscribe."""
        return {
            field_name
            for field_name in vals
            if field_name.startswith("message_") or field_name.startswith("activity_")
        }

    def write(self, vals):
        if self.env.context.get("ask_indexing"):
            return super().write(vals)
        if vals.get("folder_id"):
            destination = self.env["doc.folder"].browse(int(vals["folder_id"])).exists()
            if destination:
                destination.assert_unlocked(for_upload=True)
        if self.env.su:
            result = super().write(vals)
            if "state" in vals and vals["state"] in ("approved", "signed"):
                self.env["doc.compliance.policy"]._evaluate_documents(self)
            return result
        if not self.env.context.get("intelligence_upload") and not self._is_document_manager():
            allowed = self._employee_self_service_write_fields() | self._mail_thread_internal_write_fields(vals)
            if set(vals) - allowed:
                raise AccessError(_("You can only update your document favorites and pins."))
        if not self.env.context.get("skip_policy_folder_activation_guard"):
            activating = (
                vals.get("active") is True
                or vals.get("distribution_status") == "active"
                or vals.get("state") == "approved"
            )
            if activating:
                blocked = self.filtered(
                    lambda document: document._in_policy_folder()
                    and not document._policy_folder_allows_document_activation()
                )
                if blocked:
                    raise UserError(
                        _(
                            "Activate the policy folder before activating documents inside it."
                        )
                    )
        result = super().write(vals)
        drop_keys = {"deleted_at", "active", "distribution_status"}
        if drop_keys & set(vals):
            dead = self.filtered(
                lambda document: document.deleted_at
                or not document.active
                or document.distribution_status != "active"
            )
            dead._drop_ask_index()
            live = (self - dead).filtered(lambda document: document._ask_index_eligible())
            if live:
                live.with_context(ask_indexing=True).write(
                    {"ask_index_stamp": False, "ask_index_state": "waiting"}
                )
        if {"attachment_id", "extracted_text", "checksum"} & set(vals):
            live = self.filtered(lambda document: document._ask_index_eligible())
            live.with_context(ask_indexing=True).write(
                {"ask_index_stamp": False, "ask_index_state": "waiting"}
            )
        if "state" in vals and vals["state"] in ("approved", "signed"):
            Recheck = self.env["doc.compliance.recheck.job"].sudo()
            for document in self:
                if document.employee_id:
                    Recheck.schedule_employee(
                        document.employee_id,
                        reason="document_state_change",
                    )
        if not self.env.context.get("skip_ef_document_reconcile"):
            reconcile_fields = {"employee_id", "employee_file_id", "folder_id", "active"}
            if reconcile_fields.intersection(vals):
                service = self.env["doc.employee.files.service"].sudo()
                for document in self:
                    service.reconcile_document_employee_file(document)
        if not self.env.context.get("skip_document_automation"):
            Automation = self.env["doc.document.automation"]
            if "attachment_id" in vals:
                Automation.search([("document_id", "in", self.ids)]).execute("new_version")
            if "approval_state" in vals and vals["approval_state"] == "approved":
                Automation.search([("document_id", "in", self.ids)]).execute(
                    "document_approved"
                )
            if "approval_state" in vals and vals["approval_state"] == "rejected":
                Automation.search([("document_id", "in", self.ids)]).execute(
                    "document_rejected"
                )
            if {"name", "description", "folder_id"}.intersection(vals):
                Automation.search([("document_id", "in", self.ids)]).execute(
                    "document_updated"
                )
        if "folder_id" in vals:
            self.filtered(lambda document: document._in_policy_folder())._demote_to_policy_folder_draft()
        return result

    def unlink(self):
        if not self.env.context.get("intelligence_upload"):
            for document in self:
                if not document._can_ef_manage_document("action_delete"):
                    raise AccessError(_("You do not have permission to delete this document."))
        for document in self:
            document._check_draft_policy_allows_action("delete")
        self.env["doc.organizational.policy"].clear_primary_document_references(self)
        self.env["doc.quarantine.file"].cleanup_for_documents(self)
        return super().unlink()

    def _retention_clock_start_date(self, clock_start, document_version=None):
        self.ensure_one()
        if clock_start == "document_expiry" and self.expiry_date:
            return self.expiry_date
        if clock_start == "employment_end":
            employee = self.employee_id
            if employee:
                departure = getattr(employee, "departure_date", False)
                if departure:
                    return fields.Date.to_date(departure)
                if not employee.active:
                    write_date = employee.write_date or fields.Datetime.now()
                    return fields.Date.to_date(write_date)
        if document_version and document_version.upload_date:
            return fields.Date.to_date(document_version.upload_date)
        if self.create_date:
            return fields.Date.to_date(self.create_date)
        return fields.Date.context_today(self)

    def action_confirm_retention_backup(self):
        for document in self:
            if not document._can_ef_manage_document("action_archive"):
                raise AccessError(
                    _("You do not have permission to confirm backup for this document.")
                )
        self.write({"backup_confirmed_at": fields.Datetime.now()})

    def action_archive(self):
        for document in self:
            document._check_draft_policy_allows_action("archive")
            if not document._can_ef_manage_document("action_archive"):
                raise AccessError(_("You do not have permission to archive this document."))
        self.write({"active": False, "distribution_status": "archived", "deleted_at": False, "deleted_by": False, "recycle_bin_until": False})

    def _user_owns_document(self):
        self.ensure_one()
        user = self.env.user
        if self.owner_id == user:
            return True
        return bool(self.employee_id and self.employee_id.user_id == user)

    def action_restore(self):
        for document in self:
            if not document._can_ef_manage_document("action_delete") and not document._user_owns_document():
                raise AccessError(_("You do not have permission to restore this document."))
            if (
                document._in_policy_folder()
                and not document._policy_folder_allows_document_activation()
            ):
                raise UserError(
                    _(
                        "Activate the policy folder before activating documents inside it."
                    )
                )
        for document in self:
            vals = {
                "active": True,
                "distribution_status": "active",
                "deleted_at": False,
                "deleted_by": False,
                "recycle_bin_until": False,
            }
            if document._in_policy_folder():
                vals["state"] = "approved"
                vals["approval_state"] = "not_required"
            document.write(vals)

    def action_deactivate(self):
        org_perm = self.env["doc.organizational.files.permission"]
        user = self.env.user
        for document in self:
            document._check_draft_policy_allows_action("deactivate")
            folder = document.folder_id
            if folder.folder_type == "organizational":
                if not (
                    org_perm.user_can_manage_org_document(user)
                    or org_perm.user_can_delete_org_document(user)
                    or org_perm.user_is_platform_admin(user)
                    or org_perm.user_has_legacy_manager(user)
                    or user.has_group(
                        "cleon_document_management.group_document_manager"
                    )
                    or user.has_group(
                        "cleon_document_management.group_document_admin"
                    )
                ):
                    raise AccessError(
                        _("You do not have permission to deactivate this document.")
                    )
            elif not document._can_ef_manage_document("action_delete"):
                raise AccessError(
                    _("You do not have permission to deactivate this document.")
                )
        for document in self:
            vals = {
                "active": False,
                "distribution_status": "deactivated",
                "deleted_at": False,
                "deleted_by": False,
                "recycle_bin_until": False,
            }
            if document._in_policy_folder():
                vals["state"] = "draft"
            document.write(vals)

    def action_move_to_recycle_bin(self):
        for document in self:
            document._check_draft_policy_allows_action("delete")
            if not document._can_ef_manage_document("action_delete"):
                raise AccessError(_("You do not have permission to delete this document."))
        now = fields.Datetime.now()
        try:
            retention_days = max(int(self.env["ir.config_parameter"].sudo().get_param(
                "cleon_document_management.recycle_bin_retention_days", "30"
            )), 1)
        except (TypeError, ValueError):
            retention_days = 30
        self.write({
            "active": False,
            "distribution_status": "deactivated",
            "deleted_at": now,
            "deleted_by": self.env.user.id,
            "recycle_bin_until": now + timedelta(days=retention_days),
        })

    @api.model
    def find_upload_conflict(self, employee, document_type):
        """Active employee file for the same document type (EF-D3 duplicate signal)."""
        if not employee or not document_type:
            return self.browse()
        return self.search(
            [
                ("employee_id", "=", employee.id),
                ("document_type_id", "=", document_type.id),
                ("active", "=", True),
                ("deleted_at", "=", False),
            ],
            order="write_date desc, id desc",
            limit=1,
        )

    def _user_can_replace_file(self):
        self.ensure_one()
        folder = self.folder_id
        if folder.folder_type == "organizational":
            return self.env["doc.organizational.files.permission"].user_can_upload_org(
                self.env.user
            )
        if self._is_document_manager():
            return True
        return self._user_owns_document()

    def _create_version_snapshot(self, change_note=""):
        """Persist the current attachment as a version before replacing it."""
        Version = self.env["doc.document.version"]
        created = Version.browse()
        for document in self:
            if not document.attachment_id:
                continue
            next_number = max(document.version_ids.mapped("version_number") or [0]) + 1
            attachment_copy = document.attachment_id.copy(
                {"name": document.attachment_id.name}
            )
            version = Version.create(
                {
                    "document_id": document.id,
                    "version_number": next_number,
                    "file_attachment": attachment_copy.id,
                    "uploaded_by": self.env.user.id,
                    "upload_date": fields.Datetime.now(),
                    "change_note": change_note,
                }
            )
            attachment_copy.write(
                {"res_model": version._name, "res_id": version.id}
            )
            created |= version
        return created

    def _effective_preview_attachment(self):
        self.ensure_one()
        if self.pending_attachment_id and self.approval_state == "pending":
            return self.pending_attachment_id
        return self.attachment_id

    def _should_bypass_upload_approval(self):
        self.ensure_one()
        folder = self.folder_id
        if folder.folder_type == "organizational":
            return True
        if self.document_type_id.require_upload_approval:
            return False
        employee = self.employee_id
        return (
            self._is_document_manager()
            and folder.folder_type == "employee"
            and employee
            and not folder.is_pending_uploads
        )

    def _mark_upload_approved_without_review(self):
        """Publish the file without an approval task (organizational / bypassed uploads)."""
        self.ensure_one()
        if self.pending_attachment_id:
            self._commit_pending_replacement()
        values = {
            "state": "approved",
            "approval_state": "not_required",
            "rejection_reason": False,
            "review_decision_unread": False,
        }
        if self.approval_ids:
            values["approval_ids"] = [fields.Command.clear()]
        self.sudo().write(values)

    def _resolve_approval_requirements(self):
        """Return (require_approval, approvers, approval_flow) from the document type."""
        self.ensure_one()
        config = self.document_type_id.get_upload_approval_config()
        return (
            bool(config["require_upload_approval"]),
            config["approvers"],
            config["approval_flow"] or "any",
        )

    def _start_upload_approval(self, approvers, approval_flow):
        self.ensure_one()
        approval_commands = [
            fields.Command.create(
                {
                    "approver_id": approver.id,
                    "sequence": sequence,
                    "state": self._approval_step_state_for_flow(
                        sequence, approval_flow
                    ),
                }
            )
            for sequence, approver in enumerate(approvers, start=1)
        ]
        self.sudo().write(
            {
                "approval_ids": [fields.Command.clear()] + approval_commands,
                "approval_state": "pending",
                "state": "processing",
                "rejection_reason": False,
                "review_decision_unread": False,
                "last_review_decision": False,
            }
        )
        self._notify_pending_approvers()
        self._log_approval_event(_("Submitted for approval"))

    def _log_approval_event(self, summary, detail=None):
        self.ensure_one()
        body = summary
        if detail:
            body = "%s<br/>%s" % (summary, detail)
        self.sudo().message_post(
            body=body,
            subtype_xmlid="mail.mt_note",
        )

    def _send_users_mail(self, users, subject, body_html):
        users = users.filtered(lambda user: user.email)
        if not users:
            return
        Mail = self.env["mail.mail"].sudo()
        for user in users:
            try:
                Mail.create(
                    {
                        "subject": subject,
                        "body_html": body_html,
                        "email_to": user.email,
                        "auto_delete": True,
                    }
                ).send()
            except Exception:
                _logger.exception(
                    "Document review mail failed for %s", user.email
                )

    def _notify_uploader_review_decision(self, approved, reason=None):
        self.ensure_one()
        uploader = self.uploaded_by or self.owner_id
        if not uploader or not uploader.partner_id:
            return
        decision = "approved" if approved else "rejected"
        if approved:
            body = _("Your document %(name)s was approved.") % {"name": self.name}
            subject = _("Document approved: %s") % self.name
        else:
            reason_text = reason or _("No reason was provided.")
            body = _(
                "Your document %(name)s was rejected. Reason: %(reason)s"
            ) % {
                "name": self.name,
                "reason": reason_text,
            }
            subject = _("Document rejected: %s") % self.name
        write_vals = {
            "last_review_decision": decision,
            "review_decision_unread": True,
        }
        if approved:
            write_vals["rejection_reason"] = False
        else:
            write_vals["rejection_reason"] = reason or ""
        self.sudo().write(write_vals)
        self._log_approval_event(body)
        self.sudo().message_post(
            body=body,
            partner_ids=uploader.partner_id.ids,
            subtype_xmlid="mail.mt_note",
        )
        self._send_users_mail(
            uploader,
            subject,
            "<p>%s</p>" % body,
        )

    def _discard_pending_replacement(self):
        self.ensure_one()
        pending = self.pending_attachment_id
        self.sudo().write(
            {
                "pending_attachment_id": False,
                "pending_description": False,
                "pending_issue_date": False,
                "pending_expiry_date": False,
                "pending_has_expiry": False,
                "pending_change_note": False,
            }
        )
        if pending:
            pending.sudo().unlink()

    def _commit_pending_replacement(self):
        self.ensure_one()
        if not self.pending_attachment_id:
            return
        change_note = self.pending_change_note or _("Approved replacement upload")
        self._create_version_snapshot(change_note)
        pending = self.pending_attachment_id
        write_vals = {
            "attachment_id": pending.id,
            "pending_attachment_id": False,
            "pending_change_note": False,
        }
        if self.pending_description:
            write_vals["description"] = self.pending_description
            write_vals["pending_description"] = False
        if self.pending_issue_date:
            write_vals["issue_date"] = self.pending_issue_date
            write_vals["pending_issue_date"] = False
        if self.pending_has_expiry:
            write_vals.update(
                {
                    "has_expiry": True,
                    "expiry_date": self.pending_expiry_date,
                    "pending_has_expiry": False,
                    "pending_expiry_date": False,
                }
            )
        pending.sudo().write({"res_model": self._name, "res_id": self.id})
        self.sudo().write(write_vals)
        self._log_organizational_audit(
            "replace",
            _("Published new file version"),
            details=change_note or "",
        )

    def _queue_pending_replacement(
        self,
        filename,
        file_bytes,
        mimetype=None,
        change_note="",
        expiry_values=None,
        description=None,
        issue_date=None,
    ):
        self.ensure_one()
        if not file_bytes:
            raise ValidationError(_("The replacement file is empty."))
        attachment = self.env["ir.attachment"].sudo().create(
            {
                "name": filename or self.name,
                "datas": base64.b64encode(file_bytes),
                "mimetype": mimetype or "application/octet-stream",
                "res_model": self._name,
                "res_id": self.id,
            }
        )
        pending_vals = {
            "pending_attachment_id": attachment.id,
            "pending_change_note": change_note or _("Uploaded new version"),
            "name": filename or self.name,
        }
        if description is not None:
            pending_vals["pending_description"] = description
        if issue_date:
            pending_vals["pending_issue_date"] = issue_date
        if expiry_values:
            pending_vals["pending_has_expiry"] = bool(expiry_values.get("has_expiry"))
            pending_vals["pending_expiry_date"] = expiry_values.get("expiry_date")
        self.sudo().write(pending_vals)
        require_approval, approvers, approval_flow = self._resolve_approval_requirements()
        if require_approval and approvers:
            self._start_upload_approval(approvers, approval_flow)
        return self

    def replace_file_from_upload(
        self,
        filename,
        file_bytes,
        mimetype=None,
        change_note="",
        expiry_values=None,
        description=None,
        issue_date=None,
    ):
        """Archive the current file as a version and attach the uploaded replacement."""
        self.ensure_one()
        if not self._user_can_replace_file():
            raise AccessError(_("You do not have permission to update this document."))
        if self.folder_id.is_locked:
            raise UserError(self.folder_id.LOCKED_UPLOAD_ERROR)
        if not self.active or self.deleted_at:
            raise ValidationError(_("Cannot version an inactive or deleted document."))
        if not file_bytes:
            raise ValidationError(_("The replacement file is empty."))
        if self.pending_attachment_id and self.approval_state == "pending":
            raise ValidationError(
                _("An update is already pending approval for this document.")
            )
        if not self.document_type_id.enable_versioning:
            raise ValidationError(
                _(
                    "Versioning is disabled for document type %(type)s.",
                    type=self.document_type_id.name,
                )
            )

        require_approval, approvers, approval_flow = self._resolve_approval_requirements()
        if require_approval and approvers and not self._should_bypass_upload_approval():
            return self._queue_pending_replacement(
                filename,
                file_bytes,
                mimetype=mimetype,
                change_note=change_note,
                expiry_values=expiry_values,
                description=description,
                issue_date=issue_date,
            )

        self._create_version_snapshot(change_note or _("Uploaded new version"))
        attachment = self.env["ir.attachment"].sudo().create({
            "name": filename or self.name,
            "datas": base64.b64encode(file_bytes),
            "mimetype": mimetype or "application/octet-stream",
            "res_model": self._name,
            "res_id": self.id,
        })
        write_vals = {
            "attachment_id": attachment.id,
            "name": filename or self.name,
        }
        if expiry_values:
            write_vals.update(expiry_values)
        if description is not None:
            write_vals["description"] = description
        if issue_date:
            write_vals["issue_date"] = issue_date
        self.sudo().write(write_vals)
        self._log_organizational_audit(
            "replace",
            _("Uploaded new file version"),
            details=change_note or "",
        )
        return self

    @api.model
    def _cron_send_expiry_alerts(self):
        today = fields.Date.context_today(self)
        try:
            alert_days = max(
                int(
                    self.env["ir.config_parameter"]
                    .sudo()
                    .get_param(
                        "cleon_document_management.expiry_alert_days", "30"
                    )
                ),
                1,
            )
        except (TypeError, ValueError):
            alert_days = 30
        alert_end = today + timedelta(days=alert_days)
        documents = self.sudo().search(
            [
                ("active", "=", True),
                ("deleted_at", "=", False),
                ("has_expiry", "=", True),
                ("expiry_notified", "=", False),
                ("expiry_date", "!=", False),
                ("expiry_date", ">=", today),
                ("expiry_date", "<=", alert_end),
            ]
        )
        activity_type = self.env.ref(
            "mail.mail_activity_data_todo", raise_if_not_found=False
        )
        admin_group = self.env.ref(
            "cleon_document_management.group_document_admin",
            raise_if_not_found=False,
        )
        admin_users = admin_group.users if admin_group else self.env["res.users"]
        for document in documents:
            note = _(
                "%(document)s for %(employee)s expires on %(date)s.",
                document=document.name,
                employee=document.employee_id.name or _("Unknown employee"),
                date=document.expiry_date,
            )
            if activity_type and admin_users:
                for user in admin_users:
                    document.activity_schedule(
                        activity_type_id=activity_type.id,
                        user_id=user.id,
                        date_deadline=document.expiry_date,
                        summary=_("Document expiring soon"),
                        note=note,
                    )
            document.message_post(
                body=note,
                partner_ids=admin_users.mapped("partner_id").ids,
                subtype_xmlid="mail.mt_note",
            )
            document.write({"expiry_notified": True})

    @api.model
    def _cron_empty_recycle_bin(self):
        expired = self.sudo().search([
            ("deleted_at", "!=", False),
            ("recycle_bin_until", "<=", fields.Datetime.now()),
        ])
        if expired:
            expired.unlink()

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            attachment_id = vals.get("attachment_id")
            employee_id = vals.get("employee_id")
            folder = self.env["doc.folder"].sudo().browse(vals.get("folder_id")).exists()

            if attachment_id:
                attachment = self.env["ir.attachment"].browse(attachment_id).exists()
                if not attachment:
                    raise ValidationError(_("The selected attachment does not exist."))

            if not self.env.context.get("intelligence_upload") and not self._is_document_manager():
                if not folder or not folder._user_can_access():
                    raise AccessError(_("You do not have access to upload into this folder."))

            if folder and folder.is_locked:
                raise UserError(folder.LOCKED_UPLOAD_ERROR)

            if (
                folder
                and folder.folder_type == "organizational"
                and not self.env.su
                and not self.env.context.get("org_document_copy")
            ):
                org_perm = self.env["doc.organizational.files.permission"]
                if not org_perm.user_can_upload_org(self.env.user):
                    raise AccessError(
                        _(
                            "You do not have permission to upload into organizational folders."
                        )
                    )

            if folder and folder.folder_type == "organizational":
                if (folder.folder_kind or "folder") == "policy":
                    vals.update(self._policy_folder_create_defaults(folder))
                    if "state" not in vals:
                        vals.setdefault("state", "approved")
                        vals.setdefault("approval_state", "not_required")
                else:
                    vals.setdefault("state", "approved")
                    vals.setdefault("approval_state", "not_required")
            if folder and folder.folder_kind == "policy":
                self.env["doc.organizational.policy"].apply_folder_document_defaults(
                    folder, vals
                )

        documents = super().create(vals_list)
        Policy = self.env["doc.organizational.policy"]
        for document in documents:
            if document._in_policy_folder():
                Policy.register_primary_document_if_empty(document.folder_id, document)
            if document.attachment_id:
                document.sudo().attachment_id.write(
                    {"res_model": self._name, "res_id": document.id}
                )
            document._apply_upload_approval_workflow()
            if document._in_draft_policy_folder():
                document._demote_to_policy_folder_draft()
            if (not self.env.user.has_group("cleon_document_management.group_document_manager")
                    and document.approval_state == "pending"):
                admins = self.env.ref("cleon_document_management.group_document_admin").users
                document.sudo().message_post(
                    body=_("%s submitted %s for review.") % (self.env.user.name, document.name),
                    partner_ids=admins.mapped("partner_id").ids,
                    subtype_xmlid="mail.mt_note",
                )
            self.env["doc.employee.files.service"].sudo().reconcile_document_employee_file(
                document
            )
        self._schedule_ask_index(documents)
        return documents

    def _schedule_ask_index(self, documents):
        from .intelligence_async import run_after_commit

        eligible = documents.filtered(lambda document: document._ask_index_eligible())
        if not eligible:
            return
        eligible.with_context(ask_indexing=True).write({"ask_index_state": "waiting"})
        ids = eligible.ids

        def _index(env):
            env["doc.document"].browse(ids).exists()._index_for_ask()

        run_after_commit(self.env, _index, name="cleon-ask-index")

    def _apply_upload_approval_workflow(self):
        self.ensure_one()
        folder = self.folder_id
        employee = self.employee_id
        require_approval = False
        approvers = self.env["res.users"]
        approval_flow = "any"

        if self._should_bypass_upload_approval():
            self._mark_upload_approved_without_review()
            return

        require_approval, approvers, approval_flow = self._resolve_approval_requirements()

        if self.document_type_id.verification_required:
            if folder.is_pending_uploads or (
                folder.folder_type == "employee" and employee
            ):
                self.sudo().write(
                    {
                        "state": "pending",
                        "approval_state": "pending",
                    }
                )
            return

        if require_approval and not approvers:
            if folder.is_pending_uploads or (
                folder.folder_type == "employee" and employee
            ):
                self.sudo().write({"state": "draft"})
            return

        if not require_approval:
            if folder.is_pending_uploads or (
                folder.folder_type == "employee" and employee
            ):
                self.sudo().write(
                    {
                        "state": "approved",
                        "approval_state": "not_required",
                    }
                )
            if folder.is_pending_uploads:
                self._assign_folder_after_approval()
            elif folder.folder_type == "organizational":
                if not self._in_draft_policy_folder():
                    self.sudo().write(
                        {
                            "state": "approved",
                            "approval_state": "not_required",
                        }
                    )
            return

        self._start_upload_approval(approvers, approval_flow)

    def _approval_step_state_for_flow(self, sequence, approval_flow):
        if approval_flow == "sequential":
            return "pending" if sequence == 1 else "waiting"
        return "pending"

    def _get_effective_approval_flow(self):
        self.ensure_one()
        if self.document_type_id.require_upload_approval:
            return self.document_type_id.approval_flow or "any"
        return "any"

    def _get_current_pending_approval(self):
        self.ensure_one()
        return self.approval_ids.filtered(
            lambda approval: approval.state == "pending"
        ).sorted("sequence")[:1]

    def _notify_pending_approvers(self):
        for document in self:
            pending = document.approval_ids.filtered(
                lambda approval: approval.state == "pending"
            )
            if not pending:
                continue
            employee_name = (
                document.employee_id.name if document.employee_id else "An employee"
            )
            for approval in pending:
                document.sudo().message_post(
                    body=_("%s submitted %s for your approval.")
                    % (employee_name, document.name),
                    partner_ids=approval.approver_id.partner_id.ids,
                    subtype_xmlid="mail.mt_note",
                )

    def _advance_sequential_approval(self):
        self.ensure_one()
        if self._get_effective_approval_flow() != "sequential":
            return self.env["doc.document.approval"]
        if self.approval_ids.filtered(lambda approval: approval.state == "pending"):
            return self.env["doc.document.approval"]
        next_waiting = self.approval_ids.filtered(
            lambda approval: approval.state == "waiting"
        ).sorted("sequence")[:1]
        if not next_waiting:
            return self.env["doc.document.approval"]
        next_waiting.write({"state": "pending"})
        employee_name = (
            self.employee_id.name if self.employee_id else "An employee"
        )
        self.sudo().message_post(
            body=_("%s is ready for your approval after prior review steps.")
            % (self.name,),
            partner_ids=next_waiting.approver_id.partner_id.ids,
            subtype_xmlid="mail.mt_note",
        )
        return next_waiting

    def get_review_context(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        flow = self._get_effective_approval_flow()
        my_approval = self.approval_ids.filtered(
            lambda approval: approval.approver_id == user
        )[:1]
        current = self._get_current_pending_approval()
        can_review = False
        waiting_for_prior = False
        my_state = my_approval.state if my_approval else False

        if self.approval_state == "pending" and my_approval:
            if flow == "sequential":
                can_review = my_approval.state == "pending"
                waiting_for_prior = my_approval.state == "waiting"
            else:
                can_review = my_approval.state == "pending"

        current_approver = current.approver_id if current else self.env["res.users"]
        return {
            "approval_flow": flow,
            "can_review": can_review,
            "waiting_for_prior": waiting_for_prior,
            "my_approval_state": my_state or None,
            "current_approver_id": current_approver.id if current else False,
            "current_approver_name": current_approver.name if current else None,
        }

    def _version_metadata(self):
        self.ensure_one()
        version_numbers = self.version_ids.mapped("version_number")
        latest_snapshot = max(version_numbers or [0])
        return {
            "version_count": len(self.version_ids),
            "current_version_number": latest_snapshot + 1,
        }

    def _lifecycle_location_label(self):
        self.ensure_one()
        folder = self.recycle_origin_folder_id or self.folder_id
        if not folder:
            return _("Unknown location")
        base = folder._lifecycle_location_label()
        if folder.id == self.folder_id.id:
            return f"{base} · {folder.folder_name}"
        return base

    def _organizational_policy_record(self):
        self.ensure_one()
        Policy = self.env["doc.organizational.policy"]
        by_document = Policy.search([("document_id", "=", self.id)], limit=1)
        if by_document:
            return by_document
        if self._in_policy_folder():
            return Policy.search([("folder_id", "=", self.folder_id.id)], limit=1)
        return Policy.browse()

    def _in_policy_folder(self):
        self.ensure_one()
        return (self.folder_id.folder_kind or "folder") == "policy"

    _DRAFT_POLICY_ORGANISE_ACTIONS = frozenset({"favorite", "pin", "move"})

    def _in_draft_policy_folder(self):
        self.ensure_one()
        if not self._in_policy_folder():
            return False
        return not self._policy_folder_allows_document_activation()

    def _check_draft_policy_allows_action(self, action):
        self.ensure_one()
        if action in self._DRAFT_POLICY_ORGANISE_ACTIONS:
            return
        if self._in_draft_policy_folder():
            raise UserError(
                _(
                    "Activate the policy before performing this action on documents inside it."
                )
            )

    def _policy_registry_for_folder(self, folder=None):
        folder = folder or self.folder_id
        if not folder or (folder.folder_kind or "folder") != "policy":
            return self.env["doc.organizational.policy"].browse()
        return self.env["doc.organizational.policy"].for_folder(folder)

    def _policy_folder_allows_document_activation(self):
        """Policy registry and folder must be active before child documents can go live."""
        self.ensure_one()
        if not self._in_policy_folder():
            return True
        folder = self.folder_id
        if not folder.active or folder.deleted_at or folder.distribution_status != "active":
            return False
        policy = self._policy_registry_for_folder(folder)
        if not policy:
            return False
        return bool(policy.active and policy.lifecycle_status == "active")

    def _policy_folder_draft_values(self):
        return {
            "state": "draft",
            "active": False,
            "distribution_status": "deactivated",
        }

    def _demote_to_policy_folder_draft(self):
        """Force draft/inactive while the parent policy folder is not activated."""
        candidates = self.filtered(
            lambda document: document._in_policy_folder()
            and not document.deleted_at
            and document.distribution_status != "archived"
            and (
                document.active
                or document.distribution_status != "deactivated"
                or document.state != "draft"
            )
        )
        if not candidates:
            return
        candidates.with_context(skip_policy_folder_activation_guard=True).write(
            candidates[0]._policy_folder_draft_values()
        )

    @api.model
    def _policy_folder_create_defaults(self, folder):
        """Initial document state for uploads in a policy folder."""
        if not folder or (folder.folder_kind or "folder") != "policy":
            return {}
        policy = self.env["doc.organizational.policy"].for_folder(folder)
        if policy and policy.active and policy.lifecycle_status == "active":
            return {}
        return self.new({"folder_id": folder.id})._policy_folder_draft_values()

    @api.model
    def create_policy_scratch_draft(self, folder, name, document_type_id):
        folder.ensure_one()
        if (folder.folder_kind or "folder") != "policy":
            raise ValidationError("Scratch drafts can only be created in policy folders.")
        folder.assert_unlocked(for_upload=True)
        display_name = (name or "").strip()
        if not display_name:
            raise ValidationError("Enter a document name.")
        file_name = display_name
        if file_name and not file_name.lower().endswith(".pdf"):
            file_name = "%s.pdf" % file_name
        placeholder = self.env["ir.attachment"].sudo().create(
            {
                "name": file_name,
                "datas": base64.b64encode(
                    b"%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"
                    b"2 0 obj<</Type/Pages/Kids[]/Count 0>>endobj\n"
                    b"trailer<</Size 2/Root 1 0 R>>\nstartxref\n0\n%%EOF"
                ),
                "mimetype": "application/pdf",
                "res_model": "doc.document",
            }
        )
        hr_document = self.create(
            {
                "name": file_name,
                "folder_id": folder.id,
                "document_type_id": int(document_type_id),
                "is_policy": True,
                "attachment_id": placeholder.id,
            }
        )
        editor_document = self.env["doc.template.document"].create_blank_for_hr_document(
            hr_document
        )
        return hr_document, editor_document

    def _sync_policy_editor_pdf(self, rendered_text=None):
        self.ensure_one()
        if not self.policy_editor_document_id:
            return False
        text = rendered_text
        if text is None:
            text = self.policy_editor_document_id.rendered_text or ""
        text = (text or "").strip() or " "
        from .intelligence_pipeline import _pymupdf

        fitz = _pymupdf()
        if not fitz:
            _logger.warning("PyMuPDF unavailable; skipping policy editor PDF sync.")
            return False
        pdf = fitz.open()
        margin = 50
        line_height = 14
        font_size = 11
        page = pdf.new_page()
        width = page.rect.width - (margin * 2)
        y = margin
        for line in text.splitlines() or [text]:
            if y > page.rect.height - margin:
                page = pdf.new_page()
                y = margin
            page.insert_text(
                (margin, y),
                line[:5000],
                fontsize=font_size,
                fontname="helv",
            )
            y += line_height
        raw = pdf.tobytes()
        pdf.close()
        attachment = self.attachment_id.sudo()
        if not attachment:
            attachment = self.env["ir.attachment"].sudo().create(
                {
                    "name": self.name,
                    "mimetype": "application/pdf",
                    "res_model": self._name,
                    "res_id": self.id,
                }
            )
            self.sudo().write({"attachment_id": attachment.id})
        attachment.write(
            {
                "datas": base64.b64encode(raw),
                "mimetype": "application/pdf",
                "name": self.name if self.name.lower().endswith(".pdf") else "%s.pdf" % self.name,
            }
        )
        self._log_organizational_edit_throttled(_("Edited in policy editor"))
        return True

    def _assignable_as_employee_policy(self):
        """Only flagged policy documents in the org library may be assigned to employees."""
        self.ensure_one()
        return bool(
            self.active
            and self.is_policy
            and not self.is_shortcut
            and not self.is_template
            and self.folder_id.folder_type == "organizational"
        )

    def _eligible_for_policy_adoption(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        if self.folder_id.folder_type != "organizational":
            return False
        if self.is_shortcut or self.is_template:
            return False
        if self._in_policy_folder():
            return False
        Policy = self.env["doc.organizational.policy"]
        if Policy.policy_blocks_document_adoption(self):
            return False
        # is_policy can remain set on library files after a cancelled or recycled policy;
        # folder placement and registry checks above are the real guards.
        return self._organizational_user_can_access(user)

    def filter_for_organizational_access(self, user=None):
        user = user or self.env.user
        return self.filtered(lambda document: document._organizational_user_can_access(user))

    def _user_can_manage_org_folder_contents(self, user=None):
        user = user or self.env.user
        perm = self.env["doc.organizational.files.permission"]
        return bool(
            user.has_group("cleon_document_management.group_document_manager")
            or user.has_group("cleon_document_management.group_document_admin")
            or perm.user_can_manage_org_document(user)
            or perm.user_can_manage_org_policy_lifecycle(user)
            or perm.user_can_delete_org_document(user)
            or perm.user_is_platform_admin(user)
            or perm.user_has_legacy_manager(user)
        )

    def _visible_in_folder_document_list(self, user=None, include_inactive=False):
        """Whether a document should appear in a folder file list (incl. deactivated drafts)."""
        self.ensure_one()
        user = user or self.env.user
        if self.deleted_at:
            return False
        folder = self.folder_id
        if folder.folder_type != "organizational":
            if include_inactive:
                return True
            return bool(self.active and self.distribution_status == "active")
        if not self._organizational_user_can_access(user):
            return False
        if self.active and self.distribution_status == "active":
            return True
        if not include_inactive:
            return False
        if self._user_can_manage_org_folder_contents(user):
            return True
        perm = self.env["doc.organizational.files.permission"]
        if self._in_policy_folder() and (
            perm.user_can_upload_org(user)
            or perm.user_can_manage_org_policy_lifecycle(user)
        ):
            return True
        if self.create_uid == user or self.owner_id == user:
            return True
        return False

    def assert_organizational_user_can_access(self, user=None):
        """Record-rule read plus organizational audience (folder + document scope)."""
        self.ensure_one()
        user = user or self.env.user
        self.check_access_rule("read")
        if (
            self.folder_id.folder_type == "organizational"
            and not self._organizational_user_can_access(user)
        ):
            raise AccessError(_("You do not have access to this document."))

    def _automation_notify_candidate_users(self):
        self.ensure_one()
        folder = self.folder_id
        if folder.folder_type == "organizational":
            employees = folder._get_scope_employees()
            users = employees.mapped("user_id").filtered(lambda user: user and user.active)
            users = users.filtered(lambda user: self._organizational_user_can_access(user))
            if self.owner_id and self.owner_id.active:
                if self._organizational_user_can_access(self.owner_id):
                    users |= self.owner_id
            return users
        if folder.folder_type == "employee":
            perm = self.env["doc.employee.files.permission"]
            users = self.env["res.users"].search(
                [
                    ("active", "=", True),
                    ("employee_files_role_ids", "!=", False),
                ]
            )
            if self.employee_id and self.employee_id.user_id:
                users |= self.employee_id.user_id
            return users.filtered(
                lambda user: perm.user_can_on_document(user, self, "action_view")
            )
        return self.env["res.users"]

    def _organizational_user_can_access(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        # Use sudo for folder/policy reads so callers can evaluate access without
        # tripping document record rules (e.g. inactive draft-policy documents).
        document = self.sudo()
        folder = document.folder_id
        if folder.folder_type != "organizational":
            return True
        if not folder._user_can_access(user):
            return False
        perm = self.env["doc.organizational.files.permission"]
        if (folder.folder_kind or "folder") == "policy":
            policy = self.env["doc.organizational.policy"].for_folder(folder)
            if policy and policy.lifecycle_status == "draft":
                if perm.user_can_manage_org_policy_lifecycle(user):
                    pass
                elif user.has_group("cleon_document_management.group_document_admin"):
                    pass
                elif user.has_group("cleon_document_management.group_document_manager"):
                    pass
                elif perm.user_is_platform_admin(user):
                    pass
                elif document.create_uid == user or document.owner_id == user:
                    pass
                else:
                    return False
        visibility = document.policy_visibility or "employees"
        if document._in_policy_folder():
            policy = self.env["doc.organizational.policy"].for_folder(folder)
            if policy:
                visibility = policy.policy_visibility or visibility
        if visibility == "hr_only" and not perm.user_can_view_hr_only_org_policy(user):
            return False
        if document.org_use_folder_access or not document.org_access_scope:
            return True
        employee = user.employee_id
        scope = document.org_access_scope
        perm = self.env["doc.organizational.files.permission"]
        if perm.user_is_platform_admin(user) or perm.user_has_legacy_manager(user):
            return True
        if scope == "all_staff":
            return True
        if not employee:
            return False
        if scope == "department":
            return employee.department_id in document.org_department_ids
        if scope == "grade":
            return employee.grade_id in document.org_grade_ids
        if scope == "individual":
            return employee in document.org_employee_ids
        if scope == "admin_only":
            return (
                user.has_group("cleon_document_management.group_document_admin")
                or perm.user_is_platform_admin(user)
                or perm.user_has_legacy_manager(user)
            )
        if scope == "private":
            if user == document.create_uid or user == document.owner_id:
                return True
            return (
                user.has_group("cleon_document_management.group_document_admin")
                or perm.user_is_platform_admin(user)
                or perm.user_has_legacy_manager(user)
            )
        if scope == "company_owned":
            config = self.env["doc.employee.files.config"].get_for_company(
                folder.company_id
            )
            uploader = document.create_uid or document.owner_id
            return config.user_can_access_company_owned(user, uploader)
        if document._compliance_assignment_grants_access(user):
            return True
        return False

    @api.model
    def _prepare_organizational_access_values(
        self,
        org_use_folder_access,
        org_access_scope=None,
        department_ids=None,
        grade_ids=None,
        employee_ids=None,
        folder=None,
    ):
        values = {
            "org_use_folder_access": bool(org_use_folder_access),
            "org_access_scope": False,
            "org_department_ids": [fields.Command.clear()],
            "org_grade_ids": [fields.Command.clear()],
            "org_employee_ids": [fields.Command.clear()],
        }
        if values["org_use_folder_access"]:
            return values
        scope = (org_access_scope or "all_staff").strip()
        allowed = {key for key, _label in self._fields["org_access_scope"].selection}
        if scope not in allowed:
            raise ValidationError(_("Invalid document access scope: %s") % scope)
        values["org_access_scope"] = scope
        Department = self.env["hr.department"]
        Grade = self.env["hr.grade"]
        Employee = self.env["hr.employee"]
        if scope == "department":
            values["org_department_ids"] = [
                fields.Command.set(Department.browse(department_ids or []).exists().ids)
            ]
        elif scope == "grade":
            values["org_grade_ids"] = [
                fields.Command.set(Grade.browse(grade_ids or []).exists().ids)
            ]
        elif scope == "individual":
            values["org_employee_ids"] = [
                fields.Command.set(Employee.browse(employee_ids or []).exists().ids)
            ]
        if scope == "department" and not (department_ids or []):
            raise ValidationError(_("Select at least one department for document access."))
        if scope == "grade" and not (grade_ids or []):
            raise ValidationError(_("Select at least one grade for document access."))
        if scope == "individual" and not (employee_ids or []):
            raise ValidationError(_("Select at least one employee for document access."))
        if folder and folder.folder_type == "organizational":
            folder.validate_document_access_targets(
                scope,
                department_ids=department_ids,
                grade_ids=grade_ids,
                employee_ids=employee_ids,
            )
        return values

    def _is_organizational_library_document(self):
        self.ensure_one()
        folder = self.folder_id
        return bool(folder) and folder.folder_type == "organizational"

    def _log_organizational_audit(self, action, summary, details=""):
        self.ensure_one()
        if not self._is_organizational_library_document():
            return self.env["doc.object.audit"]
        return self.env["doc.object.audit"].log(self, action, summary, details=details)

    def _organizational_access_summary(self):
        self.ensure_one()
        if self.org_use_folder_access or not self.org_access_scope:
            return _("Inherits folder access")
        labels = dict(self._fields["org_access_scope"].selection)
        base = labels.get(self.org_access_scope, self.org_access_scope)
        if self.org_access_scope == "department" and self.org_department_ids:
            names = self.org_department_ids.mapped("name")
            suffix = ", ".join(names[:3])
            if len(names) > 3:
                suffix = "%s…" % suffix
            return _("%s (%s)") % (base, suffix)
        if self.org_access_scope == "grade" and self.org_grade_ids:
            names = self.org_grade_ids.mapped("name")
            suffix = ", ".join(names[:3])
            if len(names) > 3:
                suffix = "%s…" % suffix
            return _("%s (%s)") % (base, suffix)
        if self.org_access_scope == "individual" and self.org_employee_ids:
            names = self.org_employee_ids.mapped("name")
            suffix = ", ".join(names[:3])
            if len(names) > 3:
                suffix = "%s…" % suffix
            return _("%s (%s)") % (base, suffix)
        return base

    def action_record_organizational_access_audit(self, previous_summary):
        self.ensure_one()
        current = self._organizational_access_summary()
        if current == previous_summary:
            return
        self._log_organizational_audit(
            "access",
            _("Access updated to %s") % current,
            details=_("Previously: %s") % previous_summary,
        )

    def _log_organizational_edit_throttled(self, summary=None):
        """Avoid flooding activity while the policy editor autosaves."""
        self.ensure_one()
        if not self._is_organizational_library_document():
            return
        Audit = self.env["doc.object.audit"]
        recent = Audit.search(
            [
                ("res_model", "=", self._name),
                ("res_id", "=", self.id),
                ("action", "=", "edit"),
            ],
            limit=1,
            order="occurred_at desc",
        )
        now = fields.Datetime.now()
        if recent.occurred_at and (now - recent.occurred_at).total_seconds() < 600:
            return
        self._log_organizational_audit(
            "edit",
            summary or _("Edited document content"),
        )

    def _access_preview(self):
        self.ensure_one()
        User = self.env["res.users"]
        Employee = self.env["hr.employee"]
        named = User
        if self.owner_id:
            named |= self.owner_id
        extra_employees = Employee
        extra_count = 0
        folder = self.folder_id
        if folder.folder_type == "organizational":
            use_folder = self.org_use_folder_access or not self.org_access_scope
            scope = folder.access_scope if use_folder else self.org_access_scope
            departments = folder.department_ids if use_folder else self.org_department_ids
            grades = folder.grade_ids if use_folder else self.org_grade_ids
            individuals = folder.employee_ids if use_folder else self.org_employee_ids
            if scope == "individual":
                extra_employees = individuals.filtered("active")
                extra_count = len(extra_employees)
            elif scope == "department" and departments:
                domain = [
                    ("active", "=", True),
                    ("department_id", "in", departments.ids),
                ]
                extra_employees = Employee.search(domain, limit=8)
                extra_count = Employee.search_count(domain)
            elif scope == "grade" and grades:
                domain = [("active", "=", True), ("grade_id", "in", grades.ids)]
                extra_employees = Employee.search(domain, limit=8)
                extra_count = Employee.search_count(domain)
        extra_users = extra_employees.mapped("user_id").filtered(
            lambda user: user and user.active
        )
        users = (named | extra_users).filtered("active")
        preview = users[:3]
        return {
            "access_users": [{"id": user.id, "name": user.name} for user in preview],
            "access_user_count": max(len(users), extra_count),
        }

    def serialize_for_api(self, user=None, **extra):
        self.ensure_one()
        user = user or self.env.user
        org_policy = self._organizational_policy_record()
        payload = {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "folder_id": self.folder_id.id,
            "folder_type": self.folder_id.folder_type,
            "folder_name": self.folder_id.folder_name,
            "folder_color_hex": self.folder_id.color_hex or "",
            "employee_id": self.employee_id.id or False,
            "employee_name": self.employee_id.name or "N/A",
            "document_type_id": self.document_type_id.id,
            "document_type": self.document_type_id.name,
            "document_type_enable_versioning": bool(
                self.document_type_id.enable_versioning
            )
            if self.document_type_id
            else True,
            "document_category": self.document_type_id.category
            if self.document_type_id
            else "other",
            "document_category_label": dict(
                self.document_type_id._fields["category"].selection
            ).get(self.document_type_id.category, _("Other"))
            if self.document_type_id
            else _("Other"),
            "state": self.state,
            "approval_state": self.approval_state,
            "ocr_state": self.ocr_state,
            "processing_status": self.processing_status,
            "legal_hold_active": bool(self.legal_hold_active),
            "retention_review_due": bool(self.retention_review_due),
            "backup_confirmed_at": str(self.backup_confirmed_at or ""),
            "has_expiry": self.has_expiry,
            "expiry_date": self.expiry_date,
            "issue_date": self.issue_date,
            "has_pending_revision": bool(self.pending_attachment_id),
            "rejection_reason": self.rejection_reason or "",
            "review_decision_unread": bool(self.review_decision_unread),
            "last_review_decision": self.last_review_decision or None,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "source_url": self.source_url or "",
            "link_status": self.link_status or ("unchecked" if self.source_url else "none"),
            "is_policy": bool(self.is_policy),
            "is_template": bool(self.is_template),
            "is_shortcut": bool(self.is_shortcut),
            "shortcut_of_id": self.shortcut_of_id.id or False,
            "shortcut_of_name": self.shortcut_of_id.name if self.shortcut_of_id else "",
            "shortcut_of_folder_id": (
                self.shortcut_of_id.folder_id.id
                if self.shortcut_of_id and self.shortcut_of_id.folder_id
                else False
            ),
            "imported_from": self.imported_from or "native",
            "owner_id": self.owner_id.id if self.owner_id else False,
            "owner_name": self.owner_id.name if self.owner_id else "",
            "folder_path": self.folder_id._breadcrumb_labels() if self.folder_id else [],
            "attachment_id": self.attachment_id.id,
            "created_at": self.create_date,
            "write_date": self.write_date,
            "active": self.active,
            "distribution_status": self.distribution_status,
            "org_use_folder_access": self.org_use_folder_access,
            "org_access_scope": self.org_access_scope or "",
            "org_department_ids": self.org_department_ids.ids,
            "org_grade_ids": self.org_grade_ids.ids,
            "org_employee_ids": self.org_employee_ids.ids,
            "linked_policy_id": self.linked_policy_id.id or False,
            "linked_policy_name": self.linked_policy_id.name or "",
            "organizational_policy_id": org_policy.id or False,
            "organizational_policy_name": org_policy.name or "",
            "folder_kind": self.folder_id.folder_kind or "folder",
            "folder_access_scope": self.folder_id.access_scope or "all_staff",
            "folder_department_ids": self.folder_id.department_ids.ids,
            "folder_grade_ids": self.folder_id.grade_ids.ids,
            "folder_employee_ids": self.folder_id.employee_ids.ids,
            "organizational_policy_lifecycle_status": (
                org_policy.lifecycle_status if org_policy else False
            ),
            "linked_template_document_id": self.linked_template_document_id.id or False,
            "linked_template_document_name": self.linked_template_document_id.name or "",
            "policy_editor_document_id": self.policy_editor_document_id.id or False,
            "editor_source": self.editor_source or "none",
        }
        payload.update(self._version_metadata())
        payload.update(self.get_review_context(user))
        payload.update(self._access_preview())
        payload.update(extra)
        return payload

    def action_start_ocr(self):
        self.write({"ocr_state": "processing", "ocr_error": False})

    def action_mark_ocr_completed(self, extracted_text):
        self.write(
            {
                "ocr_state": "completed",
                "extracted_text": extracted_text,
                "ocr_error": False,
            }
        )

    def action_mark_ocr_failed(self, error_message):
        self.write({"ocr_state": "failed", "ocr_error": error_message})

    def _finalize_assignment_to_folder(self, target_folder):
        self.ensure_one()
        approval_state = (
            "approved" if self.approval_state == "approved" else "not_required"
        )
        self.sudo().write(
            {
                "folder_id": target_folder.id,
                "state": "approved",
                "approval_state": approval_state,
            }
        )

    def _assign_folder_after_approval(self):
        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        for document in self:
            if not document.employee_id:
                continue
            if document.approval_state not in ("approved", "not_required") and document.state != "approved":
                continue
            if document.folder_id != pending_folder:
                continue
            target = self.env["doc.folder"].assign_employee_to_department_folder(
                document.employee_id
            )
            if target:
                document._finalize_assignment_to_folder(target)

    def _update_approval_state(self):
        for document in self:
            approvals = document.approval_ids

            if not approvals:
                document.write(
                    {
                        "approval_state": "not_required",
                        "state": "approved",
                    }
                )
                document._assign_folder_after_approval()
                continue

            if any(approval.state == "rejected" for approval in approvals):
                had_pending = bool(document.pending_attachment_id)
                reject_reason = next(
                    (
                        approval.comment
                        for approval in approvals
                        if approval.state == "rejected" and approval.comment
                    ),
                    None,
                )
                if had_pending:
                    document._discard_pending_replacement()
                    document.write(
                        {
                            "approval_state": "approved",
                            "state": "approved",
                            "approval_ids": [fields.Command.clear()],
                        }
                    )
                    document._notify_uploader_review_decision(
                        False, reason=reject_reason
                    )
                else:
                    document.write(
                        {
                            "approval_state": "rejected",
                            "state": "rejected",
                            "rejection_reason": reject_reason or "",
                        }
                    )
                    document._notify_uploader_review_decision(
                        False, reason=reject_reason
                    )
                continue

            flow = document._get_effective_approval_flow()

            if flow == "any":
                approved = any(approval.state == "approved" for approval in approvals)
            else:
                approved = all(approval.state == "approved" for approval in approvals)

            if approved:
                if document.pending_attachment_id:
                    document._commit_pending_replacement()
                document.write(
                    {
                        "approval_state": "approved",
                        "state": "approved",
                    }
                )
                document._assign_folder_after_approval()
                if not self.env.context.get("skip_uploader_approval_notice"):
                    document._notify_uploader_review_decision(True)
            else:
                document.write({"approval_state": "pending"})
                document._advance_sequential_approval()

    def _ask_index_eligible(self):
        self.ensure_one()
        folder = self.folder_id
        return bool(
            self.active
            and not self.deleted_at
            and self.attachment_id
            and folder
            and folder.active
            and not folder.deleted_at
            and folder.distribution_status == "active"
            and folder.folder_type in ("employee", "organizational")
        )

    def _ask_index_stamp_value(self):
        self.ensure_one()
        return "%s:%s:qwen3-0.6" % (self.checksum or "", len(self.extracted_text or ""))

    def _drop_ask_index(self):
        chunks = self.sudo().mapped("ask_chunk_ids")
        if chunks:
            chunks.unlink()
        to_clear = self.filtered(
            lambda document: document.ask_index_stamp or document.ask_index_state
        )
        if to_clear:
            to_clear.sudo().with_context(ask_indexing=True).write(
                {"ask_index_stamp": False, "ask_index_state": False}
            )

    def _index_for_ask(self):
        from odoo.addons.cleon_document_management.models.intelligence_pipeline import (
            extract_document_text,
        )

        for document in self.sudo():
            if not document._ask_index_eligible():
                document._drop_ask_index()
                continue
            current_stamp = document._ask_index_stamp_value()
            if document.ask_index_stamp == current_stamp:
                if document.ask_chunk_ids:
                    if document.ask_index_state != "indexed":
                        document.with_context(ask_indexing=True).write(
                            {"ask_index_state": "indexed"}
                        )
                elif document.ask_index_state != "skipped":
                    document.with_context(ask_indexing=True).write(
                        {"ask_index_state": "skipped"}
                    )
                continue
            document.with_context(ask_indexing=True).write(
                {"ask_index_state": "indexing"}
            )
            text = (document.extracted_text or "").strip()
            if not text and document.attachment_id:
                try:
                    text, _source, _pages = extract_document_text(
                        document.attachment_id,
                        ocr_fallback=True,
                        env=document.env,
                    )
                except Exception:
                    text = ""
                if text:
                    document.with_context(ask_indexing=True).write(
                        {
                            "extracted_text": text,
                            "ocr_state": "completed",
                            "ocr_error": False,
                        }
                    )
            stamp = document._ask_index_stamp_value()
            if document.ask_index_stamp == stamp and document.ask_chunk_ids:
                document.with_context(ask_indexing=True).write(
                    {"ask_index_state": "indexed"}
                )
                continue
            if not (document.extracted_text or "").strip():
                _logger.warning(
                    "Ask index skipped for document %s (%s): no text could be read.",
                    document.id,
                    document.name,
                )
                document._drop_ask_index()
                document.with_context(ask_indexing=True).write(
                    {"ask_index_stamp": stamp, "ask_index_state": "skipped"}
                )
                continue
            _logger.info("Indexing document %s (%s) for Ask AI", document.id, document.name)
            document.env["doc.intelligence.library.chunk"].index_document(document)
            document.with_context(ask_indexing=True).write(
                {"ask_index_stamp": stamp, "ask_index_state": "indexed"}
            )
        return True

    def _ask_index_resolved_state(self, chunk_count):
        self.ensure_one()
        if self.ask_index_state:
            return self.ask_index_state
        if chunk_count:
            return "indexed"
        if self.ask_index_stamp:
            return "skipped"
        return "waiting"

    @api.model
    def ask_index_status(self, limit=300, search=""):
        limit = min(max(int(limit or 300), 1), 400)
        term = (search or "").strip().lower()
        docs = self._ask_library_documents()
        chunk_model = self.env["doc.intelligence.library.chunk"].sudo()
        groups = chunk_model.read_group(
            [("document_id", "in", docs.ids or [0])],
            ["document_id"],
            ["document_id"],
        )
        chunk_counts = {
            group["document_id"][0]: group["document_id_count"]
            for group in groups
            if group.get("document_id")
        }
        counts = {
            "indexed": 0,
            "indexing": 0,
            "waiting": 0,
            "skipped": 0,
        }
        files = []
        for document in docs:
            chunk_count = chunk_counts.get(document.id, 0)
            state = document._ask_index_resolved_state(chunk_count)
            counts[state] = counts.get(state, 0) + 1
            name = document.name or "Untitled"
            folder = document.folder_id.folder_name or ""
            if term and term not in name.lower() and term not in folder.lower():
                continue
            files.append(
                {
                    "id": document.id,
                    "name": name,
                    "folder": folder,
                    "mimetype": document.mime_type or "",
                    "chunk_count": chunk_count,
                    "state": state,
                    "write_date": str(document.write_date or ""),
                }
            )
        order = {"indexing": 0, "waiting": 1, "indexed": 2, "skipped": 3}
        files.sort(key=lambda item: item.get("write_date") or "", reverse=True)
        files.sort(key=lambda item: order.get(item["state"], 9))
        truncated = len(files) > limit
        return {
            "total_count": len(docs),
            "indexed_count": counts["indexed"],
            "indexing_count": counts["indexing"],
            "waiting_count": counts["waiting"],
            "skipped_count": counts["skipped"],
            "truncated": truncated,
            "files": files[:limit],
        }

    @api.model
    def _ask_library_documents(self):
        user = self.env.user
        employee = user.employee_id
        live = [
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("folder_id.active", "=", True),
            ("folder_id.deleted_at", "=", False),
            ("folder_id.distribution_status", "=", "active"),
            ("folder_id.folder_type", "in", ("employee", "organizational")),
        ]
        own = expression.AND(
            [
                live,
                expression.OR(
                    [
                        [
                            ("owner_id", "=", user.id),
                            ("folder_id.folder_type", "=", "employee"),
                        ],
                        [("employee_id", "=", employee.id or 0)],
                    ]
                ),
            ]
        )
        employee_id = employee.id if employee else 0
        department_id = (
            employee.department_id.id if employee and employee.department_id else 0
        )
        grade_id = employee.grade_id.id if employee and employee.grade_id else 0
        employee_type_id = (
            employee.employee_type_id.id if employee and employee.employee_type_id else 0
        )
        branch_id = employee.branch_id.id if employee and employee.branch_id else 0
        shared_access = [
            [("allowed_user_ids", "in", [user.id])],
            [("allowed_group_ids", "in", user.groups_id.ids)],
            [("folder_id.allowed_user_ids", "in", [user.id])],
            [("folder_id.access_scope", "=", "all_staff")],
            [
                ("folder_id.access_scope", "=", "department"),
                ("folder_id.department_ids", "in", [department_id]),
            ],
            [
                ("folder_id.access_scope", "=", "grade"),
                ("folder_id.grade_ids", "in", [grade_id]),
            ],
            [
                ("folder_id.access_scope", "=", "employment_type"),
                ("folder_id.employment_type_ids", "in", [employee_type_id]),
            ],
            [
                ("folder_id.access_scope", "=", "business_unit"),
                ("folder_id.branch_ids", "in", [branch_id]),
            ],
            [
                ("folder_id.access_scope", "=", "role"),
                ("folder_id.role_group_ids", "in", user.groups_id.ids),
            ],
            [
                ("folder_id.access_scope", "=", "individual"),
                ("folder_id.employee_ids", "in", [employee_id]),
            ],
        ]
        if user.has_group("cleon_document_management.group_document_admin"):
            shared_access.append([("folder_id.access_scope", "=", "admin_only")])
        shared = expression.AND(
            [
                live,
                [("folder_id.folder_type", "=", "organizational")],
                [("state", "!=", "draft")],
                expression.OR(shared_access),
            ]
        )
        documents = self.search(expression.OR([own, shared]))
        return documents.filter_for_organizational_access(user)

    @api.model
    def _cron_index_ask_library(self):
        from odoo.addons.cleon_document_management.models.intelligence_tei import (
            local_rag_enabled,
        )

        if not local_rag_enabled():
            return True
        _logger.info("Ask library index cron started")
        live = [
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("folder_id.active", "=", True),
            ("folder_id.deleted_at", "=", False),
            ("folder_id.distribution_status", "=", "active"),
            ("folder_id.folder_type", "in", ("employee", "organizational")),
            ("attachment_id", "!=", False),
        ]
        stale = self.sudo().search(
            live + [("ask_chunk_ids", "=", False)],
            limit=15,
            order="write_date desc",
        )
        if len(stale) < 15:
            extra = self.sudo().search(
                live,
                limit=40,
                order="write_date desc",
            )
            stale |= extra.filtered(
                lambda document: document.ask_index_stamp
                != document._ask_index_stamp_value()
            )[: 15 - len(stale)]
        for document in stale[:15]:
            try:
                with self.env.cr.savepoint():
                    document._index_for_ask()
            except Exception:
                _logger.exception(
                    "Ask library index failed for document %s", document.id
                )
        gone = self.sudo().search(
            [
                ("ask_chunk_ids", "!=", False),
                "|",
                ("active", "=", False),
                "|",
                ("deleted_at", "!=", False),
                "|",
                ("folder_id.active", "=", False),
                "|",
                ("folder_id.deleted_at", "!=", False),
                ("folder_id.distribution_status", "!=", "active"),
            ],
            limit=50,
        )
        if gone:
            gone._drop_ask_index()
        return True

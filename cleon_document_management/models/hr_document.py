import base64
import logging
from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError

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

    approval_ids = fields.One2many(
        "doc.document.approval",
        "document_id",
        string="Approvals",
    )

    acknowledgement_ids = fields.One2many(
        "doc.document.acknowledgement", "document_id", string="Acknowledgements"
    )

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

    def _is_document_manager(self):
        return self.env.user.has_group("cleon_document_management.group_document_manager")

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
        if self.env.su:
            result = super().write(vals)
            if "state" in vals and vals["state"] in ("approved", "signed"):
                self.env["doc.compliance.policy"]._evaluate_documents(self)
            return result
        if not self._is_document_manager():
            allowed = self._employee_self_service_write_fields() | self._mail_thread_internal_write_fields(vals)
            if set(vals) - allowed:
                raise AccessError(_("You can only update your document favorites and pins."))
        result = super().write(vals)
        if "state" in vals and vals["state"] in ("approved", "signed"):
            self.env["doc.compliance.policy"]._evaluate_documents(self)
        if not self.env.context.get("skip_ef_document_reconcile"):
            reconcile_fields = {"employee_id", "employee_file_id", "folder_id", "active"}
            if reconcile_fields.intersection(vals):
                service = self.env["doc.employee.files.service"].sudo()
                for document in self:
                    service.reconcile_document_employee_file(document)
        return result

    def unlink(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete documents."))
        return super().unlink()

    def action_archive(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can archive documents."))
        self.write({"active": False, "distribution_status": "archived", "deleted_at": False, "deleted_by": False, "recycle_bin_until": False})

    def _user_owns_document(self):
        self.ensure_one()
        user = self.env.user
        if self.owner_id == user:
            return True
        return bool(self.employee_id and self.employee_id.user_id == user)

    def action_restore(self):
        for document in self:
            if not document._is_document_manager() and not document._user_owns_document():
                raise AccessError(_("Only document managers can restore documents."))
        self.write({"active": True, "distribution_status": "active", "deleted_at": False, "deleted_by": False, "recycle_bin_until": False})

    def action_deactivate(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can deactivate documents."))
        self.write({"active": False, "distribution_status": "deactivated", "deleted_at": False, "deleted_by": False, "recycle_bin_until": False})

    def action_move_to_recycle_bin(self):
        if not self._is_document_manager():
            raise AccessError(_("Only document managers can delete documents."))
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
        if self.document_type_id.require_upload_approval:
            return False
        folder = self.folder_id
        employee = self.employee_id
        return (
            self._is_document_manager()
            and folder.folder_type == "employee"
            and employee
            and not folder.is_pending_uploads
        )

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

            if not self._is_document_manager():
                if not folder or not folder._user_can_access():
                    raise AccessError(_("You do not have access to upload into this folder."))

            document_type = (
                self.env["doc.document.type"]
                .sudo()
                .browse(vals.get("document_type_id"))
                .exists()
            )
            if (
                folder
                and folder.folder_type == "organizational"
                and not folder.require_upload_approval
                and not document_type.require_upload_approval
            ):
                vals.setdefault("state", "approved")
                vals.setdefault("approval_state", "not_required")

        documents = super().create(vals_list)
        for document in documents:
            document.sudo().attachment_id.write(
                {"res_model": self._name, "res_id": document.id}
            )
            document._apply_upload_approval_workflow()
            self.env["doc.employee.files.service"].sudo().reconcile_document_employee_file(
                document
            )
        return documents

    def _apply_upload_approval_workflow(self):
        self.ensure_one()
        folder = self.folder_id
        employee = self.employee_id
        require_approval = False
        approvers = self.env["res.users"]
        approval_flow = "any"

        if self._should_bypass_upload_approval():
            self.sudo().write(
                {
                    "state": "approved",
                    "approval_state": "not_required",
                }
            )
            return

        require_approval, approvers, approval_flow = self._resolve_approval_requirements()

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

    def serialize_for_api(self, user=None, **extra):
        self.ensure_one()
        user = user or self.env.user
        payload = {
            "id": self.id,
            "name": self.name,
            "description": self.description or "",
            "folder_id": self.folder_id.id,
            "folder_name": self.folder_id.folder_name,
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
            "has_expiry": self.has_expiry,
            "expiry_date": self.expiry_date,
            "issue_date": self.issue_date,
            "has_pending_revision": bool(self.pending_attachment_id),
            "rejection_reason": self.rejection_reason or "",
            "review_decision_unread": bool(self.review_decision_unread),
            "last_review_decision": self.last_review_decision or None,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "attachment_id": self.attachment_id.id,
            "created_at": self.create_date,
            "write_date": self.write_date,
            "active": self.active,
            "distribution_status": self.distribution_status,
        }
        payload.update(self._version_metadata())
        payload.update(self.get_review_context(user))
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

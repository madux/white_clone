from datetime import timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


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

    def write(self, vals):
        if not self._is_document_manager():
            allowed = {"favorite_user_ids", "pinned_user_ids"}
            if set(vals) - allowed:
                raise AccessError(_("You can only update your document favorites and pins."))
        return super().write(vals)

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
            folder = self.env["doc.folder"].browse(vals.get("folder_id")).exists()

            if attachment_id:
                attachment = self.env["ir.attachment"].browse(attachment_id).exists()
                if not attachment:
                    raise ValidationError(_("The selected attachment does not exist."))

            if not self._is_document_manager():
                if not folder or not folder._user_can_access():
                    raise AccessError(_("You do not have access to upload into this folder."))

            if folder and folder.folder_type == "organizational" and not folder.require_upload_approval:
                vals.setdefault("state", "approved")
                vals.setdefault("approval_state", "not_required")

        documents = super().create(vals_list)
        for document in documents:
            document.attachment_id.write(
                {"res_model": self._name, "res_id": document.id}
            )
            document._apply_upload_approval_workflow()
            if (not self.env.user.has_group("cleon_document_management.group_document_manager")
                    and document.approval_state == "pending"):
                admins = self.env.ref("cleon_document_management.group_document_admin").users
                document.sudo().message_post(
                    body=_("%s submitted %s for review.") % (self.env.user.name, document.name),
                    partner_ids=admins.mapped("partner_id").ids,
                    subtype_xmlid="mail.mt_note",
                )
        return documents

    def _apply_upload_approval_workflow(self):
        self.ensure_one()
        folder = self.folder_id
        employee = self.employee_id
        require_approval = False
        approvers = self.env["res.users"]
        approval_flow = "any"

        if folder.is_pending_uploads and employee and employee.department_id:
            config = self.env["doc.folder"].get_department_approval_config(
                employee.department_id
            )
            require_approval = config["require_upload_approval"]
            approvers = config["approvers"]
            approval_flow = config["approval_flow"]
        elif folder.require_upload_approval and not folder.is_pending_uploads:
            require_approval = True
            approvers = folder._get_ordered_approvers()
            approval_flow = folder.approval_flow
        elif folder.folder_type == "organizational" and not folder.require_upload_approval:
            return

        if not require_approval or not approvers:
            if folder.is_pending_uploads or (
                folder.folder_type == "employee" and employee
            ):
                self.sudo().write(
                    {
                        "state": "draft",
                        "approval_state": "not_required",
                    }
                )
            return

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
                "approval_ids": approval_commands,
                "approval_state": "pending",
                "state": "processing",
            }
        )
        self._notify_pending_approvers()

    def _approval_step_state_for_flow(self, sequence, approval_flow):
        if approval_flow == "sequential":
            return "pending" if sequence == 1 else "waiting"
        return "pending"

    def _get_effective_approval_flow(self):
        self.ensure_one()
        folder = self.folder_id
        if (
            folder.is_pending_uploads
            and self.employee_id
            and self.employee_id.department_id
        ):
            config = self.env["doc.folder"].get_department_approval_config(
                self.employee_id.department_id
            )
            return config["approval_flow"] or "any"
        return folder.approval_flow or "any"

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
            "state": self.state,
            "approval_state": self.approval_state,
            "ocr_state": self.ocr_state,
            "has_expiry": self.has_expiry,
            "expiry_date": self.expiry_date,
            "mime_type": self.mime_type,
            "file_size": self.file_size,
            "attachment_id": self.attachment_id.id,
            "created_at": self.create_date,
            "write_date": self.write_date,
            "active": self.active,
            "distribution_status": self.distribution_status,
        }
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
                document.sudo().write({"folder_id": target.id})

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
                document.write(
                    {
                        "approval_state": "rejected",
                        "state": "rejected",
                    }
                )
                continue

            flow = document._get_effective_approval_flow()

            if flow == "any":
                approved = any(approval.state == "approved" for approval in approvals)
            else:
                approved = all(approval.state == "approved" for approval in approvals)

            if approved:
                document.write(
                    {
                        "approval_state": "approved",
                        "state": "approved",
                    }
                )
                document._assign_folder_after_approval()
            else:
                document.write({"approval_state": "pending"})
                document._advance_sequential_approval()

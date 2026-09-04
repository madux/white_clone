from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


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

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            attachment_id = vals.get("attachment_id")
            employee_id = vals.get("employee_id")

            if attachment_id:
                attachment = self.env["ir.attachment"].browse(attachment_id).exists()
                if not attachment:
                    raise ValidationError(_("The selected attachment does not exist."))

            if employee_id and not vals.get("folder_id"):
                employee = self.env["hr.employee"].browse(employee_id).exists()
                if employee and employee.department_id:
                    folder = self.env["doc.folder"].get_or_create_department_folder(
                        employee.department_id
                    )
                    vals["folder_id"] = folder.id

        documents = super().create(vals_list)
        for document in documents:
            document.attachment_id.write(
                {"res_model": self._name, "res_id": document.id}
            )
            if document.folder_id.require_upload_approval:
                approval_commands = [
                    fields.Command.create(
                        {
                            "approver_id": approver.id,
                            "sequence": sequence,
                            "state": "pending" if sequence == 1 else "waiting",
                        }
                    )
                    for sequence, approver in enumerate(
                        document.folder_id.approver_ids, start=1
                    )
                ]
                document.write(
                    {
                        "approval_ids": approval_commands,
                        "approval_state": "pending",
                        "state": "processing",
                    }
                )
        return documents

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
                continue

            if any(approval.state == "rejected" for approval in approvals):
                document.write(
                    {
                        "approval_state": "rejected",
                        "state": "rejected",
                    }
                )
                continue

            flow = document.folder_id.approval_flow

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
            else:
                document.write({"approval_state": "pending"})

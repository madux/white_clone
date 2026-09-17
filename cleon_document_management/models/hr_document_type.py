from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class DocumentType(models.Model):
    _name = "doc.document.type"
    _description = "Document Category"
    _rec_name = "name"
    _order = "sequence, name"

    name = fields.Char(
        string="Category Name",
        required=True,
    )

    sequence = fields.Integer(
        default=10,
    )

    category = fields.Selection(
        [
            ("hr", "Human Resources"),
            ("finance", "Finance"),
            ("legal", "Legal"),
            ("identity", "Identity"),
            ("employment", "Employment"),
            ("medical", "Medical"),
            ("training", "Training"),
            ("other", "Other"),
        ],
        string="Category Group",
        default="other",
        required=True,
    )

    description = fields.Text()

    is_mandatory_default = fields.Boolean(
        string="Mandatory By Default",
        default=False,
    )

    expiry_applicable = fields.Boolean(
        string="Expiry Applicable",
        default=False,
    )

    require_upload_approval = fields.Boolean(
        string="Require Upload Approval",
        default=False,
        help="Uploads and updates for this document type enter pending approval before becoming current.",
    )

    require_issue_date = fields.Boolean(
        string="Require Issue Date",
        default=False,
    )

    require_description = fields.Boolean(
        string="Require Description",
        default=False,
    )

    enable_versioning = fields.Boolean(
        string="Enable Versioning",
        default=True,
        help="When enabled, managers and employees can replace the current file with a new version.",
    )

    duplicate_detection_mode = fields.Selection(
        [
            ("inherit", "Inherit company default"),
            ("warn", "Warn user"),
            ("prevent", "Prevent duplicate"),
            ("allow_confirm", "Allow with confirmation"),
        ],
        string="Duplicate Handling",
        default="inherit",
    )

    approval_flow = fields.Selection(
        [
            ("any", "Single Approver"),
            ("sequential", "Sequential"),
            ("random", "All Approvers"),
        ],
        string="Approval Flow",
        default="any",
    )

    approver_ids = fields.Many2many(
        "res.users",
        "doc_document_type_approver_rel",
        "document_type_id",
        "user_id",
        string="Approvers",
    )

    approver_order = fields.Char(
        string="Approver Order",
        help="Comma-separated user ids defining sequential approval order.",
    )

    default_retention_years = fields.Integer(
        default=7,
    )

    active = fields.Boolean(
        default=True,
    )

    folder_ids = fields.Many2many(
        "doc.folder",
        "doc_folder_document_type_rel",
        "document_type_id",
        "folder_id",
        string="Allowed Folders",
    )

    intelligence_scope = fields.Selection(
        [
            ("employee", "Employee"),
            ("organization", "Organization"),
        ],
        string="Intelligence Scope",
        default="employee",
    )
    classification_labels = fields.Text(
        string="Classification Labels",
        help="Example phrases used to classify this document type.",
    )
    default_profile_id = fields.Many2one(
        "doc.intelligence.profile",
        string="Default Extraction Profile",
        ondelete="set null",
    )

    @api.constrains("require_upload_approval", "approver_ids", "approval_flow")
    def _check_upload_approval_configuration(self):
        for document_type in self:
            if not document_type.require_upload_approval:
                continue
            if not document_type.approver_ids:
                raise ValidationError(
                    _(
                        "Select at least one approver when upload approval is enabled on %(type)s.",
                        type=document_type.name,
                    )
                )
            if (
                document_type.approval_flow == "sequential"
                and len(document_type.approver_ids) < 1
            ):
                raise ValidationError(
                    _("Sequential approval requires at least one approver.")
                )

    def _get_ordered_approvers(self):
        self.ensure_one()
        approvers = self.approver_ids
        if not self.approver_order:
            return approvers
        order = [
            int(value)
            for value in self.approver_order.split(",")
            if value.isdigit()
        ]
        if not order:
            return approvers
        order_map = {user_id: index for index, user_id in enumerate(order)}
        return approvers.sorted(key=lambda user: order_map.get(user.id, 999))

    def resolve_duplicate_detection_mode(self):
        self.ensure_one()
        if self.duplicate_detection_mode and self.duplicate_detection_mode != "inherit":
            return self.duplicate_detection_mode
        company = self.env.company
        config = self.env["doc.employee.files.config"].get_for_company(company)
        return config.duplicate_detection_mode or "warn"

    def get_upload_approval_config(self):
        self.ensure_one()
        if not self.require_upload_approval:
            return {
                "require_upload_approval": False,
                "approval_flow": "any",
                "approvers": self.env["res.users"],
            }
        return {
            "require_upload_approval": True,
            "approval_flow": self.approval_flow or "any",
            "approvers": self._get_ordered_approvers(),
        }

    def validate_upload_metadata(self, issue_date=None, expiry_date=None, description=None):
        """Raise ValidationError with field-specific messages when metadata is missing."""
        self.ensure_one()
        errors = []
        if self.require_issue_date and not issue_date:
            errors.append(_("Issue date is required for %(type)s.") % {"type": self.name})
        if self.expiry_applicable and not expiry_date:
            errors.append(_("Expiry date is required for %(type)s.") % {"type": self.name})
        if self.require_description and not (description or "").strip():
            errors.append(_("Description is required for %(type)s.") % {"type": self.name})
        if errors:
            raise ValidationError("\n".join(errors))

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "description": self.description or "",
            "is_mandatory_default": self.is_mandatory_default,
            "default_retention_years": self.default_retention_years,
            "expiry_applicable": self.expiry_applicable,
            "require_upload_approval": self.require_upload_approval,
            "require_issue_date": self.require_issue_date,
            "require_description": self.require_description,
            "enable_versioning": self.enable_versioning,
            "duplicate_detection_mode": self.duplicate_detection_mode or "inherit",
            "approval_flow": self.approval_flow or "any",
            "approver_ids": self.approver_ids.ids,
            "approvers": [
                {"id": user.id, "name": user.name}
                for user in self._get_ordered_approvers()
            ],
            "active": self.active,
        }

    def unlink(self):
        Document = self.env["doc.document"]
        Profile = self.env["doc.intelligence.profile"]
        for document_type in self:
            if Document.search_count([("document_type_id", "=", document_type.id)], limit=1):
                raise ValidationError(
                    _(
                        "Cannot delete %(type)s because documents are still classified with it.",
                        type=document_type.name,
                    )
                )
            if document_type.default_profile_id:
                document_type.default_profile_id = False
            profiles = Profile.search([("document_type_id", "=", document_type.id)])
            if profiles:
                profiles.unlink()
        return super().unlink()

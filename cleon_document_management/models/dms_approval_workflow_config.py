# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocApprovalWorkflowService(models.AbstractModel):
    _name = "doc.approval.workflow.service"
    _description = "Global upload approval workflow (Settings → Approval Workflow)"

    @api.model
    def is_enabled(self):
        return (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("cleon_document_management.approval_workflow_enabled", "0")
            == "1"
        )

    @api.model
    def get_upload_approval_config(self):
        """Workspace defaults when workflow is enabled; otherwise no upload approval."""
        users = self.env["res.users"]
        if not self.is_enabled():
            return {
                "require_upload_approval": False,
                "approval_flow": "any",
                "approvers": users,
            }
        params = self.env["ir.config_parameter"].sudo()
        require = (
            params.get_param(
                "cleon_document_management.default_require_upload_approval", "0"
            )
            == "1"
        )
        flow = (
            params.get_param("cleon_document_management.default_approval_flow", "any")
            or "any"
        )
        raw = params.get_param("cleon_document_management.default_approver_ids", "")
        user_ids = [int(value) for value in raw.split(",") if value.isdigit()]
        approvers = self.env["res.users"].browse(user_ids).exists()
        if require and not approvers:
            require = False
        return {
            "require_upload_approval": require,
            "approval_flow": flow,
            "approvers": approvers if require else users,
        }


class DocApprovalWorkflowException(models.Model):
    _name = "doc.approval.workflow.exception"
    _description = "Legacy approval workflow exception (unused; global settings apply)"

    name = fields.Char(required=True)
    active = fields.Boolean(default=True)
    scope = fields.Selection(
        [
            ("folder", "Folder"),
            ("document_type", "Document type"),
            ("category", "Category group"),
        ],
        required=True,
        default="document_type",
    )
    folder_id = fields.Many2one("doc.folder", ondelete="cascade")
    document_type_id = fields.Many2one("doc.document.type", ondelete="cascade")
    require_upload_approval = fields.Boolean(default=True)
    approval_flow = fields.Selection(
        [
            ("any", "Single approver"),
            ("sequential", "Sequential"),
            ("random", "All approvers"),
        ],
        default="any",
    )
    approver_ids = fields.Many2many("res.users", string="Approvers")
    respond_within_hours = fields.Integer(default=48)
    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company
    )


class DocApprovalWorkflowMigration(models.AbstractModel):
    _name = "doc.approval.workflow.migration"
    _description = "Migrate type-level approval settings to global workflow (GL-02)"

    @api.model
    def clear_type_level_approval_config(self):
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
        self.env["doc.approval.workflow.exception"].sudo().search([]).write(
            {"active": False}
        )

    @api.model
    def _merge_legacy_type_approvers_into_settings(self):
        params = self.env["ir.config_parameter"].sudo()
        raw = params.get_param("cleon_document_management.default_approver_ids", "")
        existing = [int(value) for value in raw.split(",") if value.isdigit()]
        if existing:
            return
        legacy_ids = set()
        for document_type in self.env["doc.document.type"].search(
            [("require_upload_approval", "=", True)]
        ):
            legacy_ids.update(document_type.approver_ids.ids)
        if legacy_ids:
            params.set_param(
                "cleon_document_management.default_approver_ids",
                ",".join(str(value) for value in sorted(legacy_ids)),
            )

    @api.model
    def migrate_document_types_to_workflow(self):
        Retention = self.env["doc.retention.policy"].sudo()
        params = self.env["ir.config_parameter"].sudo()
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
        if not params.get_param("cleon_document_management.approval_workflow_enabled"):
            params.set_param("cleon_document_management.approval_workflow_enabled", "0")
        return {"type_approval_cleared": True}

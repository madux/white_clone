# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocWorkspaceGrant(models.Model):
    _name = "doc.workspace.grant"
    _description = "Workspace access grant (owner → delegate)"
    _order = "create_date desc"

    owner_id = fields.Many2one(
        "res.users",
        string="Owner",
        required=True,
        index=True,
        ondelete="cascade",
    )
    delegate_id = fields.Many2one(
        "res.users",
        string="Delegate",
        index=True,
        ondelete="cascade",
    )
    state = fields.Selection(
        [
            ("pending", "Pending"),
            ("active", "Active"),
            ("declined", "Declined"),
            ("revoked", "Revoked"),
            ("cancelled", "Cancelled"),
            ("expired", "Expired"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    valid_from = fields.Datetime(default=fields.Datetime.now)
    valid_until = fields.Datetime(required=True, index=True)
    module_ids = fields.Many2many(
        "doc.workspace.module",
        "doc_workspace_grant_module_rel",
        "grant_id",
        "module_id",
        string="Granted modules",
    )
    invite_code_hash = fields.Char(index=True)
    invite_code_expires_at = fields.Datetime()
    invite_code_attempts = fields.Integer(default=0)
    invite_code_window_start = fields.Datetime()
    note = fields.Text()
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    accepted_at = fields.Datetime()
    revoked_at = fields.Datetime()

    @api.model
    def _cron_expire_grants(self):
        self.env["doc.workspace.access"].expire_cron()

# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models


class CleonAiInteraction(models.Model):
    _name = "cleon.ai.interaction"
    _description = "Cleon AI Conversation Interaction"
    _order = "create_date desc, id desc"

    company_id = fields.Many2one("res.company", required=True, default=lambda self: self.env.company, index=True, ondelete="cascade")
    user_id = fields.Many2one("res.users", required=True, default=lambda self: self.env.user, index=True, ondelete="cascade")
    screen = fields.Char(index=True)
    question = fields.Text(required=True)
    answer = fields.Text(required=True)
    answered = fields.Boolean(default=False)
    provider = fields.Char()
    context_data = fields.Json()
    helpful = fields.Boolean()
    feedback_at = fields.Datetime()

    @api.autovacuum
    def _gc_expired_interactions(self):
        """Purge each company's interactions after its configured retention period."""
        Company = self.env["res.company"].sudo()
        for company in Company.search([]):
            retention = 90
            if "leave_ai_conversation_retention_days" in Company._fields:
                retention = company.leave_ai_conversation_retention_days or 90
            cutoff = fields.Datetime.now() - timedelta(days=max(1, int(retention)))
            self.sudo().search([
                ("company_id", "=", company.id), ("create_date", "<", cutoff),
            ]).unlink()


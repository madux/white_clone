# -*- coding: utf-8 -*-
from odoo import fields, models


class CleonAiConversation(models.Model):
    _name = "cleon.ai.conversation"
    _description = "Cleon AI Conversation"
    _order = "last_message_at desc, id desc"

    company_id = fields.Many2one(
        "res.company", required=True, default=lambda self: self.env.company,
        index=True, ondelete="cascade",
    )
    user_id = fields.Many2one(
        "res.users", required=True, default=lambda self: self.env.user,
        index=True, ondelete="cascade",
    )
    title = fields.Char(required=True)
    preview = fields.Char()
    screen = fields.Char(index=True)
    last_message_at = fields.Datetime(default=fields.Datetime.now, index=True)
    interaction_ids = fields.One2many("cleon.ai.interaction", "conversation_id")

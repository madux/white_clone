# -*- coding: utf-8 -*-
from odoo import fields, models


class DocShareAccessLog(models.Model):
    _name = "doc.share.access.log"
    _description = "External share access log"
    _order = "accessed_at desc"

    share_link_id = fields.Many2one("doc.share.link", ondelete="cascade", index=True)
    accessed_at = fields.Datetime(
        required=True,
        default=fields.Datetime.now,
        index=True,
    )
    ip_address = fields.Char()
    user_agent = fields.Char()
    action = fields.Selection(
        [
            ("view", "View"),
            ("download", "Download"),
            ("auth_failed", "Auth failed"),
        ],
        default="view",
        required=True,
    )

# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import UserError


class DocLegalHold(models.Model):
    _name = "doc.legal.hold"
    _description = "Legal hold on organisational records"
    _order = "create_date desc"

    name = fields.Char(required=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    folder_id = fields.Many2one("doc.folder", ondelete="cascade", index=True)
    document_id = fields.Many2one("doc.document", ondelete="cascade", index=True)
    active = fields.Boolean(default=True)
    reason = fields.Text()
    placed_by_id = fields.Many2one(
        "res.users",
        required=True,
        default=lambda self: self.env.user,
    )
    released_by_id = fields.Many2one("res.users", ondelete="set null")
    released_at = fields.Datetime()

    @api.constrains("folder_id", "document_id")
    def _check_target(self):
        for hold in self:
            if not hold.folder_id and not hold.document_id:
                raise UserError(_("Legal hold requires a folder or document."))

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "active": self.active,
            "folder_id": self.folder_id.id or False,
            "document_id": self.document_id.id or False,
            "reason": self.reason or "",
            "placed_by_name": self.placed_by_id.name,
            "released_at": fields.Datetime.to_string(self.released_at)
            if self.released_at
            else "",
        }

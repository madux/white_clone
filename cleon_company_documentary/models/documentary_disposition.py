from odoo import fields, models


class CompanyDocumentaryDispositionRecord(models.Model):
    _name = "company.documentary.disposition"
    _description = "Company Documentary Disposal Record"
    _order = "purged_at desc"

    media_id = fields.Integer(required=True, index=True)
    title = fields.Char(required=True)
    deleted_by_id = fields.Many2one("res.users")
    deleted_at = fields.Datetime()
    purged_at = fields.Datetime(required=True)
    retention_rule = fields.Char()
    approver_id = fields.Many2one("res.users")
    company_id = fields.Many2one("res.company", required=True, index=True)

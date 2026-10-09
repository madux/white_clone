# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class DocDocumentCategory(models.Model):
    _name = "doc.document.category"
    _description = "Document category (catalogue group)"
    _order = "sequence, name"
    _rec_name = "name"

    name = fields.Char(required=True)
    code = fields.Char(required=True, index=True)
    description = fields.Text()
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    is_catalog_default = fields.Boolean(
        default=False,
        help="Shipped with the product; seeded on every company.",
    )
    company_id = fields.Many2one(
        "res.company",
        index=True,
        help="Leave empty for the shared product catalogue.",
    )
    type_ids = fields.One2many(
        "doc.document.type", "category_id", string="Document types"
    )
    type_count = fields.Integer(compute="_compute_type_count")
    expiring_type_count = fields.Integer(compute="_compute_type_count")

    _sql_constraints = [
        (
            "doc_document_category_code_uniq",
            "unique(code)",
            "Category code must be unique.",
        ),
    ]

    @api.depends("type_ids", "type_ids.active", "type_ids.expiry_applicable")
    def _compute_type_count(self):
        for category in self:
            types = category.type_ids.filtered(lambda item: item.active)
            category.type_count = len(types)
            category.expiring_type_count = len(
                types.filtered(lambda item: item.expiry_applicable)
            )

    @api.constrains("name", "company_id")
    def _check_name_unique(self):
        for category in self:
            duplicate = self.search(
                [
                    ("id", "!=", category.id),
                    ("company_id", "=", category.company_id.id or False),
                    ("name", "=ilike", category.name.strip()),
                ],
                limit=1,
            )
            if duplicate:
                raise ValidationError(
                    _('A category called "%(name)s" already exists.')
                    % {"name": category.name}
                )

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "name": self.name,
            "code": self.code,
            "description": self.description or "",
            "sequence": self.sequence,
            "active": self.active,
            "is_catalog_default": self.is_catalog_default,
            "type_count": self.type_count,
            "expiring_type_count": self.expiring_type_count,
        }

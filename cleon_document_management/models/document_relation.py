# -*- coding: utf-8 -*-
from odoo import fields, models


class DocDocumentRelation(models.Model):
    _name = "doc.document.relation"
    _description = "Document relationship (EF-D8)"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
    )
    source_document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="cascade",
    )
    target_document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="cascade",
    )
    relation_type = fields.Selection(
        [
            ("amendment", "Amendment"),
            ("renewal", "Renewal"),
            ("supporting", "Supporting Document"),
            ("related", "Related"),
        ],
        required=True,
        default="related",
    )

    def serialize_for_api(self):
        self.ensure_one()
        target = self.target_document_id
        return {
            "id": self.id,
            "relation_type": self.relation_type,
            "target_document_id": target.id,
            "target_document_name": target.name,
        }

# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

RELATION_TYPES = [
    ("amendment", "Amendment"),
    ("renewal", "Renewal"),
    ("supporting", "Supporting Document"),
    ("related", "Related"),
]

_OUTGOING_LABELS = {
    "amendment": "Amendment",
    "renewal": "Renewal",
    "supporting": "Supporting document",
    "related": "Related document",
}

_INCOMING_LABELS = {
    "amendment": "Amends this document",
    "renewal": "Renews this document",
    "supporting": "Supports this document",
    "related": "Related to this document",
}


class DocDocumentRelation(models.Model):
    _name = "doc.document.relation"
    _description = "Document relationship (EF-D8)"
    _sql_constraints = [
        (
            "doc_relation_unique_pair",
            "unique(source_document_id, target_document_id, relation_type)",
            "This relationship already exists.",
        ),
    ]

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
        RELATION_TYPES,
        required=True,
        default="related",
    )

    @api.constrains("source_document_id", "target_document_id")
    def _check_distinct_documents(self):
        for relation in self:
            if relation.source_document_id == relation.target_document_id:
                raise ValidationError(_("A document cannot be related to itself."))

    def serialize_for_document(self, document):
        self.ensure_one()
        document.ensure_one()
        source = self.source_document_id
        target = self.target_document_id
        if document.id == source.id:
            other = target
            direction = "outgoing"
            relation_type_label = _OUTGOING_LABELS.get(
                self.relation_type, self.relation_type
            )
        elif document.id == target.id:
            other = source
            direction = "incoming"
            relation_type_label = _INCOMING_LABELS.get(
                self.relation_type, self.relation_type
            )
        else:
            return None
        employee = other.employee_id
        return {
            "id": self.id,
            "relation_type": self.relation_type,
            "relation_type_label": relation_type_label,
            "direction": direction,
            "related_document_id": other.id,
            "related_document_name": other.name,
            "related_employee_id": employee.id if employee else False,
            "related_employee_name": employee.name if employee else "",
            "related_document_type": other.document_type_id.name
            if other.document_type_id
            else "",
        }

    def serialize_for_api(self):
        """Legacy outgoing-only payload."""
        self.ensure_one()
        return self.serialize_for_document(self.source_document_id)

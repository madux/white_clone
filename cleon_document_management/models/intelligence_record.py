from odoo import fields, models


class IntelligenceRecord(models.Model):
    _name = "doc.intelligence.record"
    _description = "Extracted Intelligence Record"
    _order = "id desc"

    job_id = fields.Many2one(
        "doc.intelligence.job",
        required=True,
        ondelete="cascade",
        index=True,
    )
    dataset_id = fields.Many2one(
        related="job_id.dataset_id",
        store=True,
        index=True,
    )
    document_id = fields.Many2one(
        "doc.document",
        required=True,
        ondelete="restrict",
    )
    employee_id = fields.Many2one("hr.employee", related="document_id.employee_id", store=True)
    document_type_id = fields.Many2one("doc.document.type")
    profile_version_id = fields.Many2one("doc.intelligence.profile.version")
    classification_confidence = fields.Float()
    document_confidence = fields.Float()
    review_status = fields.Selection(
        [
            ("extracted", "Extracted"),
            ("needs_review", "Needs review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("overridden", "Overridden"),
            ("superseded", "Superseded"),
        ],
        default="extracted",
        required=True,
        index=True,
    )
    validation_status = fields.Selection(
        [
            ("ok", "OK"),
            ("warning", "Warning"),
            ("blocking", "Blocking"),
        ],
        default="ok",
        required=True,
    )
    extracted_text = fields.Text()
    used_ocr = fields.Boolean()
    page_count = fields.Integer()
    field_ids = fields.One2many(
        "doc.intelligence.extracted.field",
        "record_id",
        string="Fields",
    )
    issue_ids = fields.One2many(
        "doc.intelligence.validation.issue",
        "record_id",
        string="Issues",
    )


class IntelligenceExtractedField(models.Model):
    _name = "doc.intelligence.extracted.field"
    _description = "Extracted Field Value"
    _order = "id"

    record_id = fields.Many2one(
        "doc.intelligence.record",
        required=True,
        ondelete="cascade",
    )
    definition_id = fields.Many2one("doc.intelligence.field", ondelete="set null")
    key = fields.Char(required=True)
    name = fields.Char(required=True)
    field_type = fields.Char()
    value = fields.Char()
    normalized_value = fields.Char()
    confidence = fields.Float()
    source = fields.Char()
    page = fields.Integer()
    citation = fields.Char()
    required = fields.Boolean()


class IntelligenceValidationIssue(models.Model):
    _name = "doc.intelligence.validation.issue"
    _description = "Extraction Validation Issue"

    record_id = fields.Many2one(
        "doc.intelligence.record",
        required=True,
        ondelete="cascade",
    )
    field_key = fields.Char()
    severity = fields.Selection(
        [("warning", "Warning"), ("blocking", "Blocking")],
        default="warning",
        required=True,
    )
    message = fields.Char(required=True)
    resolved = fields.Boolean(default=False)

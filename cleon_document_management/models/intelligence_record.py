from odoo import api, fields, models, _
from odoo.exceptions import UserError


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
    text_source = fields.Selection(
        [
            ("native", "Native file text"),
            ("groq_vision", "Groq vision"),
            ("tesseract", "Tesseract OCR"),
            ("empty", "No text"),
        ],
        default="empty",
    )
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
    chunk_ids = fields.One2many(
        "doc.intelligence.chunk",
        "record_id",
        string="Index chunks",
    )
    review_action_ids = fields.One2many(
        "doc.intelligence.review.action",
        "record_id",
        string="Review actions",
    )
    reviewer_id = fields.Many2one("res.users", readonly=True)
    reviewed_at = fields.Datetime(readonly=True)
    review_comment = fields.Text()

    def _unresolved_blocking(self):
        self.ensure_one()
        return self.issue_ids.filtered(
            lambda issue: issue.severity == "blocking" and not issue.resolved
        )

    def _recompute_validation(self):
        for record in self:
            blocking = record._unresolved_blocking()
            warnings = record.issue_ids.filtered(
                lambda issue: issue.severity == "warning" and not issue.resolved
            )
            if blocking:
                record.validation_status = "blocking"
            elif warnings:
                record.validation_status = "warning"
            else:
                record.validation_status = "ok"

    def _log_review(
        self,
        action,
        reason="",
        field_key="",
        before_value="",
        after_value="",
        issue_id=False,
        comment="",
    ):
        self.ensure_one()
        action_row = self.env["doc.intelligence.review.action"].create(
            {
                "record_id": self.id,
                "action": action,
                "reason": (reason or "").strip(),
                "field_key": field_key or "",
                "before_value": before_value or "",
                "after_value": after_value or "",
                "issue_id": issue_id or False,
                "comment": (comment or "").strip(),
            }
        )
        self.env["doc.intelligence.audit.event"].log_event(
            "review",
            action,
            target=self,
            detail=reason or comment or action,
            before=before_value,
            after=after_value,
            correlation_id="job-%s" % self.job_id.id,
        )
        return action_row

    def _mark_reviewed(self, status, comment=""):
        self.write(
            {
                "review_status": status,
                "reviewer_id": self.env.user.id,
                "reviewed_at": fields.Datetime.now(),
                "review_comment": comment or self.review_comment,
            }
        )

    def action_correct_field(self, field_key, value, reason):
        self.ensure_one()
        if self.review_status not in ("extracted", "needs_review"):
            raise UserError(_("This record is no longer in the review queue."))
        if not (reason or "").strip():
            raise UserError(_("A reason is required when correcting a field."))
        field = self.field_ids.filtered(lambda item: item.key == field_key)[:1]
        if not field:
            raise UserError(_("Unknown field %s.") % field_key)
        before = field.value or ""
        after = (value or "").strip()
        field.write({"value": after, "normalized_value": after, "confidence": 1.0})
        if field.required and after:
            matching = self.issue_ids.filtered(
                lambda issue: issue.field_key == field_key and not issue.resolved
            )
            matching.write({"resolved": True})
        self._recompute_validation()
        self._log_review(
            "correct",
            reason=reason,
            field_key=field_key,
            before_value=before,
            after_value=after,
        )
        return True

    def action_resolve_issue(self, issue_id, reason=""):
        self.ensure_one()
        issue = self.issue_ids.filtered(lambda item: item.id == int(issue_id))[:1]
        if not issue:
            raise UserError(_("Validation issue not found."))
        if issue.resolved:
            return True
        issue.write({"resolved": True})
        self._recompute_validation()
        self._log_review(
            "resolve_issue",
            reason=reason or "Issue marked resolved",
            field_key=issue.field_key or "",
            issue_id=issue.id,
        )
        return True

    def action_add_comment(self, comment):
        self.ensure_one()
        text = (comment or "").strip()
        if not text:
            raise UserError(_("Enter a review comment."))
        self.review_comment = (
            f"{self.review_comment}\n{text}" if self.review_comment else text
        )
        self._log_review("comment", comment=text, reason="Review comment")
        return True

    def action_approve(self, reason=""):
        self.ensure_one()
        if self.review_status not in ("extracted", "needs_review"):
            raise UserError(_("This record is no longer in the review queue."))
        blocking = self._unresolved_blocking()
        if blocking:
            raise UserError(
                _("Resolve blocking issues before approval, or use override with a reason.")
            )
        self._mark_reviewed("approved", comment=reason)
        self._log_review("approve", reason=reason or "Approved")
        self.env["doc.intelligence.chunk"].index_record(self)
        return True

    def action_reject(self, reason):
        self.ensure_one()
        if self.review_status not in ("extracted", "needs_review"):
            raise UserError(_("This record is no longer in the review queue."))
        if not (reason or "").strip():
            raise UserError(_("A reason is required to reject a record."))
        self._mark_reviewed("rejected", comment=reason)
        self._log_review("reject", reason=reason)
        self.chunk_ids.unlink()
        return True

    def action_override(self, reason):
        self.ensure_one()
        if self.review_status not in ("extracted", "needs_review"):
            raise UserError(_("This record is no longer in the review queue."))
        if not (reason or "").strip():
            raise UserError(_("A reason is required to override the AI result."))
        self._unresolved_blocking().write({"resolved": True})
        self._recompute_validation()
        self._mark_reviewed("overridden", comment=reason)
        self._log_review("override", reason=reason)
        self.env["doc.intelligence.chunk"].index_record(self)
        return True

    @api.model
    def action_bulk_approve_safe(self, record_ids=None):
        domain = [("review_status", "in", ["extracted", "needs_review"])]
        if record_ids:
            domain.append(("id", "in", [int(value) for value in record_ids]))
        approved = self.env["doc.intelligence.record"]
        for record in self.search(domain):
            threshold = (record.dataset_id.auto_approve_threshold or 85) / 100.0
            if record._unresolved_blocking():
                continue
            if (record.document_confidence or 0) < threshold:
                continue
            record.action_approve(reason="Bulk approve of high-confidence records")
            approved |= record
        return approved


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


class IntelligenceReviewAction(models.Model):
    _name = "doc.intelligence.review.action"
    _description = "Intelligence Review Action"
    _order = "id desc"

    record_id = fields.Many2one(
        "doc.intelligence.record",
        required=True,
        ondelete="cascade",
        index=True,
    )
    user_id = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        required=True,
        readonly=True,
    )
    action = fields.Selection(
        [
            ("approve", "Approve"),
            ("reject", "Reject"),
            ("override", "Override"),
            ("correct", "Correct field"),
            ("resolve_issue", "Resolve issue"),
            ("comment", "Comment"),
        ],
        required=True,
    )
    field_key = fields.Char()
    before_value = fields.Text()
    after_value = fields.Text()
    reason = fields.Char()
    comment = fields.Text()
    issue_id = fields.Many2one("doc.intelligence.validation.issue", ondelete="set null")

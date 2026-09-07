import json
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


CONFIDENCE_PRESETS = {
    "relaxed": (75, 40),
    "balanced": (85, 50),
    "strict": (92, 65),
}


class IntelligenceDataset(models.Model):
    _name = "doc.intelligence.dataset"
    _description = "Document Intelligence Dataset"
    _order = "write_date desc"

    name = fields.Char(required=True)
    source = fields.Selection(
        [
            ("employee", "Employee Files"),
            ("organizational", "Organizational Files"),
            ("upload", "Direct upload"),
            ("external", "External source"),
        ],
    )
    processing_mode = fields.Selection(
        [
            ("fast", "Fast"),
            ("balanced", "Balanced"),
            ("conservative", "Conservative"),
        ],
        default="balanced",
        required=True,
    )
    scope_kind = fields.Selection(
        [
            ("one_employee", "One employee"),
            ("multiple_employees", "Multiple employees"),
            ("department", "Department"),
            ("business_unit", "Business unit"),
            ("location", "Location"),
            ("grade", "Grade"),
            ("employment_type", "Employment type"),
            ("company", "Entire company"),
        ],
        default="company",
        required=True,
    )
    scope_ids_json = fields.Char(default="[]")
    auto_classify = fields.Boolean(default=False)
    document_type_ids = fields.Many2many(
        "doc.document.type",
        "doc_intelligence_dataset_type_rel",
        "dataset_id",
        "document_type_id",
    )
    field_keys_json = fields.Char(default="[]")
    confidence_preset = fields.Selection(
        [
            ("relaxed", "Relaxed"),
            ("balanced", "Balanced"),
            ("strict", "Strict"),
        ],
        default="balanced",
        required=True,
    )
    auto_approve_threshold = fields.Integer(default=85)
    review_below_threshold = fields.Integer(default=50)
    ocr_fallback = fields.Boolean(default=True)
    deduplicate = fields.Boolean(default=True)
    masking = fields.Boolean(default=True)
    audit_logging = fields.Boolean(default=True)
    wizard_step = fields.Integer(default=0)
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("queued", "Queued"),
            ("running", "Running"),
            ("paused", "Paused"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("needs_review", "Needs review"),
            ("cancelled", "Cancelled"),
        ],
        default="draft",
        required=True,
        index=True,
    )
    owner_id = fields.Many2one(
        "res.users",
        default=lambda self: self.env.user,
        required=True,
    )
    company_id = fields.Many2one(
        "res.company",
        default=lambda self: self.env.company,
        required=True,
    )
    profile_version_ids = fields.Many2many(
        "doc.intelligence.profile.version",
        "doc_intelligence_dataset_profile_version_rel",
        "dataset_id",
        "version_id",
        string="Frozen profile versions",
    )
    job_ids = fields.One2many(
        "doc.intelligence.job",
        "dataset_id",
        string="Jobs",
    )
    latest_job_id = fields.Many2one(
        "doc.intelligence.job",
        compute="_compute_latest_job",
    )
    record_count = fields.Integer(default=0)
    field_count = fields.Integer(compute="_compute_field_count")
    average_confidence = fields.Float(default=0.0)
    archived = fields.Boolean(default=False)

    @api.depends("field_keys_json")
    def _compute_field_count(self):
        for dataset in self:
            dataset.field_count = len(dataset._field_keys())

    @api.depends("job_ids", "job_ids.create_date")
    def _compute_latest_job(self):
        for dataset in self:
            dataset.latest_job_id = dataset.job_ids[:1]

    def _field_keys(self):
        self.ensure_one()
        try:
            keys = json.loads(self.field_keys_json or "[]")
        except json.JSONDecodeError:
            return []
        return [str(key) for key in keys if key]

    def _scope_ids(self):
        self.ensure_one()
        try:
            values = json.loads(self.scope_ids_json or "[]")
        except json.JSONDecodeError:
            return []
        return [int(value) for value in values if value]

    def _snapshot_thresholds(self):
        auto, review = CONFIDENCE_PRESETS.get(
            self.confidence_preset or "balanced", (85, 50)
        )
        self.auto_approve_threshold = auto
        self.review_below_threshold = review

    def _snapshot_profiles(self):
        versions = self.env["doc.intelligence.profile.version"]
        for document_type in self.document_type_ids:
            profile = document_type.default_profile_id
            if profile and profile.current_version_id:
                versions |= profile.current_version_id
        self.profile_version_ids = versions

    def _validate_run(self):
        self.ensure_one()
        if self.source == "external":
            raise ValidationError(
                _("External connectors are not available in this application yet.")
            )
        if not self.source:
            raise ValidationError(_("Choose a repository source."))
        if not self.auto_classify and not self.document_type_ids:
            raise ValidationError(
                _("A dataset cannot run with zero document types.")
            )
        if not self._field_keys():
            raise ValidationError(_("A dataset cannot run with zero fields."))
        if not (self.name or "").strip():
            raise ValidationError(_("Give the dataset a name."))

    @api.model
    def save_draft(self, values, dataset_id=False):
        payload = dict(values or {})
        if not payload.get("name"):
            payload["name"] = _("Untitled draft")
        payload["state"] = "draft"
        if dataset_id:
            dataset = self.browse(int(dataset_id)).exists()
            if not dataset:
                raise ValidationError(_("Dataset not found."))
            if dataset.state not in ("draft", "failed", "cancelled"):
                raise ValidationError(
                    _("Only draft datasets can be edited in the wizard.")
                )
            dataset.write(payload)
        else:
            payload.setdefault("owner_id", self.env.user.id)
            dataset = self.create(payload)
        dataset._snapshot_thresholds()
        dataset._snapshot_profiles()
        return dataset

    def action_run(self):
        self.ensure_one()
        self._validate_run()
        self._snapshot_thresholds()
        self._snapshot_profiles()
        self.env.cr.execute(
            "SELECT id FROM doc_intelligence_dataset WHERE id = %s FOR UPDATE",
            [self.id],
        )
        active = self.job_ids.filtered(lambda job: job.state in ("queued", "running"))
        if active:
            job = active[0]
            job.action_process(limit=25)
            return job
        job = self.env["doc.intelligence.job"].create(
            {
                "dataset_id": self.id,
                "state": "queued",
                "document_count": 0,
                "progress": 0,
            }
        )
        self.state = "queued"
        job.action_process(limit=25)
        return job

    def _source_documents(self):
        self.ensure_one()
        domain = [("active", "=", True)]
        folder_type = "organizational"
        if self.source == "employee":
            folder_type = "employee"
        if self.source in ("employee", "organizational", "upload"):
            domain.append(("folder_id.folder_type", "=", folder_type))
        if not self.auto_classify and self.document_type_ids:
            domain.append(("document_type_id", "in", self.document_type_ids.ids))
        scope_ids = self._scope_ids()
        if self.scope_kind in ("one_employee", "multiple_employees") and scope_ids:
            domain.append(("employee_id", "in", scope_ids))
        elif self.scope_kind == "department" and scope_ids:
            domain.append(("employee_id.department_id", "in", scope_ids))
        elif self.scope_kind == "grade" and scope_ids:
            domain.append(("folder_id.grade_ids", "in", scope_ids))
        elif self.scope_kind == "business_unit" and scope_ids:
            domain.append(("folder_id.branch_ids", "in", scope_ids))
        elif self.scope_kind == "employment_type" and scope_ids:
            domain.append(("folder_id.employment_type_ids", "in", scope_ids))
        documents = self.env["doc.document"].search(domain, limit=200)
        if self.deduplicate:
            seen = set()
            unique = self.env["doc.document"]
            for document in documents:
                stamp = document.checksum or document.attachment_id.id
                if stamp in seen:
                    continue
                seen.add(stamp)
                unique |= document
            documents = unique
        return documents


class IntelligenceJob(models.Model):
    _name = "doc.intelligence.job"
    _description = "Document Intelligence Extraction Job"
    _order = "id desc"

    dataset_id = fields.Many2one(
        "doc.intelligence.dataset",
        required=True,
        ondelete="cascade",
    )
    state = fields.Selection(
        [
            ("draft", "Draft"),
            ("queued", "Queued"),
            ("running", "Running"),
            ("paused", "Paused"),
            ("completed", "Completed"),
            ("failed", "Failed"),
            ("needs_review", "Needs review"),
            ("cancelled", "Cancelled"),
        ],
        default="queued",
        required=True,
        index=True,
    )
    document_count = fields.Integer(default=0)
    processed_count = fields.Integer(default=0)
    progress = fields.Float(default=0)
    error_message = fields.Text()
    owner_id = fields.Many2one(
        related="dataset_id.owner_id",
        store=True,
    )
    company_id = fields.Many2one(
        related="dataset_id.company_id",
        store=True,
    )
    record_ids = fields.One2many(
        "doc.intelligence.record",
        "job_id",
        string="Records",
    )

    def action_process(self, limit=20):
        from .intelligence_pipeline import (
            classify_document,
            extract_document_text,
            extract_field_value,
        )

        for job in self:
            if job.state in ("completed", "failed", "cancelled", "paused"):
                continue
            dataset = job.dataset_id
            job.state = "running"
            dataset.state = "running"
            documents = dataset._source_documents()
            job.document_count = len(documents)
            done_ids = set(job.record_ids.mapped("document_id").ids)
            pending = documents.filtered(lambda document: document.id not in done_ids)
            batch = pending[:limit]
            field_keys = set(dataset._field_keys())
            for document in batch:
                job._process_document(
                    document,
                    field_keys,
                    classify_document,
                    extract_document_text,
                    extract_field_value,
                )
            job.processed_count = len(job.record_ids)
            job.progress = (
                100.0
                if not job.document_count
                else round(100.0 * job.processed_count / job.document_count, 1)
            )
            remaining = job.document_count - job.processed_count
            records = job.record_ids
            confidences = records.mapped("document_confidence")
            dataset.record_count = len(records)
            dataset.average_confidence = (
                sum(confidences) / len(confidences) if confidences else 0.0
            )
            if remaining > 0:
                job.state = "queued"
                dataset.state = "queued"
                continue
            if not documents:
                job.state = "completed"
                job.error_message = _("No source documents matched this dataset.")
                dataset.state = "completed"
                continue
            if records.filtered(lambda record: record.review_status == "needs_review"):
                job.state = "needs_review"
                dataset.state = "needs_review"
            else:
                job.state = "completed"
                dataset.state = "completed"
        return True

    def _process_document(
        self,
        document,
        field_keys,
        classify_document,
        extract_document_text,
        extract_field_value,
    ):
        self.ensure_one()
        dataset = self.dataset_id
        text, used_ocr, pages = extract_document_text(
            document.attachment_id, ocr_fallback=dataset.ocr_fallback
        )
        if text:
            document.action_mark_ocr_completed(text)
        document_type, class_conf, _alts = classify_document(document, dataset)
        profile = document_type.default_profile_id if document_type else False
        version = False
        if profile:
            version = (
                dataset.profile_version_ids.filtered(
                    lambda item: item.profile_id == profile
                )[:1]
                or profile.current_version_id
            )
        definitions = version.field_ids if version else self.env["doc.intelligence.field"]
        if field_keys:
            definitions = definitions.filtered(lambda item: item.key in field_keys)
        record = self.env["doc.intelligence.record"].create(
            {
                "job_id": self.id,
                "document_id": document.id,
                "document_type_id": document_type.id if document_type else False,
                "profile_version_id": version.id if version else False,
                "classification_confidence": class_conf,
                "extracted_text": text,
                "used_ocr": used_ocr,
                "page_count": pages,
            }
        )
        field_confidences = []
        blocking = False
        for definition in definitions:
            extracted = extract_field_value(definition, text, document)
            self.env["doc.intelligence.extracted.field"].create(
                {
                    "record_id": record.id,
                    "definition_id": definition.id,
                    "key": definition.key,
                    "name": definition.name,
                    "field_type": definition.field_type,
                    "value": extracted["value"],
                    "normalized_value": extracted["normalized_value"],
                    "confidence": extracted["confidence"],
                    "source": extracted["source"],
                    "page": extracted["page"],
                    "citation": extracted["citation"],
                    "required": definition.required,
                }
            )
            field_confidences.append(extracted["confidence"])
            if definition.required and not extracted["value"]:
                blocking = True
                self.env["doc.intelligence.validation.issue"].create(
                    {
                        "record_id": record.id,
                        "field_key": definition.key,
                        "severity": "blocking",
                        "message": _("Required field %s is missing.") % definition.name,
                    }
                )
        avg = (
            sum(field_confidences) / len(field_confidences) if field_confidences else 0.0
        )
        avg = (avg + class_conf) / 2.0
        auto = (dataset.auto_approve_threshold or 85) / 100.0
        review = (dataset.review_below_threshold or 50) / 100.0
        if blocking or avg < auto:
            status = "needs_review"
            validation = "blocking" if blocking else "warning"
        else:
            status = "approved"
            validation = "ok"
        if avg < review:
            status = "needs_review"
        record.write(
            {
                "document_confidence": avg,
                "review_status": status,
                "validation_status": validation,
            }
        )

    @api.model
    def _cron_process_jobs(self):
        jobs = self.search(
            [("state", "in", ["queued", "running"])],
            limit=5,
        )
        jobs.action_process(limit=15)

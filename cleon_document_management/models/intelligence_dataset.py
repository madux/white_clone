import json
import logging
from datetime import datetime, timedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError

_logger = logging.getLogger(__name__)


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

    @api.model
    def _domain_from_values(
        self,
        source,
        scope_kind="company",
        scope_ids=None,
        document_type_ids=None,
        auto_classify=False,
    ):
        source = source or ""
        if source in ("upload", "external", ""):
            return [("id", "=", 0)]
        domain = [
            ("active", "=", True),
            (
                "folder_id.folder_type",
                "=",
                "employee" if source == "employee" else "organizational",
            ),
        ]
        type_ids = [int(value) for value in (document_type_ids or []) if value]
        if not auto_classify and type_ids:
            domain.append(("document_type_id", "in", type_ids))
        if source != "employee":
            return domain
        ids = [int(value) for value in (scope_ids or []) if value]
        kind = scope_kind or "company"
        employee = self.env["hr.employee"]
        if kind in ("one_employee", "multiple_employees") and ids:
            domain.append(("employee_id", "in", ids))
        elif kind == "department" and ids:
            domain.append(("employee_id.department_id", "in", ids))
        elif kind == "grade" and ids:
            if "grade_id" in employee._fields:
                domain.append(("employee_id.grade_id", "in", ids))
            else:
                domain.append(("folder_id.grade_ids", "in", ids))
        elif kind == "business_unit" and ids:
            if "branch_id" in employee._fields:
                domain.append(("employee_id.branch_id", "in", ids))
            else:
                domain.append(("folder_id.branch_ids", "in", ids))
        elif kind == "employment_type" and ids:
            if "employee_type_id" in employee._fields:
                domain.append(("employee_id.employee_type_id", "in", ids))
            else:
                domain.append(("folder_id.employment_type_ids", "in", ids))
        elif kind == "location" and ids:
            if "work_location_id" in employee._fields:
                domain.append(("employee_id.work_location_id", "in", ids))
        return domain

    def _source_documents(self):
        self.ensure_one()
        domain = self._domain_from_values(
            self.source,
            self.scope_kind,
            self._scope_ids(),
            self.document_type_ids.ids,
            self.auto_classify,
        )
        documents = self.env["doc.document"].search(domain)
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

    @api.model
    def wizard_options(self):
        Document = self.env["doc.document"]
        employee_domain = [
            ("active", "=", True),
            ("folder_id.folder_type", "=", "employee"),
        ]
        org_domain = [
            ("active", "=", True),
            ("folder_id.folder_type", "=", "organizational"),
        ]
        user = self.env.user
        is_manager = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        ) or user.has_group("cleon_document_management.group_document_manager")
        employee = user.employee_id
        employees = self.env["hr.employee"].search(
            [("active", "=", True)] if is_manager else [("id", "=", employee.id or 0)],
            order="name",
            limit=500,
        )
        departments = self.env["hr.department"].search(
            [] if is_manager else [("id", "=", employee.department_id.id or 0)],
            order="name",
        )
        grades = []
        if "hr.grade" in self.env:
            grades = self.env["hr.grade"].search(
                [] if is_manager else [("id", "=", employee.grade_id.id or 0)],
                order="name",
            )
        branches = self.env["hr.branch"]
        if "hr.branch" in self.env:
            branches = self.env["hr.branch"].search([], order="name")
        elif "eha.branch" in self.env:
            branches = self.env["eha.branch"].search([], order="name")
        employment_types = self.env["hr.core_employment_type"]
        if "hr.core_employment_type" in self.env:
            employment_types = self.env["hr.core_employment_type"].search([], order="name")
        locations = []
        if "work_location_id" in self.env["hr.employee"]._fields:
            Location = self.env["hr.employee"]._fields["work_location_id"].comodel_name
            if Location:
                locations = [
                    {"id": item.id, "name": item.display_name}
                    for item in self.env[Location].search([], order="name")
                ]
        return {
            "sources": {
                "employee": Document.search_count(employee_domain),
                "organizational": Document.search_count(org_domain),
                "upload": 0,
                "external": 0,
            },
            "employees": [
                {
                    "id": item.id,
                    "name": item.name,
                    "department": item.department_id.name or "",
                }
                for item in employees
            ],
            "departments": [{"id": item.id, "name": item.name} for item in departments],
            "grades": [{"id": item.id, "name": item.name} for item in grades],
            "business_units": [{"id": item.id, "name": item.display_name} for item in branches],
            "employment_types": [
                {"id": item.id, "name": item.display_name} for item in employment_types
            ],
            "locations": locations,
        }

    @api.model
    def wizard_estimate(self, values):
        values = values or {}
        domain = self._domain_from_values(
            values.get("source"),
            values.get("scope_kind") or "company",
            values.get("scope_ids") or [],
            values.get("document_type_ids") or [],
            bool(values.get("auto_classify")),
        )
        document_count = self.env["doc.document"].search_count(domain)
        groups = self.env["doc.document"].read_group(
            domain + [("employee_id", "!=", False)],
            ["employee_id"],
            ["employee_id"],
        )
        return {
            "document_count": document_count,
            "employee_count": len(groups),
        }

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
        if not self.source:
            raise ValidationError(_("Choose a repository source."))
        if self.source == "external":
            raise ValidationError(
                _("External connectors are not available in this application yet.")
            )
        if self.source == "upload":
            raise ValidationError(
                _("Direct upload is not available in this wizard yet. Choose Employee or Organizational Files.")
            )
        if self.source == "employee" and self.scope_kind != "company" and not self._scope_ids():
            raise ValidationError(_("Select who this dataset covers."))
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
            created = False
        else:
            payload.setdefault("owner_id", self.env.user.id)
            dataset = self.create(payload)
            created = True
        dataset._snapshot_thresholds()
        dataset._snapshot_profiles()
        self.env["doc.intelligence.audit.event"].log_dataset(
            dataset,
            "dataset",
            "created" if created else "updated",
            detail="Wizard draft saved.",
        )
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
        self.env["doc.intelligence.audit.event"].log_dataset(
            self,
            "dataset",
            "run",
            target=job,
            detail="Extraction job queued.",
            correlation_id="job-%s" % job.id,
        )
        job.action_process(limit=25)
        return job

    def _ensure_can_delete(self):
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )
        for dataset in self:
            if not is_admin and dataset.owner_id != user:
                raise AccessError(_("You can only delete datasets you own."))

    def action_delete(self):
        self._ensure_can_delete()
        self.job_ids.filtered(
            lambda job: job.state in ("queued", "running", "paused")
        ).write({"state": "cancelled"})
        self.unlink()
        return True

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
            try:
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
                    self.env["doc.intelligence.audit.event"].log_dataset(
                        dataset,
                        "extraction",
                        "completed",
                        target=job,
                        detail=job.error_message,
                        severity="warning",
                        correlation_id="job-%s" % job.id,
                    )
                    continue
                if records.filtered(lambda record: record.review_status == "needs_review"):
                    job.state = "needs_review"
                    dataset.state = "needs_review"
                else:
                    job.state = "completed"
                    dataset.state = "completed"
                self.env["doc.intelligence.audit.event"].log_dataset(
                    dataset,
                    "extraction",
                    "completed",
                    target=job,
                    detail="Processed %s document(s)." % job.processed_count,
                    correlation_id="job-%s" % job.id,
                )
            except Exception as error:
                _logger.exception("Intelligence job %s failed", job.id)
                job.state = "failed"
                job.error_message = str(error)
                job.dataset_id.state = "failed"
                self.env["doc.intelligence.audit.event"].log_event(
                    "extraction",
                    "failed",
                    target=job,
                    detail=str(error),
                    severity="error",
                    correlation_id="job-%s" % job.id,
                )
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
        text, text_source, pages = extract_document_text(
            document.attachment_id,
            ocr_fallback=dataset.ocr_fallback,
            env=self.env,
        )
        used_ocr = text_source in ("groq_vision", "tesseract")
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
                "text_source": text_source or "empty",
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
        if not text:
            blocking = True
            self.env["doc.intelligence.validation.issue"].create(
                {
                    "record_id": record.id,
                    "severity": "blocking",
                    "message": _(
                        "No text could be read from this file. "
                        "Native PDF/Word/Excel is supported. Images and scanned PDFs "
                        "need GROQ_API_KEY for vision, or Tesseract as a fallback. "
                        "Legacy .doc files should be saved as .docx."
                    ),
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
                validation = "warning"
        record.write(
            {
                "document_confidence": avg,
                "review_status": status,
                "validation_status": validation,
            }
        )
        if status == "approved":
            self.env["doc.intelligence.chunk"].index_record(record)

    def action_pause(self):
        for job in self:
            if job.state not in ("queued", "running"):
                raise UserError(_("Only queued or running jobs can be paused."))
            job.state = "paused"
            job.dataset_id.state = "paused"
            self.env["doc.intelligence.audit.event"].log_dataset(
                job.dataset_id,
                "job",
                "paused",
                target=job,
                correlation_id="job-%s" % job.id,
            )
        return True

    def action_resume(self):
        for job in self:
            if job.state != "paused":
                raise UserError(_("Only paused jobs can be resumed."))
            job.state = "queued"
            job.dataset_id.state = "queued"
            self.env["doc.intelligence.audit.event"].log_dataset(
                job.dataset_id,
                "job",
                "resumed",
                target=job,
                correlation_id="job-%s" % job.id,
            )
        return True

    def action_retry(self):
        for job in self:
            if job.state not in ("failed", "cancelled", "completed"):
                raise UserError(_("Retry is only available after a job finishes or fails."))
            job.error_message = False
            job.state = "queued"
            job.dataset_id.state = "queued"
            self.env["doc.intelligence.audit.event"].log_dataset(
                job.dataset_id,
                "job",
                "retried",
                target=job,
                correlation_id="job-%s" % job.id,
            )
            job.action_process(limit=25)
        return True

    @api.model
    def _cron_process_jobs(self):
        jobs = self.search(
            [("state", "in", ["queued", "running"])],
            limit=5,
        )
        jobs.action_process(limit=15)

    @api.model
    def overview_data(self):
        Job = self.env["doc.intelligence.job"]
        Record = self.env["doc.intelligence.record"]
        Field = self.env["doc.intelligence.extracted.field"]
        user = self.env.user
        is_admin = user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )
        job_domain = [] if is_admin else [("owner_id", "=", user.id)]
        record_domain = (
            []
            if is_admin
            else [("dataset_id.owner_id", "=", user.id)]
        )
        jobs = Job.search(job_domain, limit=20)
        reviewed = Record.search(
            record_domain
            + [("review_status", "in", ["approved", "rejected", "overridden"])]
        )
        accepted = reviewed.filtered(
            lambda record: record.review_status in ("approved", "overridden")
        )
        approved = Record.search(
            record_domain + [("review_status", "=", "approved")]
        )
        queue_count = Record.search_count(
            record_domain
            + [("review_status", "in", ["needs_review", "extracted"])]
        )
        extraction = None
        extraction_source = "none"
        if reviewed:
            extraction = round(100.0 * len(accepted) / len(reviewed), 1)
            extraction_source = "reviewed"
        classification = None
        classification_source = "none"
        if approved:
            scores = approved.mapped("classification_confidence")
            classification = round(
                100.0 * (sum(scores) / len(scores) if scores else 0.0), 1
            )
            classification_source = "estimated"
        quality = None
        quality_source = "none"
        if approved:
            ok = len(approved.filtered(lambda record: record.validation_status == "ok"))
            quality = round(100.0 * ok / len(approved), 1)
            quality_source = "approved"
        today = fields.Date.context_today(self)
        horizon = today + timedelta(days=60)
        expiring = []
        date_keys = (
            "end_date",
            "expiry_date",
            "contract_end",
            "valid_until",
            "expiration_date",
        )
        date_fields = Field.search(
            [
                ("key", "in", date_keys),
                ("record_id.review_status", "in", ["approved", "overridden"]),
            ]
            + (
                []
                if is_admin
                else [("record_id.dataset_id.owner_id", "=", user.id)]
            )
        )
        for item in date_fields:
            parsed = _parse_overview_date(item.normalized_value or item.value)
            if parsed and today <= parsed <= horizon:
                expiring.append(
                    {
                        "record_id": item.record_id.id,
                        "document": item.record_id.document_id.name,
                        "employee": item.record_id.employee_id.name or "",
                        "date": str(parsed),
                        "field": item.name,
                    }
                )
        probation_fields = Field.search(
            [
                ("key", "ilike", "probation"),
                ("record_id.review_status", "in", ["approved", "overridden"]),
            ]
            + (
                []
                if is_admin
                else [("record_id.dataset_id.owner_id", "=", user.id)]
            )
        )
        probation = []
        for item in probation_fields:
            parsed = _parse_overview_date(item.normalized_value or item.value)
            if parsed and parsed >= today:
                probation.append(
                    {
                        "record_id": item.record_id.id,
                        "document": item.record_id.document_id.name,
                        "employee": item.record_id.employee_id.name or "",
                        "date": str(parsed),
                    }
                )
        failed = jobs.filtered(
            lambda job: job.state == "failed"
            or (job.error_message and job.state in ("completed", "failed"))
        )
        return {
            "queue_count": queue_count,
            "reviewed_count": len(reviewed),
            "approved_count": len(approved),
            "metrics": {
                "extraction_accuracy": extraction,
                "extraction_source": extraction_source,
                "classification_accuracy": classification,
                "classification_source": classification_source,
                "data_quality": quality,
                "data_quality_source": quality_source,
            },
            "jobs": [
                {
                    "id": job.id,
                    "state": job.state,
                    "document_count": job.document_count,
                    "processed_count": job.processed_count,
                    "progress": job.progress,
                    "error_message": job.error_message or "",
                    "create_date": str(job.create_date or ""),
                    "dataset_id": job.dataset_id.id,
                    "dataset": job.dataset_id.name,
                    "source": job.dataset_id.source or "",
                    "owner_name": job.owner_id.name or "",
                }
                for job in jobs
            ],
            "attention": {
                "failed": [
                    {
                        "id": job.id,
                        "dataset": job.dataset_id.name,
                        "reason": job.error_message or "Job failed.",
                    }
                    for job in failed
                ],
                "expiring": expiring[:10],
                "probation": probation[:10],
            },
        }


def _parse_overview_date(value):
    text = (value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y", "%d %B %Y", "%d %b %Y"):
        try:
            return datetime.strptime(text[:32], fmt).date()
        except ValueError:
            continue
    if len(text) >= 10:
        try:
            return datetime.strptime(text[:10], "%Y-%m-%d").date()
        except ValueError:
            return None
    return None

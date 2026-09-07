import json
from odoo import api, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request


class DocumentIntelligenceController(http.Controller):
    """JSON-RPC APIs for Document Intelligence configuration."""

    def _is_admin(self):
        user = request.env.user
        return user.has_group("base.group_system") or user.has_group(
            "cleon_document_management.group_document_admin"
        )

    def _deny(self, message="You are not allowed to change Intelligence configuration."):
        request.env["doc.intelligence.audit.event"].log_event(
            "permission",
            "denied",
            detail=message,
            severity="warning",
        )
        return {"success": False, "message": message}

    def _type_data(self, document_type):
        profile = document_type.default_profile_id
        return {
            "id": document_type.id,
            "name": document_type.name,
            "description": document_type.description or "",
            "category": document_type.category or "other",
            "intelligence_scope": document_type.intelligence_scope or "employee",
            "classification_labels": document_type.classification_labels or "",
            "active": document_type.active,
            "is_mandatory_default": document_type.is_mandatory_default,
            "default_retention_years": document_type.default_retention_years,
            "default_profile_id": profile.id if profile else False,
            "default_profile": profile.name if profile else "",
        }

    def _field_data(self, field):
        return {
            "id": field.id,
            "name": field.name,
            "key": field.key,
            "field_type": field.field_type,
            "required": field.required,
            "description": field.description or "",
            "example": field.example or "",
            "sequence": field.sequence,
            "validation_json": field.validation_json or "",
            "profile": field.version_id.profile_id.name,
            "profile_version": field.version_id.version,
        }

    def _profile_data(self, profile):
        version = profile.current_version_id
        fields_payload = [
            self._field_data(field) for field in (version.field_ids if version else [])
        ]
        return {
            "id": profile.id,
            "name": profile.name,
            "document_type_id": profile.document_type_id.id,
            "document_type": profile.document_type_id.name,
            "is_system": profile.is_system,
            "active": profile.active,
            "version": version.version if version else 0,
            "version_id": version.id if version else False,
            "extraction_instructions": version.extraction_instructions if version else "",
            "examples": version.examples if version else "",
            "fields": fields_payload,
        }

    def _replace_fields(self, version, fields_payload):
        version.field_ids.unlink()
        for index, item in enumerate(fields_payload or [], start=1):
            key = (item.get("key") or item.get("name") or "").strip().lower().replace(" ", "_")
            name = (item.get("name") or key or "").strip()
            if not name or not key:
                continue
            request.env["doc.intelligence.field"].create(
                {
                    "version_id": version.id,
                    "sequence": item.get("sequence") or index * 10,
                    "name": name,
                    "key": key,
                    "field_type": item.get("field_type") or "text",
                    "required": bool(item.get("required")),
                    "description": item.get("description") or "",
                    "example": item.get("example") or "",
                    "validation_json": item.get("validation_json") or "",
                }
            )

    @http.route(
        "/api/document-intelligence/document-types",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def document_types(self, **kwargs):
        domain = []
        if kwargs.get("active_only"):
            domain.append(("active", "=", True))
        types = request.env["doc.document.type"].search(domain, order="sequence, name")
        return {
            "success": True,
            "data": [self._type_data(item) for item in types],
        }

    @http.route(
        "/api/document-intelligence/document-types/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_document_type(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        name = (kwargs.get("name") or "").strip()
        if not name:
            return {"success": False, "message": "Name is required."}
        values = {
            "name": name,
            "description": kwargs.get("description") or "",
            "category": kwargs.get("category") or "other",
            "intelligence_scope": kwargs.get("intelligence_scope") or "employee",
            "classification_labels": kwargs.get("classification_labels") or "",
            "active": kwargs.get("active", True),
            "is_mandatory_default": bool(kwargs.get("is_mandatory_default")),
        }
        if kwargs.get("default_profile_id"):
            values["default_profile_id"] = int(kwargs["default_profile_id"])
        record = request.env["doc.document.type"].create(values)
        request.env["doc.intelligence.audit.event"].log_event(
            "rule",
            "document_type_created",
            target=record,
        )
        return {"success": True, "data": self._type_data(record)}

    @http.route(
        "/api/document-intelligence/document-types/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_document_type(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        record = request.env["doc.document.type"].browse(int(kwargs.get("id") or 0)).exists()
        if not record:
            return {"success": False, "message": "Document type not found."}
        values = {}
        for key in (
            "name",
            "description",
            "category",
            "intelligence_scope",
            "classification_labels",
            "active",
            "is_mandatory_default",
            "default_profile_id",
        ):
            if key in kwargs:
                values[key] = kwargs.get(key)
        record.write(values)
        request.env["doc.intelligence.audit.event"].log_event(
            "rule",
            "document_type_updated",
            target=record,
        )
        return {"success": True, "data": self._type_data(record)}

    @http.route(
        "/api/document-intelligence/profiles",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def profiles(self, **kwargs):
        domain = []
        if kwargs.get("active_only"):
            domain.append(("active", "=", True))
        if kwargs.get("document_type_id"):
            domain.append(("document_type_id", "=", int(kwargs["document_type_id"])))
        profiles = request.env["doc.intelligence.profile"].search(domain, order="name")
        return {
            "success": True,
            "data": [self._profile_data(item) for item in profiles],
        }

    @http.route(
        "/api/document-intelligence/profiles/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_profile(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        name = (kwargs.get("name") or "").strip()
        type_id = int(kwargs.get("document_type_id") or 0)
        if not name or not type_id:
            return {
                "success": False,
                "message": "Name and document type are required.",
            }
        try:
            profile = request.env["doc.intelligence.profile"].create(
                {
                    "name": name,
                    "document_type_id": type_id,
                    "is_system": False,
                }
            )
            version = profile.current_version_id
            version.write(
                {
                    "extraction_instructions": kwargs.get("extraction_instructions") or "",
                    "examples": kwargs.get("examples") or "",
                }
            )
            self._replace_fields(version, kwargs.get("fields") or [])
            document_type = request.env["doc.document.type"].browse(type_id)
            if not document_type.default_profile_id:
                document_type.default_profile_id = profile.id
            request.env["doc.intelligence.audit.event"].log_event(
                "profile",
                "created",
                target=profile,
                detail="Extraction profile created.",
            )
            return {"success": True, "data": self._profile_data(profile)}
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}

    @http.route(
        "/api/document-intelligence/profiles/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_profile(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        profile = (
            request.env["doc.intelligence.profile"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        if not profile:
            return {"success": False, "message": "Profile not found."}
        values = {}
        if "name" in kwargs:
            values["name"] = kwargs.get("name")
        if "document_type_id" in kwargs:
            values["document_type_id"] = int(kwargs.get("document_type_id") or 0)
        if "active" in kwargs:
            values["active"] = bool(kwargs.get("active"))
        profile.write(values)
        version = profile.current_version_id
        if not version:
            version = profile.action_new_version()
        version.write(
            {
                "extraction_instructions": kwargs.get(
                    "extraction_instructions", version.extraction_instructions
                ),
                "examples": kwargs.get("examples", version.examples),
            }
        )
        if "fields" in kwargs:
            self._replace_fields(version, kwargs.get("fields") or [])
        request.env["doc.intelligence.audit.event"].log_event(
            "profile",
            "updated",
            target=profile,
            detail="Profile or field rules updated.",
        )
        return {"success": True, "data": self._profile_data(profile)}

    @http.route(
        "/api/document-intelligence/profiles/archive",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def archive_profile(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        profile = (
            request.env["doc.intelligence.profile"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        if not profile:
            return {"success": False, "message": "Profile not found."}
        profile.write({"active": bool(kwargs.get("active", False))})
        request.env["doc.intelligence.audit.event"].log_event(
            "profile",
            "archived" if not profile.active else "restored",
            target=profile,
        )
        return {"success": True, "data": self._profile_data(profile)}

    @http.route(
        "/api/document-intelligence/profiles/new-version",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def new_profile_version(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        profile = (
            request.env["doc.intelligence.profile"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        if not profile:
            return {"success": False, "message": "Profile not found."}
        profile.action_new_version()
        request.env["doc.intelligence.audit.event"].log_event(
            "profile",
            "new_version",
            target=profile,
            detail="Profile version %s" % profile.current_version_id.version,
        )
        return {"success": True, "data": self._profile_data(profile)}

    def _dataset_vals(self, kwargs):
        preset = kwargs.get("confidence_preset") or "balanced"
        auto, review = {
            "relaxed": (75, 40),
            "balanced": (85, 50),
            "strict": (92, 65),
        }.get(preset, (85, 50))
        type_ids = [int(value) for value in (kwargs.get("document_type_ids") or [])]
        field_keys = [str(value) for value in (kwargs.get("field_keys") or []) if value]
        scope_ids = [int(value) for value in (kwargs.get("scope_ids") or []) if value]
        values = {
            "name": (kwargs.get("name") or "").strip(),
            "source": kwargs.get("source") or False,
            "processing_mode": kwargs.get("processing_mode") or "balanced",
            "scope_kind": kwargs.get("scope_kind") or "company",
            "scope_ids_json": json.dumps(scope_ids),
            "auto_classify": bool(kwargs.get("auto_classify")),
            "document_type_ids": [(6, 0, type_ids)],
            "field_keys_json": json.dumps(field_keys),
            "confidence_preset": preset,
            "auto_approve_threshold": auto,
            "review_below_threshold": review,
            "ocr_fallback": bool(kwargs.get("ocr_fallback", True)),
            "deduplicate": bool(kwargs.get("deduplicate", True)),
            "masking": bool(kwargs.get("masking", True)),
            "audit_logging": bool(kwargs.get("audit_logging", True)),
            "wizard_step": int(kwargs.get("wizard_step") or 0),
        }
        return values

    def _job_data(self, job):
        if not job:
            return False
        return {
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

    def _dataset_data(self, dataset):
        latest = dataset.latest_job_id
        return {
            "id": dataset.id,
            "name": dataset.name,
            "source": dataset.source or "",
            "processing_mode": dataset.processing_mode,
            "scope_kind": dataset.scope_kind,
            "scope_ids": dataset._scope_ids(),
            "auto_classify": dataset.auto_classify,
            "document_type_ids": dataset.document_type_ids.ids,
            "document_types": dataset.document_type_ids.mapped("name"),
            "field_keys": dataset._field_keys(),
            "field_count": dataset.field_count,
            "confidence_preset": dataset.confidence_preset,
            "auto_approve_threshold": dataset.auto_approve_threshold,
            "review_below_threshold": dataset.review_below_threshold,
            "ocr_fallback": dataset.ocr_fallback,
            "deduplicate": dataset.deduplicate,
            "masking": dataset.masking,
            "audit_logging": dataset.audit_logging,
            "wizard_step": dataset.wizard_step,
            "state": dataset.state,
            "owner_id": dataset.owner_id.id,
            "owner_name": dataset.owner_id.name,
            "record_count": dataset.record_count,
            "average_confidence": dataset.average_confidence,
            "write_date": str(dataset.write_date or ""),
            "create_date": str(dataset.create_date or ""),
            "latest_job": self._job_data(latest),
        }

    @http.route(
        "/api/document-intelligence/datasets",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def datasets(self, **kwargs):
        domain = [("archived", "=", False)]
        if not self._is_admin():
            domain.append(("owner_id", "=", request.env.user.id))
        records = request.env["doc.intelligence.dataset"].search(domain)
        return {
            "success": True,
            "data": [self._dataset_data(item) for item in records],
        }

    @http.route(
        "/api/document-intelligence/datasets/get",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_get(self, **kwargs):
        dataset = (
            request.env["doc.intelligence.dataset"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        if not dataset:
            return {"success": False, "message": "Dataset not found."}
        if not self._is_admin() and dataset.owner_id != request.env.user:
            return self._deny("You cannot open this dataset.")
        return {"success": True, "data": self._dataset_data(dataset)}

    @http.route(
        "/api/document-intelligence/datasets/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_save(self, **kwargs):
        try:
            values = self._dataset_vals(kwargs)
            dataset = request.env["doc.intelligence.dataset"].save_draft(
                values, kwargs.get("id")
            )
            return {"success": True, "data": self._dataset_data(dataset)}
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}

    @http.route(
        "/api/document-intelligence/datasets/run",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_run(self, **kwargs):
        try:
            values = self._dataset_vals(kwargs)
            dataset = request.env["doc.intelligence.dataset"].save_draft(
                values, kwargs.get("id")
            )
            job = dataset.action_run()
            payload = self._dataset_data(dataset)
            payload["latest_job"] = self._job_data(job)
            payload["run_queued"] = True
            payload["message"] = (
                "Extraction finished for the current batch. Open Validate to "
                "review records that need attention."
            )
            return {"success": True, "data": payload}
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}

    @http.route(
        "/api/document-intelligence/datasets/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_delete(self, **kwargs):
        raw_ids = kwargs.get("ids")
        if raw_ids is None and kwargs.get("id"):
            raw_ids = [kwargs.get("id")]
        ids = [int(value) for value in (raw_ids or []) if value]
        if not ids:
            return {"success": False, "message": "Select at least one dataset."}
        datasets = request.env["doc.intelligence.dataset"].browse(ids).exists()
        if not datasets:
            return {"success": False, "message": "Dataset not found."}
        try:
            datasets.action_delete()
        except (AccessError, UserError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": {"ids": ids}}

    def _record_data(self, record):
        return {
            "id": record.id,
            "dataset_id": record.dataset_id.id,
            "dataset": record.dataset_id.name,
            "job_id": record.job_id.id,
            "document_id": record.document_id.id,
            "document_name": record.document_id.name,
            "employee": record.employee_id.name or "",
            "document_type": record.document_type_id.name or "",
            "review_status": record.review_status,
            "validation_status": record.validation_status,
            "document_confidence": record.document_confidence,
            "classification_confidence": record.classification_confidence,
            "used_ocr": record.used_ocr,
            "text_source": record.text_source or "empty",
            "extracted_text": (record.extracted_text or "")[:20000],
            "preview_url": f"/document-management/document/{record.document_id.id}/preview",
            "reviewer": record.reviewer_id.name or "",
            "reviewed_at": str(record.reviewed_at or ""),
            "review_comment": record.review_comment or "",
            "fields": [
                {
                    "id": field.id,
                    "key": field.key,
                    "name": field.name,
                    "value": field.value or "",
                    "confidence": field.confidence,
                    "citation": field.citation or "",
                    "page": field.page or 0,
                    "required": field.required,
                }
                for field in record.field_ids
            ],
            "issues": [
                {
                    "id": issue.id,
                    "field_key": issue.field_key or "",
                    "severity": issue.severity,
                    "message": issue.message,
                    "resolved": issue.resolved,
                }
                for issue in record.issue_ids
            ],
            "review_actions": [
                {
                    "id": item.id,
                    "action": item.action,
                    "field_key": item.field_key or "",
                    "before_value": item.before_value or "",
                    "after_value": item.after_value or "",
                    "reason": item.reason or "",
                    "comment": item.comment or "",
                    "user": item.user_id.name,
                    "create_date": str(item.create_date or ""),
                }
                for item in record.review_action_ids[:20]
            ],
        }

    @http.route(
        "/api/document-intelligence/review-queue",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def review_queue(self, **kwargs):
        domain = [("review_status", "in", ["needs_review", "extracted"])]
        if kwargs.get("dataset_id"):
            domain.append(("dataset_id", "=", int(kwargs["dataset_id"])))
        records = request.env["doc.intelligence.record"].search(domain, limit=100)
        return {
            "success": True,
            "data": [self._record_data(record) for record in records],
        }

    def _load_review_record(self, kwargs):
        return (
            request.env["doc.intelligence.record"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )

    def _review_response(self, method_name, kwargs, *args):
        if not self._is_admin():
            return self._deny("You are not allowed to review extraction records.")
        record = self._load_review_record(kwargs)
        if not record:
            return {"success": False, "message": "Record not found."}
        try:
            getattr(record, method_name)(*args)
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._record_data(record)}

    @http.route(
        "/api/document-intelligence/records/approve",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_approve(self, **kwargs):
        return self._review_response(
            "action_approve", kwargs, kwargs.get("reason") or ""
        )

    @http.route(
        "/api/document-intelligence/records/reject",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_reject(self, **kwargs):
        return self._review_response(
            "action_reject", kwargs, kwargs.get("reason") or ""
        )

    @http.route(
        "/api/document-intelligence/records/override",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_override(self, **kwargs):
        return self._review_response(
            "action_override", kwargs, kwargs.get("reason") or ""
        )

    @http.route(
        "/api/document-intelligence/records/correct",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_correct(self, **kwargs):
        return self._review_response(
            "action_correct_field",
            kwargs,
            kwargs.get("field_key") or "",
            kwargs.get("value") or "",
            kwargs.get("reason") or "",
        )

    @http.route(
        "/api/document-intelligence/records/resolve-issue",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_resolve_issue(self, **kwargs):
        return self._review_response(
            "action_resolve_issue",
            kwargs,
            kwargs.get("issue_id") or 0,
            kwargs.get("reason") or "",
        )

    @http.route(
        "/api/document-intelligence/records/comment",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_comment(self, **kwargs):
        return self._review_response(
            "action_add_comment", kwargs, kwargs.get("comment") or ""
        )

    @http.route(
        "/api/document-intelligence/records/bulk-approve",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def record_bulk_approve(self, **kwargs):
        if not self._is_admin():
            return self._deny("You are not allowed to review extraction records.")
        try:
            approved = request.env["doc.intelligence.record"].action_bulk_approve_safe(
                kwargs.get("ids")
            )
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {
            "success": True,
            "data": {
                "approved_count": len(approved),
                "ids": approved.ids,
            },
        }

    @http.route(
        "/api/document-intelligence/settings/health",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def settings_health(self, **kwargs):
        from ..models.intelligence_groq import (
            EMBED_MODEL,
            LLM_MODEL,
            VISION_MODEL,
            groq_configured,
        )

        env = request.env
        pgvector = False
        try:
            env.cr.execute("SAVEPOINT di_health")
            env.cr.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            pgvector = bool(env.cr.fetchone())
            env.cr.execute("RELEASE SAVEPOINT di_health")
        except Exception:
            env.cr.execute("ROLLBACK TO SAVEPOINT di_health")
        return {
            "success": True,
            "data": {
                "groq_configured": groq_configured(env),
                "pgvector": pgvector,
                "llm_model": LLM_MODEL,
                "vision_model": VISION_MODEL,
                "embedding_model": EMBED_MODEL,
                "extraction": (
                    "Native text for PDF, Word, Excel, PowerPoint, and plain files. "
                    "Groq vision only for images and scanned PDFs. Field values use rules, not an LLM."
                ),
            },
        }

    def _load_job(self, kwargs):
        job = (
            request.env["doc.intelligence.job"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        return job

    def _can_control_job(self, job):
        return self._is_admin() or job.owner_id == request.env.user

    @http.route(
        "/api/document-intelligence/overview",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def overview(self, **kwargs):
        return {
            "success": True,
            "data": request.env["doc.intelligence.job"].overview_data(),
        }

    @http.route(
        "/api/document-intelligence/jobs/pause",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def job_pause(self, **kwargs):
        job = self._load_job(kwargs)
        if not job:
            return {"success": False, "message": "Job not found."}
        if not self._can_control_job(job):
            return self._deny("You are not allowed to pause this job.")
        try:
            job.action_pause()
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._job_data(job)}

    @http.route(
        "/api/document-intelligence/jobs/resume",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def job_resume(self, **kwargs):
        job = self._load_job(kwargs)
        if not job:
            return {"success": False, "message": "Job not found."}
        if not self._can_control_job(job):
            return self._deny("You are not allowed to resume this job.")
        try:
            job.action_resume()
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._job_data(job)}

    @http.route(
        "/api/document-intelligence/jobs/retry",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def job_retry(self, **kwargs):
        job = self._load_job(kwargs)
        if not job:
            return {"success": False, "message": "Job not found."}
        if not self._can_control_job(job):
            return self._deny("You are not allowed to retry this job.")
        try:
            job.action_retry()
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._job_data(job)}

    @http.route(
        "/api/document-intelligence/audit-logs",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def audit_logs(self, **kwargs):
        if not self._is_admin():
            return self._deny("You are not allowed to view Intelligence audit logs.")
        domain = []
        if kwargs.get("category"):
            domain.append(("category", "=", kwargs["category"]))
        limit = min(int(kwargs.get("limit") or 100), 300)
        events = request.env["doc.intelligence.audit.event"].search(
            domain, limit=limit
        )
        return {
            "success": True,
            "data": [event.to_api() for event in events],
        }

    @http.route(
        "/api/document-intelligence/ask/history",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ask_history(self, **kwargs):
        domain = [("category", "=", "query")]
        if not self._is_admin():
            domain.append(("user_id", "=", request.env.user.id))
        events = request.env["doc.intelligence.audit.event"].search(
            domain, limit=20
        )
        return {
            "success": True,
            "data": [
                {
                    "id": event.id,
                    "question": event.detail or "",
                    "answer": event.after_value or "",
                    "create_date": str(event.create_date or ""),
                    "user": event.user_id.name,
                }
                for event in events
            ],
        }

    @http.route(
        "/api/document-intelligence/ask",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ask(self, **kwargs):
        from ..models.intelligence_ask import answer_question

        question = (kwargs.get("question") or "").strip()
        if not question:
            return {"success": False, "message": "Enter a question."}
        try:
            result = answer_question(request.env, question)
        except Exception as error:
            return {"success": False, "message": str(error)}
        request.env["doc.intelligence.audit.event"].log_event(
            "query",
            "asked",
            detail=question,
            after=(result.get("answer") or "")[:2000],
            severity="warning" if result.get("insufficient_evidence") else "info",
        )
        return {"success": True, "data": result}

    def _conversation(self, kwargs, require=True):
        record = (
            request.env["doc.intelligence.conversation"]
            .browse(int(kwargs.get("id") or kwargs.get("conversation_id") or 0))
            .exists()
        )
        if require and not record:
            return None
        return record

    @http.route(
        "/api/document-intelligence/conversations",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversations(self, **kwargs):
        domain = []
        if kwargs.get("saved"):
            domain.append(("saved", "=", True))
        if not self._is_admin():
            domain.append(("user_id", "=", request.env.user.id))
        term = (kwargs.get("search") or "").strip()
        if term:
            domain.append(("name", "ilike", term))
        records = request.env["doc.intelligence.conversation"].search(domain, limit=50)
        indexed = request.env["doc.intelligence.chunk"].search_count(
            [("record_id.review_status", "in", ["approved", "overridden"])]
        )
        return {
            "success": True,
            "data": {
                "indexed_count": indexed,
                "conversations": [item.to_api() for item in records],
            },
        }

    @http.route(
        "/api/document-intelligence/conversations/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_create(self, **kwargs):
        values = {"name": (kwargs.get("name") or "New chat").strip()}
        if kwargs.get("dataset_id"):
            values["dataset_id"] = int(kwargs["dataset_id"])
        conversation = request.env["doc.intelligence.conversation"].create(values)
        return {"success": True, "data": conversation.to_api(with_messages=True)}

    @http.route(
        "/api/document-intelligence/conversations/get",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_get(self, **kwargs):
        conversation = self._conversation(kwargs)
        if not conversation:
            return {"success": False, "message": "Conversation not found."}
        try:
            conversation._ensure_owner()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": conversation.to_api(with_messages=True)}

    @http.route(
        "/api/document-intelligence/conversations/save",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_save(self, **kwargs):
        conversation = self._conversation(kwargs)
        if not conversation:
            return {"success": False, "message": "Conversation not found."}
        try:
            conversation._ensure_owner()
            conversation.saved = bool(kwargs.get("saved", True))
        except (AccessError, UserError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": conversation.to_api()}

    @http.route(
        "/api/document-intelligence/conversations/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_update(self, **kwargs):
        conversation = self._conversation(kwargs)
        if not conversation:
            return {"success": False, "message": "Conversation not found."}
        try:
            conversation._ensure_owner()
            if "dataset_id" in kwargs:
                conversation.dataset_id = int(kwargs.get("dataset_id") or 0) or False
            if kwargs.get("name"):
                conversation.name = kwargs["name"]
        except (AccessError, UserError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": conversation.to_api(with_messages=True)}

    @http.route(
        "/api/document-intelligence/conversations/ask",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_ask(self, **kwargs):
        conversation = self._conversation(kwargs, require=False)
        if not conversation:
            conversation = request.env["doc.intelligence.conversation"].create(
                {"name": "New chat"}
            )
        if kwargs.get("dataset_id"):
            conversation.dataset_id = int(kwargs["dataset_id"])
        try:
            payload = conversation.action_ask(kwargs.get("question") or "")
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        except Exception as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/api/document-intelligence/conversations/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_delete(self, **kwargs):
        conversation = self._conversation(kwargs)
        if not conversation:
            return {"success": False, "message": "Conversation not found."}
        try:
            conversation.action_delete()
        except (AccessError, UserError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": {"id": int(kwargs.get("id") or 0)}}

    @http.route(
        "/api/document-intelligence/conversations/ask-stream",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_ask_stream(self, **kwargs):
        try:
            body = json.loads(request.httprequest.data or b"{}")
        except json.JSONDecodeError:
            body = {}
        uid = request.env.uid
        context = dict(request.env.context)
        registry = request.env.registry
        conv_id = int(body.get("id") or body.get("conversation_id") or 0)
        dataset_id = int(body.get("dataset_id") or 0)
        question = body.get("question") or ""

        def generate():
            # Odoo closes the request cursor as soon as the controller returns a
            # generator. Use a dedicated cursor for the whole stream.
            with registry.cursor() as cr:
                try:
                    env = api.Environment(cr, uid, context)
                    conversation = (
                        env["doc.intelligence.conversation"].browse(conv_id).exists()
                    )
                    if not conversation:
                        conversation = env["doc.intelligence.conversation"].create(
                            {"name": "New chat"}
                        )
                    if dataset_id:
                        conversation.dataset_id = dataset_id
                    for event in conversation.iter_ask_events(question):
                        yield json.dumps(event) + "\n"
                    cr.commit()
                except (AccessError, UserError, ValidationError) as error:
                    cr.rollback()
                    yield json.dumps({"event": "error", "message": str(error)}) + "\n"
                except Exception as error:
                    cr.rollback()
                    yield json.dumps({"event": "error", "message": str(error)}) + "\n"

        headers = [
            ("Content-Type", "application/x-ndjson"),
            ("Cache-Control", "no-cache"),
            ("X-Accel-Buffering", "no"),
        ]
        return request.make_response(generate(), headers=headers)

    @http.route(
        "/api/document-intelligence/conversations/attach-library",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_attach_library(self, **kwargs):
        conversation = self._conversation(kwargs, require=False)
        if not conversation:
            conversation = request.env["doc.intelligence.conversation"].create({})
        try:
            payload = conversation.action_attach_document(kwargs.get("document_id"))
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/api/document-intelligence/conversations/attach-url",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_attach_url(self, **kwargs):
        conversation = self._conversation(kwargs, require=False)
        if not conversation:
            conversation = request.env["doc.intelligence.conversation"].create({})
        try:
            payload = conversation.action_attach_url(kwargs.get("url") or "")
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/api/document-intelligence/conversations/attach-upload",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_attach_upload(self, **kwargs):
        conversation = self._conversation(kwargs, require=False)
        if not conversation:
            conversation = request.env["doc.intelligence.conversation"].create({})
        try:
            payload = conversation.action_attach_upload(
                kwargs.get("name") or "upload",
                kwargs.get("mimetype") or "application/octet-stream",
                kwargs.get("data") or "",
            )
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/api/document-intelligence/library-documents",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def library_documents(self, **kwargs):
        term = (kwargs.get("search") or "").strip()
        domain = [("active", "=", True)]
        if term:
            domain.append(("name", "ilike", term))
        documents = request.env["doc.document"].search(domain, limit=40)
        return {
            "success": True,
            "data": [
                {
                    "id": document.id,
                    "name": document.name,
                    "document_type": document.document_type_id.name or "",
                    "employee": document.employee_id.name or "",
                }
                for document in documents
            ],
        }

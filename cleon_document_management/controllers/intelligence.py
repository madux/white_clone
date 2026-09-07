import json
from odoo import http
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
            "preview_url": f"/document-management/document/{record.document_id.id}/preview",
            "fields": [
                {
                    "key": field.key,
                    "name": field.name,
                    "value": field.value or "",
                    "confidence": field.confidence,
                    "citation": field.citation or "",
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

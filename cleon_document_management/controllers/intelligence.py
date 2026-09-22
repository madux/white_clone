import json
from odoo import api, http
from odoo.exceptions import AccessError, UserError, ValidationError
from odoo.http import request

from ..models.intelligence_conversation import coerce_int_ids


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

    def _profile_version_with_fields(self, profile):
        if not profile:
            return False
        versions = profile.with_context(active_test=False).version_ids
        current = profile.current_version_id
        if current and current.field_ids:
            return current
        if not versions:
            return current
        return max(versions, key=lambda version: len(version.field_ids))

    def _best_profile_for_type(self, document_type):
        Profile = request.env["doc.intelligence.profile"].with_context(
            active_test=False
        )
        profiles = Profile.search([("document_type_id", "=", document_type.id)])
        default = document_type.with_context(active_test=False).default_profile_id
        ranked = []
        for profile in profiles:
            version = self._profile_version_with_fields(profile)
            ranked.append(
                (
                    len(version.field_ids) if version else 0,
                    1 if profile == default else 0,
                    profile,
                    version,
                )
            )
        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        if ranked:
            return ranked[0][2], ranked[0][3]
        if default:
            return default, self._profile_version_with_fields(default)
        return False, False

    def _type_data(self, document_type):
        profile, version = self._best_profile_for_type(document_type)
        extraction_fields = [
            self._field_data(field) for field in (version.field_ids if version else [])
        ]
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
            "field_count": len(extraction_fields),
            "extraction_instructions": version.extraction_instructions if version else "",
            "extraction_fields": extraction_fields,
            "profile": self._profile_data(profile, version) if profile else False,
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

    def _profile_data(self, profile, version=None):
        version = version or self._profile_version_with_fields(profile)
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

    def _save_type_profile(self, document_type, payload):
        payload = payload or {}
        fields_payload = payload.get("fields") or []
        instructions = payload.get("extraction_instructions") or ""
        examples = payload.get("examples") or ""
        profile_name = (payload.get("name") or document_type.name or "").strip()
        Profile = request.env["doc.intelligence.profile"].with_context(active_test=False)
        profile, version = self._best_profile_for_type(document_type)
        if not profile:
            profile = Profile.create(
                {
                    "name": profile_name or document_type.name,
                    "document_type_id": document_type.id,
                    "is_system": False,
                }
            )
            document_type.default_profile_id = profile.id
            version = profile.current_version_id
        else:
            profile.write({"name": profile_name or profile.name})
            if not document_type.default_profile_id:
                document_type.default_profile_id = profile.id
        if not version:
            version = profile.action_new_version()
        version.write(
            {
                "extraction_instructions": instructions,
                "examples": examples,
            }
        )
        self._replace_fields(version, fields_payload)
        if not document_type.default_profile_id:
            document_type.default_profile_id = profile.id
        return profile

    def _documents_using_types(self, records):
        return (
            request.env["doc.document"]
            .sudo()
            .with_context(active_test=False)
            .search([("document_type_id", "in", records.ids)])
        )

    def _type_delete_blocked_message(self, records, files=None, raw=""):
        names = records.mapped("name")
        label = names[0] if len(names) == 1 else ", ".join(names)
        if files is None:
            files = self._documents_using_types(records)
        if files:
            if len(records) == 1:
                count = len(files)
                noun = "file" if count == 1 else "files"
                return (
                    "You can't delete %s because %s %s still assigned to it. "
                    "Change those files to another type, or deactivate %s instead."
                    % (label, count, noun, label)
                )
            grouped = {}
            for document in files:
                grouped.setdefault(document.document_type_id.name, 0)
                grouped[document.document_type_id.name] += 1
            details = ", ".join(
                "%s (%s)" % (name, grouped[name]) for name in grouped
            )
            return (
                "You can't delete these types because files are still assigned to them: "
                "%s. Change those files to another type, or deactivate the types instead."
                % details
            )
        text = (raw or "").lower()
        if "doc_document" in text or "foreign key" in text or "restrict" in text:
            return (
                "You can't delete %s while files are still assigned to it. "
                "Change those files to another type, or deactivate it instead."
                % label
            )
        return (raw or "").strip() or (
            "You can't delete %s while it is still in use. Deactivate it instead."
            % label
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
        Type = request.env["doc.document.type"]
        if kwargs.get("active_only"):
            domain.append(("active", "=", True))
        else:
            Type = Type.with_context(active_test=False)
        types = Type.search(domain, order="active desc, sequence, name")
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
        profile_payload = kwargs.get("profile") if isinstance(kwargs.get("profile"), dict) else kwargs
        if (
            profile_payload.get("fields")
            or profile_payload.get("extraction_instructions")
            or profile_payload.get("name")
        ):
            self._save_type_profile(record, profile_payload)
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
        record = (
            request.env["doc.document.type"]
            .with_context(active_test=False)
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
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
        profile_payload = kwargs.get("profile") if isinstance(kwargs.get("profile"), dict) else None
        if profile_payload is not None or "fields" in kwargs or "extraction_instructions" in kwargs:
            self._save_type_profile(record, profile_payload or kwargs)
        request.env["doc.intelligence.audit.event"].log_event(
            "rule",
            "document_type_updated",
            target=record,
        )
        return {"success": True, "data": self._type_data(record)}

    @http.route(
        "/api/document-intelligence/document-types/delete",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def delete_document_types(self, **kwargs):
        if not self._is_admin():
            return self._deny()
        ids = coerce_int_ids(kwargs.get("ids") or [kwargs.get("id")])
        records = (
            request.env["doc.document.type"]
            .with_context(active_test=False)
            .browse(ids)
            .exists()
        )
        if not records:
            return {"success": False, "message": "Document type not found."}
        files = self._documents_using_types(records)
        if files:
            return {
                "success": False,
                "message": self._type_delete_blocked_message(records, files=files),
            }
        try:
            profiles = (
                request.env["doc.intelligence.profile"]
                .with_context(active_test=False)
                .search([("document_type_id", "in", records.ids)])
            )
            profiles.with_context(allow_profile_unlink=True).unlink()
            names = ", ".join(records.mapped("name"))
            records.unlink()
        except (AccessError, UserError, ValidationError) as error:
            request.env.cr.rollback()
            return {
                "success": False,
                "message": self._type_delete_blocked_message(
                    records, raw=str(error)
                ),
            }
        except Exception as error:
            request.env.cr.rollback()
            return {
                "success": False,
                "message": self._type_delete_blocked_message(
                    records, raw=str(error)
                ),
            }
        request.env["doc.intelligence.audit.event"].log_event(
            "rule",
            "document_type_deleted",
            detail=names,
        )
        return {"success": True, "data": {"ids": ids}}

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
        profiles = (
            request.env["doc.intelligence.profile"]
            .with_context(active_test=False)
            .search(domain, order="active desc, name")
        )
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
        source = kwargs.get("source") or False
        scope_kind = kwargs.get("scope_kind") or "company"
        if source == "organizational":
            scope_kind = "selected_files"
        values = {
            "name": (kwargs.get("name") or "").strip(),
            "source": source,
            "processing_mode": kwargs.get("processing_mode") or "balanced",
            "scope_kind": scope_kind,
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
            "uploads": dataset._upload_payload(),
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
        records.filtered(
            lambda item: item.state in ("completed", "needs_review")
        ).action_sync_review_state()
        return {
            "success": True,
            "data": [self._dataset_data(item) for item in records],
        }

    @http.route(
        "/api/document-intelligence/wizard/options",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def wizard_options(self, **kwargs):
        return {
            "success": True,
            "data": request.env["doc.intelligence.dataset"].wizard_options(),
        }

    @http.route(
        "/api/document-intelligence/wizard/estimate",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def wizard_estimate(self, **kwargs):
        return {
            "success": True,
            "data": request.env["doc.intelligence.dataset"].wizard_estimate(kwargs),
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
        "/api/document-intelligence/datasets/upload",
        type="http",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_upload(self, **kwargs):
        Dataset = request.env["doc.intelligence.dataset"]
        dataset_id = int(request.httprequest.form.get("dataset_id") or 0)
        files = request.httprequest.files.getlist("files") or request.httprequest.files.getlist("file")
        try:
            if dataset_id:
                dataset = Dataset.browse(dataset_id).exists()
                if not dataset:
                    raise ValidationError("Dataset not found.")
                if not self._is_admin() and dataset.owner_id != request.env.user:
                    return request.make_json_response(self._deny(), status=403)
            else:
                dataset = Dataset.save_draft({"source": "upload", "wizard_step": 1})
            if not files:
                raise ValidationError("Choose at least one file.")
            dataset.action_add_uploads(files)
            return request.make_json_response(
                {"success": True, "data": self._dataset_data(dataset)}
            )
        except (AccessError, UserError, ValidationError) as error:
            return request.make_json_response(
                {"success": False, "message": str(error)},
                status=400,
            )

    @http.route(
        "/api/document-intelligence/datasets/upload/remove",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def dataset_upload_remove(self, **kwargs):
        dataset = (
            request.env["doc.intelligence.dataset"]
            .browse(int(kwargs.get("id") or 0))
            .exists()
        )
        if not dataset:
            return {"success": False, "message": "Dataset not found."}
        if not self._is_admin() and dataset.owner_id != request.env.user:
            return self._deny("You cannot change this dataset.")
        try:
            dataset.action_remove_upload(kwargs.get("document_id"))
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._dataset_data(dataset)}

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
            job = dataset.with_context(intelligence_queue_only=True).action_run()
            payload = self._dataset_data(dataset)
            payload["latest_job"] = self._job_data(job)
            payload["run_queued"] = True
            payload["message"] = (
                "Extraction started. Follow progress on the dataset page."
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
        Record = request.env["doc.intelligence.record"]
        Dataset = request.env["doc.intelligence.dataset"]
        include_reviewed = bool(kwargs.get("include_reviewed"))
        domain = []
        if kwargs.get("dataset_id"):
            dataset = Dataset.browse(int(kwargs["dataset_id"])).exists()
            if not dataset:
                return {"success": True, "data": []}
            dataset.action_close_stale_and_sync()
            domain.append(("dataset_id", "=", dataset.id))
            if not include_reviewed:
                domain.append(("review_status", "in", ["needs_review", "extracted"]))
        else:
            domain = [("review_status", "in", ["needs_review", "extracted"])]
        records = Record.search(domain, limit=200)
        pending_states = {"needs_review", "extracted"}
        visible = Record.browse()
        for record in records:
            if record.review_status in pending_states:
                if Dataset._document_is_extractable(
                    record.document_id.with_context(active_test=False)
                ):
                    visible |= record
            else:
                visible |= record
        return {
            "success": True,
            "data": [self._record_data(record) for record in visible],
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
        from ..models.intelligence_groq import LLM_MODEL, VISION_MODEL, groq_configured
        from ..models.intelligence_tei import embed_health

        env = request.env
        pgvector = False
        try:
            env.cr.execute("SAVEPOINT di_health")
            env.cr.execute("SELECT 1 FROM pg_extension WHERE extname = 'vector'")
            pgvector = bool(env.cr.fetchone())
            env.cr.execute("RELEASE SAVEPOINT di_health")
        except Exception:
            env.cr.execute("ROLLBACK TO SAVEPOINT di_health")
        health = embed_health(env)
        return {
            "success": True,
            "data": {
                "groq_configured": groq_configured(env),
                "pgvector": pgvector,
                "llm_model": LLM_MODEL,
                "vision_model": VISION_MODEL,
                "embedding_model": health["embedding_model"],
                "rerank_model": health["rerank_model"],
                "retrieval": "hybrid",
                "embed_ok": health["embed_ok"],
                "rerank_ok": health["rerank_ok"],
                "embed_loaded": health["embed_loaded"],
                "rerank_loaded": health["rerank_loaded"],
                "embed_cached": health["embed_cached"],
                "rerank_cached": health["rerank_cached"],
                "libraries_ok": health["libraries_ok"],
                "device": health["device"],
                "extraction": (
                    "Native text for PDF, Word, Excel, PowerPoint, and plain files. "
                    "Groq vision only for images and scanned PDFs. Ask retrieval is hybrid "
                    "RAG: local Qwen3 embeddings + Postgres keyword search, then Qwen3 rerank."
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
            job.with_context(intelligence_queue_only=True).action_retry()
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
        records = request.env["doc.intelligence.conversation"].search(
            domain, limit=50, order="write_date desc, id desc"
        )
        docs = request.env["doc.document"]._ask_library_documents()
        indexed_groups = (
            request.env["doc.intelligence.library.chunk"]
            .sudo()
            .read_group(
                [("document_id", "in", docs.ids or [0])],
                ["document_id"],
                ["document_id"],
            )
        )
        return {
            "success": True,
            "data": {
                "indexed_count": len(indexed_groups),
                "conversations": [item.to_api() for item in records],
            },
        }

    @http.route(
        "/api/document-intelligence/ask/index-status",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def ask_index_status(self, **kwargs):
        try:
            data = request.env["doc.document"].ask_index_status(
                limit=kwargs.get("limit") or 300,
                search=kwargs.get("search") or "",
            )
        except Exception as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": data}

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
        if kwargs.get("dataset_id") or "dataset_id" in kwargs:
            conversation.dataset_id = int(kwargs.get("dataset_id") or 0) or False
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
                    if "dataset_id" in body:
                        conversation.dataset_id = dataset_id or False
                    for event in conversation.iter_ask_events(
                        question, regenerate=bool(body.get("regenerate"))
                    ):
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
            document_ids = coerce_int_ids(kwargs.get("document_ids"))
            if not document_ids:
                document_ids = coerce_int_ids(kwargs.get("document_id"))
            payload = conversation.action_attach_documents(document_ids)
        except (AccessError, UserError, ValidationError, TypeError, ValueError) as error:
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
            files = kwargs.get("files") or []
            if isinstance(files, dict):
                files = [files]
            if not files:
                files = [
                    {
                        "name": kwargs.get("name") or "upload",
                        "mimetype": kwargs.get("mimetype")
                        or "application/octet-stream",
                        "data": kwargs.get("data") or "",
                    }
                ]
            payload = conversation.action_attach_uploads(files)
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/api/document-intelligence/conversations/remove-sources",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def conversation_remove_sources(self, **kwargs):
        conversation = self._conversation(kwargs)
        if not conversation:
            return {"success": False, "message": "Conversation not found."}
        try:
            payload = conversation.action_remove_sources(
                kwargs.get("source_ids") or kwargs.get("source_id")
            )
        except (AccessError, UserError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": payload}

    @http.route(
        "/document-management/intelligence/ask-source/<int:source_id>/preview",
        type="http",
        auth="user",
        methods=["GET"],
    )
    def ask_source_preview(self, source_id, **kwargs):
        source = request.env["doc.intelligence.ask.source"].browse(source_id).exists()
        if not source:
            return request.not_found()
        conversation = source.conversation_id
        is_admin = request.env.user.has_group("base.group_system") or request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        )
        if not conversation or (conversation.user_id != request.env.user and not is_admin):
            return request.not_found()
        if source.document_id and source.document_id.attachment_id:
            attachment = source.document_id.attachment_id
        else:
            attachment = source.attachment_id
        if not attachment:
            return request.not_found()
        from odoo.addons.cleon_document_management.models.intelligence_pipeline import (
            attachment_bytes,
        )

        return request.make_response(
            attachment_bytes(attachment),
            headers=[
                ("Content-Type", attachment.mimetype or "application/octet-stream"),
                (
                    "Content-Disposition",
                    'inline; filename="%s"' % (attachment.name or source.name or "file"),
                ),
            ],
        )

    @http.route(
        "/api/document-intelligence/library-documents",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def library_documents(self, **kwargs):
        term = (kwargs.get("search") or "").strip()
        domain = [
            ("active", "=", True),
            ("deleted_at", "=", False),
            ("distribution_status", "=", "active"),
            ("folder_id.active", "=", True),
            ("folder_id.deleted_at", "=", False),
            ("folder_id.distribution_status", "=", "active"),
            ("folder_id.folder_type", "in", ["employee", "organizational"]),
        ]
        if term:
            domain.append(("name", "ilike", term))
        documents = request.env["doc.document"].search(
            domain, limit=80, order="write_date desc"
        )
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

# -*- coding: utf-8 -*-
import base64
import csv
import io
import json
from datetime import datetime, timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError
from odoo.osv import expression

from .doc_audit_export_job import ASYNC_EXPORT_THRESHOLD


class DocAuditQueryService(models.AbstractModel):
    _name = "doc.audit.query.service"
    _description = "Unified audit query API (C7)"

    MODULE_KEYS = (
        "employee_files",
        "organizational_files",
        "templates_forms",
        "compliance",
        "signatures",
        "document_intelligence",
        "settings",
        "audit",
        "workspace",
        "document_management",
    )

    MODULE_LABELS = {
        "employee_files": "Employee Files",
        "organizational_files": "Organisational Files",
        "templates_forms": "Templates & Forms",
        "compliance": "Compliance",
        "signatures": "Signatures",
        "document_intelligence": "Document Intelligence",
        "settings": "Settings",
        "audit": "Audit",
        "workspace": "Workspace",
        "document_management": "Document Management",
    }

    RES_MODEL_MODULE = {
        "doc.document.type": "settings",
        "doc.document.category": "settings",
        "res.users": "settings",
        "doc.employee.files.config": "settings",
        "doc.organizational.files.config": "settings",
        "doc.folder": "organizational_files",
        "doc.organizational.policy": "organizational_files",
        "doc.organizational.approval.request": "organizational_files",
        "doc.template": "templates_forms",
        "doc.template.assignment": "templates_forms",
        "doc.compliance.policy": "compliance",
        "doc.compliance.run": "compliance",
        "doc.compliance.request": "compliance",
        "doc.intelligence.dataset": "document_intelligence",
        "doc.intelligence.job": "document_intelligence",
        "doc.employee.esign.request": "signatures",
        "res.company": "audit",
    }

    @api.model
    def module_for_record(self, record):
        if not record:
            return "document_management"
        if not record.exists():
            return self.RES_MODEL_MODULE.get(record._name, "document_management")
        model = record._name
        if model == "doc.document":
            folder = record.sudo().folder_id
            if folder and getattr(folder, "folder_type", None) == "employee":
                return "employee_files"
            employee = getattr(record, "employee_id", False)
            if employee:
                return "employee_files"
            return "organizational_files"
        return self.RES_MODEL_MODULE.get(model, "document_management")

    @api.model
    def record_label_for(self, record):
        if not record or not record.exists():
            return ""
        for attr in ("display_name", "name", "title"):
            value = getattr(record, attr, None)
            if isinstance(value, str) and value.strip():
                return value.strip()
        return "%s #%s" % (record._name, record.id)

    @api.model
    def actor_role_label(self, user):
        perm = self.env.get("doc.dms.permission")
        if perm:
            roles = perm.user_assigned_roles(user)
            if roles:
                return roles[0].name or roles[0].display_name
        if user.has_group("cleon_document_management.group_document_admin"):
            return "Document Admin"
        if user.has_group("base.group_system"):
            return "Super Admin"
        return "User"

    @api.model
    def meta(self):
        user = self.env.user
        if not self._user_may_query_audit(user):
            return {"allowed": False}
        allowed = self._allowed_modules(user)
        return {
            "allowed": True,
            "can_export": self._user_may_export_audit(user),
            "modules": self._module_options(allowed),
            "timezone": self.env["doc.dms.general.service"].get_timezone(
                self.env.company
            ),
            "retention_years": self._audit_retention_years(),
        }

    @api.model
    def query(self, filters=None, page=1, page_size=50):
        user = self.env.user
        filters = dict(filters or {})
        page = max(int(page or 1), 1)
        page_size = min(max(int(page_size or 50), 1), 200)
        if not self._user_may_query_audit(user):
            self._log_access_denied("query")
            return {
                "items": [],
                "total": 0,
                "page": page,
                "page_size": page_size,
                "requires_extra_filter": False,
            }
        self._validate_date_filters(filters)
        domain = self._build_domain(user, filters)
        Audit = self.env["doc.object.audit"].sudo()
        total = Audit.search_count(domain)
        rows = Audit.search(
            domain,
            limit=page_size,
            offset=(page - 1) * page_size,
            order="occurred_at desc, id desc",
        )
        return {
            "items": [self._serialize_row(row) for row in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "requires_extra_filter": False,
        }

    @api.model
    def metrics(self, filters=None):
        user = self.env.user
        if not self._user_may_query_audit(user):
            return {}
        filters = dict(filters or {})
        self._validate_date_filters(filters)
        domain = self._build_domain(user, filters)
        Audit = self.env["doc.object.audit"].sudo()
        events_count = Audit.search_count(domain)
        denied_count = Audit.search_count(expression.AND([domain, [("result", "=", "denied")]]))
        settings_count = Audit.search_count(
            expression.AND([domain, [("module", "=", "settings")]])
        )
        export_count = Audit.search_count(
            expression.AND([domain, [("action", "ilike", "export")]])
        )
        denied_people = len(
            set(
                Audit.search(
                    expression.AND([domain, [("result", "=", "denied")]]),
                    limit=5000,
                ).mapped("actor_id").ids
            )
        )
        return {
            "events_in_period": events_count,
            "access_denied": denied_count,
            "access_denied_people": denied_people,
            "settings_changes": settings_count,
            "exports": export_count,
        }

    @api.model
    def get_event(self, event_id):
        user = self.env.user
        if not self._user_may_query_audit(user):
            return None
        row = self.env["doc.object.audit"].sudo().browse(int(event_id)).exists()
        if not row or not self._row_visible_to_user(user, row):
            return None
        data = self._serialize_row(row, detailed=True)
        data["related_count"] = 0
        if row.correlation_id:
            data["related_count"] = self.env["doc.object.audit"].sudo().search_count(
                [
                    ("correlation_id", "=", row.correlation_id),
                    ("id", "!=", row.id),
                ]
            )
        data["related_events"] = []
        if row.correlation_id:
            related = self.env["doc.object.audit"].sudo().search(
                [
                    ("correlation_id", "=", row.correlation_id),
                    ("id", "!=", row.id),
                ],
                order="occurred_at asc, id asc",
                limit=20,
            )
            data["related_events"] = [self._serialize_row(r) for r in related]
        return data

    @api.model
    def export_rows(self, filters=None, max_rows=ASYNC_EXPORT_THRESHOLD):
        user = self.env.user
        if not self._user_may_export_audit(user):
            raise UserError("You do not have permission to export the audit trail.")
        filters = dict(filters or {})
        self._validate_date_filters(filters)
        domain = self._build_domain(user, filters)
        Audit = self.env["doc.object.audit"].sudo()
        total = Audit.search_count(domain)
        if total > max_rows:
            job = (
                self.env["doc.audit.export.job"]
                .sudo()
                .create_job(user, json.dumps(filters))
            )
            self.env["doc.audit.export.job"].sudo().cron_process_pending()
            return {
                "async": True,
                "job_id": job.id,
                "row_count": total,
                "message": "Export queued. You will be notified when the file is ready.",
            }
        payload = self._export_csv_payload(
            filters, user=user, max_rows=max_rows, log_export=True
        )
        return {
            "async": False,
            "filename": payload["filename"],
            "mime_type": "text/csv",
            "content": payload["content"],
            "row_count": payload["row_count"],
        }

    @api.model
    def _export_csv_payload(self, filters, user=None, max_rows=500000, log_export=True):
        user = user or self.env.user
        filters = dict(filters or {})
        domain = self._build_domain(user, filters)
        Audit = self.env["doc.object.audit"].sudo()
        rows = Audit.search(domain, order="occurred_at desc, id desc", limit=max_rows)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(
            [
                "occurred_at_utc",
                "person",
                "role",
                "action",
                "record",
                "module",
                "result",
                "summary",
                "ip",
            ]
        )
        for row in rows:
            serialized = self._serialize_row(row)
            writer.writerow(
                [
                    serialized.get("occurred_at"),
                    serialized.get("person_name"),
                    serialized.get("actor_role_label") or "",
                    serialized.get("action"),
                    serialized.get("record_label"),
                    serialized.get("module_label"),
                    serialized.get("result"),
                    serialized.get("summary"),
                    serialized.get("actor_ip") or "",
                ]
            )
        if log_export:
            self.env["doc.object.audit"].log_meta(
                "audit_export",
                "Audit trail exported",
                details="rows=%s" % len(rows),
                module="audit",
                record_label="Audit Trail",
            )
        return {
            "filename": "audit-trail-%s.csv"
            % fields.Datetime.now().strftime("%Y%m%d-%H%M%S"),
            "content": buffer.getvalue(),
            "row_count": len(rows),
        }

    @api.model
    def get_export_job(self, job_id, user=None):
        user = user or self.env.user
        job = self.env["doc.audit.export.job"].sudo().browse(int(job_id)).exists()
        if not job:
            return None
        is_admin = user.has_group("cleon_document_management.group_document_admin")
        if job.user_id != user and not is_admin:
            return None
        data = job.serialize_for_api()
        if job.state == "done" and job.attachment_id:
            data["content"] = base64.b64decode(job.attachment_id.datas or b"").decode(
                "utf-8", errors="replace"
            )
        return data

    @api.model
    def verify_integrity_chain(self, company=None):
        company = company or self.env.company
        rows = (
            self.env["doc.object.audit"]
            .sudo()
            .search([("company_id", "=", company.id)], order="id asc")
        )
        prev_hash = ""
        for row in rows:
            if (row.prev_event_hash or "") != (prev_hash or ""):
                return {"ok": False, "event_id": row.id}
            expected = self.env["doc.object.audit"]._compute_content_hash(
                {
                    "company_id": row.company_id.id,
                    "res_model": row.res_model,
                    "res_id": row.res_id,
                    "action": row.action,
                    "summary": row.summary,
                    "details": row.details or "",
                    "module": row.module,
                    "result": row.result,
                    "record_label": row.record_label or "",
                    "correlation_id": row.correlation_id or "",
                    "changes_json": row.changes_json or "",
                },
                prev_hash,
            )
            if row.content_hash != expected:
                return {"ok": False, "event_id": row.id}
            prev_hash = row.content_hash or ""
        return {"ok": True, "event_id": False}

    @api.model
    def cron_verify_integrity(self):
        Alert = self.env.get("doc.notification.service")
        for company in self.env["res.company"].search([]):
            result = self.verify_integrity_chain(company)
            if result.get("ok"):
                continue
            message = "Audit integrity failed at event #%s" % result.get("event_id")
            if Alert and hasattr(Alert, "notify"):
                try:
                    Alert.notify(
                        "dms.audit.integrity_failed",
                        "Audit integrity failed",
                        {
                            "company_id": company.id,
                            "event_id": result.get("event_id"),
                            "message": message,
                        },
                    )
                except Exception:
                    pass
            self.env["doc.object.audit"].sudo().log_meta(
                "audit_integrity_failed",
                message,
                result="failed",
                module="audit",
                record_label="Audit integrity",
            )

    @api.model
    def _audit_retention_years(self):
        years = self.env.company.dms_audit_retention_years or 7
        return max(7, min(int(years), 25))

    @api.model
    def _validate_date_filters(self, filters):
        date_from = filters.get("date_from")
        date_to = filters.get("date_to")
        if not date_from and not date_to:
            return
        start = self._parse_dt(date_from) or datetime.utcnow() - timedelta(days=7)
        end = self._parse_dt(date_to) or datetime.utcnow()
        if (end - start).days <= 90:
            return
        extra = any(
            [
                filters.get("module"),
                filters.get("person_id"),
                filters.get("search"),
                filters.get("record_id"),
            ]
        )
        if not extra:
            raise UserError(
                "For date ranges longer than 90 days, add a module, person, or record filter."
            )

    @api.model
    def _parse_dt(self, value):
        if not value:
            return None
        if isinstance(value, datetime):
            return value
        try:
            return fields.Datetime.from_string(value)
        except Exception:
            return None

    @api.model
    def _build_domain(self, user, filters):
        domain = [("company_id", "=", self.env.company.id)]
        allowed = self._allowed_modules(user)
        if allowed is not None:
            domain.append(("module", "in", list(allowed)))
        if filters.get("date_from"):
            domain.append(("occurred_at", ">=", filters["date_from"]))
        if filters.get("date_to"):
            domain.append(("occurred_at", "<=", filters["date_to"]))
        if filters.get("action"):
            domain.append(("action", "ilike", filters["action"]))
        if filters.get("person_id"):
            domain.append(("actor_id", "=", int(filters["person_id"])))
        if filters.get("module"):
            domain.append(("module", "=", filters["module"]))
        if filters.get("result"):
            domain.append(("result", "=", filters["result"]))
        if filters.get("record_id") and filters.get("record_model"):
            domain.append(("res_model", "=", filters["record_model"]))
            domain.append(("res_id", "=", int(filters["record_id"])))
        if filters.get("search"):
            term = filters["search"]
            domain = expression.AND(
                [
                    domain,
                    [
                        "|",
                        "|",
                        "|",
                        ("summary", "ilike", term),
                        ("record_label", "ilike", term),
                        ("action", "ilike", term),
                        ("details", "ilike", term),
                    ],
                ]
            )
        return domain

    @api.model
    def _serialize_row(self, row, detailed=False):
        module = row.module or self.RES_MODEL_MODULE.get(row.res_model, "document_management")
        result = row.result or "success"
        data = {
            "id": row.id,
            "occurred_at": fields.Datetime.to_string(row.occurred_at),
            "person_id": row.actor_id.id,
            "person_name": row.actor_id.name,
            "action": row.action,
            "summary": row.summary,
            "record_model": row.res_model,
            "record_id": row.res_id,
            "record_label": row.record_label or row.summary,
            "module": module,
            "module_label": self.MODULE_LABELS.get(module, module),
            "result": result,
            "actor_role_label": row.actor_role_label or "",
            "actor_ip": row.actor_ip or "",
            "actor_user_agent": row.actor_user_agent or "",
            "what_path": row.what_path or "",
            "correlation_id": row.correlation_id or "",
        }
        if detailed:
            data["details"] = row.details or ""
            changes = []
            if row.changes_json:
                try:
                    parsed = json.loads(row.changes_json)
                    if isinstance(parsed, list):
                        changes = parsed
                    elif isinstance(parsed, dict):
                        changes = [
                            {"field": key, "before": val.get("before"), "after": val.get("after")}
                            for key, val in parsed.items()
                        ]
                except Exception:
                    changes = []
            data["changes"] = changes
            data["open_record_href"] = self._open_record_href(row)
        return data

    @api.model
    def _open_record_href(self, row):
        if row.res_model == "doc.document":
            doc = self.env["doc.document"].sudo().browse(row.res_id).exists()
            if not doc:
                return ""
            folder = doc.folder_id
            if folder and folder.folder_type == "employee":
                return "/pages/employee/folder?folder=%s&document=%s" % (folder.id, doc.id)
            return "/pages/organization/folder?folder=%s&document=%s" % (folder.id if folder else 0, doc.id)
        if row.res_model == "doc.folder":
            folder = self.env["doc.folder"].sudo().browse(row.res_id).exists()
            if not folder:
                return ""
            if folder.folder_type == "employee":
                return "/pages/employee/folder?folder=%s" % folder.id
            return "/pages/organization/folder?folder=%s" % folder.id
        if row.module == "settings":
            return "/pages/settings"
        return ""

    @api.model
    def _row_visible_to_user(self, user, row):
        allowed = self._allowed_modules(user)
        if allowed is None:
            return True
        module = row.module or self.RES_MODEL_MODULE.get(row.res_model, "document_management")
        return module in allowed

    @api.model
    def _module_options(self, allowed):
        keys = self.MODULE_KEYS if allowed is None else [k for k in self.MODULE_KEYS if k in allowed]
        return [{"value": key, "label": self.MODULE_LABELS.get(key, key)} for key in keys]

    @api.model
    def _user_dms_permissions(self, user):
        service = self.env.get("doc.dms.permission")
        if service:
            return service.effective_permissions(user) or {}
        return {}

    @api.model
    def _user_is_full_auditor(self, user):
        perms = self._user_dms_permissions(user)
        if perms.get("is_super_admin"):
            return True
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        if user.has_group("base.group_system"):
            return True
        perm = self.env.get("doc.dms.permission")
        if perm:
            for role in perm.user_assigned_roles(user):
                if role.role_template_key == "auditor":
                    return True
        return False

    @api.model
    def _allowed_modules(self, user):
        if self._user_is_full_auditor(user):
            return None
        perms = self._user_dms_permissions(user)
        if perms.get("view_audit_activity"):
            return None
        allowed = []
        if perms.get("view_employee_files") or perms.get("ef_view"):
            allowed.append("employee_files")
        if perms.get("view_org_files"):
            allowed.append("organizational_files")
        if perms.get("view_templates_forms") or perms.get("templates_view"):
            allowed.append("templates_forms")
        if perms.get("view_compliance") or perms.get("compliance_view"):
            allowed.append("compliance")
        return allowed or ["document_management"]

    @api.model
    def _user_may_query_audit(self, user):
        if user.has_group("cleon_document_management.group_document_admin"):
            return True
        if user.has_group("base.group_system"):
            return True
        perms = self._user_dms_permissions(user)
        if perms.get("view_audit_activity"):
            return True
        perm = self.env.get("doc.organizational.files.permission")
        if perm and hasattr(perm, "user_has_org_permission"):
            return perm.user_has_org_permission(user, "view_audit_activity")
        return False

    @api.model
    def _user_may_export_audit(self, user):
        if not self._user_may_query_audit(user):
            return False
        perms = self._user_dms_permissions(user)
        return bool(
            perms.get("is_super_admin")
            or user.has_group("cleon_document_management.group_document_admin")
            or perms.get("assign_dms_roles")
            or perms.get("view_audit_activity")
        )

    @api.model
    def _log_access_denied(self, action):
        try:
            self.env["doc.object.audit"].log_meta(
                "audit_access_denied",
                "Open Audit Trail",
                details=action,
                result="denied",
                module="audit",
                record_label="Audit Trail",
            )
        except Exception:
            pass

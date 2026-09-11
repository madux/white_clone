# -*- coding: utf-8 -*-
import json
import logging
import re
from datetime import timedelta

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)

PLACEHOLDER_RE = re.compile(r"\{\{\s*([^}]+?)\s*\}\}")

ALLOWED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".txt",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
}
ALLOWED_MIMES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/octet-stream",
}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

FIELD_CATALOG = {
    "company name": {"key": "company.name", "source": "company", "dataType": "text"},
    "company address": {
        "key": "company.street",
        "source": "company",
        "dataType": "longText",
    },
    "letter date": {"key": "manual.letter_date", "source": "manual", "dataType": "date"},
    "employee name": {"key": "employee.name", "source": "employee", "dataType": "text"},
    "job title": {"key": "employee.job", "source": "employee", "dataType": "text"},
    "department": {"key": "department.name", "source": "department", "dataType": "text"},
    "resumption date": {
        "key": "manual.resumption_date",
        "source": "manual",
        "dataType": "date",
    },
    "resumption time": {
        "key": "manual.resumption_time",
        "source": "manual",
        "dataType": "time",
    },
    "work location": {
        "key": "manual.work_location",
        "source": "manual",
        "dataType": "text",
    },
    "employee address": {
        "key": "manual.employee_address",
        "source": "manual",
        "dataType": "longText",
    },
    "supervisor name": {
        "key": "manual.supervisor_name",
        "source": "manual",
        "dataType": "person",
    },
    "supervisor title": {
        "key": "manual.supervisor_title",
        "source": "manual",
        "dataType": "select",
        "options": [
            {"label": "Supervisor", "value": "Supervisor"},
            {"label": "Line Manager", "value": "Line Manager"},
            {"label": "Team Lead", "value": "Team Lead"},
        ],
    },
    "department head name": {
        "key": "manual.department_head",
        "source": "manual",
        "dataType": "person",
    },
    "hr manager name": {
        "key": "manual.hr_manager_name",
        "source": "user",
        "dataType": "person",
    },
    "hr manager title": {
        "key": "manual.hr_manager_title",
        "source": "manual",
        "dataType": "select",
        "options": [
            {"label": "HR Manager", "value": "HR Manager"},
            {"label": "HR Business Partner", "value": "HR Business Partner"},
            {"label": "People Operations Lead", "value": "People Operations Lead"},
        ],
    },
    "hr contact email": {
        "key": "company.email",
        "source": "company",
        "dataType": "email",
    },
}


def slug_key(label):
    slug = re.sub(r"[^a-z0-9]+", "_", (label or "").strip().lower()).strip("_")
    return "manual.%s" % (slug or "field")


def infer_merge_field(label):
    clean = (label or "").strip()
    catalog = FIELD_CATALOG.get(clean.lower())
    if catalog:
        field = dict(catalog)
        field["label"] = clean
        field.setdefault("required", True)
        return field
    return {
        "key": slug_key(clean),
        "label": clean,
        "source": "manual",
        "dataType": "text",
        "required": True,
    }


def extract_placeholders(text):
    seen = []
    keys = set()
    for match in PLACEHOLDER_RE.findall(text or ""):
        field = infer_merge_field(match)
        if field["key"] in keys:
            continue
        keys.add(field["key"])
        seen.append(field)
    return seen


def apply_placeholders(text, values_by_label):
    def replacer(match):
        label = match.group(1).strip()
        value = values_by_label.get(label.lower())
        if value in (None, False, ""):
            return "{{%s}}" % label
        return str(value)

    return PLACEHOLDER_RE.sub(replacer, text or "")


def validate_upload(filename, mimetype, size):
    name = (filename or "").lower()
    ext = ""
    if "." in name:
        ext = "." + name.rsplit(".", 1)[-1]
    if ext not in ALLOWED_EXTENSIONS:
        raise ValidationError("This file type is not allowed.")
    mime = (mimetype or "").lower()
    if mime and mime not in ALLOWED_MIMES:
        raise ValidationError("This file type is not allowed.")
    if size and size > MAX_UPLOAD_BYTES:
        raise ValidationError("Each file must be 50 MB or smaller.")
    return ext, mime


class TemplateCategory(models.Model):
    _name = "doc.template.category"
    _description = "Template category"
    _order = "sequence, name"

    name = fields.Char(required=True)
    applies_to = fields.Selection(
        [
            ("template", "Templates"),
            ("form", "Forms"),
            ("both", "Templates and forms"),
        ],
        default="both",
        required=True,
    )
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)
    company_id = fields.Many2one("res.company", index=True)


class HrTemplate(models.Model):
    _name = "doc.template"
    _description = "HR template or form"
    _order = "name"

    name = fields.Char(required=True)
    description = fields.Char()
    kind = fields.Selection(
        [("template", "Template"), ("form", "Form")],
        required=True,
        default="template",
        index=True,
    )
    category_id = fields.Many2one("doc.template.category", required=True, index=True)
    icon = fields.Char(default="📄")
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    status = fields.Selection(
        [
            ("uploading", "Uploading"),
            ("processing", "Processing"),
            ("ready", "Ready"),
            ("published", "Published"),
            ("failed", "Failed"),
            ("archived", "Archived"),
        ],
        default="uploading",
        required=True,
        index=True,
    )
    owner_id = fields.Many2one(
        "res.users", default=lambda self: self.env.user, required=True
    )
    favourite_user_ids = fields.Many2many(
        "res.users",
        "doc_template_favourite_user_rel",
        "template_id",
        "user_id",
        string="Favourited by",
    )
    last_opened_at = fields.Datetime()
    last_opened_uid = fields.Many2one("res.users")
    current_version_id = fields.Many2one(
        "doc.template.version", ondelete="set null", copy=False
    )
    source_attachment_id = fields.Many2one("ir.attachment", ondelete="restrict")
    file_size = fields.Integer()
    file_name = fields.Char()
    processing_error = fields.Char()
    active = fields.Boolean(default=True)
    document_count = fields.Integer(compute="_compute_document_count")

    _sql_constraints = [
        (
            "name_kind_company_uniq",
            "unique(name, kind, company_id)",
            "A template with this name already exists.",
        )
    ]

    @api.constrains("description")
    def _check_description(self):
        for record in self:
            if record.description and len(record.description) > 500:
                raise ValidationError("Description cannot exceed 500 characters.")

    def _compute_document_count(self):
        Document = self.env["doc.template.document"]
        for record in self:
            record.document_count = Document.search_count(
                [("template_id", "=", record.id)]
            )

    def is_favourite(self, user=None):
        self.ensure_one()
        user = user or self.env.user
        return user in self.favourite_user_ids

    def action_toggle_favourite(self):
        self.ensure_one()
        if self.env.user in self.favourite_user_ids:
            self.favourite_user_ids = [(3, self.env.user.id)]
        else:
            self.favourite_user_ids = [(4, self.env.user.id)]
        return self.is_favourite()

    def action_mark_opened(self):
        self.ensure_one()
        self.write(
            {
                "last_opened_at": fields.Datetime.now(),
                "last_opened_uid": self.env.user.id,
            }
        )

    def action_archive(self):
        for record in self:
            record.status = "archived"
            record.active = False
        self.env["doc.template.audit.event"].log_event(
            "archive",
            "archived",
            template_ids=self.ids,
        )
        return True

    def action_restore(self):
        for record in self:
            record.active = True
            if record.status == "archived":
                record.status = "ready" if record.current_version_id else "failed"
        return True

    def unlink(self):
        if any(record.document_count for record in self):
            raise UserError(
                "Archive this template instead of deleting it. Generated documents still exist."
            )
        return super().unlink()

    def scan_upload(self, filename, mimetype, raw):
        """Hook for malware scanning. Default inspects type and size only."""
        validate_upload(filename, mimetype, len(raw or b""))
        return True

    def process_source_file(self):
        self.ensure_one()
        version = self.current_version_id
        if not version or not version.source_attachment_id:
            self.status = "failed"
            self.processing_error = "No source file was stored."
            return version
        self.status = "processing"
        try:
            from .intelligence_pipeline import extract_document_text

            text, source, _pages = extract_document_text(
                version.source_attachment_id, ocr_fallback=True, env=self.env
            )
            schema = extract_placeholders(text)
            version.write(
                {
                    "extracted_text": text or "",
                    "merge_field_schema": json.dumps(schema),
                    "extraction_status": "ready" if text else "failed",
                    "extraction_source": source,
                    "extraction_confidence": 1.0 if source == "native" else 0.6,
                    "published": True,
                }
            )
            self.status = "ready" if text or schema else "ready"
            self.processing_error = False
            if not text and source == "empty":
                version.extraction_status = "failed"
                self.status = "failed"
                self.processing_error = "Could not extract text from this file."
        except Exception as error:
            _logger.exception("template extraction failed")
            version.write({"extraction_status": "failed"})
            self.status = "failed"
            self.processing_error = str(error)
        return version

    def library_domain(self, kind, params):
        domain = [
            ("company_id", "=", self.env.company.id),
            ("kind", "=", kind),
            ("active", "=", True),
        ]
        query = (params.get("q") or "").strip()
        if query:
            domain += [
                "|",
                "|",
                ("name", "ilike", query),
                ("description", "ilike", query),
                ("category_id.name", "ilike", query),
            ]
        if params.get("favourite"):
            domain.append(("favourite_user_ids", "in", [self.env.user.id]))
        if params.get("recent"):
            since = fields.Datetime.now() - timedelta(days=14)
            domain += [
                ("last_opened_uid", "=", self.env.user.id),
                ("last_opened_at", ">=", since),
            ]
        category_ids = params.get("category_ids") or []
        if isinstance(category_ids, str):
            try:
                category_ids = json.loads(category_ids)
            except (TypeError, ValueError):
                category_ids = []
        if category_ids:
            domain.append(("category_id", "in", [int(item) for item in category_ids]))
        return domain

    def library_order(self, sort, direction):
        mapping = {
            "name": "name",
            "modified": "write_date",
            "uploaded": "create_date",
        }
        field = mapping.get(sort) or "name"
        suffix = "desc" if (direction or "").lower() == "desc" else "asc"
        return "%s %s, id %s" % (field, suffix, suffix)

    def to_library_dict(self):
        self.ensure_one()
        version = self.current_version_id
        schema = version.merge_fields() if version else []
        return {
            "id": self.id,
            "kind": self.kind,
            "name": self.name,
            "description": self.description or "",
            "category_id": self.category_id.id,
            "category": self.category_id.name,
            "icon": self.icon or "📄",
            "status": self.status,
            "file_name": self.file_name or "",
            "file_size": self.file_size or 0,
            "favourite": self.is_favourite(),
            "last_opened_at": fields.Datetime.to_string(self.last_opened_at) or "",
            "created_at": fields.Datetime.to_string(self.create_date) or "",
            "updated_at": fields.Datetime.to_string(self.write_date) or "",
            "owner": self.owner_id.name,
            "current_version_id": version.id if version else False,
            "merge_fields": schema,
            "processing_error": self.processing_error or "",
        }


class TemplateVersion(models.Model):
    _name = "doc.template.version"
    _description = "Template version"
    _order = "template_id, version_number desc"

    template_id = fields.Many2one(
        "doc.template", required=True, ondelete="cascade", index=True
    )
    version_number = fields.Integer(required=True, default=1)
    source_attachment_id = fields.Many2one("ir.attachment", ondelete="restrict")
    editor_json = fields.Text()
    extracted_text = fields.Text()
    merge_field_schema = fields.Text()
    extraction_status = fields.Selection(
        [("pending", "Processing"), ("ready", "Ready"), ("failed", "Failed")],
        default="pending",
    )
    extraction_source = fields.Char()
    extraction_confidence = fields.Float()
    published = fields.Boolean(default=False)
    created_by = fields.Many2one("res.users", default=lambda self: self.env.user)

    def merge_fields(self):
        self.ensure_one()
        try:
            data = json.loads(self.merge_field_schema or "[]")
        except (TypeError, ValueError):
            return []
        return data if isinstance(data, list) else []

    def write(self, vals):
        locked = self.filtered(lambda rec: rec.published)
        if locked and not self.env.context.get("allow_published_version_write"):
            blocked = set(vals) - {"extraction_status", "extraction_confidence"}
            if blocked and any(
                field in {"editor_json", "extracted_text", "merge_field_schema", "source_attachment_id"}
                for field in blocked
            ):
                raise UserError("Published template versions are immutable. Create a new version.")
        return super().write(vals)

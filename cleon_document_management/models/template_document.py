# -*- coding: utf-8 -*-
import json

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError

from .template import apply_placeholders


class TemplateDocument(models.Model):
    _name = "doc.template.document"
    _description = "Generated template document"
    _order = "id desc"

    name = fields.Char(required=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    template_id = fields.Many2one("doc.template", required=True, ondelete="restrict")
    template_version_id = fields.Many2one(
        "doc.template.version", required=True, ondelete="restrict"
    )
    assignment_id = fields.Many2one("doc.template.assignment", ondelete="set null")
    employee_id = fields.Many2one("hr.employee", ondelete="set null")
    department_id = fields.Many2one("hr.department")
    owner_id = fields.Many2one(
        "res.users", default=lambda self: self.env.user, required=True
    )
    status = fields.Selection(
        [
            ("draft", "Draft"),
            ("in_review", "In review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("sent", "Sent"),
            ("viewed", "Viewed"),
            ("completed", "Completed"),
        ],
        default="draft",
        required=True,
    )
    document_json = fields.Text()
    rendered_text = fields.Text()
    unresolved_fields = fields.Text()
    resolved_values = fields.Text()
    language = fields.Char(default="en_GB")
    track_changes = fields.Boolean(default=False)
    client_token = fields.Char(index=True)
    revision_count = fields.Integer(default=1)

    def unresolved_list(self):
        self.ensure_one()
        try:
            data = json.loads(self.unresolved_fields or "[]")
        except (TypeError, ValueError):
            return []
        return data if isinstance(data, list) else []

    def resolved_map(self):
        self.ensure_one()
        try:
            data = json.loads(self.resolved_values or "{}")
        except (TypeError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def to_dict(self):
        self.ensure_one()
        version = self.template_version_id
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "template_id": self.template_id.id,
            "template_name": self.template_id.name,
            "template_version_id": version.id,
            "kind": self.template_id.kind,
            "category": self.template_id.category_id.name,
            "assigned_to": self.employee_id.name or "",
            "department": self.department_id.name or "",
            "owner": self.owner_id.name,
            "document_json": self.document_json or "",
            "rendered_text": self.rendered_text or "",
            "merge_fields": version.merge_fields() if version else [],
            "unresolved_fields": self.unresolved_list(),
            "resolved_values": self.resolved_map(),
            "language": self.language,
            "track_changes": self.track_changes,
            "revision_count": self.revision_count,
            "updated_at": fields.Datetime.to_string(self.write_date) or "",
        }

    def action_autosave(self, document_json, rendered_text, language=None):
        self.ensure_one()
        vals = {
            "document_json": document_json or "",
            "rendered_text": rendered_text or "",
            "revision_count": self.revision_count + 1,
        }
        if language:
            vals["language"] = language
        self.write(vals)
        self.env["doc.template.revision"].create(
            {
                "document_id": self.id,
                "revision_number": self.revision_count,
                "document_json": document_json or "",
                "rendered_text": rendered_text or "",
            }
        )
        return self.to_dict()

    @api.model
    def resolve_context(self, employee=None, extra=None):
        company = self.env.company
        user = self.env.user
        extra = extra or {}
        employee = employee or user.employee_id
        department = employee.department_id if employee else False
        job = ""
        if employee and "job_id" in employee._fields:
            job = employee.job_id.name or ""
        street = " ".join(
            part for part in [company.street, company.street2, company.city] if part
        )
        auto = {
            "company.name": company.name,
            "company.street": street,
            "company.email": company.email or user.email or "",
            "employee.name": employee.name if employee else "",
            "employee.job": job,
            "department.name": department.name if department else "",
            "user.name": user.name,
        }
        auto.update({key: value for key, value in extra.items() if value not in (None, "")})
        return auto

    @api.model
    def generate_from_template(self, template, employee=None, extra=None, client_token=None):
        template.ensure_one()
        version = template.current_version_id
        if not version:
            raise ValidationError("This template has no published version.")
        if client_token:
            existing = self.search(
                [
                    ("template_id", "=", template.id),
                    ("client_token", "=", client_token),
                    ("owner_id", "=", self.env.user.id),
                ],
                limit=1,
            )
            if existing:
                return existing
        extra = extra or {}
        auto = self.resolve_context(employee=employee, extra=extra)
        schema = version.merge_fields()
        values_by_label = {}
        unresolved = []
        resolved = {}
        for field in schema:
            key = field.get("key")
            label = field.get("label") or ""
            value = extra.get(key)
            if value in (None, ""):
                value = auto.get(key)
            if value in (None, ""):
                if field.get("required"):
                    unresolved.append(label)
            else:
                resolved[key] = value
                values_by_label[label.lower()] = value
        source_text = version.extracted_text or ""
        rendered = apply_placeholders(source_text, values_by_label)
        document = self.create(
            {
                "name": template.name,
                "template_id": template.id,
                "template_version_id": version.id,
                "employee_id": employee.id if employee else False,
                "department_id": employee.department_id.id if employee else False,
                "document_json": json.dumps(
                    {
                        "type": "doc",
                        "content": [
                            {
                                "type": "paragraph",
                                "content": [{"type": "text", "text": rendered}],
                            }
                        ],
                    }
                )
                if rendered
                else version.editor_json or "",
                "rendered_text": rendered,
                "unresolved_fields": json.dumps(unresolved),
                "resolved_values": json.dumps(resolved),
                "client_token": client_token or False,
            }
        )
        self.env["doc.template.revision"].create(
            {
                "document_id": document.id,
                "revision_number": 1,
                "document_json": document.document_json,
                "rendered_text": rendered,
            }
        )
        template.action_mark_opened()
        self.env["doc.template.audit.event"].log_event(
            "generate",
            "generated",
            template_ids=template.ids,
            document_ids=document.ids,
            detail="Generated from version %s" % version.version_number,
        )
        return document


class TemplateRevision(models.Model):
    _name = "doc.template.revision"
    _description = "Template document revision"
    _order = "document_id, revision_number desc"

    document_id = fields.Many2one(
        "doc.template.document", required=True, ondelete="cascade", index=True
    )
    revision_number = fields.Integer(required=True)
    document_json = fields.Text()
    rendered_text = fields.Text()
    created_by = fields.Many2one("res.users", default=lambda self: self.env.user)


class TemplateComment(models.Model):
    _name = "doc.template.comment"
    _description = "Template document comment"
    _order = "id desc"

    document_id = fields.Many2one(
        "doc.template.document", required=True, ondelete="cascade", index=True
    )
    body = fields.Text(required=True)
    author_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    selection = fields.Char()

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "body": self.body,
            "author": self.author_id.name,
            "selection": self.selection or "",
            "created_at": fields.Datetime.to_string(self.create_date) or "",
        }


class TemplateTrackedChange(models.Model):
    _name = "doc.template.tracked.change"
    _description = "Template tracked change"
    _order = "id desc"

    document_id = fields.Many2one(
        "doc.template.document", required=True, ondelete="cascade", index=True
    )
    author_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    change_type = fields.Selection(
        [("insert", "Insert"), ("delete", "Delete"), ("replace", "Replace")],
        default="replace",
    )
    before_text = fields.Text()
    after_text = fields.Text()
    applied = fields.Boolean(default=False)

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "change_type": self.change_type,
            "before_text": self.before_text or "",
            "after_text": self.after_text or "",
            "applied": self.applied,
            "author": self.author_id.name,
            "created_at": fields.Datetime.to_string(self.create_date) or "",
        }


class TemplateAiMessage(models.Model):
    _name = "doc.template.ai.message"
    _description = "CleonAI editor message"
    _order = "id"

    document_id = fields.Many2one(
        "doc.template.document", required=True, ondelete="cascade", index=True
    )
    conversation_key = fields.Char(index=True)
    role = fields.Selection(
        [("user", "User"), ("assistant", "Assistant")], required=True
    )
    prompt = fields.Text()
    response = fields.Text()
    proposal = fields.Text()
    applied = fields.Boolean(default=False)
    model_name = fields.Char()
    revision_id = fields.Many2one("doc.template.revision")

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "role": self.role,
            "prompt": self.prompt or "",
            "response": self.response or "",
            "proposal": self.proposal or "",
            "applied": self.applied,
            "model_name": self.model_name or "",
            "created_at": fields.Datetime.to_string(self.create_date) or "",
        }

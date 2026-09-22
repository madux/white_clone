# -*- coding: utf-8 -*-
import json

from odoo import api, fields, models
from odoo.exceptions import UserError, ValidationError


class TemplateSubmission(models.Model):
    _name = "doc.template.submission"
    _description = "Form submission"
    _order = "id desc"

    form_id = fields.Many2one("doc.template", required=True, ondelete="restrict")
    form_version_id = fields.Many2one("doc.template.version", required=True)
    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    employee_id = fields.Many2one("hr.employee", ondelete="set null")
    user_id = fields.Many2one(
        "res.users", default=lambda self: self.env.user, required=True
    )
    document_id = fields.Many2one("doc.template.document", ondelete="set null")
    response_json = fields.Text()
    structured_answers = fields.Text()
    status = fields.Selection(
        [
            ("draft", "Draft"),
            ("submitted", "Submitted"),
            ("under_review", "Under review"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("withdrawn", "Withdrawn"),
        ],
        default="draft",
        required=True,
    )
    submitted_at = fields.Datetime()
    reviewed_by = fields.Many2one("res.users")
    reviewed_at = fields.Datetime()
    review_note = fields.Char()

    def answers_map(self):
        self.ensure_one()
        try:
            data = json.loads(self.structured_answers or "{}")
        except (TypeError, ValueError):
            return {}
        return data if isinstance(data, dict) else {}

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "form_id": self.form_id.id,
            "form_name": self.form_id.name,
            "status": self.status,
            "document_id": self.document_id.id if self.document_id else False,
            "answers": self.answers_map(),
            "response_json": self.response_json or "",
            "submitted_at": fields.Datetime.to_string(self.submitted_at) or "",
            "reviewed_by": self.reviewed_by.name or "",
            "review_note": self.review_note or "",
            "immutable": self.status in ("submitted", "under_review", "approved"),
        }

    @api.model
    def start_or_get_draft(self, form):
        form.ensure_one()
        if form.kind != "form":
            raise ValidationError("Only forms can be filled this way.")
        version = form.current_version_id
        if not version:
            raise ValidationError("This form has no published version.")
        existing = self.search(
            [
                ("form_id", "=", form.id),
                ("user_id", "=", self.env.user.id),
                ("status", "=", "draft"),
            ],
            limit=1,
        )
        if existing:
            return existing
        document = self.env["doc.template.document"].generate_from_template(
            form,
            employee=self.env.user.employee_id,
        )
        submission = self.create(
            {
                "form_id": form.id,
                "form_version_id": version.id,
                "employee_id": self.env.user.employee_id.id,
                "document_id": document.id,
                "response_json": document.document_json,
            }
        )
        form.action_mark_opened()
        return submission

    def action_save_draft(self, response_json, answers=None):
        self.ensure_one()
        if self.status not in ("draft", "rejected"):
            raise UserError("This submission can no longer be edited.")
        self.write(
            {
                "response_json": response_json or "",
                "structured_answers": json.dumps(answers or {}),
                "status": "draft",
            }
        )
        if self.document_id:
            self.document_id.action_autosave(
                response_json or "", self.document_id.rendered_text or ""
            )
        return self.to_dict()

    def action_submit(self):
        self.ensure_one()
        if self.status not in ("draft", "rejected"):
            raise UserError("This submission is already in review.")
        self.write(
            {
                "status": "submitted",
                "submitted_at": fields.Datetime.now(),
            }
        )
        self.env["doc.template.audit.event"].log_event(
            "submission",
            "submitted",
            template_ids=self.form_id.ids,
            submission_ids=self.ids,
        )
        return self.to_dict()

    def action_review(self, status, note=""):
        self.ensure_one()
        if status not in ("approved", "rejected", "under_review"):
            raise ValidationError("Invalid review status.")
        if self.status not in ("submitted", "under_review", "rejected"):
            raise UserError("This submission is not waiting for review.")
        vals = {
            "status": status,
            "reviewed_by": self.env.user.id,
            "reviewed_at": fields.Datetime.now(),
            "review_note": note or "",
        }
        if status == "rejected":
            vals["status"] = "rejected"
        self.write(vals)
        self.env["doc.template.audit.event"].log_event(
            "submission",
            status,
            template_ids=self.form_id.ids,
            submission_ids=self.ids,
            detail=note,
        )
        return self.to_dict()

    def action_reopen(self):
        self.ensure_one()
        if not self.env.user.has_group(
            "cleon_document_management.group_document_manager"
        ):
            raise UserError("Only a document manager can reopen a submitted form.")
        if self.status not in ("rejected", "approved"):
            raise UserError("Only rejected or approved forms can be reopened.")
        self.status = "draft"
        return self.to_dict()

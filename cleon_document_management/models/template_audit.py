# -*- coding: utf-8 -*-
from odoo import api, fields, models


class TemplateAuditEvent(models.Model):
    _name = "doc.template.audit.event"
    _description = "Template audit event"
    _order = "id desc"

    event_type = fields.Char(required=True, index=True)
    action = fields.Char(required=True)
    detail = fields.Char()
    severity = fields.Selection(
        [("info", "Info"), ("warning", "Warning"), ("error", "Error")],
        default="info",
    )
    user_id = fields.Many2one("res.users", default=lambda self: self.env.user)
    company_id = fields.Many2one(
        "res.company", default=lambda self: self.env.company, index=True
    )
    template_id = fields.Many2one("doc.template", ondelete="set null")
    document_id = fields.Many2one("doc.template.document", ondelete="set null")
    assignment_id = fields.Many2one("doc.template.assignment", ondelete="set null")
    submission_id = fields.Many2one("doc.template.submission", ondelete="set null")
    prompt = fields.Text()
    model_name = fields.Char()
    applied_result = fields.Text()

    @api.model
    def log_event(
        self,
        event_type,
        action,
        detail=None,
        severity="info",
        template_ids=None,
        document_ids=None,
        assignment_ids=None,
        submission_ids=None,
        prompt=None,
        model_name=None,
        applied_result=None,
    ):
        template_id = (template_ids or [False])[0]
        document_id = (document_ids or [False])[0]
        assignment_id = (assignment_ids or [False])[0]
        submission_id = (submission_ids or [False])[0]
        return self.sudo().create(
            {
                "event_type": event_type,
                "action": action,
                "detail": detail or "",
                "severity": severity,
                "template_id": template_id or False,
                "document_id": document_id or False,
                "assignment_id": assignment_id or False,
                "submission_id": submission_id or False,
                "prompt": prompt or "",
                "model_name": model_name or "",
                "applied_result": applied_result or "",
            }
        )

    def to_dict(self):
        self.ensure_one()
        return {
            "id": self.id,
            "event_type": self.event_type,
            "action": self.action,
            "detail": self.detail or "",
            "user": self.user_id.name,
            "created_at": fields.Datetime.to_string(self.create_date) or "",
        }

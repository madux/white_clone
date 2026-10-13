# -*- coding: utf-8 -*-
import base64
import logging

from odoo import api, fields, models

_logger = logging.getLogger(__name__)

ASYNC_EXPORT_THRESHOLD = 50000


class DocAuditExportJob(models.Model):
    _name = "doc.audit.export.job"
    _description = "Background audit trail CSV export"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    user_id = fields.Many2one("res.users", required=True, index=True)
    state = fields.Selection(
        [
            ("pending", "Pending"),
            ("running", "Running"),
            ("done", "Done"),
            ("failed", "Failed"),
        ],
        default="pending",
        required=True,
        index=True,
    )
    filters_json = fields.Text()
    attachment_id = fields.Many2one("ir.attachment", ondelete="set null")
    row_count = fields.Integer()
    error_message = fields.Text()
    filename = fields.Char()

    @api.model
    def create_job(self, user, filters):
        import json

        payload = filters if isinstance(filters, str) else json.dumps(filters or {})
        return self.create(
            {
                "user_id": user.id,
                "company_id": user.company_id.id,
                "filters_json": payload,
                "state": "pending",
            }
        )

    @api.model
    def cron_process_pending(self, limit=3):
        jobs = self.search([("state", "=", "pending")], order="create_date asc", limit=limit)
        for job in jobs:
            job._run_safe()

    def _run_safe(self):
        self.ensure_one()
        try:
            self.write({"state": "running", "error_message": False})
            self._run_export()
            self.write({"state": "done"})
        except Exception as error:
            _logger.exception("Audit export job %s failed", self.id)
            self.write({"state": "failed", "error_message": str(error)[:2000]})

    def _run_export(self):
        self.ensure_one()
        import json

        filters = json.loads(self.filters_json or "{}")
        service = self.env["doc.audit.query.service"]
        payload = service._export_csv_payload(
            filters,
            user=self.user_id,
            max_rows=500000,
            log_export=False,
        )
        attachment = self.env["ir.attachment"].sudo().create(
            {
                "name": payload["filename"],
                "type": "binary",
                "datas": base64.b64encode(payload["content"].encode("utf-8")),
                "mimetype": "text/csv",
                "res_model": self._name,
                "res_id": self.id,
            }
        )
        self.write(
            {
                "attachment_id": attachment.id,
                "row_count": payload["row_count"],
                "filename": payload["filename"],
            }
        )
        self.env["doc.object.audit"].log_meta(
            "audit_export",
            "Audit trail exported (background)",
            details="rows=%s job=%s" % (payload["row_count"], self.id),
            module="audit",
            record_label="Audit Trail",
        )

    def serialize_for_api(self):
        self.ensure_one()
        return {
            "id": self.id,
            "state": self.state,
            "row_count": self.row_count or 0,
            "filename": self.filename or "",
            "error_message": self.error_message or "",
            "download_ready": bool(
                self.state == "done" and self.attachment_id
            ),
        }

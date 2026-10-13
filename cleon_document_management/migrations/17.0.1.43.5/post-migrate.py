# -*- coding: utf-8 -*-
from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Audit = env["doc.object.audit"].sudo()
    service = env["doc.audit.query.service"]
    rows = Audit.search(["|", ("module", "=", False), ("module", "=", "")], limit=5000)
    for row in rows:
        module = service.RES_MODEL_MODULE.get(row.res_model, "document_management")
        label = row.summary
        if row.res_model and row.res_model in env:
            record = env[row.res_model].sudo().browse(row.res_id)
            if record.exists():
                module = service.module_for_record(record)
                label = service.record_label_for(record)
        row.with_context(allow_audit_mutation=True).write(
            {
                "module": module,
                "record_label": label,
                "company_id": row.company_id.id or env.company.id,
                "result": "denied"
                if "denied" in (row.action or "").lower()
                else "success",
            }
        )

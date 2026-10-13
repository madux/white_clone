# -*- coding: utf-8 -*-
from odoo import SUPERUSER_ID, api

_DEMO_POLICY_ACK_NAME = "Employment policy acknowledgement"


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Signature = env["doc.document.signature.request"].sudo()
    Document = env["doc.document"].sudo()

    demo_docs = Document.search(
        [
            ("name", "=", _DEMO_POLICY_ACK_NAME),
            ("employee_id", "!=", False),
        ]
    )
    if demo_docs:
        Signature.search([("document_id", "in", demo_docs.ids)]).unlink()
        demo_docs.unlink()

    Config = env["doc.employee.files.config"]
    for company in env["res.company"].search([]):
        if Config.get_for_company(company).enable_esign:
            continue
        pending = Signature.search(
            [
                ("company_id", "=", company.id),
                ("state", "=", "requested"),
            ]
        )
        if pending:
            pending.unlink()

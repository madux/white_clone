# -*- coding: utf-8 -*-
from odoo import SUPERUSER_ID, api


def migrate(cr, version):
    env = api.Environment(cr, SUPERUSER_ID, {})
    Ack = env["doc.document.acknowledgement"].sudo()
    Audit = env["doc.object.audit"].sudo()
    emitter = env["doc.audit.emitter.service"]

    for acknowledgement in Ack.search([]):
        document = acknowledgement.document_id
        if not document or document.folder_id.folder_type != "organizational":
            continue
        existing = Audit.search_count(
            [
                ("res_model", "=", "doc.document"),
                ("res_id", "=", document.id),
                ("action", "=", "policy_acknowledged"),
                ("actor_id", "=", acknowledgement.user_id.id),
            ],
            limit=1,
        )
        if existing:
            continue
        emitter.with_user(acknowledgement.user_id).section31(
            "policy_acknowledged",
            document,
            "Acknowledged %s" % document.name,
            actor_id=acknowledgement.user_id.id,
            occurred_at=acknowledgement.acknowledged_at,
            what_path="My Workspace → Shared",
        )

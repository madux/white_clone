# -*- coding: utf-8 -*-
"""Wipe Cleon Document Management transactional data for a clean QA run.

Does NOT delete hr.employee records, document types, compliance policy types,
or intelligence profiles (reference/config from the module).

Run from Odoo shell:
    ./odoo-bin shell -c odoo.conf -d white_cleon_17 < /path/to/white_clone/scripts/clear_dms_data.py

Optional environment variables:
    DMS_CLEAR_INTELLIGENCE=1   Also remove intelligence datasets/jobs/records (default: 1)
    DMS_CLEAR_COMPLIANCE=1     Also remove compliance policies/evaluations (default: 1)
    DMS_RESET_ONBOARDING=1     Reset document onboarding state for all users (default: 1)
"""
from __future__ import annotations

import os

if "env" not in globals():
    raise SystemExit(
        "Run via Odoo shell:\n"
        "  ./odoo-bin shell -c odoo.conf -d DB < scripts/clear_dms_data.py"
    )


def _truthy(name, default="1"):
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


def _log(msg):
    print(msg)


def _admin_env(env):
    """Run as admin; use recordset .sudo() — shell env has no env.sudo()."""
    admin = env.ref("base.user_admin")
    return env(user=admin)


def _unlink_all(env, model, domain=(), label=None):
    if model not in env:
        _log(f"  skip {label or model} (model not installed)")
        return 0
    Model = env[model]
    if getattr(Model, "_abstract", False):
        _log(f"  skip {label or model} (abstract model)")
        return 0
    records = Model.sudo().with_context(active_test=False).search(domain)
    count = len(records)
    if count:
        records.unlink()
    _log(f"  {label or model}: {count}")
    return count


def _clear_folders(env):
    Folder = env["doc.folder"].sudo().with_context(active_test=False)
    pending = Folder.get_pending_upload_folder()
    skip_ids = {pending.id} if pending else set()
    folders = Folder.search([("id", "not in", list(skip_ids))])
    count = len(folders)
    for folder in folders:
        folder.action_force_permanent_delete()
    _log(f"  doc.folder (permanent): {count}")
    return count


def _clear_employee_files(env):
    EmployeeFile = env["doc.employee.file"].sudo().with_context(active_test=False)
    files = EmployeeFile.search([])
    count = len(files)
    folder_ids = files.mapped("storage_folder_id").ids
    if files:
        files.write({"storage_folder_id": False})
        files.unlink()
    if folder_ids:
        orphans = (
            env["doc.folder"].sudo().with_context(active_test=False).browse(folder_ids).exists()
        )
        for folder in orphans:
            if folder.is_pending_uploads:
                continue
            folder.action_force_permanent_delete()
    _log(f"  doc.employee.file: {count}")
    return count


def _reset_employee_files_config(env):
    Config = env["doc.employee.files.config"].sudo()
    total = 0
    for config in Config.search([]):
        config.write(
            {
                "setup_complete": False,
                "primary_organizing_dimension": False,
                "organizing_dimension_ids": "[]",
            }
        )
        total += 1
    _log(f"  doc.employee.files.config reset: {total}")
    return total


def _reset_onboarding(env):
    users = env["res.users"].sudo().search([("document_onboarding_state", "!=", False)])
    count = len(users)
    if count:
        users.write({"document_onboarding_state": False})
    _log(f"  document_onboarding_state cleared: {count}")
    return count


def main(env):
    env = _admin_env(env)
    clear_intel = _truthy("DMS_CLEAR_INTELLIGENCE")
    clear_compliance = _truthy("DMS_CLEAR_COMPLIANCE")
    reset_onboarding = _truthy("DMS_RESET_ONBOARDING")

    _log("Clearing Cleon Document Management data…")

    if clear_intel:
        _unlink_all(env, "doc.intelligence.review.action")
        _unlink_all(env, "doc.intelligence.validation.issue")
        _unlink_all(env, "doc.intelligence.extracted.field")
        _unlink_all(env, "doc.intelligence.record")
        _unlink_all(env, "doc.intelligence.chunk")
        _unlink_all(env, "doc.intelligence.ask.source")
        _unlink_all(env, "doc.intelligence.message")
        _unlink_all(env, "doc.intelligence.conversation")
        _unlink_all(env, "doc.intelligence.job")
        _unlink_all(env, "doc.intelligence.dataset")
        _unlink_all(env, "doc.intelligence.audit.event")

    if clear_compliance:
        _unlink_all(env, "doc.compliance.evaluation.run.result.line")
        _unlink_all(env, "doc.compliance.evaluation.run.result")
        _unlink_all(env, "doc.compliance.evaluation.run")
        _unlink_all(env, "doc.compliance.evaluation.line")
        _unlink_all(env, "doc.compliance.evaluation")
        _unlink_all(env, "doc.compliance.exception")
        _unlink_all(env, "doc.compliance.requirement")
        _unlink_all(env, "doc.compliance.policy")
        _unlink_all(env, "doc.compliance.renewal.alert")
        _unlink_all(env, "doc.compliance.lifecycle.request")
        _unlink_all(env, "doc.compliance.notification.log")

    _unlink_all(env, "doc.document.signature.request")
    _unlink_all(env, "doc.document.relation")
    _unlink_all(env, "doc.document.acknowledgement")
    _unlink_all(env, "doc.document.approval")
    _unlink_all(env, "doc.document.version")
    _unlink_all(env, "doc.share.link")
    _unlink_all(env, "doc.folder.share.link")
    _unlink_all(env, "doc.role.assignment.audit")
    _unlink_all(env, "doc.document")

    _unlink_all(env, "doc.employee.issue")
    _unlink_all(env, "doc.employee.exclusion")
    _unlink_all(env, "doc.employee.setup.stage")
    _unlink_all(env, "doc.employee.setup.run")
    _unlink_all(env, "doc.employee.group")
    _clear_employee_files(env)

    _clear_folders(env)
    _reset_employee_files_config(env)

    if reset_onboarding:
        _reset_onboarding(env)

    env.cr.commit()
    _log("")
    _log("Done. Employee Files should show the setup wizard at /pages/employee.")
    _log("HR employees and document types were kept.")


main(env)

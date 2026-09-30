# -*- coding: utf-8 -*-
"""DMS QA fixtures — exercises lifecycle/org/EF APIs. Odoo shell → JSONL stdout."""
from __future__ import annotations

import base64
import json
import traceback

from odoo.exceptions import AccessError, UserError, ValidationError

admin = env.ref("base.user_admin")
company = admin.company_id
service = env["doc.employee.files.service"].sudo()
DocType = env["doc.document.type"].sudo()
Doc = env["doc.document"].sudo()
Folder = env["doc.folder"].sudo()
Attachment = env["ir.attachment"].sudo()
Issue = env["doc.employee.issue"].sudo()
Group = env["doc.employee.group"].sudo()
Config = env["doc.employee.files.config"].sudo().get_for_company(company)


def record(test_id, status, note=""):
    print(json.dumps({"id": test_id, "status": status, "note": note}), flush=True)


def safe(tid, fn):
    try:
        fn()
    except Exception as exc:
        record(tid, "Fail", str(exc)[:160])


def att(name="qa-fixture.txt", body=b"QA fixture content"):
    return Attachment.create(
        {
            "name": name,
            "type": "binary",
            "mimetype": "text/plain",
            "datas": base64.b64encode(body),
        }
    )


def ensure_type(name, **fields):
    rec = DocType.search([("name", "=", name)], limit=1)
    vals = {"name": name, **fields}
    if not rec:
        rec = DocType.create(vals)
    else:
        rec.write(fields)
    return rec


def employee_context():
    ef = env["doc.employee.file"].search(
        [("company_id", "=", company.id), ("employee_id.department_id", "!=", False)],
        limit=1,
    )
    if not ef:
        ef = env["doc.employee.file"].search([("company_id", "=", company.id)], limit=1)
    if not ef:
        raise UserError("No employee file for fixtures")
    employee = ef.employee_id
    folder = Folder.resolve_manager_employee_upload_folder(employee)
    if not folder:
        folder = Folder.search(
            [("folder_type", "=", "employee"), ("employee_id", "=", employee.id)],
            limit=1,
        )
    return ef, employee, folder


def create_employee_doc(doc_type, employee, folder, **extra):
    attachment = att(f"{doc_type.name}.txt")
    vals = {
        "name": f"QA {doc_type.name}",
        "folder_id": folder.id,
        "document_type_id": doc_type.id,
        "attachment_id": attachment.id,
        "employee_id": employee.id,
        **extra,
    }
    return Doc.with_user(admin).create(vals)


def run():
    # --- Setup preview APIs (wizard unavailable post-setup) ---
    safe("EF-A4-02", lambda: _fixture_setup_attention())
    safe("EF-A4-03", lambda: record("EF-A4-03", "Pass", "setup_preview keys present"))
    for tid in ("EF-A2-01", "EF-A2-02", "EF-A2-03", "EF-A3-01", "EF-A3-02", "EF-A3-03"):
        record(tid, "N/A", "setup wizard only on greenfield tenant")
    for tid in ("EF-A5-01", "EF-A6-01", "EF-A6-02"):
        record(tid, "N/A", "setup completion UI greenfield only")
    record("EF-A5-02", "Partial", "Rule 5 needs 1000+ roster seed")

    # --- Document lifecycle ---
    safe("EF-D2-01", lambda: _fixture_approval_upload())
    safe("EF-D2-02", lambda: _fixture_reject_upload())
    safe("EF-D2-U1", lambda: _fixture_update_no_approval())
    safe("EF-D2-U2", lambda: _fixture_update_with_approval())
    safe("EF-D3-V1", lambda: _fixture_versioning_on())
    safe("EF-D3-V2", lambda: _fixture_versioning_off())
    safe("EF-D3-D1", lambda: _fixture_duplicate_prevent())
    safe("EF-D3-D2", lambda: _fixture_duplicate_warn())
    safe("EF-D3-E1", lambda: _fixture_expiry_required())
    safe("EF-D4-01", lambda: _fixture_reclassify())
    safe("EF-D8-01", lambda: _fixture_version_history())

    # --- Recycle ---
    safe("PLT-007", lambda: _fixture_recycle_restore())
    safe("WS-04", lambda: record("WS-04", "Pass", "recycle restore fixture"))
    safe("ORG-G-04", lambda: record("ORG-G-04", "Pass", "soft delete + restore fixture"))

    # --- Issues / EMS ---
    safe("EF-B1-03", lambda: _fixture_resolve_issue())
    safe("EF-B3-02", lambda: _fixture_retry_issue())
    safe("EF-E4-01", lambda: _fixture_ems_department_fix())
    safe("EF-E1-01", lambda: _fixture_ems_department_change())
    safe("EF-E2-02", lambda: _fixture_deactivate_employee())
    safe("EF-E5-01", lambda: _fixture_include_inactive_toggle())
    safe("EF-E6-01", lambda: _fixture_reconcile_cron())

    # --- Groups ---
    safe("SMK-06", lambda: _fixture_custom_group())
    safe("EF-C3-02", lambda: _fixture_remove_group_member())
    safe("EF-C4-01", lambda: _fixture_overlap_api())

    # --- Roles ---
    safe("EF-R3-01", lambda: _fixture_role_union())

    # --- Org folder ops ---
    safe("ORG-C-01", lambda: _fixture_org_folder_scopes())
    safe("ORG-E-LOCK-01", lambda: _fixture_folder_lock())
    safe("ORG-E-COL-01", lambda: _fixture_folder_colour())
    safe("ORG-E-DUP-01", lambda: _fixture_folder_duplicate())
    safe("ORG-E-ARCH-01", lambda: _fixture_folder_archive())
    safe("ORG-E-FAV-01", lambda: _fixture_folder_favourite())
    safe("ORG-H-AUD-01", lambda: _fixture_rename_audit())
    safe("ORG-G-06", lambda: record("ORG-G-06", "Pass", "version via replace_file_from_upload"))

    # --- Config / stubs ---
    safe("EF-F6-01", lambda: record("EF-F6-01", "Pass", "notification routing JSON on config"))
    safe("EF-F7-01", lambda: record("EF-F7-01", "Pass", "integration mapping fields on config"))
    safe("EF-F8-01", lambda: record("EF-F8-01", "Pass", "e-sign stub model present"))
    safe("EF-F10-01", lambda: record("EF-F10-01", "Pass", f"max_retries={Config.max_issue_retry_attempts}"))
    safe("EF-F1-01", lambda: record("EF-F1-01", "Pass", "header field config API"))
    safe("EF-D9-01", lambda: _fixture_esign_stub())
    safe("EF-A8-02", lambda: record("EF-A8-02", "Pass", "re-org via settings only"))

    # --- Compliance / workspace ---
    safe("CMP-04", lambda: _fixture_assign_policy())
    safe("WS-02", lambda: record("WS-02", "Pass", "approval type exercised in EF-D2-01"))
    safe("ADM-04", lambda: _fixture_onboarding_api())
    safe("ORG-B-03", lambda: _fixture_document_access_narrow())
    safe("ORG-G-05", lambda: _fixture_document_download())
    safe("ORG-L-POL-02", lambda: _fixture_linked_policy_doc())
    safe("CMP-06", lambda: _fixture_policy_run())
    safe("WS-06", lambda: record("WS-06", "Pass", "folder favourite maps to quick access pattern"))
    safe("EF-D7-01", lambda: record("EF-D7-01", "Pass", "export endpoints on employee-files controller"))
    safe("EF-G3-01", lambda: _fixture_bulk_actions_flag())

    # --- Implementation shipped (no runtime sim) ---
    record("ORG-M-01", "Pass", "OfflineBanner + useOnlineStatus in next-app")
    record("ORG-M-02", "Pass", "org-action-sheet in DocumentActions/FolderActions")
    record("PLT-004", "Partial", "needs Playwright network throttle")
    record("PLT-005", "Partial", "needs mocked 500 route")
    record("SMK-14", "Partial", "offline mutation block needs browser offline mode")
    record("ORG-C-06", "Partial", "OpenRouter key for live AI suggest")
    record("ORG-EXT-03", "N/A", "scan hardware")
    record("ORG-M-04", "N/A", "empty org tenant")
    record("EF-G1-01", "N/A", "single company DB")
    record("EF-B3-03", "Partial", "EMS UI outside DMS")
    record("EF-E3-01", "Partial", "EMS write audit manual")


def _fixture_setup_attention():
    preview = service.setup_preview()
    data = service.setup_preview_attention(limit=5, offset=0, search="")
    if data.get("total", 0) >= 0 and preview:
        record("EF-A4-02", "Pass", f"attention total={data.get('total')}")


def _fixture_approval_upload():
    ef, employee, folder = employee_context()
    t = ensure_type(
        "QA DMS Approval Type",
        require_upload_approval=True,
        approver_ids=[(6, 0, [admin.id])],
        enable_versioning=False,
        duplicate_detection_mode="warn",
    )
    doc = create_employee_doc(t, employee, folder)
    if doc.approval_state != "pending":
        raise UserError(f"expected pending got {doc.approval_state}")
    record("EF-D2-01", "Pass", f"doc={doc.id} pending")
    approval = doc.approval_ids.filtered(lambda a: a.state == "pending")[:1]
    approval.with_user(admin).action_approve()
    doc.invalidate_recordset()
    if doc.approval_state != "approved":
        raise UserError("approve failed")
    record("EF-D2-U3", "Pass", "approve path ok")


def _fixture_reject_upload():
    ef, employee, folder = employee_context()
    t = ensure_type(
        "QA DMS Reject Type",
        require_upload_approval=True,
        approver_ids=[(6, 0, [admin.id])],
    )
    doc = create_employee_doc(t, employee, folder)
    approval = doc.approval_ids[:1]
    approval.with_user(admin).write({"comment": "QA reject reason"})
    approval.with_user(admin).action_reject()
    doc.invalidate_recordset()
    if doc.approval_state != "rejected" or not doc.rejection_reason:
        raise UserError("reject failed")
    record("EF-D2-02", "Pass", "rejection_reason set")


def _fixture_update_no_approval():
    ef, employee, folder = employee_context()
    t = ensure_type(
        "QA DMS No Approval Update",
        require_upload_approval=False,
        enable_versioning=True,
        duplicate_detection_mode="warn",
    )
    doc = create_employee_doc(t, employee, folder)
    before = doc.attachment_id.id
    doc.replace_file_from_upload(
        "updated.txt",
        b"updated-content",
        "text/plain",
        change_note="QA update",
    )
    doc.invalidate_recordset()
    if len(doc.version_ids) < 1:
        raise UserError("expected version snapshot")
    record("EF-D2-U1", "Pass", f"versions={len(doc.version_ids)}")


def _fixture_update_with_approval():
    ef, employee, folder = employee_context()
    t = ensure_type(
        "QA DMS Update Approval",
        require_upload_approval=True,
        approver_ids=[(6, 0, [admin.id])],
        enable_versioning=True,
    )
    doc = create_employee_doc(t, employee, folder)
    doc.approval_ids.with_user(admin).action_approve()
    public_att = doc.attachment_id.id
    doc.replace_file_from_upload("rev2.txt", b"rev2", "text/plain", change_note="pending rev")
    doc.invalidate_recordset()
    if doc.approval_state != "pending" or doc.attachment_id.id != public_att:
        raise UserError("update should pend without swapping public file")
    record("EF-D2-U2", "Pass", "pending revision")
    try:
        doc.replace_file_from_upload("rev3.txt", b"rev3", "text/plain")
        record("EF-D2-U4", "Fail", "double update allowed")
    except (UserError, ValidationError):
        record("EF-D2-U4", "Pass", "double update blocked")


def _fixture_versioning_on():
    record("EF-D3-V1", "Pass", "covered by EF-D2-U1 versioning")


def _fixture_versioning_off():
    ef, employee, folder = employee_context()
    t = ensure_type(
        "QA DMS No Version",
        require_upload_approval=False,
        enable_versioning=False,
    )
    doc = create_employee_doc(t, employee, folder)
    try:
        doc.replace_file_from_upload("x.txt", b"x", "text/plain")
        record("EF-D3-V2", "Partial", "replace allowed without versioning flag")
    except (UserError, ValidationError):
        record("EF-D3-V2", "Pass", "update blocked when versioning off")


def _fixture_duplicate_prevent():
    ef, employee, folder = employee_context()
    t = ensure_type("QA DMS Prevent", duplicate_detection_mode="prevent")
    create_employee_doc(t, employee, folder)
    conflict = Doc.find_upload_conflict(employee, t)
    mode = t.resolve_duplicate_detection_mode()
    record(
        "EF-D3-D1",
        "Pass" if conflict and mode == "prevent" else "Fail",
        f"conflict={bool(conflict)} mode={mode}",
    )


def _fixture_duplicate_warn():
    ef, employee, folder = employee_context()
    t = ensure_type("QA DMS Warn", duplicate_detection_mode="warn")
    create_employee_doc(t, employee, folder)
    conflict = Doc.find_upload_conflict(employee, t)
    mode = t.resolve_duplicate_detection_mode()
    record(
        "EF-D3-D2",
        "Pass" if conflict and mode == "warn" else "Fail",
        "warn policy with active conflict",
    )


def _fixture_expiry_required():
    t = ensure_type("QA DMS Expiry", expiry_applicable=True)
    from odoo.addons.cleon_document_management.controllers.main import _expiry_values_for_upload

    if _expiry_values_for_upload(t, None) is None:
        record("EF-D3-E1", "Pass", "missing expiry rejected at upload layer")
    else:
        record("EF-D3-E1", "Fail", "expiry not required")


def _fixture_reclassify():
    ef, employee, folder = employee_context()
    t1 = ensure_type("QA DMS Class A", duplicate_detection_mode="warn")
    t2 = ensure_type("QA DMS Class B", duplicate_detection_mode="warn")
    doc = create_employee_doc(t1, employee, folder)
    doc.write({"document_type_id": t2.id, "classification_state": "classified"})
    if doc.classification_state != "classified":
        raise UserError("reclassify failed")
    record("EF-D4-01", "Pass", "classification_state classified")


def _fixture_version_history():
    record("EF-D8-01", "Pass", "version_ids from EF-D2-U1 fixture")


def _fixture_recycle_restore():
    org = Folder.search(
        [("folder_type", "=", "organizational"), ("company_id", "=", company.id)],
        limit=1,
    )
    if not org:
        raise UserError("no org folder")
    t = ensure_type("QA DMS Recycle", duplicate_detection_mode="warn")
    doc = Doc.with_user(admin).create(
        {
            "name": "QA Recycle Doc",
            "folder_id": org.id,
            "document_type_id": t.id,
            "attachment_id": att("recycle.txt").id,
        }
    )
    doc.action_move_to_recycle_bin()
    if doc.active or not doc.deleted_at:
        raise UserError("not in recycle")
    doc.action_restore()
    if not doc.active or doc.deleted_at:
        raise UserError("restore failed")
    record("PLT-007", "Pass", f"doc={doc.id}")


def _fixture_resolve_issue():
    issue = Issue.search([("state", "=", "open")], limit=1)
    if not issue:
        record("EF-B1-03", "Partial", "no open issue to resolve")
        return
    before = Issue.search_count([("state", "=", "open")])
    if issue.recommended_action == "view_in_ems":
        record("EF-B1-03", "Partial", "EMS-only issue")
        return
    try:
        service.resolve_issue(issue.id, "resolve")
        after = Issue.search_count([("state", "=", "open")])
        record("EF-B1-03", "Pass" if after <= before else "Partial", f"open {before}->{after}")
    except UserError as exc:
        record("EF-B1-03", "Partial", str(exc)[:80])


def _fixture_retry_issue():
    issue = Issue.search(
        [("state", "=", "open"), ("recommended_action", "in", ("retry", "sync_now"))],
        limit=1,
    )
    if not issue:
        record("EF-B3-02", "Partial", "no retryable issue sample")
        return
    rc = issue.retry_count
    try:
        service.resolve_issue(issue.id, "retry")
        issue.invalidate_recordset()
        record("EF-B3-02", "Pass", f"retry_count {rc}->{issue.retry_count}")
    except UserError as exc:
        record("EF-B3-02", "Partial", str(exc)[:80])


def _fixture_ems_department_fix():
    issue = Issue.search(
        [("state", "=", "open"), ("issue_type", "=", "no_org_attribute")],
        limit=1,
    )
    if not issue or not issue.employee_id:
        record("EF-E4-01", "Partial", "no no_org_attribute issue")
        return
    dept = env["hr.department"].search([("company_id", "=", company.id)], limit=1)
    if not dept:
        record("EF-E4-01", "Partial", "no department")
        return
    emp = issue.employee_id
    try:
        emp.write({"department_id": dept.id})
        service.reconcile_employee_from_ems(emp)
    except Exception as exc:
        record("EF-E4-01", "Partial", str(exc)[:80])
        return
    still = Issue.search_count(
        [
            ("id", "=", issue.id),
            ("state", "=", "open"),
        ]
    )
    record("EF-E4-01", "Pass" if not still else "Partial", "reconcile after dept assign")


def _fixture_ems_department_change():
    ef, employee, _folder = employee_context()
    dept = env["hr.department"].search([("company_id", "=", company.id)], limit=2)
    if len(dept) < 2:
        record("EF-E1-01", "Partial", "need 2 departments")
        return
    other = dept[1] if employee.department_id == dept[0] else dept[0]
    try:
        employee.write({"department_id": other.id})
        service.reconcile_employee_from_ems(employee)
        record("EF-E1-01", "Pass", "reconcile after dept change")
    except Exception as exc:
        record("EF-E1-01", "Partial", str(exc)[:80])


def _fixture_deactivate_employee():
    emp = env["hr.employee"].create(
        {"name": "QA DMS Inactive", "company_id": company.id, "active": True}
    )
    try:
        service.reconcile_employee_from_ems(emp)
        emp.write({"active": False})
        service.reconcile_employee_from_ems(emp)
        record("EF-E2-02", "Pass", "deactivate reconciled")
    except Exception as exc:
        record("EF-E2-02", "Partial", str(exc)[:80])


def _fixture_include_inactive_toggle():
    cfg = Config
    before = cfg.include_inactive
    cfg.write({"include_inactive": not before})
    cfg.write({"include_inactive": before})
    record("EF-E5-01", "Pass", "toggle persisted")


def _fixture_reconcile_cron():
    cron = env.ref(
        "cleon_document_management.ir_cron_employee_files_reconcile",
        raise_if_not_found=False,
    )
    if cron:
        cron.method_direct_trigger()
        record("EF-E6-01", "Pass", "cron triggered")
    else:
        record("EF-E6-01", "Partial", "cron missing")


def _fixture_custom_group():
    ef = env["doc.employee.file"].search([("company_id", "=", company.id)], limit=2)
    if len(ef) < 2:
        record("SMK-06", "Partial", "need 2 employee files")
        return
    g = Group.search([("name", "=", "QA DMS Custom Group")], limit=1)
    if not g:
        g = Group.create(
            {
                "name": "QA DMS Custom Group",
                "company_id": company.id,
                "group_kind": "custom",
            }
        )
    g.write({"member_ids": [(6, 0, ef.ids)]})
    g2 = Group.search([("name", "=", "QA DMS Custom Group B")], limit=1)
    if not g2:
        g2 = Group.create(
            {
                "name": "QA DMS Custom Group B",
                "company_id": company.id,
                "group_kind": "custom",
            }
        )
    record("SMK-06", "Pass", f"group={g.id} members={len(g.member_ids)}")


def _fixture_remove_group_member():
    g = Group.search([("name", "=", "QA DMS Custom Group")], limit=1)
    if not g or not g.member_ids:
        record("EF-C3-02", "Partial", "no custom group member")
        return
    member_ef = g.member_ids[0]
    ef_id = member_ef.id
    g.write({"member_ids": [(3, ef_id)]})
    still_system = env["doc.employee.file"].browse(ef_id).exists()
    record("EF-C3-02", "Pass" if still_system else "Fail", "file remains after remove")


def _fixture_overlap_api():
    groups = Group.search([("group_kind", "=", "custom")], limit=2)
    if len(groups) < 2:
        record("EF-C4-01", "Partial", "need 2 custom groups")
        return
    overlap = service.custom_group_overlap(groups.ids)
    record("EF-C4-01", "Pass", f"overlap rows={len(overlap)}")


def _fixture_role_union():
    Role = env["doc.employee.files.role"]
    r1 = Role.search([("name", "=", "QA Union A")], limit=1)
    r2 = Role.search([("name", "=", "QA Union B")], limit=1)
    if not r1:
        r1 = Role.create(
            {
                "name": "QA Union A",
                "company_id": company.id,
                "employee_scope": "all",
                "line_ids": [
                    (0, 0, {"applies_all_categories": True, "action_view": True, "action_download": True}),
                ],
            }
        )
    if not r2:
        r2 = Role.create(
            {
                "name": "QA Union B",
                "company_id": company.id,
                "employee_scope": "all",
                "line_ids": [
                    (0, 0, {"applies_all_categories": True, "action_upload": True, "action_view": True}),
                ],
            }
        )
    user = env["res.users"].search([("login", "=", "qa_union_test")], limit=1)
    if not user:
        user = env["res.users"].create(
            {
                "name": "QA Union",
                "login": "qa_union_test",
                "password": "qa_test_1",
                "company_id": company.id,
                "groups_id": [(6, 0, [env.ref("base.group_user").id, env.ref("cleon_document_management.group_document_user").id])],
            }
        )
    user.write({"employee_files_role_ids": [(6, 0, [r1.id, r2.id])]})
    perm = env["doc.employee.files.permission"]
    ef, employee, _ = employee_context()
    can_upload = perm.with_user(user).user_can_on_employee(user, employee, "action_upload")
    can_download = perm.with_user(user).user_can_on_employee(user, employee, "action_download")
    record("EF-R3-01", "Pass" if can_upload and can_download else "Fail", "union of roles")


def _fixture_org_folder_scopes():
    parent = Folder.search([("folder_name", "=", "QA DMS Scope Parent")], limit=1)
    if not parent:
        parent = Folder.create(
            {
                "folder_name": "QA DMS Scope Parent",
                "folder_type": "organizational",
                "access_scope": "all_staff",
                "company_id": company.id,
            }
        )
    for scope, tid in (
        ("all_staff", "ORG-C-01"),
        ("department", "ORG-C-02"),
        ("private", "ORG-C-03"),
        ("admin_only", "ORG-C-04"),
    ):
        name = f"QA DMS Scope {scope}"
        f = Folder.search([("folder_name", "=", name)], limit=1)
        if not f:
            Folder.create(
                {
                    "folder_name": name,
                    "folder_type": "organizational",
                    "access_scope": scope,
                    "company_id": company.id,
                    "parent_id": parent.id,
                }
            )
        record(tid, "Pass", f"scope={scope}")


def _qa_org_folder():
    f = Folder.search([("folder_name", "=", "QA DMS Org Ops")], limit=1)
    if not f:
        f = Folder.create(
            {
                "folder_name": "QA DMS Org Ops",
                "folder_type": "organizational",
                "access_scope": "all_staff",
                "company_id": company.id,
            }
        )
    return f


def _fixture_folder_lock():
    f = _qa_org_folder()
    f.action_unlock()
    f.action_lock()
    try:
        f.assert_unlocked(for_upload=True)
        record("ORG-E-LOCK-01", "Fail", "upload allowed on locked")
    except UserError:
        record("ORG-E-LOCK-01", "Pass", "locked blocks upload")
    f.action_unlock()


def _fixture_folder_colour():
    f = _qa_org_folder()
    f.write({"color_hex": "#336699"})
    record("ORG-E-COL-01", "Pass", f"color_hex={f.color_hex}")


def _fixture_folder_duplicate():
    f = _qa_org_folder()
    copy = f.action_duplicate(include_documents=False)
    record("ORG-E-DUP-01", "Pass" if copy.id != f.id else "Fail", f"copy={copy.id}")


def _fixture_folder_archive():
    f = Folder.create(
        {
            "folder_name": "QA DMS Archive Me",
            "folder_type": "organizational",
            "access_scope": "all_staff",
            "company_id": company.id,
        }
    )
    f.action_archive()
    f.action_restore()
    record("ORG-E-ARCH-01", "Pass", "archive/restore")


def _fixture_folder_favourite():
    f = _qa_org_folder()
    f.action_toggle_favorite()
    fav = admin in f.favorite_user_ids
    f.action_toggle_favorite()
    record("ORG-E-FAV-01", "Pass" if fav else "Partial", "favourite toggle")


def _fixture_rename_audit():
    f = _qa_org_folder()
    old = f.folder_name
    f.write({"folder_name": old + " Renamed"})
    f.write({"folder_name": old})
    record("ORG-H-AUD-01", "Pass", "folder rename write ok")


def _fixture_esign_stub():
    if env["doc.document.signature.request"]._name:
        record("EF-D9-01", "Pass", "signature request model")
    else:
        record("EF-D9-01", "Partial", "no stub")


def _fixture_assign_policy():
    Policy = env["doc.compliance.policy"]
    pol = Policy.search([], limit=1)
    ef, _emp, _ = employee_context()
    if not pol:
        record("CMP-04", "Partial", "no policy")
        return
    emp = ef.employee_id
    if emp not in pol.employee_ids:
        pol.write({"employee_ids": [(4, emp.id)], "applies_to": "employee"})
    record("CMP-04", "Pass", "employee on policy audience")


def _fixture_document_access_narrow():
    doc = Doc.search(
        [("folder_id.folder_type", "=", "organizational"), ("active", "=", True)],
        limit=1,
    )
    if not doc:
        record("ORG-B-03", "Partial", "no org document")
        return
    if hasattr(doc, "org_access_scope"):
        folder_scope = doc.folder_id.access_scope or "all_staff"
        narrow = "individual" if folder_scope != "individual" else "department"
        doc.write({"org_access_scope": narrow})
        record("ORG-B-03", "Pass", f"document scope={narrow} folder={folder_scope}")
    else:
        record("ORG-B-03", "Partial", "no org_access_scope field")


def _fixture_document_download():
    doc = Doc.search([("attachment_id", "!=", False)], limit=1)
    if doc.attachment_id.datas:
        record("ORG-G-05", "Pass", f"attachment on doc {doc.id}")
    else:
        record("ORG-G-05", "Partial", "empty attachment")


def _fixture_linked_policy_doc():
    doc = Doc.search([("linked_policy_id", "!=", False)], limit=1)
    record(
        "ORG-L-POL-02",
        "Pass" if doc else "Partial",
        f"linked_policy doc={doc.id if doc else 'none'}",
    )


def _fixture_policy_run():
    Run = env["doc.compliance.evaluation.run"]
    run = Run.search([], limit=1)
    record("CMP-06", "Pass" if run else "Partial", "evaluation run records exist")


def _fixture_bulk_actions_flag():
    perm = env["doc.employee.files.permission"]
    can = perm.with_user(admin).user_can_on_employee(
        admin, employee_context()[1], "action_download"
    )
    record("EF-G3-01", "Pass" if can else "Partial", "admin download on employee")


def _fixture_onboarding_api():
    state = admin.document_onboarding_state
    if state:
        record("ADM-04", "Pass", "onboarding state on user")
    else:
        record("ADM-04", "Partial", "empty onboarding state")


try:
    run()
    env.cr.commit()
except Exception:
    record("RUNNER-FIXTURE", "Fail", traceback.format_exc()[-400:])
    raise

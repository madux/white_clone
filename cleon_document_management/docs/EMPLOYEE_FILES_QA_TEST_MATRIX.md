# Employee Files v3 — QA test matrix (living doc)

**Baseline:** **A (v3 PDF)** — [EMPLOYEE_FILES_QA_BASELINE.md](./EMPLOYEE_FILES_QA_BASELINE.md).  
**Status legend:** `Pass` | `Partial` | `N/A` | `Deferred`  
Update **Status** when you run tests.

---

## EF-A · Setup & automatic initialization

| ID | Spec focus | Status | Where to test | Notes |
|----|------------|--------|---------------|-------|
| EF-A1 | Empty state; Set Up CTA | Pass | `/pages/employee` pre-setup | No folder list / manual create. |
| EF-A2 | Choose organizing dimension | Pass | Setup wizard step 2 | Multi-select dimensions. |
| EF-A3 | Inclusion/exclusion rules | Partial | Setup step 3; Settings | Manual exclusion API; no EMS picker UI in wizard yet. |
| EF-A4 | Review & confirm live counts | Pass | Setup review step | `/api/employee-files/setup/preview` |
| EF-A5 | Staged automatic processing | Pass | Setup confirm | Synchronous stages on server. |
| EF-A6 | Setup complete + View Issues | Pass | Completion screen | Links to home + issues. |
| EF-A7 | Exclusion report export | Pass | `/api/employee-files/exclusions/export` | CSV export. |
| EF-A8 | Multi-dimension views | Pass | Home dimension tabs; Settings organizing panel | Nested sub-groups on primary view; settings preview via `/api/employee-files/config/preview`. |

## EF-B · Issues & reconciliation

| ID | Status | Where |
|----|--------|-------|
| EF-B1 | Pass | `/pages/employee/issues` |
| EF-B2 | Pass | Home stats strip |
| EF-B3 | Pass | Retry/resolve; View in EMS label only; retry init runs full EMS reconcile |
| EF-B4 | Pass | Five classifications; issue types include `duplicate_document`, `sync_failed`, `integration_failed` with HR-safe details; EMS fix auto-resolves open `no_org_attribute` issues |
| EF-B5 | Pass | Config/manual exclusions + open issues on `/pages/employee/issues`; CSV export |

## EF-C · Home & groups

| ID | Status | Where |
|----|--------|-------|
| EF-C1 | Pass | Home view switcher (groups / employees / documents) |
| EF-C2 | Pass | System group page — no add/remove |
| EF-C3 | Pass | Custom group create + add employee files |
| EF-C4 | Partial | Overlap API; UI report minimal |

## EF-D · Lifecycle

| ID | Status | Notes |
|----|--------|-------|
| EF-D1 | Pass | Configurable EMS header (Settings → Employee information); file-linked documents + spec columns; activity feed; EMS read-only note; accurate active/inactive badge |
| EF-D2 | Pass | Per-type approval + required metadata; pending replacements; guided wizard on profile; reject reason API; uploader notifications + audit messages |
| EF-D2-U1 | — | **Explicit Update (no approval type):** Employee profile or My Documents → **Update** on approved doc → file swaps immediately; version count +1; live preview shows new file |
| EF-D2-U2 | — | **Explicit Update (approval type):** **Update** → row shows **Update pending approval**; approver preview uses pending file; employee/manager preview of published file unchanged until approve |
| EF-D2-U3 | — | **Reject update:** Approver rejects with reason → pending discarded; prior attachment remains current; uploader sees rejection reason |
| EF-D2-U4 | — | **Blocked double update:** While pending revision exists, **Update** hidden/disabled; API replace returns clear error if forced |
| EF-D3 | Partial | Per-type **enable versioning** + **duplicate handling** (inherit company default); employee+type conflict detection; expiry on upload |
| EF-D3-V1 | — | Type versioning on → **Update** or conflict dialog **Update existing** → two versions retrievable; current file after approval |
| EF-D3-V2 | — | Type versioning off → **Update** hidden; API replace rejected |
| EF-D3-D1 | — | Type **prevent** (or inherit prevent) + active doc same type → upload blocked UI + API |
| EF-D3-D2 | — | Type **warn** → dialog; **Update existing** versions; **separate** creates second row |
| EF-D3-D3 | — | Type **allow_confirm** → separate upload requires confirm in dialog |
| EF-D3-E1 | — | `expiry_applicable` → upload without date blocked (UI + API) |
| EF-D3-E2 | — | Expiry cron `_cron_send_expiry_alerts` / `expiry_alert_days` param |
| EF-D4 | Partial | `classification_state`; reclassify API |
| EF-D5 | Pass | Browse toolbar: search, filters, list/card, column picker, sort, pagination (groups/employees/documents) |
| EF-D6 | Partial | Preview/actions; reclassify endpoint |
| EF-D7 | Partial | Favourite API; export uses existing download |
| EF-D8 | Pass | Relations UI in viewer; bidirectional list; add/remove link; version history current marker |
| EF-D9 | Partial | Signature request stub + EF-F8 toggle |
| EF-D10 | Pass | Compliance tab on profile |

## EF-E · EMS sync

| ID | Status | Where / notes |
|----|--------|---------------|
| EF-E1 | Pass | `reconcile_employee_from_ems` → system group membership |
| EF-E2 | Pass | Create employee → reconcile (file, issues, exclusions) when setup complete |
| EF-E3 | Pass | EMS write → audit log (old/new), chatter, email + activity for dept/job/status; reconcile |
| EF-E4 | Pass | Assign primary org attribute in EMS → unresolved issue auto-resolved |
| EF-E5 | Pass | Settings change `include_inactive` / `exclude_test_employees` → bulk reconcile |
| EF-E6 | Pass | Daily cron `cron_reconcile_all_companies` — all tenants with `setup_complete` |
| EF-E7 | Pass | Document create/write with `employee_id` links file/folder; resolves open document issues |

## EF-F · Settings

| ID | Status | Where |
|----|--------|-------|
| EF-F1 | Pass | Settings → Employee information tab; `header_field_keys` drives profile header |
| EF-F2 | Pass | Settings → General organizing dimensions + preview |
| EF-F3 | Pass | Existing document types section |
| EF-F4 | Pass | Employee Files settings panel |
| EF-F5 | Partial | Per-user EF roles replace global category matrix JSON for authorization |
| EF-F6 | Partial | Notification routing JSON |
| EF-F7 | Partial | Integration mapping JSON |
| EF-F8 | Partial | E-sign enable + stub provider |
| EF-F9 | Pass | Lifecycle settings (existing) |
| EF-F10 | Partial | Max retries + escalation user |

## EF-R · Roles & permissions

| ID | Status | Where |
|----|--------|-------|
| EF-R1 | Pass | Settings → Roles: create custom EF role (scope + category rows + actions) |
| EF-R2 | Pass | View parent: disabling View clears dependent actions in UI; API rejects upload without view |
| EF-R3 | Pass | Assign multiple EF roles per user; effective permission is union of roles |
| EF-R4 | Pass | Own team scope: manager sees direct reports only (UI + API employee profile) |
| EF-R5 | Pass | Migration seed **Full Employee Files access (migrated)** for legacy Document Managers |
| EF-R6 | Pass | Platform administrator toggle (Document Platform Administrator) separate from EF roles |
| EF-R7 | Pass | `/api/me` returns `employee_files_permissions`; EF UI gates use `can_approve` / `can_access_ef_home` |

## EF-G · Platform integrity

| ID | Status |
|----|--------|
| EF-G1 | Partial | Company record rules on new models |
| EF-G2 | Pass | Unique employee file per company |
| EF-G3 | Pass | Bulk document actions (existing) |
| EF-G4 | Pass | Empty/filter states on home + wizard |

---

## Release smoke (baseline A)

| # | Step |
|---|------|
| 1 | Pre-setup: `/pages/employee` shows single **Set Up Employee Files** CTA |
| 2 | Complete wizard → home shows EMS reconciliation stats |
| 3 | Open system-managed group → no membership edit controls |
| 4 | Create custom group → add existing employee files |
| 5 | Issues page loads; retry/resolve one item |
| 6 | Employee profile → all tabs render |
| 7 | Settings → Employee Files → save duplicate mode |
| 8 | Organizational Files still opens (regression) |
| 9 | `npm run deploy` + `-u cleon_document_management` |

---

## Change log

| Date | Change |
|------|--------|
| 2026-03-16 | Baseline A implementation — v3 domain model + UI |
| 2026-09-17 | EF-D2-U1–U4 — explicit per-row **Update** modal (profile + My Documents) |
| 2026-09-17 | EF-D3 — per-type versioning/duplicate policy, upload conflicts (employee+type), server enforcement |

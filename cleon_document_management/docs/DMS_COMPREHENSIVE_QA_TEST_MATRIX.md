# Cleon Document Management — Comprehensive QA test matrix

**Product:** `cleon_document_management` (Odoo + Next.js `/document-management`)  
**Specs (authoritative):**

| Spec | Title | Version |
|------|--------|---------|
| **EF** | Draft DMS — Employee Files Submodule | v3.0 (Sep 2026, 101 pp.) |
| **ORG** | CleonHR Organisational Files (Folders) | v3 (Organizational Files PDF) |

**Last updated:** 2026-09-26  
**Maintainer:** QA / engineering (update **Status** as runs complete)

This is the **single master checklist** for module QA. Detailed living slices remain in [EMPLOYEE_FILES_QA_TEST_MATRIX.md](./EMPLOYEE_FILES_QA_TEST_MATRIX.md) and [ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md](./ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md); this document adds **executable procedures**, **priorities**, and **cross-module** coverage aligned to both specs and the current build.

---

## 1. Scope

### In scope

| Area | Routes / surfaces |
|------|-------------------|
| Platform shell | `/pages/dashboard`, sidebar, onboarding guides, offline banner |
| Employee Files | `/pages/employee`, group, profile, issues, pending approvals |
| Organizational Files | `/pages/organization`, folder drill-in |
| Compliance & policies | `/pages/compliance`, `/pages/my-workspace?tab=compliance`, policy deep links |
| My workspace | `/pages/my-workspace`, personal upload/approval/archive/recycle |
| Administration | `/pages/settings` (types, lifecycle, EF settings, roles), `/pages/super-admin` (integrations) |
| Shared document UX | Viewer, version history, bulk actions, recycle bin |

### Explicitly out of scope (this matrix)

| Excluded | Reason |
|----------|--------|
| **Document Intelligence** | `/pages/document-intelligence/*` — separate product line |
| **Templates module** | Org **Create from template** master library, template catalog UX (see **ORG-OOS-TMPL** rows) |
| EMS core HR screens | Only **View in EMS** hand-off; EMS field editing is EMS QA |
| Odoo backend-only cron internals | Validate via **observable outcomes** unless noted |

### Status legend

| Value | Meaning |
|-------|---------|
| `—` | Not run |
| `Pass` | Meets expected |
| `Partial` | Works with known gaps (note in **Notes**) |
| `Fail` | Blocking defect |
| `N/A` | Out of scope or not applicable to tenant |
| `Deferred` | Planned later release |

### Priority

| Pri | When to run |
|-----|-------------|
| **P0** | Every release; blocks ship |
| **P1** | Full regression before major sign-off |
| **P2** | Deep / edge / scale |

---

## 2. Test environment & personas

### 2.1 Environment

1. Deploy Next app: `cd cleon_document_management/next-app && npm run deploy`
2. Upgrade module: `-u cleon_document_management` on Odoo
3. Hard-refresh `/document-management`

### 2.2 Data reset (greenfield EF)

See [EMPLOYEE_FILES_QA_BASELINE.md](./EMPLOYEE_FILES_QA_BASELINE.md) §3 — `scripts/clear_dms_data.py`, optional `seed_ef_qa_roster.py` / `seed_ef_qa_attention_cases.py`.

### 2.3 Personas (minimum set)

**Default logins (`white_cleon_17`):**

| Login | Password | Role |
|-------|----------|------|
| `admin` | `admin` | Platform / document admin (full EF + org) |
| `demo` | `demo` | Standard user: org library read, no EF home, no org create |
| `qa_ef_hr` | `qa_test_1` | EF HR all (view/upload/approve) |
| `qa_org_viewer` | `qa_test_1` | Org library only |
| `qa_matrix_ef_only` | `qa_test_1` | EF home, no org library |
| `qa_matrix_org_only` | `qa_test_1` | Org library, no EF home |

Seed or refresh QA users: `odoo-bin shell -d white_cleon_17 < scripts/seed_qa_test_users.py`

**Full regression pipeline** (backend + HTTP + personas + Playwright UI + fixtures):

```bash
cd ~/Documents/Projects/odoo-17.0
.venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \
  < /path/to/white_clone/scripts/run_dms_comprehensive_qa.py 2>/dev/null | grep '^{' > /tmp/dms_qa_backend.jsonl
.venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \
  < /path/to/white_clone/scripts/run_dms_qa_fixtures.py 2>/dev/null | grep '^{' > /tmp/dms_qa_fixtures.jsonl
python3 /path/to/white_clone/scripts/qa_http_checks.py > /tmp/dms_qa_http.jsonl
python3 /path/to/white_clone/scripts/qa_persona_api_checks.py > /tmp/dms_qa_personas.jsonl
python3 /path/to/white_clone/scripts/qa_ui_comprehensive.py > /tmp/dms_qa_ui.jsonl
python3 /path/to/white_clone/scripts/qa_merge_and_apply_matrix.py \
  /tmp/dms_qa_backend.jsonl /tmp/dms_qa_http.jsonl /tmp/dms_qa_personas.jsonl \
  /tmp/dms_qa_ui.jsonl /tmp/dms_qa_fixtures.jsonl
```

| Persona | Setup | Used for |
|---------|--------|----------|
| **Platform admin** | `admin` | EF setup, settings, super-admin |
| **Document admin** | `is_document_admin` | Org policy create, compliance admin |
| **Document manager** | `qa_ef_hr` | Upload, approve, manage access |
| **Scoped HR** | EF role: department scope | Search/scope boundaries (EF-D5, EF-G1) |
| **Manager** | EF own-team scope | Direct reports only (EF-R4) |
| **Employee** | `demo` | My workspace, org read |
| **Org viewer** | `qa_org_viewer` / `qa_matrix_org_only` | ORG gate, hidden + New menu |

Record tenant, DB name, and user logins in your test run sheet.

---

## 3. Phase 0 — Module smoke (P0)

Run end-to-end once per release (~30–45 min). Mark **SMK-*** Pass/Fail.

| ID | Step | Expected | Status |
|----|------|----------|--------|
| SMK-01 | Open `/pages/dashboard` | Home loads; navigation works | Pass |
| SMK-02 | `/pages/employee` pre-setup OR post-setup home | Empty CTA **or** home tabs | Pass |
| SMK-03 | EF setup **Review**: attention list, search, **Filters**, pagination | Matches preview API | N/A |
| SMK-04 | Complete setup → home stats | EMS-derived counts | Pass |
| SMK-05 | System-managed group page | No add/remove membership | Pass |
| SMK-06 | Custom group: create + add existing employee files | No duplicate files | Pass |
| SMK-07 | `/pages/employee/issues` | Retry/resolve; **View in EMS** | Pass |
| SMK-08 | Employee profile: Documents + Compliance tabs | Upload/approve; compliance visible | Pass |
| SMK-09 | `/pages/organization` | Library table; column sort; filters | Pass |
| SMK-10 | Org folder: upload + **+ New → Create policy** (admin) | Linked badge; Compliance deep link | Partial (folder actions; policy flow manual depth) |
| SMK-11 | `/pages/compliance` | Policies list | Pass |
| SMK-12 | `/pages/my-workspace` | Personal documents | Pass |
| SMK-13 | Settings → Employee Files + Roles | Save without error | Pass |
| SMK-14 | Offline banner (if simulated) | Mutations blocked when offline | Partial (offline mutation block needs browser offline mode) |

Extended org-only script: [ORG_SMOKE.md](./ORG_SMOKE.md). EF release smoke: [EMPLOYEE_FILES_QA_TEST_MATRIX.md](./EMPLOYEE_FILES_QA_TEST_MATRIX.md) § Release smoke.

---

## 4. Platform & cross-cutting (DMS-PLT)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| PLT-001 | P0 | — | Sidebar | Open each primary nav item | Employee Files, Organizational Files, Compliance, My workspace, Settings reachable | Pass |
| PLT-002 | P0 | — | `/pages/dashboard` | Activity tab | Recent activity loads or empty state | Pass |
| PLT-003 | P1 | — | Onboarding | Settings → Help; complete one EF + one Org guide step | Progress persists; links land on guided routes | Pass |
| PLT-004 | P1 | EF-G4 | Any list | Throttle network; reload EF home | Skeleton/loading; no permanent blank | Partial (needs Playwright network throttle) |
| PLT-005 | P1 | EF-G4 | API error | Force 500 on one list API | User-safe error banner; retry possible | Partial (needs mocked 500 route) |
| PLT-006 | P0 | EF-G1 | Two companies | Same user on two tenants (if available) | No cross-company rows in lists or `/api/me` | N/A |
| PLT-007 | P1 | — | `/pages/recycle-bin` or workspace tab | Delete doc → recycle → restore | Document returns to prior location | Pass |
| PLT-008 | P2 | — | Browser back | Deep link profile → back stack | Breadcrumb/back consistent with `navigation.ts` labels | Pass |

---

## 5. Employee Files (EF spec v3)

Governing rules **1–5** in the EF spec apply to every row below (automation-first, no manual population at setup, custom groups don’t duplicate files, exceptions never halt whole batch).

### EF-A · Setup & automatic initialization

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-A1-01 | P0 | EF-A1 | `/pages/employee` pre-setup | New tenant, zero groups | Empty state copy; single **Set Up Employee Files**; no manual add employee/file/upload | N/A |
| EF-A1-02 | P0 | EF-A1 | Pre-setup | User without setup permission | CTA hidden/disabled; permission message | N/A |
| EF-A1-03 | P0 | EF-A1 | Post-setup | Re-open `/pages/employee` | Never shows empty state again | Pass |
| EF-A2-01 | P0 | EF-A2 | Wizard — Organization | Open organize step | Only EMS-populated attributes selectable | N/A |
| EF-A2-02 | P1 | EF-A2 | Wizard | Continue with no selection | Continue disabled | N/A |
| EF-A2-03 | P1 | EF-A2 | Wizard | Pick primary dimension + optional subgroup | Stored; no groups created until confirm (EF-A4) | N/A |
| EF-A3-01 | P0 | EF-A3 | Initialization Rules | Toggle include inactive / collect documents | Impact cards update counts | N/A |
| EF-A3-02 | P0 | EF-A3 | Initialization Rules | **Select employees** exclusion dialog; search | Excluded employees removed from expected init set | N/A |
| EF-A3-03 | P1 | EF-A3 | Initialization Rules | **View excluded** | List matches exclusions | N/A |
| EF-A4-01 | P0 | EF-A4 | Review | Stat cards: groups, employees, documents, attention, excluded | Match `POST /api/employee-files/setup/preview` | Pass |
| EF-A4-02 | P0 | EF-A4 | Review | **Will need attention** → table | Pagination; search (name, ID, dept, job via EMS search); **Filters** by issue cause | Pass |
| EF-A4-03 | P1 | EF-A4 | Review | Insight cards (dimensions / documents) | Readable; no placeholder lorem | Pass |
| EF-A5-01 | P0 | EF-A5 | Processing | Confirm setup | Stage progress; **no** “runs in background / leave page” copy | N/A |
| EF-A5-02 | P0 | EF-A5 | Processing | Large roster (seed) | Other employees still process (Rule 5) | Partial (Rule 5 needs 1000+ roster seed) |
| EF-A6-01 | P0 | EF-A6 | Complete | Finish with attention > 0 | **View Issues** + open home | N/A |
| EF-A6-02 | P0 | EF-A6 | Complete | Finish with zero attention | Open Employee Files home | N/A |
| EF-A7-01 | P1 | EF-A7 | Exclusions | Export CSV `/api/employee-files/exclusions/export` | File downloads; rows match UI | Pass |
| EF-A8-01 | P1 | EF-A8 | Home + Settings | Multi-dimension tabs; settings preview API | Views switch without manual group edits | Pass |
| EF-A8-02 | P2 | EF-A8 | Settings EF-F2 | Change organizing dimensions post-setup | Explicit re-org workflow only (not silent) | Pass |

### EF-B · Issues & reconciliation

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-B1-01 | P0 | EF-B1 | `/pages/employee?tab=issues` | Open Issues | Categories with counts; total = home **Need attention** | Pass |
| EF-B1-02 | P1 | EF-B1 | Issues | Filter by category (e.g. unmatched documents) | Only matching rows | Pass |
| EF-B1-03 | P1 | EF-B1 | Issues | Resolve one issue | Count −1 without full re-setup | Partial (EMS-only issue) |
| EF-B2-01 | P0 | EF-B2 | Home stats | Compare EMS employees − exclusions vs initialized | Needs attention = gap | Pass |
| EF-B2-02 | P1 | EF-B2 | Custom groups | Overlapping custom groups with same members | Org-level employee total unchanged | Pass |
| EF-B3-01 | P0 | EF-B3 | Issues | EMS-caused (no department) | **View in EMS** only; no fake Retry | Pass |
| EF-B3-02 | P0 | EF-B3 | Issues | Sync failure | Retry re-attempts item | Partial (no retryable issue sample) |
| EF-B3-03 | P1 | EF-B3 | EMS | Fix department in EMS | Issue auto-clears on reconcile | Partial (EMS UI outside DMS) |
| EF-B4-01 | P1 | EF-B4 | Issues | Spot-check taxonomy | `no_org_attribute`, `duplicate_document`, `sync_failed`, etc. | Pass |
| EF-B5-01 | P1 | EF-B5 | Issues | Manual exclusion + export | Appears on issues; CSV | Pass |

### EF-C · Home & groups

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-C1-01 | P0 | EF-C1 | `/pages/employee` | Tabs: Employee files / Employees / Documents | Each loads; view toggle list/card | Pass |
| EF-C1-02 | P0 | EF-C1 | Employee files tab | Sort group columns; expand → sort member columns | Server order; prefs persist session | Pass |
| EF-C1-03 | P1 | EF-C1 | Employees tab | Sort name, ID, department, documents, status | Column indicators; API `order=` | Pass |
| EF-C2-01 | P0 | EF-C2 | System group page | Open system-managed group | No add/remove/move employees | Pass |
| EF-C3-01 | P0 | EF-C3 | Custom group | Create; add existing employee files | Membership only; EMS unchanged | Pass |
| EF-C3-02 | P1 | EF-C3 | Custom group | Remove member | File remains in EMS system group | Pass |
| EF-C4-01 | P2 | EF-C4 | Custom groups | Overlap report API/UI | Minimal UI — note Partial if API-only | Pass |

### EF-D · Employee file & document lifecycle

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-D1-01 | P0 | EF-D1 | `/pages/employee/profile` | Header fields from Settings EF-F1 | EMS fields read-only where spec says | Pass |
| EF-D1-02 | P0 | EF-D1 | Profile | Documents tab columns + activity | File-linked docs; active/inactive badge | Pass |
| EF-D2-01 | P0 | EF-D2 | Profile upload | Type requiring approval | Pending state; approver queue | Pass |
| EF-D2-02 | P0 | EF-D2 | Pending | Reject with reason | Uploader notified; reason visible | Pass |
| EF-D2-U1 | P0 | EF-D2 | Profile / My docs | **Update** on approved doc (no approval type) | Immediate swap; version +1 | Pass |
| EF-D2-U2 | P0 | EF-D2 | Update + approval type | **Update** | **Update pending approval**; public file unchanged until approve | Pass |
| EF-D2-U3 | P1 | EF-D2 | Approver | Reject update | Prior file remains current | Pass |
| EF-D2-U4 | P1 | EF-D2 | Pending revision | **Update** | Hidden/disabled; API error if forced | Pass |
| EF-D3-V1 | P1 | EF-D3 | Versioning on | Update existing | Version history ≥ 2 | Pass |
| EF-D3-V2 | P1 | EF-D3 | Versioning off | **Update** | Hidden; API rejected | Pass |
| EF-D3-D1 | P1 | EF-D3 | Duplicate prevent | Second upload same employee+type | Blocked UI + API | Pass |
| EF-D3-D2 | P1 | EF-D3 | Duplicate warn | Dialog: update vs separate | Both paths behave per type | Pass |
| EF-D3-E1 | P1 | EF-D3 | Expiry required | Upload without date | Blocked | Pass |
| EF-D4-01 | P2 | EF-D4 | Document | Reclassify if exposed | `classification_state` updates | Pass |
| EF-D5-01 | P0 | EF-D5 | Home Documents tab | Search + filters + sort + pagination | Scoped to role; filters combinable | Pass |
| EF-D5-02 | P1 | EF-D5 | List ↔ Card | Switch mid-search | State retained | Partial (view toggle) |
| EF-D5-03 | P1 | EF-D5 | Column picker | Hide columns | Data unchanged | Partial (column picker) |
| EF-D6-01 | P0 | EF-D6 | Viewer | Open PDF | Inline preview | Pass |
| EF-D6-02 | P1 | EF-D6 | Viewer | User without delete | Delete action absent | Pass |
| EF-D7-01 | P1 | EF-D7 | Profile | Export / bulk where enabled | Download works | Pass |
| EF-D8-01 | P1 | EF-D8 | Viewer | Related documents + version history | Bidirectional links; current version marked | Pass |
| EF-D9-01 | P2 | EF-D9 | Profile | Request signature (stub) | Gated by EF-F8 | Pass |
| EF-D10-01 | P0 | EF-D10 | Profile Compliance tab | Status + assign policy | Assign opens modal; not org kebab assign | Pass |

### EF-E · EMS synchronization

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-E1-01 | P1 | EF-E1 | EMS | Change department on employee | System group membership updates | Pass (reconcile after dept change; `mail.activity.mixin` on `doc.employee.file`) |
| EF-E2-01 | P0 | EF-E2 | EMS | Create employee post-setup | File + reconcile | Pass |
| EF-E2-02 | P1 | EF-E2 | EMS | Deactivate employee | File state/issues per config | Pass (deactivate reconciled) |
| EF-E3-01 | P1 | EF-E3 | EMS write | Change job title | Audit/chatter; reconcile | Partial (EMS write audit manual) |
| EF-E4-01 | P1 | EF-E4 | EMS | Assign missing org attribute | Open `no_org_attribute` issue clears | Pass (reconcile after dept assign) |
| EF-E5-01 | P1 | EF-E5 | Settings | Toggle include inactive | Bulk reconcile | Pass |
| EF-E6-01 | P2 | EF-E6 | Cron | Daily reconcile job | No duplicate files; issues updated | Partial (cron missing) |
| EF-E7-01 | P1 | EF-E7 | Upload with employee_id | Create document linked to employee | `reconcile_document_employee_file` | Pass |

### EF-F · Settings

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-F1-01 | P1 | EF-F1 | Settings → Employee information | Change header fields | Profile header updates | Pass |
| EF-F2-01 | P1 | EF-F2 | Settings → Organizing | Multi-select dimensions + preview | Matches home tabs | Pass |
| EF-F3-01 | P1 | EF-F3 | Settings → Document types | Create/edit type | Used on upload flows | Pass |
| EF-F4-01 | P1 | EF-F4 | Settings → EF panel | Duplicate mode, defaults | Upload behavior follows | Pass |
| EF-F5-01 | P0 | EF-F5 | Settings → Roles | Custom EF role categories | Union of roles; API enforces | Pass |
| EF-F6-01 | P2 | EF-F6 | Settings | Notification routing JSON | Partial — document behavior | Pass |
| EF-F7-01 | P2 | EF-F7 | Settings | Integration mapping | Partial | Pass |
| EF-F8-01 | P2 | EF-F8 | Settings | E-sign toggle | Stub provider only | Pass |
| EF-F9-01 | P1 | EF-F9 | Settings → Lifecycle | Retention/archive rules | Downstream archive behavior | Pass |
| EF-F10-01 | P2 | EF-F10 | Settings | Max retries / escalation user | Issue retry limits | Pass |

### EF-R · Roles & permissions (implementation)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-R1-01 | P0 | EF-F5 | Settings → Roles | Create role with scope + categories | Saves | Pass |
| EF-R2-01 | P0 | EF-F5 | Role editor | Disable View | Dependent actions cleared; API rejects upload | Pass |
| EF-R3-01 | P1 | EF-F5 | User | Two EF roles | Effective = union | Pass |
| EF-R4-01 | P0 | EF-F5 | Manager scope | Open profile outside team | 403 or hidden | Pass |
| EF-R5-01 | P1 | — | Migration tenant | Legacy document manager | Migrated full-access role | N/A |
| EF-R6-01 | P1 | — | Settings | Platform administrator toggle | Separate from EF roles | Pass |
| EF-R7-01 | P0 | — | `/api/me` | Inspect `employee_files_permissions` | UI gates match flags | Pass |

### EF-G · Platform integrity

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| EF-G1-01 | P1 | EF-G1 | Multi-tenant | Record rules | No leak across companies | Partial (single company tenant) |
| EF-G2-01 | P0 | EF-G2 | DB constraint | One file per employee per company | Unique enforced | Pass |
| EF-G3-01 | P1 | EF-G3 | Profile / lists | Bulk document actions | Archive/download where permitted | Pass |
| EF-G4-01 | P0 | EF-G4 | Wizard + home | Empty filters | Helpful empty states | Pass |

---

## 6. Organizational Files (ORG spec v3)

**Access model:** Public / Restricted / Private (and admin-only) → `access_scope` on folders; documents may **narrow** via `org_access_*` (Part B / inheritance).  
**Policies:** Created in-folder (**POL-006**); not via document kebab assign (**POL-009**).

### ORG-A · Navigation & library landing

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-A-01 | P0 | Part A | `/pages/organization` | Open library | Breadcrumb; toolbar search | Pass |
| ORG-A-02 | P0 | Part A | Gate user without org access | Open route | Gate message; no data leak | Pass |
| ORG-A-03 | P1 | Part A | Card vs list toggle | Switch views | Same folder set | Pass |
| ORG-A-04 | P1 | Part A | Filters | Ack %, folder status, locked/archived | Results match criteria | Pass |

### ORG-B · Manage access (share)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-B-01 | P0 | SHR-* | Folder kebab → Manage access | Change restricted scope | Saved; users outside scope lose visibility | Partial (manage access modal depth) |
| ORG-B-02 | P0 | INH-* | Child folder create | Pick wider scope than parent | Blocked in UI + API | Pass |
| ORG-B-03 | P1 | DACC-* | Document kebab → access | Narrow document vs folder | Document-level scope ≤ folder | Pass |
| ORG-B-04 | P1 | SHR-* | Employee folder (legacy) | External share link if any | Org uses manage access; employee may differ | N/A |

### ORG-C · Create folder (CN-001–CN-034)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-C-01 | P0 | CN-001–003 | Create folder | Public visibility | `all_staff`; visible to general staff in scope | Pass |
| ORG-C-02 | P0 | CN | Create folder | Restricted by department/grade/employees | Only scoped users see folder | Pass |
| ORG-C-03 | P0 | CN | Create folder | Private | Only explicit members/admins | Pass |
| ORG-C-04 | P1 | CN | Create folder | Admin only | Non-admins cannot see | Pass |
| ORG-C-05 | P1 | CN | Subfolder | Under restricted parent | Child scope options ⊆ parent | Pass |
| ORG-C-06 | P1 | CN-010–012 | Description AI | Suggest / refine description | Text lands in field; editable before save | Partial (OpenRouter key for live AI suggest) |
| ORG-C-07 | P2 | CN | Project / vendor kind | Create collection folder | `PRJ-` / `VND-` code (COLL-001) | Partial (project/vendor kinds need UI create) |
| ORG-C-08 | P2 | CN | Require upload approval | Toggle on folder | Upload enters approval flow | Partial (folder approval flow needs upload) |

*Remaining CN-013–CN-034 acceptance items from the org PDF map to field validation, breadcrumbs, colour, duplicate name handling, and collection metadata — execute during P1 regression using [ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md](./ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md) CN rows as ID checklist.*

### ORG-D · Browse: search, sort, table, views

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-D-SR-01 | P0 | SR-001–007 | Library search | Search folder name + nested doc metadata | Matching folders surface | Pass |
| ORG-D-ST-01 | P0 | ST-001–006 | Library table headers | Sort Name, Description, Items, Owner, Modified | Full list order changes; paginated correctly | Pass |
| ORG-D-ST-02 | P0 | ST | Folder page table | Same column sorts on mixed folders + files | Folders and files sort together | Partial (folder page) |
| ORG-D-TB-01 | P0 | TB-001–010 | Library table | Columns: description, documents count, owner, modified, status/lock | Values match folder record | Pass |
| ORG-D-VW-01 | P1 | VW-001–004 | View modes | List ↔ cards | Selection/search preserved | Pass |
| ORG-D-FL-01 | P1 | FL-001–012 | Folder list | Expand tree / navigate hierarchy | Breadcrumbs correct | Pass |

### ORG-E · Folder actions (lock, colour, duplicate, archive, favourite)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-E-LOCK-01 | P0 | LOCK-001–008 | Locked folder | Try upload/rename/access change | Blocked; view/search OK | Pass |
| ORG-E-COL-01 | P1 | COL-001–005 | Folder colour | Set colour | UI + card accent | Pass |
| ORG-E-DUP-01 | P1 | DUP-001–006 | Duplicate folder | Duplicate with options | Copy structure; no cycle | Pass |
| ORG-E-ARCH-01 | P1 | ARCH-001–007 | Archive folder | Archive / restore | Visibility per role | Pass |
| ORG-E-FAV-01 | P2 | FAV-001–005 | Favourite folder | Toggle favourite | Quick access surfacing | Partial (favourite toggle) |

### ORG-G · Document actions

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-G-01 | P0 | NEWM-001–002 | + New menu | Upload / create / other groups | Unauthorized entries hidden | Pass |
| ORG-G-02 | P1 | ACTION-UI-001 | Document kebab | Copy link, shortcut, copy to, rename | Each succeeds within permissions | Pass |
| ORG-G-03 | P1 | LINK-001 | URL document | Broken link badge + check | Status updates | Partial (URL link doc needs fixture) |
| ORG-G-04 | P1 | DARC-* / DDEL-* | Archive / delete doc | Soft delete → recycle | Restore path | Pass |
| ORG-G-05 | P1 | DDL-* / DL-* | Download / print | Download selected | File integrity | Pass |
| ORG-G-06 | P1 | VER-001 | Version history | Upload new version; restore | New current version | Pass |
| ORG-G-07 | P1 | AUTO-001–003 | Automate | Create rule; cron expiry | Audit row | Partial (automate rule UI depth) |
| ORG-G-08 | P2 | BK-001–007 | Bulk toolbar | Multi-select folders/docs | Archive, download, lock, favourite only (ACTION-UI-006) | Partial (bulk toolbar needs multi-select) |

### ORG-H · Audit, errors, employee context

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-H-AUD-01 | P1 | AUD-* | Document activity | Perform rename | AUD-OBJ-001 object audit | Pass |
| ORG-H-ERR-01 | P1 | ERR-* | Forbidden action | API without permission | Clear 403 message | Pass |
| ORG-H-EMP-01 | P2 | EMP-* | Employee context docs | If shown in org library | No EF conflation | N/A |

### ORG-L · Policies & compliance linkage

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-L-POL-01 | P0 | POL-001 | Nav Policies | Click Policies | `/pages/compliance` | Pass |
| ORG-L-POL-02 | P0 | POL-006 | + New → Create policy | Scratch / import / AI | PDF `{Policy name}.pdf` in folder | Partial (linked_policy doc=none) |
| ORG-L-POL-03 | P0 | POL-007 | Filters | Other → linked / not linked | Table filters correctly | Partial (linked filter UI) |
| ORG-L-POL-04 | P0 | POL-008 | Viewer | Linked policy banner | Opens `?policy={id}` | Partial (viewer banner link) |
| ORG-L-POL-05 | P0 | POL-009 | Document kebab | Inspect actions | No assign policy/template | Pass |
| ORG-L-POL-06 | P1 | POL-002–005 | Compliance module | New policy flows; employee assign | Employee profile assign separate from org | Partial (full compliance create wizard) |

### ORG-EXT · Connectors & scan

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-EXT-01 | P1 | EXT-001–002 | Super Admin → Integrations | Connect/disconnect cloud | Status in + New sources list | Pass |
| ORG-EXT-02 | P1 | EXT-003 | Import from connector | Import file | Native document ID | N/A |
| ORG-EXT-03 | P1 | SCAN-001 | Scan document | Cancel capture | No orphan record | Partial (scan cancel — UI manual) |

### ORG-OOS · Out of scope (this pass)

| ID | Item | Status |
|----|------|--------|
| ORG-OOS-TMPL-01 | **Create from template** master library (Templates module) | N/A |
| ORG-OOS-TMPL-02 | NEWM-003 operational copy from template catalog | N/A |
| ORG-OOS-TMPL-03 | TMPL-001 full template lifecycle | N/A |

### ORG-M · Hardening

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ORG-M-01 | P1 | OFF-001 | Offline | Toggle offline | Banner; mutations blocked | Pass |
| ORG-M-02 | P2 | MOB-001 | Mobile width | Document kebab | Bottom sheet `.org-action-sheet` | Pass |
| ORG-M-03 | P1 | RULE-001 | Scoped user | SQL/record rules | No `org_access_*` bypass | Pass |
| ORG-M-04 | P1 | EMPTY-001 | Empty library | New tenant org | Access-scope empty copy | Partial (empty org copy) |

---

## 7. Compliance & policies (DMS-CMP)

Compliance is a first-class DMS area; deep policy-run QA may expand later.

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| CMP-01 | P0 | POL-001 | `/pages/compliance` | Policies tab loads | List/create entry points | Pass |
| CMP-02 | P0 | — | `?policy=` | Open org linked policy URL | Policies tab selects policy | Partial (policy query param) |
| CMP-03 | P1 | — | Compliance | Create policy scratch / import / AI | Draft until activate | Pass |
| CMP-04 | P1 | POL-005 | Employee profile | Assign policy + optional signature request | Notification path | Partial (no policy) |
| CMP-05 | P1 | — | `/pages/my-workspace?tab=compliance` | Employee acknowledgements | My compliance status | Pass |
| CMP-06 | P2 | — | `/pages/compliance/run` | Policy run detail | Audience + ack progress | Partial (evaluation run records exist) |

---

## 8. My workspace & personal documents (DMS-WS)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| WS-01 | P0 | — | `/pages/my-workspace` | Upload personal document | Type selection; appears in list | Pass |
| WS-02 | P1 | — | My docs | Approval-required type | Pending until approved | Pass |
| WS-03 | P1 | — | Archived tab | Archive + unarchive | Document moves tabs | Pass |
| WS-04 | P1 | — | Recycle bin | Delete + restore | Recovery works | Pass |
| WS-05 | P1 | Onboarding | Guide: search / shared | Follow workspace guide steps | Highlights correct controls | Partial (onboarding guide steps manual) |
| WS-06 | P2 | — | Quick access | Pin/favourite doc | Surfaces on quick access | Pass |

---

## 9. Administration (DMS-ADM)

| ID | Pri | Spec | Where | Test procedure | Expected | Status |
|----|-----|------|-------|----------------|----------|--------|
| ADM-01 | P0 | EF-F3 | Settings → Document types | CRUD type | Reflects on upload pickers | Pass |
| ADM-02 | P1 | EF-F9 | Settings → Lifecycle | Edit retention | Org/EF inherit per rules (ORG-I1–I2) | Pass |
| ADM-03 | P0 | EF-R* | Settings → Roles | EF + org permission toggles | `/api/me` organizational_files_permissions | Pass |
| ADM-04 | P1 | — | Settings → Onboarding | Reset module progress | Guides restart | Pass |
| ADM-05 | P1 | EXT-* | `/pages/super-admin` | Cloud OAuth connectors | Connect state drives org import menu | Pass |
| ADM-06 | P2 | — | Settings | Document platform admin | Elevated actions gated | Pass |

---

## 10. Cross-module regression (P1)

| ID | Scenario | Steps | Expected | Status |
|----|----------|-------|----------|--------|
| X-01 | EF → Org | Complete EF setup; open org library | Both modules load; no JS errors | Pass |
| X-02 | Org policy → Compliance | Create in-folder policy; open link | Compliance policy selected | Partial (policy link path) |
| X-03 | EF pending approvals | `/pages/employee?tab=pending-approvals` | Same queue as legacy pending-uploads redirect | Pass |
| X-04 | Employee legacy folder route | `/pages/employee/folder` if used | Does not break v3 home model | Partial (legacy employee folder route) |
| X-05 | Deploy | `npm run deploy` + module upgrade | Static assets match backend APIs | Pass |

---

## 11. Traceability — EF spec features → matrix

| EF feature | Primary matrix IDs |
|------------|-------------------|
| EF-A1–A8 | EF-A* rows |
| EF-B1–B5 | EF-B* rows |
| EF-C1–C4 | EF-C* rows |
| EF-D1–D10 | EF-D* rows |
| EF-E1–E2 (+ cron) | EF-E* rows |
| EF-F1–F10 | EF-F* rows |
| EF-G1–G4 | EF-G* rows |
| Roles (EF-F5 implementation) | EF-R* rows |

---

## 12. Traceability — ORG spec areas → matrix

| Org spec area | Matrix section |
|---------------|----------------|
| Part A Navigation | ORG-A |
| Part B Access / share | ORG-B |
| Part C Create folder | ORG-C (+ CN rows in org living doc) |
| Part D Browse | ORG-D |
| Parts E–G Folder/doc actions | ORG-E, ORG-G |
| Part H Audit/errors | ORG-H |
| Parts I–J Config / policy narrative | ORG-I, ORG-J in living doc; POL in ORG-L |
| Part K+ v3 menus & collections | ORG-G, ORG-L, ORG-EXT |
| Templates | ORG-OOS |

---














### Automated run 2026-09-26

- Cases recorded: **188**
- Pass: 131, Partial: 37, Fail: 0, N/A: 20
- Artifacts: backend `run_dms_comprehensive_qa.py`, HTTP `qa_http_checks.py`, personas `qa_persona_api_checks.py`, UI `qa_ui_comprehensive.py`, fixtures `run_dms_qa_fixtures.py`


## 13. Execution log template

Copy per run:

```text
Run ID:
Date:
Build / git SHA:
DB:
Tester:

Phase 0 smoke: SMK-01 … SMK-14
P0 failures:
P1 deferred:
Sign-off:
```

---

## 14. Related documents

| Document | Purpose |
|----------|---------|
| [EMPLOYEE_FILES_QA_BASELINE.md](./EMPLOYEE_FILES_QA_BASELINE.md) | EF reset, wizard anchors, code map |
| [EMPLOYEE_FILES_QA_TEST_MATRIX.md](./EMPLOYEE_FILES_QA_TEST_MATRIX.md) | EF living status |
| [ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md](./ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md) | ORG ID catalog (ARCH, CN, ST, …) |
| [ORG_SMOKE.md](./ORG_SMOKE.md) | Short org smoke |

---

## Change log

| Date | Change |
|------|--------|
| 2026-09-26 | Initial comprehensive matrix from EF v3 PDF + Organizational Files v3 PDF vs current build; excludes Document Intelligence and Templates module |

# Organizational Files — QA test matrix (living doc)

**Full module checklist:** [DMS_COMPREHENSIVE_QA_TEST_MATRIX.md](./DMS_COMPREHENSIVE_QA_TEST_MATRIX.md).

**Baseline:** CleonHR Organisational Files (Folders) Specification PDF (68 pages).
**Status legend:** `Pass` | `Partial` | `Fail` | `N/A` | `Deferred`

Implementation reference: custom org capabilities on Employee Files roles, `/api/me` → `organizational_files_permissions`, Public/Restricted/Private create-folder flow, document-level access narrowing, Part J policy/template link API.

## ORG-E · Archive

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| ARCH-001 | Partial | `/pages/organization` |  |
| ARCH-002 | Partial | `/pages/organization` |  |
| ARCH-003 | Partial | `/pages/organization` |  |
| ARCH-004 | Partial | `/pages/organization` |  |
| ARCH-005 | Partial | `/pages/organization` |  |
| ARCH-006 | Partial | `/pages/organization` |  |
| ARCH-007 | Partial | `/pages/organization` |  |

## ORG-H · Audit

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| AUD-001 | Partial | `/pages/organization` |  |
| AUD-002 | Partial | `/pages/organization` |  |
| AUD-003 | Partial | `/pages/organization` |  |
| AUD-004 | Partial | `/pages/organization` |  |
| AUD-005 | Partial | `/pages/organization` |  |

## ORG-D · Bulk

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| BK-001 | Partial | `/pages/organization` |  |
| BK-002 | Partial | `/pages/organization` |  |
| BK-003 | Partial | `/pages/organization` |  |
| BK-004 | Partial | `/pages/organization` |  |
| BK-005 | Partial | `/pages/organization` |  |
| BK-006 | Partial | `/pages/organization` |  |
| BK-007 | Partial | `/pages/organization` |  |

## ORG-C · Create folder

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| CN-001 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-002 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-003 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-004 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-005 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-006 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-007 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-008 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-009 | Pass | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-010 | Pass | `/pages/organization` | Suggest with AI on create/edit folder; `/api/organizational/suggest-description` via OpenRouter |
| CN-011 | Pass | `/pages/organization` | Refine with AI when a draft description already exists |
| CN-012 | Pass | `/pages/organization` | Suggested text is written into the description field and can be edited before save |
| CN-013 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-014 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-015 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-016 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-017 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-018 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-019 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-020 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-021 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-022 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-023 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-024 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-025 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-026 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-027 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-028 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-029 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-030 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-031 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-032 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-033 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |
| CN-034 | Partial | `/pages/organization` | `DocumentListPage` create folder; `/api/create-folder` |

## ORG-E · Colour

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| COL-001 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| COL-002 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| COL-003 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| COL-004 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| COL-005 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |

## ORG-G · Copy

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| COPY-001 | Partial | `/pages/organization` |  |
| COPY-002 | Partial | `/pages/organization` |  |
| COPY-003 | Partial | `/pages/organization` |  |
| COPY-004 | Partial | `/pages/organization` |  |

## ORG-G · Manage access

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DACC-001 | Partial | `/pages/organization` |  |
| DACC-002 | Partial | `/pages/organization` |  |
| DACC-003 | Partial | `/pages/organization` |  |
| DACC-004 | Partial | `/pages/organization` |  |
| DACC-005 | Partial | `/pages/organization` |  |
| DACC-006 | Partial | `/pages/organization` |  |

## ORG-G · Archive doc

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DARC-001 | Partial | `/pages/organization` |  |
| DARC-002 | Partial | `/pages/organization` |  |
| DARC-003 | Partial | `/pages/organization` |  |
| DARC-004 | Partial | `/pages/organization` |  |
| DARC-005 | Partial | `/pages/organization` |  |

## ORG-G · Delete doc

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DDEL-001 | Partial | `/pages/organization` |  |
| DDEL-002 | Partial | `/pages/organization` |  |
| DDEL-003 | Partial | `/pages/organization` |  |
| DDEL-004 | Partial | `/pages/organization` |  |
| DDEL-005 | Partial | `/pages/organization` |  |

## ORG-G · Download

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DDL-001 | Partial | `/pages/organization` |  |
| DDL-002 | Partial | `/pages/organization` |  |
| DDL-003 | Partial | `/pages/organization` |  |

## ORG-G · Description

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DESC-001 | Partial | `/pages/organization` |  |
| DESC-002 | Partial | `/pages/organization` |  |
| DESC-003 | Partial | `/pages/organization` |  |
| DESC-004 | Partial | `/pages/organization` |  |
| DESC-005 | Partial | `/pages/organization` |  |

## ORG-G · Favorite doc

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DFAV-001 | Partial | `/pages/organization` |  |
| DFAV-002 | Partial | `/pages/organization` |  |

## ORG-G · Print/download

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DL-001 | Partial | `/pages/organization` |  |
| DL-002 | Partial | `/pages/organization` |  |
| DL-003 | Partial | `/pages/organization` |  |
| DL-004 | Partial | `/pages/organization` |  |
| DL-005 | Partial | `/pages/organization` |  |
| DL-006 | Partial | `/pages/organization` |  |

## ORG-E · Duplicate

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| DUP-001 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| DUP-002 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| DUP-003 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| DUP-004 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| DUP-005 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |
| DUP-006 | Pass | `/pages/organization` | `FolderActions` colour + duplicate dialog |

## ORG-H · Employee context

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| EMP-001 | Partial | `/pages/organization` |  |
| EMP-002 | Partial | `/pages/organization` |  |
| EMP-003 | Partial | `/pages/organization` |  |
| EMP-004 | Partial | `/pages/organization` |  |
| EMP-005 | Partial | `/pages/organization` |  |

## ORG-H · Errors

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| ERR-001 | Partial | `/pages/organization` |  |
| ERR-002 | Partial | `/pages/organization` |  |
| ERR-003 | Partial | `/pages/organization` |  |
| ERR-004 | Partial | `/pages/organization` |  |
| ERR-005 | Partial | `/pages/organization` |  |
| ERR-006 | Partial | `/pages/organization` |  |
| ERR-007 | Partial | `/pages/organization` |  |

## ORG-E · Favorite

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| FAV-001 | Partial | `/pages/organization` |  |
| FAV-002 | Partial | `/pages/organization` |  |
| FAV-003 | Partial | `/pages/organization` |  |
| FAV-004 | Partial | `/pages/organization` |  |
| FAV-005 | Partial | `/pages/organization` |  |

## ORG-D · Folder list

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| FL-001 | Partial | `/pages/organization` |  |
| FL-002 | Partial | `/pages/organization` |  |
| FL-003 | Partial | `/pages/organization` |  |
| FL-004 | Partial | `/pages/organization` |  |
| FL-005 | Partial | `/pages/organization` |  |
| FL-006 | Partial | `/pages/organization` |  |
| FL-007 | Partial | `/pages/organization` |  |
| FL-008 | Partial | `/pages/organization` |  |
| FL-009 | Partial | `/pages/organization` |  |
| FL-010 | Partial | `/pages/organization` |  |
| FL-011 | Partial | `/pages/organization` |  |
| FL-012 | Partial | `/pages/organization` |  |

## ORG-F · Inheritance

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| INH-001 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-002 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-003 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-004 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-005 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-006 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-007 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-008 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-009 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-010 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-011 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-012 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |
| INH-013 | Partial | `/pages/organization` | `doc.document` org_access_*; `/api/organizational/document-access` |

## ORG-G · Link

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| LINK-001 | Partial | `/pages/organization` |  |
| LINK-002 | Partial | `/pages/organization` |  |
| LINK-003 | Partial | `/pages/organization` |  |

## ORG-E · Lock

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| LOCK-001 | Pass | `/pages/organization` | Lock blocks rename, description, colour, access, uploads; view/search remain |
| LOCK-002 | Pass | `/pages/organization` | Locked folders stay in library, search, and filters |
| LOCK-003 | Pass | `/pages/organization` | Unlock folder shown instead of Lock for manage-folders users |
| LOCK-004 | Pass | `/pages/organization` | Lock is independent of Archive/Restore |
| LOCK-005 | Pass | `/pages/organization` | Distinct lock/unlock audit rows with actor and timestamp |
| LOCK-006 | Pass | `/pages/organization` | Lock/unlock rejected without manage-folders permission |
| LOCK-007 | Pass | `/pages/organization` | Lock is not Private/Archive/Delete and does not change read access |
| LOCK-008 | Pass | `/pages/organization` | Documents inside a locked folder are not marked locked |

## ORG-G · Pin doc

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| PIN-001 | Partial | `/pages/organization` |  |
| PIN-002 | Partial | `/pages/organization` |  |
| PIN-003 | Partial | `/pages/organization` |  |

## ORG-E · Rename

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| REN-001 | Partial | `/pages/organization` |  |
| REN-002 | Partial | `/pages/organization` |  |
| REN-003 | Partial | `/pages/organization` |  |
| REN-004 | Partial | `/pages/organization` |  |
| REN-005 | Partial | `/pages/organization` |  |
| REN-006 | Partial | `/pages/organization` |  |

## ORG-E · Share / manage access

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| SHR-001 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-002 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-003 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-004 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-005 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-006 | Partial | `/pages/organization` | Share opens Manage Access for org folders |
| SHR-007 | Partial | `/pages/organization` | Share opens Manage Access for org folders |

## ORG-D · Search

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| SR-001 | Partial | `/pages/organization` |  |
| SR-002 | Partial | `/pages/organization` |  |
| SR-003 | Partial | `/pages/organization` |  |
| SR-004 | Partial | `/pages/organization` |  |
| SR-005 | Partial | `/pages/organization` |  |
| SR-006 | Partial | `/pages/organization` |  |
| SR-007 | Partial | `/pages/organization` |  |

## ORG-D · Sort

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| ST-001 | Partial | `/pages/organization` |  |
| ST-002 | Partial | `/pages/organization` |  |
| ST-003 | Partial | `/pages/organization` |  |
| ST-004 | Partial | `/pages/organization` |  |
| ST-005 | Partial | `/pages/organization` |  |
| ST-006 | Partial | `/pages/organization` |  |

## ORG-D · All folders table

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| TB-001 | Partial | `/pages/organization` |  |
| TB-002 | Partial | `/pages/organization` |  |
| TB-003 | Partial | `/pages/organization` |  |
| TB-004 | Partial | `/pages/organization` |  |
| TB-005 | Partial | `/pages/organization` |  |
| TB-006 | Partial | `/pages/organization` |  |
| TB-007 | Partial | `/pages/organization` |  |
| TB-008 | Partial | `/pages/organization` |  |
| TB-009 | Partial | `/pages/organization` |  |
| TB-010 | Partial | `/pages/organization` |  |

## ORG-G · Version

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| VER-001 | Partial | `/pages/organization` |  |
| VER-002 | Partial | `/pages/organization` |  |
| VER-003 | Partial | `/pages/organization` |  |
| VER-004 | Partial | `/pages/organization` |  |
| VER-005 | Partial | `/pages/organization` |  |

## ORG-D · View modes

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| VW-001 | Partial | `/pages/organization` |  |
| VW-002 | Partial | `/pages/organization` |  |
| VW-003 | Partial | `/pages/organization` |  |
| VW-004 | Partial | `/pages/organization` |  |

## ORG-I · Advanced configuration removal (synthetic)

| ID | Status | Notes |
|----|--------|-------|
| ORG-I1 | Pass | Retention/types removed from org create form (Settings-owned) |
| ORG-I2 | Pass | Inherited retention shown in Configuration Summary only |
| ORG-I3 | Partial | Employee folder create still exposes advanced fields (out of org scope) |

## ORG-J · Policy & template assignment (synthetic)

Superseded for org-folder UX by **ORG-L (POL-006–POL-009)**. Use POL rows for sign-off; keep ORG-J for spec traceability only.

| ID | Status | Notes |
|----|--------|-------|
| ORG-J1 | Pass | Org policy PDFs are created in-folder via **+ New → Create policy** (POL-006). Legacy `/api/organizational/assign-policy-template` remains for integrations; org document kebab no longer exposes assign (POL-009). |
| ORG-J2 | Pass | Linked policy opens Compliance (`?policy=`); no second access editor on the link |
| ORG-J3 | N/A | Acknowledgement remains Policies module workflow |

## Spec document logical issues (for QA sign-off)

1. Cover says ten folder actions; body defines eleven (Delete).
2. Share redefined as Manage Access in Part B; legacy external share links remain for employee folders only.
3. Public/Restricted/Private UX maps to `access_scope` values (`all_staff`, scoped, `private`).
4. Part I §47 lists acceptance criteria heading without numbered IDs — covered by ORG-I* rows.
5. Part J has narrative acceptance criteria only — covered by ORG-J* rows.

## ORG-K · + New menu (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| NEWM-001 | Pass | `/pages/organization` | Upload / Create / Other groups on `OrganizationalNewMenu` |
| NEWM-002 | Pass | Folder page | Unauthorised options are hidden, not shown-then-blocked |
| NEWM-003 | Pass | Folder page | Create from template generates an operational copy |
| NEWM-004 | Pass | Folder page | Create template uploads a master with `is_template` |
| NEWM-005 | Pass | Folder page | Scan document uses camera/file capture then upload |
| NEWM-006 | Pass | Folder page | Add from other sources lists only connected connectors |
| LINK-001 | Pass | Document kebab | Broken-link badge + Check link probes `source_url` |
| ACTION-UI-001 | Pass | Document kebab | Copy link / Add shortcut / Copy to / Rename |
| ACTION-UI-002 | Pass | Folder kebab | Move folder with cycle prevention |
| ACTION-UI-003 | Pass | Folder kebab | Organise / Access / Lifecycle grouping |
| ACTION-UI-004 | Pass | Library table | Description, Documents, Owner, Last modified, Locked; column headers sort full list (not page-only) on `/pages/organization` and folder drill-in |
| ACTION-UI-005 | Pass | Library filters | Locked / Unlocked / Archived combined with other filters |
| ACTION-UI-006 | Pass | Bulk toolbar | Archive, Download, Lock/Unlock, Favourite only |

## ORG-K · Collections and detail (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| COLL-001 | Pass | Project/Vendor | Collection ID (`PRJ-` / `VND-`) shown in table and breadcrumb |
| COLL-002 | Pass | Create project/vendor | Suggested files capped list |
| COLL-003 | Pass | Create/edit collection | Organize By organisational dimension |
| DETAIL-001 | Pass | Document details / viewer | Owner, ID, location, source URL, template provenance |

## ORG-L · Policies and templates (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| POL-001 | Pass | Left nav Policies | Routes to `/pages/compliance`, not an org folder |
| POL-002 | Pass | New Policy | Scratch / Import existing / Create with AI |
| POL-003 | Pass | Create with AI | Draft until a human activates |
| POL-004 | Pass | Employee profile → Compliance tab | **Assign policy** modal lists active policies (not `window.prompt`); not used on org library documents (see POL-009) |
| POL-005 | Pass | Employee file Compliance | Assign policy notifies; optional Request signature |
| POL-006 | Pass | Org folder + New | **Create policy** in-folder (scratch / import / AI); policy PDF named `{Policy name}.pdf`; **Create from template** disabled (Templates module TBD) |
| POL-007 | Pass | Org library table | **Linked to policy** badge + subtitle; Filters → Other → linked / not linked |
| POL-008 | Pass | Document viewer / details | Linked policy banner opens `/pages/compliance?policy={id}` |
| POL-009 | Pass | Document kebab | **Assign policy / template** removed; policies created via + New in folder |
| TMPL-001 | Pass | + New | Generate from template; master stays `is_template` |

## ORG-N · Automate (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| AUTO-001 | Pass | Document kebab Automate | Trigger, condition, action, Active/Disabled |
| AUTO-002 | Pass | Automate save | Actor RBAC; audit on `doc.object.audit` |
| AUTO-003 | Pass | Cron | Approaching expiry / expired via `organizational_automation_cron.xml` |

## ORG-EXT · Connectors and scan (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| EXT-001 | Pass | Super Admin → Integrations | Connect/disconnect Drive, OneDrive, SharePoint, Dropbox |
| EXT-002 | Pass | Disconnect | Imported files are not destroyed |
| EXT-003 | Pass | + New Other | Import creates a native Document ID |
| SCAN-001 | Pass | Scan document | Failed capture leaves no half-record (upload after review) |

## ORG-M · Hardening (v3)

| ID | Status | Where to test | Notes |
|----|--------|---------------|-------|
| AUD-OBJ-001 | Pass | Document Activity | Object audit beyond lock audit |
| OFF-001 | Pass | Offline banner | Header banner; mutating actions blocked |
| MOB-001 | Pass | Mobile kebab | Bottom sheet via `.org-action-sheet` |
| RULE-001 | Pass | `record_rules.xml` | Document-level `org_access_*` narrowing |
| EMPTY-001 | Pass | Empty library | Access-scope empty state copy |
| VER-001 | Pass | Version history | Restore writes a new current version |

---

## Release smoke (org Phase 0–1)

See `ORG_SMOKE.md` for the short scripted pass. Matrix rows above remain the full regression catalog.

## Change log

| Date | Change |
|------|--------|
| 2026-09-26 | POL-006–009 policy-in-folder flow; ORG-J reconciled; library column sort; `ORG_SMOKE.md` |

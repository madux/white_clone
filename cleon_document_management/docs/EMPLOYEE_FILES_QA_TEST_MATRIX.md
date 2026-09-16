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
| EF-A8 | Multi-dimension views | Partial | Home dimension tabs; Settings | Preview panel in settings TBD. |

## EF-B · Issues & reconciliation

| ID | Status | Where |
|----|--------|-------|
| EF-B1 | Pass | `/pages/employee/issues` |
| EF-B2 | Pass | Home stats strip |
| EF-B3 | Partial | Retry/resolve; View in EMS label only |
| EF-B4 | Partial | Taxonomy codes; plain-language copy |

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
| EF-D1 | Pass | Profile tabs: Overview, Documents, Compliance, Activity, Related groups |
| EF-D2 | Pass | Approval workflow (existing) + `EmployeeUploadWizard` (3-step) optional |
| EF-D3 | Pass | Versioning + config duplicate mode |
| EF-D4 | Partial | `classification_state`; reclassify API |
| EF-D5 | Partial | Global search API; column picker TBD |
| EF-D6 | Partial | Preview/actions; reclassify endpoint |
| EF-D7 | Partial | Favourite API; export uses existing download |
| EF-D8 | Partial | `doc.document.relation` + API |
| EF-D9 | Partial | Signature request stub + EF-F8 toggle |
| EF-D10 | Pass | Compliance tab on profile |

## EF-E · EMS sync

| ID | Status |
|----|--------|
| EF-E1 | Pass | Department/attribute → system group membership |
| EF-E2 | Pass | Create employee → file init when setup complete |

## EF-F · Settings

| ID | Status | Where |
|----|--------|-------|
| EF-F1 | Partial | Header keys JSON in config |
| EF-F2 | Partial | Dimensions in config + wizard |
| EF-F3 | Pass | Existing document types section |
| EF-F4 | Pass | Employee Files settings panel |
| EF-F5 | Partial | Category matrix JSON |
| EF-F6 | Partial | Notification routing JSON |
| EF-F7 | Partial | Integration mapping JSON |
| EF-F8 | Partial | E-sign enable + stub provider |
| EF-F9 | Pass | Lifecycle settings (existing) |
| EF-F10 | Partial | Max retries + escalation user |

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

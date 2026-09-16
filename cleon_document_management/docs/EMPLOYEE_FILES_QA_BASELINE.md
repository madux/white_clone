# Employee Files QA baseline (v3 spec vs Cleon DMS)

**Last updated:** 2026-03-16  
**Active QA mode:** **Baseline A (v3 PDF)** — automation-first Employee Files.  
**Spec reference:** Draft DMS v3 — Employee Files Submodule (EF-A through EF-G, 42 features)  
**Product under test:** `cleon_document_management` (Next.js + Odoo).

**Out of scope for this QA pack**

- Document Intelligence (`/pages/document-intelligence/*`).

**Compliance (EF-D10)**

- Employee File displays compliance status and on-demand check; full policy QA may still use [COMPLIANCE_QA_TEST_MATRIX.md](./COMPLIANCE_QA_TEST_MATRIX.md) when published.

---

## 1. Stakeholder alignment

| Option | What QA validates |
|--------|-------------------|
| **A — v3 Employee Files spec (active)** | EMS setup wizard, Issues & Reconciliation, System-Managed Groups, Custom Groups, EF-D/F settings surfaces. |
| **B — Legacy folder DMS** | Deprecated for Employee Files after `setup_complete`; organizational library unchanged. |

### Decision record

**Baseline A is in effect** (2026-03-16). Greenfield tenants run **Set Up Employee Files** before the home appears. Legacy employee `doc.folder` rows are deactivated on setup confirm.

### In scope

- `/pages/employee` (wizard + home), `/pages/employee/group`, `/pages/employee/issues`, `/pages/employee/profile`
- Settings → **Employee Files** (EF-F1–F10 configuration surfaces)
- EMS sync via `hr.employee` hooks and `doc.employee.files.service`

### Unchanged

- **Organizational Files** (`/pages/organization`) — folder-based library per product decision.

---

## 2. Code anchors

| Concern | Location |
|---------|----------|
| Domain models | `models/employee_file.py`, `employee_group.py`, `employee_files_config.py`, `employee_issue.py`, `employee_setup.py` |
| Orchestration | `models/employee_files_service.py` |
| APIs | `controllers/employee_files.py` |
| Next UI | `EmployeeFilesWorkspace.tsx`, `EmployeeFilesSetupWizard.tsx`, `EmployeeFilesHome.tsx` |
| HR sync | `models/hr_employee.py` |

---

## 3. Reset database content (greenfield QA)

To wipe **Document Management** transactional data (documents, folders, employee files v3, groups, issues, setup runs) while **keeping** `hr.employee` and module reference data (document types, policy types):

From your Odoo install directory:

```bash
cd ~/Documents/Projects/odoo-17.0
.venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \
  < ~/Documents/Projects/white_clone/scripts/clear_dms_data.py
```

Then hard-refresh `/document-management` and open `/pages/employee` — you should see **Set Up Employee Files** again.

Optional env vars: `DMS_CLEAR_INTELLIGENCE=0`, `DMS_CLEAR_COMPLIANCE=0`, `DMS_RESET_ONBOARDING=0` to skip those steps.

For a completely empty tenant (no HR seed), use a fresh database or your usual Odoo DB reset workflow instead.

### Reset EF-QA EMS roster (optional)

Rebuilds the **EF-QA-***** bulk roster with realistic names, departments, and ~14% inactive (every 7th employee). Removes prior `EF-QA-*` rows and linked `doc.employee.file` rows for those EMS ids.

```bash
cd ~/Documents/Projects/odoo-17.0
.venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \
  < ~/Documents/Projects/white_clone/scripts/seed_ef_qa_roster.py
```

Env: `SEED_EF_QA_COUNT=1000`, `SEED_EF_QA_INACTIVE_EVERY=7`, `SEED_EF_QA_SKIP_DELETE=1` (rename in place only, no delete).

Roster creation runs **attention cases** by default (`SEED_EF_QA_APPLY_ATTENTION_CASES=1`): clears department on every 37th active EF-QA employee plus a few pinned indices so setup preview/issues show **need attention**.

To apply or refresh attention cases without rebuilding the roster:

```bash
.venv/bin/python odoo-bin shell -c odoo.conf -d white_cleon_17 \
  < ~/Documents/Projects/white_clone/scripts/seed_ef_qa_attention_cases.py
```

Then reset DMS (`clear_dms_data.py`) and run **Set Up Employee Files** again. Check **Review** (need attention count) and `/pages/employee/issues` (category: no department / no organizational attribute).

---

## 4. Maintenance

Update [EMPLOYEE_FILES_QA_TEST_MATRIX.md](./EMPLOYEE_FILES_QA_TEST_MATRIX.md) when behavior changes.

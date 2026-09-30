# Organizational Files — release smoke (Phase 0–1)

Run after `npm run deploy` (next-app) and Odoo module reload (`-u cleon_document_management`). Use a **Document Admin** plus one **restricted** user without org create rights.

| # | Step | Pass criteria |
|---|------|----------------|
| 1 | Open `/pages/organization` | Root library loads; empty or scoped folders only |
| 2 | List view table | Click **Name**, **Items**, **Owner**, **Modified** headers; order changes across pages |
| 3 | **+ New → Folder** | Public folder saves; appears for second user if in scope |
| 4 | Open folder → subfolder | Child scope cannot exceed parent (Restricted narrower than parent) |
| 5 | **+ New → Upload** | File appears; kebab → Manage access respects folder scope |
| 6 | **+ New → Create policy** (admin) | Policy PDF in folder; **Linked to policy** badge; filter **Other → Linked** |
| 7 | Open linked file | Viewer/details banner → `/pages/compliance?policy={id}` |
| 8 | Document kebab | No **Assign policy / template** on org files |
| 9 | Lock folder | Upload/create disabled; unlock restores |
| 10 | `/pages/employee` | Employee Files home still loads (regression) |

**Employee Files cross-check (optional, 5 min):** setup wizard review attention search/filters; Employee files tab column sort.

**Full regression:** `ORGANIZATIONAL_FILES_QA_TEST_MATRIX.md` + `EMPLOYEE_FILES_QA_TEST_MATRIX.md` release smoke.

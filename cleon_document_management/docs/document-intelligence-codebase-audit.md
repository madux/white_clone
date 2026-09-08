# Document Intelligence — codebase audit

Date: 2026-09-05  
Scope: `cleon_document_management` only. Employee Files, Organizational Files, and Compliance stay owned by existing work.

Sources: `document-intelligence-requirements.md`, `cursor-document-intelligence-prompt.md`.

---

## 1. Framework, entry points, routing, build

| Layer | Facts |
|---|---|
| Backend | Odoo 17 Community addon `cleon_document_management` |
| ORM | Odoo models (`models/*.py`), no separate migrations — Odoo schema on `-u` |
| HTTP | Odoo controllers, `type="json"` JSON-RPC (`jsonrpc` / `method: call` / `params`) + a few `type="http"` file routes |
| Frontend | Next.js 16 App Router (`next-app/`), React 19, Tailwind 4, TanStack Query, axios, lucide-react, Headless UI |
| Package manager | npm (`next-app/package.json`) |
| Scripts | `npm run dev` (port 3030), `npm run lint`, `npm run deploy` (webpack build + sync to `static/src/nextapp`) |
| Typecheck | `npx tsc --noEmit` (documented; no npm script) |
| Tests | **None** in this module |
| Serving | Odoo serves `/document-management` from static export, or proxies Next.js if `NEXTAPP_DEV=1` |
| Dev convention | README: UI on `http://localhost:3030/document-management`, APIs on `http://localhost:8069` via `NEXT_PUBLIC_ODOO_URL` |

App entry: `next-app/src/app/layout.tsx` (Sidebar + Header + Providers).

---

## 2. Existing Document Management routes and ownership

Base path: `/document-management` (`next.config.ts`).

| Route | Owner | Status |
|---|---|---|
| `/` and `/pages/home` | Dashboard | Built — **do not rewrite** |
| `/pages/employee*` | Employee Files | Built — **do not rewrite** |
| `/pages/organization*` | Organizational Files | Built — **do not rewrite** |
| `/pages/compliance` | Compliance | Built — **do not rewrite** |
| `/pages/document-intelligence` | Document Intelligence | **Placeholder only** (`IntelligencePage.tsx`) |
| Templates & Forms | Other developer | **Not in Next.js** (prototype HTML under `resources/ui/.../templates-forms`) |

Sidebar already has an Intelligence section with a single link to Document Intelligence. Nested DI screens (Overview, Dataset, Validate, Ask, Configuration) **do not exist**.

**Assumption:** Keep the existing sidebar item. Nest DI sub-routes under `/pages/document-intelligence/...` so Employee/Org/Compliance URLs stay untouched.

---

## 3. Reusable existing implementations

### Documents, folders, people

- `doc.folder` — employee vs organizational, departments, branches (`multi.branch`), grades, employees, lock, retention, approval
- `doc.document` — attachment (`ir.attachment`), type, employee, expiry, state, approval, `extracted_text`, `ocr_state` (stub methods only)
- `doc.document.type` — name, category, active, mandatory default, retention years
- `hr.employee`, `res.users`, `res.company`, `hr.department`, `hr.grade`, `multi.branch`
- Upload: `/api/upload-document` (org folders only)
- Preview: `/document-management/document/<id>/preview`
- Download: document / folder ZIP / employee ZIP
- Search: Header client-side over folders/docs/policies already loaded — **not** server search

### RBAC / audit

- Groups: Document User / Manager / Administrator (`security/security_groups.xml`)
- ACLs: mixed `base.group_user` vs document groups; **no `ir.rule` record rules**
- Audit today: `mail.thread` tracking on documents, not a dedicated intelligence audit log
- Auth: `auth="user"` on JSON APIs; Next.js injects `window.__ODOO_USER__`

### UI / design system

- Tailwind tokens in `globals.css`: `brand-pink`, `brand-text`, `brand-gray`, `.field`, `.label`
- Patterns: loading pulse blocks, `ErrorState`, empty copy, rounded cards, lucide icons
- Modals: inline overlays (not a shared Dialog primitive everywhere)
- Toasts: **none** — errors inline
- Charts: simple CSS bars on Dashboard; Chart.js loaded in Odoo backend assets only
- React Query hooks in `hooks/useDocuments.ts` + `lib/api.ts` JSON-RPC helper

**Assumption:** New DI UI copies Dashboard/Compliance visual language. New APIs use the same `rpc()` helper and `{ success, data/message }` payloads. Do not add a toast library unless needed.

---

## 4. Models / API contracts to reuse vs add

### Reuse

- Source documents: `doc.document` + `ir.attachment`
- Types: extend `doc.document.type` rather than a second type registry where possible
- Scope resolution: query `doc.document` / `hr.employee` server-side with folder_type + employee/dept/grade/company filters
- Preview URL already exists for the Validate split view

### Missing entities (to add, namespaced `doc.intelligence.*`)

```
doc.intelligence.profile
doc.intelligence.profile.version
doc.intelligence.field
doc.intelligence.dataset
doc.intelligence.job
doc.intelligence.record
doc.intelligence.extracted.field
doc.intelligence.validation.rule
doc.intelligence.validation.issue
doc.intelligence.review.action
doc.intelligence.chunk          # knowledge index
doc.intelligence.query
doc.intelligence.audit
doc.intelligence.settings       # singleton / company settings
```

**Assumption:** Prefix `doc.intelligence.*` so we do not collide with `doc.document`, `doc.document.type`, or compliance models.

### API convention (do not copy REST verbs literally)

Odoo JSON-RPC POST, e.g.:

```
/api/document-intelligence/overview
/api/document-intelligence/datasets
/api/document-intelligence/datasets/run
/api/document-intelligence/jobs
/api/document-intelligence/review-queue
/api/document-intelligence/records/approve
/api/document-intelligence/ask
/api/document-intelligence/settings
/api/document-intelligence/audit-logs
```

All `type="json"`, `auth="user"`, `csrf=False`, same as existing `/api/compliance/*`.

---

## 5. Background jobs, queues, realtime

| Exists | Notes |
|---|---|
| `ir.cron` | Two compliance crons only |
| Queue / Celery / workers | **None** |
| Websocket / SSE | Bus exists in Odoo core; this module does not use it |
| Polling | **None** yet; React Query `staleTime` 5 minutes, `refetchOnWindowFocus: false` |

**Plan:** Smallest Odoo-compatible job: `doc.intelligence.job` + `ir.cron` (frequent tick) or `ir.cron` + process N documents per tick. Frontend polls job progress with React Query `refetchInterval` while status is `queued`/`running`.

---

## 6. AI, OCR, embeddings, connectors

| Capability | Status |
|---|---|
| OCR fields on `doc.document` | Present; `action_start_ocr` only sets state — **no worker** |
| Repo Python deps | Root `requirements.txt`: `pytesseract`, `pypdf`, `pdf2image`, `pymupdf`, `ollama` |
| Embeddings / vector DB | **None** |
| Slack / Teams / PagerDuty / Drive / SharePoint | **None** in this module |

**Assumptions:**

- OCR: use `pymupdf` text first, `pytesseract`/`pdf2image` fallback if setting enabled. Wrap behind a provider interface.
- Classification + field extraction: Ollama if reachable, else a **typed mock adapter** clearly labeled. Never store API keys in the browser.
- Ask & Insights phase 9: structured SQL/ORM over **approved** records first; chunk index later. If Ollama is down, return “insufficient evidence / provider unavailable”.
- External repository connectors: **not in v1**. Wizard source “External Source” disabled with explanation. Employee Files / Organizational Files / Direct upload only (upload already exists for org folders).
- Slack/Teams/PagerDuty: show **Disconnected**. Do not fake connected health.

---

## 7. Tests

- This module: **no tests**
- Nearby pattern: `hr_expense_management` uses Odoo `HttpCase` / `--test-enable`

**Plan:** Add `cleon_document_management/tests/` for wizard validation, job transitions, permissions, review actions, citations, audit. Frontend: no test runner today — skip Jest unless we add one later; rely on `tsc` + `lint` + Odoo tests.

---

## 8. Incomplete / collisions / demo data

- `IntelligencePage.tsx`: `"Document Intelligence Placeholder"`
- `NEXT_PUBLIC_USE_TEST_DATA` mock layer in `lib/api.ts` / `lib/mock-data.ts` — Employee/Org/Compliance only
- `/api/get-document-type` called by frontend, **not implemented** (pre-existing; DI should not depend on it for types — DI will have its own type/profile APIs, but may still reuse `doc.document.type`)
- No Templates & Forms Next route — do not create one
- Menu label `Document Management2` — out of scope unless we touch menus for ACLs
- No route collision with `/api/document-intelligence/*` today

---

## 9. Risks

1. **Shared `doc.document.type`:** Employee/Org already use it. DI should add fields (`scope`, `default_profile_id`, classification labels) carefully, or link a DI-specific extension model. Prefer **optional fields on existing type** plus DI profiles keyed by `document_type_id`.
2. **No record rules:** DI APIs must filter by user/employee/company in controller methods, not trust the UI.
3. **Org-only upload:** Direct-upload source in the wizard may need a DI-specific upload that still creates `doc.document` without changing Employee Files screens.
4. **Ollama optional:** Vertical slice must run without a live model (deterministic extractor from filename/type + OCR text heuristics) so jobs complete in local Odoo.
5. **Static export:** Nested routes need `page.tsx` files; `trailingSlash: true` already set.
6. **Do not change** `Sidebar` core links, `DocumentListPage`, `OrganizationFolderPage`, `EmployeeFolderPage`, or compliance controllers except adding new files.

---

## 10. Implementation plan (aligned with prompt delivery sequence)

Vertical slice first: **Employment Contract** type, **one profile**, source **Organizational Files**, one job, review one record, one cited ask over approved data.

1. **Audit** — this file.
2. **Route shell** — nested DI nav + empty states for Overview / Dataset / Validate / Ask / Configuration. Replace placeholder only.
3. **Persist types/profiles/fields** — models, ACLs, seed Employment Contract profile, JSON APIs, Configuration screens.
4. **Dataset wizard** — 6 steps, draft save, block zero types/fields, persist thresholds/mode.
5. **Job + pipeline** — cron-driven job: resolve docs → text → classify/map → extract → validate → route approved/review. Progress counters.
6. **Validate** — split preview + fields; approve/reject/correct/override + audit.
7. **Overview** — real jobs; accuracy labeled estimated until reviews exist.
8. **Settings + audit logs UI**.
9. **Index approved records + Ask** (permission first, then generate).
10. **Notifications/webhooks** only with real health; otherwise disconnected.

Isolation rule: new files under `models/intelligence_*.py`, `controllers/intelligence.py`, `views/intelligence_views.xml`, `next-app/src/app/pages/document-intelligence/**`, `next-app/src/app/components/intelligence/**`, `next-app/lib/intelligence-api.ts`.

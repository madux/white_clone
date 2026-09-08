# Document Intelligence — progress checklist

Follow `cursor-document-intelligence-prompt.md` and `document-intelligence-requirements.md`.

## Phase 1 — Audit (no feature code)
- [x] Inspect framework, routing, APIs, models, jobs, AI, design system, tests
- [x] Write `docs/document-intelligence-codebase-audit.md`
- [x] Confirm isolation from Employee Files / Organizational Files / other DMS screens

## Phase 2 — Route/screen shell
- [x] Document Intelligence nav: Overview, Dataset, Validate, Ask & Insights, Configuration
- [x] Replace placeholder page without changing other Document Management routes

## Phase 3 — Types, profiles, fields (persistence)
- [x] Document types
- [x] Extraction profiles + versions
- [x] Field definitions + validation rules

## Phase 4 — Dataset wizard
- [x] Six-step wizard with validation
- [x] Draft persistence
- [x] Block run with zero types or zero fields

## Phase 5 — Vertical-slice extraction job
- [x] Job model + async processing
- [x] One document type, one profile, one source, one job
- [x] Native text for PDF/Word/Excel/PPT/txt; Groq vision only for images/scans

## Phase 6 — Review queue
- [x] Split viewer + extracted fields
- [x] Approve / reject / correct / override with audit

## Phase 7 — Overview and monitoring
- [x] Real jobs, progress polling, attention cards
- [x] Label estimated/demo metrics honestly

## Phase 8 — Settings and audit logs
- [x] Groq / pgvector health on settings (key stays on the server)
- [x] Audit log UI + events

## Phase 9 — Ask & Insights
- [x] Permission-aware retrieval over approved chunks (pgvector + Groq gpt-oss-120b)
- [x] Query history from audit events
- [x] Conversational Ask workspace (history, attach, voice)
- [x] Deploy Next export (`npm run deploy`) so Odoo on :8069 serves the new Ask UI
- [x] Fix Ask layout: page scroll, mascot image URL, visual polish
- [x] Redeploy static export after Ask layout fix
- [x] ChatGPT-style chat titles from first user query (LLM)
- [x] Chat sidebar layout like ChatGPT
- [x] Redeploy Ask UI after title/sidebar change

## Merge (origin/document-intelligence)
- [x] Pulled incoming approval-inbox work (Header, mock-data removal)
- [x] Kept `export async function rpc` in `next-app/lib/api.ts` for Intelligence
- [x] Rebuilt and synced `static/src/nextapp` so inbox + Intelligence share one export
- [x] Merged latest origin/document-intelligence into `michael` (company documentary + onboarding). Source had no conflicts; rebuilt DMS static export.

## Ask UI follow-up
- [x] LLM chat titles that are not the full question (gpt-oss token/content fix)
- [x] Delete chats from the sidebar
- [x] Show the user message immediately + Thinking… then stream the reply
- [x] Hide references/citations under answers
- [x] Render markdown (**bold**, lists) in assistant replies
- [x] Deploy frontend and bump module version for unlink ACL
- [x] Fix "Cursor already closed" on Ask stream (dedicated DB cursor)

## Ask AI from a document
- [x] Ask AI button on organizational folder and My Documents viewers
- [x] Opens a new Ask chat with that file attached as the primary source
- [x] Approved datasets still used as extra context
- [x] Deploy frontend; restart Odoo for attach/prompt tweaks

- [x] Ask answers render headings, tables, lists, and code
- [x] Ask composer stays at the bottom
- [x] Render HTML &lt;br&gt; in Ask answers as line breaks
- [x] Keep Ask table bullets in the details column (do not leak into heading column)

## Dataset wizard — spec alignment
- [x] Repository cards with live document counts
- [x] Scope pickers that persist IDs and show match estimates
- [x] Preview uses live matching document count
- [x] Upload / External stay honest (not fake employee files)
- [x] Upload documents is a real wizard source (drag-drop, private folder, run)
- [x] Document types: cards, descriptions, field counts, auto-classify
- [x] Business fields: counts, select/deselect all, search, descriptions
- [x] Validation presets explained + preview run summary
- [x] Deploy Next export so Odoo serves the new wizard steps

## Dataset wizard fixes
- [x] Live file counts / employees / departments (wizard options no longer crash on hr.branch)
- [x] Explain extraction vs accuracy metrics honestly
- [x] Dataset leaves needs-review after the queue is empty; skip missing source files
- [x] Wizard field step: no “2 of 0”; explain empty profiles
- [x] Results opens extracted records, not an empty Validate queue
- [x] Data quality counts approved records without open blocking issues
- [x] LLM classifies files when automatic classification is on
- [x] LLM extracts/validates field values from document text (not the file name)
- [x] Validate screen no longer shows extracted text under the preview
- [x] Ask attach menu closes when clicking outside
- [x] Attached files list in the Ask right pane with view and multi-delete
- [x] Chat attachments are chunked into a per-chat vector index (not dumped into the LLM)
- [x] Ask retrieves chat chunks plus the selected dataset index
- [ ] Restart Odoo with `-u cleon_document_management` so Ask attachment ACL and rejected dataset state load
- [x] Deploy Next export after enabling wizard uploads

## Configuration page
- [x] Only Document types is highlighted on `/configuration/`
- [x] Edit button on each document type
- [x] Deploy Next export for configuration tab/edit fix

## Overview
- [x] Remove “How extraction works” from Document Intelligence overview
- [x] Deploy Next export after overview copy change
- [x] Equal shortcut cards; pink reserved for the header New Extraction button
- [x] Deploy Next export after overview card hover polish
- [x] Hide Retry on completed jobs (overview + datasets)
- [x] Deploy Next export after hiding completed Retry
- [x] Rejected records close the dataset/job as rejected, not completed
- [ ] Restart Odoo with `-u cleon_document_management` for the rejected dataset state and Ask attachment ACL
- [x] Ask library picker uses live Employee/Org files only (not recycle bin)
- [x] Deploy Next export after Ask upload progress and library filter
- [x] Block attaching a file that is already on the chat
- [x] Deploy Next export after Ask duplicate-attach guard
- [x] Most recently messaged Ask chat moves to the top of the list
- [ ] Restart Odoo so Ask chat recency ordering loads
- [x] Deploy Next export after Ask chat list recency sort

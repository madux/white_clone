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
- [x] Merged origin/document-intelligence again (social gallery, documentary compliance, pending uploads). Combined source conflicts; rebuilt DMS static export.

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

## Dataset wizard — document types from scope
- [x] After Scope, Document types shows Automatic classification first
- [x] Then only types that exist on the files in this scope (e.g. all CVs → only CV)
- [x] Employee scope (one / multiple / department / etc.) uses types on matching files
- [x] Click a type to add/remove fields for this dataset (no Business fields step)
- [x] Five-step wizard: Repository → Scope → Document types → Validation → Preview
- [x] Deploy Next export after document-type + field-picker change
- [ ] Restart Odoo with `-u cleon_document_management` for wizard estimate type IDs

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
- [x] Show archived extraction profiles on Configuration → Profiles with Restore
- [x] Archiving a profile leaves the document type intact and clears it as the type default
- [x] Remove New version from extraction profiles
- [ ] Restart Odoo with `-u cleon_document_management` for profile archive/default unlink
- [x] Deploy Next export after removing New version
- [x] Deploy Next export after profile Restore visibility
- [x] Deploy Next export after Ask chat list recency sort
- [x] Ask AI opens a full-screen workspace (hides DMS sidebar, header, and Intelligence nav)
- [x] Ask welcome UI matches the AI Workspace design (history, suggestions, quick actions)
- [x] Deploy Next export after Ask full-screen workspace UI
- [x] Ask composer: one mic, send outside the bar, cycling example prompts, compact Figma scale
- [x] Deploy Next export after Ask composer and scale polish
- [x] Ask: remove Quick Actions, Select mode, Direct Answer badge, and right-rail slogan
- [x] Ask composer focus ring follows the pill, not a rectangle inside it
- [x] Ask uses a per-user library RAG (own files + shared files)
- [x] Deleted / recycled / archived files are removed from the Ask library RAG
- [x] Existing files are indexed by cron (local embeddings if Groq embeddings 404)
- [x] Hybrid RAG: Qwen3-Embedding-0.6B + Qwen3-Reranker-0.6B via Python (Hugging Face)
- [x] Remove Docker TEI containers
- [x] Install sentence-transformers and download the Qwen3 models
- [x] Load Qwen3 models from the local Hugging Face cache (no Hub warning if already downloaded)
- [ ] Restart Odoo with `-u cleon_document_management` so 1024-d vectors and local Qwen3 RAG load
- [x] Deploy Next export after settings health shows local Qwen3 models
- [x] Ask chat bubbles: compact pink user, wide AI with robot avatar, time in/under bubbles
- [x] Copy and Regenerate appear on hover only (no share or feedback)
- [x] Deploy Next export after Ask chat bubble restyle
- [ ] Restart Odoo so Ask regenerate replaces the last AI reply without a duplicate user message
- [x] Ask composer grows with new lines; Copy pastes readable text (not ## / **)
- [x] Document Intelligence nav: Ask & Insights sits after Overview
- [x] Configuration: Document types chip also covers extraction profiles
- [x] Document type modal includes extraction profile/fields
- [x] Deactivate type confirms, then greys out at the bottom; delete + multi-select
- [ ] Restart Odoo so document type delete and inactive listing load
- [x] Edit document type loads existing extraction fields (not an empty profile)

## Templates & Forms — generate editor crash
- [x] Remember generated document id (URL + sessionStorage)
- [x] Full-page open editor after generate
- [x] Tiptap fallback if Univer crashes the page
- [x] Deploy Next export so :8069 serves the fix
- [x] Restore Tiptap formatting ribbon (Home / Insert / Layout / Review)
- [x] Dataset wizard: Organizational scope is a folder table + per-file picker
- [x] Deploy Next export after org scope file picker
- [ ] Restart Odoo with `-u cleon_document_management` for selected_files scope

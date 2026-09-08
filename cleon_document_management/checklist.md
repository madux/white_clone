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

## Ask UI follow-up
- [x] LLM chat titles that are not the full question (gpt-oss token/content fix)
- [x] Delete chats from the sidebar
- [x] Show the user message immediately + Thinking… then stream the reply
- [x] Hide references/citations under answers
- [x] Render markdown (**bold**, lists) in assistant replies
- [x] Deploy frontend and bump module version for unlink ACL
- [x] Fix "Cursor already closed" on Ask stream (dedicated DB cursor)
## Dataset wizard — spec alignment
- [x] Repository cards with live document counts
- [x] Scope pickers that persist IDs and show match estimates
- [x] Preview uses live matching document count
- [x] Upload / External stay honest (not fake employee files)
- [x] Document types: cards, descriptions, field counts, auto-classify
- [x] Business fields: counts, select/deselect all, search, descriptions
- [x] Validation presets explained + preview run summary
- [x] Deploy Next export so Odoo serves the new wizard steps

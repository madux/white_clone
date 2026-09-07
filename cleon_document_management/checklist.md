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
- [x] Structured field filters for expiry, notice, probation, missing training

## Phase 10 — Notifications and hardening
- [ ] Notifications/webhooks only if real health checks exist
- [ ] Tests, lint, existing DMS routes still work

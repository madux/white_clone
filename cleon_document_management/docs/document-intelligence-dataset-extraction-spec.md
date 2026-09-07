# CleonHR Document Intelligence
## Dataset and Extraction Wizard — Implementation Specification

**Purpose:** Build the Document Intelligence dataset builder and extraction workflow shown in the Document Management prototype.

**Reference prototype:** `https://bass-coat-72463499.figma.site/#/document-management`

**Audience:** Cursor AI, frontend engineers, backend engineers, AI/OCR engineers, QA, and product owners.

**Status:** Implementation-ready product/technical specification based on the inspected prototype. Counts and sample records in the prototype are demo data and must not be hardcoded.

---

## 1. Product objective

Document Intelligence allows an HR administrator to define a reusable dataset extraction job. The administrator selects where documents come from, who or what they belong to, which document types to process, which fields to extract, and how uncertain results should be reviewed.

The system then processes documents asynchronously, extracts structured data, records evidence and confidence, applies deterministic validation rules, and routes uncertain results to a human review queue.

Core principle:

> AI may classify, extract, summarize, and suggest. The application database, permissions, validation rules, and human reviewers remain the source of truth.

---

## 2. Scope

### Included

- Dataset creation and draft saving
- Repository/source selection
- Employee and organizational document scopes
- Upload-based extraction
- External-source connection placeholders/integrations
- Automatic or manual document-type selection
- Extraction profiles
- Business-field selection and data types
- Custom document types and custom fields
- Confidence policies and validation thresholds
- Dataset preview and cost/time estimates
- Asynchronous extraction jobs
- OCR/text extraction
- AI document classification
- Structured field extraction
- Evidence and confidence storage
- Human validation/review
- Job progress, failures, retries, and audit logs

### Initially excluded unless separately approved

- E-signature execution
- Automatic legal/compliance decisions
- Fully autonomous deletion or archival
- Training a custom foundation model
- Unrestricted AI access to all company documents
- Production OAuth integrations without provider-specific requirements

---

## 3. Wizard overview

The wizard has six steps:

1. Repository
2. Scope
3. Document Types
4. Business Fields
5. Validation Rules
6. Preview and Run

The wizard is a stateful draft. Every completed step should be persisted so that the user can save, leave, and resume later.

Suggested state machine:

```text
draft
  → repository_configured
  → scope_configured
  → document_types_configured
  → fields_configured
  → validation_configured
  → ready_to_run
  → queued
  → processing
  → completed / completed_with_errors / failed
```

The UI should not rely only on browser state. Persist the draft after each meaningful change or through an explicit “Save draft” action.

---

## 4. Step 1 — Repository

### UI

Display four source cards:

1. **Employee Files**
   - Employee-specific documents
   - Continue to Scope

2. **Organizational Files**
   - Company-wide documents
   - Continue to document preview/filtering

3. **Upload Documents**
   - Drag-and-drop or file picker
   - Accepted formats: PDF, DOCX, PNG, JPG, TIFF
   - Continue only after at least one valid file is selected

4. **External Source**
   - Google Drive
   - SharePoint
   - OneDrive
   - Email Inbox
   - SFTP Server
   - Network Scanner

Also show AI processing mode:

- Balanced — recommended default
- Conservative
- Fast

### Source behavior

```ts
type RepositorySource =
  | { type: "employee_files" }
  | { type: "organizational_files"; folderIds?: string[] }
  | { type: "upload"; fileIds: string[] }
  | { type: "external"; connectionId: string; sourceType: ExternalSourceType };
```

The source count must be queried from the backend. Do not hardcode values such as 132 or 18.

### External connections

Each integration needs:

- connection status
- provider name
- connection owner
- last successful sync
- permission scope
- revoke/disconnect action
- error state

Do not silently connect accounts. OAuth permission screens and connection creation require explicit user action.

---

## 5. Step 2 — Scope

For Employee Files, provide these scope types:

- One employee
- Multiple employees
- Department
- Business unit
- Location
- Grade
- Employment type
- Entire company

All selector controls should support search, keyboard navigation, multi-select where applicable, and clear selected values.

### Scope model

```ts
type DatasetScope =
  | { type: "employee"; employeeIds: string[] }
  | { type: "department"; departmentIds: string[] }
  | { type: "business_unit"; businessUnitIds: string[] }
  | { type: "location"; locationIds: string[] }
  | { type: "grade"; gradeIds: string[] }
  | { type: "employment_type"; employmentTypes: string[] }
  | { type: "company"; companyId: string };
```

After selection, show an estimate:

- number of employees
- number of matching documents
- number of files excluded by status or permission

The scope must be re-evaluated before running because employee/document counts can change after the draft was created.

---

## 6. Organizational-file branch

When Organizational Files is selected, show a preview of available folders/documents.

Required capabilities:

- Folder list
- Folder name
- Description
- Document count
- Last modified date
- Search/filter
- Department filters
- Status filters
- Document type filter
- File type filter
- Upload date range
- Expiry date range
- Modified date range
- Tags
- Owner
- Uploaded by
- Save filter preset
- Reset filters
- Apply filters

The selected folder/document IDs become part of the dataset repository configuration.

---

## 7. Upload branch

The upload branch must support:

- Drag-and-drop
- File picker
- Multiple files
- File type validation
- File size validation
- Duplicate detection
- Upload progress
- Cancel upload
- Retry failed upload
- Remove file before continuing

The Next button must remain disabled until at least one valid upload is complete.

Files must be uploaded to private storage. The browser should receive signed upload URLs or use a secure backend upload endpoint.

---

## 8. Step 3 — Document Types

The user can either select registered document types or enable automatic classification.

### Automatic classification

When enabled:

1. Classify each document on arrival.
2. Match the classification to a registered document type.
3. Apply the default extraction profile for that type.
4. Route low-confidence classifications to review.

If automatic classification is disabled, the user must manually select one or more document types.

### Registered document types

The prototype includes types such as:

- Employment Contract
- CV / Resume
- Offer Letter
- Guarantor Form
- International Passport
- Driver’s License
- Professional Certificate
- Performance Review
- Training Certificate
- Academic Certificate
- Medical Certificate
- Warning Letter
- Promotion Letter
- Exit Interview

Each type displays its description and configured field count.

### Document type model

```ts
DocumentType {
  id: string;
  tenantId: string;
  name: string;
  abbreviation: string;
  description?: string;
  group: "employee" | "organizational";
  accentColor?: string;
  isSystem: boolean;
  isActive: boolean;
}
```

### Extraction profile model

```ts
ExtractionProfile {
  id: string;
  documentTypeId: string;
  name: string;
  description?: string;
  isDefault: boolean;
  version: number;
  status: "draft" | "active" | "archived";
}
```

The prototype shows profiles such as Standard Contract, Executive Contract, Intern Contract, Consultant Contract, and Promotion Letter.

The profile must be versioned. Existing extraction jobs must continue using the profile version that was selected when the job started.

### Create custom document type

The form contains:

- Document type name — required
- Abbreviation — required and unique within the tenant
- Description
- Document group
- Accent colour
- Profile variants, comma-separated or repeatable input
- Extraction fields

Do not allow Save & Select until the name and abbreviation are valid. A document type with zero extraction fields should either be blocked or explicitly marked as classification-only.

---

## 9. Step 4 — Business Fields

The user selects the fields to extract and confirms their data types.

### Supported types

- Text
- Number
- Date
- Currency
- Boolean
- ID
- Email
- Phone
- List

### Field model

```ts
ExtractionField {
  id: string;
  profileId: string;
  key: string;
  label: string;
  description?: string;
  dataType: FieldDataType;
  required: boolean;
  selected: boolean;
  order: number;
  validationConfig?: Record<string, unknown>;
}
```

Use stable keys such as `employee_id`, `start_date`, and `basic_salary`. Do not use display labels as database keys.

### Example fields

Employment Contract:

- Employee ID — ID — required
- Full Name — Text — required
- Job Title — Text
- Department — Text
- Employment Type — Text
- Start Date — Date — required
- Probation End Date — Date
- Notice Period Days — Number
- Basic Salary — Currency — required
- Benefits — Text
- Currency — Text

Promotion Letter:

- Employee ID — ID — required
- New Role — Text — required
- Effective Date — Date — required
- New Grade — Text
- New Salary — Currency
- Approved By — Text

### UI behavior

- Show selected/total field count.
- Support deselect all.
- Support pagination.
- Preserve selections when changing pages.
- Allow data type changes.
- Allow adding custom fields.
- Prevent duplicate field keys.
- Warn when changing the data type of an existing field.

Changing the schema after a dataset has run should create a new profile version rather than modifying historical results.

---

## 10. Step 5 — Validation Rules

### Always-on checks

1. All required fields are present.
2. Values match their configured data types and formats.

Examples:

- Date must parse into an accepted date format.
- Email must be valid.
- Currency must contain a numeric amount and currency code.
- Required IDs must not be empty.
- Lists must contain values from the allowed list when configured.

### Confidence presets

| Preset | Auto-approve threshold | Review threshold |
|---|---:|---:|
| Relaxed | 75% | 40% |
| Balanced | 85% | 50% |
| Strict | 92% | 65% |
| Custom | Admin-defined | Admin-defined |

Recommended default: Balanced.

```ts
ValidationPolicy {
  requiredFieldsEnabled: boolean;
  formatChecksEnabled: boolean;
  autoApproveThreshold: number;
  reviewThreshold: number;
}
```

### Result status rules

```ts
if (missingRequiredField || invalidFormat) {
  status = "needs_review";
} else if (confidence >= autoApproveThreshold) {
  status = "approved";
} else if (confidence < reviewThreshold) {
  status = "needs_review";
} else {
  status = "review";
}
```

The exact policy should be represented in tests because it controls compliance outcomes.

---

## 11. Step 6 — Preview and Run

The final screen summarizes:

- Dataset name
- Repository source
- Scope
- Selected document types
- Selected field count
- Confidence policy
- AI processing mode
- Estimated document count
- Estimated page count
- Estimated processing time
- Estimated AI cost
- Expected confidence

The final button is **Save and run extraction**.

Before running, the backend must recalculate the estimate and verify:

- User still has permission to process the selected documents.
- The selected document types still exist.
- Profiles are active.
- Required fields are valid.
- External connections are still active.
- Uploaded files finished processing.

If anything changed, show a confirmation/update message instead of silently starting with stale data.

---

## 12. Extraction pipeline

```text
Dataset run created
        ↓
Resolve repository and scope
        ↓
Create job-document records
        ↓
Download/read private source file
        ↓
Virus/file safety check
        ↓
Extract text or run OCR
        ↓
Classify document type
        ↓
Select extraction profile
        ↓
Extract structured fields
        ↓
Validate formats and required fields
        ↓
Calculate confidence/status
        ↓
Save evidence and results
        ↓
Create review items and alerts
```

Every stage must be resumable and observable.

### Processing statuses

```text
queued
downloading
virus_scanning
extracting_text
ocr_processing
classifying
extracting_fields
validating
completed
needs_review
failed
skipped
```

### Failure behavior

- Retry transient provider/network failures.
- Do not retry invalid files indefinitely.
- Mark unsupported formats clearly.
- Allow retrying one document or the failed subset.
- A single failed document must not fail the entire dataset job.
- Preserve the original error and provider request ID where safe.

---

## 13. AI extraction contract

The model should receive:

- Document text or structured page content
- Document type
- Extraction profile
- Field definitions
- Field descriptions and examples where available
- Output constraints

The response should contain:

```json
{
  "documentType": "employment_contract",
  "classificationConfidence": 0.96,
  "fields": {
    "employee_id": {
      "value": "EMP009",
      "confidence": 0.98,
      "source_page": 1,
      "source_text": "Employee ID: EMP009"
    },
    "start_date": {
      "value": "2021-03-15",
      "confidence": 0.94,
      "source_page": 2,
      "source_text": "Employment commenced on 15 March 2021"
    }
  },
  "warnings": []
}
```

Do not store only the final value. Store confidence, source page, source text, and review status for each field.

If using an LLM provider with structured JSON-schema output, generate the schema from the selected extraction fields. Keep the provider behind an internal adapter so the rest of the application does not depend directly on one vendor.

---

## 14. Human validation screen

The Validate area should allow a reviewer to:

- See the original document preview.
- Jump to the source page.
- See highlighted source evidence.
- Compare extracted value and source text.
- Edit a field.
- Approve a field.
- Reject a field.
- Approve the complete document.
- Reject the complete document.
- Add a reviewer comment.
- Escalate an issue.
- Re-run extraction after correcting configuration.

Reviewer edits must be audited:

```ts
ValidationReview {
  id: string;
  extractionResultId: string;
  reviewerId: string;
  action: "approve" | "reject" | "edit" | "escalate";
  fieldKey?: string;
  previousValue?: unknown;
  newValue?: unknown;
  comment?: string;
  createdAt: Date;
}
```

---

## 15. Suggested API surface

### Dataset drafts

```http
POST   /api/document-intelligence/datasets
GET    /api/document-intelligence/datasets/:id
PATCH  /api/document-intelligence/datasets/:id
DELETE /api/document-intelligence/datasets/:id
POST   /api/document-intelligence/datasets/:id/estimate
POST   /api/document-intelligence/datasets/:id/run
```

### Repository and scope

```http
GET /api/document-intelligence/repositories/counts
GET /api/document-intelligence/repositories/organizational-folders
GET /api/employees/search
GET /api/departments
GET /api/business-units
GET /api/locations
GET /api/grades
GET /api/employment-types
```

### Document types and fields

```http
GET  /api/document-intelligence/document-types
POST /api/document-intelligence/document-types
GET  /api/document-intelligence/document-types/:id/profiles
POST /api/document-intelligence/document-types/:id/profiles
POST /api/document-intelligence/profiles/:id/fields
PATCH /api/document-intelligence/fields/:id
```

### Jobs and results

```http
GET  /api/document-intelligence/jobs
GET  /api/document-intelligence/jobs/:id
POST /api/document-intelligence/jobs/:id/retry
GET  /api/document-intelligence/jobs/:id/results
GET  /api/document-intelligence/reviews
PATCH /api/document-intelligence/reviews/:id
```

### Integrations

```http
GET  /api/integrations/document-sources
POST /api/integrations/:provider/connect
POST /api/integrations/:id/sync
DELETE /api/integrations/:id
```

---

## 16. Minimum database model

```text
datasets
- id
- tenant_id
- name
- source_type
- processing_mode
- status
- created_by
- created_at
- updated_at

dataset_scopes
- id
- dataset_id
- scope_type
- scope_values_json

dataset_document_types
- dataset_id
- document_type_id
- profile_id

document_types
- id
- tenant_id
- name
- abbreviation
- description
- group
- is_system
- is_active

extraction_profiles
- id
- document_type_id
- name
- version
- is_default
- status

extraction_fields
- id
- profile_id
- key
- label
- data_type
- required
- order_index
- validation_config_json

validation_policies
- dataset_id
- required_fields_enabled
- format_checks_enabled
- auto_approve_threshold
- review_threshold

extraction_jobs
- id
- dataset_id
- status
- total_documents
- processed_documents
- succeeded_documents
- failed_documents
- needs_review_documents
- estimated_cost
- actual_cost
- started_at
- completed_at

extraction_results
- id
- job_id
- document_id
- classification
- classification_confidence
- status
- raw_response_json

extracted_fields
- id
- result_id
- field_key
- value_json
- confidence
- source_page
- source_text
- status

audit_logs
- id
- tenant_id
- actor_id
- action
- entity_type
- entity_id
- metadata_json
- created_at
```

---

## 17. Security and privacy requirements

HR documents may contain identity, medical, financial, and employment information.

Required controls:

- Tenant isolation on every query.
- Permission checks before document retrieval and AI processing.
- Private object storage.
- Encryption in transit and at rest.
- Signed URLs with short expiration.
- Virus scanning for uploaded files.
- Audit log for viewing, downloading, extracting, editing, approving, and deleting.
- No API keys in frontend code.
- No sensitive document text in ordinary application logs.
- Configurable retention and deletion policies.
- Explicit provider data-retention configuration.
- Redaction where a use case does not require the full document.
- Rate limits and job quotas per tenant.

The AI retrieval/chat layer must never bypass the normal document-permission system.

---

## 18. Cursor AI implementation instructions

Use this order when implementing:

1. Inspect the existing project structure, routing, authentication, database, and document models.
2. Reuse existing design tokens, layout components, table components, buttons, modals, form controls, and notification patterns.
3. Build the dataset draft state model first.
4. Implement the six-step wizard using reusable step components.
5. Implement repository branches independently.
6. Add backend persistence before adding AI calls.
7. Add document-type/profile/field configuration.
8. Add validation policy and deterministic validators.
9. Add job creation and queue processing.
10. Add OCR/AI provider adapter.
11. Add validation/review UI.
12. Add authorization and audit logging.
13. Add tests for every branch and failed state.

Do not:

- Hardcode demo counts.
- Put extraction logic directly in React components.
- Call an AI provider from the browser.
- Store only unstructured AI text.
- Treat AI output as automatically correct.
- Allow users to run stale dataset drafts without re-estimation.
- Delete or overwrite historical extraction results when a profile changes.

---

## 19. Acceptance criteria

### Wizard

- User can save a partial draft and resume it.
- User cannot continue without required selections.
- Back navigation preserves all selections.
- Refreshing the page does not lose a saved draft.
- Each repository branch displays the correct next step.
- Counts and estimates come from the backend.

### Document types and fields

- User can select multiple registered document types.
- Each selected type can use a different profile.
- User can create a custom document type.
- User can add custom fields.
- Field keys are unique and stable.
- Field selections survive pagination.

### Extraction

- Job runs asynchronously.
- Job progress is visible.
- Failed documents can be retried independently.
- Results contain structured values, confidence, evidence, and status.
- Low-confidence or invalid results enter the review queue.

### Security

- Unauthorized users cannot retrieve or process documents.
- All result edits are auditable.
- Provider/API credentials never reach the browser.
- Sensitive content is not written to ordinary logs.

### Review

- Reviewer can see source evidence for every extracted value.
- Reviewer can edit and approve fields.
- Reviewer actions are logged.
- Approved human corrections are distinguishable from AI output.

---

## 20. Suggested delivery phases

### Phase 1 — Wizard foundation

- Dataset drafts
- Six-step navigation
- Repository/source selection
- Scope selection
- Document-type selection
- Field configuration
- Validation policy
- Preview/estimate

### Phase 2 — Processing foundation

- Private file storage
- OCR/text extraction
- Background jobs
- Job progress
- Failure/retry handling

### Phase 3 — AI extraction

- Classification
- Profile-driven structured extraction
- Confidence scoring
- Evidence capture
- Result persistence

### Phase 4 — Human validation

- Review queue
- Document viewer
- Evidence highlighting
- Field approval/editing
- Audit logs

### Phase 5 — Integrations and intelligence

- External source connectors
- Semantic search/RAG
- Ask & Insights
- Alerts for expiry/missing documents
- Analytics and accuracy reporting

Estimated effort for this feature:

- UI-only prototype: 1–2 weeks
- Functional MVP: 4–6 weeks
- Production-grade system: 7–10 weeks

---

## 21. Short Cursor kickoff prompt

```text
Build the CleonHR Document Intelligence Dataset and Extraction Wizard from the attached specification.

First inspect the existing project architecture, authentication, document models, database, routing, design system, and reusable components. Do not create duplicate primitives.

Implement a persisted six-step dataset draft flow:
1. Repository
2. Scope
3. Document Types
4. Business Fields
5. Validation Rules
6. Preview and Run

Support repository branches for Employee Files, Organizational Files, Upload Documents, and External Sources. Use a schema-driven configuration for document types, extraction profiles, fields, data types, validation policies, and job statuses.

Do not hardcode demo counts or call an AI provider from the browser. Create a backend provider adapter and asynchronous job model. Every extracted field must store value, confidence, source page, source text, and review status. Enforce tenant permissions before retrieval or processing. Add deterministic required-field and format validation, human review, retries, audit logging, and tests for all wizard branches.

Before writing implementation code, summarize the existing architecture, identify reusable components, list files you intend to change, and flag any missing backend or storage dependencies.
```


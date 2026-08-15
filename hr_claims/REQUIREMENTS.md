# HR Claims — Requirements and Implementation Plan

## 1. Scope and prototype inventory

This module implements the claims-management portion of the published Figma prototype at <https://stamp-menus-90926699.figma.site/> for Odoo 17 Community Edition.

The prototype was reviewed in both Admin and Employee modes. The claims-specific screens and states inspected were:

- Admin and employee dashboards.
- Admin Claims Data in table, compact, and kanban modes, including expandable claim details.
- Employee My Claims list and the four-step New Expense Claim flow: Type & Details, Line Items, Receipts, Review.
- Claim Types/Categories and the seven-step claim-type setup flow.
- Claim Windows and Claim Type Assignments.
- Workflow queues: pending, approved, rejected, claim review drawer, return, approve, and reject actions.
- Payment queue, batch-processing summary, and payment history.
- Financial Reports, Claims Reports, Approval Analytics, and Activity Log.
- Teams > Roles & Permissions. This page is the source of truth for security.

The same prototype also contains requests, cash advances, petty cash, vendors, accounts, budgets, and general team administration. Those are contextual adjacent products, not `hr_claims` models. They are deliberately not duplicated in this module. Claims retain extension-friendly fields for payment and accounting references, but do not depend on Enterprise Accounting.

## 2. Data model

### `hr.claim.category`

Groups claim types into tabs/categories such as Travel, Logistics, Training, Medical, Operations, and Office.

- `name`, `code`, `description`, `sequence`, `active`, `color`.
- `company_id` for multi-company separation.
- One-to-many `claim_type_ids`.

### `hr.claim.type`

Configures the rules employees see when starting a claim.

- Identity: `name`, `code`, `category_id`, `description`, `internal_notes`, `active`, `company_id`.
- Amount calculation: `amount_type` (`fixed` or `open`), `fixed_amount`, `minimum_amount`, `maximum_amount`.
- Reimbursement: `reimbursable`, default `payment_method` (`bank`, `payroll`, `cheque`, `card`, `cash`).
- Eligibility: `eligibility` (`all` or `restricted`), `employee_ids`, `department_ids`.
- Documentation: `receipt_policy` (`required`, `conditional`, `optional`, `none`) and `receipt_threshold`.
- Approval: `approval_type` retained as a Community-safe configuration value; version 1 executes a single Manager/Admin decision while preserving the prototype's multi-level options for later extension.
- Finance metadata: `gl_account_code` as a plain posting-code reference. It intentionally does not depend on Enterprise Accounting.
- Controls: `submission_window_days`, `maximum_per_claim`, `window_ids`.

### `hr.claim.window`

Reusable time-rule templates shown in the prototype's Claim Windows library.

- `name`, `window_type` (`submission`, `approval`, `payment`, `cutoff`), `duration_days`, `active`.
- Optional `start_date`, `end_date`, `description`, `company_id`.
- Many-to-many relationship with claim types.

### `hr.claim`

The claim header and workflow record. It inherits `mail.thread` and `mail.activity.mixin`.

- Identity: sequence-backed `name` (`CLM/YYYY/NNNNN`), `title`, `description`.
- Ownership: `employee_id`, related `department_id`, `company_id`, `currency_id`.
- Classification: `claim_type_id`, `money_type` (`personal`, `company`, `hybrid`), `reimbursement_method`.
- Period: `expense_start_date`, `expense_end_date`, `submitted_date`.
- Detail: `line_ids`, computed `amount_total`, `attachment_ids`, computed attachment count.
- Workflow: `state`, `approval_comment`, `rejection_reason`, `return_reason`, `approved_by_id`, `approved_date`, `paid_date`.
- Finance: one-to-many `payment_ids`, computed `amount_paid` and `payment_state`.
- Audit: one-to-many `audit_ids`; chatter tracks important fields and messages.

### `hr.claim.line`

Expense items entered in step 2 of the employee flow.

- `claim_id`, `sequence`, `description`, `category`, `amount`, `expense_date`, `receipt_reference`.
- `currency_id` related from the claim.
- SQL/Python validation prevents negative amounts.

### `hr.claim.payment`

Community-safe reimbursement register used for the Finance payment queue and history.

- Sequence-backed `name` (`PAY/YYYY/NNNNN`), `claim_id`, related employee/company/currency.
- `amount`, `payment_method`, `payment_date`, `reference`, `notes`.
- `state` (`draft`, `completed`, `cancelled`), `processed_by_id`.
- Confirming a payment marks the claim paid once its approved total has been covered.

### `hr.claim.audit`

Immutable functional audit entries created by claim/payment workflow methods.

- `claim_id`, `action`, `description`, `user_id`, `date`, `company_id`.
- Read from the Audit menu by Administrators only.
- Chatter remains the human conversation/history; this model powers the structured Activity Log.

### Transient wizards

- `hr.claim.reject.wizard`: mandatory reason for Reject or Return for correction.
- `hr.claim.payment.wizard`: Finance/Admin registration of an approved claim payment.

## 3. Workflow and state machine

```text
Draft ──Submit──> Submitted ──Approve──> Approved ──Pay in full──> Paid
  │                   │   │
  │                   │   ├──Reject──> Rejected
  │                   │   └──Return───> Returned ──Correct & Resubmit──> Submitted
  └──Withdraw/Cancel──┴───────────────────────────────────────────────> Cancelled
```

Rules:

- Employees create and edit only their own Draft/Returned claims.
- Submit validates employee ownership, at least one positive line, period order, claim-type min/max limits, active submission windows, eligibility, and receipt rules.
- Manager or Admin approves, rejects, or returns Submitted claims. Reject/Return requires a reason.
- Finance or Admin registers payments only for Approved claims. Partial payments are supported; full coverage moves the claim to Paid.
- Paid claims cannot be edited or returned through normal UI actions.
- Withdraw is available to the owner while Submitted; Cancel is available while Draft/Returned.
- Every transition creates an audit entry and chatter message.

## 4. Views and navigation

### Dashboard (OWL client action)

- Role-aware KPI cards: total claims, submitted/pending review, approved awaiting payment, paid, rejected, and total/approved/paid value.
- Pending approval/payment queue summaries for privileged roles.
- Recent claims table with direct drill-down.
- Chart.js charts: claim status distribution (doughnut), monthly submitted/approved/paid value trend (line), and spend by department (bar).
- Employee data is restricted by the same server-side security rules, so employees see only their claims.

### Claims

- List view with reference, employee, type, amount, state, submitted and approval/payment dates; decorations make states scannable.
- Form view with header workflow buttons/statusbar, employee/period/detail fields, editable line items, receipts, approval/finance information, audit history, and chatter.
- Kanban grouped visually by workflow state.
- Search view with My Claims, Draft, Submitted, Approved, Paid, Rejected, type, employee, department, date, and state groupings.
- Graph and pivot views for reports and ad-hoc analysis.

### Configuration

- Categories list/form.
- Claim Types list/form containing the seven prototype configuration areas as notebook pages.
- Claim Windows list/form and type assignment from the claim-type form.
- Configuration menus are Admin-only; other roles receive read access to active types/windows needed to create and review claims.

### Workflow

- Pending Approvals action filtered to Submitted claims for Manager/Admin.
- Approved and Rejected saved actions.
- Claim form/drawer equivalent provides Details, Line Items, Approval History/Audit, receipts, and actions.

### Payments

- Payment Queue action filtered to Approved claims for Finance/Admin.
- Payment History list/form and registration wizard.
- Employee can read payments linked to own claims; only Finance/Admin processes them.

### Audit

- Admin-only timeline/list of claim transition and payment events with action filters.

### Reports

- OWL dashboard charts plus native graph/pivot actions.
- Claims by status/type/department and amount over time.
- Manager, Finance, and Admin can view reports; Finance/Admin can export using standard Odoo list/pivot export permissions.

## 5. Roles and access rules

The prototype's **Teams > Roles & Permissions** page defines four system roles. The following mapping is authoritative.

| Prototype role | Prototype permissions | Odoo group and enforcement |
|---|---|---|
| Employee | Submit Claims; View Own Claims; Create Requests | **Claims / Employee**. Create/read own claims, write/delete only own editable claims, read own payments, read active types/windows. Requests are outside this module. |
| Manager | Approve Claims; Reject Claims; View Reports; Manage Team; View All Claims | **Claims / Manager**, implies Employee. Read all company claims; approve/reject/return; use claim reports. Team administration continues to use Odoo HR groups and is not reimplemented here. |
| Finance | Process Payments; View All Claims; Generate Reports; View Reports | **Claims / Finance**, implies Employee. Read all company claims, read lines/receipts, create/confirm payment records, use/export reports; cannot approve/reject. |
| Admin | Full System Access; User Management; Settings; Audit Trail Access | **Claims / Administrator**, implies Manager and Finance. Full module CRUD, configuration, workflow, payment, and audit access. General Odoo user management remains governed by Odoo Administration Settings. |

All persistent records have a global allowed-company rule. Employee own-record rules use `employee_id.user_id = user.id`. Manager/Finance/Admin group rules widen claim visibility to allowed companies. Workflow methods also check groups server-side; hiding buttons is not the security boundary.

## 6. Dashboard/chart definitions

- **Status Distribution:** count of claims by Draft, Submitted, Returned, Approved, Rejected, Paid, Cancelled.
- **Monthly Trend:** monthly amount submitted, approved, and paid for the most recent six months.
- **Spend by Department:** approved plus paid claim amount grouped by employee department; top departments by value.
- **Approval KPIs:** approval rate, rejection rate, current pending queue, total approved value, average age of pending claims.
- **Payment KPIs:** approved payable count/value, overdue count/value using seven days as the prototype threshold, average days from approval to payment.

## 7. Assumptions and open questions

1. The prototype is an entire expense ERP, while the requested deliverable is `hr_claims`. Requests, advances, petty cash, vendors, budgets, and general accounting are treated as integrations/future modules, not duplicated here.
2. On the Admin Claims Data screen, **Create Claim** opens the seven-step **Create New Claim Type** flow. This is treated as a prototype label/wiring defect; Odoo exposes separate New Claim and New Claim Type actions.
3. Prototype statuses mix `Pending`, `Pending Approval`, and `Submitted`. They are normalized to one `submitted` state displayed as **Submitted**.
4. The review drawer includes **Return** and employee messages mention **Pending Employee Response**. This is implemented as `returned`, editable by the employee and resubmittable.
5. Approval configuration advertises multi-level sequential/parallel/conditional routing but no authoritative approver-building behavior is shown. Version 1 stores the choice but executes the Roles-page-authorized Manager/Admin approval step.
6. Receipt examples conflict: Mileage says no receipt in the Claim Types cards, while the employee wizard says original receipts are required over ₦10,000. Claim-type receipt policy is authoritative; conditional threshold defaults to ₦10,000 when selected.
7. Claim windows appear both as duration templates and dated windows. Both are supported; dated boundaries take precedence, otherwise submission-age days are applied.
8. The prototype displays Naira. The implementation uses each company currency and formats it through Odoo; it works for NGN without hard-coding it.
9. Employee bank details are shown in the payment queue but no Community `hr.employee` bank field is guaranteed. Payment reference/method are stored without introducing payroll/accounting dependencies; bank-master integration is deferred.
10. Corporate Card Claim is non-reimbursable in one card but appears in approval workflow. Non-reimbursable claims can be approved for audit but are excluded from the payment queue.
11. Attachments use Odoo `ir.attachment`/chatter rather than a second document store. File-type/size enforcement follows Odoo server limits; the prototype's 10 MB and HEIC language is advisory.
12. A user without a linked `hr.employee` cannot create an employee claim; Admin can assign the employee explicitly.

## 8. Implementation phases

1. **Requirements and checkpoint foundation**
   - Requirements, assumptions, state machine, role map, implementation plan, and `PROGRESS.md`.
2. **Data model, security, and workflow**
   - Models, sequences, groups, ACLs, record rules, validation, transitions, audit, payment/rejection wizards, and seed categories/types.
3. **Core Odoo views**
   - Claims list/form/kanban/search/graph/pivot, configuration, approvals, payments, audit, actions, and menus.
4. **OWL dashboard and charts**
   - Role-aware server payload, KPI cards, Chart.js charts, drill-downs, and Bootstrap/Odoo styling.
5. **Verification and polish**
   - Clean install/upgrade, automated model workflow tests, view/assets checks, manual role/workflow checklist, fixes, documentation, and final review.

## 9. Manual test checklist

The result of each test is recorded in `FINAL_REVIEW.md`.

- [ ] Install `hr_claims` on a clean Odoo 17 Community database without traceback.
- [ ] Employee creates a Draft claim with multiple lines and saves it.
- [ ] Employee submits a valid claim; state, submission date, audit, and chatter update.
- [ ] Invalid empty, over-limit, ineligible, outside-window, and missing-required-receipt claims are blocked.
- [ ] Employee sees only own claims/payments; cannot read another employee's claim directly.
- [ ] Manager sees all allowed-company claims and approves a Submitted claim.
- [ ] Manager rejects a Submitted claim only with a reason.
- [ ] Manager returns a claim; employee edits and resubmits it.
- [ ] Finance sees approved reimbursable claims and cannot approve/reject.
- [ ] Finance registers a partial payment, then completes payment; claim becomes Paid only when covered.
- [ ] Employee can withdraw a Submitted claim and cancel a Draft/Returned claim.
- [ ] Dashboard KPIs and all three charts load with live data and respect employee visibility.
- [ ] Native graph/pivot reports render and privileged roles can open them.
- [ ] Admin can maintain categories, types, windows, assignments, and view audit events.
- [ ] Multi-company rules prevent cross-company visibility.


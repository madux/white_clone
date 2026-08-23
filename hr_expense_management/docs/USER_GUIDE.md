# User guide

## Open the application

Open **Expense Management** from the Odoo app menu. The sidebar shows only the
areas available to your role and active company.

Use the page search for current records. Use **Advanced View** when you need a
native Odoo form or a detailed administrative action.

## Employee tasks

### Submit a claim

1. Open **Claims → Claims Data**.
2. Select **New Claim**.
3. Enter the claim details and expense lines.
4. Attach receipts where required.
5. Review and submit the claim.

A returned claim can be corrected and resubmitted. A rejected claim can be
appealed when company policy permits it.

### Submit a request

Use **Requests** for approval before spending. Some request types create a cash
advance after approval.

### Retire an advance

Open **Advances → Retirement** to review the outstanding amount and submit the
retirement reference. Finance completes the accounting action.

## Manager tasks

Open **Workflow → Pending** to review claims and requests assigned to you.

- **Approve** moves the record to the next approval level or completes review.
- **Return** sends the record back for correction.
- **Reject** closes the current submission and requires a reason.

Lines with the same approval sequence are parallel approvals. Every line in
that level must be approved before the next level begins.

## Finance tasks

- **Payments**: validate and process individual or batch reimbursements.
- **Advances**: issue, retire, age, or request a write-off.
- **Petty Cash**: manage funds, transactions, reconciliation, and replenishment.
- **Accounts**: review expense mappings and generated Odoo journal entries.
- **Vendors**: maintain expense vendors, terms, and categories.
- **Budget**: review commitments, actuals, availability, and variance.

Posted journal entries and completed payments are not editable through normal
workflows.

## Record states

| State | Meaning |
|---|---|
| Draft | Editable and not submitted |
| Submitted / Pending | Waiting for review |
| Returned | Requires correction |
| Approved | Review complete; may be ready for payment or issue |
| Paid / Retired / Posted | Financial workflow completed |
| Rejected / Cancelled | Workflow closed without completion |

## Attachments and exports

Receipts accept images and PDF files. Access follows the parent record's Odoo
permissions. CSV export includes the records currently visible after search
and filtering.

# -*- coding: utf-8 -*-
from odoo import fields, models, _


ISSUE_CLASSIFICATIONS = [
    ("inactive", "Inactive"),
    ("test_employee", "Test Employee"),
    ("manually_excluded", "Manually Excluded"),
    ("initialization_failed", "Initialization Failed"),
    ("unresolved_data", "Unresolved Data Issue"),
]

ISSUE_CATEGORIES = [("all", "All")] + ISSUE_CLASSIFICATIONS

CLASSIFICATION_LABELS = dict(ISSUE_CLASSIFICATIONS)

# Legacy issue categories stored before classification refresh (read-only compat).
LEGACY_ISSUE_CATEGORY_SELECTION = [
    ("no_department", "No Department"),
    ("incomplete_record", "Incomplete Records"),
    ("unmatched_document", "Unmatched Documents"),
    ("init_failed", "Initialization Failure"),
    ("sync_failed", "Synchronization Failure"),
    ("pending_classification", "Pending Classification"),
    ("integration_failed", "Integration Failed"),
    ("duplicate_document", "Duplicate Document"),
    ("upload_failed", "Document Upload Failed"),
    ("processing_failed", "Document Processing Failed"),
]

LEGACY_CATEGORY_TO_CLASSIFICATION = {
    "no_department": "unresolved_data",
    "incomplete_record": "unresolved_data",
    "unmatched_document": "unresolved_data",
    "init_failed": "initialization_failed",
    "sync_failed": "unresolved_data",
    "pending_classification": "unresolved_data",
    "integration_failed": "unresolved_data",
    "duplicate_document": "unresolved_data",
    "upload_failed": "unresolved_data",
    "processing_failed": "unresolved_data",
}

EXCLUSION_REASON_TO_CLASSIFICATION = {
    "inactive": "inactive",
    "test_employee": "test_employee",
    "manual": "manually_excluded",
    "init_failed": "initialization_failed",
    "unresolved_data": "unresolved_data",
    "awaiting_processing": "unresolved_data",
}

ISSUE_TAXONOMY = [
    ("init_failed", "Employee File Initialization Failed"),
    ("employee_not_found", "Employee Not Found in EMS"),
    ("no_org_attribute", "No Department/Organizational Attribute Assigned"),
    ("incomplete_ems", "Incomplete EMS Record"),
    ("upload_failed", "Document Upload Failed"),
    ("processing_failed", "Document Processing Failed"),
    ("unmatched_document", "Unmatched Document"),
    ("integration_failed", "Integration Failed"),
    ("duplicate_document", "Duplicate Document Detected"),
    ("sync_failed", "Synchronization Failed"),
    ("pending_classification", "Pending Classification"),
]

ISSUE_TYPE_LABELS = dict(ISSUE_TAXONOMY)

ISSUE_TYPE_DEFAULTS = {
    "init_failed": {
        "category": "initialization_failed",
        "recommended_action": "retry",
        "recoverable": True,
    },
    "sync_failed": {
        "category": "unresolved_data",
        "recommended_action": "sync_now",
        "recoverable": True,
    },
    "integration_failed": {
        "category": "unresolved_data",
        "recommended_action": "retry",
        "recoverable": True,
    },
    "duplicate_document": {
        "category": "unresolved_data",
        "recommended_action": "resolve",
        "recoverable": True,
    },
    "upload_failed": {
        "category": "unresolved_data",
        "recommended_action": "retry",
        "recoverable": True,
    },
    "processing_failed": {
        "category": "unresolved_data",
        "recommended_action": "retry",
        "recoverable": True,
    },
    "unmatched_document": {
        "category": "unresolved_data",
        "recommended_action": "retry",
        "recoverable": True,
    },
    "no_org_attribute": {
        "category": "unresolved_data",
        "recommended_action": "view_in_ems",
        "recoverable": False,
    },
}


def issue_type_label(issue_type):
    return ISSUE_TYPE_LABELS.get(issue_type, issue_type or "")


def hr_details_for_issue_type(issue_type, module_name=None):
    """Plain-language issue text for HR (no raw stack traces)."""
    if issue_type == "duplicate_document":
        return _(
            "This document appears to duplicate an existing record on the employee file. "
            "Review the existing file or upload a new version instead of creating a duplicate."
        )
    if issue_type == "sync_failed":
        return _(
            "Employee Files could not sync this employee's groups or folder membership from EMS. "
            "Correct the employee record in EMS, then use Sync Now or Retry."
        )
    if issue_type == "integration_failed":
        if module_name:
            return _(
                "The %(module)s integration is unavailable or returned an error while collecting "
                "documents. Ensure the module is installed and enabled, then retry.",
                module=module_name,
            )
        return _(
            "A required integration for document collection is unavailable or returned an error. "
            "Contact your administrator, then retry."
        )
    if issue_type == "upload_failed":
        return _("The document could not be uploaded to the employee file. Try again or contact support.")
    if issue_type == "processing_failed":
        return _("The document was uploaded but could not be processed for the employee file. Try Retry.")
    if issue_type == "unmatched_document":
        return _("The document could not be matched or linked to this employee file. Try Retry after reviewing the file.")
    if issue_type == "init_failed":
        return _("Employee file initialization failed. Retry after correcting EMS or configuration issues.")
    return _("An error occurred. Use the recommended action or contact your administrator.")

EXCLUSION_REASONS = [
    ("inactive", "Inactive (per configuration)"),
    ("test_employee", "Test employee (per configuration)"),
    ("manual", "Manually excluded"),
    ("init_failed", "Initialization failed"),
    ("awaiting_processing", "Awaiting processing"),
    ("unresolved_data", "Unresolved data issue"),
]


def normalize_issue_classification(category):
    if category in CLASSIFICATION_LABELS:
        return category
    return LEGACY_CATEGORY_TO_CLASSIFICATION.get(category, "unresolved_data")


def classification_label(classification_key):
    return CLASSIFICATION_LABELS.get(classification_key, classification_key)


class DocEmployeeIssue(models.Model):
    _name = "doc.employee.issue"
    _description = "Employee Files issue / exception (EF-B)"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    name = fields.Char(required=True)
    category = fields.Selection(
        ISSUE_CLASSIFICATIONS + LEGACY_ISSUE_CATEGORY_SELECTION,
        required=True,
        index=True,
    )
    issue_type = fields.Selection(ISSUE_TAXONOMY, required=True, index=True)
    details = fields.Text()
    state = fields.Selection(
        [("open", "Open"), ("resolved", "Resolved")],
        default="open",
        index=True,
    )
    recoverable = fields.Boolean(default=True)
    recommended_action = fields.Selection(
        [
            ("view_in_ems", "View in EMS"),
            ("retry", "Retry"),
            ("resolve", "Resolve"),
            ("sync_now", "Sync Now"),
        ],
        default="retry",
    )
    retry_count = fields.Integer(default=0)
    employee_id = fields.Many2one("hr.employee", index=True)
    employee_file_id = fields.Many2one("doc.employee.file", index=True)
    document_id = fields.Many2one("doc.document", index=True)
    setup_run_id = fields.Many2one("doc.employee.setup.run", index=True)

    def serialize_for_api(self):
        self.ensure_one()
        classification = normalize_issue_classification(self.category)
        return {
            "id": self.id,
            "source": "issue",
            "name": self.name,
            "category": classification,
            "classification": classification,
            "classification_label": classification_label(classification),
            "issue_type": self.issue_type,
            "issue_type_label": issue_type_label(self.issue_type),
            "details": self.details or "",
            "state": self.state,
            "recoverable": self.recoverable,
            "recommended_action": self.recommended_action,
            "retry_count": self.retry_count,
            "employee_id": self.employee_id.id if self.employee_id else False,
            "employee_name": self.employee_id.name if self.employee_id else "",
            "employee_file_id": self.employee_file_id.id if self.employee_file_id else False,
            "document_id": self.document_id.id if self.document_id else False,
            "date_identified": fields.Datetime.to_string(self.create_date),
        }


class DocEmployeeExclusion(models.Model):
    _name = "doc.employee.exclusion"
    _description = "Employee Files inclusion exclusion (EF-A7)"
    _order = "create_date desc"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    employee_id = fields.Many2one("hr.employee", required=True, index=True)
    reason = fields.Selection(EXCLUSION_REASONS, required=True, index=True)
    justification = fields.Text()
    configured_by_id = fields.Many2one("res.users")
    recoverable = fields.Boolean(default=True)
    active = fields.Boolean(default=True)

    def serialize_for_api(self):
        self.ensure_one()
        employee = self.employee_id
        classification = EXCLUSION_REASON_TO_CLASSIFICATION.get(
            self.reason, "unresolved_data"
        )
        return {
            "id": self.id,
            "employee_id": employee.id,
            "employee_name": employee.name,
            "department_name": employee.department_id.name if employee.department_id else "",
            "reason": self.reason,
            "justification": self.justification or "",
            "configured_by": self.configured_by_id.name if self.configured_by_id else "",
            "recoverable": self.recoverable,
            "date_identified": fields.Datetime.to_string(self.create_date),
            "status": "recoverable" if self.recoverable else "permanent",
            "classification": classification,
            "classification_label": classification_label(classification),
        }

# -*- coding: utf-8 -*-
import json
import logging
import re
import threading

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError

from .employee_issue import (
    CLASSIFICATION_LABELS,
    EXCLUSION_REASON_TO_CLASSIFICATION,
    ISSUE_CATEGORIES,
    ISSUE_TYPE_DEFAULTS,
    classification_label,
    hr_details_for_issue_type,
    normalize_issue_classification,
)
from .employee_setup import SETUP_STAGES

_logger = logging.getLogger(__name__)

SETUP_PROGRESS_BATCH = 25

# EF-D1 / EF-F1: configurable employee file header fields (hr.employee keys).
HEADER_FIELD_CATALOG = [
    {"key": "employee_id", "label": "Employee ID", "ems_managed": True},
    {"key": "name", "label": "Full name", "ems_managed": True},
    {"key": "department_id", "label": "Department", "ems_managed": True},
    {"key": "job_id", "label": "Position", "ems_managed": True},
    {"key": "work_location", "label": "Location", "ems_managed": True},
    {"key": "branch", "label": "Branch", "ems_managed": True},
    {"key": "grade", "label": "Grade / level", "ems_managed": True},
    {"key": "employment_type", "label": "Employment type", "ems_managed": True},
    {"key": "status", "label": "Status", "ems_managed": True},
    {"key": "work_email", "label": "Work email", "ems_managed": True},
    {"key": "work_phone", "label": "Work phone", "ems_managed": True},
]


class _EmployeeFilesPreviewConfig:
    """Wizard overlay for setup preview (avoid record.new() / missing company context)."""

    def __init__(self, config, wizard_values=None):
        wizard_values = dict(wizard_values or {})
        self.company_id = config.company_id or config.env.company
        if "organizing_dimensions" in wizard_values:
            self._dimensions = [d for d in wizard_values["organizing_dimensions"] if d]
        else:
            self._dimensions = config.get_organizing_dimensions()
        self.primary_organizing_dimension = (
            self._dimensions[0] if self._dimensions else config.primary_organizing_dimension
        )
        self.sub_organizing_dimension = wizard_values.get(
            "sub_organizing_dimension", config.sub_organizing_dimension or "none"
        )
        self.include_inactive = wizard_values.get(
            "include_inactive", config.include_inactive
        )
        self.exclude_test_employees = wizard_values.get(
            "exclude_test_employees", config.exclude_test_employees
        )
        self.collect_existing_documents = wizard_values.get(
            "collect_existing_documents", config.collect_existing_documents
        )

    def get_organizing_dimensions(self):
        return list(self._dimensions)


def _run_setup_in_background(db_name, uid, run_id, company_id):
    """Execute setup in a worker thread so the HTTP request can return while stages progress."""
    from odoo.modules.registry import Registry

    reg = Registry(db_name)
    with reg.cursor() as cr:
        env = api.Environment(cr, uid, {})
        run = env["doc.employee.setup.run"].browse(run_id)
        config = env["doc.employee.files.config"].get_for_company(
            env["res.company"].browse(company_id)
        )
        try:
            env["doc.employee.files.service"]._execute_setup_run(run, config)
            cr.commit()
        except Exception:
            _logger.exception("Employee Files setup run %s failed", run_id)
            cr.rollback()
            with reg.cursor() as cr2:
                env2 = api.Environment(cr2, uid, {})
                failed_run = env2["doc.employee.setup.run"].browse(run_id)
                failed_run.write({"state": "failed"})
                for stage in failed_run.stage_ids.filtered(
                    lambda s: s.status == "in_progress"
                ):
                    stage.write({"status": "failed"})
                cr2.commit()


class DocEmployeeFilesService(models.AbstractModel):
    _name = "doc.employee.files.service"
    _description = "Employee Files v3 orchestration"

    # --- EMS helpers ---

    @api.model
    def _employee_domain(self, company):
        company = company or self.env.company
        company_ids = [company.id]
        if getattr(company, "child_ids", None):
            company_ids.extend(company.child_ids.ids)
        return [
            "|",
            ("company_id", "=", False),
            ("company_id", "in", company_ids),
        ]

    @api.model
    def _is_test_employee(self, employee):
        if hasattr(employee, "is_test_employee"):
            return bool(employee.is_test_employee)
        if hasattr(employee, "test_employee"):
            return bool(employee.test_employee)
        return False

    @api.model
    def _dimension_value(self, employee, dimension):
        if dimension == "department":
            dep = employee.department_id
            return (str(dep.id), dep.name or _("No department")) if dep else (False, False)
        if dimension == "branch" and hasattr(employee, "branch_id"):
            branch = employee.branch_id
            return (str(branch.id), branch.name) if branch else (False, False)
        if dimension == "grade" and hasattr(employee, "grade_id"):
            grade = employee.grade_id
            return (str(grade.id), grade.name) if grade else (False, False)
        if dimension == "employment_type":
            et = getattr(employee, "employment_type_id", False) or getattr(
                employee, "employee_type_id", False
            )
            return (str(et.id), et.name) if et else (False, False)
        if dimension == "work_location":
            loc = getattr(employee, "work_location_id", False) or getattr(
                employee, "address_id", False
            )
            return (str(loc.id), loc.name) if loc else (False, False)
        if dimension == "status":
            status = "inactive" if not employee.active else "active"
            return (status, status.title())
        return (False, False)

    @api.model
    def _eligible_employees(self, config):
        company = config.company_id or self.env.company
        Employee = self.env["hr.employee"].sudo().with_company(company)
        if config.include_inactive:
            Employee = Employee.with_context(active_test=False)
        domain = self._employee_domain(company)
        if not config.include_inactive:
            domain.append(("active", "=", True))
        employees = Employee.search(domain)
        Exclusion = self.env["doc.employee.exclusion"].sudo()
        manual_excluded = set(
            Exclusion.search(
                [
                    ("company_id", "=", config.company_id.id),
                    ("active", "=", True),
                    ("reason", "=", "manual"),
                ]
            ).mapped("employee_id").ids
        )
        included = []
        excluded_counts = {
            "inactive": 0,
            "test_employee": 0,
            "manual": 0,
        }
        for employee in employees:
            if employee.id in manual_excluded:
                excluded_counts["manual"] += 1
                continue
            if config.exclude_test_employees and self._is_test_employee(employee):
                excluded_counts["test_employee"] += 1
                continue
            if not config.include_inactive and not employee.active:
                excluded_counts["inactive"] += 1
                continue
            included.append(employee)
        return included, excluded_counts

    CONFIG_DRIVEN_EXCLUSION_REASONS = ("inactive", "test_employee")
    DOCUMENT_LINK_ISSUE_TYPES = (
        "unmatched_document",
        "upload_failed",
        "processing_failed",
        "duplicate_document",
    )
    SYNC_ISSUE_TYPES = ("sync_failed",)
    INTEGRATION_ISSUE_TYPES = ("integration_failed",)
    EF_DOCUMENT_RECONCILE_CTX = "skip_ef_document_reconcile"

    @api.model
    def _has_manual_exclusion(self, employee, config):
        return bool(
            self.env["doc.employee.exclusion"]
            .sudo()
            .search(
                [
                    ("company_id", "=", config.company_id.id),
                    ("employee_id", "=", employee.id),
                    ("reason", "=", "manual"),
                    ("active", "=", True),
                ],
                limit=1,
            )
        )

    @api.model
    def _config_exclusion_reasons(self, employee, config):
        reasons = set()
        if not config.include_inactive and not employee.active:
            reasons.add("inactive")
        if config.exclude_test_employees and self._is_test_employee(employee):
            reasons.add("test_employee")
        return reasons

    @api.model
    def _is_ef_eligible(self, employee, config):
        if self._has_manual_exclusion(employee, config):
            return False
        if self._config_exclusion_reasons(employee, config):
            return False
        return True

    @api.model
    def _sync_config_exclusions(self, employee, config):
        Exclusion = self.env["doc.employee.exclusion"].sudo()
        company_id = config.company_id.id
        desired = self._config_exclusion_reasons(employee, config)
        auto_note = _("Maintained automatically from inclusion settings.")
        for reason in self.CONFIG_DRIVEN_EXCLUSION_REASONS:
            domain = [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("reason", "=", reason),
            ]
            active_row = Exclusion.search(domain + [("active", "=", True)], limit=1)
            inactive_row = Exclusion.search(domain + [("active", "=", False)], limit=1)
            if reason in desired:
                if active_row:
                    continue
                if inactive_row:
                    inactive_row.write(
                        {
                            "active": True,
                            "justification": auto_note,
                            "configured_by_id": False,
                        }
                    )
                else:
                    Exclusion.create(
                        {
                            "company_id": company_id,
                            "employee_id": employee.id,
                            "reason": reason,
                            "justification": auto_note,
                            "configured_by_id": False,
                        }
                    )
            elif active_row:
                active_row.write({"active": False})

    @api.model
    def _primary_organizing_dimension(self, config):
        dimensions = config.get_organizing_dimensions()
        if not dimensions:
            return False
        return config.primary_organizing_dimension or dimensions[0]

    @api.model
    def _sub_organizing_dimension(self, config):
        sub = config.sub_organizing_dimension or "none"
        if sub == "none":
            return False
        return sub

    @api.model
    def _nested_primary_groups(self, config):
        primary = self._primary_organizing_dimension(config)
        sub = self._sub_organizing_dimension(config)
        if not primary or not sub or sub == primary:
            return False
        return True

    @api.model
    def _nested_child_dimension_value_key(self, parent_key, sub_key):
        return "%s::%s" % (parent_key, sub_key)

    @api.model
    def _preview_config(self, config, wizard_values=None, persist=False):
        """Apply wizard overrides for preview; optionally persist to the stored config."""
        wizard_values = dict(wizard_values or {})
        overrides = {}
        for key in (
            "include_all_existing",
            "include_inactive",
            "exclude_test_employees",
            "collect_existing_documents",
            "primary_organizing_dimension",
            "sub_organizing_dimension",
        ):
            if key in wizard_values:
                overrides[key] = wizard_values[key]
        if "organizing_dimensions" in wizard_values:
            dims = [d for d in wizard_values["organizing_dimensions"] if d]
            overrides["organizing_dimension_ids"] = json.dumps(dims)
            overrides["primary_organizing_dimension"] = dims[0] if dims else False
        if persist:
            if "organizing_dimensions" in wizard_values:
                config.set_organizing_dimensions(wizard_values["organizing_dimensions"])
            if overrides:
                config.write(overrides)
            return config
        if not overrides:
            return config
        return config.new(overrides)

    @api.model
    def _ensure_system_managed_group(
        self,
        company_id,
        dimension,
        value_key,
        label,
        parent_group=False,
    ):
        Group = self.env["doc.employee.group"].sudo()
        domain = [
            ("company_id", "=", company_id),
            ("group_kind", "=", "system_managed"),
            ("organizing_dimension", "=", dimension),
            ("dimension_value_key", "=", value_key),
            ("parent_group_id", "=", parent_group.id if parent_group else False),
        ]
        group = Group.search(domain, limit=1)
        if not group:
            group = Group.create(
                {
                    "name": label,
                    "group_kind": "system_managed",
                    "company_id": company_id,
                    "organizing_dimension": dimension,
                    "dimension_value_key": value_key,
                    "parent_group_id": parent_group.id if parent_group else False,
                }
            )
        elif label and group.name != label:
            group.write({"name": label})
        return group

    @api.model
    def _open_org_attribute_issue(
        self, employee, employee_file, config, setup_run_id=False
    ):
        primary = self._primary_organizing_dimension(config)
        if not primary:
            return False
        key, _label = self._dimension_value(employee, primary)
        if key:
            return False
        Issue = self.env["doc.employee.issue"].sudo()
        existing = Issue.search(
            [
                ("company_id", "=", config.company_id.id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "no_org_attribute"),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        if existing:
            return False
        vals = {
            "company_id": config.company_id.id,
            "name": _("No organizational attribute: %s") % employee.name,
            "category": "unresolved_data",
            "issue_type": "no_org_attribute",
            "details": _("Assign the organizing attribute in EMS."),
            "employee_id": employee.id,
            "employee_file_id": employee_file.id if employee_file else False,
            "recoverable": False,
            "recommended_action": "view_in_ems",
        }
        if setup_run_id:
            vals["setup_run_id"] = setup_run_id
        Issue.create(vals)
        return True

    @api.model
    def _resolve_org_attribute_issues(self, employee, company_id):
        Issue = self.env["doc.employee.issue"].sudo()
        open_issues = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "no_org_attribute"),
                ("state", "=", "open"),
            ]
        )
        if open_issues:
            open_issues.write({"state": "resolved"})

    @api.model
    def _open_init_failed_issue(self, employee, config, error, setup_run_id=False):
        Issue = self.env["doc.employee.issue"].sudo()
        existing = Issue.search(
            [
                ("company_id", "=", config.company_id.id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "init_failed"),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        if existing:
            existing.write(
                {"details": hr_details_for_issue_type("init_failed")}
            )
            return existing
        defaults = ISSUE_TYPE_DEFAULTS["init_failed"]
        vals = {
            "company_id": config.company_id.id,
            "name": _("Initialization failed: %s") % employee.name,
            "category": defaults["category"],
            "issue_type": "init_failed",
            "details": hr_details_for_issue_type("init_failed"),
            "employee_id": employee.id,
            "recoverable": defaults["recoverable"],
            "recommended_action": defaults["recommended_action"],
        }
        if setup_run_id:
            vals["setup_run_id"] = setup_run_id
        return Issue.create(vals)

    @api.model
    def _resolve_init_failed_issues(self, employee, company_id):
        Issue = self.env["doc.employee.issue"].sudo()
        open_issues = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "init_failed"),
                ("state", "=", "open"),
            ]
        )
        if open_issues:
            open_issues.write({"state": "resolved"})

    @api.model
    def _wind_down_excluded_employee(self, employee, config):
        company_id = config.company_id.id
        self._resolve_org_attribute_issues(employee, company_id)
        EmployeeFile = self.env["doc.employee.file"].sudo()
        employee_file = EmployeeFile.search(
            [
                ("employee_id", "=", employee.id),
                ("company_id", "=", company_id),
            ],
            limit=1,
        )
        if not employee_file:
            return
        employee_file.write({"state": "inactive"})
        Group = self.env["doc.employee.group"].sudo()
        system_groups = Group.search(
            [
                ("company_id", "=", company_id),
                ("group_kind", "=", "system_managed"),
                ("member_ids", "in", employee_file.id),
            ]
        )
        for group in system_groups:
            group.write({"member_ids": [(3, employee_file.id)]})

    @api.model
    def reconcile_employee_from_ems(self, employee):
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete:
            return
        self._sync_config_exclusions(employee, config)
        if not self._is_ef_eligible(employee, config):
            self._wind_down_excluded_employee(employee, config)
            return

        company_id = config.company_id.id
        try:
            employee_file = self._ensure_employee_file(employee, sync_groups=False)
            if employee_file:
                employee_file._ensure_storage_folder()
        except Exception as error:
            _logger.exception(
                "Employee file init failed during EMS reconcile for %s", employee.id
            )
            self._open_init_failed_issue(employee, config, error)
            return

        if not employee_file:
            return

        self._resolve_init_failed_issues(employee, company_id)
        primary = self._primary_organizing_dimension(config)
        if primary:
            key, _label = self._dimension_value(employee, primary)
            if key:
                self._resolve_org_attribute_issues(employee, company_id)
            else:
                self._open_org_attribute_issue(employee, employee_file, config)
        employee_file.write(
            {"state": "active" if employee.active else "inactive"}
        )
        try:
            self.sync_employee_system_groups(employee, employee_file)
            self._resolve_sync_failed_issues(employee, company_id)
        except Exception as error:
            _logger.exception(
                "Employee Files sync failed during EMS reconcile for %s",
                employee.id,
            )
            self._open_sync_failed_issue(
                employee, config, error, employee_file=employee_file
            )

    @api.model
    def reconcile_all_employees_from_ems(self, company=None):
        company = company or self.env.company
        config = self.env["doc.employee.files.config"].get_for_company(company)
        if not config.setup_complete:
            return
        employees = self.env["hr.employee"].sudo().search(
            self._employee_domain(company)
        )
        for employee in employees:
            self.reconcile_employee_from_ems(employee)
        self._cleanup_obsolete_system_groups(config)

    @api.model
    def _cleanup_obsolete_system_groups(self, config):
        """Remove system-managed groups that no longer match organizing config."""
        company_id = config.company_id.id
        Group = self.env["doc.employee.group"].sudo()
        allowed_dims = set(config.get_organizing_dimensions())
        nested = self._nested_primary_groups(config)
        sub = self._sub_organizing_dimension(config)

        groups = Group.search(
            [
                ("company_id", "=", company_id),
                ("group_kind", "=", "system_managed"),
            ]
        )
        obsolete = Group.browse()
        for group in groups:
            dim = group.organizing_dimension
            if dim not in allowed_dims:
                obsolete |= group
                continue
            if nested and sub and dim == sub and not group.parent_group_id:
                obsolete |= group
                continue
            if group.parent_group_id:
                if not nested or dim != sub:
                    obsolete |= group

        if not obsolete:
            return

        for group in obsolete:
            if group.member_ids:
                group.write({"member_ids": [(5, 0, 0)]})
        obsolete_ids = obsolete.ids
        children = obsolete.filtered("parent_group_id")
        if children:
            children.unlink()
        root_obsolete = Group.search(
            [("id", "in", obsolete_ids), ("parent_group_id", "=", False)]
        )
        for group in root_obsolete:
            if not group.child_ids:
                group.unlink()

    @api.model
    def _integration_module_name_from_error(self, error):
        message = str(error or "")
        if isinstance(error, ImportError):
            return error.name or _("required integration")
        for token in ("cleon_", "hr_", "doc."):
            if token in message:
                fragment = message.split(token, 1)[-1].split()[0].split("'")[0]
                return token.rstrip(".") + fragment.split(".")[0]
        if "module" in message.lower():
            return _("connected module")
        return _("Document Management")

    @api.model
    def _classify_document_link_issue_type(self, document, employee_file, error):
        if (
            employee_file
            and document.employee_file_id
            and document.employee_file_id != employee_file
        ):
            return "duplicate_document"
        text = str(error or "").lower()
        if any(
            marker in text
            for marker in ("duplicate", "unique", "already exists", "already linked")
        ):
            return "duplicate_document"
        if any(marker in text for marker in ("upload", "attachment", "mimetype")):
            return "upload_failed"
        if any(
            marker in text
            for marker in ("process", "index", "ocr", "extract", "classif")
        ):
            return "processing_failed"
        return "unmatched_document"

    @api.model
    def _document_link_issue_title(self, issue_type, document):
        titles = {
            "duplicate_document": _("Duplicate document: %s"),
            "upload_failed": _("Document upload failed: %s"),
            "processing_failed": _("Document processing failed: %s"),
            "unmatched_document": _("Unmatched document: %s"),
        }
        template = titles.get(issue_type, _("Document issue: %s"))
        return template % document.name

    @api.model
    def _open_sync_failed_issue(
        self, employee, config, error, employee_file=False, setup_run_id=False
    ):
        Issue = self.env["doc.employee.issue"].sudo()
        company_id = config.company_id.id
        existing = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "sync_failed"),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        defaults = ISSUE_TYPE_DEFAULTS["sync_failed"]
        details = hr_details_for_issue_type("sync_failed")
        if existing:
            existing.write({"details": details})
            return existing
        vals = {
            "company_id": company_id,
            "name": _("Synchronization failed: %s") % employee.name,
            "category": defaults["category"],
            "issue_type": "sync_failed",
            "details": details,
            "employee_id": employee.id,
            "employee_file_id": employee_file.id if employee_file else False,
            "recoverable": defaults["recoverable"],
            "recommended_action": defaults["recommended_action"],
        }
        if setup_run_id:
            vals["setup_run_id"] = setup_run_id
        _logger.warning(
            "Sync failed for employee %s: %s", employee.id, error
        )
        return Issue.create(vals)

    @api.model
    def _resolve_sync_failed_issues(self, employee, company_id):
        Issue = self.env["doc.employee.issue"].sudo()
        open_issues = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "sync_failed"),
                ("state", "=", "open"),
            ]
        )
        if open_issues:
            open_issues.write({"state": "resolved"})

    @api.model
    def _open_integration_failed_issue(
        self,
        employee,
        config,
        error,
        module_name=None,
        employee_file=False,
        setup_run_id=False,
    ):
        Issue = self.env["doc.employee.issue"].sudo()
        company_id = config.company_id.id
        module_name = module_name or self._integration_module_name_from_error(error)
        existing = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "integration_failed"),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        defaults = ISSUE_TYPE_DEFAULTS["integration_failed"]
        details = hr_details_for_issue_type(
            "integration_failed", module_name=module_name
        )
        if existing:
            existing.write({"details": details})
            return existing
        vals = {
            "company_id": company_id,
            "name": _("Integration failed: %s") % employee.name,
            "category": defaults["category"],
            "issue_type": "integration_failed",
            "details": details,
            "employee_id": employee.id,
            "employee_file_id": employee_file.id if employee_file else False,
            "recoverable": defaults["recoverable"],
            "recommended_action": defaults["recommended_action"],
        }
        if setup_run_id:
            vals["setup_run_id"] = setup_run_id
        _logger.warning(
            "Integration failed for employee %s (%s): %s",
            employee.id,
            module_name,
            error,
        )
        return Issue.create(vals)

    @api.model
    def _resolve_integration_failed_issues(self, employee, company_id):
        Issue = self.env["doc.employee.issue"].sudo()
        open_issues = Issue.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("issue_type", "=", "integration_failed"),
                ("state", "=", "open"),
            ]
        )
        if open_issues:
            open_issues.write({"state": "resolved"})

    @api.model
    def _open_document_link_issue(
        self,
        document,
        employee,
        employee_file,
        error,
        setup_run_id=False,
        issue_type=None,
    ):
        Issue = self.env["doc.employee.issue"].sudo()
        company_id = employee.company_id.id
        issue_type = issue_type or self._classify_document_link_issue_type(
            document, employee_file, error
        )
        if issue_type not in self.DOCUMENT_LINK_ISSUE_TYPES:
            issue_type = "unmatched_document"
        existing = Issue.search(
            [
                ("company_id", "=", company_id),
                ("document_id", "=", document.id),
                ("issue_type", "=", issue_type),
                ("state", "=", "open"),
            ],
            limit=1,
        )
        defaults = ISSUE_TYPE_DEFAULTS.get(
            issue_type, ISSUE_TYPE_DEFAULTS["unmatched_document"]
        )
        details = hr_details_for_issue_type(issue_type)
        if existing:
            existing.write({"details": details})
            return existing
        vals = {
            "company_id": company_id,
            "name": self._document_link_issue_title(issue_type, document),
            "category": defaults["category"],
            "issue_type": issue_type,
            "details": details,
            "employee_id": employee.id,
            "employee_file_id": employee_file.id if employee_file else False,
            "document_id": document.id,
            "recoverable": defaults["recoverable"],
            "recommended_action": defaults["recommended_action"],
        }
        if setup_run_id:
            vals["setup_run_id"] = setup_run_id
        _logger.warning(
            "Document link issue (%s) for doc %s: %s",
            issue_type,
            document.id,
            error,
        )
        return Issue.create(vals)

    @api.model
    def _resolve_document_link_issues(self, document):
        Issue = self.env["doc.employee.issue"].sudo()
        open_issues = Issue.search(
            [
                ("document_id", "=", document.id),
                ("issue_type", "in", list(self.DOCUMENT_LINK_ISSUE_TYPES)),
                ("state", "=", "open"),
            ]
        )
        if open_issues:
            open_issues.write({"state": "resolved"})

    @api.model
    def _link_document_to_employee_file(
        self, document, employee_file, setup_run_id=False
    ):
        employee = document.employee_id
        if not employee or not employee_file:
            return False
        if (
            document.employee_file_id
            and document.employee_file_id != employee_file
        ):
            self._open_document_link_issue(
                document,
                employee,
                employee_file,
                _("Document is already linked to another employee file."),
                setup_run_id=setup_run_id,
                issue_type="duplicate_document",
            )
            return False
        try:
            vals = {"employee_file_id": employee_file.id}
            if employee_file.storage_folder_id:
                vals["folder_id"] = employee_file.storage_folder_id.id
            document.with_context(
                **{self.EF_DOCUMENT_RECONCILE_CTX: True}
            ).sudo().write(vals)
            self._resolve_document_link_issues(document)
            return True
        except Exception as error:
            _logger.exception(
                "Document link failed for doc %s employee file %s",
                document.id,
                employee_file.id,
            )
            self._open_document_link_issue(
                document,
                employee,
                employee_file,
                error,
                setup_run_id=setup_run_id,
            )
            return False

    @api.model
    def _collect_employee_documents_into_file(
        self, employee, employee_file, config, setup_run_id=False
    ):
        """Link existing EMS documents into the employee file (setup / retry)."""
        Document = self.env["doc.document"].sudo()
        try:
            docs = Document.search(
                [
                    ("employee_id", "=", employee.id),
                    ("active", "=", True),
                ]
            )
        except Exception as error:
            self._open_integration_failed_issue(
                employee,
                config,
                error,
                employee_file=employee_file,
                setup_run_id=setup_run_id,
            )
            return 0, 1
        linked = 0
        attention = 0
        for doc in docs:
            try:
                if self._link_document_to_employee_file(
                    doc, employee_file, setup_run_id=setup_run_id
                ):
                    linked += 1
                else:
                    attention += 1
            except Exception as error:
                _logger.exception(
                    "Document collection failed for employee %s doc %s",
                    employee.id,
                    doc.id,
                )
                module_name = self._integration_module_name_from_error(error)
                self._open_integration_failed_issue(
                    employee,
                    config,
                    error,
                    module_name=module_name,
                    employee_file=employee_file,
                    setup_run_id=setup_run_id,
                )
                attention += 1
        if linked and not attention:
            self._resolve_integration_failed_issues(
                employee, config.company_id.id
            )
        return linked, attention

    @api.model
    def reconcile_document_employee_file(self, document):
        document = document.exists()
        if not document or not document.active or not document.employee_id:
            return
        employee = document.employee_id
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete or not self._is_ef_eligible(employee, config):
            return
        employee_file = document.employee_file_id
        if not employee_file:
            employee_file = self.env["doc.employee.file"].sudo().search(
                [
                    ("employee_id", "=", employee.id),
                    ("company_id", "=", employee.company_id.id),
                ],
                limit=1,
            )
        if not employee_file:
            return
        if (
            document.employee_file_id == employee_file
            and document.folder_id == employee_file.storage_folder_id
        ):
            self._resolve_document_link_issues(document)
            return
        self._link_document_to_employee_file(document, employee_file)

    @api.model
    def reconcile_all_documents_for_company(self, company=None):
        company = company or self.env.company
        config = self.env["doc.employee.files.config"].get_for_company(company)
        if not config.setup_complete:
            return
        documents = self.env["doc.document"].sudo().search(
            [
                ("employee_id.company_id", "=", company.id),
                ("employee_id", "!=", False),
                ("active", "=", True),
            ]
        )
        for document in documents:
            self.reconcile_document_employee_file(document)

    @api.model
    def cron_reconcile_all_companies(self):
        Config = self.env["doc.employee.files.config"].sudo()
        for config in Config.search([("setup_complete", "=", True)]):
            company = config.company_id
            service = self.with_company(company)
            service.reconcile_all_employees_from_ems(company)
            service.reconcile_all_documents_for_company(company)

    @api.model
    def _preview_group_buckets(self, included, dimension, primary, sub, nested_primary):
        group_keys = {}
        missing_primary = 0
        for employee in included:
            if nested_primary and dimension == primary:
                parent_key, parent_label = self._dimension_value(employee, primary)
                if not parent_key:
                    missing_primary += 1
                    continue
                sub_key, sub_label = self._dimension_value(employee, sub)
                bucket_key = parent_key
                bucket_name = parent_label
                if sub_key:
                    bucket_key = self._nested_child_dimension_value_key(
                        parent_key, sub_key
                    )
                    bucket_name = "%s · %s" % (parent_label, sub_label)
                group_keys.setdefault(
                    bucket_key, {"name": bucket_name, "employees": 0, "documents": 0}
                )
                group_keys[bucket_key]["employees"] += 1
            else:
                key, label = self._dimension_value(employee, dimension)
                if not key:
                    if dimension == primary:
                        missing_primary += 1
                    continue
                group_keys.setdefault(key, {"name": label, "employees": 0, "documents": 0})
                group_keys[key]["employees"] += 1

        Document = self.env["doc.document"].sudo()
        for key, bucket in group_keys.items():
            if nested_primary and dimension == primary and "::" in key:
                parent_key, sub_key = key.split("::", 1)
                emp_ids = [
                    e.id
                    for e in included
                    if self._dimension_value(e, primary)[0] == parent_key
                    and self._dimension_value(e, sub)[0] == sub_key
                ]
            elif nested_primary and dimension == primary:
                emp_ids = [
                    e.id
                    for e in included
                    if self._dimension_value(e, primary)[0] == key
                    and not self._dimension_value(e, sub)[0]
                ]
            else:
                emp_ids = [
                    e.id
                    for e in included
                    if self._dimension_value(e, dimension)[0] == key
                ]
            bucket["documents"] = Document.search_count(
                [("employee_id", "in", emp_ids), ("active", "=", True)]
            )
        return group_keys, missing_primary

    @api.model
    def setup_preview(self, wizard_values=None, persist=False):
        config = self.env["doc.employee.files.config"].get_for_company()
        wizard_values = dict(wizard_values or {})
        if persist:
            self._preview_config(config, wizard_values, persist=True)
            preview_config = config
        else:
            preview_config = _EmployeeFilesPreviewConfig(config, wizard_values)

        dimensions = preview_config.get_organizing_dimensions()
        if not dimensions:
            raise UserError(_("Select at least one organizing dimension."))

        company = preview_config.company_id or self.env.company
        ems_employees_in_company = self.env["hr.employee"].sudo().with_company(
            company
        ).search_count(self._employee_domain(company))

        included, excluded_counts = self._eligible_employees(preview_config)
        primary = self._primary_organizing_dimension(preview_config)
        sub = self._sub_organizing_dimension(preview_config)
        nested_primary = self._nested_primary_groups(preview_config)

        dimension_summaries = []
        total_groups = 0
        need_attention_expected = 0
        for dimension in dimensions:
            buckets, missing = self._preview_group_buckets(
                included,
                dimension,
                primary,
                sub,
                nested_primary,
            )
            if dimension == primary:
                need_attention_expected = missing
            total_groups += len(buckets)
            dimension_summaries.append(
                {
                    "dimension": dimension,
                    "groups_to_create": len(buckets),
                    "group_breakdown": [
                        {
                            "name": data["name"],
                            "employees": data["employees"],
                            "documents": data["documents"],
                            "excluded": 0,
                        }
                        for data in buckets.values()
                    ],
                }
            )

        primary_buckets, _missing = self._preview_group_buckets(
            included, primary, primary, sub, nested_primary
        )
        doc_count = 0
        if preview_config.collect_existing_documents:
            doc_count = self.env["doc.document"].sudo().search_count(
                [
                    ("employee_id", "in", [e.id for e in included]),
                    ("active", "=", True),
                ]
            )

        total_excluded = sum(excluded_counts.values())
        return {
            "organizing_dimensions": dimensions,
            "sub_organizing_dimension": preview_config.sub_organizing_dimension
            or "none",
            "primary_organizing_dimension": primary or "",
            "nested_primary_view": bool(nested_primary),
            "groups_to_create": total_groups,
            "employees_included": len(included),
            "ems_employees_in_company": ems_employees_in_company,
            "documents_expected": doc_count,
            "need_attention_expected": need_attention_expected,
            "excluded_total": total_excluded,
            "excluded_breakdown": excluded_counts,
            "dimension_summaries": dimension_summaries,
            "group_breakdown": [
                {
                    "name": data["name"],
                    "employees": data["employees"],
                    "documents": data["documents"],
                    "excluded": 0,
                }
                for data in primary_buckets.values()
            ],
        }

    @api.model
    def setup_confirm(self, wizard_values=None):
        if not self.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            raise AccessError(_("Employee Files setup requires document administrator access."))

        config = self.env["doc.employee.files.config"].get_for_company()
        preview = self.setup_preview(wizard_values, persist=True)
        config.write(
            {
                "setup_complete": False,
                "primary_organizing_dimension": preview["organizing_dimensions"][0],
            }
        )

        run = self.env["doc.employee.setup.run"].sudo().create(
            {
                "company_id": config.company_id.id,
                "state": "running",
                "config_snapshot": json.dumps(config.serialize_for_api()),
            }
        )
        seq = 10
        for stage_key, label in SETUP_STAGES:
            self.env["doc.employee.setup.stage"].sudo().create(
                {
                    "run_id": run.id,
                    "sequence": seq,
                    "stage_key": stage_key,
                    "label": label,
                    "status": "pending",
                }
            )
            seq += 10

        self.env.cr.commit()
        threading.Thread(
            target=_run_setup_in_background,
            args=(self.env.cr.dbname, self.env.uid, run.id, config.company_id.id),
            daemon=True,
        ).start()
        return run

    @api.model
    def _execute_setup_run(self, run, config):
        Issue = self.env["doc.employee.issue"].sudo()
        stages = {s.stage_key: s for s in run.stage_ids}

        def _commit_progress():
            if not self.env.context.get("test_mode"):
                self.env.cr.commit()

        def _stage(key, total=0):
            stage = stages.get(key)
            if stage:
                stage.write(
                    {
                        "status": "in_progress",
                        "total_count": total or stage.total_count,
                    }
                )
                _commit_progress()

        def _stage_progress(key, done, total):
            stage = stages.get(key)
            if stage:
                stage.write(
                    {
                        "status": "in_progress",
                        "done_count": done,
                        "total_count": total,
                    }
                )
                _commit_progress()

        def _stage_done(key, done, total=None):
            stage = stages.get(key)
            if stage:
                vals = {"status": "completed", "done_count": done}
                if total is not None:
                    vals["total_count"] = total
                stage.write(vals)
                _commit_progress()

        included, _excluded = self._eligible_employees(config)
        run.write({"employees_found": len(included)})
        _stage("connect_ems", 1)
        _stage_done("connect_ems", 1, 1)

        _stage("read_employees", len(included))
        _stage_done("read_employees", len(included), len(included))

        dimensions = config.get_organizing_dimensions()
        primary = dimensions[0]
        EmployeeFile = self.env["doc.employee.file"].sudo()
        initialized = 0
        collected = 0
        attention = 0

        _stage("create_files", len(included))
        for index, employee in enumerate(included, start=1):
            try:
                employee_file = EmployeeFile.search(
                    [
                        ("employee_id", "=", employee.id),
                        ("company_id", "=", config.company_id.id),
                    ],
                    limit=1,
                )
                if not employee_file:
                    employee_file = EmployeeFile.create(
                        {
                            "employee_id": employee.id,
                            "company_id": config.company_id.id,
                            "state": "active" if employee.active else "inactive",
                        }
                    )
                employee_file._ensure_storage_folder()
                initialized += 1
            except Exception as error:
                _logger.exception("Employee file init failed for %s", employee.id)
                attention += 1
                self._open_init_failed_issue(
                    employee, config, error, setup_run_id=run.id
                )
            if index % SETUP_PROGRESS_BATCH == 0 or index == len(included):
                _stage_progress("create_files", initialized, len(included))
        _stage_done("create_files", initialized, len(included))

        organize_total = len(included)
        dim_labels = {
            "department": _("Department"),
            "branch": _("Branch"),
            "grade": _("Grade"),
            "employment_type": _("Employment type"),
            "work_location": _("Work location"),
            "status": _("Status"),
        }
        organize_stage = stages.get("organize_groups")
        if organize_stage and primary:
            organize_stage.write(
                {
                    "label": _("Organizing by %s")
                    % dim_labels.get(primary, primary.replace("_", " ").title()),
                }
            )
            _commit_progress()
        _stage("organize_groups", organize_total)
        organized = 0
        for index, employee in enumerate(included, start=1):
            employee_file = EmployeeFile.search(
                [
                    ("employee_id", "=", employee.id),
                    ("company_id", "=", config.company_id.id),
                ],
                limit=1,
            )
            if not employee_file:
                continue
            primary_key, _label = self._dimension_value(employee, primary)
            if not primary_key:
                if self._open_org_attribute_issue(
                    employee,
                    employee_file,
                    config,
                    setup_run_id=run.id,
                ):
                    attention += 1
            self.with_context(employee_files_allow_group_sync=True).sync_employee_system_groups(
                employee, employee_file
            )
            organized += 1
            if index % SETUP_PROGRESS_BATCH == 0 or index == len(included):
                _stage_progress("organize_groups", organized, organize_total)
        _stage_done("organize_groups", organized, organize_total)

        if config.collect_existing_documents:
            _stage("collect_documents", len(included))
            for doc_index, employee in enumerate(included, start=1):
                employee_file = EmployeeFile.search(
                    [
                        ("employee_id", "=", employee.id),
                        ("company_id", "=", config.company_id.id),
                    ],
                    limit=1,
                )
                if not employee_file:
                    continue
                linked, failed = self._collect_employee_documents_into_file(
                    employee,
                    employee_file,
                    config,
                    setup_run_id=run.id,
                )
                collected += linked
                attention += failed
                if doc_index % SETUP_PROGRESS_BATCH == 0 or doc_index == len(included):
                    _stage_progress("collect_documents", doc_index, len(included))
            _stage_done("collect_documents", len(included), len(included))
        else:
            stage = stages.get("collect_documents")
            if stage:
                stage.write(
                    {
                        "status": "completed",
                        "done_count": 0,
                        "total_count": 0,
                        "label": _("Collecting existing documents (skipped)"),
                    }
                )
                _commit_progress()

        _stage("finalize", 1)
        config.write({"setup_complete": True})
        self.with_company(config.company_id).reconcile_all_employees_from_ems(
            config.company_id
        )
        run.write(
            {
                "state": "done",
                "files_initialized": initialized,
                "files_fully_loaded": initialized,
                "documents_collected": collected,
                "need_attention": attention,
            }
        )
        _stage_done("finalize", 1, 1)

        from ..controllers.onboarding_state import arm_module

        initiator = run.create_uid
        if initiator:
            initiator.sudo().write(
                {
                    "document_onboarding_state": arm_module(
                        initiator.document_onboarding_state, "employee_files"
                    )
                }
            )
            _commit_progress()
        return run

    @api.model
    def home_stats(self):
        config = self.env["doc.employee.files.config"].get_for_company()
        company = config.company_id
        ems_count = self.env["hr.employee"].sudo().search_count(
            self._employee_domain(company)
        )
        exclusion_count = self.env["doc.employee.exclusion"].sudo().search_count(
            [
                ("company_id", "=", company.id),
                ("active", "=", True),
            ]
        )
        initialized = self.env["doc.employee.file"].sudo().search_count(
            [("company_id", "=", company.id)]
        )
        need_attention = self.reconciliation_total()
        expected = max(ems_count - exclusion_count, 0)
        return {
            "setup_complete": config.setup_complete,
            "ems_employees": ems_count,
            "configured_exclusions": exclusion_count,
            "expected_employee_files": expected,
            "employee_files_initialized": initialized,
            "successfully_synced": max(initialized - need_attention, 0),
            "processing": 0,
            "needs_attention": need_attention,
            "excluded": exclusion_count,
        }

    @api.model
    def list_groups(
        self,
        group_kind=None,
        dimension=None,
        search=None,
        for_home=False,
        include_all_custom=False,
    ):
        Group = self.env["doc.employee.group"]
        config = self.env["doc.employee.files.config"].get_for_company()
        company = config.company_id or self.env.company
        base = [("company_id", "=", company.id), ("active", "=", True)]

        if for_home:
            system_domain = base + [("group_kind", "=", "system_managed")]
            if dimension:
                primary = self._primary_organizing_dimension(config)
                nested = self._nested_primary_groups(config)
                if nested and dimension == primary:
                    sub = self._sub_organizing_dimension(config)
                    parents = Group.search(
                        system_domain
                        + [
                            ("organizing_dimension", "=", dimension),
                            ("parent_group_id", "=", False),
                        ]
                    )
                    child_domain = base + [
                        ("group_kind", "=", "system_managed"),
                        ("parent_group_id", "in", parents.ids),
                    ]
                    if sub:
                        child_domain.append(("organizing_dimension", "=", sub))
                    children = Group.search(child_domain)
                    groups = parents | children
                else:
                    groups = Group.search(
                        system_domain
                        + [
                            ("organizing_dimension", "=", dimension),
                            ("parent_group_id", "=", False),
                        ]
                    )
            else:
                groups = Group.search(system_domain)
            if config.enable_custom_groups:
                custom = Group.search(
                    base
                    + [
                        ("group_kind", "=", "custom"),
                        ("show_on_home", "=", True),
                    ]
                )
                groups = groups | custom
        else:
            domain = list(base)
            if group_kind:
                domain.append(("group_kind", "=", group_kind))
            if dimension:
                domain.append(("organizing_dimension", "=", dimension))
            if group_kind == "custom" and not include_all_custom:
                domain.append(("show_on_home", "=", True))
            groups = Group.search(domain)

        if search:
            needle = search.lower()
            groups = groups.filtered(lambda g: needle in (g.name or "").lower())
        if not config.show_inactive_groups:
            groups = groups.filtered(lambda g: g.employee_count > 0)
        return groups

    @api.model
    def _employee_file_search_domain(self, search=None):
        domain = [("company_id", "=", self.env.company.id)]
        needle = (search or "").strip()
        if needle:
            domain += [
                "|",
                "|",
                "|",
                ("employee_id.name", "ilike", needle),
                ("employee_id.barcode", "ilike", needle),
                ("employee_id.work_email", "ilike", needle),
                ("employee_id.identification_id", "ilike", needle),
            ]
        return domain

    @api.model
    def list_employee_files(self, search=None, limit=10, offset=0):
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        domain = self._employee_file_search_domain(search)
        EmployeeFile = self.env["doc.employee.file"]
        total = EmployeeFile.search_count(domain)
        files = EmployeeFile.search(
            domain, limit=limit, offset=offset, order="employee_id"
        )
        return files, total

    @api.model
    def list_group_members(self, group_id, search=None, limit=10, offset=0):
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        group = self.env["doc.employee.group"].browse(int(group_id)).exists()
        if not group or group.company_id != self.env.company:
            return self.env["doc.employee.file"], 0
        domain = [("id", "in", group.member_ids.ids)]
        needle = (search or "").strip()
        if needle:
            domain += [
                "|",
                "|",
                "|",
                ("employee_id.name", "ilike", needle),
                ("employee_id.barcode", "ilike", needle),
                ("employee_id.work_email", "ilike", needle),
                ("employee_id.identification_id", "ilike", needle),
            ]
        EmployeeFile = self.env["doc.employee.file"]
        total = EmployeeFile.search_count(domain)
        files = EmployeeFile.search(
            domain, limit=limit, offset=offset, order="employee_id"
        )
        return files, total

    @api.model
    def global_search(self, query, scope="all", limit=50):
        query = (query or "").strip()
        if not query:
            return {"employees": [], "documents": []}
        EmployeeFile = self.env["doc.employee.file"]
        Document = self.env["doc.document"]
        employees = []
        documents = []
        if scope in ("all", "employees"):
            files = EmployeeFile.search(
                [
                    ("company_id", "=", self.env.company.id),
                    "|",
                    ("employee_id.name", "ilike", query),
                    ("employee_id.identification_id", "ilike", query),
                ],
                limit=limit,
            )
            employees = [f.serialize_for_api() for f in files]
        if scope in ("all", "documents"):
            docs = Document.search(
                [
                    ("employee_id.company_id", "=", self.env.company.id),
                    "|",
                    ("name", "ilike", query),
                    ("document_type_id.name", "ilike", query),
                ],
                limit=limit,
            )
            documents = [
                {
                    "id": doc.id,
                    "name": doc.name,
                    "employee_id": doc.employee_id.id if doc.employee_id else False,
                    "employee_name": doc.employee_id.name if doc.employee_id else "",
                    "state": doc.state,
                }
                for doc in docs
            ]
        return {"employees": employees, "documents": documents}

    @api.model
    def _reconciliation_item_from_exclusion(self, exclusion):
        employee = exclusion.employee_id
        classification = EXCLUSION_REASON_TO_CLASSIFICATION.get(
            exclusion.reason, "unresolved_data"
        )
        return {
            "id": exclusion.id,
            "source": "exclusion",
            "name": _("Excluded employee: %s") % employee.name,
            "category": classification,
            "classification": classification,
            "classification_label": classification_label(classification),
            "issue_type": exclusion.reason,
            "details": exclusion.justification
            or _("Employee is excluded from Employee Files."),
            "state": "open",
            "recoverable": exclusion.recoverable,
            "recommended_action": "none",
            "retry_count": 0,
            "employee_id": employee.id,
            "employee_name": employee.name,
            "employee_file_id": False,
            "document_id": False,
            "date_identified": fields.Datetime.to_string(exclusion.create_date),
        }

    @api.model
    def _issue_matches_search(self, row, search=None):
        needle = (search or "").strip().lower()
        if not needle:
            return True
        employee_id = row.get("employee_id")
        if needle.isdigit() and employee_id and str(employee_id) == needle:
            return True
        for field in ("employee_name", "name", "details"):
            value = (row.get(field) or "").lower()
            if needle in value:
                return True
        return False

    @api.model
    def _all_reconciliation_items(self, category="all", search=None):
        company_id = self.env.company.id
        items = []
        Issue = self.env["doc.employee.issue"]
        for issue in Issue.search(
            [("company_id", "=", company_id), ("state", "=", "open")],
            order="create_date desc, id desc",
        ):
            row = issue.serialize_for_api()
            if category != "all" and row["classification"] != category:
                continue
            if not self._issue_matches_search(row, search):
                continue
            items.append(row)
        Exclusion = self.env["doc.employee.exclusion"]
        for exclusion in Exclusion.search(
            [("company_id", "=", company_id), ("active", "=", True)],
            order="create_date desc, id desc",
        ):
            row = self._reconciliation_item_from_exclusion(exclusion)
            if category != "all" and row["classification"] != category:
                continue
            if not self._issue_matches_search(row, search):
                continue
            items.append(row)
        items.sort(
            key=lambda row: row.get("date_identified") or "",
            reverse=True,
        )
        return items

    @api.model
    def reconciliation_total(self):
        return len(self._all_reconciliation_items(category="all"))

    @api.model
    def list_issues(self, category="all", limit=10, offset=0, search=None):
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        items = self._all_reconciliation_items(
            category=category or "all",
            search=search,
        )
        total = len(items)
        return items[offset : offset + limit], total

    @api.model
    def issue_summary(self):
        counts = {key: 0 for key in CLASSIFICATION_LABELS}
        company_id = self.env.company.id
        for issue in self.env["doc.employee.issue"].search(
            [("company_id", "=", company_id), ("state", "=", "open")]
        ):
            cls = normalize_issue_classification(issue.category)
            counts[cls] = counts.get(cls, 0) + 1
        for exclusion in self.env["doc.employee.exclusion"].search(
            [("company_id", "=", company_id), ("active", "=", True)]
        ):
            cls = EXCLUSION_REASON_TO_CLASSIFICATION.get(
                exclusion.reason, "unresolved_data"
            )
            counts[cls] = counts.get(cls, 0) + 1
        summary = []
        for cat_key, cat_label in ISSUE_CATEGORIES:
            if cat_key == "all":
                continue
            count = counts.get(cat_key, 0)
            if count:
                summary.append(
                    {
                        "category": cat_key,
                        "label": cat_label,
                        "count": count,
                        "action": "view_employees"
                        if cat_key == "unresolved_data"
                        else "resolve",
                    }
                )
        total = sum(counts.values())
        return {"total": total, "categories": summary}

    @api.model
    def export_reconciliation_report(self):
        return self._all_reconciliation_items(category="all")

    @api.model
    def resolve_issue(self, issue_id, action=None):
        issue = self.env["doc.employee.issue"].browse(int(issue_id)).exists()
        if not issue:
            raise UserError(_("Issue not found."))
        action = action or issue.recommended_action
        config = self.env["doc.employee.files.config"].get_for_company()
        if action in ("retry", "sync_now"):
            issue.retry_count += 1
            if issue.retry_count > config.max_issue_retry_attempts:
                if config.error_escalation_user_id:
                    issue.message_post(
                        body=_("Max retries exceeded; escalated."),
                        partner_ids=config.error_escalation_user_id.partner_id.ids,
                    )
            try:
                if issue.employee_id and issue.issue_type in (
                    "init_failed",
                    "sync_failed",
                ):
                    self.reconcile_employee_from_ems(issue.employee_id)
                elif issue.issue_type == "integration_failed" and issue.employee_id:
                    employee_file = issue.employee_file_id
                    if not employee_file:
                        employee_file = self.env["doc.employee.file"].sudo().search(
                            [
                                ("employee_id", "=", issue.employee_id.id),
                                ("company_id", "=", issue.company_id.id),
                            ],
                            limit=1,
                        )
                    if employee_file:
                        _linked, failed = self._collect_employee_documents_into_file(
                            issue.employee_id,
                            employee_file,
                            config,
                        )
                        if failed:
                            raise UserError(
                                _(
                                    "Document collection still failed for this employee."
                                )
                            )
                    else:
                        raise UserError(
                            _("No employee file exists to collect documents into.")
                        )
                elif issue.document_id:
                    self.reconcile_document_employee_file(issue.document_id)
                    still_open = self.env["doc.employee.issue"].sudo().search_count(
                        [
                            ("document_id", "=", issue.document_id.id),
                            ("state", "=", "open"),
                            (
                                "issue_type",
                                "in",
                                list(self.DOCUMENT_LINK_ISSUE_TYPES),
                            ),
                        ]
                    )
                    if still_open:
                        raise UserError(
                            _("Document could not be linked to the employee file.")
                        )
                issue.write({"state": "resolved"})
            except Exception as error:
                _logger.exception("Issue action failed for issue %s", issue.id)
                details = hr_details_for_issue_type(issue.issue_type)
                if issue.issue_type == "integration_failed":
                    details = hr_details_for_issue_type(
                        issue.issue_type,
                        module_name=self._integration_module_name_from_error(error),
                    )
                issue.write({"details": details})
                raise UserError(details) from error
        elif action == "resolve":
            issue.write({"state": "resolved"})
        elif action == "view_in_ems":
            return {"redirect": "ems", "employee_id": issue.employee_id.id}
        return issue.serialize_for_api()

    @api.model
    def _ensure_employee_file(self, employee, sync_groups=True):
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete:
            return self.env["doc.employee.file"]
        EmployeeFile = self.env["doc.employee.file"].sudo()
        employee_file = EmployeeFile.search(
            [
                ("employee_id", "=", employee.id),
                ("company_id", "=", employee.company_id.id),
            ],
            limit=1,
        )
        if not employee_file:
            employee_file = EmployeeFile.create(
                {
                    "employee_id": employee.id,
                    "company_id": employee.company_id.id,
                    "state": "active" if employee.active else "inactive",
                }
            )
            employee_file._ensure_storage_folder()
        elif sync_groups:
            employee_file._ensure_storage_folder()
        if sync_groups:
            self.sync_employee_system_groups(employee, employee_file)
        return employee_file

    @api.model
    def sync_employee_system_groups(self, employee, employee_file=None):
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        allow_during_setup = self.env.context.get("employee_files_allow_group_sync")
        if not config.setup_complete and not allow_during_setup:
            return
        employee_file = employee_file or self.env["doc.employee.file"].search(
            [
                ("employee_id", "=", employee.id),
                ("company_id", "=", employee.company_id.id),
            ],
            limit=1,
        )
        if not employee_file:
            return
        company_id = employee.company_id.id
        Group = self.env["doc.employee.group"].sudo()
        primary = self._primary_organizing_dimension(config)
        sub = self._sub_organizing_dimension(config)
        nested_primary = self._nested_primary_groups(config)
        desired_groups = Group.browse()

        for dimension in config.get_organizing_dimensions():
            # Sub-dimension is represented only as nested children under primary.
            if nested_primary and sub and dimension == sub:
                continue
            nested_view = nested_primary and dimension == primary
            if nested_view:
                parent_key, parent_label = self._dimension_value(employee, primary)
                if not parent_key:
                    continue
                parent = self._ensure_system_managed_group(
                    company_id,
                    primary,
                    parent_key,
                    parent_label,
                    parent_group=False,
                )
                sub_key, sub_label = self._dimension_value(employee, sub)
                if sub_key:
                    child_key = self._nested_child_dimension_value_key(
                        parent_key, sub_key
                    )
                    child = self._ensure_system_managed_group(
                        company_id,
                        sub,
                        child_key,
                        sub_label,
                        parent_group=parent,
                    )
                    desired_groups |= child
                    if employee_file in parent.member_ids:
                        parent.write({"member_ids": [(3, employee_file.id)]})
                else:
                    desired_groups |= parent
            else:
                key, label = self._dimension_value(employee, dimension)
                if not key:
                    continue
                group = self._ensure_system_managed_group(
                    company_id,
                    dimension,
                    key,
                    label,
                    parent_group=False,
                )
                desired_groups |= group

        stale = Group.search(
            [
                ("company_id", "=", company_id),
                ("group_kind", "=", "system_managed"),
                ("member_ids", "in", employee_file.id),
            ]
        )
        for group in stale:
            if group not in desired_groups:
                group.write({"member_ids": [(3, employee_file.id)]})
        for group in desired_groups:
            if employee_file not in group.member_ids:
                group.write({"member_ids": [(4, employee_file.id)]})
        self._prune_parent_group_membership(employee_file, desired_groups)

    @api.model
    def _prune_parent_group_membership(self, employee_file, leaf_groups):
        """Remove parent system-group rows when the employee is on a nested child."""
        Group = self.env["doc.employee.group"].sudo()
        parents = leaf_groups.mapped("parent_group_id").filtered(
            lambda parent: parent
            and parent.group_kind == "system_managed"
            and employee_file in parent.member_ids
        )
        if parents:
            parents.write({"member_ids": [(3, employee_file.id)]})

    @api.model
    def on_employee_changed(self, employee, changed_fields=None):
        org_fields = {
            "department_id",
            "active",
            "job_id",
        }
        if changed_fields and org_fields.intersection(changed_fields):
            config = self.env["doc.employee.files.config"].get_for_company(
                employee.company_id
            )
            if config.setup_complete:
                employee_file = self.env["doc.employee.file"].sudo().search(
                    [
                        ("employee_id", "=", employee.id),
                        ("company_id", "=", employee.company_id.id),
                    ],
                    limit=1,
                )
                if employee_file:
                    employee_file.message_post(
                        body=_("Employee organizational data changed in EMS: %s")
                        % ", ".join(sorted(changed_fields.keys()))
                    )
        self.reconcile_employee_from_ems(employee)

    @api.model
    def list_ems_employees(self, search=None, limit=200):
        """EMS employees for setup exclusion picker (EF-A3)."""
        limit = max(1, min(int(limit or 200), 500))
        domain = list(self._employee_domain(self.env.company))
        if search and str(search).strip():
            needle = str(search).strip()
            domain.extend(
                [
                    "|",
                    "|",
                    ("name", "ilike", needle),
                    ("work_email", "ilike", needle),
                    ("barcode", "ilike", needle),
                ]
            )
        employees = self.env["hr.employee"].sudo().search(
            domain, limit=limit, order="name"
        )
        return [
            {
                "id": employee.id,
                "name": employee.name,
                "department_name": employee.department_id.name
                if employee.department_id
                else "",
                "active": bool(employee.active),
            }
            for employee in employees
        ]

    @api.model
    def exclusion_report(self, reason=None):
        domain = [
            ("company_id", "=", self.env.company.id),
            ("active", "=", True),
        ]
        if reason:
            domain.append(("reason", "=", reason))
        rows = self.env["doc.employee.exclusion"].search(domain)
        return [row.serialize_for_api() for row in rows]

    @api.model
    def _canonical_system_group(self, group):
        group = group.exists()
        if not group or group.group_kind != "system_managed":
            return group
        if not group.dimension_value_key:
            return self.env["doc.employee.group"].browse()
        Group = self.env["doc.employee.group"].sudo()
        parent_id = group.parent_group_id.id if group.parent_group_id else False
        return Group.search(
            [
                ("company_id", "=", group.company_id.id),
                ("group_kind", "=", "system_managed"),
                ("organizing_dimension", "=", group.organizing_dimension),
                ("dimension_value_key", "=", group.dimension_value_key),
                ("parent_group_id", "=", parent_id),
                ("active", "=", True),
            ],
            order="id desc",
            limit=1,
        )

    @api.model
    def related_groups_for_employee_file(self, employee_file):
        """Groups for profile Related groups tab (canonical, no duplicates)."""
        Group = self.env["doc.employee.group"].sudo()
        employee_file = employee_file.exists()
        if not employee_file:
            return Group.browse()
        config = self.env["doc.employee.files.config"].get_for_company(
            employee_file.company_id
        )
        allowed_dims = set(config.get_organizing_dimensions())
        nested = self._nested_primary_groups(config)
        sub = self._sub_organizing_dimension(config)

        memberships = Group.search(
            [
                ("company_id", "=", employee_file.company_id.id),
                ("member_ids", "in", employee_file.id),
                ("active", "=", True),
            ],
            order="name, id",
        )
        if not memberships:
            return Group.browse()

        stale = Group.browse()
        canonical_by_id = {}

        for group in memberships:
            if group.group_kind == "custom":
                canonical_by_id[group.id] = group
                continue
            canonical = self._canonical_system_group(group)
            if not canonical:
                stale |= group
                continue
            if canonical.organizing_dimension not in allowed_dims:
                stale |= group
                continue
            if group.parent_group_id and (not nested or group.organizing_dimension != sub):
                stale |= group
                continue
            if group.id != canonical.id:
                stale |= group
            canonical_by_id[canonical.id] = canonical

        if nested and sub:
            nested_sub = [
                group
                for group in canonical_by_id.values()
                if group.organizing_dimension == sub and group.parent_group_id
            ]
            if nested_sub:
                for group in list(canonical_by_id.values()):
                    if (
                        group.organizing_dimension == sub
                        and not group.parent_group_id
                    ):
                        stale |= group
                        canonical_by_id.pop(group.id, None)

        canonical_groups = Group.browse(list(canonical_by_id.keys()))
        by_id = {group.id: group for group in canonical_groups}
        chosen = Group.browse()
        seen_system_keys = set()
        seen_sub_labels = set()

        for group in canonical_groups:
            if group.group_kind == "custom":
                chosen |= group
                continue
            if (
                nested
                and sub
                and group.organizing_dimension == sub
                and group.parent_group_id
            ):
                label_key = (group.name or "").strip().lower()
                if label_key and label_key in seen_sub_labels:
                    stale |= group
                    continue
                if label_key:
                    seen_sub_labels.add(label_key)
            nested_children = group.child_ids.filtered(
                lambda child: child.active
                and child.id in by_id
                and employee_file in child.member_ids
            )
            if nested_children:
                continue
            system_key = (
                group.organizing_dimension or "",
                group.dimension_value_key or "",
                group.parent_group_id.id if group.parent_group_id else 0,
            )
            if system_key in seen_system_keys:
                continue
            seen_system_keys.add(system_key)
            chosen |= group

        if stale:
            for group in stale:
                if employee_file in group.member_ids:
                    group.write({"member_ids": [(3, employee_file.id)]})

        return chosen.sorted(key=lambda item: (item.group_kind != "custom", item.name or ""))

    @api.model
    def get_header_field_catalog(self):
        return [
            {
                "key": item["key"],
                "label": _(item["label"]),
                "ems_managed": item["ems_managed"],
            }
            for item in HEADER_FIELD_CATALOG
        ]

    @api.model
    def _header_field_display_value(self, employee, key):
        if key == "employee_id":
            code = getattr(employee, "barcode", False) or getattr(
                employee, "identification_id", False
            )
            return code or f"EMP-{employee.id}"
        if key == "name":
            return employee.name or ""
        if key == "department_id":
            return employee.department_id.name if employee.department_id else ""
        if key == "job_id":
            job = employee.job_id
            if job:
                return job.name
            return getattr(employee, "job_title", "") or ""
        if key in ("work_location", "branch", "grade", "employment_type", "status"):
            _dim_key, label = self._dimension_value(employee, key)
            return label or ""
        if key == "work_email":
            return employee.work_email or ""
        if key == "work_phone":
            return employee.work_phone or employee.mobile_phone or ""
        return ""

    @api.model
    def build_employee_file_header_fields(self, employee, config=None):
        config = config or self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        catalog = {item["key"]: item for item in HEADER_FIELD_CATALOG}
        rows = []
        for key in config.get_header_fields():
            meta = catalog.get(key)
            if not meta:
                continue
            rows.append(
                {
                    "key": key,
                    "label": _(meta["label"]),
                    "value": self._header_field_display_value(employee, key) or "—",
                    "ems_managed": meta["ems_managed"],
                }
            )
        return rows

    @api.model
    def _employee_file_document_domain(self, employee_file):
        employee = employee_file.employee_id
        return [
            ("active", "=", True),
            ("deleted_at", "=", False),
            "|",
            ("employee_file_id", "=", employee_file.id),
            "&",
            ("employee_id", "=", employee.id),
            ("employee_file_id", "=", False),
        ]

    @api.model
    def list_employee_file_documents(self, employee_file, user=None):
        user = user or self.env.user
        Document = self.env["doc.document"]
        docs = Document.search(
            self._employee_file_document_domain(employee_file),
            order="create_date desc",
        )
        return [
            doc.serialize_for_api(user)
            for doc in docs
        ]

    @api.model
    def list_employee_file_activity(self, employee_file, limit=40):
        env = self.env
        user = env.user
        Document = env["doc.document"].sudo()
        limit = max(1, min(int(limit or 40), 100))

        doc_ids = Document.search(
            self._employee_file_document_domain(employee_file)
        ).ids

        def _plain_message(body):
            text = re.sub(r"<[^>]+>", " ", body or "")
            return " ".join(text.split())

        activity_log = []
        message_domain = [
            ("message_type", "in", ["comment", "notification"]),
            "|",
            "&",
            ("model", "=", "doc.employee.file"),
            ("res_id", "=", employee_file.id),
            "&",
            ("model", "=", "doc.document"),
            ("res_id", "in", doc_ids or [0]),
        ]
        messages = env["mail.message"].sudo().search(
            message_domain,
            order="date desc",
            limit=limit,
        )
        for message in messages:
            text = _plain_message(message.body)
            if not text:
                continue
            document = False
            if message.model == "doc.document":
                document = Document.browse(message.res_id).exists()
            lowered = text.lower()
            if "acknowledged" in lowered:
                kind = "acknowledgement"
            elif "submitted" in lowered and "review" in lowered:
                kind = "approval"
            elif "approved" in lowered or "rejected" in lowered:
                kind = "approval"
            elif message.model == "doc.employee.file":
                kind = "update"
            else:
                kind = "update"
            activity_log.append(
                {
                    "id": message.id,
                    "kind": kind,
                    "message": text,
                    "document_id": document.id if document else False,
                    "document_name": document.name if document else "",
                    "folder_id": document.folder_id.id if document else False,
                    "folder_name": document.folder_id.folder_name
                    if document and document.folder_id
                    else "",
                    "folder_type": document.folder_id.folder_type
                    if document and document.folder_id
                    else "employee",
                    "employee_id": employee_file.employee_id.id,
                    "actor_name": message.author_id.name or _("System"),
                    "occurred_at": fields.Datetime.to_string(message.date),
                }
            )

        existing_doc_ids = {item["document_id"] for item in activity_log if item["document_id"]}
        recent = Document.search(
            [("id", "in", doc_ids)],
            order="create_date desc",
            limit=10,
        )
        for document in recent:
            if document.id in existing_doc_ids:
                continue
            activity_log.append(
                {
                    "id": -(document.id),
                    "kind": "upload",
                    "message": _("%(actor)s added %(document)s")
                    % {
                        "actor": document.uploaded_by.name or _("Someone"),
                        "document": document.name,
                    },
                    "document_id": document.id,
                    "document_name": document.name,
                    "folder_id": document.folder_id.id,
                    "folder_name": document.folder_id.folder_name,
                    "folder_type": document.folder_id.folder_type,
                    "employee_id": employee_file.employee_id.id,
                    "actor_name": document.uploaded_by.name or _("System"),
                    "occurred_at": fields.Datetime.to_string(document.create_date),
                }
            )

        activity_log.sort(
            key=lambda item: item["occurred_at"] or "",
            reverse=True,
        )
        return activity_log[:limit]

    @api.model
    def custom_group_overlap(self, group_ids):
        groups = self.env["doc.employee.group"].browse(group_ids).exists()
        members = {}
        for group in groups:
            for member in group.member_ids:
                members.setdefault(member.id, {"file": member, "groups": []})
                members[member.id]["groups"].append(group.name)
        overlap = [
            {
                "employee_file_id": data["file"].id,
                "employee_name": data["file"].employee_id.name,
                "groups": data["groups"],
            }
            for data in members.values()
            if len(data["groups"]) > 1
        ]
        return overlap

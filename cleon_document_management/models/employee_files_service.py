# -*- coding: utf-8 -*-
import json
import logging
import re
import threading

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError

from .employee_issue import (
    CLASSIFICATION_LABELS,
    EXCLUSION_REASON_LABELS,
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

EMS_TRACKED_ORG_FIELDS = {
    "department_id": (_("Department"), _("Employee moved")),
    "job_id": (_("Job position"), _("Employee job updated")),
    "active": (_("Employment status"), _("Employee status updated")),
}

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

    def _or_join(self, clauses):
        if not clauses:
            return []
        if len(clauses) == 1:
            return list(clauses)
        return ["|"] * (len(clauses) - 1) + list(clauses)

    def _employee_metric_search_clauses(self, Employee, needle, prefix=""):
        clauses = [
            ("%sname" % prefix, "ilike", needle),
            ("%swork_email" % prefix, "ilike", needle),
            ("%sbarcode" % prefix, "ilike", needle),
            ("%sidentification_id" % prefix, "ilike", needle),
            ("%sdepartment_id.name" % prefix, "ilike", needle),
            ("%sjob_id.name" % prefix, "ilike", needle),
            ("%suser_id.login" % prefix, "ilike", needle),
        ]
        fields = getattr(Employee, "_fields", {}) or {}
        for fname in (
            "employee_type_id",
            "employment_type_id",
            "work_location_id",
            "address_id",
            "branch_id",
            "grade_id",
        ):
            if not fields or fname in fields:
                clauses.append(("%s%s.name" % (prefix, fname), "ilike", needle))
        lowered = needle.lower()
        if lowered in ("active", "inactive"):
            clauses.append(("%sactive" % prefix, "=", lowered == "active"))
        return clauses

    @api.model
    def search_company_employees(self, search="", limit=10, offset=0):
        """Paginated employee search across name, login, and EMS dimensions."""
        limit = min(max(int(limit or 10), 1), 100)
        offset = max(int(offset or 0), 0)
        Employee = self.env["hr.employee"].sudo()
        company = self.env.company
        domain = [
            ("company_id", "in", [False, company.id]),
            ("active", "=", True),
        ]
        needle = (search or "").strip()
        if needle:
            domain = domain + self._or_join(
                self._employee_metric_search_clauses(Employee, needle)
            )
        total = Employee.search_count(domain)
        employees = Employee.search(domain, order="name", limit=limit, offset=offset)
        return employees, total, limit, offset

    def _serialize_employee_metrics(self, employee):
        et = getattr(employee, "employment_type_id", False) or getattr(
            employee, "employee_type_id", False
        )
        loc = getattr(employee, "work_location_id", False) or getattr(
            employee, "address_id", False
        )
        branch = getattr(employee, "branch_id", False)
        grade = getattr(employee, "grade_id", False)
        return {
            "department_name": employee.department_id.name
            if employee.department_id
            else "",
            "employment_type": et.name if et else "",
            "work_location": loc.name if loc else "",
            "job_title": employee.job_id.name if employee.job_id else "",
            "status": "Active" if employee.active else "Inactive",
            "branch": branch.name if branch else "",
            "grade": grade.name if grade else "",
        }

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
    def _clear_config_exclusions_for_employee(self, employee, config):
        """Manual exclusion wins; hide duplicate config-driven exclusion rows."""
        if not employee:
            return
        Exclusion = self.env["doc.employee.exclusion"].sudo()
        company_id = config.company_id.id
        if not self._has_manual_exclusion(employee, config):
            return
        rows = Exclusion.search(
            [
                ("company_id", "=", company_id),
                ("employee_id", "=", employee.id),
                ("reason", "in", list(self.CONFIG_DRIVEN_EXCLUSION_REASONS)),
                ("active", "=", True),
            ]
        )
        if rows:
            rows.write({"active": False})

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
            overrides["exclude_test_employees"] = False
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
        self._clear_config_exclusions_for_employee(employee, config)
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
    def _backfill_top_level_dimension_groups(self, config, dimension):
        """Create missing flat groups so a nested sub-dimension still has its own tab."""
        if not dimension:
            return
        company_id = config.company_id.id
        files = (
            self.env["doc.employee.file"]
            .sudo()
            .search([("company_id", "=", company_id)])
        )
        for employee_file in files:
            employee = employee_file.employee_id
            if not employee:
                continue
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
            if employee_file not in group.member_ids:
                group.write({"member_ids": [(4, employee_file.id)]})

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
    def _organizing_dimension_label(self, dimension_key):
        if not dimension_key:
            return ""
        Config = self.env["doc.employee.files.config"]
        field = Config._fields.get("primary_organizing_dimension")
        labels = dict(field.selection) if field else {}
        return labels.get(dimension_key, dimension_key.replace("_", " ").title())

    @api.model
    def _employee_missing_primary_attribute(self, employee, primary, nested_primary):
        if not primary:
            return False
        parent_key, _label = self._dimension_value(employee, primary)
        if nested_primary:
            return not parent_key
        return not parent_key

    @api.model
    def _setup_preview_attention_row(self, employee, issue_type, issue_text):
        return {
            "employee_id": employee.id,
            "employee_name": employee.name,
            "department_name": employee.department_id.name
            if employee.department_id
            else "",
            "job_title": employee.job_id.name if employee.job_id else "",
            "issue": issue_text,
            "issue_type": issue_type,
        }

    @api.model
    def _collect_setup_preview_attention_rows(self, preview_config):
        primary = self._primary_organizing_dimension(preview_config)
        if not primary:
            return []
        sub = self._sub_organizing_dimension(preview_config)
        nested_primary = self._nested_primary_groups(preview_config)
        included, _excluded = self._eligible_employees(preview_config)
        primary_label = self._organizing_dimension_label(primary)
        sub_label = self._organizing_dimension_label(sub) if sub and sub != "none" else ""
        rows = []
        for employee in included:
            parent_key, _parent_label = self._dimension_value(employee, primary)
            if not parent_key:
                rows.append(
                    self._setup_preview_attention_row(
                        employee,
                        "no_org_attribute",
                        _("Missing %s") % primary_label,
                    )
                )
                continue
            if nested_primary and sub and sub != "none":
                sub_key, _sub_label = self._dimension_value(employee, sub)
                if not sub_key:
                    rows.append(
                        self._setup_preview_attention_row(
                            employee,
                            "no_subgroup_attribute",
                            _("Missing %s") % sub_label,
                        )
                    )
        rows.sort(key=lambda item: (item.get("employee_name") or "").lower())
        return rows

    @api.model
    def _setup_preview_attention_categories(self, rows):
        buckets = {}
        for row in rows:
            issue_type = row.get("issue_type") or "unknown"
            if issue_type not in buckets:
                buckets[issue_type] = {
                    "issue_type": issue_type,
                    "label": row.get("issue") or issue_type,
                    "count": 0,
                }
            buckets[issue_type]["count"] += 1
        return sorted(buckets.values(), key=lambda item: item["label"])

    @api.model
    def _filter_attention_rows_by_search(self, rows, search=None):
        needle = (search or "").strip()
        if not needle:
            return rows
        employee_ids = [row["employee_id"] for row in rows if row.get("employee_id")]
        ems_matched = set()
        if employee_ids:
            Employee = self.env["hr.employee"].sudo()
            domain = [("id", "in", employee_ids)] + self._or_join(
                self._employee_metric_search_clauses(Employee, needle)
            )
            ems_matched = set(Employee.search(domain).ids)
        filtered = []
        for row in rows:
            employee_id = row.get("employee_id")
            if employee_id in ems_matched or self._issue_matches_search(row, search):
                filtered.append(row)
        return filtered

    @api.model
    def _setup_preview_attention_rows(
        self,
        preview_config,
        search=None,
        issue_type=None,
        issue_types=None,
    ):
        rows = self._collect_setup_preview_attention_rows(preview_config)
        categories = self._setup_preview_attention_categories(rows)
        types_filter = [item for item in (issue_types or []) if item]
        if types_filter:
            types_set = set(types_filter)
            rows = [row for row in rows if row.get("issue_type") in types_set]
        elif issue_type and issue_type != "all":
            rows = [row for row in rows if row.get("issue_type") == issue_type]
        rows = self._filter_attention_rows_by_search(rows, search=search)
        return rows, categories

    @api.model
    def setup_preview_attention(
        self,
        wizard_values=None,
        search=None,
        limit=10,
        offset=0,
        issue_type=None,
        issue_types=None,
    ):
        config = self.env["doc.employee.files.config"].get_for_company()
        wizard_values = dict(wizard_values or {})
        preview_config = _EmployeeFilesPreviewConfig(config, wizard_values)
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        rows, categories = self._setup_preview_attention_rows(
            preview_config,
            search=search,
            issue_type=issue_type,
            issue_types=issue_types,
        )
        total = len(rows)
        return {
            "items": rows[offset : offset + limit],
            "total": total,
            "categories": categories,
        }

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
        company = preview_config.company_id or self.env.company
        ems_employees_in_company = self.env["hr.employee"].sudo().with_company(
            company
        ).search_count(self._employee_domain(company))

        included, excluded_counts = self._eligible_employees(preview_config)
        total_excluded = sum(excluded_counts.values())
        doc_count = 0
        if preview_config.collect_existing_documents:
            doc_count = self.env["doc.document"].sudo().search_count(
                [
                    ("employee_id", "in", [e.id for e in included]),
                    ("active", "=", True),
                ]
            )

        if not dimensions:
            return {
                "organizing_dimensions": [],
                "sub_organizing_dimension": "none",
                "primary_organizing_dimension": "",
                "nested_primary_view": False,
                "groups_to_create": 0,
                "employees_included": len(included),
                "ems_employees_in_company": ems_employees_in_company,
                "documents_expected": doc_count,
                "need_attention_expected": 0,
                "excluded_total": total_excluded,
                "excluded_breakdown": excluded_counts,
                "dimension_summaries": [],
                "group_breakdown": [],
            }

        primary = self._primary_organizing_dimension(preview_config)
        sub = self._sub_organizing_dimension(preview_config)
        nested_primary = self._nested_primary_groups(preview_config)

        dimension_summaries = []
        total_groups = 0
        need_attention_expected = len(
            self._collect_setup_preview_attention_rows(preview_config)
        )
        for dimension in dimensions:
            buckets, _missing = self._preview_group_buckets(
                included,
                dimension,
                primary,
                sub,
                nested_primary,
            )
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
                "primary_organizing_dimension": (
                    preview["organizing_dimensions"][0]
                    if preview.get("organizing_dimensions")
                    else False
                ),
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
                    self._backfill_top_level_dimension_groups(config, dimension)
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
        if not config.show_inactive_groups and not dimension:
            groups = groups.filtered(lambda g: g.employee_count > 0)
        return groups

    @api.model
    def _employee_file_search_domain(
        self, search=None, department_id=None, attention_filter=None
    ):
        domain = [("company_id", "=", self.env.company.id)]
        filt = (attention_filter or "all").strip().lower()
        if filt in ("needs_attention", "attention", "needs-attention"):
            domain.append(("attention_count", ">", 0))
        elif filt in ("ok", "clear", "no_attention"):
            domain.append(("attention_count", "=", 0))
        if department_id and str(department_id) != "all":
            if str(department_id).isdigit():
                domain.append(("employee_id.department_id", "=", int(department_id)))
            else:
                domain.append(
                    ("employee_id.department_id.name", "ilike", str(department_id))
                )
        needle = (search or "").strip()
        if needle:
            Employee = self.env["hr.employee"].sudo()
            domain += self._or_join(
                self._employee_metric_search_clauses(
                    Employee, needle, prefix="employee_id."
                )
            )
        return domain

    @api.model
    def _sanitize_employee_file_order(self, order):
        allowed = {
            "name asc": "employee_id asc",
            "name desc": "employee_id desc",
            "identification asc": (
                "employee_id.identification_id asc, "
                "employee_id.barcode asc, employee_id.name asc"
            ),
            "identification desc": (
                "employee_id.identification_id desc, "
                "employee_id.barcode desc, employee_id.name desc"
            ),
            "department asc": (
                "employee_id.department_id.name asc, employee_id.name asc"
            ),
            "department desc": (
                "employee_id.department_id.name desc, employee_id.name desc"
            ),
            "job_title asc": "employee_id.job_id.name asc, employee_id.name asc",
            "job_title desc": "employee_id.job_id.name desc, employee_id.name desc",
            "documents asc": "document_count asc, employee_id.name asc",
            "documents desc": "document_count desc, employee_id.name desc",
            "attention asc": "attention_count asc, employee_id.name asc",
            "attention desc": "attention_count desc, employee_id.name desc",
        }
        key = (order or "name asc").strip().lower()
        return allowed.get(key, "employee_id asc")

    @api.model
    def _employee_file_python_sort_key(self, record, order_key):
        """Stable in-memory sort keys (full result set before pagination)."""
        if order_key.startswith("identification"):
            return (
                record.employee_id.identification_id
                or record.employee_id.barcode
                or ""
            ).lower()
        if order_key.startswith("attention"):
            return (record.attention_count, (record.employee_id.name or "").lower())
        if order_key.startswith("documents"):
            return (record.document_count, (record.employee_id.name or "").lower())
        if order_key.startswith("department"):
            return (
                (record.employee_id.department_id.name or "").lower(),
                (record.employee_id.name or "").lower(),
            )
        if order_key.startswith("job_title"):
            return (
                (record.employee_id.job_id.name or "").lower(),
                (record.employee_id.name or "").lower(),
            )
        return (record.employee_id.name or "").lower()

    @api.model
    def _search_employee_files_sorted(
        self, domain, order="name asc", limit=10, offset=0
    ):
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        EmployeeFile = self.env["doc.employee.file"]
        key = (order or "name asc").strip().lower()
        python_sort_keys = (
            "identification asc",
            "identification desc",
            "attention asc",
            "attention desc",
            "documents asc",
            "documents desc",
            "department asc",
            "department desc",
            "job_title asc",
            "job_title desc",
        )
        if key in python_sort_keys:
            records = EmployeeFile.search(domain)
            reverse = key.endswith("desc")
            records = records.sorted(
                key=lambda rec: self._employee_file_python_sort_key(rec, key),
                reverse=reverse,
            )
            total = len(records)
            return records[offset : offset + limit], total
        sort = self._sanitize_employee_file_order(order)
        total = EmployeeFile.search_count(domain)
        files = EmployeeFile.search(
            domain, limit=limit, offset=offset, order=sort
        )
        return files, total

    @api.model
    def list_employee_files(
        self,
        search=None,
        limit=10,
        offset=0,
        department_id=None,
        order="name asc",
        attention_filter=None,
    ):
        domain = self._employee_file_search_domain(
            search,
            department_id=department_id,
            attention_filter=attention_filter,
        )
        return self._search_employee_files_sorted(
            domain, order=order, limit=limit, offset=offset
        )

    @api.model
    def list_group_members(
        self,
        group_id,
        search=None,
        limit=10,
        offset=0,
        order="name asc",
        attention_filter=None,
    ):
        group = self.env["doc.employee.group"].browse(int(group_id)).exists()
        if not group or group.company_id != self.env.company:
            return self.env["doc.employee.file"], 0
        if group.child_ids:
            member_files = group.child_ids.mapped("member_ids")
        else:
            member_files = group.member_ids
        domain = [("id", "in", member_files.ids)]
        needle = (search or "").strip()
        if needle:
            Employee = self.env["hr.employee"].sudo()
            domain += self._or_join(
                self._employee_metric_search_clauses(
                    Employee, needle, prefix="employee_id."
                )
            )
        filt = (attention_filter or "all").strip().lower()
        if filt in ("needs_attention", "attention", "needs-attention"):
            domain.append(("attention_count", ">", 0))
        elif filt in ("ok", "clear", "no_attention"):
            domain.append(("attention_count", "=", 0))
        return self._search_employee_files_sorted(
            domain, order=order, limit=limit, offset=offset
        )

    @api.model
    def _employee_document_search_domain(self, filters=None):
        filters = filters or {}
        company = self.env.company
        domain = [
            ("employee_id", "!=", False),
            ("employee_id.company_id", "=", company.id),
            ("active", "=", True),
            ("deleted_at", "=", False),
        ]
        query = (filters.get("query") or "").strip()
        if query:
            domain += [
                "|",
                "|",
                "|",
                "|",
                ("name", "ilike", query),
                ("document_type_id.name", "ilike", query),
                ("employee_id.name", "ilike", query),
                ("employee_id.identification_id", "ilike", query),
                ("document_type_id.category", "ilike", query),
            ]
        category = filters.get("category")
        if category and category != "all":
            domain.append(("document_type_id.category", "=", category))
        document_type_id = filters.get("document_type_id")
        if document_type_id and str(document_type_id) != "all":
            domain.append(("document_type_id", "=", int(document_type_id)))
        department_id = filters.get("department_id")
        if department_id and str(department_id) != "all":
            if str(department_id).isdigit():
                domain.append(("employee_id.department_id", "=", int(department_id)))
            else:
                domain.append(
                    ("employee_id.department_id.name", "ilike", str(department_id))
                )
        source = filters.get("source")
        if source == "employee":
            domain.append(("folder_id.folder_type", "=", "employee"))
        elif source == "organizational":
            domain.append(("folder_id.folder_type", "=", "organizational"))
        status = filters.get("status")
        if status and status != "all":
            if status == "pending_approval":
                domain.append(("approval_state", "=", "pending"))
            elif status == "expired":
                domain.append(("state", "=", "expired"))
            elif status == "expiring_30":
                today = fields.Date.context_today(self)
                domain += [
                    ("has_expiry", "=", True),
                    ("expiry_date", ">=", today),
                    ("expiry_date", "<=", fields.Date.add(today, days=30)),
                ]
            elif status == "needs_attention":
                domain.append(("employee_file_id.attention_count", ">", 0))
            else:
                domain.append(("state", "=", status))
        return domain

    @api.model
    def _sanitize_document_search_order(self, order):
        allowed = {
            "name asc": "name asc",
            "name desc": "name desc",
            "upload_date asc": "create_date asc",
            "upload_date desc": "create_date desc",
            "employee asc": "employee_id asc",
            "employee desc": "employee_id desc",
            "status asc": "state asc",
            "status desc": "state desc",
            "expiry asc": "expiry_date asc",
            "expiry desc": "expiry_date desc",
        }
        key = (order or "upload_date desc").strip().lower()
        return allowed.get(key, "create_date desc")

    @api.model
    def search_employee_documents(self, filters=None, limit=25, offset=0, order=None):
        limit = max(1, min(int(limit or 25), 100))
        offset = max(0, int(offset or 0))
        Document = self.env["doc.document"]
        domain = self._employee_document_search_domain(filters)
        sort = self._sanitize_document_search_order(order)
        total = Document.search_count(domain)
        docs = Document.search(domain, limit=limit, offset=offset, order=sort)
        user = self.env.user
        items = []
        for doc in docs:
            try:
                doc.check_access_rule("read")
            except AccessError:
                continue
            row = doc.serialize_for_api(user)
            folder = doc.folder_id
            row["source_module"] = (
                "employee_files"
                if folder.folder_type == "employee"
                else "organizational_files"
            )
            row["source_module_label"] = (
                _("Employee Files")
                if folder.folder_type == "employee"
                else _("Organizational Files")
            )
            items.append(row)
        return items, total

    @api.model
    def global_search(self, query, scope="all", limit=50):
        query = (query or "").strip()
        if not query:
            return {"employees": [], "documents": []}
        EmployeeFile = self.env["doc.employee.file"]
        limit = max(1, min(int(limit or 50), 100))
        employees = []
        documents = []
        if scope in ("all", "employees"):
            files, _total = self.list_employee_files(
                search=query, limit=limit, offset=0
            )
            user = self.env.user
            employees = [f.serialize_for_api(user) for f in files]
        if scope in ("all", "documents"):
            items, _total = self.search_employee_documents(
                {"query": query},
                limit=limit,
                offset=0,
            )
            documents = items
        return {"employees": employees, "documents": documents}

    @api.model
    def _reconciliation_item_from_exclusion(self, exclusion):
        employee = exclusion.employee_id
        classification = EXCLUSION_REASON_TO_CLASSIFICATION.get(
            exclusion.reason, "excluded"
        )
        reason_label = EXCLUSION_REASON_LABELS.get(
            exclusion.reason, exclusion.reason or ""
        )
        return {
            "id": exclusion.id,
            "source": "exclusion",
            "name": _("Excluded employee: %s") % employee.name,
            "category": classification,
            "classification": classification,
            "classification_label": classification_label(classification),
            "issue_type": exclusion.reason,
            "issue_type_label": reason_label,
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
        for field in (
            "employee_name",
            "name",
            "details",
            "department_name",
            "employment_type",
            "job_title",
            "work_location",
            "status",
            "branch",
            "grade",
            "work_email",
            "issue",
        ):
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
        exclusions = Exclusion.search(
            [("company_id", "=", company_id), ("active", "=", True)],
            order="create_date desc, id desc",
        )
        manual_employee_ids = {
            row.employee_id.id
            for row in exclusions
            if row.reason == "manual" and row.employee_id
        }
        for exclusion in exclusions:
            if (
                exclusion.reason in self.CONFIG_DRIVEN_EXCLUSION_REASONS
                and exclusion.employee_id.id in manual_employee_ids
            ):
                continue
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
        company_id = self.env.company.id
        return self.env["doc.employee.issue"].search_count(
            [("company_id", "=", company_id), ("state", "=", "open")]
        )

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
                exclusion.reason, "excluded"
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
        dimensions = list(config.get_organizing_dimensions())
        if nested_primary and sub and sub not in dimensions:
            dimensions.append(sub)

        for dimension in dimensions:
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
            if nested_view:
                continue
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
    def _ems_field_display(self, employee, field_name):
        employee = employee.sudo()
        if field_name == "department_id":
            return employee.department_id.name if employee.department_id else _("(none)")
        if field_name == "job_id":
            return employee.job_id.name if employee.job_id else _("(none)")
        if field_name == "active":
            return _("Active") if employee.active else _("Inactive")
        return str(employee[field_name] or "")

    @api.model
    def log_ems_organizational_changes(self, employee, before_values):
        """Persist EMS audit rows, chatter, email, and activities for org field changes."""
        if not before_values:
            return
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete:
            return
        employee_file = self.env["doc.employee.file"].sudo().search(
            [
                ("employee_id", "=", employee.id),
                ("company_id", "=", employee.company_id.id),
            ],
            limit=1,
        )
        if not employee_file:
            return
        ChangeLog = self.env["doc.employee.file.change.log"].sudo()
        for field_name, old_display in before_values.items():
            meta = EMS_TRACKED_ORG_FIELDS.get(field_name)
            if not meta:
                continue
            field_label, event_label = meta
            new_display = self._ems_field_display(employee, field_name)
            if (old_display or "") == (new_display or ""):
                continue
            log = ChangeLog.create(
                {
                    "company_id": employee.company_id.id,
                    "employee_file_id": employee_file.id,
                    "event_label": event_label,
                    "field_name": field_name,
                    "field_label": field_label,
                    "old_value": old_display,
                    "new_value": new_display,
                }
            )
            body = _(
                "<p><strong>%(event)s</strong></p>"
                "<p>%(field)s: %(old)s → %(new)s</p>"
                "<p><em>%(time)s</em></p>"
            ) % {
                "event": event_label,
                "field": field_label,
                "old": old_display or "—",
                "new": new_display or "—",
                "time": fields.Datetime.to_string(log.changed_at),
            }
            employee_file.message_post(body=body, message_type="notification")
            self._notify_ems_change_recipients(
                employee_file, log, config, event_label, field_label, old_display, new_display
            )
            log.write({"notified": True})

    @api.model
    def _notify_ems_change_recipients(
        self,
        employee_file,
        log,
        config,
        event_label,
        field_label,
        old_display,
        new_display,
    ):
        manager_users = self.env["res.users"].sudo().search(
            [
                ("active", "=", True),
                ("employee_files_role_ids", "!=", False),
            ]
        )
        legacy_group = self.env.ref(
            "cleon_document_management.group_document_manager",
            raise_if_not_found=False,
        )
        if legacy_group:
            manager_users |= legacy_group.users
        admin_group = self.env.ref(
            "cleon_document_management.group_document_admin",
            raise_if_not_found=False,
        )
        if admin_group:
            manager_users |= admin_group.users
        manager_users = manager_users.filtered(lambda user: user.active and user.email)
        if not manager_users:
            return
        employee_name = employee_file.employee_id.name or _("Employee")
        subject = _("%(event)s — %(employee)s") % {
            "event": event_label,
            "employee": employee_name,
        }
        body_html = _(
            "<p>An employee record was updated in EMS.</p>"
            "<ul>"
            "<li><strong>Employee:</strong> %(employee)s</li>"
            "<li><strong>Change:</strong> %(event)s</li>"
            "<li><strong>Field:</strong> %(field)s</li>"
            "<li><strong>Previous value:</strong> %(old)s</li>"
            "<li><strong>New value:</strong> %(new)s</li>"
            "<li><strong>Time:</strong> %(time)s</li>"
            "</ul>"
        ) % {
            "employee": employee_name,
            "event": event_label,
            "field": field_label,
            "old": old_display or "—",
            "new": new_display or "—",
            "time": fields.Datetime.to_string(log.changed_at),
        }
        Mail = self.env["mail.mail"].sudo()
        for user in manager_users:
            try:
                Mail.create(
                    {
                        "subject": subject,
                        "body_html": body_html,
                        "email_to": user.email,
                        "auto_delete": True,
                    }
                ).send()
            except Exception:
                _logger.exception(
                    "Employee Files EMS change mail failed for %s", user.email
                )
        activity_type = self.env.ref(
            "mail.mail_activity_data_todo", raise_if_not_found=False
        )
        if activity_type:
            summary = _("%(event)s: %(employee)s") % {
                "event": event_label,
                "employee": employee_name,
            }
            note = _("%(field)s: %(old)s → %(new)s") % {
                "field": field_label,
                "old": old_display or "—",
                "new": new_display or "—",
            }
            for user in manager_users:
                employee_file.activity_schedule(
                    activity_type_id=activity_type.id,
                    user_id=user.id,
                    date_deadline=fields.Date.context_today(self),
                    summary=summary,
                    note=note,
                )

    @api.model
    def on_employee_changed(self, employee, changed_fields=None):
        self.reconcile_employee_from_ems(employee)

    @api.model
    def list_ems_employees(self, search=None, limit=200):
        """EMS employees for setup exclusion picker (EF-A3)."""
        limit = max(1, min(int(limit or 200), 500))
        domain = list(self._employee_domain(self.env.company))
        Employee = self.env["hr.employee"].sudo()
        if search and str(search).strip():
            needle = str(search).strip()
            domain.extend(
                self._or_join(
                    self._employee_metric_search_clauses(Employee, needle)
                )
            )
        employees = Employee.search(domain, limit=limit, order="name")
        return [
            {
                "id": employee.id,
                "name": employee.name,
                "active": bool(employee.active),
                **self._serialize_employee_metrics(employee),
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
                        # Keep top-level membership for the dimension tab;
                        # hide the duplicate on the profile related-groups list.
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
        change_logs = (
            env["doc.employee.file.change.log"]
            .sudo()
            .search([("employee_file_id", "=", employee_file.id)], limit=limit)
        )
        for entry in change_logs:
            activity_log.append(entry.serialize_for_activity())

        employee = employee_file.employee_id
        ack_domain = [("employee_id", "=", employee.id)]
        if employee.user_id:
            ack_domain = [
                "|",
                ("employee_id", "=", employee.id),
                ("user_id", "=", employee.user_id.id),
            ]
        acknowledgements = (
            env["doc.document.acknowledgement"]
            .sudo()
            .search(ack_domain, order="acknowledged_at desc", limit=limit)
        )
        for acknowledgement in acknowledgements:
            activity_log.append(acknowledgement.serialize_for_activity())

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
                continue
            if "submitted" in lowered and "review" in lowered:
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

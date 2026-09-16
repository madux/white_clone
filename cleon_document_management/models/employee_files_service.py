# -*- coding: utf-8 -*-
import json
import logging
import threading

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError

from .employee_issue import (
    CLASSIFICATION_LABELS,
    EXCLUSION_REASON_TO_CLASSIFICATION,
    ISSUE_CATEGORIES,
    classification_label,
    normalize_issue_classification,
)
from .employee_setup import SETUP_STAGES

_logger = logging.getLogger(__name__)

SETUP_PROGRESS_BATCH = 25


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
        return [("company_id", "=", company.id)]

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
        if dimension == "employment_type" and hasattr(employee, "employment_type_id"):
            et = employee.employment_type_id
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
        Employee = self.env["hr.employee"].sudo()
        domain = self._employee_domain(config.company_id)
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

    @api.model
    def setup_preview(self, wizard_values=None):
        config = self.env["doc.employee.files.config"].get_for_company()
        wizard_values = wizard_values or {}
        if wizard_values.get("organizing_dimensions"):
            config.set_organizing_dimensions(wizard_values["organizing_dimensions"])
        for key in (
            "include_all_existing",
            "include_inactive",
            "exclude_test_employees",
            "collect_existing_documents",
            "primary_organizing_dimension",
            "sub_organizing_dimension",
        ):
            if key in wizard_values:
                config.write({key: wizard_values[key]})

        dimensions = config.get_organizing_dimensions()
        if not dimensions:
            raise UserError(_("Select at least one organizing dimension."))

        included, excluded_counts = self._eligible_employees(config)
        primary = dimensions[0]
        group_keys = {}
        no_department = 0
        for employee in included:
            key, label = self._dimension_value(employee, primary)
            if not key:
                no_department += 1
                continue
            group_keys.setdefault(key, {"name": label, "employees": 0, "documents": 0})
            group_keys[key]["employees"] += 1

        doc_count = 0
        if config.collect_existing_documents:
            doc_count = self.env["doc.document"].sudo().search_count(
                [
                    ("employee_id", "in", [e.id for e in included]),
                    ("active", "=", True),
                ]
            )
            for key, bucket in group_keys.items():
                emp_ids = [
                    e.id
                    for e in included
                    if self._dimension_value(e, primary)[0] == key
                ]
                bucket["documents"] = self.env["doc.document"].sudo().search_count(
                    [
                        ("employee_id", "in", emp_ids),
                        ("active", "=", True),
                    ]
                )

        total_excluded = sum(excluded_counts.values())
        return {
            "organizing_dimensions": dimensions,
            "groups_to_create": len(group_keys),
            "employees_included": len(included),
            "documents_expected": doc_count,
            "need_attention_expected": no_department,
            "excluded_total": total_excluded,
            "excluded_breakdown": excluded_counts,
            "group_breakdown": [
                {
                    "name": data["name"],
                    "employees": data["employees"],
                    "documents": data["documents"],
                    "excluded": 0,
                }
                for data in group_keys.values()
            ],
        }

    @api.model
    def setup_confirm(self, wizard_values=None):
        if not self.env.user.has_group(
            "cleon_document_management.group_document_admin"
        ):
            raise AccessError(_("Employee Files setup requires document administrator access."))

        config = self.env["doc.employee.files.config"].get_for_company()
        preview = self.setup_preview(wizard_values)
        config.write(
            {
                "setup_complete": False,
                "primary_organizing_dimension": preview["organizing_dimensions"][0],
            }
        )
        config.set_organizing_dimensions(preview["organizing_dimensions"])

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
        Group = self.env["doc.employee.group"].sudo()
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
                Issue.create(
                    {
                        "company_id": config.company_id.id,
                        "name": _("Initialization failed: %s") % employee.name,
                        "category": "initialization_failed",
                        "issue_type": "init_failed",
                        "details": str(error),
                        "employee_id": employee.id,
                        "recoverable": True,
                        "recommended_action": "retry",
                        "setup_run_id": run.id,
                    }
                )
            if index % SETUP_PROGRESS_BATCH == 0 or index == len(included):
                _stage_progress("create_files", initialized, len(included))
        _stage_done("create_files", initialized, len(included))

        organize_total = len(included) * max(len(dimensions), 1)
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
        system_groups = {}
        organized = 0
        for dimension in dimensions:
            for employee in included:
                employee_file = EmployeeFile.search(
                    [
                        ("employee_id", "=", employee.id),
                        ("company_id", "=", config.company_id.id),
                    ],
                    limit=1,
                )
                if not employee_file:
                    continue
                key, label = self._dimension_value(employee, dimension)
                if not key:
                    if dimension == primary:
                        attention += 1
                        existing = Issue.search(
                            [
                                ("employee_id", "=", employee.id),
                                ("issue_type", "=", "no_org_attribute"),
                                ("state", "=", "open"),
                            ],
                            limit=1,
                        )
                        if not existing:
                            Issue.create(
                                {
                                    "company_id": config.company_id.id,
                                    "name": _("No organizational attribute: %s")
                                    % employee.name,
                                    "category": "unresolved_data",
                                    "issue_type": "no_org_attribute",
                                    "details": _(
                                        "Assign the organizing attribute in EMS."
                                    ),
                                    "employee_id": employee.id,
                                    "employee_file_id": employee_file.id,
                                    "recoverable": False,
                                    "recommended_action": "view_in_ems",
                                }
                            )
                    continue
                cache_key = (dimension, key)
                group = system_groups.get(cache_key)
                if not group:
                    group = Group.search(
                        [
                            ("company_id", "=", config.company_id.id),
                            ("group_kind", "=", "system_managed"),
                            ("organizing_dimension", "=", dimension),
                            ("dimension_value_key", "=", key),
                        ],
                        limit=1,
                    )
                    if not group:
                        group = Group.create(
                            {
                                "name": label,
                                "group_kind": "system_managed",
                                "company_id": config.company_id.id,
                                "organizing_dimension": dimension,
                                "dimension_value_key": key,
                            }
                        )
                    system_groups[cache_key] = group
                if employee_file not in group.member_ids:
                    group.write({"member_ids": [(4, employee_file.id)]})
                organized += 1
                if organized % SETUP_PROGRESS_BATCH == 0:
                    _stage_progress("organize_groups", organized, organize_total)
        _stage_done("organize_groups", organized, organize_total)

        if config.collect_existing_documents:
            Document = self.env["doc.document"].sudo()
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
                docs = Document.search(
                    [
                        ("employee_id", "=", employee.id),
                        ("active", "=", True),
                    ]
                )
                for doc in docs:
                    try:
                        vals = {"employee_file_id": employee_file.id}
                        if employee_file.storage_folder_id:
                            vals["folder_id"] = employee_file.storage_folder_id.id
                        doc.write(vals)
                        collected += 1
                    except Exception as error:
                        attention += 1
                        Issue.create(
                            {
                                "company_id": config.company_id.id,
                                "name": _("Unmatched document: %s") % doc.name,
                                "category": "unmatched_document",
                                "issue_type": "unmatched_document",
                                "details": str(error),
                                "employee_id": employee.id,
                                "employee_file_id": employee_file.id,
                                "document_id": doc.id,
                                "recoverable": True,
                                "recommended_action": "retry",
                                "setup_run_id": run.id,
                            }
                        )
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
        base = [("company_id", "=", self.env.company.id), ("active", "=", True)]

        if for_home:
            system_domain = base + [("group_kind", "=", "system_managed")]
            if dimension:
                system_domain.append(("organizing_dimension", "=", dimension))
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
    def _all_reconciliation_items(self, category="all"):
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
            items.append(row)
        Exclusion = self.env["doc.employee.exclusion"]
        for exclusion in Exclusion.search(
            [("company_id", "=", company_id), ("active", "=", True)],
            order="create_date desc, id desc",
        ):
            row = self._reconciliation_item_from_exclusion(exclusion)
            if category != "all" and row["classification"] != category:
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
    def list_issues(self, category="all", limit=10, offset=0):
        limit = max(1, min(int(limit or 10), 100))
        offset = max(0, int(offset or 0))
        items = self._all_reconciliation_items(category=category or "all")
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
                if issue.employee_id and issue.issue_type == "init_failed":
                    self._ensure_employee_file(issue.employee_id)
                elif issue.document_id:
                    issue.document_id.write(
                        {"employee_file_id": issue.employee_file_id.id}
                        if issue.employee_file_id
                        else {}
                    )
                issue.write({"state": "resolved"})
            except Exception as error:
                issue.write({"details": str(error)})
                raise UserError(str(error))
        elif action == "resolve":
            issue.write({"state": "resolved"})
        elif action == "view_in_ems":
            return {"redirect": "ems", "employee_id": issue.employee_id.id}
        return issue.serialize_for_api()

    @api.model
    def _ensure_employee_file(self, employee):
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
        self.sync_employee_system_groups(employee, employee_file)
        return employee_file

    @api.model
    def sync_employee_system_groups(self, employee, employee_file=None):
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete:
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
        Group = self.env["doc.employee.group"].sudo()
        for dimension in config.get_organizing_dimensions():
            key, label = self._dimension_value(employee, dimension)
            groups = Group.search(
                [
                    ("company_id", "=", employee.company_id.id),
                    ("group_kind", "=", "system_managed"),
                    ("organizing_dimension", "=", dimension),
                ]
            )
            for group in groups:
                if employee_file in group.member_ids and (
                    not key or group.dimension_value_key != key
                ):
                    group.write({"member_ids": [(3, employee_file.id)]})
            if not key:
                continue
            group = Group.search(
                [
                    ("company_id", "=", employee.company_id.id),
                    ("group_kind", "=", "system_managed"),
                    ("organizing_dimension", "=", dimension),
                    ("dimension_value_key", "=", key),
                ],
                limit=1,
            )
            if not group:
                group = Group.create(
                    {
                        "name": label,
                        "group_kind": "system_managed",
                        "company_id": employee.company_id.id,
                        "organizing_dimension": dimension,
                        "dimension_value_key": key,
                    }
                )
            if employee_file not in group.member_ids:
                group.write({"member_ids": [(4, employee_file.id)]})

    @api.model
    def on_employee_changed(self, employee, changed_fields):
        config = self.env["doc.employee.files.config"].get_for_company(
            employee.company_id
        )
        if not config.setup_complete:
            return
        employee_file = self._ensure_employee_file(employee)
        org_fields = {
            "department_id",
            "active",
            "job_id",
        }
        if org_fields.intersection(changed_fields):
            old_dep = changed_fields.get("department_id")
            if isinstance(old_dep, tuple):
                old_dep = old_dep[0]
            employee_file.message_post(
                body=_("Employee organizational data changed in EMS: %s")
                % ", ".join(sorted(changed_fields.keys()))
            )
            self.sync_employee_system_groups(employee, employee_file)
            if not employee.active and not config.include_inactive:
                employee_file.write({"state": "inactive"})

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

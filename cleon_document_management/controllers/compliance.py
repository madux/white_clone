from datetime import timedelta

from odoo import _, fields, http
from odoo.exceptions import AccessError, ValidationError
from odoo.http import request

from .access import require_document_admin, user_is_document_admin

CANONICAL_POLICY_TYPE_NAMES = {
    "document_requirement": "Document Requirement",
    "renewable_document": "Renewable Document",
    "compliance_request": "Compliance Request",
    "retention": "Review Schedule",
}


class ComplianceController(http.Controller):
    """JSON API used by the document-management frontend."""

    @staticmethod
    def _policy_data(policy):
        return {
            "id": policy.id,
            "name": policy.name,
            "description": policy.description or "",
            "policy_type_id": policy.policy_type_id.id if policy.policy_type_id else False,
            "policy_type": policy.policy_type_id.name if policy.policy_type_id else "Unassigned",
            "policy_type_code": policy.policy_type_id.code if policy.policy_type_id else "",
            "document_type_ids": policy.document_type_ids.ids,
            "schedule": policy.schedule or "manual",
            "custom_schedule_days": policy.custom_schedule_days,
            "applies_to": policy.applies_to,
            "department_ids": policy.department_ids.ids,
            "grade_ids": policy.grade_ids.ids,
            "employee_ids": policy.employee_ids.ids,
            "minimum_documents": policy.minimum_documents,
            "grace_period_days": policy.grace_period_days,
            "effective_date": str(policy.effective_date or ""),
            "active": policy.active,
            "last_run_at": str(policy.last_run_at or ""),
            "next_run_at": str(policy.next_run_at or ""),
            # Type-specific parameters
            "allow_waiver": policy.allow_waiver,
            "alert_schedule_days": policy.alert_schedule_days or "60,30,15,7,0",
            "escalate_manager_days": policy.escalate_manager_days,
            "escalate_hr_days": policy.escalate_hr_days,
            "auto_request_renewal": policy.auto_request_renewal,
            "event_trigger": policy.event_trigger or "",
            "due_days": policy.due_days,
            "reminder_frequency_days": policy.reminder_frequency_days,
            "assigned_reviewer_id": policy.assigned_reviewer_id.id or False,
            "assigned_reviewer": policy.assigned_reviewer_id.name or "",
            "audit_frequency": policy.audit_frequency or "quarterly",
            "sample_pct": policy.sample_pct,
            "assigned_auditor_id": policy.assigned_auditor_id.id or False,
            "assigned_auditor": policy.assigned_auditor_id.name or "",
        }

    @staticmethod
    def _evaluation_data(evaluation):
        return {
            "id": evaluation.id,
            "policy_id": evaluation.policy_id.id,
            "policy": evaluation.policy_id.name,
            "policy_active": evaluation.policy_id.active,
            "employee_id": evaluation.employee_id.id,
            "employee": evaluation.employee_id.name,
            "score": evaluation.score,
            "status": evaluation.status,
            "complete_count": evaluation.complete_count,
            "missing_count": evaluation.missing_count,
            "grace_count": evaluation.grace_count,
            "evaluated_at": str(evaluation.evaluated_at or ""),
            "exception_id": evaluation.exception_id.id or False,
            "lines": [
                {
                    "id": line.id,
                    "requirement_id": line.requirement_id.id,
                    "requirement": line.requirement_id.name,
                    "document_type_id": line.document_type_id.id,
                    "document_type": line.document_type_id.name,
                    "document_ids": line.document_ids.ids,
                    "required_count": line.required_count,
                    "matched_count": line.matched_count,
                    "status": line.status,
                }
                for line in evaluation.line_ids
            ],
        }

    @staticmethod
    def _run_data(run):
        policy = run.policy_id
        return {
            "id": run.id,
            "policy_id": policy.id,
            "policy": policy.name,
            "policy_allow_waiver": policy.allow_waiver,
            "run_type": run.run_type,
            "evaluated_at": str(run.evaluated_at or ""),
            "employee_count": run.employee_count,
            "compliant_count": run.compliant_count,
            "partial_count": run.partial_count,
            "non_compliant_count": run.non_compliant_count,
            "excepted_count": run.excepted_count,
            "has_snapshots": bool(run.result_ids),
        }

    @staticmethod
    def _run_result_line_data(line):
        line = line.sudo()
        requirement = line.requirement_id
        document_type = line.document_type_id
        return {
            "id": line.id,
            "requirement_id": requirement.id if requirement else False,
            "requirement": requirement.name if requirement else "",
            "document_type_id": document_type.id if document_type else False,
            "document_type": document_type.name if document_type else "",
            "document_ids": line.document_ids.ids,
            "document_names": [doc.name for doc in line.document_ids],
            "expired_document_ids": line.expired_document_ids.ids,
            "expired_document_names": [doc.name for doc in line.expired_document_ids],
            "required_count": line.required_count,
            "matched_count": line.matched_count,
            "status": line.status,
        }

    @classmethod
    def _run_result_data(cls, result, include_lines=False):
        employee = result.employee_id.sudo()
        payload = {
            "id": result.id,
            "employee_id": employee.id,
            "employee": employee.name,
            "job_title": employee.job_title or "",
            "department_id": result.department_id.id if result.department_id else False,
            "department": result.department_id.name if result.department_id else "",
            "status": result.status,
            "score": result.score,
            "required_count": result.required_count,
            "submitted_count": result.submitted_count,
            "missing_count": result.missing_count,
            "grace_count": result.grace_count,
            "exception_id": result.exception_id.id if result.exception_id else False,
        }
        if include_lines:
            payload["lines"] = [
                cls._run_result_line_data(line) for line in result.line_ids
            ]
        return payload

    @staticmethod
    def _status_domain(status):
        if not status or status == "all":
            return []
        if status == "partial":
            return [("status", "in", ["partial"])]
        if status in ("compliant", "non_compliant", "excepted"):
            return [("status", "=", status)]
        return []

    @staticmethod
    def _paginate(records, page, page_size, export=False):
        page = max(int(page or 1), 1)
        page_size = min(max(int(page_size or 10), 1), 500)
        total = len(records)
        if export:
            return records, total, 1, total or page_size
        offset = (page - 1) * page_size
        return records[offset : offset + page_size], total, page, page_size

    @staticmethod
    def _search_run_results(domain, search):
        Result = request.env["doc.compliance.evaluation.run.result"]
        if search:
            search = str(search).strip()
            domain = domain + [
                "|",
                ("employee_id.name", "ilike", search),
                ("department_id.name", "ilike", search),
            ]
        return Result.search(domain, order="employee_id")

    @http.route(
        "/api/compliance/targets",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def compliance_targets(self, **kwargs):
        """Return named records used by policy scope selectors and HR auditor/reviewer fields."""
        is_manager = request.env.user.has_group(
            "cleon_document_management.group_document_manager"
        )
        employee = request.env.user.employee_id
        employees = request.env["hr.employee"].search(
            [("active", "=", True)] if is_manager else [("id", "=", employee.id or 0)],
            order="name",
        )
        departments = request.env["hr.department"].search(
            [] if is_manager else [("id", "=", employee.department_id.id or 0)],
            order="name",
        )
        grades = request.env["hr.grade"].search(
            [] if is_manager else [("id", "=", employee.grade_id.id or 0)],
            order="name",
        )
        manager_group = request.env.ref(
            "cleon_document_management.group_document_manager", raise_if_not_found=False
        )
        admin_domain = [("active", "=", True)]
        if manager_group:
            admin_domain.append(("groups_id", "in", [manager_group.id]))
        admins = request.env["res.users"].search(admin_domain, order="name")
        if not admins:
            admins = request.env["res.users"].search([("active", "=", True)], order="name")

        Employee = request.env["hr.employee"]
        lifecycle_context = Employee._document_lifecycle_context()
        pending_employee_ids = Employee._pending_document_employee_ids(employees.ids)

        try:
            locations = request.env["hr.work.location"].search(
                [("active", "=", True)], order="name"
            )
        except KeyError:
            locations = request.env["hr.employee"].browse()

        return {
            "success": True,
            "data": {
                "employees": [
                    {
                        "id": employee.id,
                        "name": employee.name,
                        "job_title": employee.job_title or "",
                        "department": employee.department_id.name or "",
                        "department_id": employee.department_id.id or False,
                        "grade": employee.grade_id.name or "",
                        "grade_id": employee.grade_id.id or False,
                        "work_email": employee.work_email or "",
                        "work_phone": employee.work_phone or "",
                        "work_location_id": employee.work_location_id.id
                        if employee.work_location_id
                        else False,
                        "work_location": employee.work_location_id.name or "",
                        "lifecycle_status": employee.get_document_lifecycle_status(
                            lifecycle_context
                        ),
                        "has_pending_documents": employee.id in pending_employee_ids,
                        "location": (
                            employee.work_location_id.name
                            if employee.work_location_id
                            else (
                                employee.address_id.city
                                if employee.address_id
                                else ""
                            )
                        )
                        or "",
                    }
                    for employee in employees
                ],
                "departments": [
                    {"id": department.id, "name": department.name}
                    for department in departments
                ],
                "grades": [{"id": grade.id, "name": grade.name} for grade in grades],
                "locations": [
                    {"id": location.id, "name": location.name}
                    for location in locations
                ],
                "users": [
                    {"id": user.id, "name": user.name, "email": user.email or ""}
                    for user in admins
                ],
            },
        }

    @http.route(
        "/api/compliance/policy-types",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def policy_types(self, **kwargs):
        TypeModel = request.env["doc.compliance.policy.type"]
        records = TypeModel.search([("active", "=", True)], order="name")
        if not records:
            defaults = [
                {
                    "name": "Document Requirement",
                    "code": "document_requirement",
                    "description": "Mandatory document submission requirement for staff compliance.",
                    "active": True,
                },
                {
                    "name": "Renewable Document",
                    "code": "renewable_document",
                    "description": "Document requiring periodic renewal prior to expiration.",
                    "active": True,
                },
                {
                    "name": "Compliance Request",
                    "code": "compliance_request",
                    "description": "Specific document or audit request issued to staff members.",
                    "active": True,
                },
                {
                    "name": "Review Schedule",
                    "code": "retention",
                    "description": "Periodic audit schedule and folder verification policy.",
                    "active": True,
                },
            ]
            records = TypeModel.create(defaults)
        for record in records:
            canonical = CANONICAL_POLICY_TYPE_NAMES.get(record.code)
            if canonical and record.name != canonical:
                record.sudo().write({"name": canonical})
        return {
            "success": True,
            "data": [
                {"id": record.id, "name": record.name, "code": record.code}
                for record in records
            ],
        }

    @http.route(
        "/api/compliance/policies",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def policies(self, **kwargs):
        try:
            domain = []
            if kwargs.get("active_only", True):
                domain.append(("active", "=", True))
            policies = request.env["doc.compliance.policy"].search(domain)
            return {
                "success": True,
                "count": len(policies),
                "data": [self._policy_data(policy) for policy in policies],
            }
        except AccessError:
            return {
                "success": False,
                "message": _(
                    "Document access is not configured for your account. Contact your administrator."
                ),
            }

    @http.route(
        "/api/compliance/policies/<int:policy_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def policy(self, policy_id, **kwargs):
        policy = request.env["doc.compliance.policy"].browse(policy_id).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        return {"success": True, "data": self._policy_data(policy)}

    @http.route(
        "/api/compliance/policies/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_policy(self, **kwargs):
        try:
            require_document_admin()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        applies_to = kwargs.get("applies_to", "all")
        dept_ids = (
            request.env["hr.department"]
            .browse(kwargs.get("department_ids", []) or [])
            .exists()
            .ids
        )
        grade_ids = (
            request.env["hr.grade"]
            .browse(kwargs.get("grade_ids", []) or [])
            .exists()
            .ids
        )
        emp_ids = (
            request.env["hr.employee"]
            .browse(kwargs.get("employee_ids", []) or [])
            .exists()
            .ids
        )

        if applies_to == "department" and not dept_ids:
            return {"success": False, "message": "Select at least one department."}
        if applies_to == "grade" and not grade_ids:
            return {"success": False, "message": "Select at least one grade."}
        if applies_to == "employee" and not emp_ids:
            return {"success": False, "message": "Select at least one employee."}

        values = {
            "name": kwargs.get("name"),
            "description": kwargs.get("description", ""),
            "policy_type_id": kwargs.get("policy_type_id"),
            "document_type_ids": [
                fields.Command.set(
                    request.env["doc.document.type"]
                    .browse(kwargs.get("document_type_ids", []) or [])
                    .exists()
                    .ids
                )
            ],
            "schedule": kwargs.get("schedule") or False,
            "custom_schedule_days": kwargs.get("custom_schedule_days", 30),
            "applies_to": applies_to,
            "department_ids": [fields.Command.set(dept_ids)],
            "grade_ids": [fields.Command.set(grade_ids)],
            "employee_ids": [fields.Command.set(emp_ids)],
            "minimum_documents": kwargs.get("minimum_documents", 1),
            "grace_period_days": kwargs.get("grace_period_days", 0),
            "effective_date": kwargs.get("effective_date") or False,
            "active": kwargs.get("active", True),
            # Type-specific parameters
            "allow_waiver": kwargs.get("allow_waiver", True),
            "alert_schedule_days": kwargs.get("alert_schedule_days", "60,30,15,7,0"),
            "escalate_manager_days": kwargs.get("escalate_manager_days", 0),
            "escalate_hr_days": kwargs.get("escalate_hr_days", 7),
            "auto_request_renewal": kwargs.get("auto_request_renewal", True),
            "event_trigger": kwargs.get("event_trigger") or False,
            "due_days": kwargs.get("due_days", 14),
            "reminder_frequency_days": kwargs.get("reminder_frequency_days", 3),
            "assigned_reviewer_id": int(kwargs.get("assigned_reviewer_id")) if kwargs.get("assigned_reviewer_id") else False,
            "audit_frequency": kwargs.get("audit_frequency", "quarterly"),
            "sample_pct": kwargs.get("sample_pct", 100),
            "assigned_auditor_id": int(kwargs.get("assigned_auditor_id")) if kwargs.get("assigned_auditor_id") else False,
        }
        if not values["name"] or not values["policy_type_id"]:
            return {"success": False, "message": "Name and policy type are required."}
        try:
            policy = request.env["doc.compliance.policy"].create(values)
        except (AccessError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._policy_data(policy)}

    @http.route(
        "/api/compliance/policies/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_policy(self, **kwargs):
        try:
            require_document_admin()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        policy = request.env["doc.compliance.policy"].browse(kwargs.get("id")).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        values = {
            key: kwargs[key]
            for key in (
                "name",
                "description",
                "effective_date",
                "active",
                "schedule",
                "custom_schedule_days",
                "applies_to",
                "minimum_documents",
                "grace_period_days",
                "allow_waiver",
                "alert_schedule_days",
                "escalate_manager_days",
                "escalate_hr_days",
                "auto_request_renewal",
                "event_trigger",
                "due_days",
                "reminder_frequency_days",
                "audit_frequency",
                "sample_pct",
            )
            if key in kwargs
        }
        if "assigned_reviewer_id" in kwargs:
            values["assigned_reviewer_id"] = (
                int(kwargs["assigned_reviewer_id"]) if kwargs["assigned_reviewer_id"] else False
            )
        if "assigned_auditor_id" in kwargs:
            values["assigned_auditor_id"] = (
                int(kwargs["assigned_auditor_id"]) if kwargs["assigned_auditor_id"] else False
            )
        if "policy_type_id" in kwargs:
            values["policy_type_id"] = (
                request.env["doc.compliance.policy.type"]
                .browse(int(kwargs["policy_type_id"]))
                .exists()
                .id
            )
        for field_name, model_name in (
            ("document_type_ids", "doc.document.type"),
            ("department_ids", "hr.department"),
            ("grade_ids", "hr.grade"),
            ("employee_ids", "hr.employee"),
        ):
            if field_name in kwargs:
                values[field_name] = [
                    fields.Command.set(
                        request.env[model_name]
                        .browse(kwargs[field_name] or [])
                        .exists()
                        .ids
                    )
                ]

        target_applies = values.get("applies_to", policy.applies_to)
        dept_ids = (
            values["department_ids"][0][2]
            if "department_ids" in values
            else policy.department_ids.ids
        )
        grade_ids = (
            values["grade_ids"][0][2]
            if "grade_ids" in values
            else policy.grade_ids.ids
        )
        emp_ids = (
            values["employee_ids"][0][2]
            if "employee_ids" in values
            else policy.employee_ids.ids
        )

        if target_applies == "department" and not dept_ids:
            return {"success": False, "message": "Select at least one department."}
        if target_applies == "grade" and not grade_ids:
            return {"success": False, "message": "Select at least one grade."}
        if target_applies == "employee" and not emp_ids:
            return {"success": False, "message": "Select at least one employee."}

        if "schedule" in values and values["schedule"] == "manual":
            values["schedule"] = False
        if "custom_schedule_days" in values:
            values["custom_schedule_days"] = int(values["custom_schedule_days"])
        if "minimum_documents" in values:
            values["minimum_documents"] = int(values["minimum_documents"])
        if "grace_period_days" in values:
            values["grace_period_days"] = int(values["grace_period_days"])
        try:
            policy.write(values)
        except (AccessError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        return {"success": True, "data": self._policy_data(policy)}

    @http.route("/api/compliance/policies/delete", type="json", auth="user", methods=["POST"], csrf=False)
    def delete_policy(self, id=None, **kwargs):
        try:
            require_document_admin()
        except AccessError as error:
            return {"success": False, "message": str(error)}
        policy = request.env["doc.compliance.policy"].browse(id).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        try:
            policy.unlink()
        except (AccessError, ValidationError) as error:
            return {"success": False, "message": str(error)}
        except Exception as error:
            return {
                "success": False,
                "message": _("This policy could not be deleted: %s") % error,
            }
        return {"success": True, "message": "Policy deleted."}

    @http.route(
        "/api/compliance/policies/<int:policy_id>/evaluate",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluate_policy(self, policy_id, **kwargs):
        if not user_is_document_admin(request.env.user):
            return {"success": False, "message": "Document administrator access is required."}
        policy = request.env["doc.compliance.policy"].browse(policy_id).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        runs = policy.action_evaluate(run_type="manual")
        evaluations = policy.evaluation_ids if runs else request.env["doc.compliance.evaluation"]
        return {
            "success": True,
            "message": "Policy is not active yet; no evaluation was run." if not runs else "Policy check completed.",
            "data": [self._evaluation_data(item) for item in evaluations],
            "run": self._run_data(runs[-1]) if runs else None,
        }

    @http.route(
        "/api/compliance/evaluations",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluations(self, policy_id=None, employee_id=None, **kwargs):
        domain = []
        if policy_id:
            domain.append(("policy_id", "=", int(policy_id)))
        if employee_id:
            domain.append(("employee_id", "=", int(employee_id)))
        records = request.env["doc.compliance.evaluation"].search(domain)
        return {
            "success": True,
            "count": len(records),
            "data": [self._evaluation_data(item) for item in records],
        }

    @http.route(
        "/api/compliance/runs",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_runs(self, policy_id=None, limit=100, **kwargs):
        domain = []
        if policy_id:
            domain.append(("policy_id", "=", int(policy_id)))
        records = request.env["doc.compliance.evaluation.run"].search(
            domain, order="evaluated_at desc", limit=min(int(limit or 100), 500)
        )
        return {
            "success": True,
            "count": len(records),
            "data": [self._run_data(item) for item in records],
        }

    @http.route(
        "/api/compliance/runs/<int:run_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_run_detail(self, run_id, **kwargs):
        run = request.env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if not run:
            return {"success": False, "message": "Run not found."}
        return {"success": True, "data": self._run_data(run)}

    @http.route(
        "/api/compliance/runs/<int:run_id>/employees",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_run_employees(self, run_id, **kwargs):
        run = request.env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if not run:
            return {"success": False, "message": "Run not found."}
        domain = [("run_id", "=", run.id)] + self._status_domain(kwargs.get("status"))
        records = self._search_run_results(domain, kwargs.get("search"))
        page_slice, total, page, page_size = self._paginate(
            records,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": [self._run_result_data(item) for item in page_slice],
        }

    @http.route(
        "/api/compliance/runs/<int:run_id>/employees/<int:employee_id>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_run_employee_detail(self, run_id, employee_id, **kwargs):
        run = request.env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if not run:
            return {"success": False, "message": "Run not found."}
        result = request.env["doc.compliance.evaluation.run.result"].sudo().search(
            [("run_id", "=", run.id), ("employee_id", "=", employee_id)],
            limit=1,
        )
        if not result:
            return {"success": False, "message": "Employee result not found for this run."}
        return {"success": True, "data": self._run_result_data(result.sudo(), include_lines=True)}

    @http.route(
        "/api/compliance/runs/<int:run_id>/export",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_run_export(self, run_id, **kwargs):
        if not user_is_document_admin(request.env.user):
            return {"success": False, "message": "Document administrator access is required."}
        run = request.env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if not run:
            return {"success": False, "message": "Run not found."}
        domain = [("run_id", "=", run.id)] + self._status_domain(kwargs.get("status"))
        records = self._search_run_results(domain, kwargs.get("search"))
        return {
            "success": True,
            "run": self._run_data(run),
            "data": [self._run_result_data(item, include_lines=True) for item in records],
        }

    @http.route(
        "/api/compliance/runs/<int:run_id>/request",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluation_run_request(self, run_id, **kwargs):
        if not user_is_document_admin(request.env.user):
            return {"success": False, "message": "Document administrator access is required."}
        run = request.env["doc.compliance.evaluation.run"].browse(run_id).exists()
        if not run:
            return {"success": False, "message": "Run not found."}
        employee_id = kwargs.get("employee_id")
        due_date = kwargs.get("due_date")
        subject = (kwargs.get("subject") or "").strip()
        message = (kwargs.get("message") or "").strip()
        if not employee_id or not due_date:
            return {
                "success": False,
                "message": "Employee and due date are required.",
            }
        result = request.env["doc.compliance.evaluation.run.result"].search(
            [("run_id", "=", run.id), ("employee_id", "=", int(employee_id))],
            limit=1,
        )
        if not result:
            return {"success": False, "message": "Employee result not found for this run."}
        if result.status not in ("non_compliant", "partial"):
            return {
                "success": False,
                "message": "Requests can only be sent for non-compliant or partially compliant employees.",
            }
        employee = result.employee_id
        if not employee.user_id:
            return {"success": False, "message": "This employee does not have a user account for email delivery."}
        missing_lines = result.line_ids.filtered(lambda line: line.status in ("missing", "grace"))
        missing_docs = ", ".join(
            line.document_type_id.name
            for line in missing_lines
            if line.document_type_id
        ) or _("required documents")
        body = message.replace("{{missing_documents}}", missing_docs)
        body = body.replace("{{due_date}}", str(due_date))
        body_html = "<p>%s</p>" % body.replace("\n", "<br/>")
        if not subject:
            subject = _("Compliance request: %s") % run.policy_id.name
        request.env["doc.compliance.notify"].sudo().notify_manual_request(
            run.policy_id,
            employee,
            subject,
            body_html,
            due_date,
        )
        return {"success": True, "message": "Request email sent."}

    @http.route(
        "/api/compliance/reports/<string:report_key>",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def compliance_report(self, report_key, **kwargs):
        if not user_is_document_admin(request.env.user):
            return {"success": False, "message": "Document administrator access is required."}
        handlers = {
            "summary": self._report_summary,
            "missing_per_run": self._report_missing_per_run,
            "expired_per_run": self._report_expired_per_run,
            "policy_compliance": self._report_policy_compliance,
            "expiring_soon": self._report_expiring_soon,
            "department_compliance": self._report_department_compliance,
            "exceptions": self._report_exceptions,
            "employee_scores": self._report_employee_scores,
        }
        handler = handlers.get(report_key)
        if not handler:
            return {"success": False, "message": "Unknown report type."}
        return handler(**kwargs)

    def _report_summary(self, **kwargs):
        domain = []
        if kwargs.get("policy_id"):
            domain.append(("policy_id", "=", int(kwargs["policy_id"])))
        runs = request.env["doc.compliance.evaluation.run"].search(
            domain, order="evaluated_at desc"
        )
        if kwargs.get("search"):
            search = str(kwargs["search"]).strip().lower()
            runs = runs.filtered(
                lambda run: search in (run.policy_id.name or "").lower()
            )
        rows = []
        for run in runs:
            completion = 0.0
            if run.employee_count:
                completion = round(run.compliant_count / run.employee_count * 100, 2)
            rows.append({
                "run_id": run.id,
                "evaluated_at": str(run.evaluated_at or ""),
                "policy_id": run.policy_id.id,
                "policy": run.policy_id.name,
                "run_type": run.run_type,
                "employee_count": run.employee_count,
                "compliant_count": run.compliant_count,
                "partial_count": run.partial_count,
                "non_compliant_count": run.non_compliant_count,
                "excepted_count": run.excepted_count,
                "completion_rate": completion,
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_missing_per_run(self, **kwargs):
        domain = [("status", "=", "missing")]
        if kwargs.get("run_id"):
            domain.append(("result_id.run_id", "=", int(kwargs["run_id"])))
        if kwargs.get("policy_id"):
            domain.append(("result_id.run_id.policy_id", "=", int(kwargs["policy_id"])))
        lines = request.env["doc.compliance.evaluation.run.result.line"].search(domain)
        rows = []
        for line in lines:
            result = line.result_id
            run = result.run_id
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                haystack = " ".join([
                    result.employee_id.name or "",
                    run.policy_id.name or "",
                    line.document_type_id.name if line.document_type_id else "",
                ]).lower()
                if search not in haystack:
                    continue
            rows.append({
                "run_id": run.id,
                "evaluated_at": str(run.evaluated_at or ""),
                "policy": run.policy_id.name,
                "employee_id": result.employee_id.id,
                "employee": result.employee_id.name,
                "department": result.department_id.name if result.department_id else "",
                "document_type": line.document_type_id.name if line.document_type_id else "",
                "required_count": line.required_count,
                "matched_count": line.matched_count,
                "status": line.status,
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_expired_per_run(self, **kwargs):
        domain = [("expired_document_ids", "!=", False)]
        if kwargs.get("run_id"):
            domain.append(("result_id.run_id", "=", int(kwargs["run_id"])))
        if kwargs.get("policy_id"):
            domain.append(("result_id.run_id.policy_id", "=", int(kwargs["policy_id"])))
        lines = request.env["doc.compliance.evaluation.run.result.line"].search(domain)
        rows = []
        for line in lines:
            result = line.result_id
            run = result.run_id
            for doc in line.expired_document_ids:
                if kwargs.get("search"):
                    search = str(kwargs["search"]).strip().lower()
                    haystack = " ".join([
                        result.employee_id.name or "",
                        run.policy_id.name or "",
                        doc.name or "",
                    ]).lower()
                    if search not in haystack:
                        continue
                rows.append({
                    "run_id": run.id,
                    "evaluated_at": str(run.evaluated_at or ""),
                    "policy": run.policy_id.name,
                    "employee_id": result.employee_id.id,
                    "employee": result.employee_id.name,
                    "department": result.department_id.name if result.department_id else "",
                    "document_id": doc.id,
                    "document": doc.name,
                    "document_type": line.document_type_id.name if line.document_type_id else "",
                    "expiry_date": str(doc.expiry_date or ""),
                })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_policy_compliance(self, **kwargs):
        policies = request.env["doc.compliance.policy"].search(
            [("active", "=", True)], order="name"
        )
        if kwargs.get("policy_id"):
            policies = policies.filtered(lambda policy: policy.id == int(kwargs["policy_id"]))
        rows = []
        for policy in policies:
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                if search not in (policy.name or "").lower():
                    continue
            scope_count = len(policy._target_employees())
            last_run = request.env["doc.compliance.evaluation.run"].search(
                [("policy_id", "=", policy.id)], order="evaluated_at desc", limit=1
            )
            compliance_rate = 0.0
            if last_run and last_run.employee_count:
                compliance_rate = round(
                    last_run.compliant_count / last_run.employee_count * 100, 2
                )
            rows.append({
                "policy_id": policy.id,
                "policy": policy.name,
                "last_run_at": str(last_run.evaluated_at if last_run else policy.last_run_at or ""),
                "employee_scope": scope_count,
                "employee_count": last_run.employee_count if last_run else 0,
                "compliant_count": last_run.compliant_count if last_run else 0,
                "compliance_rate": compliance_rate,
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_expiring_soon(self, **kwargs):
        today = fields.Date.context_today(request.env["doc.document"])
        horizon = today + timedelta(days=60)
        domain = [
            ("active", "=", True),
            ("state", "in", ["approved", "signed"]),
            ("has_expiry", "=", True),
            ("expiry_date", ">=", today),
            ("expiry_date", "<=", horizon),
        ]
        if kwargs.get("department_id"):
            domain.append(("employee_id.department_id", "=", int(kwargs["department_id"])))
        documents = request.env["doc.document"].search(domain, order="expiry_date")
        rows = []
        for doc in documents:
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                haystack = " ".join([
                    doc.name or "",
                    doc.employee_id.name or "",
                    doc.document_type_id.name if doc.document_type_id else "",
                ]).lower()
                if search not in haystack:
                    continue
            rows.append({
                "document_id": doc.id,
                "document": doc.name,
                "employee_id": doc.employee_id.id if doc.employee_id else False,
                "employee": doc.employee_id.name if doc.employee_id else "",
                "department": doc.employee_id.department_id.name
                if doc.employee_id and doc.employee_id.department_id
                else "",
                "document_type": doc.document_type_id.name if doc.document_type_id else "",
                "expiry_date": str(doc.expiry_date or ""),
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_department_compliance(self, **kwargs):
        evaluations = request.env["doc.compliance.evaluation"].search([])
        departments = {}
        for evaluation in evaluations:
            dept = evaluation.employee_id.department_id
            dept_key = dept.id if dept else 0
            dept_name = dept.name if dept else _("Unassigned")
            bucket = departments.setdefault(
                dept_key,
                {
                    "department_id": dept.id if dept else False,
                    "department": dept_name,
                    "employee_ids": set(),
                    "compliant": 0,
                    "partial": 0,
                    "non_compliant": 0,
                    "excepted": 0,
                    "total_evaluations": 0,
                },
            )
            bucket["employee_ids"].add(evaluation.employee_id.id)
            bucket["total_evaluations"] += 1
            if evaluation.status == "compliant":
                bucket["compliant"] += 1
            elif evaluation.status == "partial":
                bucket["partial"] += 1
            elif evaluation.status == "non_compliant":
                bucket["non_compliant"] += 1
            elif evaluation.status == "excepted":
                bucket["excepted"] += 1
        rows = []
        for bucket in sorted(departments.values(), key=lambda item: item["department"]):
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                if search not in bucket["department"].lower():
                    continue
            employee_count = len(bucket["employee_ids"])
            total = bucket["total_evaluations"] or 1
            rows.append({
                "department_id": bucket["department_id"],
                "department": bucket["department"],
                "employee_count": employee_count,
                "evaluation_count": bucket["total_evaluations"],
                "compliant_count": bucket["compliant"],
                "partial_count": bucket["partial"],
                "non_compliant_count": bucket["non_compliant"],
                "excepted_count": bucket["excepted"],
                "compliance_rate": round(bucket["compliant"] / total * 100, 2),
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_exceptions(self, **kwargs):
        domain = []
        if kwargs.get("policy_id"):
            domain.append(("policy_id", "=", int(kwargs["policy_id"])))
        if kwargs.get("employee_id"):
            domain.append(("employee_id", "=", int(kwargs["employee_id"])))
        records = request.env["doc.compliance.exception"].search(domain, order="valid_until desc")
        rows = []
        for record in records:
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                haystack = " ".join([
                    record.employee_id.name or "",
                    record.policy_id.name or "",
                    record.reason or "",
                ]).lower()
                if search not in haystack:
                    continue
            rows.append({
                "id": record.id,
                "employee_id": record.employee_id.id,
                "employee": record.employee_id.name,
                "department": record.employee_id.department_id.name
                if record.employee_id.department_id
                else "",
                "policy_id": record.policy_id.id,
                "policy": record.policy_id.name,
                "reason": record.reason,
                "valid_until": str(record.valid_until),
                "status": record.status,
                "active": record.active,
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    def _report_employee_scores(self, **kwargs):
        evaluations = request.env["doc.compliance.evaluation"].search([])
        employees = {}
        for evaluation in evaluations:
            bucket = employees.setdefault(
                evaluation.employee_id.id,
                {
                    "employee_id": evaluation.employee_id.id,
                    "employee": evaluation.employee_id.name,
                    "department": evaluation.employee_id.department_id.name
                    if evaluation.employee_id.department_id
                    else "",
                    "policy_count": 0,
                    "score_total": 0.0,
                    "compliant": 0,
                    "partial": 0,
                    "non_compliant": 0,
                    "excepted": 0,
                },
            )
            bucket["policy_count"] += 1
            bucket["score_total"] += evaluation.score
            if evaluation.status == "compliant":
                bucket["compliant"] += 1
            elif evaluation.status == "partial":
                bucket["partial"] += 1
            elif evaluation.status == "non_compliant":
                bucket["non_compliant"] += 1
            elif evaluation.status == "excepted":
                bucket["excepted"] += 1
        rows = []
        for bucket in sorted(employees.values(), key=lambda item: item["employee"]):
            if kwargs.get("search"):
                search = str(kwargs["search"]).strip().lower()
                haystack = " ".join([
                    bucket["employee"] or "",
                    bucket["department"] or "",
                ]).lower()
                if search not in haystack:
                    continue
            avg_score = round(
                bucket["score_total"] / bucket["policy_count"], 2
            ) if bucket["policy_count"] else 0.0
            rows.append({
                **bucket,
                "average_score": avg_score,
            })
        page_slice, total, page, page_size = self._paginate(
            rows,
            kwargs.get("page"),
            kwargs.get("page_size"),
            export=kwargs.get("export"),
        )
        return {
            "success": True,
            "total": total,
            "page": page,
            "page_size": page_size,
            "data": page_slice,
        }

    @http.route(
        "/api/compliance/exceptions",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def exceptions(self, employee_id=None, policy_id=None, **kwargs):
        domain = []
        if employee_id:
            domain.append(("employee_id", "=", int(employee_id)))
        if policy_id:
            domain.append(("policy_id", "=", int(policy_id)))
        records = request.env["doc.compliance.exception"].search(domain)
        return {
            "success": True,
            "count": len(records),
            "data": [
                {
                    "id": record.id,
                    "employee_id": record.employee_id.id,
                    "employee": record.employee_id.name,
                    "policy_id": record.policy_id.id,
                    "policy": record.policy_id.name,
                    "reason": record.reason,
                    "valid_until": str(record.valid_until),
                    "status": record.status,
                    "active": record.active,
                }
                for record in records
            ],
        }

    @http.route(
        "/api/compliance/exceptions/create",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def create_exception(self, **kwargs):
        employee_ids = kwargs.get("employee_ids") or ([kwargs.get("employee_id")] if kwargs.get("employee_id") else [])
        employees = request.env["hr.employee"].browse(employee_ids).exists()
        policy = (
            request.env["doc.compliance.policy"]
            .browse(kwargs.get("policy_id"))
            .exists()
        )
        if (
            not employees
            or not policy
            or not kwargs.get("reason")
            or not kwargs.get("valid_until")
        ):
            return {
                "success": False,
                "message": "Employee, policy, reason, and valid-until date are required.",
            }
        is_admin = request.env.user.has_group(
            "cleon_document_management.group_document_admin"
        )
        if not policy.allow_waiver and not is_admin:
            return {
                "success": False,
                "message": "This policy does not allow waiver or exemption requests.",
            }
        exceptions = request.env["doc.compliance.exception"].create([
            {
                "employee_id": employee.id,
                "policy_id": policy.id,
                "reason": kwargs["reason"],
                "valid_until": kwargs["valid_until"],
            }
            for employee in employees
        ])
        return {
            "success": True,
            "data": [{"id": exception.id, "employee_id": exception.employee_id.id, "policy_id": exception.policy_id.id, "status": exception.status, "active": exception.active} for exception in exceptions],
        }

    def _get_exception(self, exception_id):
        return request.env["doc.compliance.exception"].browse(exception_id).exists()

    @http.route(
        "/api/compliance/exceptions/<int:exception_id>/deactivate",
        type="json", auth="user", methods=["POST"], csrf=False,
    )
    def deactivate_exception(self, exception_id, **kwargs):
        exception = self._get_exception(exception_id)
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_deactivate()
        return {"success": True, "active": exception.active}

    @http.route(
        "/api/compliance/exceptions/<int:exception_id>/reactivate",
        type="json", auth="user", methods=["POST"], csrf=False,
    )
    def reactivate_exception(self, exception_id, **kwargs):
        exception = self._get_exception(exception_id)
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_reactivate()
        return {"success": True, "active": exception.active}

    @http.route(
        "/api/compliance/exceptions/<int:exception_id>/delete",
        type="json", auth="user", methods=["POST"], csrf=False,
    )
    def delete_exception(self, exception_id, **kwargs):
        exception = self._get_exception(exception_id)
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_delete()
        return {"success": True, "message": "Exception deleted."}

    @http.route(
        "/api/compliance/exceptions/<int:exception_id>/approve",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def approve_exception(self, exception_id, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        exception = (
            request.env["doc.compliance.exception"].browse(exception_id).exists()
        )
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_approve()
        return {"success": True, "status": exception.status}

    @http.route(
        "/api/compliance/exceptions/<int:exception_id>/reject",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def reject_exception(self, exception_id, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
        exception = (
            request.env["doc.compliance.exception"].browse(exception_id).exists()
        )
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_reject()
        return {"success": True, "status": exception.status}

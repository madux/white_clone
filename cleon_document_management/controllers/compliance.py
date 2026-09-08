from odoo import fields, http
from odoo.http import request


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
        return {
            "id": run.id,
            "policy_id": run.policy_id.id,
            "policy": run.policy_id.name,
            "run_type": run.run_type,
            "evaluated_at": str(run.evaluated_at or ""),
            "employee_count": run.employee_count,
            "compliant_count": run.compliant_count,
            "partial_count": run.partial_count,
            "non_compliant_count": run.non_compliant_count,
            "excepted_count": run.excepted_count,
        }

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
                        "location": (
                            getattr(employee, "work_location_id", False).name
                            if getattr(employee, "work_location_id", False)
                            else (
                                getattr(employee, "address_id", False).city
                                if getattr(employee, "address_id", False)
                                else ""
                            )
                        ) or "",
                    }
                    for employee in employees
                ],
                "departments": [
                    {"id": department.id, "name": department.name}
                    for department in departments
                ],
                "grades": [{"id": grade.id, "name": grade.name} for grade in grades],
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
        domain = []
        if kwargs.get("active_only", True):
            domain.append(("active", "=", True))
        policies = request.env["doc.compliance.policy"].search(domain)
        return {
            "success": True,
            "count": len(policies),
            "data": [self._policy_data(policy) for policy in policies],
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

        if (
            applies_to == "all"
            or (applies_to == "department" and not dept_ids)
            or (applies_to == "grade" and not grade_ids)
            or (applies_to == "employee" and not emp_ids)
        ):
            applies_to = "all"
            dept_ids = []
            grade_ids = []
            emp_ids = []

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
            "escalate_manager_days": kwargs.get("escalate_manager_days", 15),
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
        policy = request.env["doc.compliance.policy"].create(values)
        return {"success": True, "data": self._policy_data(policy)}

    @http.route(
        "/api/compliance/policies/update",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def update_policy(self, **kwargs):
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

        if (
            target_applies == "all"
            or (target_applies == "department" and not dept_ids)
            or (target_applies == "grade" and not grade_ids)
            or (target_applies == "employee" and not emp_ids)
        ):
            values["applies_to"] = "all"
            values["department_ids"] = [fields.Command.set([])]
            values["grade_ids"] = [fields.Command.set([])]
            values["employee_ids"] = [fields.Command.set([])]

        if "schedule" in values and values["schedule"] == "manual":
            values["schedule"] = False
        if "custom_schedule_days" in values:
            values["custom_schedule_days"] = int(values["custom_schedule_days"])
        if "minimum_documents" in values:
            values["minimum_documents"] = int(values["minimum_documents"])
        if "grace_period_days" in values:
            values["grace_period_days"] = int(values["grace_period_days"])
        policy.write(values)
        return {"success": True, "data": self._policy_data(policy)}

    @http.route("/api/compliance/policies/delete", type="json", auth="user", methods=["POST"], csrf=False)
    def delete_policy(self, id=None, **kwargs):
        policy = request.env["doc.compliance.policy"].browse(id).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        policy.unlink()
        return {"success": True, "message": "Policy deleted."}

    @http.route(
        "/api/compliance/policies/<int:policy_id>/evaluate",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def evaluate_policy(self, policy_id, **kwargs):
        if not request.env.user.has_group("cleon_document_management.group_document_manager"):
            return {"success": False, "message": "Document manager access is required."}
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

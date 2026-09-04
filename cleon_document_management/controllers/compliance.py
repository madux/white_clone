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
            "policy_type_id": policy.policy_type_id.id,
            "policy_type": policy.policy_type_id.name,
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
        }

    @staticmethod
    def _evaluation_data(evaluation):
        return {
            "id": evaluation.id,
            "policy_id": evaluation.policy_id.id,
            "policy": evaluation.policy_id.name,
            "employee_id": evaluation.employee_id.id,
            "employee": evaluation.employee_id.name,
            "score": evaluation.score,
            "status": evaluation.status,
            "complete_count": evaluation.complete_count,
            "missing_count": evaluation.missing_count,
            "evaluated_at": str(evaluation.evaluated_at or ""),
            "exception_id": evaluation.exception_id.id or False,
            "lines": [
                {
                    "id": line.id,
                    "requirement_id": line.requirement_id.id,
                    "requirement": line.requirement_id.name,
                    "document_ids": line.document_ids.ids,
                    "required_count": line.required_count,
                    "matched_count": line.matched_count,
                    "status": line.status,
                }
                for line in evaluation.line_ids
            ],
        }

    @http.route(
        "/api/compliance/targets",
        type="json",
        auth="user",
        methods=["POST"],
        csrf=False,
    )
    def compliance_targets(self, **kwargs):
        """Return named records used by policy scope selectors."""
        employees = request.env["hr.employee"].search(
            [("active", "=", True)], order="name"
        )
        departments = request.env["hr.department"].search([], order="name")
        grades = request.env["hr.grade"].search([], order="name")
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
                        "location": employee.work_location or "",
                    }
                    for employee in employees
                ],
                "departments": [
                    {"id": department.id, "name": department.name}
                    for department in departments
                ],
                "grades": [{"id": grade.id, "name": grade.name} for grade in grades],
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
        records = request.env["doc.compliance.policy.type"].search(
            [("active", "=", True)], order="name"
        )
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
        values = {
            "name": kwargs.get("name"),
            "description": kwargs.get("description", ""),
            "policy_type_id": kwargs.get("policy_type_id"),
            "document_type_ids": [
                fields.Command.set(
                    request.env["doc.document.type"]
                    .browse(kwargs.get("document_type_ids", []))
                    .exists()
                    .ids
                )
            ],
            "schedule": kwargs.get("schedule") or False,
            "custom_schedule_days": kwargs.get("custom_schedule_days", 30),
            "applies_to": kwargs.get("applies_to", "department"),
            "department_ids": [
                fields.Command.set(
                    request.env["hr.department"]
                    .browse(kwargs.get("department_ids", []))
                    .exists()
                    .ids
                )
            ],
            "grade_ids": [
                fields.Command.set(
                    request.env["hr.grade"]
                    .browse(kwargs.get("grade_ids", []))
                    .exists()
                    .ids
                )
            ],
            "employee_ids": [
                fields.Command.set(
                    request.env["hr.employee"]
                    .browse(kwargs.get("employee_ids", []))
                    .exists()
                    .ids
                )
            ],
            "minimum_documents": kwargs.get("minimum_documents", 1),
            "grace_period_days": kwargs.get("grace_period_days", 0),
            "effective_date": kwargs.get("effective_date") or False,
            "active": kwargs.get("active", True),
        }
        if not values["name"] or not values["policy_type_id"]:
            return {"success": False, "message": "Name and policy type are required."}
        policy = request.env["doc.compliance.policy"].create(values)
        return {"success": True, "data": self._policy_data(policy)}

    @http.route("/api/compliance/policies/update", type="json", auth="user", methods=["POST"], csrf=False)
    def update_policy(self, **kwargs):
        policy = request.env["doc.compliance.policy"].browse(kwargs.get("id")).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        values = {
            key: kwargs[key]
            for key in ("name", "description", "effective_date", "active", "schedule", "custom_schedule_days", "applies_to", "minimum_documents", "grace_period_days")
            if key in kwargs
        }
        if "policy_type_id" in kwargs:
            values["policy_type_id"] = request.env["doc.compliance.policy.type"].browse(int(kwargs["policy_type_id"])).exists().id
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
        policy = request.env["doc.compliance.policy"].browse(policy_id).exists()
        if not policy:
            return {"success": False, "message": "Policy not found."}
        policy.action_evaluate()
        evaluations = policy.evaluation_ids
        return {
            "success": True,
            "data": [self._evaluation_data(item) for item in evaluations],
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
        employee = request.env["hr.employee"].browse(kwargs.get("employee_id")).exists()
        policy = (
            request.env["doc.compliance.policy"]
            .browse(kwargs.get("policy_id"))
            .exists()
        )
        if (
            not employee
            or not policy
            or not kwargs.get("reason")
            or not kwargs.get("valid_until")
        ):
            return {
                "success": False,
                "message": "Employee, policy, reason, and valid-until date are required.",
            }
        exception = request.env["doc.compliance.exception"].create(
            {
                "employee_id": employee.id,
                "policy_id": policy.id,
                "reason": kwargs["reason"],
                "valid_until": kwargs["valid_until"],
            }
        )
        return {
            "success": True,
            "data": {
                "id": exception.id,
                "employee_id": exception.employee_id.id,
                "policy_id": exception.policy_id.id,
                "status": exception.status,
                "active": exception.active,
            },
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
        exception = (
            request.env["doc.compliance.exception"].browse(exception_id).exists()
        )
        if not exception:
            return {"success": False, "message": "Exception not found."}
        exception.action_reject()
        return {"success": True, "status": exception.status}

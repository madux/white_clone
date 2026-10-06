# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ComplianceEvaluationRequest(models.Model):
    _inherit = "doc.compliance.evaluation"

    @api.depends(
        "line_ids.status",
        "line_ids.compliance_status",
        "line_ids.required_count",
        "line_ids.matched_count",
        "exception_id",
        "policy_id.policy_type_id",
        "employee_id",
        "evaluated_at",
    )
    def _compute_results(self):
        request_evaluations = self.filtered(
            lambda item: item.policy_id.policy_type_id.code == "compliance_request"
        )
        for evaluation in request_evaluations:
            policy = evaluation.policy_id
            employee = evaluation.employee_id
            today = fields.Date.context_today(evaluation)
            exception = policy._active_exception_for_employee(employee, today=today)
            cycle = policy._open_request_cycle(employee)
            if not cycle:
                Cycle = evaluation.env["doc.compliance.request.cycle"].sudo()
                cycle = Cycle.search(
                    [
                        ("policy_id", "=", policy.id),
                        ("employee_id", "=", employee.id),
                    ],
                    order="opened_at desc",
                    limit=1,
                )
            payload = policy._request_cycle_status_payload(cycle, exception)
            comp = payload["compliance_status"]
            evaluation.compliance_status = comp
            evaluation.reason_code = payload["reason_code"]
            evaluation.reason_message = payload["reason_message"]
            evaluation.status = payload["status"]
            evaluation.complete_count = 1 if comp == "compliant" else 0
            evaluation.missing_count = 1 if comp == "non_compliant" else 0
            evaluation.grace_count = 1 if comp == "at_risk" else 0
            evaluation.score = 100.0 if comp == "compliant" else 0.0
        other = self - request_evaluations
        if other:
            super(ComplianceEvaluationRequest, other)._compute_results()

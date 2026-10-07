# -*- coding: utf-8 -*-
from odoo import api, fields, models


class ComplianceEvaluationReviewSchedule(models.Model):
    _inherit = "doc.compliance.evaluation"

    @api.depends(
        "employee_id",
        "policy_id",
        "policy_id.policy_type_id",
    )
    def _compute_results(self):
        review_evaluations = self.filtered(
            lambda item: item.policy_id._is_review_schedule_policy()
        )
        Review = self.env["doc.compliance.review.instance"].sudo()
        today = fields.Date.context_today(self)
        for evaluation in review_evaluations:
            policy = evaluation.policy_id
            employee = evaluation.employee_id
            reviews = Review.search(
                [
                    ("policy_id", "=", policy.id),
                    ("employee_id", "=", employee.id),
                    ("milestone_id.requirement", "=", "required"),
                ]
            )
            if not reviews:
                evaluation.write(
                    {
                        "status": "partial",
                        "compliance_status": "at_risk",
                        "reason_code": "no_reviews",
                        "reason_message": "No scheduled reviews yet.",
                        "score": 0.0,
                        "complete_count": 0,
                        "missing_count": 1,
                        "grace_count": 0,
                    }
                )
                continue
            escalated = reviews.filtered(lambda r: r.state == "escalated")
            overdue = reviews.filtered(
                lambda r: r.state in ("overdue", "in_progress", "scheduled")
                and r.due_date
                and r.due_date < today
            )
            incomplete = reviews.filtered(
                lambda r: r.state not in ("completed", "cancelled")
            )
            completed = reviews.filtered(lambda r: r.state == "completed")
            if escalated:
                comp = "non_compliant"
                status = "non_compliant"
                reason = "Review overdue after grace period."
            elif overdue and policy.review_overdue_mode == "after_due":
                comp = "at_risk"
                status = "grace"
                reason = "Review overdue."
            elif incomplete:
                comp = "at_risk"
                status = "partial"
                reason = "Reviews still open."
            else:
                comp = "compliant"
                status = "compliant"
                reason = "Required reviews complete."
            evaluation.write(
                {
                    "status": status,
                    "compliance_status": comp,
                    "reason_code": comp,
                    "reason_message": reason,
                    "score": 100.0 if comp == "compliant" else 0.0,
                    "complete_count": len(completed),
                    "missing_count": len(incomplete),
                    "grace_count": len(overdue),
                }
            )
        other = self - review_evaluations
        if other:
            super(ComplianceEvaluationReviewSchedule, other)._compute_results()

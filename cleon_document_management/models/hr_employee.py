from datetime import timedelta

from odoo import api, fields, models


class HrEmployee(models.Model):
    _inherit = "hr.employee"

    @api.model
    def _document_lifecycle_context(self):
        """Pre-compute lifecycle buckets for active employees (staff directory logic)."""
        today = fields.Date.context_today(self)
        today_end = today.strftime("%Y-%m-%d 23:59:59")
        today_start = today.strftime("%Y-%m-%d 00:00:00")

        on_leave_ids = set(
            self.env["hr.leave"]
            .search(
                [
                    ("state", "=", "validate"),
                    ("date_from", "<=", today_end),
                    ("date_to", ">=", today_start),
                ]
            )
            .mapped("employee_id")
            .ids
        )

        probation_ids = set()
        exiting_ids = set()
        try:
            probation_ids = set(
                self.env["hr.contract"]
                .search(
                    [
                        ("state", "=", "open"),
                        ("trial_date_end", "!=", False),
                        ("trial_date_end", ">=", today),
                        ("employee_id.active", "=", True),
                    ]
                )
                .mapped("employee_id")
                .ids
            )
            in_60 = today + timedelta(days=60)
            exiting_ids = set(
                self.env["hr.contract"]
                .search(
                    [
                        ("state", "=", "open"),
                        ("date_end", "!=", False),
                        ("date_end", ">=", today),
                        ("date_end", "<=", in_60),
                        ("employee_id.active", "=", True),
                    ]
                )
                .mapped("employee_id")
                .ids
            )
        except Exception:
            pass

        return {
            "on_leave_ids": on_leave_ids,
            "probation_ids": probation_ids,
            "exiting_ids": exiting_ids,
        }

    def get_document_lifecycle_status(self, lifecycle_context=None):
        """Return active, probation, on_leave, or suspended (exiting mapped to suspended)."""
        self.ensure_one()
        context = lifecycle_context or self._document_lifecycle_context()
        if self.id in context["on_leave_ids"]:
            return "on_leave"
        if self.id in context["probation_ids"]:
            return "probation"
        if self.id in context["exiting_ids"]:
            return "suspended"
        return "active"

    @api.model
    def _pending_document_employee_ids(self, employee_ids=None):
        """Employees with pending approval docs or docs in the pending-uploads folder."""
        Document = self.env["doc.document"]
        domain = [("employee_id", "!=", False)]
        if employee_ids:
            domain.append(("employee_id", "in", list(employee_ids)))

        pending_ids = set(
            Document.search(domain + [("approval_state", "=", "pending")]).mapped(
                "employee_id"
            ).ids
        )

        pending_folder = self.env["doc.folder"].get_pending_upload_folder()
        if pending_folder:
            pending_ids.update(
                Document.search(
                    domain + [("folder_id", "=", pending_folder.id)]
                ).mapped("employee_id").ids
            )
        return pending_ids

    def has_pending_documents(self, pending_ids=None):
        self.ensure_one()
        pending_ids = pending_ids if pending_ids is not None else self._pending_document_employee_ids(
            self.ids
        )
        return self.id in pending_ids

    @api.model_create_multi
    def create(self, vals_list):
        employees = super().create(vals_list)
        for employee in employees:
            self.env["doc.folder"].link_employee_to_department_folder(employee)
        self.env["doc.compliance.policy"]._trigger_lifecycle_event(employees, "onboarding")
        return employees

    def write(self, vals):
        result = super().write(vals)
        if "department_id" in vals:
            for employee in self:
                self.env["doc.folder"].link_employee_to_department_folder(employee)
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "department_transfer")
        if "job_id" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "promotion")
        if "address_id" in vals or "work_location_id" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "location_change")
        if "marital" in vals:
            self.env["doc.compliance.policy"]._trigger_lifecycle_event(self, "marital_status_change")
        return result

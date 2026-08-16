from odoo import _, api, fields, models
from odoo.exceptions import UserError

from .hr_expense_app_contract import serialize_records


class HrExpenseAppOperations(models.AbstractModel):
    """Expose claim, request, advance, and workflow pages to OWL."""

    _inherit = "hr.expense.app"

    @api.model
    def _get_request_page(self, page):
        """Return request records, KPIs, options, and chart data for the page."""
        Request = self.env["hr.expense.request"]
        requests = Request.search([], order="submitted_date desc, id desc", limit=200)
        states = {key: 0 for key in ("draft", "submitted", "approved", "fulfilled", "rejected", "returned", "cancelled")}
        for request in requests:
            states[request.state] += 1
        type_records = self.env["hr.expense.request.type"].search(
            [("active", "=", True)], order="sequence, name"
        )
        return {
            "available": True,
            "kpis": {
                "total": len(requests), "pending": states["submitted"],
                "approved": states["approved"] + states["fulfilled"],
                "rejected": states["rejected"],
            },
            "request_types": serialize_records(type_records, {
                "id": "id", "name": "name", "creates_advance": "creates_advance",
                "minimum": "minimum_amount", "maximum": "maximum_amount",
            }),
            "records": [self._serialize_request(request) for request in requests],
            "charts": {"series": [{"label": dict(Request._fields["state"].selection).get(key), "value": value} for key, value in states.items() if value]},
        }

    @api.model
    def _get_dashboard_section(self, page):
        """Return dashboard KPIs, trends, and recent workflow activity."""
        dashboard = self.env["hr.claim"].get_dashboard_data()
        if page == "quick":
            can_submit = self._expense_has_role("employee", "admin")
            records = [{"id": 3, "name": _("Claims"), "description": _("Review your visible claim history."), "action": "claims", "state": "ready"}]
            if can_submit:
                records[0:0] = [
                    {"id": 1, "name": _("New Claim"), "description": _("Create and submit an employee expense claim."), "action": "new_claim", "state": "ready"},
                    {"id": 2, "name": _("New Request"), "description": _("Request pre-approval or a cash advance."), "action": "new_request", "state": "ready"},
                ]
        elif page == "recent":
            records = [{"id": item["id"], "name": item["name"], "description": item["title"], "employee": item["employee"], "amount": item["amount"], "state": item["state"], "state_label": item["state_label"], "action": "claim"} for item in dashboard.get("recent", [])]
        elif page == "tasks":
            activities = self.env["mail.activity"].search([("user_id", "=", self.env.user.id)], order="date_deadline, id", limit=100)
            records = [{"id": item.id, "name": item.summary or item.activity_type_id.name, "description": item.note or "", "model": item.res_model, "reference": item.res_name, "date": item.date_deadline, "state": "overdue" if item.date_deadline and item.date_deadline < fields.Date.context_today(item) else "pending"} for item in activities]
        elif page == "announcements":
            records = [{"id": 1, "name": _("Expense workspace is ready"), "description": _("Use the module navigation to submit, approve, pay, reconcile, report, and configure expenses."), "date": fields.Date.context_today(self), "state": "active"}]
        else:
            records = []
        return {"available": True, "records": records, "kpis": dashboard.get("kpis", {})}

    @api.model
    def _get_claims_page(self, page):
        """Return claim records, KPIs, options, and chart data for the page."""
        claims = self.env["hr.claim"].search([], order="create_date desc", limit=200)
        claim_types = self.env["hr.claim.type"].with_context(active_test=False).search([], order="sequence, name")
        windows = self.env["hr.claim.window"].with_context(active_test=False).search([], order="window_type, name")
        if page == "types":
            records = [{
                "id": item.id, "code": item.code, "name": item.name,
                "category": item.category_id.name, "amount_type": dict(item._fields["amount_type"].selection).get(item.amount_type),
                "maximum": item.maximum_per_claim or item.maximum_amount, "receipt": dict(item._fields["receipt_policy"].selection).get(item.receipt_policy),
                "approval": dict(item._fields["approval_type"].selection).get(item.approval_type),
                "state": "active" if item.active else "inactive",
            } for item in claim_types]
        elif page == "windows":
            records = [{
                "id": item.id, "name": item.name, "type": dict(item._fields["window_type"].selection).get(item.window_type),
                "duration": item.duration_days, "start": item.start_date, "end": item.end_date,
                "claim_types": len(item.claim_type_ids), "state": "active" if item.active else "inactive",
            } for item in windows]
        elif page == "assignments":
            records = []
            for item in claim_types.filtered(lambda record: record.eligibility == "restricted"):
                for employee in item.employee_ids:
                    records.append({"id": "e-%s-%s" % (item.id, employee.id), "name": item.name, "type": _("Employee"), "assignee": employee.name, "department": employee.department_id.name or "", "state": "active"})
                for department in item.department_ids:
                    records.append({"id": "d-%s-%s" % (item.id, department.id), "name": item.name, "type": _("Department"), "assignee": department.name, "department": department.name, "state": "active"})
        else:
            records = [{
                "id": item.id, "name": item.name, "title": item.title,
                "employee": item.employee_id.name, "department": item.department_id.name or _("No Department"),
                "type": item.claim_type_id.name, "amount": item.amount_total,
                "date": item.expense_start_date, "state": item.state,
                "state_label": dict(item._fields["state"].selection).get(item.state),
                "can_appeal": item.state == "rejected"
                    and self.env.company.expense_enable_appeals
                    and (item._is_owner() or item._is_admin()),
            } for item in claims]
        return {
            "available": True, "records": records,
            "kpis": {"total": len(claims), "types": len(claim_types), "windows": len(windows), "submitted": len(claims.filtered(lambda item: item.state == "submitted")), "approved": len(claims.filtered(lambda item: item.state == "approved"))},
            "claim_options": {
                "types": [{"id": item.id, "name": item.name, "receipt_policy": item.receipt_policy} for item in claim_types.filtered("active")],
                "categories": [{"key": key, "label": label} for key, label in self.env["hr.claim.line"]._fields["category"].selection],
                "claim_categories": [{"id": item.id, "name": item.name} for item in self.env["hr.claim.category"].search([])],
            },
        }

    @api.model
    def app_create_claim(self, values):
        """Execute the server-authorized create claim operation for the OWL application."""
        employee = self.env["hr.claim"]._default_employee()
        if not employee:
            raise UserError(_("Your user is not linked to an employee in this company."))
        line_values = values.get("lines") or [{
            "category": values.get("category"),
            "description": values.get("line_description"),
            "amount": values.get("amount"),
            "receipt_reference": values.get("receipt_reference"),
        }]
        if not line_values:
            raise UserError(_("Add at least one expense line."))
        claim = self.env["hr.claim"].create({
            "employee_id": employee.id, "claim_type_id": int(values.get("claim_type_id")),
            "title": (values.get("title") or "").strip(), "description": (values.get("description") or "").strip(),
            "money_type": values.get("money_type") or "personal",
            "expense_start_date": values.get("expense_date"), "expense_end_date": values.get("expense_date"),
            "line_ids": [(0, 0, {
                "description": (line.get("description") or values.get("title") or "").strip(),
                "category": line.get("category") or "other", "amount": float(line.get("amount") or 0),
                "expense_date": values.get("expense_date"), "receipt_reference": (line.get("receipt_reference") or "").strip() or False,
            }) for line in line_values],
        })
        if values.get("receipt_data"):
            attachment = self._app_create_attachment(
                values.get("receipt_name") or _("Receipt"), values["receipt_data"],
                values.get("receipt_mimetype") or "application/octet-stream", claim,
            )
            claim.write({"attachment_ids": [(4, attachment.id)]})
        if values.get("submit"):
            claim.action_submit()
        self.env["hr.expense.audit"].log_event("claims", "claim_created", _("Claim created from the OWL application."), claim, "user", origin="owl")
        return {"id": claim.id, "name": claim.name}

    @api.model
    def _app_create_attachment(self, name, data, mimetype, record):
        return self.env["ir.attachment"].sudo().create({
            "name": name, "datas": data, "mimetype": mimetype,
            "res_model": record._name, "res_id": record.id,
            "company_id": record.company_id.id if "company_id" in record._fields else self.env.company.id,
            "public": False,
        })

    @api.model
    def _serialize_request(self, request):
        return {
            "id": request.id, "name": request.name,
            "employee": request.employee_id.name,
            "department": request.department_id.name or _("No Department"),
            "type": request.request_type_id.name,
            "creates_advance": request.request_type_id.creates_advance,
            "purpose": request.purpose, "description": request.description or "",
            "amount": request.amount, "needed_date": request.needed_date,
            "submitted_date": request.submitted_date,
            "state": request.state,
            "state_label": dict(request._fields["state"].selection).get(request.state),
            "advance_id": request.advance_id.id or False,
            "can_submit": request.state in ("draft", "returned") and (request._is_owner() or request._is_admin()),
            "can_decide": request.state == "submitted" and (request._is_manager() or request._is_admin()),
            "can_issue": request.state == "approved" and request.request_type_id.creates_advance
                and self._expense_has_role("finance", "admin"),
        }

    @api.model
    def _get_advance_page(self, page):
        """Return advance records, KPIs, options, and chart data for the page."""
        advances = self.env["hr.cash.advance"].search(
            [], order="issue_date desc, id desc", limit=200
        )
        outstanding = advances.filtered(lambda item: item.state in ("outstanding", "partial"))
        overdue = outstanding.filtered(lambda item: item.retirement_due_date < fields.Date.context_today(item))
        can_finance = self._expense_has_role("finance", "admin")
        issuable = self.env["hr.expense.request"]
        if can_finance:
            issuable = self.env["hr.expense.request"].search([
                ("state", "=", "approved"), ("request_type_id.creates_advance", "=", True),
                ("advance_id", "=", False),
            ], order="decision_date")
        writeoffs = self.env["hr.cash.advance.writeoff"].search([], order="request_date desc, id desc", limit=200) if can_finance else self.env["hr.cash.advance.writeoff"]
        if page == "writeoffs":
            records = [{"id": item.id, "name": item.name, "advance": item.advance_id.name, "employee": item.advance_id.employee_id.name, "amount": item.amount, "reason": item.reason, "date": item.request_date, "state": item.state, "state_label": dict(item._fields["state"].selection).get(item.state), "can_decide": item.state == "submitted" and self._expense_has_role("admin")} for item in writeoffs]
        else:
            records = [{
                "id": item.id, "name": item.name, "employee": item.employee_id.name,
                "department": item.department_id.name or _("No Department"),
                "issued": item.issued_amount, "retired": item.retired_amount,
                "outstanding": item.outstanding_amount, "issue_date": item.issue_date,
                "due_date": item.retirement_due_date, "days": item.days_outstanding,
                "age": dict(item._fields["age_bracket"].selection).get(item.age_bracket),
                "state": item.state,
                "state_label": dict(item._fields["state"].selection).get(item.state),
                "can_retire": item.state in ("outstanding", "partial") and can_finance,
                "can_writeoff": item.state in ("outstanding", "partial") and can_finance,
            } for item in advances]
        return {
            "available": True,
            "kpis": {
                "total_outstanding": sum(outstanding.mapped("outstanding_amount")),
                "active": len(outstanding), "overdue": len(overdue),
                "critical": len(outstanding.filtered(lambda item: item.outstanding_amount >= 100000)),
            },
            "can_finance": can_finance,
            "issuable_requests": [self._serialize_request(request) for request in issuable],
            "records": records,
            "advance_options": [{"id": item.id, "name": "%s · %s" % (item.name, item.employee_id.name), "outstanding": item.outstanding_amount} for item in outstanding],
            "charts": {"series": [{"label": label, "value": sum(outstanding.filtered(lambda advance: advance.age_bracket == key).mapped("outstanding_amount"))} for key, label in self.env["hr.cash.advance"]._fields["age_bracket"].selection]},
        }

    @api.model
    def _get_workflow_page(self, page):
        """Return approval rules, pending steps, KPIs, and page options."""
        self._expense_check_role(
            "manager", "admin", message=_("Only Managers can access the approval workspace.")
        )
        if page in ("rules", "claim_rules", "request_rules"):
            domain = []
            if page == "claim_rules":
                domain = [("target", "=", "claim")]
            elif page == "request_rules":
                domain = [("target", "=", "request")]
            rules = self.env["hr.expense.approval.rule"].search(domain, order="sequence, id")
            return {
                "available": True,
                "kpis": {"rules": len(rules), "active": len(rules.filtered("active"))},
                "records": [{
                    "id": rule.id, "name": rule.name,
                    "target": dict(rule._fields["target"].selection).get(rule.target),
                    "department": rule.department_id.name or _("All Departments"),
                    "minimum": rule.minimum_amount, "maximum": rule.maximum_amount,
                    "levels": len(rule.line_ids), "active": rule.active,
                } for rule in rules],
                "rule_page": True,
            }
        claim_domain = [("state", "in", ("submitted", "appealed"))]
        request_domain = [("state", "=", "submitted")]
        if page == "approved":
            claim_domain = [("state", "in", ("approved", "paid"))]
            request_domain = [("state", "in", ("approved", "fulfilled"))]
        elif page == "rejected":
            claim_domain = [("state", "=", "rejected")]
            request_domain = [("state", "=", "rejected")]
        claims = self.env["hr.claim"].search(claim_domain, order="submitted_date desc", limit=100)
        requests = self.env["hr.expense.request"].search(request_domain, order="submitted_date desc", limit=100)
        records = [{
            "kind": "claim", "kind_label": _("Claim"), "id": claim.id,
            "reference": claim.name, "employee": claim.employee_id.name,
            "department": claim.department_id.name or _("No Department"),
            "description": claim.title, "amount": claim.amount_total,
            "date": claim.submitted_date, "state": claim.state,
        } for claim in claims]
        records += [{
            "kind": "request", "kind_label": _("Request"), "id": request.id,
            "reference": request.name, "employee": request.employee_id.name,
            "department": request.department_id.name or _("No Department"),
            "description": request.purpose, "amount": request.amount,
            "date": request.submitted_date, "state": request.state,
        } for request in requests]
        records.sort(key=lambda item: str(item["date"] or ""), reverse=True)
        return {
            "available": True,
            "kpis": {
                "awaiting": len(records) if page not in ("approved", "rejected") else 0,
                "claims": len(claims), "requests": len(requests),
                "total_value": sum(item["amount"] for item in records),
            },
            "records": records,
            "charts": {"series": [{"label": _("Claims"), "value": len(claims)}, {"label": _("Requests"), "value": len(requests)}]},
        }

    @api.model
    def app_create_request(self, values):
        """Execute the server-authorized create request operation for the OWL application."""
        employee = self.env["hr.expense.request"]._default_employee()
        if not employee:
            raise UserError("Your user is not linked to an employee in this company.")
        request = self.env["hr.expense.request"].create({
            "employee_id": employee.id,
            "request_type_id": int(values.get("request_type_id")),
            "purpose": (values.get("purpose") or "").strip(),
            "description": (values.get("description") or "").strip(),
            "amount": float(values.get("amount") or 0),
            "needed_date": values.get("needed_date"),
        })
        if values.get("receipt_data"):
            attachment = self._app_create_attachment(
                values.get("receipt_name") or _("Request Document"), values["receipt_data"],
                values.get("receipt_mimetype") or "application/octet-stream", request,
            )
            request.write({"attachment_ids": [(4, attachment.id)]})
        if values.get("submit"):
            request.action_submit()
        self.env["hr.expense.audit"].log_event("requests", "request_created", _("Expense request created from the OWL application."), request, "user", origin="owl")
        return {"id": request.id, "name": request.name}

    @api.model
    def app_request_action(self, request_id, action, comment=None):
        """Execute the server-authorized request action operation for the OWL application."""
        request = self.env["hr.expense.request"].browse(int(request_id)).exists()
        if not request:
            raise UserError("The request no longer exists.")
        if action == "submit":
            request.action_submit()
        elif action == "approve":
            request.action_approve(comment)
        elif action == "reject":
            request.action_reject(comment)
        elif action == "return":
            request.action_return(comment)
        elif action == "issue":
            request.action_issue_advance()
        else:
            raise UserError("Unsupported request action.")
        self.env["hr.expense.audit"].log_event("requests", "request_%s" % action, _("Request workflow action completed."), request, "workflow", {"comment": comment or ""}, origin="owl")
        return True

    @api.model
    def app_workflow_decision(self, kind, record_id, decision, comment=None):
        """Execute the server-authorized workflow decision operation for the OWL application."""
        if kind == "claim":
            record = self.env["hr.claim"].browse(int(record_id)).exists()
            if decision == "approve":
                record.action_approve(comment)
            elif decision in ("reject", "return"):
                record._apply_negative_decision(decision, comment)
            elif decision == "appeal":
                record.action_appeal(comment)
            else:
                raise UserError("Unsupported claim decision.")
        elif kind == "request":
            return self.app_request_action(record_id, decision, comment)
        else:
            raise UserError("Unsupported approval record type.")
        return True

    @api.model
    def app_retire_advance(self, advance_id, amount, reference=None):
        """Execute the server-authorized retire advance operation for the OWL application."""
        advance = self.env["hr.cash.advance"].browse(int(advance_id)).exists()
        if not advance:
            raise UserError("The cash advance no longer exists.")
        advance.action_retire(amount, reference)
        self.env["hr.expense.audit"].log_event("advances", "advance_retired", _("Cash advance retirement posted."), advance, "workflow", {"amount": amount, "reference": reference or ""}, origin="owl")
        return True

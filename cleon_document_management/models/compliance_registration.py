from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError


class CompliancePolicyType(models.Model):
    _name = "doc.compliance.policy.type"
    _description = "Compliance Policy Type"

    name = fields.Char(required=True)
    code = fields.Selection(
        [
            ("document_requirement", "Document Requirement"),
            ("renewable_document", "Renewable Document"),
            ("compliance_request", "Compliance Request"),
            ("retention", "Retention"),
        ],
        required=True,
    )
    description = fields.Text()
    active = fields.Boolean(default=True)


class CompliancePolicy(models.Model):
    _name = "doc.compliance.policy"
    _description = "Compliance Policy"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _order = "effective_date desc, name"

    name = fields.Char(required=True, tracking=True)
    policy_type_id = fields.Many2one(
        "doc.compliance.policy.type", required=True, ondelete="restrict"
    )
    description = fields.Text()
    document_type_ids = fields.Many2many(
        "doc.document.type",
        "doc_compliance_policy_document_type_rel",
        "policy_id",
        "document_type_id",
        required=True,
    )
    schedule = fields.Selection(
        [
            ("one_time", "One Time"),
            ("daily", "Daily"),
            ("weekly", "Weekly"),
            ("monthly", "Monthly"),
            ("quarterly", "Quarterly"),
            ("semi_annually", "Semi-annually"),
            ("annually", "Annually"),
            ("custom", "Custom"),
        ],
        help="Leave empty to run this policy manually.",
    )
    custom_schedule_days = fields.Integer(default=30)
    applies_to = fields.Selection(
        [
            ("all", "All Employees"),
            ("department", "Departments"),
            ("grade", "Grades"),
            ("employee", "Employees"),
        ],
        required=True,
        default="department",
    )
    department_ids = fields.Many2many(
        "hr.department",
        "doc_compliance_policy_department_rel",
        "policy_id",
        "department_id",
        string="Departments",
    )
    grade_ids = fields.Many2many(
        "hr.grade",
        "doc_compliance_policy_grade_rel",
        "policy_id",
        "grade_id",
        string="Grades",
    )
    employee_ids = fields.Many2many(
        "hr.employee",
        "doc_compliance_policy_employee_rel",
        "policy_id",
        "employee_id",
        string="Employees",
    )
    requirement_ids = fields.One2many(
        "doc.compliance.requirement",
        "policy_id",
        string="Requirements",
    )
    auto_requirement_id = fields.Many2one(
        "doc.compliance.requirement",
        string="Primary Requirement",
        ondelete="set null",
        copy=False,
    )
    minimum_documents = fields.Integer(default=1)
    grace_period_days = fields.Integer(string="Grace Period (Days)", default=0)
    effective_date = fields.Date(default=fields.Date.context_today)
    active = fields.Boolean(default=True, tracking=True)
    last_run_at = fields.Datetime(readonly=True)
    next_run_at = fields.Datetime(readonly=True)
    evaluation_ids = fields.One2many(
        "doc.compliance.evaluation",
        "policy_id",
        string="Evaluations",
    )
    # Document Requirement specific fields
    allow_waiver = fields.Boolean(
        string="Allow Waiver / Exemption",
        default=True,
        help="Whether HR Admins can grant exemptions/waivers for required documents.",
    )

    # Renewable Document specific fields
    alert_schedule_days = fields.Char(
        string="Alert Cadence (Days)",
        default="60,30,15,7,0",
        help="Comma-separated list of days prior to expiration to send automated alerts.",
    )
    escalate_manager_days = fields.Integer(
        string="Escalate to Manager (Days)",
        default=15,
        help="Days before expiration when the line manager is notified.",
    )
    escalate_hr_days = fields.Integer(
        string="Escalate to HR (Days)",
        default=7,
        help="Days before expiration when HR admin is CC'd.",
    )
    auto_request_renewal = fields.Boolean(
        string="Auto-generate Renewal Task",
        default=True,
        help="Automatically generate a document renewal task upon entering expiration window.",
    )

    # Compliance Request specific fields
    event_trigger = fields.Selection(
        [
            ("onboarding", "Onboarding"),
            ("promotion", "Promotion"),
            ("department_transfer", "Department Transfer"),
            ("location_change", "Location Change"),
            ("marital_status_change", "Marital Status Change"),
        ],
        string="Lifecycle Event Trigger",
        help="Backend lifecycle event that triggers document collection.",
    )
    due_days = fields.Integer(
        string="Due Days After Event",
        default=14,
        help="Deadline in days relative to the lifecycle event trigger date.",
    )
    reminder_frequency_days = fields.Integer(
        string="Reminder Frequency (Days)",
        default=3,
        help="Frequency of automated reminders for unfulfilled requests.",
    )
    assigned_reviewer_id = fields.Many2one(
        "res.users",
        string="Assigned HR Reviewer (Admin)",
        domain="[('groups_id', 'in', [ref('cleon_document_management.group_document_manager')])]",
        help="Document Manager / Admin responsible for reviewing submitted documents.",
    )

    # Review Schedule / Audit specific fields
    audit_frequency = fields.Selection(
        [
            ("monthly", "Monthly"),
            ("quarterly", "Quarterly"),
            ("semi_annually", "Semi-Annually"),
            ("annually", "Annually"),
        ],
        string="Audit Frequency",
        default="quarterly",
    )
    sample_pct = fields.Integer(
        string="Audit Sampling %",
        default=100,
        help="Percentage of employee folders to sample for audit (1 to 100%).",
    )
    assigned_auditor_id = fields.Many2one(
        "res.users",
        string="Assigned HR Auditor (Admin)",
        domain="[('groups_id', 'in', [ref('cleon_document_management.group_document_manager')])]",
        help="Document Manager / Admin responsible for conducting audits.",
    )

    @api.constrains("minimum_documents", "grace_period_days", "custom_schedule_days")
    def _check_positive_values(self):
        for policy in self:
            if policy.minimum_documents < 1 or policy.grace_period_days < 0:
                raise ValidationError(
                    _(
                        "Minimum documents must be at least 1 and grace period cannot be negative."
                    )
                )
            if policy.schedule == "custom" and policy.custom_schedule_days < 1:
                raise ValidationError(_("A custom schedule must be at least 1 day."))

    @api.constrains("document_type_ids")
    def _check_document_types(self):
        for policy in self:
            if not policy.document_type_ids:
                raise ValidationError(_("Select at least one required document type."))

    @api.constrains("applies_to", "department_ids", "grade_ids", "employee_ids")
    def _check_scope(self):
        for policy in self:
            if policy.applies_to == "all":
                continue
            scoped = {
                "department": policy.department_ids,
                "grade": policy.grade_ids,
                "employee": policy.employee_ids,
            }
            if not scoped.get(policy.applies_to):
                raise ValidationError(
                    _("Select at least one target for the chosen policy scope.")
                )

    def _is_document_admin(self):
        return (
            self.env.user.has_group("base.group_system")
            or self.env.user.has_group("cleon_document_management.group_document_admin")
        )

    def _sudo_evaluation_env(self):
        return self.env["doc.compliance.evaluation"].sudo()

    @api.model
    def _evaluate_documents(self, documents):
        employees = documents.mapped("employee_id").filtered("id")
        if not employees:
            return
        for policy in self.search([("active", "=", True)]):
            for employee in employees:
                if policy._applies_to_employee(employee):
                    policy.evaluate_employee(employee)

    @api.model
    def _schedule_delta(self, schedule, custom_days=0):
        return {
            "daily": relativedelta(days=1),
            "weekly": relativedelta(weeks=1),
            "monthly": relativedelta(months=1),
            "quarterly": relativedelta(months=3),
            "semi_annually": relativedelta(months=6),
            "annually": relativedelta(years=1),
            "custom": relativedelta(days=custom_days),
        }.get(schedule)

    @api.model_create_multi
    def create(self, vals_list):
        if not self._is_document_admin():
            raise AccessError(_("Only document administrators can create compliance policies."))
        policies = super().create(vals_list)
        Requirement = self.env["doc.compliance.requirement"]
        for policy in policies:
            policy.auto_requirement_id = Requirement.create(
                {
                    "name": policy.name,
                    "policy_id": policy.id,
                    "minimum_documents": policy.minimum_documents,
                    "grace_period_days": policy.grace_period_days,
                    "active": policy.active,
                }
            )
        policies.action_set_next_run()
        policies.action_evaluate(run_type="automatic")
        return policies

    def write(self, vals):
        if not self._is_document_admin():
            raise AccessError(_("Only document administrators can edit compliance policies."))
        result = super().write(vals)
        if {"schedule", "custom_schedule_days", "effective_date"}.intersection(vals):
            self.action_set_next_run()
        if {"name", "minimum_documents", "grace_period_days", "active"}.intersection(vals):
            for policy in self:
                if policy.auto_requirement_id:
                    policy.auto_requirement_id.write(
                        {
                            field_name: vals[field_name]
                            for field_name in ("name", "minimum_documents", "grace_period_days", "active")
                            if field_name in vals
                        }
                    )
        reevaluate_fields = {
            "document_type_ids",
            "applies_to",
            "department_ids",
            "grade_ids",
            "employee_ids",
            "minimum_documents",
            "grace_period_days",
            "active",
            "effective_date",
        }
        if reevaluate_fields.intersection(vals):
            self.action_evaluate(run_type="automatic")
        return result

    def unlink(self):
        if not self._is_document_admin():
            raise AccessError(_("Only document administrators can delete compliance policies."))
        return super().unlink()

    def action_run_now(self):
        self.action_evaluate()

    def action_set_next_run(self):
        for policy in self:
            delta = self._schedule_delta(policy.schedule, policy.custom_schedule_days)
            if not delta:
                policy.next_run_at = False
                continue
            today = fields.Date.context_today(policy)
            if policy.effective_date and policy.effective_date > today and not policy.last_run_at:
                # A future policy gets its first automatic check on its
                # effective date. Once it has run, each subsequent run is
                # measured from the actual run time.
                policy.next_run_at = fields.Datetime.to_datetime(policy.effective_date)
            else:
                policy.next_run_at = fields.Datetime.now() + delta

    def _applies_to_employee(self, employee):
        self.ensure_one()
        if self.applies_to == "all":
            return True
        if self.applies_to == "department":
            return employee.department_id in self.department_ids
        if self.applies_to == "grade":
            return employee.grade_id in self.grade_ids
        return employee in self.employee_ids

    def _target_employees(self):
        Employee = self.env["hr.employee"]
        if self.applies_to == "all":
            return Employee.search([])
        if self.applies_to == "department":
            return Employee.search([("department_id", "in", self.department_ids.ids)])
        if self.applies_to == "grade":
            return Employee.search([("grade_id", "in", self.grade_ids.ids)])
        return self.employee_ids

    def evaluate_employee(self, employee):
        self.ensure_one()
        today = fields.Date.context_today(self)
        if (
            not self.active
            or (self.effective_date and self.effective_date > today)
            or not self._applies_to_employee(employee)
        ):
            return self.env["doc.compliance.evaluation"]

        Evaluation = self._sudo_evaluation_env()
        evaluation = Evaluation.search(
            [("policy_id", "=", self.id), ("employee_id", "=", employee.id)],
            limit=1,
        )
        previous_status = evaluation.status if evaluation else False
        line_commands = [fields.Command.clear()]
        exception = self.env["doc.compliance.exception"].sudo().search(
            [
                ("policy_id", "=", self.id),
                ("employee_id", "=", employee.id),
                ("status", "=", "approved"),
                ("active", "=", True),
                ("valid_until", ">=", today),
            ],
            limit=1,
        )

        for requirement in self.requirement_ids.filtered("active"):
            # Each selected document type is an independent requirement. This
            # prevents one document type from satisfying another type in the
            # same policy.
            for document_type in requirement.document_type_ids:
                matching_documents = self.env["doc.document"].sudo().search(
                    [
                        ("employee_id", "=", employee.id),
                        ("document_type_id", "=", document_type.id),
                        ("active", "=", True),
                        ("state", "in", ["approved", "signed"]),
                        "|",
                        ("has_expiry", "=", False),
                        ("expiry_date", ">=", today),
                    ]
                )
                required = requirement.minimum_documents
                count = len(matching_documents)
                if exception:
                    status = "excepted"
                elif count >= required:
                    status = "complete"
                elif requirement.grace_period_days:
                    reference_date = self.effective_date or today
                    if employee.create_date:
                        employee_start = fields.Date.to_date(employee.create_date)
                        if employee_start and employee_start > reference_date:
                            reference_date = employee_start
                    grace_end = reference_date + relativedelta(
                        days=requirement.grace_period_days
                    )
                    status = "grace" if today <= grace_end else "missing"
                else:
                    status = "missing"
                line_commands.append(
                    fields.Command.create(
                        {
                            "requirement_id": requirement.id,
                            "document_type_id": document_type.id,
                            "document_ids": [fields.Command.set(matching_documents.ids)],
                            "required_count": required,
                            "matched_count": count,
                            "status": status,
                        }
                    )
                )

        values = {
            "policy_id": self.id,
            "employee_id": employee.id,
            "evaluated_at": fields.Datetime.now(),
            "exception_id": exception.id if exception else False,
            "line_ids": line_commands,
        }
        if evaluation:
            evaluation.write(values)
        else:
            evaluation = Evaluation.create(values)
        evaluation._compute_results()
        self.env["doc.compliance.notify"].sudo().notify_after_evaluation(
            self, employee, evaluation, previous_status
        )
        return evaluation

    def action_evaluate(self, run_type="manual"):
        runs = self.env["doc.compliance.evaluation.run"].sudo()
        Requirement = self.env["doc.compliance.requirement"].sudo()
        for policy in self:
            today = fields.Date.context_today(policy)
            if not policy.active or (policy.effective_date and policy.effective_date > today):
                continue
            if not policy.requirement_ids:
                policy.auto_requirement_id = Requirement.create(
                    {
                        "name": policy.name,
                        "policy_id": policy.id,
                        "minimum_documents": policy.minimum_documents,
                        "grace_period_days": policy.grace_period_days,
                        "active": policy.active,
                    }
                )
            targets = policy._target_employees()
            Evaluation = policy._sudo_evaluation_env()
            stale = Evaluation.search([
                ("policy_id", "=", policy.id),
                ("employee_id", "not in", targets.ids or [0]),
            ])
            if stale:
                stale.unlink()
            run = runs.create({
                "policy_id": policy.id,
                "run_type": run_type if run_type in ("manual", "automatic", "audit") else "manual",
                "evaluated_at": fields.Datetime.now(),
            })
            for employee in targets:
                policy.evaluate_employee(employee)
            evaluations = Evaluation.search([("policy_id", "=", policy.id)])
            run.write({
                "employee_count": len(evaluations),
                "compliant_count": len(evaluations.filtered(lambda item: item.status == "compliant")),
                "partial_count": len(evaluations.filtered(lambda item: item.status in ("partial", "grace"))),
                "non_compliant_count": len(evaluations.filtered(lambda item: item.status == "non_compliant")),
                "excepted_count": len(evaluations.filtered(lambda item: item.status == "excepted")),
            })
            policy.write({"last_run_at": run.evaluated_at})
            policy.action_set_next_run()
            runs |= run
        return runs

    @api.model
    def _cron_evaluate_policies(self):
        today = fields.Date.context_today(self)
        now = fields.Datetime.now()
        policies = self.search(
            [
                ("active", "=", True),
                ("effective_date", "<=", today),
                ("schedule", "!=", False),
            ]
        ).filtered(
            lambda policy: (
                (policy.schedule == "one_time" and not policy.last_run_at)
                or (
                    policy.schedule != "one_time"
                    and (
                        not policy.next_run_at
                        or policy.next_run_at <= now
                    )
                )
            )
        )
        policies.action_evaluate(run_type="automatic")


class ComplianceRequirement(models.Model):
    _name = "doc.compliance.requirement"
    _description = "Compliance Checklist Requirement"

    name = fields.Char(required=True)
    description = fields.Text()
    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade"
    )
    document_type_ids = fields.Many2many(
        related="policy_id.document_type_ids", readonly=True
    )
    minimum_documents = fields.Integer(default=1)
    grace_period_days = fields.Integer(default=0)
    active = fields.Boolean(default=True)

    @api.constrains("minimum_documents", "grace_period_days")
    def _check_values(self):
        for requirement in self:
            if requirement.minimum_documents < 1 or requirement.grace_period_days < 0:
                raise ValidationError(
                    _(
                        "Minimum documents must be at least 1 and grace period cannot be negative."
                    )
                )


class ComplianceEvaluation(models.Model):
    _name = "doc.compliance.evaluation"
    _description = "Compliance Evaluation"
    _rec_name = "employee_id"
    _order = "evaluated_at desc"

    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade", index=True
    )
    employee_id = fields.Many2one(
        "hr.employee", required=True, ondelete="cascade", index=True
    )
    exception_id = fields.Many2one("doc.compliance.exception", readonly=True)
    line_ids = fields.One2many(
        "doc.compliance.evaluation.line", "evaluation_id", string="Results"
    )
    evaluated_at = fields.Datetime(readonly=True)
    score = fields.Float(
        compute="_compute_results",
        store=True,
        digits=(5, 2),
    )
    status = fields.Selection(
        [
            ("compliant", "Compliant"),
            ("partial", "Partially Compliant"),
            ("non_compliant", "Non-compliant"),
            ("excepted", "Excepted"),
        ],
        compute="_compute_results",
        store=True,
    )
    complete_count = fields.Integer(compute="_compute_results", store=True)
    missing_count = fields.Integer(compute="_compute_results", store=True)
    grace_count = fields.Integer(compute="_compute_results", store=True)

    _sql_constraints = [
        (
            "policy_employee_unique",
            "unique(policy_id, employee_id)",
            "An employee can have one evaluation per policy.",
        )
    ]

    @api.depends("line_ids.status", "line_ids.required_count", "line_ids.matched_count")
    def _compute_results(self):
        for evaluation in self:
            lines = evaluation.line_ids
            complete = len(
                lines.filtered(lambda line: line.status in ("complete", "excepted"))
            )
            missing = len(lines.filtered(lambda line: line.status == "missing"))
            grace = len(lines.filtered(lambda line: line.status == "grace"))
            score = (complete / len(lines) * 100) if lines else 0.0
            evaluation.complete_count = complete
            evaluation.missing_count = missing
            evaluation.grace_count = grace
            evaluation.score = score
            evaluation.status = (
                "excepted"
                if evaluation.exception_id and lines and complete == len(lines)
                else (
                    "compliant"
                    if lines and complete == len(lines)
                    else "non_compliant"
                    if missing == len(lines)
                    else "partial"
                )
            )


class ComplianceEvaluationRun(models.Model):
    _name = "doc.compliance.evaluation.run"
    _description = "Compliance Evaluation Run"
    _order = "evaluated_at desc"

    policy_id = fields.Many2one("doc.compliance.policy", required=True, ondelete="cascade", index=True)
    run_type = fields.Selection(
        [
            ("manual", "Manual"),
            ("automatic", "Automatic"),
            ("audit", "Audit"),
        ],
        required=True,
        default="manual",
    )
    evaluated_at = fields.Datetime(required=True, index=True)
    employee_count = fields.Integer(default=0)
    compliant_count = fields.Integer(default=0)
    partial_count = fields.Integer(default=0)
    non_compliant_count = fields.Integer(default=0)
    excepted_count = fields.Integer(default=0)


class ComplianceEvaluationLine(models.Model):
    _name = "doc.compliance.evaluation.line"
    _description = "Compliance Evaluation Result"

    evaluation_id = fields.Many2one(
        "doc.compliance.evaluation", required=True, ondelete="cascade"
    )
    requirement_id = fields.Many2one(
        "doc.compliance.requirement", required=True, ondelete="restrict"
    )
    document_type_id = fields.Many2one("doc.document.type", ondelete="restrict")
    document_ids = fields.Many2many(
        "doc.document",
        "doc_compliance_evaluation_document_rel",
        "line_id",
        "document_id",
        string="Matching Documents",
    )
    required_count = fields.Integer()
    matched_count = fields.Integer()
    status = fields.Selection(
        [
            ("complete", "Complete"),
            ("grace", "Grace Period"),
            ("missing", "Missing"),
            ("excepted", "Excepted"),
        ],
        required=True,
    )


class ComplianceException(models.Model):
    _name = "doc.compliance.exception"
    _description = "Employee Compliance Exception"
    _rec_name = "employee_id"

    employee_id = fields.Many2one("hr.employee", required=True, ondelete="cascade")
    policy_id = fields.Many2one(
        "doc.compliance.policy", required=True, ondelete="cascade"
    )
    reason = fields.Text(required=True)
    valid_until = fields.Date(required=True)
    status = fields.Selection(
        [
            ("draft", "Draft"),
            ("approved", "Approved"),
            ("rejected", "Rejected"),
            ("expired", "Expired"),
        ],
        default="draft",
        required=True,
    )
    approved_by = fields.Many2one("res.users", readonly=True)
    approved_at = fields.Datetime(readonly=True)
    active = fields.Boolean(default=True)

    _sql_constraints = [
        (
            "policy_employee_unique",
            "unique(policy_id, employee_id)",
            "An employee can have one exception per policy.",
        ),
    ]

    @api.constrains("employee_id", "policy_id")
    def _check_policy_scope(self):
        for exception in self:
            if exception.policy_id and not exception.policy_id._applies_to_employee(exception.employee_id):
                raise ValidationError(_("The exception employee is outside the policy scope."))

    @api.constrains("valid_until")
    def _check_valid_until(self):
        today = fields.Date.context_today(self)
        for exception in self:
            if exception.valid_until and exception.valid_until < today:
                raise ValidationError(_("An exception must be valid today or in the future."))

    @api.model_create_multi
    def create(self, vals_list):
        is_manager = self.env.user.has_group(
            "cleon_document_management.group_document_manager"
        )
        is_admin = self.env.user.has_group(
            "cleon_document_management.group_document_admin"
        )
        if not is_manager and not is_admin:
            employee = self.env.user.employee_id
            for vals in vals_list:
                if not employee or int(vals.get("employee_id", 0)) != employee.id:
                    raise AccessError(_("You can only submit an exception for yourself."))
        for vals in vals_list:
            policy = self.env["doc.compliance.policy"].browse(vals.get("policy_id"))
            if policy and not policy.allow_waiver and not is_admin:
                raise ValidationError(
                    _("This policy does not allow waiver or exemption requests.")
                )
        return super().create(vals_list)

    def write(self, vals):
        if not self.env.user.has_group("cleon_document_management.group_document_manager"):
            if any(record.employee_id.user_id != self.env.user for record in self):
                raise AccessError(_("You can only update your own compliance exception."))
            if set(vals) - {"reason", "valid_until"}:
                raise AccessError(_("You cannot change the status of a compliance exception."))
        return super().write(vals)

    def action_deactivate(self):
        self.write({"active": False})

    def action_reactivate(self):
        values = {"active": True}
        if any(record.status in ("expired", "rejected") for record in self):
            values.update({"status": "draft", "approved_by": False, "approved_at": False})
        self.write(values)

    def action_delete(self):
        self.unlink()

    def action_approve(self):
        if any(not record.active or record.status != "draft" for record in self):
            raise ValidationError(_("Only active draft exceptions can be approved."))
        for record in self:
            if not record.policy_id.allow_waiver:
                raise ValidationError(
                    _("This policy does not allow waiver or exemption requests.")
                )
        self.write(
            {
                "status": "approved",
                "approved_by": self.env.user.id,
                "approved_at": fields.Datetime.now(),
            }
        )
        for record in self:
            record.policy_id.evaluate_employee(record.employee_id)

    def action_reject(self):
        if any(not record.active or record.status != "draft" for record in self):
            raise ValidationError(_("Only active draft exceptions can be rejected."))
        self.write({"status": "rejected"})
        for record in self:
            record.policy_id.evaluate_employee(record.employee_id)

    @api.model
    def _cron_expire_exceptions(self):
        today = fields.Date.context_today(self)
        self.search([("status", "=", "approved"), ("valid_until", "<", today)]).write(
            {"status": "expired", "active": False}
        )

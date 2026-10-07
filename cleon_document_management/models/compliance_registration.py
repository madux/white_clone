from dateutil.relativedelta import relativedelta

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, ValidationError

MATERIAL_POLICY_FIELDS = frozenset(
    {
        "document_type_ids",
        "minimum_documents",
        "grace_period_days",
        "due_days",
        "no_document_due_days",
        "applies_to",
        "department_ids",
        "grade_ids",
        "employee_ids",
        "work_location_ids",
        "employment_type_ids",
        "branch_ids",
        "event_trigger",
        "retention_action_mode",
        "retention_owner_notice_days",
        "verified_by",
        "verification_sla_days",
    }
)


class CompliancePolicyType(models.Model):
    _name = "doc.compliance.policy.type"
    _description = "Compliance Policy Type"

    def _register_hook(self):
        super()._register_hook()
        retention = self.env.ref(
            "cleon_document_management.policy_type_retention",
            raise_if_not_found=False,
        )
        if retention and retention.code == "retention" and retention.name != "Retention":
            retention.sudo().write(
                {
                    "name": "Retention",
                    "description": "Ensure employee documents follow organisation retention settings.",
                }
            )

    name = fields.Char(required=True)
    code = fields.Selection(
        [
            ("document_requirement", "Document Requirement"),
            ("renewable_document", "Renewable Document"),
            ("compliance_request", "Compliance Request"),
            ("retention", "Retention"),
            ("review_schedule", "Review Schedule"),
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
            ("filtered", "Filtered audience"),
            ("department", "Departments"),
            ("grade", "Grades"),
            ("employee", "Employees"),
        ],
        required=True,
        default="all",
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
    work_location_ids = fields.Many2many(
        "hr.work.location",
        "doc_compliance_policy_work_location_rel",
        "policy_id",
        "work_location_id",
        string="Work locations",
    )
    employment_type_ids = fields.Many2many(
        "hr.core_employment_type",
        "doc_compliance_policy_employment_type_rel",
        "policy_id",
        "employment_type_id",
        string="Employment types",
    )
    branch_ids = fields.Many2many(
        "multi.branch",
        "doc_compliance_policy_branch_rel",
        "policy_id",
        "branch_id",
        string="Business units",
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
    effective_date = fields.Date(
        string="Effective Date",
        tracking=True,
        help="Date this policy becomes effective. Future dates delay the first run.",
    )
    active = fields.Boolean(default=True, tracking=True)
    lifecycle_status = fields.Selection(
        [
            ("draft", "Draft"),
            ("scheduled", "Scheduled"),
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("archived", "Archived"),
        ],
        default="active",
        tracking=True,
    )
    policy_category = fields.Char(string="Category")
    policy_visibility = fields.Selection(
        [
            ("employees", "Visible to employees"),
            ("hr_only", "HR only"),
        ],
        default="employees",
    )
    policy_audience = fields.Selection(
        [
            ("everyone", "Everyone"),
            ("employees", "Employees"),
            ("hr_only", "HR only"),
            ("department", "Departments"),
        ],
        default="everyone",
    )
    source_document_id = fields.Many2one("doc.document", ondelete="set null")
    ai_drafted = fields.Boolean(default=False)
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

    @api.constrains("document_type_ids", "policy_type_id")
    def _check_document_types(self):
        for policy in self:
            if (
                policy.policy_type_id
                and policy.policy_type_id.code in ("compliance_request", "review_schedule")
            ):
                continue
            if not policy.document_type_ids:
                raise ValidationError(_("Select at least one required document type."))
            if policy.policy_type_id.code == "renewable_document":
                invalid = policy.document_type_ids.filtered(
                    lambda doc_type: not doc_type.expiry_applicable
                )
                if invalid:
                    raise ValidationError(
                        _(
                            "Renewable document rules only support document types "
                            "with expiry enabled (%s)."
                        )
                        % ", ".join(invalid.mapped("name"))
                    )

    def _has_scope_filters(self):
        self.ensure_one()
        return bool(
            self.department_ids
            or self.grade_ids
            or self.employee_ids
            or self.work_location_ids
            or self.employment_type_ids
            or self.branch_ids
        )

    @api.model
    def _employee_work_location(self, employee):
        location = getattr(employee, "work_location_id", False)
        if location:
            return location
        return getattr(employee, "location_id", False)

    @api.constrains(
        "applies_to",
        "department_ids",
        "grade_ids",
        "employee_ids",
        "work_location_ids",
        "employment_type_ids",
        "branch_ids",
    )
    def _check_scope(self):
        for policy in self:
            if policy.applies_to == "all" and not policy._has_scope_filters():
                continue
            if policy.applies_to == "filtered" and not policy._has_scope_filters():
                raise ValidationError(
                    _("Select at least one audience filter or choose all employees.")
                )
            if policy.applies_to in ("department", "grade", "employee"):
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
        if not self.env.context.get("skip_policy_admin_check") and not self._is_document_admin():
            raise AccessError(_("Only document administrators can create compliance policies."))
        prepared = []
        for vals in vals_list:
            vals = dict(vals)
            if not vals.get("ai_drafted") and vals.get("lifecycle_status") == "draft":
                vals["lifecycle_status"] = "active"
            if vals.get("lifecycle_status") == "draft":
                vals["active"] = False
                vals["ai_drafted"] = True
            prepared.append(vals)
        policies = super().create(prepared)
        Requirement = self.env["doc.compliance.requirement"]
        for policy in policies:
            if hasattr(policy, "_is_retention_policy") and policy._is_retention_policy():
                continue
            if (
                hasattr(policy, "_is_review_schedule_policy")
                and policy._is_review_schedule_policy()
            ):
                continue
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
        ready = policies.filtered(
            lambda policy: policy.active and policy.lifecycle_status != "draft"
        )
        if ready:
            ready._ensure_current_version()
            ready.action_evaluate(run_type="automatic")
        return policies

    def write(self, vals):
        if not self.env.context.get("skip_policy_admin_check") and not self._is_document_admin():
            raise AccessError(_("Only document administrators can edit compliance policies."))
        vals = dict(vals)
        if vals.get("lifecycle_status") == "draft" and any(not policy.ai_drafted for policy in self):
            vals["lifecycle_status"] = "active"
        if "active" in vals:
            if vals.get("active"):
                if not vals.get("lifecycle_status"):
                    vals["lifecycle_status"] = "active"
            elif any(policy.lifecycle_status == "draft" for policy in self):
                vals["lifecycle_status"] = "active"
        material = MATERIAL_POLICY_FIELDS.intersection(vals.keys())
        for policy in self:
            if material and policy.active and policy.lifecycle_status == "active":
                policy._create_new_version()
        if vals.get("active") and vals.get("lifecycle_status") in (False, "active"):
            for policy in self:
                policy._validate_document_types_for_activation()
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

    def _clear_policy_dependencies(self):
        self.ensure_one()
        requirement_ids = self.requirement_ids.ids
        if requirement_ids:
            self.env["doc.compliance.evaluation.line"].sudo().search(
                [("requirement_id", "in", requirement_ids)]
            ).unlink()
            self.env["doc.compliance.evaluation.run.result.line"].sudo().search(
                [("requirement_id", "in", requirement_ids)]
            ).unlink()
        self.env["doc.compliance.evaluation"].sudo().search(
            [("policy_id", "=", self.id)]
        ).unlink()
        self.env["doc.compliance.evaluation.run"].sudo().search(
            [("policy_id", "=", self.id)]
        ).unlink()

    def unlink(self):
        if not self._is_document_admin():
            raise AccessError(_("Only document administrators can delete compliance policies."))
        for policy in self:
            policy.sudo()._clear_policy_dependencies()
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
        if not self._has_scope_filters():
            return self.applies_to in (False, "all")
        if self.department_ids and employee.department_id not in self.department_ids:
            return False
        if self.grade_ids and employee.grade_id not in self.grade_ids:
            return False
        location = self._employee_work_location(employee)
        if self.work_location_ids and (
            not location or location not in self.work_location_ids
        ):
            return False
        employment_type = getattr(employee, "employee_type_id", False)
        if self.employment_type_ids and (
            not employment_type or employment_type not in self.employment_type_ids
        ):
            return False
        branch = getattr(employee, "branch_id", False)
        if self.branch_ids and (not branch or branch not in self.branch_ids):
            return False
        if self.employee_ids and employee not in self.employee_ids:
            return False
        return True

    def _target_employees(self):
        Employee = self.env["hr.employee"]
        if not self._has_scope_filters():
            if self.applies_to == "all":
                return Employee.search([("active", "=", True)])
            if self.applies_to == "department":
                return Employee.search(
                    [
                        ("active", "=", True),
                        ("department_id", "in", self.department_ids.ids),
                    ]
                )
            if self.applies_to == "grade":
                return Employee.search(
                    [
                        ("active", "=", True),
                        ("grade_id", "in", self.grade_ids.ids),
                    ]
                )
            if self.applies_to == "employee":
                return self.employee_ids.filtered("active")
            return Employee.search([("active", "=", True)])
        domain = [("active", "=", True)]
        if self.department_ids:
            domain.append(("department_id", "in", self.department_ids.ids))
        if self.grade_ids:
            domain.append(("grade_id", "in", self.grade_ids.ids))
        if self.work_location_ids:
            domain.append(
                "|",
                ("work_location_id", "in", self.work_location_ids.ids),
                ("location_id", "in", self.work_location_ids.ids),
            )
        if self.employment_type_ids:
            domain.append(("employee_type_id", "in", self.employment_type_ids.ids))
        if self.branch_ids:
            domain.append(("branch_id", "in", self.branch_ids.ids))
        if self.employee_ids:
            domain.append(("id", "in", self.employee_ids.ids))
        return Employee.search(domain)

    def evaluate_employee(self, employee):
        self.ensure_one()
        if self._is_compliance_request():
            return self.evaluate_compliance_request_employee(employee)
        if hasattr(self, "_is_retention_policy") and self._is_retention_policy():
            return self.env["doc.compliance.evaluation"]
        if hasattr(self, "_is_review_schedule_policy") and self._is_review_schedule_policy():
            Evaluation = self._sudo_evaluation_env()
            evaluation = Evaluation.search(
                [("policy_id", "=", self.id), ("employee_id", "=", employee.id)],
                limit=1,
            )
            if not evaluation:
                evaluation = Evaluation.create(
                    {
                        "policy_id": self.id,
                        "employee_id": employee.id,
                        "evaluated_at": fields.Datetime.now(),
                    }
                )
            evaluation._compute_results()
            return evaluation
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

        Engine = self.env["doc.compliance.engine"]
        for requirement in self.requirement_ids.filtered("active"):
            for document_type in requirement.document_type_ids:
                payload = Engine.evaluate_document_type_line(
                    self,
                    employee,
                    document_type,
                    requirement,
                    exception,
                    today=today,
                )
                self._sync_assignments_for_employee(
                    employee, payload, requirement, document_type
                )
                for document in self.env["doc.document"].browse(payload["document_ids"]):
                    if document.exists():
                        self._maybe_queue_verification(employee, document)
                line_commands.append(
                    fields.Command.create(
                        {
                            "requirement_id": requirement.id,
                            "document_type_id": document_type.id,
                            "document_ids": [
                                fields.Command.set(payload["document_ids"])
                            ],
                            "required_count": payload["required_count"],
                            "matched_count": payload["matched_count"],
                            "status": payload["status"],
                            "compliance_status": payload["compliance_status"],
                            "reason_code": payload["reason_code"],
                            "reason_message": payload["reason_message"],
                            "due_date": payload.get("due_date"),
                            "grace_end_date": payload.get("grace_end_date"),
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
            if hasattr(policy, "_is_retention_policy") and policy._is_retention_policy():
                self.env["doc.compliance.retention.engine"].sudo().run_policy(policy)
                continue
            if (
                hasattr(policy, "_is_review_schedule_policy")
                and policy._is_review_schedule_policy()
            ):
                for employee in policy._target_employees():
                    policy._generate_reviews_for_employee(employee)
                policy._process_review_states(fields.Date.context_today(policy))
                continue
            if policy.run_in_progress:
                raise ValidationError(
                    _("A run is already in progress for policy %s.") % policy.name
                )
            today = fields.Date.context_today(policy)
            if policy.lifecycle_status == "scheduled" and policy.effective_date and policy.effective_date > today:
                continue
            if not policy.active or (policy.effective_date and policy.effective_date > today):
                continue
            policy.write(
                {
                    "run_in_progress": True,
                    "run_started_at": fields.Datetime.now(),
                }
            )
            if (
                not policy.requirement_ids
                and not policy._is_compliance_request()
                and not (
                    hasattr(policy, "_is_retention_policy")
                    and policy._is_retention_policy()
                )
            ):
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
            run.snapshot_from_evaluations(evaluations)
            run.write({
                "employee_count": len(evaluations),
                "compliant_count": len(evaluations.filtered(lambda item: item.status == "compliant")),
                "partial_count": len(evaluations.filtered(lambda item: item.status in ("partial", "grace"))),
                "non_compliant_count": len(evaluations.filtered(lambda item: item.status == "non_compliant")),
                "excepted_count": len(evaluations.filtered(lambda item: item.status == "excepted")),
            })
            policy.write(
                {
                    "last_run_at": run.evaluated_at,
                    "run_in_progress": False,
                    "run_started_at": False,
                }
            )
            policy.action_set_next_run()
            self.env["doc.compliance.audit.log"].log_event(
                "run_complete",
                _("Run completed for %s") % policy.name,
                policy=policy,
                run=run,
            )
            runs |= run
        return runs

    def action_run_preflight(self):
        """Return Applicable, Exempt, and To evaluate counts for Run Check confirmation."""
        self.ensure_one()
        today = fields.Date.context_today(self)
        if not self.active or (self.effective_date and self.effective_date > today):
            return {"applicable": 0, "exempt": 0, "to_evaluate": 0}
        targets = self._target_employees()
        exempt = 0
        for employee in targets:
            if self.env["doc.compliance.exception"].sudo().search_count(
                [
                    ("policy_id", "=", self.id),
                    ("employee_id", "=", employee.id),
                    ("status", "=", "approved"),
                    ("active", "=", True),
                    ("valid_until", ">=", today),
                ]
            ):
                exempt += 1
        applicable = len(targets)
        return {
            "applicable": applicable,
            "exempt": exempt,
            "to_evaluate": max(applicable - exempt, 0),
        }

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
    compliance_status = fields.Selection(
        [
            ("compliant", "Compliant"),
            ("at_risk", "At Risk"),
            ("pending", "Pending"),
            ("non_compliant", "Non-compliant"),
            ("exempt", "Exempt"),
        ],
        compute="_compute_results",
        store=True,
    )
    reason_code = fields.Char(compute="_compute_results", store=True)
    reason_message = fields.Char(compute="_compute_results", store=True)
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

    @api.depends(
        "line_ids.status",
        "line_ids.compliance_status",
        "line_ids.required_count",
        "line_ids.matched_count",
        "exception_id",
    )
    def _compute_results(self):
        Engine = self.env["doc.compliance.engine"]
        for evaluation in self:
            lines = evaluation.line_ids
            payloads = [
                {
                    "compliance_status": line.compliance_status or "at_risk",
                }
                for line in lines
            ]
            legacy, comp, code, msg = Engine.aggregate_evaluation_status(
                payloads, evaluation.exception_id
            )
            complete = len(
                lines.filtered(
                    lambda line: line.compliance_status in ("compliant", "exempt")
                    or line.status in ("complete", "excepted")
                )
            )
            missing = len(
                lines.filtered(
                    lambda line: line.compliance_status == "non_compliant"
                    or line.status == "missing"
                )
            )
            grace = len(
                lines.filtered(
                    lambda line: line.compliance_status == "at_risk"
                    or line.status in ("grace", "pending")
                )
            )
            score = (complete / len(lines) * 100) if lines else 0.0
            evaluation.complete_count = complete
            evaluation.missing_count = missing
            evaluation.grace_count = grace
            evaluation.score = score
            evaluation.compliance_status = comp
            evaluation.reason_code = code
            evaluation.reason_message = msg
            if comp == "exempt":
                evaluation.status = "excepted"
            elif comp == "compliant":
                evaluation.status = "compliant"
            elif comp == "non_compliant":
                evaluation.status = "non_compliant"
            else:
                evaluation.status = legacy if legacy in ("partial", "non_compliant") else "partial"


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
    result_ids = fields.One2many(
        "doc.compliance.evaluation.run.result",
        "run_id",
        string="Employee Results",
    )

    def snapshot_from_evaluations(self, evaluations):
        self.ensure_one()
        today = fields.Date.context_today(self)
        RunResult = self.env["doc.compliance.evaluation.run.result"].sudo()
        Document = self.env["doc.document"].sudo()
        for evaluation in evaluations:
            line_commands = []
            for line in evaluation.line_ids:
                expired_documents = Document.browse()
                if line.document_type_id:
                    expired_documents = Document.search([
                        ("employee_id", "=", evaluation.employee_id.id),
                        ("document_type_id", "=", line.document_type_id.id),
                        ("active", "=", True),
                        ("state", "in", ["approved", "signed"]),
                        ("has_expiry", "=", True),
                        ("expiry_date", "<", today),
                    ])
                line_commands.append(
                    fields.Command.create({
                        "requirement_id": line.requirement_id.id,
                        "document_type_id": line.document_type_id.id,
                        "required_count": line.required_count,
                        "matched_count": line.matched_count,
                        "status": line.status,
                        "document_ids": [fields.Command.set(line.document_ids.ids)],
                        "expired_document_ids": [fields.Command.set(expired_documents.ids)],
                    })
                )
            required_total = sum(line.required_count for line in evaluation.line_ids)
            submitted_total = sum(
                line.matched_count
                for line in evaluation.line_ids
                if line.status in ("complete", "excepted")
            )
            RunResult.create({
                "run_id": self.id,
                "employee_id": evaluation.employee_id.id,
                "department_id": evaluation.employee_id.department_id.id,
                "status": evaluation.status,
                "score": evaluation.score,
                "required_count": required_total,
                "submitted_count": submitted_total,
                "missing_count": evaluation.missing_count,
                "grace_count": evaluation.grace_count,
                "exception_id": evaluation.exception_id.id if evaluation.exception_id else False,
                "line_ids": line_commands,
            })


class ComplianceEvaluationRunResult(models.Model):
    _name = "doc.compliance.evaluation.run.result"
    _description = "Compliance Evaluation Run Result"
    _order = "employee_id"
    _rec_name = "employee_id"

    run_id = fields.Many2one(
        "doc.compliance.evaluation.run", required=True, ondelete="cascade", index=True
    )
    employee_id = fields.Many2one(
        "hr.employee", required=True, ondelete="cascade", index=True
    )
    department_id = fields.Many2one("hr.department", ondelete="set null", index=True)
    status = fields.Selection(
        [
            ("compliant", "Compliant"),
            ("partial", "Partially Compliant"),
            ("non_compliant", "Non-compliant"),
            ("excepted", "Excepted"),
        ],
        required=True,
        index=True,
    )
    score = fields.Float(digits=(5, 2))
    required_count = fields.Integer(default=0)
    submitted_count = fields.Integer(default=0)
    missing_count = fields.Integer(default=0)
    grace_count = fields.Integer(default=0)
    exception_id = fields.Many2one("doc.compliance.exception", readonly=True)
    line_ids = fields.One2many(
        "doc.compliance.evaluation.run.result.line",
        "result_id",
        string="Requirement Results",
    )

    _sql_constraints = [
        (
            "run_employee_unique",
            "unique(run_id, employee_id)",
            "An employee can have one result per run.",
        ),
    ]


class ComplianceEvaluationRunResultLine(models.Model):
    _name = "doc.compliance.evaluation.run.result.line"
    _description = "Compliance Evaluation Run Result Line"

    result_id = fields.Many2one(
        "doc.compliance.evaluation.run.result", required=True, ondelete="cascade"
    )
    requirement_id = fields.Many2one(
        "doc.compliance.requirement", required=True, ondelete="restrict"
    )
    document_type_id = fields.Many2one("doc.document.type", ondelete="restrict")
    document_ids = fields.Many2many(
        "doc.document",
        "doc_compliance_run_result_document_rel",
        "line_id",
        "document_id",
        string="Matching Documents",
    )
    expired_document_ids = fields.Many2many(
        "doc.document",
        "doc_compliance_run_result_expired_document_rel",
        "line_id",
        "document_id",
        string="Expired Documents",
    )
    required_count = fields.Integer()
    matched_count = fields.Integer()
    status = fields.Selection(
        [
            ("complete", "Complete"),
            ("grace", "Grace Period"),
            ("missing", "Missing"),
            ("excepted", "Excepted"),
            ("pending", "Pending"),
        ],
        required=True,
    )
    compliance_status = fields.Selection(
        [
            ("compliant", "Compliant"),
            ("at_risk", "At Risk"),
            ("pending", "Pending"),
            ("non_compliant", "Non-compliant"),
            ("exempt", "Exempt"),
        ],
    )
    reason_code = fields.Char()
    reason_message = fields.Char()
    due_date = fields.Date()
    grace_end_date = fields.Date()


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
            ("pending", "Pending"),
        ],
        required=True,
    )
    compliance_status = fields.Selection(
        [
            ("compliant", "Compliant"),
            ("at_risk", "At Risk"),
            ("pending", "Pending"),
            ("non_compliant", "Non-compliant"),
            ("exempt", "Exempt"),
        ],
    )
    reason_code = fields.Char()
    reason_message = fields.Char()
    due_date = fields.Date()
    grace_end_date = fields.Date()


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
    requester_id = fields.Many2one("res.users", readonly=True)
    approved_by = fields.Many2one("res.users", readonly=True)
    approved_at = fields.Datetime(readonly=True)
    revoked_by = fields.Many2one("res.users", readonly=True)
    revoked_at = fields.Datetime(readonly=True)
    revoke_reason = fields.Text()
    requirement_id = fields.Many2one("doc.compliance.requirement", ondelete="set null")
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
            if "requester_id" not in vals:
                vals["requester_id"] = self.env.user.id
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
        dms = self.env["doc.dms.permission"]
        if not dms.user_has_dms_permission(
            self.env.user, "compliance_approve_exception"
        ) and not dms.user_is_super_admin(self.env.user):
            if not self.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                raise AccessError(_("You cannot approve compliance exceptions."))
        if any(not record.active or record.status != "draft" for record in self):
            raise ValidationError(_("Only active draft exceptions can be approved."))
        for record in self:
            if record.requester_id == self.env.user:
                raise ValidationError(_("You cannot approve an exception you requested."))
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
        dms = self.env["doc.dms.permission"]
        if not dms.user_has_dms_permission(
            self.env.user, "compliance_approve_exception"
        ) and not dms.user_is_super_admin(self.env.user):
            if not self.env.user.has_group(
                "cleon_document_management.group_document_manager"
            ):
                raise AccessError(_("You cannot reject compliance exceptions."))
        if any(not record.active or record.status != "draft" for record in self):
            raise ValidationError(_("Only active draft exceptions can be rejected."))
        for record in self:
            if record.requester_id == self.env.user:
                raise ValidationError(_("You cannot reject an exception you requested."))
        self.write({"status": "rejected"})
        for record in self:
            record.policy_id.evaluate_employee(record.employee_id)

    def action_revoke(self, reason):
        dms = self.env["doc.dms.permission"]
        if not dms.user_has_dms_permission(
            self.env.user, "compliance_revoke_exception"
        ) and not dms.user_is_super_admin(self.env.user):
            raise AccessError(_("You cannot revoke compliance exceptions."))
        if not reason:
            raise ValidationError(_("A revoke reason is required."))
        for record in self:
            if record.status != "approved":
                raise ValidationError(_("Only approved exceptions can be revoked."))
        self.write(
            {
                "status": "rejected",
                "active": False,
                "revoked_by": self.env.user.id,
                "revoked_at": fields.Datetime.now(),
                "revoke_reason": reason,
            }
        )
        for record in self:
            record.policy_id.evaluate_employee(record.employee_id)

    @api.model
    def _cron_expire_exceptions(self):
        today = fields.Date.context_today(self)
        self.search([("status", "=", "approved"), ("valid_until", "<", today)]).write(
            {"status": "expired", "active": False}
        )

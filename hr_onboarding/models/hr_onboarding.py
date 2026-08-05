# -*- coding: utf-8 -*-
from odoo import models, fields, api, _


class HrOnboarding(models.Model):
    _name = "hr.onboarding"
    _description = "Employee Onboarding"
    _inherit = ["mail.thread"]
    _rec_name = "employee_id"
    _order = "id desc"

    # Categories mirror the 5 progress columns on the dashboard mock:
    # HR Docs / IT Access / Payroll / Benefits / Orientation
    CATEGORIES = [
        ("hr_docs", "HR Docs"),
        ("it_access", "IT Access"),
        ("payroll", "Payroll"),
        ("benefits", "Benefits"),
        ("orientation", "Orientation"),
    ]

    employee_id = fields.Many2one(
        "hr.employee", string="Employee", required=True, tracking=True,
        ondelete="cascade",
    )
    contract_id = fields.Many2one(
        "hr.contract", string="Contract",
        help="The contract created alongside this employee; drives "
             "Probation Tracking (trial_date_start/trial_date_end).",
    )
    department_id = fields.Many2one(
        related="employee_id.department_id", store=True, readonly=True,
    )
    job_id = fields.Many2one(
        related="employee_id.job_id", store=True, readonly=True,
        string="Job Title",
    )
    grade_level = fields.Selection(
        related="employee_id.grade_level", store=True, readonly=True,
    )

    start_date = fields.Date(string="Start Date", required=True, tracking=True)
    duration_days = fields.Integer(string="Onboarding Duration (days)", default=30)

    day_number = fields.Integer(compute="_compute_day_number", string="Day #")

    task_ids = fields.One2many("hr.onboarding.task", "onboarding_id", string="Tasks")
    task_count = fields.Integer(compute="_compute_progress")
    tasks_done = fields.Integer(compute="_compute_progress")
    progress_percent = fields.Integer(compute="_compute_progress", string="Progress %")
    overdue_count = fields.Integer(compute="_compute_overdue")

    state = fields.Selection(
        [
            ("on_track", "On Track"),
            ("has_overdue", "Has Overdue"),
            ("completed", "Completed"),
        ],
        compute="_compute_state", store=True, string="Status",
    )
    active = fields.Boolean(default=True)

    @api.depends("start_date")
    def _compute_day_number(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.day_number = (today - rec.start_date).days + 1 if rec.start_date else 0

    @api.depends("task_ids.is_done")
    def _compute_progress(self):
        for rec in self:
            total = len(rec.task_ids)
            done = len(rec.task_ids.filtered("is_done"))
            rec.task_count = total
            rec.tasks_done = done
            rec.progress_percent = round(done / total * 100) if total else 0

    @api.depends("task_ids.is_done", "task_ids.due_date")
    def _compute_overdue(self):
        today = fields.Date.context_today(self)
        for rec in self:
            rec.overdue_count = len(rec.task_ids.filtered(
                lambda t: not t.is_done and t.due_date and t.due_date < today
            ))

    @api.depends("tasks_done", "task_count", "overdue_count")
    def _compute_state(self):
        for rec in self:
            if rec.task_count and rec.tasks_done == rec.task_count:
                rec.state = "completed"
            elif rec.overdue_count:
                rec.state = "has_overdue"
            else:
                rec.state = "on_track"

    def get_category_status(self, category):
        """Returns (label, overdue_count) for one of CATEGORIES, used to
        render the HR Docs / IT Access / Payroll / Benefits / Orientation
        columns on the dashboard.
        """
        self.ensure_one()
        tasks = self.task_ids.filtered(lambda t: t.category == category)
        if not tasks:
            return ("—", 0)
        today = fields.Date.context_today(self)
        overdue = tasks.filtered(
            lambda t: not t.is_done and t.due_date and t.due_date < today
        )
        if overdue:
            return ("overdue", len(overdue))
        if all(t.is_done for t in tasks):
            return ("done", 0)
        return ("pending", 0)

    @api.model
    def get_dashboard_stats(self, domain=None):
        """Aggregate counts for the four summary cards at the top of the
        dashboard: total / on track / has overdue / completed this month.
        """
        domain = domain or []
        records = self.search(domain)
        today = fields.Date.context_today(self)
        month_start = today.replace(day=1)
        completed_this_month = records.filtered(
            lambda r: r.state == "completed"
            and r.write_date
            and r.write_date.date() >= month_start
        )
        return {
            "total": len(records),
            "on_track": len(records.filtered(lambda r: r.state == "on_track")),
            "has_overdue": len(records.filtered(lambda r: r.state == "has_overdue")),
            "completed_this_month": len(completed_this_month),
        }

    @api.model
    def default_task_specs(self):
        """Baseline checklist seeded on every new onboarding record.
        Deliberately a short fixed list, NOT the reusable, versioned
        Task Library / Checklist Template system shown in the Task
        Checklist mock — that is out of scope for this build.
        """
        return [
            ("Collect signed offer letter", "hr_docs", 0),
            ("Collect ID / right-to-work documents", "hr_docs", 2),
            ("Provision corporate email", "it_access", -2),
            ("Provision Slack / Teams access", "it_access", -2),
            ("Provision HR self-service portal", "it_access", -2),
            ("Set up payroll record", "payroll", 1),
            ("Enrol in pension scheme", "payroll", 5),
            ("Enrol in benefits plan", "benefits", 5),
            ("Schedule orientation session", "orientation", 0),
        ]

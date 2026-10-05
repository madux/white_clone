# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import AccessError


class HrLeaveAnomaly(models.Model):
    """Persistent store for LM-043 leave-pattern anomalies.

    Records are created / updated by the detection job in
    ``leave_ai_service.get_leave_anomalies()``.  HR Managers review or
    escalate them; the state change persists here so a page reload still
    shows the updated status.
    """

    _name = "hr.leave.anomaly"
    _description = "Leave Pattern Anomaly"
    _rec_name = "employee_id"
    _order = "severity desc, last_detected_at desc"

    # ------------------------------------------------------------------ #
    # Core identification fields                                           #
    # ------------------------------------------------------------------ #
    employee_id = fields.Many2one(
        "hr.employee",
        string="Employee",
        required=True,
        ondelete="cascade",
        index=True,
    )
    company_id = fields.Many2one(
        "res.company",
        string="Company",
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )
    pattern_type = fields.Selection(
        selection=[
            ("mon_fri_cluster", "Frequent Monday/Friday Leave"),
            ("adjacent_to_holiday", "Sick Leave Adjacent to Holiday"),
            ("high_short_absence", "High Frequency Short Absences"),
        ],
        string="Pattern Type",
        required=True,
        index=True,
    )

    # ------------------------------------------------------------------ #
    # Detection metadata                                                   #
    # ------------------------------------------------------------------ #
    severity = fields.Selection(
        selection=[
            ("low", "Low"),
            ("medium", "Medium"),
            ("high", "High"),
        ],
        string="Severity",
        required=True,
        index=True,
    )
    first_detected_at = fields.Date(
        string="First Detected",
        required=True,
        default=fields.Date.today,
    )
    last_detected_at = fields.Date(
        string="Last Detected",
        required=True,
        default=fields.Date.today,
    )
    occurrence_count = fields.Integer(
        string="Occurrences",
        required=True,
        default=0,
        help="Number of qualifying leave records that triggered this pattern.",
    )
    supporting_data = fields.Text(
        string="Supporting Data",
        help="Human-readable summary of the evidence behind this anomaly.",
    )

    # ------------------------------------------------------------------ #
    # Workflow state                                                        #
    # ------------------------------------------------------------------ #
    status = fields.Selection(
        selection=[
            ("open", "Open"),
            ("reviewed", "Reviewed"),
            ("escalated", "Escalated"),
        ],
        string="Status",
        required=True,
        default="open",
        index=True,
    )
    reviewed_by = fields.Many2one(
        "res.users",
        string="Reviewed By",
        readonly=True,
    )
    reviewed_at = fields.Datetime(
        string="Reviewed At",
        readonly=True,
    )
    review_note = fields.Text(
        string="Review Note",
    )

    # ------------------------------------------------------------------ #
    # Computed helpers                                                     #
    # ------------------------------------------------------------------ #
    @api.depends("pattern_type")
    def _compute_pattern_type_label(self):
        label_map = dict(self._fields["pattern_type"].selection)
        for rec in self:
            rec.pattern_type_label = label_map.get(rec.pattern_type, rec.pattern_type)

    pattern_type_label = fields.Char(
        string="Pattern",
        compute="_compute_pattern_type_label",
    )

    # ------------------------------------------------------------------ #
    # Unique constraint: one open record per (employee, company, pattern) #
    # ------------------------------------------------------------------ #
    _sql_constraints = [
        (
            "unique_employee_company_pattern",
            "UNIQUE(employee_id, company_id, pattern_type)",
            "Only one anomaly record per employee/company/pattern combination is allowed.",
        ),
    ]

    # ------------------------------------------------------------------ #
    # Business methods                                                     #
    # ------------------------------------------------------------------ #
    @api.model
    def upsert_anomaly(self, employee_id, company_id, pattern_type, severity, occurrence_count, supporting_data):
        """Create or update an anomaly record.

        Called by the detection job.  Returns the anomaly record.
        """
        existing = self.sudo().search(
            [
                ("employee_id", "=", employee_id),
                ("company_id", "=", company_id),
                ("pattern_type", "=", pattern_type),
            ],
            limit=1,
        )
        today = fields.Date.today()
        if existing:
            vals = {
                "last_detected_at": today,
                "occurrence_count": occurrence_count,
                "supporting_data": supporting_data,
            }
            # Only upgrade severity (never silently downgrade).
            sev_rank = {"low": 0, "medium": 1, "high": 2}
            if sev_rank.get(severity, 0) > sev_rank.get(existing.severity, 0):
                vals["severity"] = severity
            # Reopen if it was previously reviewed/escalated and the pattern recurs
            if existing.status != "open":
                vals["status"] = "open"
                vals["reviewed_by"] = False
                vals["reviewed_at"] = False
                vals["review_note"] = False
            existing.sudo().write(vals)
            return existing
        else:
            return self.sudo().create({
                "employee_id": employee_id,
                "company_id": company_id,
                "pattern_type": pattern_type,
                "severity": severity,
                "first_detected_at": today,
                "last_detected_at": today,
                "occurrence_count": occurrence_count,
                "supporting_data": supporting_data,
                "status": "open",
            })

    def action_review(self, note=""):
        """Mark as reviewed. Only HR / Admin may call this."""
        self._check_review_access()
        self.write({
            "status": "reviewed",
            "reviewed_by": self.env.uid,
            "reviewed_at": fields.Datetime.now(),
            "review_note": note or False,
        })

    def action_escalate(self, note=""):
        """Escalate to senior HR. Only HR / Admin may call this."""
        self._check_review_access()
        self.write({
            "status": "escalated",
            "reviewed_by": self.env.uid,
            "reviewed_at": fields.Datetime.now(),
            "review_note": note or False,
        })

    def _check_review_access(self):
        leave_model = self.env["hr.leave"]
        if not (
            self.env.user.has_group("hr.group_hr_user")
            or self.env.user.has_group("base.group_system")
            or leave_model._leave_is_administrator()
        ):
            raise AccessError(_("Only HR Administrators can review leave anomalies."))

    def to_dict(self):
        """Return a serialisable representation for the RPC layer."""
        self.ensure_one()
        return {
            "id": self.id,
            "employee_id": self.employee_id.id,
            "employee": self.employee_id.name,
            "department": self.employee_id.department_id.name or _("Unassigned"),
            "pattern_type": self.pattern_type,
            "pattern_type_label": self.pattern_type_label,
            "severity": self.severity,
            "severity_label": self.severity.capitalize() if self.severity else "",
            "first_detected": fields.Date.to_string(self.first_detected_at),
            "last_detected": fields.Date.to_string(self.last_detected_at),
            "occurrences": str(self.occurrence_count),
            "status": self.status,
            "reviewed_by": self.reviewed_by.name if self.reviewed_by else None,
            "reviewed_at": fields.Datetime.to_string(self.reviewed_at) if self.reviewed_at else None,
            "review_note": self.review_note or "",
            "supporting_data": self.supporting_data or "",
        }

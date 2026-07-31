# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError


class HrPreonboarding(models.Model):
    _name = "hr.preonboarding"
    _description = "Employee Pre-Onboarding"
    _inherit = ["mail.thread", "mail.activity.mixin"]
    _rec_name = "candidate_id"
    _order = "id desc"

    # Full ordered lifecycle of a pre-onboarding record.
    STATE_SEQUENCE = [
        "initiation",
        "awaiting_approval",
        "offer_accepted",
        "document_request",
        "document_received",
        "under_verification",
        "cleared",
        "converted_to_employee",
    ]
    TERMINAL_STATES = ("converted_to_employee", "rejected", "cancelled")

    candidate_id = fields.Many2one(
        "hr.applicant",
        string="Candidate",
        required=True,
        tracking=True,
        help="Applicant this pre-onboarding record is for.",
    )
    job_id = fields.Many2one(
        "hr.job",
        string="Role / Job Position",
        required=True,
        tracking=True,
    )
    department_id = fields.Many2one(
        "hr.department",
        string="Department",
        required=True,
        tracking=True,
    )
    # NOTE: named "follower_ids" per spec. This is a plain field on the
    # model (a list of HR staff who should be kept in the loop), distinct
    # from the mail.thread chatter followers (which live on
    # message_follower_ids / message_partner_ids).
    follower_ids = fields.Many2many(
        "hr.employee",
        "hr_preonboarding_follower_rel",
        "preonboarding_id",
        "employee_id",
        string="Followers",
        help="HR employees who should be notified of progress on this "
             "pre-onboarding case.",
    )

    state = fields.Selection(
        [
            ("initiation", "Initiation"),
            ("awaiting_approval", "Awaiting Approval"),
            ("offer_accepted", "Offer Accepted"),
            ("document_request", "Document Request"),
            ("document_received", "Document Received"),
            ("under_verification", "Under Verification"),
            ("cleared", "Cleared"),
            ("converted_to_employee", "Converted to Employee"),
            ("rejected", "Rejected"),
            ("cancelled", "Cancelled"),
        ],
        string="Stage",
        default="initiation",
        required=True,
        tracking=True,
        copy=False,
    )

    document_ids = fields.One2many(
        "offer.document", "preboarding_id", string="Documents"
    )
    document_count = fields.Integer(compute="_compute_document_count")

    employee_id = fields.Many2one(
        "hr.employee",
        string="Converted Employee",
        readonly=True,
        copy=False,
        help="Set automatically once this candidate is converted to an "
             "employee.",
    )

    active = fields.Boolean(default=True)

    @api.depends("document_ids")
    def _compute_document_count(self):
        for rec in self:
            rec.document_count = len(rec.document_ids)

    # ------------------------------------------------------------------
    # Stage transition buttons
    # ------------------------------------------------------------------
    def _check_state(self, expected):
        self.ensure_one()
        if self.state != expected:
            raise UserError(
                _("This action is not available from the current stage (%s).")
                % dict(self._fields["state"].selection).get(self.state)
            )

    def action_submit_for_approval(self):
        """initiation -> awaiting_approval"""
        for rec in self:
            rec._check_state("initiation")
            rec.state = "awaiting_approval"
            rec.message_post(body=_("Submitted for approval."))

    def action_approve(self):
        """awaiting_approval -> offer_accepted"""
        for rec in self:
            rec._check_state("awaiting_approval")
            rec.state = "offer_accepted"
            rec.message_post(body=_("Approved. Offer accepted."))

    def action_next_stage(self):
        """Advance one step along the sequential part of the workflow
        (offer_accepted -> document_request -> document_received ->
        under_verification -> cleared -> converted_to_employee).
        """
        for rec in self:
            if rec.state not in rec.STATE_SEQUENCE:
                raise UserError(_("Cannot advance from the current stage."))
            idx = rec.STATE_SEQUENCE.index(rec.state)
            if idx + 1 >= len(rec.STATE_SEQUENCE):
                raise UserError(_("This is already the final stage."))
            next_state = rec.STATE_SEQUENCE[idx + 1]
            rec.state = next_state
            rec.message_post(
                body=_("Stage moved to %s.")
                % dict(rec._fields["state"].selection).get(next_state)
            )
            if next_state == "converted_to_employee":
                rec._create_employee()

    def action_reject(self):
        for rec in self:
            if rec.state in rec.TERMINAL_STATES:
                raise UserError(_("This record is already closed."))
            rec.state = "rejected"
            rec.message_post(body=_("Pre-onboarding rejected."))

    def action_cancel(self):
        for rec in self:
            if rec.state in rec.TERMINAL_STATES:
                raise UserError(_("This record is already closed."))
            rec.state = "cancelled"
            rec.message_post(body=_("Pre-onboarding cancelled."))

    def action_reset_to_draft(self):
        """Convenience: reopen a rejected/cancelled record back to initiation."""
        for rec in self:
            rec.state = "initiation"
            rec.message_post(body=_("Reset to Initiation."))

    # ------------------------------------------------------------------
    # Employee conversion
    # ------------------------------------------------------------------
    def _create_employee(self):
        self.ensure_one()
        if self.employee_id:
            return self.employee_id
        applicant = self.candidate_id
        employee = self.env["hr.employee"].create(
            {
                "name": applicant.partner_name or applicant.name,
                "job_id": self.job_id.id,
                "department_id": self.department_id.id,
                "work_email": applicant.email_from,
                "mobile_phone": applicant.partner_phone,
            }
        )
        self.employee_id = employee.id
        self.message_post(
            body=_("Employee record %s created from this candidate.")
            % employee.name
        )
        return employee

    # ------------------------------------------------------------------
    # Reporting / helpers
    # ------------------------------------------------------------------
    @api.model
    def get_incomplete_preonboardings(self):
        """Return all pre-onboarding records that have not reached a
        finished state (i.e. not converted, rejected, or cancelled).
        """
        return self.search([("state", "not in", list(self.TERMINAL_STATES))])

    def action_view_documents(self):
        self.ensure_one()
        return {
            "type": "ir.actions.act_window",
            "name": _("Documents"),
            "res_model": "offer.document",
            "view_mode": "list,form",
            "domain": [("preboarding_id", "=", self.id)],
            "context": {
                "default_preboarding_id": self.id,
                "default_candidate_id": self.candidate_id.id,
            },
        }

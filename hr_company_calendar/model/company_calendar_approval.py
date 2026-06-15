# models/company_calendar_wizard.py
from odoo import models, fields, api
from odoo.exceptions import UserError


class CompanyCalendarApproval(models.Model):
    """This is the dashboard to hold all approvals"""
    _name = "calendar.approval.dashboard"
    _description = "Company Calendar Approval"
    _rec_name = 'view_mode'

    event_ids = fields.Many2many("calendar.event", string="Events")
    event_count = fields.Integer(string="Events", compute="_compute_counts")
    pending_count = fields.Integer(string="Pending", compute="_compute_counts")
    approved_count = fields.Integer(string="Approved", compute="_compute_counts")
    rejected_count = fields.Integer(string="Rejected", compute="_compute_counts")

    def action_get_started(self):
        # Customize: open a help document, tour, or URL
        return {"type": "ir.actions.act_url", "url": "/web#action=calendar", "target": "self"}

    def action_guided_tour(self):
        return {"type": "ir.actions.act_url", "url": "/web?tour=calendar_tour", "target": "self"}
    

    # ── counts ───────────────────────────────────────────────────────────────
    @api.depends()
    def _compute_counts(self):
        event_count = self.env["calendar.event"].search_count([
            ("calendar_status", "!=", "Opened")
        ])

        approved_count = self.env["calendar.event"].search_count([
            ("calendar_status", "=", "Approved")
        ])

        pending_count = self.env["calendar.event"].search_count([
            ("calendar_status", "=", "Pending")
        ])

        rejected_count = self.env["calendar.event"].search_count([
            ("calendar_status", "=", "Rejected")
        ])

        for rec in self:
            rec.event_count = event_count
            rec.approved_count = approved_count
            rec.pending_count = pending_count
            rec.rejected_count = rejected_count

    # ── view / filter state ──────────────────────────────────────────────────
    view_mode = fields.Selection(
        [("admin", "Admin View"), ("employee", "Employee View")],
        default="admin",
        string="View Mode",
    )
    event_search     = fields.Char(string="Search Events")
    filter_category  = fields.Selection(
        [("all", "All Categories"), ("holiday", "Holiday"), ("meeting", "Meeting"), ("training", "Training")],
        default="all", string="Category",
    )

    filter_visibility = fields.Selection(
        [("all", "All"), ("company_wide", "Company-wide"), ("department", "Department")],
        default="all", string="Visibility",
    )
    filter_sort = fields.Selection(
        [("newest", "Date: Newest first"), ("oldest", "Date: Oldest first"), ("az", "Name A–Z")],
        default="newest", string="Sort by",
    )

    tabIsVisible = fields.Selection(
        [
            ("event", "Event"),
            ("announcement", "Announcement"),
            ("meeting", "Meeting"),
            ("chat", "Chat"),
        ],
        string="Active Tab",
        default="event",
        help="Used to switch tabs"
    )

    # ── computed counts ───────────────────────────────────────────────────────
    
    # ── server action / auto-load entry point ─────────────────────────────────
    @api.model
    def action_load_data(self):
        """
        Populates the transient record with live data.
        Called by:
          - JS controller on form mount  (orm.call "action_load_data")
          - ir.actions.server binding    (records.action_load_data())
        """
        records = self.env['calendar.approval.dashboard'].search([], limit=1)
        if not records:
            records = super(CompanyCalendarApproval, self).create({})
        # ── Events (calendar.event that are NOT private meetings) ──
        
        events = self.env["calendar.event"].search(
            [("calendar_status", "in", ["Pending", "Rejected"])],
            order="start desc",
            limit=10,
        )
        records.event_ids = events

        # Re-open the same wizard to reflect fresh data
        view_id = self.env.ref(
            "hr_company_calendar.view_company_calendar_approval_wizard_form",
            raise_if_not_found=False
        )
        if not view_id:
            raise UserError('View not found')
        if records:
            return {
                "name": "Event Approvals",
                "type": "ir.actions.act_window",
                "res_model": "calendar.approval.dashboard",
                "res_id": records.id,
                "view_mode": "form",
                "view_id": view_id.id,
                "target": "current",
            }
        else:
            return False
    
     
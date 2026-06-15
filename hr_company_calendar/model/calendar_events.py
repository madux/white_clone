from odoo import models, fields, api
from odoo.exceptions import UserError

class CalendarEvents(models.Model):
    _inherit = 'calendar.event'

    filter_category  = fields.Selection(
        [("all", "All Categories"), ("holiday", "Holiday"), ("meeting", "Meeting"), ("training", "Training")],
        default="all", string="Category",
    )
    check_in_attendee_ids = fields.Many2many("res.users",string="Checkin Attendes",
                                              help="This determines the attendees that attended")
    department_id = fields.Many2one("hr.department", string="Department")
    to_approved_by = fields.Many2one("hr.employee", string="To be Approved by")
    calendar_status = fields.Selection(
        [("Opened", "Opened"), 
         ("Pending", "Pending"), 
         ("Approved", "Approved"), ("Rejected", "Rejected")],
        default="Opened", string="Calendar status",
        store=True
    )

    def set_event_as_public(self):
        self.calendar_status = "Opened"

    def approve_events(self):
        if self.to_approved_by:
            if self.to_approved_by.user_id.id != self.env.uid:
                raise UserError("You are not allowed to approve this event")
            self.calendar_status = "Approved"

            
    def reject_events(self):
        if self.to_approved_by:
            if self.to_approved_by.user_id.id != self.env.uid:
                raise UserError("You are not allowed to reject this event")
            self.calendar_status = "Rejected"
            
    def send_event_for_approval(self):
        "Avaible on opened and Rejected"
        if not self.to_approved_by:
            raise UserError("Please select user to approve this event")
        self.calendar_status = "Pending"
        
    def action_open_event(self):
        self.ensure_one()

        return {
            "type": "ir.actions.act_window",
            "name": 'Calendar Events',
            "res_model": "calendar.event",
            "res_id": self.id,
            "view_mode": "form",
            "view_id": self.env.ref("calendar.view_calendar_event_form").id,
            "target": "new",
        }
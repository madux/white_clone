# models/company_calendar_wizard.py
from odoo import models, fields, api
from odoo.exceptions import UserError

class HrCompanyannouncement(models.Model):
    _name = 'hr.core_announcement'
    _description = 'announcement'
    _rec_name = 'announcement_title'

    announcement_body = fields.Html(string="Announcement Body", size=300, copy=False)
    announcement_title = fields.Char(string="Announcement title", copy=False)
    is_published = fields.Boolean(string="is published", default=False, copy=False)
    announcement_type = fields.Selection([
        ('info', 'Info'),
        ('alert', 'Alert'), 
        ('maintenance', 'Maintenance'),
        ('event', 'Event')],
        string="Announcement type", copy=False)

    priority_level = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'), 
        ('high', 'High'),
        ],
        string="Announcement type", copy=False)
    date_publish = fields.Datetime(string="Date publish", readonly=True)
    number_of_views = fields.Integer(string="Views", copy=False)
    

class CompanyCalendarWizard(models.Model):
    """
    Transient model for the Company Calendar modal.
    Opened via ir.actions.act_window (target='new').
    `action_load_data` is called automatically by the JS controller on mount,
    or can be bound as an ir.actions.server for button triggers.
    """
    _name = "company.calendar.dashboard"
    _description = "Company Calendar Wizard"
    _rec_name = 'view_mode'


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

    # ── computed counts ───────────────────────────────────────────────────────
    event_count        = fields.Integer(string="Events",        compute="_compute_counts")
    meeting_count      = fields.Integer(string="Meetings",      compute="_compute_counts")
    announcement_count = fields.Integer(string="Announcements", compute="_compute_counts")

    # ── relational data (populated by action_load_data) ───────────────────────
    event_ids        = fields.Many2many("calendar.event",    string="Events")
    meeting_ids      = fields.Many2many("calendar.event",    string="Meetings",
                                        relation="cc_wiz_meeting_rel")
    announcement_ids = fields.Many2many("hr.core_announcement", string="Announcements")
    channel_id       = fields.Many2one("discuss.channel",    string="Channel")

    # ── counts ───────────────────────────────────────────────────────────────
    @api.depends("event_ids", "meeting_ids", "announcement_ids")
    def _compute_counts(self):
        for rec in self:
            rec.event_count        = len(rec.event_ids)
            rec.meeting_count      = len(rec.meeting_ids)
            rec.announcement_count = len(rec.announcement_ids)

    # ── server action / auto-load entry point ─────────────────────────────────
    @api.model
    def action_load_data(self):
        """
        Populates the transient record with live data.
        Called by:
          - JS controller on form mount  (orm.call "action_load_data")
          - ir.actions.server binding    (records.action_load_data())
        """
        records = self.env['company.calendar.dashboard'].search([], limit=1)
        if not records:
            records = super(CompanyCalendarWizard, self).create({})
        # ── Events (calendar.event that are NOT private meetings) ──
        
        if not records:
            raise UserError("ERROR: Calender wizard Record not found")
        events = self.env["calendar.event"].search(
            [("privacy", "!=", "confidential")],
            order="start desc",
            limit=10,
        )
        
        records.event_ids = events

        # ── Meetings (calendar.event tied to current user) ──
        meetings = self.env["calendar.event"].search(
            [("partner_ids", "in", self.env.user.partner_id.ids)],
            order="start desc",
            limit=10,
        )
        records.meeting_ids = meetings

        # ── Announcements ──
        # Adjust model name to match your installed HR Announcement module
        if "hr.core_announcement" in self.env:
            announcements = self.env["hr.core_announcement"].search(
                [("is_published", "=", True)],
                order="date_publish desc",
                limit=10,
            )

            records.announcement_ids = [(6, 0, announcements.ids)]
        else:
            raise UserError('Error, no announcement found')

        # ── Default Discuss channel ──
        channel = self.env["discuss.channel"].search(
            [("channel_type", "=", "channel"), ("name", "ilike", "general")],
            limit=1,
        )
        records.channel_id = channel
        # record.action_load_data()
        # Re-open the same wizard to reflect fresh data
        view_id = self.env.ref(
            "hr_company_calendar.view_company_calendar_wizard_form",
            raise_if_not_found=False
        )
        if not view_id:
            raise UserError('View not found')
        if records:
            return {
                "name": "Activities",
                "type": "ir.actions.act_window",
                "res_model": "company.calendar.dashboard",
                "res_id": records.id,
                "view_mode": "form",
                "view_id": view_id.id,
                "target": "current",
            }
        else:
            return {
                "name": "New Event",
                "type": "ir.actions.act_window",
                "res_model": 'calendar.event',
                "view_mode": "form",
                "view_id": self.env.ref("calendar.view_calendar_event_form").id,
                "target": "new",
            }

        # Return False so ir.actions.server doesn't redirect
        # return False

    @api.onchange("filter_category")
    def _onchange_filter_category(self):
        self.event_ids = [(5, 0, 0)]  # Clear current records

        domain = []

        if self.filter_category != "all":
            domain.append(("filter_category", "=", self.filter_category))

        events = self.env["calendar.event"].search(
            domain,
            order="start desc",
            limit=100,
        )

        self.event_ids = [(6, 0, events.ids)]

    @api.onchange("filter_sort")
    def _onchange_filter_sort(self):
        order = "start desc"

        if self.filter_sort == "oldest":
            order = "start asc"

        elif self.filter_sort == "az":
            order = "name asc"

        events = self.env["calendar.event"].search(
            [],
            order=order,
        )

        self.event_ids = [(6, 0, events.ids)]

    @api.onchange("filter_visibility")
    def _onchange_filter_visibility(self):
        domain = []

        if self.filter_visibility == "company_wide":
            domain.append(("department_id", "=", False))

        elif self.filter_visibility == "department":
            employee = self.env["hr.employee"].search(
                [("user_id", "=", self.env.user.id)],
                limit=1,
            )

            if employee and employee.department_id:
                domain.append(
                    ("department_id", "=", employee.department_id.id)
                )
            else:
                domain.append(("id", "=", 0))

        events = self.env["calendar.event"].search(
            domain,
            order="start desc",
        )

        self.event_ids = [(6, 0, events.ids)]

    @api.onchange("event_search")
    def _onchange_event_search(self):
        self.event_ids = [(5, 0, 0)]  # Clear current events

        if self.event_search and len(self.event_search.strip()) >= 3:
            events = self.env["calendar.event"].search(
                [("name", "ilike", self.event_search.strip())],
                order="start desc",
            )

            self.event_ids = [(6, 0, events.ids)]

    # ── button actions ────────────────────────────────────────────────────────
    def action_refresh(self):
        record = self.search([], limit=1)
        if not record:
            record = super(CompanyCalendarWizard, self).create({})
        record.action_load_data()
        # Re-open the same wizard to reflect fresh data
        return {
            "type": "ir.actions.act_window",
            "res_model": self._name,
            "res_id": record.id,
            "view_mode": "form",
            "view_id": self.env.ref("hr_company_calendar.view_company_calendar_wizard_form").id,
            "target": "new",
        }
    
    def load_events(self):
        self.ensure_one()
        domain = []

        # Category Filter
        if self.filter_category != "all":
            domain.append(
                ("filter_category", "=", self.filter_category)
            )
        # Visibility Filter
        if self.filter_visibility == "company_wide":
            domain.append(("department_id", "=", False))

        elif self.filter_visibility == "department":
            employee = self.env["hr.employee"].search(
                [("user_id", "=", self.env.user.id)],
                limit=1,
            )

            if employee and employee.department_id:
                domain.append(
                    ("department_id", "=", employee.department_id.id)
                )
            else:
                domain.append(("id", "=", 0))

        # Sorting
        order = "start desc"
        if self.filter_sort == "oldest":
            order = "start asc"
        elif self.filter_sort == "az":
            order = "name asc"

        events = self.env["calendar.event"].search(
            domain,
            order=order,
        )
        return events.ids
    
    def get_model_view(self, name, model, view_mode, target, domain_ids=[]):
        vals = {
            "name": name,
            "type": "ir.actions.act_window",
            "res_model": model,
            "view_mode": view_mode,
            "target": target,
        }
        if domain_ids:
            vals.update({
                'domain': [('id', 'in', domain_ids)]
            })
        return vals

    def action_create_event(self):
        return self.get_model_view('Activities', 'calendar.event', 'form', 'new')
        
    
    def action_create_announcement(self):
        return self.get_model_view('Announcement', 'hr.core_announcement', 'form', 'new')

    
    def action_view_all_event(self):
        domain = self.load_events()
        return self.get_model_view('Activities', 'calendar.event', 'tree', 'new', domain)

    def action_view_all_event_approval(self):
        items = self.env['calendar.event'].search([('calendar_status', '!=', 'Opened')])
        domain = [] 
        if items:
            domain = items.ids
        return self.get_model_view('Activities', 'calendar.event', 'tree', 'new', domain)

    
    def action_view_all_announcement(self):
        return self.get_model_view('Announcement', 'hr.core_announcement', 'tree', 'new')

    def action_get_started(self):
        # Customize: open a help document, tour, or URL
        return {"type": "ir.actions.act_url", "url": "/web#action=calendar", "target": "self"}

    def action_guided_tour(self):
        return {"type": "ir.actions.act_url", "url": "/web?tour=calendar_tour", "target": "self"}
    
    def _reload_wizard(self):
        return {
            'type': 'ir.actions.act_window',
            'name': 'Activities',
            'res_model': "company.calendar.dashboard",
            'res_id': self.id,
            'view_mode': 'form',
            'target': 'new',
        }
    
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
    
    def action_show_event(self):
        self.tabIsVisible = "event"
        return self._reload_wizard()

    def action_show_announcement(self):
        self.tabIsVisible = "announcement"
        return self._reload_wizard()

    def action_show_meeting(self):
        self.tabIsVisible = "meeting"
        return self._reload_wizard()

    def action_show_chat(self):
        self.tabIsVisible = "chat"
        return self._reload_wizard()

    def action_show_day(self):
        self.ensure_one()
        return self._reload_wizard()

    def action_show_list(self):
        self.ensure_one()
        return self._reload_wizard()

    def action_show_week(self):
        self.ensure_one()
        return self._reload_wizard()
     
    def action_show_month(self):
        self.ensure_one()
        return self._reload_wizard() 
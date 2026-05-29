from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class HrEmployee(models.Model):
    _inherit = 'hr.employee'

    first_name = fields.Char(string="First name", required=True, copy=False)
    middle_name = fields.Char(string="Middle name", copy=False)
    
    last_name = fields.Char("Surname", required=True, copy=False)
    birthday = fields.Date(string="Birthday", copy=False)
    calendar_date = fields.Date(string="Birthday", copy=False)
    employment_date = fields.Date(string="Birthday", copy=False)

    house_address = fields.Char(string='House Address')
    age = fields.Char(string='Age')
    local_government = fields.Many2one('res.lga', string='LGA')
    state_id = fields.Many2one('res.country.state', string='State')
    state_of_origin = fields.Char(string='State of Origin')
    lga = fields.Char(string='Local Goovernment') 
    rank_id = fields.Many2one('hr.rank', string='Rank')
    is_external_staff = fields.Boolean(string='Is External')
    external_company_id = fields.Many2one('res.partner', string='External Company')
    next_of_kin_ids = fields.Many2many('res.partner', 'nok_partner_public_rel', 'nok_partner_public_id', string='Next of Kin(s)')

    spouse_name = fields.Char(string='Spouse Name')
    spouse_telephone = fields.Char(string='Spouse Telephone')
    father_name = fields.Char(string="Father's Name")
    father_phone = fields.Char(string="Father's Phone")
    mother_name = fields.Char(string="Mother's Name")
    mother_phone = fields.Char(string="Mother's Phone")
    manager = fields.Boolean(string="Is a Manager")

    employee_number = fields.Char(string="Staff Number")
    awardee_id = fields.Many2one('hr.employee', string="Awardee")
    awardee_job_id = fields.Char(related="awardee_id.job_id.name")

    
    todays_date = fields.Date(default=fields.Date.today())
    formatted_today_date = fields.Char(
        compute="_compute_formatted_date"
    )

    work_start_datetime = fields.Datetime(default=fields.Datetime.now(), 
    help="Linked with the user attendance app to determine working hours")

    total_work_duration = fields.Char(
        compute="_compute_total_duration"
    )
    number_of_incidents = fields.Integer(
        compute="_compute_number_of_incidents",
        string="Number of Incidents"
    )
    number_open_incident = fields.Integer(
        compute="_compute_number_of_incidents",
        string="Number of Incidents"
    )
    number_open_announcement = fields.Integer(
        compute="_compute_announcements",
        string="Number of Announcement"
    )
    announcement_ids = fields.Many2many(
        'hr.core_announcement',
        string="Announcements",
        # compute="_compute_announcements"
    )

    emp_remaining_leave_days = fields.Integer(
        string="Remaining Leave Days",
        compute="_compute_remaining_leave_days"
    )

    employee_leave_ids = fields.Many2many(
        'hr.leave',
        string="Leave",
        # compute="_compute_recent_leaves"
    )
    employee_document_ids = fields.Many2many(
        'ir.attachment',
        'employee_document_rel',
        'employee_id',
        'document_id',
        string="Documents",
    )
    

    anniversary_celebrant_ids = fields.Many2many(
        'hr.employee',
        string="anniversary Celebrants",
        compute="_compute_anniversary_celebrants"
    )
    anniversary_count = fields.Integer(
        compute="_compute_anniversary_celebrants"
    )

    employment_years_count = fields.Integer(
        compute="_compute_employee_anniversary"
    )

    birthday_celebrant_ids = fields.Many2many(
        'hr.employee',
        string="Birthday Celebrants",
        compute="_compute_birthday_celebrants"
    )

    birthday_count = fields.Integer(
        compute="_compute_birthday_celebrants"
    )
    is_present = fields.Boolean(
    )
    is_present_text = fields.Char(
        compute="_compute_checkins"
    )

    action_type = fields.Char(
        default="incident", help="Used to compute the type of list to display .e.g all, incident, leave, document, etc"
    )

    def action_open_emp_leave(self):
        self.action_type = 'leave'
        employee_leaves = self.env['hr.leave'].search([('employee_id', '=', self.id)], limit=5)
        if employee_leaves:
            self.employee_leave_ids = [(6, 0, employee_leaves.ids)]
        
    def action_open_emp_document(self):
        self.action_type = 'document'
        employee_document = self.env['ir.attachment'].search([('employee_id', '=', self.id)], limit=5)
        if employee_document:
            self.employee_document_ids = [(6, 0, employee_document.ids)]

    def action_open_emp_incident(self):
        self.action_type = 'incident'
        employee_document = self.env['hr.warning'].search([('employee_id', '=', self.id)], limit=5)
        if employee_document:
            self.employee_document_ids = [(6, 0, employee_document.ids)]

    # calendar_ids = fields.Many2many(
    #     comodel_name='calendar.event',
    #     string='My Calendar Events',
    #     compute='_compute_calendar_ids',
    # )

    # @api.depends('name', 'user_id.partner_id')
    # def _compute_recent_leaves(self):
    #     for employee in self:
    #         if employee.user_id and employee.user_id.partner_id:
    #             employee.calendar_ids = self.env['calendar.event'].search([
    #                 ('partner_ids', 'in', employee.user_id.partner_id.ids)
    #             ])
    #         else:
    #             employee.calendar_ids = self.env['calendar.event']

    def action_wish_birthday(self):
        pass

    def view_all_celebrants(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Celebrants',
            'res_model': 'hr.employee',
            'view_mode': 'list,form',
            'views': [
                (False, 'list'),
                (False, 'form')
            ],
            'domain': [('id', 'in', birthday_celebrant_ids.ids)],
            'target': 'current',
        }



    @api.depends('birthday')
    def _compute_birthday_celebrants(self):

        today = fields.Date.today()

        month_day = today.strftime('%m-%d')

        employees = self.env['hr.employee'].search([
            ('birthday', '!=', False)
        ]).filtered(
            lambda e: e.birthday.strftime('%m-%d') == month_day
        )[:3]

        for rec in self:
            if rec.birthday:
                rec.birthday_celebrant_ids = employees
                rec.birthday_count = len(employees)
            else:
                rec.birthday_celebrant_ids = False
                rec.birthday_count = 0

    def action_wish_anniversary_celebrant(self):
        pass

    def view_all_anniversary_celebrant(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': 'Anniversary',
            'res_model': 'hr.employee',
            'view_mode': 'list,form',
            'views': [
                (False, 'list'),
                (False, 'form')
            ],
            'domain': [('id', 'in', self.anniversary_celebrant_ids.ids)],
            'target': 'current',
        }
    
    @api.depends('employment_date')
    def _compute_anniversary_celebrants(self):
        today = fields.Date.today()
        month_day = today.strftime('%m-%d')
        employees = self.env['hr.employee'].search([
            ('employment_date', '!=', False)
        ]).filtered(
            lambda e: e.employment_date.strftime('%m-%d') == month_day
        )[:3]

        for rec in self:
            if employees:
                rec.anniversary_celebrant_ids = employees
                rec.anniversary_count = len(employees)
            else:
                rec.anniversary_celebrant_ids = False
                rec.anniversary_count = 0

    @api.depends('announcement_ids.is_published')
    def _compute_announcements(self):
        for rec in self:
            count = 0
            for ann in self.announcement_ids:
                if ann.is_published:
                    count += 1
            rec.number_open_announcement = count


    @api.depends('active')
    def _compute_checkins(self):
        if self.active:
            self.is_present_text = "Checked in"
        else:
            self.is_present_text = "Yet to Checkin"


        # today = fields.Date.today()
        # month_day = today.strftime('%m-%d')
        # core_announcement = self.env['hr.core_announcement'].search([
        #     ('is_published', '!=', False),
        #     ('expiry_date', '<', today),
        # ]) 

        # for rec in self:
        #     if core_announcement:
        #         rec.announcement_ids = core_announcement
        #         rec.number_open_announcement = len(core_announcement)
        #     else:
        #         rec.announcement_ids = False
        #         rec.number_open_announcement = 0

    @api.depends('employment_date')
    def _compute_employee_anniversary(self):
        self.ensure_one()
        today = fields.Date.today()
        employment_date = self.employment_date

        for rec in self:
            if employment_date:
                diff = today - rec.employment_date
                rec.employment_years_count = diff.days
            else:
                rec.employment_years_count = 0
            
    @api.depends('name')
    def _compute_remaining_leave_days(self):
        for rec in self:
            # Total Approved Allocations
            allocations = self.env['hr.leave.allocation'].search([
                ('employee_id', '=', rec.id),
                ('state', '=', 'validate'),
            ])
            allocated_days = sum(
                allocations.mapped('number_of_days_display')
            )
            # Total Approved Leaves Taken
            leaves = self.env['hr.leave'].search([
                ('employee_id', '=', rec.id),
                ('state', '=', 'validate'),
            ])
            taken_days = sum(
                leaves.mapped('number_of_days_display')
            )
            rec.emp_remaining_leave_days = (
                allocated_days - taken_days
            )

    @api.depends('hr_warning_ids')
    def _compute_number_of_incidents(self):
        for rec in self:
            rec.number_of_incidents = self.env[
                'hr.warning'
            ].search_count([
                ('employee_id', '=', rec.id)
            ])

            rec.number_open_incident = self.env[
                'hr.warning'
            ].search_count([
                ('employee_id', '=', rec.id),
                ('state', 'not in', ['draft','closed']),

            ]) 

    def action_review_incident(self):
        self.ensure_one()

        incidents = self.env['hr.warning'].search([
            ('employee_id', '=', self.id)
        ])

        return {
            'type': 'ir.actions.act_window',
            'name': 'Incidents',
            'res_model': 'hr.warning',
            'view_mode': 'list,form',
            'views': [
                (False, 'list'),
                (False, 'form')
            ],
            'domain': [('id', 'in', incidents.ids)],
            'target': 'current',
        }

    def action_review_open_incident(self):
        self.ensure_one()

        incidents = self.env['hr.warning'].search([
            ('employee_id', '=', self.id),
            ('state', 'not in', ['draft','closed']),
        ])

        return {
            'type': 'ir.actions.act_window',
            'name': 'Incidents',
            'res_model': 'hr.warning',
            'view_mode': 'list,form',
            'views': [
                (False, 'list'),
                (False, 'form')
            ],
            'domain': [('id', 'in', incidents.ids)],
            'target': 'current',
        }

    @api.depends('work_start_datetime')
    def _compute_total_duration(self):
        for rec in self:
            if rec.work_start_datetime:
                start_dt = fields.Datetime.from_string(
                    rec.work_start_datetime
                )
                current_dt = fields.Datetime.now()
                duration = current_dt - start_dt
                days = duration.days
                hours, remainder = divmod(
                    duration.seconds, 3600
                )
                minutes, _ = divmod(remainder, 60)
                rec.total_work_duration = (
                    f"{days}d {hours}h {minutes}m"
                )
            else:
                rec.total_work_duration = False

    def action_clock_in(self):
        pass 
        '''link this to attendance'''

    def action_clock_out(self):
        pass 
        '''link this to attendance'''

    @api.depends('todays_date')
    def _compute_formatted_date(self):
        for rec in self:
            if rec.todays_date:
                rec.formatted_today_date = datetime.strptime(
                    str(rec.todays_date),
                    "%Y-%m-%d"
                ).strftime("%a, %b %d")
            else:
                rec.formatted_today_date = False

    # hr_warning_ids = fields.One2many("hr.warning", 'employee_id', string="Disciplinary Actions")

    def action_view_profile(self):
        form_view_id = self.env.ref(
                'hr_employee.hr_employee_profile_form_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'name': _('Employee profile'),
            'res_model': self._name,
            'res_id': self.id,
            'view_mode': 'tree',
            'views': [
                    (form_view_id, 'form')
                ], 
            'target': 'current',
            # 'domain': [('id', 'in', rec_ids)]
        }
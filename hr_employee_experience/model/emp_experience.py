from odoo import api, fields, models


class HrExperienceDashboard(models.TransientModel):
    _name = 'hr.experience.dashboard'
    _description = 'HR Experience Dashboard'
    _rec_name = "id"

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        readonly=True,
    )

    is_admin = fields.Boolean(
        string='Is Administrator',
        compute='_compute_is_admin',
    )

    video_watched = fields.Integer(
        string='Videos Watched',
        compute='_compute_video_watched',
    )

    messages_sent_this_month = fields.Integer(
        string='Messages Sent This Month',
        compute='_compute_messages_sent_this_month',
    )

    active_campaigns = fields.Integer(
        string='Active Campaigns',
        compute='_compute_active_campaigns',
    )

    knowledge_item_published = fields.Integer(
        string='Knowledge Items Published',
        compute='_compute_knowledge_item_published',
    )

    upcoming_celebrations = fields.Integer(
        string='Upcoming Celebrations',
        compute='_compute_upcoming_celebrations',
    )

    birth_celebrant_ids = fields.Many2many(
        'hr.employee',
        string='Birthday Celebrants',
        compute='_compute_upcoming_celebrations',
    )

    upcoming_events = fields.Many2many(
        'hr.core_announcement',
        string='Upcoming Events',
        compute='_compute_upcoming_events',
    )

    recognition_this_month = fields.Integer(
        string='Recognition This Month',
        compute='_compute_recognition_this_month',
    )

    @api.depends()
    def _compute_is_admin(self):
        is_admin = self.env.user.has_group('base.group_system')

        for record in self:
            record.is_admin = is_admin

    @api.model
    def _get_current_employee(self):
        return self.env['hr.employee'].search(
            [('user_id', '=', self.env.uid)],
            limit=1
        )

    @api.depends()
    def _compute_video_watched(self):
        VideoWatch = self.env['hr.experience.video.watch']

        for record in self:
            if record.is_admin:
                record.video_watched = VideoWatch.search_count([
                    ('watched', '=', True),
                ])
            else:
                employee = record.employee_id

                if not employee:
                    record.video_watched = 0
                    continue

                record.video_watched = VideoWatch.search_count([
                    ('employee_id', '=', employee.id),
                    ('watched', '=', True),
                ])

    @api.depends()
    def _compute_active_campaigns(self):
        CalendarEvent = self.env['calendar.event']

        for record in self:
            domain = [
                ('filter_category', '=', 'campaigns'),
            ]

            # If you have an active/date condition on calendar.event,
            # add it here.
            #
            # Example:
            domain += [('stop', '>=', fields.Datetime.now())]

            record.active_campaigns = CalendarEvent.search_count(domain)

    @api.depends()
    def _compute_upcoming_celebrations(self):
        Employee = self.env['hr.employee']

        today = fields.Date.context_today(self)

        # Find employees whose birthday is today.
        employees = Employee.search([
            ('birthday', '!=', False),
        ])

        birthday_employees = employees.filtered(
            lambda employee:
                employee.birthday.month == today.month
                and employee.birthday.day == today.day
        )

        for record in self:
            # Birthdays are intentionally global.
            record.birth_celebrant_ids = birthday_employees
            record.upcoming_celebrations = len(birthday_employees)

    @api.depends()
    def _compute_upcoming_events(self):
        Announcement = self.env['hr.core_announcement']

        for record in self:

            if record.is_admin:
                announcements = Announcement.search(
                    [],
                    order='id desc'
                )
            else:
                employee = record.employee_id

                if not employee:
                    record.upcoming_events = False
                    continue

                # announcement_ids is assumed to exist on hr.employee
                announcements = employee.announcement_ids

            record.upcoming_events = announcements

    @api.depends()
    def _compute_messages_sent_this_month(self):
        """
        Replace hr.experience.message with the actual model
        you use for employee messaging.
        """

        for record in self:
            record.messages_sent_this_month = 0

            # Example implementation:
            #
            Message = self.env['hr.experience.message']
            
            today = fields.Date.context_today(self)
            first_day = today.replace(day=1)
            
            if record.is_admin:
                domain = [
                    ('create_date', '>=', first_day),
                ]
            else:
                domain = [
                    ('employee_id', '=', record.employee_id.id),
                    ('create_date', '>=', first_day),
                ]
            
            record.messages_sent_this_month = Message.search_count(domain)

    @api.depends()
    def _compute_knowledge_item_published(self):
        """
        Replace hr.experience.knowledge with your actual
        knowledge-base model.
        """

        for record in self:
            record.knowledge_item_published = 0

            # Example:
            #
            Knowledge = self.env['hr.experience.knowledge']
            
            domain = [
                ('state', '=', 'published')
            ]
            
            if not record.is_admin:
                domain.append(
                    ('employee_id', '=', record.employee_id.id)
                )
            
            record.knowledge_item_published = Knowledge.search_count(domain)

    @api.depends()
    def _compute_recognition_this_month(self):
        """
        Replace hr.experience.recognition with the actual
        recognition model.
        """

        for record in self:
            record.recognition_this_month = 0

            # Example:
            #
            Recognition = self.env['hr.experience.recognition']
            #
            today = fields.Date.context_today(self)
            first_day = today.replace(day=1)
            
            domain = [
                ('create_date', '>=', first_day),
            ]
            
            if not record.is_admin:
                domain.append(
                    ('employee_id', '=', record.employee_id.id)
                )
            
            record.recognition_this_month = Recognition.search_count(
                domain
            )

    @api.model
    def create_dashboard(self):
        """
        Creates the dashboard record when the menu is clicked.
        """

        employee = self._get_current_employee()

        dashboard = self.create({
            'employee_id': employee.id if employee else False,
        })

        return {
            'type': 'ir.actions.act_window',
            'name': 'HR Experience Dashboard',
            'res_model': 'hr.experience.dashboard',
            'view_mode': 'form',
            'res_id': dashboard.id,
            'target': 'current',
        }
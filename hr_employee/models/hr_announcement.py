from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class Hr_announcement(models.Model):
    _name = 'hr.core_announcement'
    _description = 'announcement'
    _rec_name = 'announcement_title'

    announcement_body = fields.Html(string="Announcement Body", size=300, copy=False)
    announcement_title = fields.Char(string="Announcement title", copy=False)
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
    announcement_attachment_ids = fields.Many2many(
        comodel_name='ir.attachment',
        relation='hr_employee_announcement_rel',
        column1='announcement_id',
        column2='attachment_id',
        string='Attachments',
    )

    target_audience = fields.Selection([
        ('all_employee', 'All employee'),
        ('management', 'Management Only'), 
        ('specific_department', 'Specific Department'),
        ('specific_role', 'specific_role'),
        ('custom', 'Custom Audience')
        ],
        string="Target Audience", copy=False)

    target_department_ids = fields.Many2many(
        comodel_name='hr.department',
        relation='target_department_ids_rel',
        column1='announcement_id',
        column2='department_id',
        string='Target Departments',
    )

    target_employee_ids = fields.Many2many(
        comodel_name='hr.employee',
        relation='target_employee_rel',
        column1='announcement_id',
        column2='employee_id',
        string='Target Employees',
    )

    acknowledged_user_ids = fields.Many2many(
        comodel_name='res.users',
        relation='acknowledged_user_rel',
        column1='announcement_id',
        column2='user_id',
        string='Acknowledged Users',
    )

    receipient_ids = fields.Many2many(
        comodel_name='res.users',
        relation='receipient_user_rel',
        column1='receipient_id',
        column2='user_id',
        string='Receipient Users',
    )

    target_specific_role_ids = fields.Many2many(
        comodel_name='hr.job',
        relation='target_job_rel',
        column1='announcement_id',
        column2='job_id',
        string='Target Role',
    )
    expiry_date = fields.Datetime(string="Expiry time", required=True, copy=False)
    date_publish = fields.Datetime(string="Date publish", readonly=True)

    is_published = fields.Boolean(string="is published", default=False, copy=False)
    number_of_views = fields.Integer(string="Views", copy=False)
    send_email_notification = fields.Boolean(string="Send Mail Notification", default=True)
    send_push_notification = fields.Boolean(string="Send Push Notification", default=False)
    require_acknowledgement= fields.Boolean(string="Require acknowledgement", default=False)
    active = fields.Boolean(string="Active", default=True)
    mail_template_id = fields.Many2one(
        'mail.template',
        string='Mail Templates',
        domain=[('model', '=', 'hr.core_announcement')],
        # lambda self: self.get_mail_templates()
    )

    def get_mail_templates(self):
        announcement_model = self.env.ref('hr_employee.model_hr_core_announcement')
        templates = self.env['mail.template'].search([('model_id', '=', announcement_model.id)]) 
        if templates:
            return [('id', 'in', templates.ids)]
        else:
            return [('id', 'in', [0])]

    def action_view_announcement(self):
        self.ensure_one()
        self.number_of_views = self.number_of_views + 1
        if self.require_acknowledgement:
            self.acknowledged_user_ids = [(4, self.env.user.id)]
        return {
            'type': 'ir.actions.act_window',
            'name': 'Announcement',
            'res_model': self._name,
            'view_mode': 'form',
            'views': [
                # (False, 'list'),
                (False, 'form')
            ],
            'res_id': self.id,
            'target': 'new',
        }

    def action_publish_announcement(self):
        self.is_published = True
        self.date_publish = fields.Datetime.now()
        target_audience_ids = []
        if fields.Datetime.now() > self.expiry_date:
            raise UserError("Sorry you cannot publish this because the expiry date is less than today's date")
        if self.target_audience == 'all_employee':
            employee_ids = self.env['hr.employee'].search([('active', '=', True)])
            if not employee_ids:
                 raise UserError("System does not find any single employee")
            for emp in employee_ids:
                emp.announcement_ids = [(4, self.id)] 
                # prepare audience for send mail
                target_audience_ids.append({
                    'name': emp.user_id.name or emp.name,
                    'email': emp.user_id.email or emp.work_email,
                    'lang': emp.user_id.lang if emp.user_id else '',
                    })
                if emp.user_id:
                    self.receipient_ids = [(4, emp.user_id.id)] 
        elif self.target_audience == 'management':
            pass # TODO Add all employees by grade 

        elif self.target_audience == 'specific_department':
            if not self.target_department_ids:
                 raise UserError("Please select targeted department")
            for dept in self.target_department_ids:
                employee_depts = self.env['hr.employee'].search([('department_id', '=', dept.id)])
                if employee_depts:
                    for emp in employee_depts:
                        emp.announcement_ids = [(4, self.id)] 
                        # prepare audience for send mail
                        target_audience_ids.append({
                            'name': emp.user_id.name or emp.name,
                            'email': emp.user_id.email or emp.work_email,
                            'lang': emp.user_id.lang if emp.user_id else '',
                            })  
                        if emp.user_id:
                            self.receipient_ids = [(4, emp.user_id.id)] 
                        
        elif self.target_audience == 'specific_role':
            if not self.target_specific_role_ids:
                 raise UserError("Please select targeted roles")
            for role in self.target_specific_role_ids:
                for emp in role.employee_ids:
                    emp.announcement_ids = [(4, self.id)] 
                    # prepare audience for send mail
                    target_audience_ids.append({
                        'name': emp.user_id.name or emp.name,
                        'email': emp.user_id.email or emp.work_email,
                        'lang': emp.user_id.lang if emp.user_id else '',
                        })
                    if emp.user_id:
                        self.receipient_ids = [(4, emp.user_id.id)] 
                     
        else:
            '''send to selectd employees'''
            if not self.target_employee_ids:
                 raise UserError("Please select targeted employees")
            for emp in self.target_employee_ids:
                emp.announcement_ids = [(4, self.id)] 
                # prepare audience for send mail
                target_audience_ids.append({
                    'name': emp.user_id.name or emp.name,
                    'email': emp.user_id.email or emp.work_email,
                    'lang': emp.user_id.lang if emp.user_id else '',
                    })
                if emp.user_id:  
                    self.receipient_ids = [(4, emp.user_id.id)]   
        self.mail_notify(target_audience_ids)
                
    def action_unpublish_announcement(self):
        self.is_published = False

    def mail_notify(self, target_audience_ids):
        """
        target_audience_ids = {
        'name': 'Reciever name', 
        'email': 'wee@gmail.com',
        'lang': rec.lang
        }
        Send an email to every approver configured on the current stage.
        Uses the stage's own mail template if set, otherwise falls back
        to the module-level default template.
        """
        for rec in self:
            # Resolve template: stage-level → module default
            template = rec.mail_template_id
            if not template:
                template = self.env.ref(
                    'hr_employee.mail_template_core_announcement_notify',
                    raise_if_not_found=False,
                )

            if not template:
                _logger.warning(
                    'hr Announcement: no mail template found for Announcement'
                )
                continue
            # approver_ids = stage.approver_ids | self.investigator_id
            for reciever in target_audience_ids:
                try:
                    template.with_context(
                        reciever = reciever.get('name'),
                        lang=reciever.get('lang'),
                    ).send_mail(
                        rec.id,
                        force_send=True,
                        email_values={'email_to': reciever.get('email')},
                    )
                except Exception as exc:
                    _logger.error(
                        'hr Announcement: failed to send mail to %s: %s',
                        reciever.get('email'), exc,
                    )

            # Chatter log
            # approver_names = ', '.join(stage.approver_ids.mapped('name'))
            # rec.message_post(
            #     body=_(
            #         'Stage changed to <b>%(stage)s</b>. '
            #         'Notification sent to: %(approvers)s.',
            #         stage=stage.name,
            #         approvers=approver_names,
            #     ),
            #     subtype_xmlid='mail.mt_note',
            # )
    




    

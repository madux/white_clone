from odoo import api, fields, models


class HrExperienceRecognition(models.Model):
    _name = 'hr.experience.recognition'
    _description = 'Employee Recognition'
    _order = 'create_date desc'

    name = fields.Char(
        string='Recognition Title',
        required=True,
    )

    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        index=True,
    )

    recognized_by_id = fields.Many2one(
        'hr.employee',
        string='Recognized By',
        default=lambda self: self.env['hr.employee'].search(
            [('user_id', '=', self.env.uid)],
            limit=1
        ),
        index=True,
    )

    recognition_type = fields.Selection([
        ('appreciation', 'Appreciation'),
        ('achievement', 'Achievement'),
        ('teamwork', 'Teamwork'),
        ('leadership', 'Leadership'),
        ('innovation', 'Innovation'),
        ('customer_service', 'Customer Service'),
        ('employee_month', 'Employee of the Month'),
        ('other', 'Other'),
    ], string='Recognition Type', default='appreciation')

    description = fields.Html(
        string='Recognition',
        required=True,
    )

    recognition_date = fields.Date(
        string='Recognition Date',
        default=fields.Date.context_today,
        index=True,
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('closed', 'Closed'),
    ], string='Status', default='draft', index=True)

    points = fields.Integer(
        string='Recognition Points',
        default=0,
    )

    published = fields.Boolean(
        string='Published',
        default=False,
    )

    active = fields.Boolean(
        default=True,
    )

    attachment_ids = fields.Many2many(
        'ir.attachment',
        'hr_experience_recognition_attachment_rel',
        'recognition_id',
        'attachment_id',
        string='Attachments',
    )

    def action_publish(self):
        for record in self:
            record.write({
                'state': 'published',
                'published': True,
            })

    def action_close(self):
        for record in self:
            record.write({
                'state': 'closed',
                'published': False,
            })
    def action_reopen(self):
        for record in self:
            record.write({
                'state': 'draft',
                'published': False,
            })
from odoo import api, fields, models


class HrExperienceKnowledge(models.Model):
    _name = 'hr.experience.knowledge'
    _description = 'Employee Knowledge'
    _order = 'published_date desc, id desc'
    _rec_name = "name"

    name = fields.Char(
        string='Title',
        required=True,
    )

    employee_id = fields.Many2one(
        'hr.employee',
        string='Author',
        default=lambda self: self.env['hr.employee'].search(
            [('user_id', '=', self.env.uid)],
            limit=1
        ),
        index=True,
    )

    content = fields.Html(
        string='Content',
        required=True,
    )

    category = fields.Selection([
        ('hr', 'HR'),
        ('finance', 'Finance'),
        ('it', 'IT'),
        ('operations', 'Operations'),
        ('policies', 'Policies'),
        ('training', 'Training'),
        ('general', 'General'),
    ], string='Category', default='general', index=True)

    state = fields.Selection([
        ('draft', 'Draft'),
        ('review', 'Under Review'),
        ('published', 'Published'),
        ('reject', 'Rejected'),
        ('archived', 'Archived'),
    ], string='Status', default='draft', index=True)

    published = fields.Boolean(
        string='Published',
        default=False,
    )

    published_date = fields.Datetime(
        string='Published Date',
    )

    active = fields.Boolean(
        default=True,
    )

    attachment_ids = fields.Many2many(
        'ir.attachment',
        'hr_experience_knowledge_attachment_rel',
        'knowledge_id',
        'attachment_id',
        string='Attachments',
    )

    view_count = fields.Integer(
        string='Views',
        default=0,
    )

    @api.model
    def create(self, vals):
        if not vals.get('employee_id'):
            employee = self.env['hr.employee'].search(
                [('user_id', '=', self.env.uid)],
                limit=1
            )

            if employee:
                vals['employee_id'] = employee.id

        return super().create(vals)

    def action_set_review(self):
        for record in self:
            record.write({
                'state': 'review',
            })
    def action_publish(self):
            for record in self:
                record.write({
                    'state': 'published',
                    'published': True,
                    'published_date': fields.Datetime.now(),
                })
    
    def action_archive(self):
        for record in self:
            record.write({
                'state': 'archived',
                'active': False,
            })

    def action_reject(self):
            for record in self:
                record.write({
                    'state': 'reject',
                })

    def action_increment_view(self):
        for record in self:
            record.sudo().write({
                'view_count': record.view_count + 1,
            })
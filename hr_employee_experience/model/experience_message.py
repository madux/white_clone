from odoo import api, fields, models


class HrExperienceMessage(models.Model):
    _name = 'hr.experience.message'
    _description = 'Employee Experience Message'
    _order = 'create_date desc'

    name = fields.Char(
        string='Subject',
        required=True,
    )

    sender_employee_id = fields.Many2one(
        'hr.employee',
        string='Sender',
        required=True,
        default=lambda self: self.env['hr.employee'].search(
            [('user_id', '=', self.env.uid)],
            limit=1
        ),
        index=True,
    )

    employee_id = fields.Many2one(
        'hr.employee',
        string='Recipient',
        required=True,
        index=True,
    )

    message = fields.Html(
        string='Message',
        required=True,
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('sent', 'Sent'),
        ('read', 'Read'),
    ], string='Status', default='draft', index=True)

    sent_date = fields.Datetime(
        string='Sent Date',
    )

    read_date = fields.Datetime(
        string='Read Date',
    )

    is_read = fields.Boolean(
        string='Read',
        default=False,
    )

    active = fields.Boolean(
        default=True,
    )

    attachment_ids = fields.Many2many(
        'ir.attachment',
        'hr_experience_message_attachment_rel',
        'message_id',
        'attachment_id',
        string='Attachments',
    )

    @api.model
    def create(self, vals):
        if not vals.get('sender_employee_id'):
            employee = self.env['hr.employee'].search(
                [('user_id', '=', self.env.uid)],
                limit=1
            )

            if employee:
                vals['sender_employee_id'] = employee.id

        return super().create(vals)

    def action_send(self):
        for record in self:
            record.write({
                'state': 'sent',
                'sent_date': fields.Datetime.now(),
            })

    def action_mark_as_read(self):
        for record in self:
            record.write({
                'state': 'read',
                'is_read': True,
                'read_date': fields.Datetime.now(),
            })
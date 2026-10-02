from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class HrEnrollment(models.Model):
    _name = 'hmo.enrollment'
    _description = 'CleonHr enrollment'
    _rec_name = 'name'

    @api.constrains('hmo_id', 'employee_id')
    def _constraint_employee_existing(self):
        for rec in self:
            if not rec.hmo_id or not rec.employee_id:
                continue
            existing = self.env['hmo.enrollment'].search_count([
                ('plan_id', '=', rec.plan_id.id),
                ('hmo_id', '=', rec.hmo_id.id),
                ('employee_id', '=', rec.employee_id.id),
            ], limit=1)
            if existing > 1:
                raise ValidationError(
                    "The employee is already enrolled with the selected HMO and plan"
                )

    @api.onchange('birthday')
    def _onchange_birthday(self):
        if self.birthday and self.birthday >= fields.Date.today():
            self.birthday = False
            return {
                'warning': {
                    'title': 'Invalid Birthday',
                    'message': 'Employee birthday cannot be in the future.',
                }
            }

    name = fields.Char(
        string='Enrollment ID',
        required=True,
        copy=True,
        index=True,
        default=lambda self: _('New'),
    )

    description = fields.Char(
        string='Description',
        copy=True,
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        copy=True,
    )
    hmo_id = fields.Many2one(
        'hmo.marketplace',
        string='HMO ID',
        required=True,
        copy=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=1,
    )

    submit_date = fields.Datetime(
        string='Submission Date',
    )

    approved_date = fields.Datetime(
        string='Approved Date',
    )

    birthday = fields.Date(
        string='Birthday Date',
        # related="employee_id.birthday"
    )
    phone = fields.Char("Phone", related="employee_id.work_phone")
    email = fields.Char("Email", related="employee_id.work_email")
    employee_number = fields.Char("Employee ID", related="employee_id.barcode")
    company_id = fields.Many2one("res.company", string="Company")
    gender = fields.Char(
        string='Gender',
        # related="employee_id.gender"
    )
    # gender = fields.Selection([('male', 'Male'),('female', 'Female'),('other', 'Other')], string='Gender')

    plan_id = fields.Many2one(
        'hmo.plan',
        string='HMO Plan',
        required=True,
        copy=True,
    )
    hmo_tag_id = fields.Many2one(
        'hmo.tags',
        string='HMO tag',
        copy=True,
    )

    reviewed_by = fields.Many2one(
        'res.users',
        string='Reviewed by',
        copy=True,
    )
    approved_by = fields.Many2one(
        'res.users',
        string='Approved by',
        copy=True,
    )

    state = fields.Selection([
        ('draft', 'Draft'),
        ('review', 'review'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
    ], default='draft', string='Status')

    def action_review(self,emails = False):
        # TODO Send notifications
        for rec in self: 
            rec.state = 'review'
            rec.reviewed_by = self.env.user.id
    
    def action_pending(self,emails = False):
        # TODO Send notifications
        for rec in self: 
            rec.state = 'pending'
            rec.reviewed_by = self.env.user.id

    
    def action_approved(self, emails = False):
        # TODO Send notifications
        for rec in self: 
            rec.state = 'approved'
            rec.approved_by = self.env.user.id


    def action_draft(self,emails = False):
        # TODO Send notifications
        for rec in self: 
            rec.state = 'draft'

    def open_record(self):
        view_id = self.env.ref('hr_insurance.view_hmo_enrollment_form').id
        ret = {
            'name': "Enrollment Approvals",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': 'hmo.enrollment',
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'new'
            }
        return ret

    @api.model
    def create(self, vals):
        if vals.get('name', 'New') == 'New':
            vals['name'] = self.env['ir.sequence'].next_by_code(
                'hmo.enrollment'
            ) or 'New'

        return super().create(vals)
from odoo import models, fields


class HrBenefit(models.Model):
    _name = 'hr.benefit'
    _description = 'Employee Benefit'

    name = fields.Char(
        required=True
    )

    benefit_line_ids = fields.Many2many(
        'hr.benefit.line',
        'hr_benefit_line_rel',
        'benefit_id',
        'line_id',
        string='Benefit Lines'
    )


class HrBenefitLine(models.Model):
    _name = 'hr.benefit.line'
    _description = 'Benefit Line'

    name = fields.Char(
        required=True
    )
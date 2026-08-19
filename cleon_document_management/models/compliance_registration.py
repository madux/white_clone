from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError 
from datetime import datetime, timedelta


class ComplianceRecord(models.Model):

    _name = "doc.compliance.record"

    name = fields.Char()
    active = fields.Boolean(default=True)


class ComplianceRequirement(models.Model):

    _name = "doc.compliance.requirement"

    name = fields.Char()

    document_type_id = fields.Many2one(
        'doc.document.type'
    )

    is_mandatory = fields.Boolean()

    applies_to = fields.Selection([
        ('all_employees','All'),
        ('department','Department'),
        ('job_position','Job Position'),
        ('specific_employees','Employees')
    ])

    department_ids = fields.Many2many(
        'hr.department'
    )

    employee_ids = fields.Many2many(
        'hr.employee'
    )

    deadline_days = fields.Integer()

    active = fields.Boolean(default=True)
# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields


class CBTAnswerLine(models.Model):
    _name = "custom.survey.question"
    _order = "id asc"
    _description = "Custom CBT"

    survey_type = fields.Char(default='custom')
    deadline_date = fields.Date('Expiry date')
    start_date = fields.Date('Expiry date')
    job_id = fields.Many2one('hr.job')
    job_id = fields.Many2one('hr.job')
    pagination = fields.Selection([
        ('page_per_question',   'One Page per Question'),
        ('page_per_section',   'One Page per Question'),
        ('first_intro3',   'Job Details'), # job details
        ('second_intro1',   'second_intro1'), # job details
        ('second_intro2',   'second_intro2'), # job details
        ('second_intro3',   'second_intro3'), 
    ], default='first_intro')

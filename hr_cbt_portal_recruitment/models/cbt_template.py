# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields


class CBTAnswerLine(models.Model):
    _name = "cbt.answer.line.option"
    _order = "id asc"
    _description = "CBT answer line"

    name = fields.Char("Description")
    is_answer = fields.Char("Sequence")
    code = fields.Char("Code")
    cbt_question_line_id = fields.Many2one('cbt.question.line')

class CBTQuestionLine(models.Model):
    _name = "cbt.question.line"
    _order = "id asc"
    _description = "CBT question line"

    name = fields.Char("Sequence")
    sequence = fields.Char("Sequence")
    type = fields.Selection([
          ('radio', 'Radio'), 
          ('text', 'Text'), 
          ('check', 'Checkbox')], string="Type", default='radio')
    
    cbt_template_config_id = fields.Many2one(
        'cbt.template.config',
        string="CBT Template",
        required=False,
    )
    hr_applicant_id = fields.Many2one(
        'hr.applicant',
        string="HR application",
        required=False,
    )
    answer_line_ids = fields.One2many(
        'cbt.answer.line.option',
        'cbt_question_line_id',
        string="Answer line",
        required=True,
    )
    code = fields.Char("Code")
  
class CBTTemplateConfig(models.Model):
    _name = "cbt.template.config"
    _order = "id asc"
    _description = "CBT Template configuration"

    name = fields.Char("Template Name")
    active = fields.Boolean("Active")
    question_ids = fields.One2many(
        'cbt.question.line',
        'cbt_template_config_id',
        string="Question line",
        required=True,
    )

    def activate_button(self):
        pass 

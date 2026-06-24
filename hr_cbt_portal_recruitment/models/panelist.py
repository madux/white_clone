# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _ 
 

class PanelistScoreSheet(models.TransientModel):
    _name = "panelist.score_sheet"
    _description = "Panelist score sheet for survey"

    applicant_id = fields.Many2one(
        'hr.applicant',string='Hr applicant id'
        )
    panelist_id = fields.Many2one(
        'hr.employee',string='Panelists'
        )
    survey_user_input_ids = fields.Many2many(
        'survey.user_input',
        'survey_user_score_sheet_rel',
        'panel_score_sheet_id',
        'survey_user_input_id',
        string="Panelist Survey Tests",
        required=False,
    )
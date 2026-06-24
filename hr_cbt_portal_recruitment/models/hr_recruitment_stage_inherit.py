from odoo import models, fields, api, _

class hrRecruitmentStageInherit(models.Model):
    _inherit = "hr.recruitment.stage"

    group_ids = fields.Many2many('res.groups')
    stage_type = fields.Selection(
        selection=[
            ('initiation', 'Initiation'),
            ('interview', 'Interview'),
            ('selection_process', 'Selection Process'),
            ('documentation', 'Documentation'),
            ('audit', 'Audit'),
            ('accounts_finance', 'Accounts / finance'),
            ('background_checks', 'Background Checks')
        ],
        string='Stage Type'
    )

    active = fields.Boolean(default=True)
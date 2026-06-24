from datetime import date, datetime
from odoo import models, fields
from odoo.exceptions import ValidationError

 
class HRConfirmWizard(models.TransientModel):
    _name = "hr.confirm.wizard"
    _description = "HR Confirmation"

    hr_comment = fields.Text(string = 'Add Comment')
    hr_applicant_doc_id = fields.Many2one('hr.applicant.documentation')


    def confirm(self):
        if self.hr_applicant_doc_id:
            self.hr_applicant_doc_id.confirm_wizard_action(self.hr_comment)
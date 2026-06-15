from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)
 
class HrApplicant(models.Model):
    _inherit = 'hr.applicant'

    match_rating = fields.Selection([('poor', 'poor'),
                                     ('average', 'average'),
                                     ('high', 'High'),
                                     ('excellent', 'Excellent'),
                                     ], string="Match rating", default="")
    
    applied_date = fields.Date("Applied Date")

    def addCandidateBtn(self):
        form_view_id = self.env.ref(
                'hr_cleon_recruitment.hr_recruitment_candidate_form_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'name': _('New Candidate'),
            'res_model': "hr.applicant.candidate.wizard",
            # 'res_id': self.id,
            'view_mode': 'form',
            'views': [
                    (form_view_id, 'form')
                ], 
            'target': 'new',
            # 'domain': [('id', 'in', rec_ids)]
        }
    


    '''
    This my new for view for hr.applicant model

1. i want when user clicks on add candidate button, it should open the form view in new target
2. When user clicks on complete form, it should open another form view that looks like screenshot 1 + screenshot 2
3. When user clicks on the upload resume, it should prompt screenshot 3
4. when user clicks on bulk upload, it should open screenshot 4
5. When user clicks on linkedin url it should open screenshot 5.
6. Just write the code, dont give me module.

Note, give me a form view that looks exactly like the designs. 
However what i intended doing is to use invisible to hide some of these sections.
i.e if use clicks on complete form, it should take them to form inputs, if they click in upload, it should take them to upload resume screen and hide the complete form input section ...
'''

    
from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class Hroffer(models.Model):
    _name = 'hr.offer'
    _rec_name = "date"

    offer_stage = fields.Selection([
        ('draft', 'Prepared'),
        ('awaiting', 'Awaiting'),
        ('rejected', 'Rejected'),
        ('countered', 'countered'),
        ('resent', 'Resent'),

    ], string="Offer Stage", default='draft')
    date_expiry = fields.Datetime(string="Expiry Date")
    proposed_salary = fields.Float(string="Proposed salary", related="candidate_id.proposed_salary")
    sent_by = fields.Many2one('res.user', string="Sent by")
    vendor_id = fields.Many2one('res.partner', string="Vendors")
    benefits = fields.Text(string="Benefits")
    candidate_id = fields.Many2one(
        'hr.applicant',
        string='Candidate',
        store=True,
        required=True,
    )
    date_generated = fields.Datetime(string="Date Sent")
    date_char = fields.Char(
        string="Date Display",
        compute="_compute_date_char",
        store=True
    )

    offer_template_ids = fields.Many2many(
        'ir.ui.view',
        domain="[('type', 'in', ['qweb', 'html'])]",
        string='Templates',
        store=True,
    )

    @api.depends('date')
    def _compute_date_char(self):
        for rec in self:
            if rec.date:
                rec.date_char = rec.date.strftime('%d %b %Y')
                # Example: 15 Mar 2025
            else:
                rec.date_char = False

    def action_send_to_template_candidates(self):
        # TODO: send the email to candidate along with templates, 
        pass 

    def action_send_to_reminder_email(self):
        # TODO: send the email reminder: system should be able to use a mail template, 
        self.action_set_resent() 

    def action_set_draft(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'draft'

    def action_set_awaiting(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'awaiting'

    def action_set_countered(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'countered'

    def action_set_rejected(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'rejected'

    def action_set_resent(self):
        # TODO: send the email notification about this 
        self.offer_stage = 'resent'


class Hrofferwizard(models.TransientModel):
    _name = 'hr.offer.wizard'

    offer_stage = fields.Selection([
        ('candidate', 'Candidate & Jobs'),
        ('offer_terms', 'offer_terms'),
        ('review', 'review'),
        ('sent', 'Sent'),

    ], string="Offer Stage", default='candidate')

    offer_terms = fields.Html(string='Offer terms')
    vendor_id = fields.Many2one('res.partner', string="Vendors")

    candidate_ids = fields.Many2many(
        'hr.applicant',
        domain="[('stage_id.hired_stage', '=', True)]",
        string='Candidates',
        store=True,
    )
    # onchange of the applicant, this should show list of templates set for the job positions of applicants selected
    offer_template_ids = fields.Many2many(
        'ir.ui.view',
        domain="[('type', 'in', ['qweb', 'html'])]",
        string='Templates',
        store=True,
    )
    date = fields.Datetime(string="Date Sent")
    date_generated = fields.Datetime(string="Date Sent")
    date_expiry = fields.Datetime(string="Expiry Date")

    date_char = fields.Char(
        string="Date Display",
        compute="_compute_date_char",
        store=True
    )
    include_attachment = fields.Boolean(
        string="Include attachment",
        store=True
    )

    def action_view_offer_terms(self):
        # TODO: this is the second step which should show the offer terms by hiding 
        # the elements of some sections, such as the candidate_ids, offer_template_ids, date, date_generated,
        self.offer_stage = 'offer_terms'

    def action_view_reiew(self):
        # TODO:  this will show all sections in one view for final review, note: all fields should be at readonly
        self.offer_stage = 'review'

    def action_goback_offer_terms(self):
        # TODO:  this will move one step to the offer_terms stage
        self.offer_stage = 'offer_terms'

    def action_goback_candidate(self):
        # TODO:  this will move one step to the offer_terms stage
        self.offer_stage = 'candidate'

    def action_send_to_candidates(self):
        # TODO: send the email to candidate along with templates, 
        # if templates are selected, system should dynamically render the each template and attach it to the mail attachment
        self.offer_stage = 'sent'

    @api.depends('date')
    def _compute_date_char(self):
        for rec in self:
            if rec.date:
                rec.date_char = rec.date.strftime('%d %b %Y')
                # Example: 15 Mar 2025
            else:
                rec.date_char = False

    def action_generate_offers(self):
        """Create hr.offer from manual form data."""
        if not self.candidate_ids:
            raise UserError(_('You must add one or more candidates'))
        if not self.offer_template_ids:
            raise UserError(_('Please Select offer templates'))
        items =[]
        for rec in self.candidate_ids:
            offer = self.env['hr.offer'].create({
                'offer_stage':     'awaiting',
                'candidate_id':       rec.id,
                'date_generated':    fields.Datetime.now(),
                'offer_template_ids': self.offer_template_ids.ids,
                'date_expiry': self.date_expiry,
                'vendor_id': self.vendor_id,

            })
            items.append(offer)
        tree_view_id = self.env.ref(
                'hr_cleon_recruitment.hr_applicant_custom_tree_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'hr.applicant',
            'view_mode': 'tree',
            'target': 'current',
            'views': [
                    (tree_view_id, 'tree')
                ],
            'name': 'Offers',
            'domain': [('id', 'in', items)],
        }

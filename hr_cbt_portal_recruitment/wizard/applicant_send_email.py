from odoo import models, fields, api, _
from odoo.exceptions import UserError
import logging

_logger = logging.getLogger(__name__)

class ApplicantSendMailInherit(models.TransientModel):
    _inherit = 'applicant.send.mail'
    
    reply_to_option = fields.Selection([
        ('user_email', 'Use User Email'),
        ('specified_email', 'Use Specified Email'),
        ('server_email', 'Use Email Server Email'),
        ('no_return', 'No Return Email')
    ], string='Reply-to Option', default='server_email', required=True)

    reply_email = fields.Char(string='Reply Email', compute='_compute_reply_email', inverse='_inverse_reply_email', store=True)
    
   
    @api.depends('reply_to_option')
    def _compute_reply_email(self):
        self.ensure_one()
        if self.reply_to_option == 'user_email':
            self.reply_email = self.author_id.email
        elif self.reply_to_option == 'server_email':
            self.reply_email = "recruiting@enugudisco.com"
        elif self.reply_to_option == 'specified_email':
            self.reply_email = ''  # Clear the field for user to input
        elif self.reply_to_option == 'no_return':
            self.reply_email = False  # No return email, make it False
            
    def _inverse_reply_email(self):
        self.ensure_one()
        if self.reply_to_option == 'specified_email':
            self.reply_email = self.reply_email


    def action_send(self):
        self.ensure_one()
        without_emails = self.applicant_ids.filtered(lambda a: not a.email_from or (a.partner_id and not a.partner_id.email))
        if without_emails:
            return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                'params': {
                    'type': 'danger',
                    'message': _("The following applicants are missing an email address: %s.") % ', '.join(without_emails.mapped(lambda a: a.partner_name or a.name)),
                }
            }
            
        for applicant in self.applicant_ids:
            if not applicant.partner_id:
                applicant.partner_id = self.env['res.partner'].create({
                    'is_company': False,
                    'type': 'private',
                    'name': applicant.partner_name,
                    'email': applicant.email_from,
                    'phone': applicant.partner_phone,
                    'mobile': applicant.partner_mobile,
                })
            
            mail_values = {
                'email_from': self.author_id.email,
                'author_id': self.author_id.id,
                'reply_to': self.reply_email if self.reply_email else False,
                'model': 'hr.applicant',
                'res_id': applicant.id,
                'subject': self.subject,
                'body_html': self.body,
                'auto_delete': False,
                'email_to': applicant.partner_id.email or applicant.email_from,
            }
            
            self.env['mail.mail'].sudo().create(mail_values)

        return {
            'type': 'ir.actions.act_window_close',
            'infos': {'type': 'notification', 'message': _("Emails have been queued for sending."), 'sticky': False}
        }
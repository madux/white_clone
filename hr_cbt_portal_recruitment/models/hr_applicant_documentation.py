from odoo import models, fields, api, _
from odoo.exceptions import ValidationError


class HrApplicantDocuments(models.Model):
	_name = 'hr.applicant.documentation'

	document_type = fields.Many2one('documentation.type')
	document_file = fields.Many2one('ir.attachment', string='Document File')
	select = fields.Boolean("Confirmed", default=False)
	applicant_submitted_document_file = fields.Many2one('ir.attachment', string='Applicant Document')
	applicant_id = fields.Many2one('hr.applicant', string='Applicant')
	is_compulsory = fields.Boolean("Is Compulsory", default=False)
	hr_comment = fields.Text("HR comment")

	def return_with_comment(self):
		view_id = self.env.ref('hr_cbt_portal_recruitment.hr_confirm_wizard_form_view')
		return {
                'name': 'Fault Documentation',
                'view_type': 'form',
                'view_id': view_id.id,
                "view_mode": 'form',
                'res_model': 'hr.confirm.wizard',
                'type': 'ir.actions.act_window',
                'target': 'new',
                'context': {
                    'default_hr_applicant_doc_id': self.id,
                },
            }
	def confirm_wizard_action(self, comment):
		self.hr_comment = comment
		self.select = False
		template_id = self.env.ref('hr_cbt_portal_recruitment.mail_template_fault_documentation')
		self.send_mail('hr.applicant.documentation', template_id, [self.applicant_id.email_from])
		
	def send_mail(self, model, template_id,email_items):
		email_to = ','.join([m for m in email_items if m])
		if template_id and email_to:
			ctx = dict()
			ctx.update({
				'default_model': model,
				'default_res_id': self.id,
				'default_hr_comment': self.hr_comment,
				'default_use_template': bool(template_id),
				'default_template_id': template_id.id,
						})
			template_id.write({
				'email_to': email_to,
				})
			template_id.with_context(ctx).send_mail(self.id, False)


class DocumentationType(models.Model):
	_name = 'documentation.type'

	name = fields.Char()
	document_file = fields.Many2one('ir.attachment', string='Document File')
	is_compulsory = fields.Boolean("Is Compulsory", default=True)
	sign_template_id = fields.Many2one(
		'recruitment.sign.template', string='Signature Template')



# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields, Command, _
from odoo.exceptions import ValidationError

  
class CheckListWizard(models.TransientModel):
	_name = "checklist.setup.wizard"
	_order = "id asc"
	_description = "used to upload the required checklist"

	def get_default_document_types(self):
		documentation_types = self.env['documentation.type'].search([])
		sign_templates = [sign.sign_template_id.id for sign in documentation_types if sign.sign_template_id]
		return documentation_types.ids if documentation_types else False, sign_templates
	
	documentation_type_ids = fields.Many2many(
		'documentation.type',
		required=True,
		string="Documentation",
		default=lambda self: self.get_default_document_types()[0]
	)
	applicant_ids = fields.Many2many(
		'hr.applicant',
		'applicant_checklist_rel',
		'hr_applicant', 
		'hr_checklist_id',
		string="Applicants",
	)

	sign_template_ids = fields.Many2many(
		'recruitment.sign.template', string='Documents to sign', 
		default=lambda self: self.get_default_document_types()[1])
	
	def create_contact(self, **kwargs):
		if kwargs.get('name') and kwargs.get('email'):
			partner = self.env['res.partner'].sudo().search([('email', '=', kwargs.get('email'))], limit=1)
			if not partner:
				partner = self.env['res.partner'].create({
                    'name': kwargs.get('name'),
                    'email': kwargs.get('email'),
                    'phone': kwargs.get('phone'),
                    'active': True,
                })
			return partner.id
		else:
			return None
		
	def action_send_checklist(self):
		if self.applicant_ids and self.documentation_type_ids:
			sign_template_ids = self.sign_template_ids
			sign_request = self.env['recruitment.sign.request'].sudo()
			sign_values = []
			
			for applicant in self.mapped('applicant_ids'): 
				if not applicant.email_from:
					raise ValidationError(f"{applicant.name} must have an email address setup") 
				partner_id = applicant.partner_id
				if not partner_id:
					partner_id = self.create_contact(
					name=applicant.partner_name, 
					phone=applicant.partner_phone,
					email=applicant.email_from)
					applicant.partner_id = partner_id
				'''Checks if the document type is already existing with data'''
				# applicant.applicant_documentation_checklist = False
				if applicant.applicant_documentation_checklist:# or applicant.sign_request_ids:
					checklists_not_submitted = applicant.mapped('applicant_documentation_checklist').filtered(
						lambda su: not su.applicant_submitted_document_file
					)
					applicant.write({
						'applicant_documentation_checklist': [(3, re.id) for re in checklists_not_submitted],
						})
					
				# if applicant.sign_request_ids:
				# 	# (1, ID, { values }) -- Command.update({...})
				# 	# for ap_sgn in applicant.sign_request_ids: 
				# 	applicant.write({
				# 		'sign_request_ids': [(1, re.id, {'is_currently_sent': False}) for re in applicant.sign_request_ids],
				# 		})
				for ch in self.documentation_type_ids:
					# check applicant checklist list lines to see if the doc type exists and has data submitted
					checklists_type_already_submitted = applicant.mapped('applicant_documentation_checklist').filtered(
						lambda su: su.document_type.id == ch.id and su.applicant_submitted_document_file
					)
					if not checklists_type_already_submitted:
						applicant.write({
							'applicant_documentation_checklist': [(0, 0, {
								'document_type': ch.id, 
								'document_file': ch.document_file.id,
								'applicant_id': applicant.id,
								'is_compulsory': ch.is_compulsory,
								})]
							})
					
					# TODO : generate sign requests for each and every applicant and send the link to the mail template
				# for st in sign_template_ids:
				# 	sign_values.append((
				# 		st,
				# 		[{
				# 			# 'role_id': 1,
				# 			'partner_id': applicant.partner_id.id
				# 		}]
				# 	))
				# for srv in sign_values:
				# 	sr = sign_request.create([{
				# 		'template_id': srv[0].id,
				# 		'applicant_id': applicant.id, 
				# 		'request_item_ids': [Command.create({
				# 			'partner_id': signer['partner_id'],
				# 			# 'role_id': signer['role_id'],
				# 		}) for signer in srv[1]],
				# 		'reference': _('Applicant Signature Request - %s', srv[0].name),
				# 		'subject': 'Applicant Signature Request',
				# 		'message': "Please kindly click on the button to fill and sign all document as provided.",
				# 	}])
				# 	# 'attachment_ids': [(4, attachment.copy().id) for attachment in self.attachment_ids], # Attachments may not be bound to multiple sign requests
				# 	# } for srv in sign_values])
				# 	dummy_share_link = "%s/sign/document/mail/%s/%s" % (sr.get_base_url(), sr.id, sr.request_item_ids[0].sudo().access_token)
				# 	sr.write({'dummy_share_link': dummy_share_link, 'is_currently_sent': True})
				
				applicant.send_checklist([applicant.id])
		else:
			raise ValidationError("please ensure to select applicants and documents")

	def generate_and_send_signature_request(self):
		pass 
		# self.ensure_one()
		# sign_request = self.env['recruitment.sign.request']
		# if not self.check_access_rights('create', raise_exception=False):
		# 	sign_request = sign_request.sudo()

		# sign_values = []
		# sign_templates_applicant_ids = self.sign_template_ids.filtered(lambda t: len(t.sign_item_ids.mapped('responsible_id')) == 1)
		# for applicant in self.applicant_ids:
		# 	applicant_email = applicant.partner_id.email or applicant.email_from
		# 	if applicant.partner_id and applicant_email:
		# 		for st in sign_templates_applicant_ids:
		# 			sign_values.append((
		# 				st,
		# 				[{
		# 					'role_id': self.applicant_role_id.id,
		# 					'partner_id': applicant.partner_id.id
		# 				}]
		# 			))
		# 		# This is used to set the document process so that HR will
		# 		# know the records that have been sent for documentation
		# 		applicant.is_documentation_process = True
		# sign_requests = self.sudo().env['sign.request'].create([{
		# 	'template_id': srv[0].id,
		# 	'request_item_ids': [Command.create({
		# 		'partner_id': signer['partner_id'],
		# 		'role_id': signer['role_id'],
		# 	}) for signer in srv[1]],
		# 	'reference': _('Signature Request - %s', srv[0].name),
		# 	'subject': self.subject,
		# 	'message': self.message,
		# 	'attachment_ids': [(4, attachment.copy().id) for attachment in self.attachment_ids], # Attachments may not be bound to multiple sign requests
		# } for srv in sign_values])
		# sign_requests.message_subscribe(partner_ids=self.cc_partner_ids.ids)
		# if not self.check_access_rights('write', raise_exception=False):
		# 	sign_requests = sign_requests.sudo()
		# for sign_request in sign_requests:
		# 	sign_request.toggle_favorited()
		# return True
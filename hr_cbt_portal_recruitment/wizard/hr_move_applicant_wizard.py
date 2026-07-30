# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields
from odoo.exceptions import ValidationError

 
class HrApplicantMove(models.TransientModel):
	_name = "hr.applicant.move.wizard"
	_order = "id asc"
	_description = "used this feature to move applicants to the next stage"

	stage_id = fields.Many2one(
		'hr.recruitment.stage',
		required=True,
		string="Stage",
	)
	send_mail = fields.Boolean(
		string="Send Mail?",
	)
	is_interview_stage = fields.Boolean(
		string="is interview stage?",
	)
	stage_type = fields.Selection(
		[('is_interview_stage', 'Is Interview stage'),
		 ('is_verification_stage', 'Is Verification stage'),
		 ('is_documentation_stage', 'Is Documentation stage')],
		string="Stage Type?"
	) 
	interview_date = fields.Datetime(
		string="Interview Date",
	)
	applicant_ids = fields.Many2many(
		'hr.applicant',
		'applicant_move_rel',
		'hr_applicant', 
		'hr_move_schedule_id',
		string="Applicants",
	)
	email_invite_template = fields.Many2one(
		'mail.template',
		string="Mail Template",
		required=False,
	)
	send_mail_unprogressed = fields.Boolean(
		string="Send Non-Progression Notification?",
	)
	email_template_unprogressed = fields.Many2one(
		'mail.template',
		string="Mail Template",
		required=False,
		default=lambda self: self.env.ref('hr_cbt_portal_recruitment.mail_template_applicants_rejection', raise_if_not_found=False)
	)

	def documentation_validation(self):
		"""Get all applicants that is yet to complete his signatures"""
		if self.stage_id.hired_stage:
			pass 
			# applicants_documents_not_fully_signed = self.mapped('applicant_ids').filtered(
			# 	lambda applicant: applicant.mapped('sign_request_ids').filtered(lambda sg: sg.state != 'signed' and sg.is_currently_sent == True)
			# )
			# if applicants_documents_not_fully_signed:
			# 	applicant_names = [app.partner_name for app in applicants_documents_not_fully_signed]
			# 	raise ValidationError(
			# 		"""The following applicants have not fully signed there documents, 
			# 		kindly remove the applicant before proceeding to move them to hired stage
			# 		%s
			# 		""" % (',\n'.join(applicant_names))
			# 		)
	
	def stage_move_validation(self):
		if self.stage_id.stage_type == "documentation":
			applicant_with_score_sheets = self.mapped('applicant_ids').filtered(
				lambda sc: sc.survey_panelist_input_ids)
			for count, applicant in enumerate(applicant_with_score_sheets, 1):
				uncompleted_score_sheets = applicant.mapped('survey_panelist_input_ids')
				for pnl in uncompleted_score_sheets:
					pnl_uncompleted = pnl.mapped('survey_user_input_ids').filtered(lambda st: st.state != 'done')
					if pnl_uncompleted:
						raise ValidationError(f"Line {count}: Applicant with name {applicant.partner_name}'s Score-Sheet has not been completely signed by the panelists: {pnl.panelist_id.name}")

	def action_move_applicant(self):
		"""moves applicants to selected stage"""
		self.stage_move_validation()
		self.documentation_validation()
		if self.applicant_ids:
			for rec in self.mapped('applicant_ids'):#.filtered(lambda al: not al.stage_id.hired_stage):
				rec.write({
					'stage_id': self.stage_id.id,
					'date_of_stage_changed': fields.Date.today(),
					'number_of_interviews': rec.number_of_interviews + 1,
					'is_undergoing_verification': True if self.stage_type == "is_verification_stage" else False,
					'is_documentation_process': True if self.stage_type == "is_documentation_stage" else False,
					})
			if self.send_mail:
				self.action_send_mail()
			if self.send_mail_unprogressed:
				self.action_send_unprogression_email()
		else:
			raise ValidationError("please ensure to select applicants")

	def action_send_mail(self):
		email_list = self.mapped('applicant_ids').mapped('email_from')
		if email_list:
			self._send_mail(self.email_invite_template, email_list, self.env.user.company_id.email or self.env.user.email)
		else:
			raise ValidationError("Selected applicant(s) Email(s) not found")
		
	def action_send_unprogression_email(self):
		selected_applicant_ids = self.mapped('applicant_ids')
		all_applicant_ids = self.env['hr.applicant'].search([
			('job_id', '=', selected_applicant_ids[0].job_id.id),
			('stage_id', '=', selected_applicant_ids[0].stage_id.id),
		]).ids
		non_selected_applicant_ids = list(set(all_applicant_ids) - set(selected_applicant_ids.ids))
		non_selected_applicants = self.env['hr.applicant'].browse(non_selected_applicant_ids)
		for applicant in non_selected_applicants:
			email_to = False
			if applicant.email_from:
				email_to = applicant.email_from
			template = self.email_template_unprogressed
			if template:
				template.write({'email_to': email_to,
					'email_from': self.env.user.email,
					 'reply_to': self.env.user.email })
				ctx = dict()
				template.send_mail(applicant.id, True)


	def _send_mail(self, template_id, email_items= None, email_from=None):
		'''Email_to = [lists of emails], Contexts = {Dictionary} '''
		email_to = ','.join([m for m in email_items if m])
		# ir_model_data = self.env['ir.model.data']
		# template_id = ir_model_data.get_object_reference('inseta_etqa', with_template_id)[1]         
		if template_id and email_to:
			template_id.write({'email_to': email_to}) 
			template_id.send_mail(self.id, True)
 

from odoo import models, fields, api, _
from odoo.exceptions import ValidationError
from bs4 import BeautifulSoup


class HRJobRecruitmentRequest(models.Model):
	_name = 'hr.job.recruitment.request'
	_inherit = ['mail.thread', 'mail.activity.mixin']
	_order = 'id desc'
	_description = "Recruitment Request"

	@api.model
	def _get_default_dept(self):
		return self.env.user.employee_id.department_id
	
	name = fields.Char(string='Subject', size=512, required=False,
			   help='The subject of the recruitment request. E.g. Two new salesmen are requested for a new sales strategy',
			   states={'confirmed': [('readonly', True)],
				   'accepted':[('readonly', True)],
				   'recruiting':[('readonly', True)],
				   'done':[('readonly', True)]
				   },)
	
	job_id = fields.Many2one('hr.job', string='Requested Position',
				 states={'confirmed': [('readonly', True)],
					 'accepted':[('readonly', True)],
					 'recruiting':[('readonly', True)],
					 'done':[('readonly', True)]
					 },
				 help='The Job Position you expected to get more hired.',
				 )
	memo_id = fields.Integer(string="Request ID")
	recruitment_mode = fields.Selection([('Internal', 'Internal'),
				('External', 'External'),
				('Outsourced', 'Outsourced'),
				  ], string='Recruitment Mode', index=True,
				 copy=False,
				 readonly=True,
				 store=True,
				 states={'draft': [('required', True)],
					 'draft':[('readonly', False)],
					 })
	
	job_tmp = fields.Char(string="Job Title",
			  size=256,
			  help='If you don\'t select the requested position in the field above, you must specify a Job Title here. Upon this request is approved, the system can automatically create a new Job position and attach it to this request.')
	department_id = fields.Many2one('hr.department',
					string='Department',
					states={'confirmed': [('readonly', True)],
						'accepted':[('readonly', True)],
						'recruiting':[('readonly', True)],
						'done':[('readonly', True)]
						},
					default=_get_default_dept,
					required=False,
					index=True
					)
	user_id = fields.Many2one('res.users', string='Requested By', default=lambda self: self.env.user, readonly=True, index=True)
	user_to_approve_id = fields.Many2one('res.users', string='To be approved By', readonly=True, index=True)
	recommended_by = fields.Many2one('res.users', string='Requested By', default=lambda self: self.env.user, readonly=True, index=True)
	no_of_hired_employee = fields.Integer('Hired Employees')
					#   compute='_count_dept_employees', required=False)
	expected_employees = fields.Integer('Expected Employees', default=1,
					help='Number of extra new employees to be expected via the recruitment request.',
					states={'confirmed': [('readonly', True)],
						'accepted':[('readonly', True)],
						'recruiting':[('readonly', True)],
						'done':[('readonly', True)]
						},
					required=False,
					index=True
					)
	date_expected = fields.Date('Date Expected', required=False,
				default=fields.Date.today, index=True)
	description = fields.Text('Job Description',
				  help='Please describe the job',
				  readonly=False,
				  states={'done':[('readonly', True)]},
				  required=False
				  )
	requirements = fields.Text('Job Requirements',
				   help='Please specify your requirements on new employees',
				   readonly=False,
				   states={'done':[('readonly', True)]},
				   required=False
				   )
	years_of_experience = fields.Char('Years of Experience')
	reason = fields.Text('Reason',
			 help='Please explain why you request to recruit more employee(s) for your department',
			 states={'confirmed': [('readonly', True)],
				 'accepted':[('readonly', True)],
				 'recruiting':[('readonly', True)],
				 'done':[('readonly', True)]
				 },
			 required=False
			 )
	state = fields.Selection([
				  ('draft', 'Draft'),
				  ('refused', 'Refused'),
				  ('confirmed', 'Confirmed'),
				  ('accepted', 'Approved'),
				  ('recruiting', 'In Recruitment'),
				  ('done', 'Done'),
				  ],
		string='Status', readonly=True, copy=False, index=True, default='draft', required=False,
		help='When the recruitment request is created the status is \'Draft\'.\
		\n It is confirmed by the user and request is sent to the Approver, the status is \'Waiting Approval\'.\
		\n If the Approver accepts it, the status is \'Approved\'.\
		\n If the associated job recruitment is started, the status is \'In Recruitment\'.\
		\n If the number new employees created in association with the request, the status turns to \'Done\' automatically. Or, it can manually be set to \'Done\' whenever an authorized person press button Done'
		)
	age_required = fields.Char('Required Age')
	date_confirmed = fields.Date('Date Confirmed')
	date_accepted = fields.Date('Date Approved', copy=False,
				  help="Date of the acceptance of the recruitment request. It's filled when the button Approve is pressed.")
	date_refused = fields.Date('Date Refused')
	company_id = fields.Many2one('res.company', string='Company',
				 default=lambda self: self.env.company.id
				 )

	applicant_ids = fields.One2many('hr.applicant', 'request_id', string='Applicants', readonly=True, index=True)
	
	employee_ids = fields.One2many('hr.employee', 'request_id', string='Recruited Employees')#, compute='_compute_recruited_employees', store=True, index=True)
	employees_count = fields.Integer('# of Employees')#, compute='_count_recruited_employees', store=True, index=True)
	recruited_employees = fields.Float('Recruited Employees Rate')#, compute='_compute_recruited_employee_percentage')
	applicants_count = fields.Integer('# of Applications')#, compute='_count_applicants', store=True, index=True)

	applicant_ready_for_panelist_ids = fields.Many2many(
		'hr.applicant', 
		'applicant_ready_panelist_rel',
		'applicant_panel_request_id',
		'hr_applicant_id',
		string='Applicants Ready for panelist',
		compute="compute_track_recruitment_process",
		readonly=True
		)
	applicant_ready_for_verification_ids = fields.Many2many(
		'hr.applicant', 
		'applicant_ready_verification_rel',
		'applicant_verification_request_id',
		'hr_applicant_id',
		string='Applicants Ready for verification', 
		compute="compute_track_recruitment_process",
		readonly=True
		)
	
	@api.depends("applicant_ids")
	def compute_track_recruitment_process(self):
		for rec in self:
			if rec.applicant_ids:
				applicants = self.mapped('applicant_ids')
				applicant_ready_for_panelist = [
					pa.id for pa in applicants.filtered(
						lambda pnl: pnl.is_panelist_added==True
						)
					]
				applicant_ready_for_verification = [
					pa.id for pa in applicants.filtered(
						lambda pnl: pnl.is_undergoing_verification==True \
						and pnl.is_documentation_process == True
						)
					]
				if applicant_ready_for_panelist:
					rec.applicant_ready_for_panelist_ids = [
						(6, 0, applicant_ready_for_panelist)]
				else:
					rec.applicant_ready_for_panelist_ids = False

				if applicant_ready_for_verification:
					rec.applicant_ready_for_verification_ids = [
						(6, 0, applicant_ready_for_panelist)]
				else:
					rec.applicant_ready_for_verification_ids = False
			rec.applicant_ready_for_panelist_ids = False
			rec.applicant_ready_for_verification_ids = False
	
	
	def action_start_recruit(self):
		# if self.user_to_approve_id.id != self.env.user.id:
		# 	raise ValidationError("Ops! You are not responsible for starting this job postition recruitment")
		# else:
		if self.state == 'draft':
			self.state = 'confirmed'
		elif self.state == 'confirmed':
			if self.env.user.id != self.user_to_approve_id.id:
				raise ValidationError("Sorry you are not allowed to approve this process")
			self.state = 'accepted'
		elif self.state == 'accepted':
			# if self.env.user.id != self.user_to_approve_id.id:
			# 	raise ValidationError("Sorry you are not allowed to approve this process")
			self.state = 'recruiting'
		elif self.state == 'recruiting':
			requirements = {
			'age_required': {
					'name': 'Age Required - ',
					'value': self.age_required,
					},
			'qualification': {
				'name': 'Qualification - ',
				'value': self.requirements or "-",
				},
			'years_of_experience': {
				'name': 'Years of Experience - ',
				'value': self.years_of_experience or "-",
				},
			'deadline': {
				'name': 'Deadline - ',
				'value': self.date_expected or "-",
				}
			} 
			self.job_id.sudo().job_section_descriptions = [(5, 0, 0)]
			self.job_id.sudo().write({
			'name': self.job_id.name,
			# 'request_id': self.id,
			'department_id': self.job_id.department_id.id,
			'no_of_recruitment': self.expected_employees,
			'request_id': self.id,
			'close_date': self.date_expected,
			'description': BeautifulSoup(self.description or "-", features="lxml").get_text(),
			'job_section_descriptions': [(
				0,0, {
				'title': 'Requirement / Must Have',
				'job_descriptions': [(0, 0, {'description': f"{requirements[vl_key]['name']} {requirements.get(vl_key).get('value')}"}) for vl_key in requirements],
				}
				)],
			})
			self.state = 'done'
			# set the request templatre to in recruiting stage 
		#     raise ValidationError("sds")
		

	def action_reset(self):
		self.state = 'draft'
		self.job_id.website_published = False
	
	def action_refuse(self):
		if self.state == 'confirmed':
			if self.env.user.id != self.user_to_approve_id.id:
				raise ValidationError("Sorry you are not allowed to refuse this process")
			
			self.state = 'draft'
	
	# def action_close_recruiting(self):
	# 	self.state = 'done'
	# 	self.job_id.website_published = False

	def action_open_and_publish(self):
		"""this method enables the recruiter to publish """
		view_id = self.env.ref('hr.view_hr_job_form').id
		ret = {
			'name': "Recruitment Process",
			'view_mode': 'form',
			'view_id': view_id,
			'view_type': 'form',
			'res_model': 'hr.job',
			'res_id': self.job_id.id,
			'type': 'ir.actions.act_window',
			'domain': [],
			'context': {
				'default_department_id': self.department_id.id
			},
			'target': 'current'
		}
		return ret
	
	def action_export_score_sheet(self):
		"""Used to export the panelist score sheet"""
		# TODO: to be done by paul
		pass 
		
		
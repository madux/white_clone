from odoo import http, fields, _
from odoo.http import request
from odoo.exceptions import UserError, ValidationError
# from odoo.addons.eha_website.controllers.controllers import EhaWebsite
import logging
import base64
import json
from datetime import date, datetime, timedelta
import pytz
# from odoo.addons.website_sale.controllers.main import WebsiteSale
from odoo.addons.survey.controllers.main import Survey

_logger = logging.getLogger(__name__)

class SurveyInherit(Survey):
    def _check_validity(self, survey_token, answer_token, ensure_token=True, check_partner=True):
        """ Custom check validity method with additional start time and deadline logic """
        _logger.info('Entering _check_validity in SurveyInherit')
        result = super(SurveyInherit, self)._check_validity(
            survey_token, answer_token, ensure_token=ensure_token, check_partner=check_partner
        ) 
        if result is True:
            survey_sudo, answer_sudo = self._fetch_from_access_token(survey_token, answer_token)
            
            if answer_sudo and answer_sudo.state == 'done':
                return True
            
            now = fields.Datetime.now()
            
            if survey_sudo.start_time and now < (survey_sudo.start_time - timedelta(minutes=1)):
                return 'survey_not_opened'
            
            if survey_sudo.deadline and now > survey_sudo.deadline:
                if answer_sudo and answer_sudo.state != 'in_progress':
                    return 'survey_closed'
        
        return result

    def _redirect_with_error(self, access_data, error_key):
        survey_sudo = access_data['survey_sudo']
        answer_sudo = access_data['answer_sudo']
        
        if error_key == 'survey_not_opened' and access_data['can_answer']:
            user_tz = None
            
            if request.env.user and request.env.user.tz:
                user_tz = request.env.user.tz
                
            if not user_tz and request.env.context.get('tz'):
                user_tz = request.env.context.get('tz')
                
            if not user_tz:
                user_tz = 'Africa/Lagos'
                
            tz = pytz.timezone(user_tz)
            
            current_time_utc = fields.Datetime.now()
            current_time_local = pytz.utc.localize(current_time_utc).astimezone(tz)
            current_time_str = current_time_local.strftime('%Y-%m-%d %I:%M %p')
            
            if survey_sudo.start_time:
                start_time_local = pytz.utc.localize(survey_sudo.start_time).astimezone(tz)
                start_time_str = start_time_local.strftime('%Y-%m-%d %I:%M %p')
            else:
                start_time_str = 'Not set'
                
            return request.render("hr_cbt_portal_recruitment.survey_not_opened", {
				'survey': survey_sudo,
				'current_time': current_time_str,
				'start_time': start_time_str
			})
        
        return super(SurveyInherit, self)._redirect_with_error(access_data, error_key)

class WebsiteHrRecruitment(http.Controller):
	
	 
	# generate attachment
	def generate_attachment(self, name, title, datas, res_id, model='hr.applicant'):
		attachment = request.env['ir.attachment'].sudo()
		attachment_id = attachment.create({
			'name': f'{title} for {name}',
			'type': 'binary',
			'datas': datas,
			'res_name': name,
			'res_model': model,
			'res_id': res_id,
		})
		return attachment_id
	
	@http.route(["/documentation-request/<int:applicationId>/"], type='http', auth='public', website=True, website_published=True)
	def documentation_request(self, applicationId):
		"""Request documentation for sapplicants 
		"""
		vals = {
			"applicant": request.env["hr.applicant"].sudo().search([('id', '=', applicationId)]),
		}
		return request.render("hr_cbt_portal_recruitment.documentation_request_template", vals)

	@http.route(['/get-applicant-document'], type='json', website=True, auth="public", csrf=False)
	def get_applicant_document(self, **post):
		recordId = post.get('record_id')
		_logger.info(f"{recordId} record id generated")
		if recordId:
			domain = [
				('id', '=', int(recordId)),
				('active', '=', True),
			]
			applicant = request.env['hr.applicant'].sudo().search(domain, limit=1) 
			if applicant: 
				return {
					"status": True,
					"data": {
						'applicant_documentation_checklist_ids': [
							{
								'document_file_id': q.id, 
								'document_file_name': q.document_type.name,
								'required': "1" if q.is_compulsory else "0",
								'hr_comment': q.hr_comment or "",
								# 'hr_comment': '''<div class="alert alert-danger" role="alert">
								#             %s<br/>
								#         </div>'''%(q.hr_comment) if q.hr_comment else ""

							}
							for q in applicant.mapped('applicant_documentation_checklist').filtered(lambda x: not x.select and x.hr_comment != 'Resubmitted')
						]
					},
					"message": "", 
					} 
			else:
				message = "Sorry !!! No documentation exist for this applicant yet"
				return {
					"status": False,
					"data": {
						'applicant_documentation_checklist_ids': False,
					},
					"message": message 
					}
		else:
			message = "Sorry !!! No documentation ID exist for this applicant yet"
			return {
				"status": False,
				"data": {
					'applicant_documentation_checklist_ids': False,
				},
				"message": message 
				}
		
	
		
	@http.route(['/document-data-process'], type='http', methods=['POST'], 
			 website=True, auth="public", csrf=False)
	def document_data_process(self, **post):
		"""""" 
		_logger.info(
			f"Destiny is calling {type(post.get('241'))} annd {post.get('counter_ids')}"
		)
		if not post.get('counter_ids'):
			return json.dumps({'status': False, 'message': "File IDs not found"})
		
		applicant_id = request.env['hr.applicant'].sudo().search([
			('id', '=', post.get('record_id'))], limit=1)
		if not applicant_id:
			return json.dumps({'status': False, 'message': "No applicant record found for record id provided"})
		 
		counter_ids = json.loads(post.get('counter_ids')) # ['241', '345',]
		_logger.info(f"""check counter {type(counter_ids)} AND FILE {counter_ids}===> """)

		submitted_filename = []
		for rec in counter_ids: # "241"
			# tc = '%s' %rec
			filedata = post.get(rec, False)
			applicant_document_id = request.env['hr.applicant.documentation'].sudo().search([
				('id', '=', int(rec))
			], limit=1)

			if applicant_document_id:
				_logger.info(f"""ATTACHMENT DOCUMENT FOUND ALREADY===>  {applicant_document_id.id}""")
				if filedata:
					datas = base64.b64encode(filedata.read())
					submitted_filename.append(filedata.filename)
					attachment_id = self.generate_attachment(f"{applicant_id.partner_name}", f'{filedata.filename}', datas, applicant_id.id)
					applicant_document_id.update({
						'applicant_submitted_document_file': attachment_id.id,
						'hr_comment': 'Resubmitted' if applicant_document_id.hr_comment else ""
						})
		applicant_id.send_mail_to_hr(submitted_filename, applicant_id)	
		return json.dumps({'status': True, 'data': 'successfully getting it', 'message': "Form Submitted!"})
			
	@http.route([
		'/complete/recruitment',
		'/complete/recruitment/<model("hr.applicant"):job_id>'
		], type='http', auth="public", website=True)
	def complete_recruitment(self, **post):
		"""
		Returns:
			json: JSON reponse
		"""
		job_id = post.get("job_id")
		email_from = post.get("email_from")
		job_id = job_id and int(job_id)
		job = request.env['hr.job'].sudo().search([('id', '=', job_id)], limit=1)
		domain = [
			('job_id', '=', job.id), 
			('email_from', '=', email_from),
			('create_date', '>=', job.datetime_publish),
			('create_date', '<=', job.close_date),
			('active', '=', True)
			]
		applicants = request.env['hr.applicant'].sudo().search(domain)
		
		if job.close_date and date.today() > job.close_date:
			return request.render("hr_cbt_portal_recruitment.job_already_closed")
		
		elif applicants:
			"""Checks if the period of submission falls between the publish and date"""
			return request.render("hr_cbt_portal_recruitment.recruitment_job_already_applied")
		else:
			_logger.info(f'Creating Applicants detailss ...{int(post.get("job_id"))}')
			applicant_name =  f'{post.get("partner_name")} {post.get("middle_name")} {post.get("last_name")}'
			vals = {
				"partner_name": applicant_name,
				"name": f'Application for {applicant_name}',
				"first_name": post.get('partner_name').strip(),
				"last_name": post.get("last_name", "").strip(),
				"middle_name": post.get("middle_name", "").strip(),
				"job_id": int(post.get("job_id")) if post.get("job_id") else False,
				"email_from": post.get("email_from", "").strip(),
				"partner_phone": post.get("partner_phone", "").strip(),
				"description": post.get("description", ""),
				"current_salary": post.get("current_salary", False),
				"salary_proposed": post.get("current_salary", False),
				"salary_expected": post.get("salary_expection", False),
				"linkedin_account": post.get("recruitment4",""),
				"has_completed_nysc": 'Yes' if post.get("completed_nysc_yes") == 'on' else 'No',
				"know_anyone_at_organisation": 'Yes' if post.get("personal_capacity_headings_yes") == 'on' else 'No',
				"degree_in_relevant_field": 'Yes' if post.get("level_qualification_header_yes") == 'on' else 'No',
				"reside_job_location": 'Yes' if post.get("reside_job_location_yes") == 'on' else 'No',
				"relocation_plans": 'Yes' if post.get("relocation_plans_yes") == 'on' else 'No',
				"resumption_period": post.get("periodselect",""),
				"reference_name": post.get("reference_name",""),
				"reference_title": post.get("reference_title",""),
				"reference_email": post.get("reference_email",""),
				"reference_phone": post.get("reference_phone",""),
				"relationship_type": post.get("relationship_type",""),
				"presentlocation": post.get("presentlocation",""),
				"knowledge_description": post.get("knowledge_description",""),
				"specify_personal_personality": post.get("specify_personal_personality",""),
				"specifylevel_qualification": post.get("specifylevel_qualification",False),
				"image_1920": post.get("passport_img"),# base64.b64encode(post.get("passport_img").read()),
			}
			online_stage = request.env.ref('hr_cbt_portal_recruitment.hr_recruitment_stage_online_application')
			if online_stage:
				vals.update({'stage_id': online_stage.id})
			applicant = request.env['hr.applicant'].sudo().create(vals)
			_logger.info('Applicant record Successfully Registered!')

			_logger.info(f"POST DATA {vals}")
			if post.get("Resume"):
				# file_name = post.get("Resume").filename
				data = base64.b64encode(post.get("Resume").read())
				resume_attachment = self.generate_attachment(applicant_name, 'Resume', data, applicant.id)
				# vals.update({'attachment_ids': [(6, 0, [attachment.id])]})
			
			if 'other_docs' in request.params:
				attached_files = request.httprequest.files.getlist('other_docs')
				for attachment in attached_files:
					file_name = attachment.filename
					datas = base64.b64encode(attachment.read())
					other_docs_attachment = self.generate_attachment(applicant_name, file_name, datas, applicant.id)
			
			# applicant = request.env['hr.applicant'].sudo().create(vals)
			# _logger.info('Applicant record Successfully Registered!')
			return http.request.render('website_hr_recruitment.thankyou')
		
	@http.route(["/documentation-success"], type='http', auth='public', website=True, website_published=True)
	def documentation_success(self): 
		return request.render("hr_cbt_portal_recruitment.hr_documentation_success_template", {})


	#### Applicant Pool Form Template ####
	@http.route('/applicant-pool', type='http', auth='public', website=True)
	def applicant_pool_form(self, **post):
		return request.render('hr_cbt_portal_recruitment.hr_applicant_pool_form_template', {})

	@http.route('/applicant-pool-form/submit', type='http', auth='public', website=True, csrf=False, methods=['POST'])
	def applicant_pool_form_submit(self, **post):
		try:
			_logger.info(f"Received form data: {post}")
			# Extract form data and create vals dictionary
			vals = {
				'first_name': post.get('first_name', '').strip(),
				'middle_name': post.get('middle_name', '').strip(),
				'last_name': post.get('last_name', '').strip(),
				'phone_number': post.get('phone_number', '').strip(),
				'email': post.get('email', '').strip(),
				'applicant_cv_link': post.get('applicant_cv_link', '').strip(),
				'linkedin_account': post.get('linkedin_account', '').strip(),
				'has_completed_nysc': post.get('has_completed_nysc', '').strip(),
				'brief_introduction': post.get('brief_introduction', '').strip(),
				# 'applicant_ipaddress': post.get('applicant_ipaddress', '').strip(),
				'applied_date': fields.Datetime.now(),
				'state': 'draft',
			}
			_logger.info(f"Processed vals: {vals}")
			
			# Validate required fields
			required_fields = ['first_name', 'middle_name', 'last_name', 'phone_number', 'email', 'applicant_cv_link', 'linkedin_account', 'has_completed_nysc']
			missing_fields = [field for field in required_fields if not vals.get(field)]
			
			if missing_fields:
				_logger.error(f"Missing required fields: {missing_fields}")
				return request.render('hr_cbt_portal_recruitment.applicant_error_template', {
					'error_title': 'Missing Required Fields',
					'error_message': 'Please fill in all required fields and try again.',
					'missing_fields': missing_fields
				})
			# Check if the email address has submitted within the past 5 days.
			email = vals.get('email')
			if email:
				five_days_ago = fields.Datetime.now() - timedelta(days=5)
				existing_application = request.env['hr.applicant.pool'].sudo().search([
					('email', '=', email),
					('applied_date', '>=', five_days_ago)
				], limit=1)

				if existing_application:
					_logger.warning(f"Email {email} attempted duplicate submission within 5 days")
					return request.render('hr_cbt_portal_recruitment.applicant_error_template', {
						'error_title': 'Submission Restricted',
						'error_message': 'You have already submitted an application within the last 5 days. Please try again later.',
						'show_retry': False
					})

			
			# Create the applicant pool record
			applicant_pool = request.env['hr.applicant.pool'].sudo().create(vals)
			
			_logger.info(f"Successfully created applicant pool record with ID: {applicant_pool.id}")
			
			return request.render('hr_cbt_portal_recruitment.thank_you_template', {
				'applicant_name': f"{vals['first_name']} {vals['last_name']}"
			})
			
		except Exception as e:
			_logger.error(f"Error creating applicant pool record: {str(e)}")
			return request.render('hr_cbt_portal_recruitment.applicant_error_template', {
				'error_title': 'Submission Error',
				'error_message': 'An error occurred while processing your application. Please try again later.',
				'technical_error': str(e) if request.env.user.has_group('base.group_system') else None
			})

	
from odoo import fields, models ,api, _
from tempfile import TemporaryFile
from odoo.exceptions import UserError, ValidationError, RedirectWarning
import base64
import random
import logging
from datetime import date, datetime, timedelta
from dateutil.relativedelta import relativedelta as rd
import xlrd
from xlrd import open_workbook
import base64
import io
import xlsxwriter

_logger = logging.getLogger(__name__)


class ImportApplicants(models.TransientModel):
    _name = 'hr.import_applicant.wizard'

    data_file = fields.Binary(string="Upload File (.xls)")
    filename = fields.Char("Filename")
    index = fields.Integer("Sheet Index", default=0)
    action_type = fields.Selection(
        [('upload', 'Applicant Upload'), ('update', 'Update Applicants'), ('download', 'Template Download')],
        string='Action Type',
        default='upload'
    )
    
    stage_id = fields.Many2one('hr.recruitment.stage', string="Select Stage", help="Select the stage to set for the applicants during update.")
    search_key = fields.Selection(
        [('email_from', 'Email'), ('applicant_code', 'Applicant Code')],
        string="Search Key",
        required=True,
        default="applicant_code",
        help="Select whether to search applicants by email or applicant code."
    )
    search_key_column = fields.Integer(
        string="Search Key Excel Column",
        help="Enter Excel Column for Search key"
    )
    
    update_field_mappings = fields.One2many('update.field.mapping', 'wizard_id', string='Field Mappings')
    # update_field_mappings = fields.Many2many('update.field.mapping', string='Field Mappings')


    
    def download_template_action(self):
        output = io.BytesIO()
        workbook = xlsxwriter.Workbook(output)
        worksheet = workbook.add_worksheet()
        headers = [
            'SN','Applicant\'s code','Email Address', 'Name', 'Active Email(s)', 'Active Phone', 'Highest Educational Qualification',
            'What is Your Course of Study?', 'Are You a graduate?','NYSC Certificate Number', 'Age','Position Applying for',
            'Have you worked with EEDC?', 'If you worked, how did you leave?', 'Why did you leave EEDC?', 'What is your currrent state of residence?'
            'If you are selected, which District (s) would you prefer based on proximity? (Select nearest districts to your residence)',
            'Gender','Are you APTIS?','What are your Relevant Skills/Competencies?'
        ]
        
        bold_format = workbook.add_format({'bold': True})
        
        for col_num, header in enumerate(headers):
            worksheet.write(0, col_num, header, bold_format)

        workbook.close()
        
        output.seek(0)
        self.data_file = base64.b64encode(output.read())
        self.filename = 'Applicant_Template.xlsx'
        output.close()
        
        return {
        'type': 'ir.actions.act_url',
        'url': 'web/content/?model=hr.import_applicant.wizard&id=%s&field=data_file&filename_field=filename&filename=Applicant_Template.xlsx&download=true' % self.id,
        'target': 'self',
        'data_file': self.data_file,
        'filename': 'Applicant_Template.xlsx',
    }

    def create_job_position(self, name):
        job_position_obj = self.env['hr.job']
        if name:
            position_rec = job_position_obj.search([('name', '=', name.strip())], limit = 1)
            job_position = job_position_obj.create({
                        "name": name.strip()
                    }) if not position_rec else position_rec
            return job_position
        else:
            return None


    def create_contact(self, email, name, phone):
        if email:
            partner = self.env['res.partner'].search([('email', '=', email)], limit=1)
            if not partner:
                partner = self.env['res.partner'].create({
                    'name': name,
                    'email': email,
                    'phone': phone
                })
            return partner.id
        else:
            return None

    def import_records_action(self):
        if self.data_file:
            file_datas = base64.decodestring(self.data_file)
            workbook = xlrd.open_workbook(file_contents=file_datas)
            sheet_index = int(self.index) if self.index else 0
            sheet = workbook.sheet_by_index(sheet_index)
            data = [[sheet.cell_value(r, c) for c in range(sheet.ncols)] for r in range(sheet.nrows)]
            data.pop(0)
            file_data = data
        else:
            raise ValidationError('Please select file and type of file')
        errors = ['The Following messages occurred']
        employee_obj = self.env['hr.employee']
        unimport_count, count = 0, 0
        success_records = []
        unsuccess_records = []
        
        def find_existing_applicant(email, applicant_code, job):
            applicant_id = False 
            if email:
                if applicant_code:
                    applicant = self.env['hr.applicant'].search([('applicant_code', '=', applicant_code)])
                    if not applicant:
                        applicant = self.env['hr.applicant'].search([
                        ('email_from', '=', email),
                        ('job_id', '=', job.id),
                        ('create_date', '>=', job.datetime_publish),
                        ('create_date', '<=', job.close_date),
                        ('active', '=', True)])
                else:
                    applicant = self.env['hr.applicant'].search([
                        ('email_from', '=', email),
                        ('job_id', '=', job.id),
                        ('create_date', '>=', job.datetime_publish),
                        ('create_date', '<=', job.close_date),
                        ('active', '=', True)])
                if applicant:
                    applicant_id = applicant.id
                else:
                    applicant_id = False 
                return applicant_id
            else:
                return False
        
        if self.action_type == 'upload':
            for row in file_data:
                posittion = self.create_job_position(row[11])
                email = row[2] or row[4]
                applicant_code = row[1].strip()
                
                if not posittion:
                    unsuccess_records.append(f'Applicant with {str(email)} has no Job position specified')
                elif posittion and find_existing_applicant(email.strip(),applicant_code, posittion):
                    unsuccess_records.append(f'Applicant with {str(email)} Already exists')
                else:
                    
                    fullName = row[3]
                    full_name = row[3].split() if row[3] else False
                    if full_name:
                        _logger.info(f'Full name = {full_name}')
                        partner_name = fullName.strip()
                        applicant_data = {
                            'applicant_code': applicant_code,
                            'email_from': email,
                            'name': f"Application for {row[3]}",
                            'first_name': full_name[2] if len(full_name) > 2 else full_name[1] if len(full_name) > 1 else full_name[0] or None,
                            # maduka chris sopulu, maduka sopulu, maduka, none
                            'middle_name': full_name[1] if len(full_name) == 3 else "",
                            'last_name': full_name[0] if len(full_name) > 0 else "",
                            'partner_phone': row[5],
                            'partner_name': partner_name,
                            'highest_level_of_qualification': row[6],
                            'course_of_study': row[7],
                            'is_graduate': row[8],
                            'nysc_certificate_number': row[9],
                            'age': row[10] if row[10] else False,
                            'job_id': posittion.id,
                            'worked_at_organisation': row[12].lower() if row[12] and row[12] in ['yes', 'no'] else False,
                            'mode_of_exit_at_organisation': row[13] if len(row) > 13 and row[13] else False,
                            'why_do_you_leave': row[14] if len(row) > 14 and row[14] else False,
                            
                            'presentlocation': row[15] if len(row) > 15 and row[15] else False,
                            'prefered_district': row[16].strip() if len(row) > 16 and row[16] else False,
                            'gender': row[17].lower() if len(row) > 17 and row[17] else False,
                            'is_external_staff': row[18].strip() if len(row) > 18 and row[18] else False,
                            # 'skills': row[19].strip(),
                            'stage_id': self.env.ref('hr_cbt_portal_recruitment.hr_recruitment_stage_request_initiation').id,
                            'partner_id': self.create_contact(email.strip(), partner_name, row[5]),
                        }
                        applicant = self.env['hr.applicant'].sudo().create(applicant_data)
                        _logger.info(f'Applicant data: {applicant} at {row[0]}')
                        count += 1
                        success_records.append(applicant_data.get('name'))
                    else:
                        unsuccess_records.append(f'Applicant with {str(row[0])} Does not have a name')
            errors.append('Successful Import(s): '+str(count)+' Record(s): See Records Below \n {}'.format(success_records))
            errors.append('Unsuccessful Import(s): '+str(unsuccess_records)+' Record(s)')
            if len(errors) > 1:
                message = '\n'.join(errors)
                return self.confirm_notification(message)
            
        elif self.action_type == 'update':
            
            if not self.update_field_mappings and not self.stage_id:
                raise ValidationError('Please select fields to update or specify a stage to set.')

            if not self.search_key_column:
                raise ValidationError('Please specify the search key column.')
                        
            count_updated = 0
            unsuccess_updated = 0
            success_updates = []
            unsuccess_updates = []
            error_job_position = []
            
            for row in file_data:
                search_value = row[self.search_key_column - 1]
                
                applicant = self.env['hr.applicant'].search([(self.search_key, '=', search_value)], limit=1)
                
                if applicant:
                    update_data = {}
                    partner_update_data = {}
                    
                    if self.stage_id:
                        update_data['stage_id'] = self.stage_id.id

                    if self.update_field_mappings:
                        for mapping in self.update_field_mappings:
                                
                            field = mapping.field_name  # Field to update
                            column_number = mapping.column_number - 1 
                            
                            if column_number < len(row):
                                field_value = row[column_number]
                            
                                if field == 'job_id':
                                    # job_position = self.create_job_position(field_value)
                                    job_position_obj = self.env['hr.job']
                                    job_position = job_position_obj.search([('name', '=', field_value.strip())], limit=1)
                                    if job_position:
                                        update_data['job_id'] = job_position.id
                                    else:
                                        error_job_position.append(f"{search_value} - {applicant.partner_name}")
                                                                            
                                elif field == 'partner_name':
                                    partner_update_data['name'] = field_value
                                    
                                elif field == 'email_from':
                                    partner_update_data['email'] = field_value
                                    
                                elif field == 'partner_phone':
                                    partner_update_data['phone'] = field_value
                                
                                else:
                                    update_data[field] = field_value

                    try:
                        applicant.write(update_data)
                        if partner_update_data:
                            applicant.partner_id.write(partner_update_data)
                            
                        count_updated += 1
                        success_updates.append(f"{search_value} - {applicant.partner_name}")
                    except Exception as e:
                        unsuccess_updated += 1
                        unsuccess_updates.append(f"{search_value} - Error: {str(e)}")
                else:
                    unsuccess_updated += 1
                    unsuccess_updates.append(f"{search_value} - Applicant not found")
                    
            report = []
            if error_job_position:
                report.append(f'Job positions not found for these Applicants below\n{", ".join(error_job_position)}\n\n')
            report.append(f'Successful Update(s): {count_updated} Record(s): See Records Below\n{", ".join(success_updates)}\n\n')
            report.append(f'Unsuccessful Update(s): {unsuccess_updated} Record(s): See Records Below\n{", ".join(unsuccess_updates)}')

            if len(report) > 1:
                message = '\n'.join(report)
                return self.confirm_notification(message)

    def confirm_notification(self,popup_message):
        view = self.env.ref('hr_cbt_portal_recruitment.hr_import_applicants_confirm_dialog_view')
        view_id = view and view.id or False
        context = dict(self._context or {})
        context['message'] = popup_message
        return {
                'name':'Message!',
                'type':'ir.actions.act_window',
                'view_type':'form',
                'res_model':'hr.import_applicant.confirm.dialog',
                'views':[(view.id, 'form')],
                'view_id':view.id,
                'target':'new',
                'context':context,
                }


class UpdateFieldMapping(models.TransientModel):
    _name = 'update.field.mapping'
    _description = 'Update Field Mapping Wizard'

    wizard_id = fields.Many2one('hr.import_applicant.wizard', string='Wizard Reference', ondelete='cascade')
    field_name = fields.Selection([
        ('partner_name', 'Full Name'),
        ('job_id', 'Job Position'),
        ('email_from', 'Email'),
        ('partner_phone', 'Phone'),
        ('middle_name', 'Middle Name'),
        ('last_name', 'Last Name'),
        ('is_graduate', 'Are you Graduate?'),
        ('course_of_study', 'Course of Study'),
        ('highest_level_of_qualification', 'Highest Level of Qualification'),
        ('gender', 'Gender'),
        ('age', 'Age'),
        ('date_of_birth', 'Date of Birth'),
        ('is_external_staff', 'Are you Aptis?'),
        ('prefered_district', 'Preffered District'),
        ('presentlocation', 'Present Location'),
        ('worked_at_organisation', 'Did you work at Our organisation before?'),
        ('mode_of_exit_at_organisation', 'How did you leave our organisation?'),
        ('why_do_you_leave', 'Why did you leave')
    ], string='Field to Update', required=True)
    
    # field_name = fields.Many2one('ir.model.fields', 
    #                              string="Fields to Update",
    #                              domain="[('model', '=', 'hr.applicant'), ('store', '=', True)]",
    #                              required=True)

    column_number = fields.Integer(string='Column Mapping', required=True)
    

class MigrationDialogModel(models.TransientModel):
    _name="hr.import_applicant.confirm.dialog"

    def get_default(self):
        if self.env.context.get("message", False):
            return self.env.context.get("message")
        return False 

    name = fields.Text(string="Message",readonly=True,default=get_default)

# -*- coding: utf-8 -*-

from datetime import date, datetime
from odoo import models, fields, api, _
from dateutil.relativedelta import relativedelta

 
class HrJob(models.Model):
    _inherit = 'hr.job'
 
    request_id = fields.Many2one('hr.job.recruitment.request', string="Recruitment Request", store=True)
    datetime_publish = fields.Date("Date Published")
    close_date = fields.Date("Closing Date")
    
    skills_text = fields.Text(string='Extracted Skills')
    qualifications_text = fields.Text(string='Extracted Qualifications')
    experience_text = fields.Text(string='Extracted Experience')

    @api.onchange('website_published')
    def onchange_website_published(self):
        today = fields.Date.today()
        for rec in self:
            if rec.website_published:
                rec.datetime_publish = today
                rec.close_date = today + relativedelta(days=10)

    # @api.onchange('datetime_publish')
    # def onchange_datetime_publish(self):
    #     today = fields.Date.today()
    #     for rec in self:
    #         if rec.datetime_publish:
    #             rec.close_date = self.datetime_publish + relativedelta(day=5)

    @api.onchange('close_date')
    def ensure_close_date_is_greater(self):
        if self.close_date:
            if self.close_date and not self.datetime_publish:
                self.close_date = False
                return {
                    'warning': {
                        'title': "Validation",
                        'message': "Please Ensure to add Publish Date",
                    }
                }

            if self.close_date < self.datetime_publish:
                self.close_date = False
                return {
                    'warning': {
                        'title': "Validation",
                        'message': "End date cannot be lesser than Publish Date",
                    }
                }
            

    job_section_descriptions = fields.Many2many('description.sections') # Table objects for storing different sections of descriptions

    job_section_proficiency_scale = fields.Many2many('skill.proficiency.scale', string='Proficiency Scale')


    class hrJobDescriptionSection(models.Model):
        _name = 'description.sections'

        """
            This is the definition of the description section
        """

        title = fields.Char()
        job_descriptions = fields.One2many(
            'job.descriptions', 'section_description',
            
            ) # Table objects for the description in each section.

    class hrJobDescriptions(models.Model):
        _name = 'job.descriptions'

        """
            This is the definition of the descriptions for each section
        """

        description = fields.Char()
        section_description = fields.Many2one('description.sections')

    
    class hrJobSillProficiencyScale(models.Model):
        _name = 'skill.proficiency.scale'

        skill = fields.Char(string='Skill', required=True)
        scale = fields.Integer(string='Scale', default=4)
        scale_selection = fields.Selection([('1', '1'), ('2', '2'), ('3', '3'), ('4', '4'), ('5', '5')],
                                    string='Scale Selection', default='1')

        @api.constrains('scale_selection')
        def _scale_selection_constrain(self):
            for record in self:
                if record.scale_selection not in ['1', '2', '3', '4', '5']:
                    record.scale_selection = '1'

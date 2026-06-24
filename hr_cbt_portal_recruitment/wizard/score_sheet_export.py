# -*- coding: utf-8 -*-

import csv 
import io
import xlwt
from datetime import datetime, timedelta
import base64
import random
from odoo.exceptions import ValidationError
from odoo import fields, models, api, _
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT
from dateutil.parser import parse
import ast 
import logging
_logger = logging.getLogger(__name__)


class ScoreSheetExport(models.Model):
    _name = "score.sheet.export"
    _description = 'Score sheet Export'

    name = fields.Char(string="Title of document")
    applicant_ids = fields.Many2many(
        'hr.applicant', 
        'score_sheet_applicant_rel',
        'export_id',
        'applicant_id', 
        string="Applicants"
        )
    # TODO add validation for application not set for panelist score sheet
    export_option = fields.Selection([
        ('score_sheet_download', 'Score sheet download'),
        ('collation', 'Collation'),
        ('f_result', 'F. Result'),
        ],
        string="Option", required=True
        )
    # TODO add validation for application not set for panelist score sheet

    excel_file = fields.Binary('Download Excel file', readonly=True)
    filename = fields.Char('Excel File')
 
    def action_validation(self):
        for rec in self.mapped('applicant_ids'):
            if not rec.survey_panelist_input_ids:
                raise ValidationError(f'Applicant with name {rec.partner_name} does not any score sheet attached to it')

    def method_export(self):
        self.action_validation()
        if self.export_option == "score_sheet_download":
            self.build_score_sheet_excel_report()
        else:
            raise ValidationError("Not yet developed")

    def build_score_sheet_excel_report(self):
        # get the upload survey / scoresheet for applicants
        applicant_with_score_sheets = self.applicant_ids[0].survey_panelist_input_ids[0].survey_user_input_ids
        survey_id  = applicant_with_score_sheets.survey_id
        if survey_id.question_and_page_ids:
            question_and_page_ids = survey_id.question_and_page_ids
            headers = [
                'Timestamp', 'Panelist', 'Candidates Name', 'Candidate Phone']
            headers += [
                hd.title for hd in question_and_page_ids
                ]
            first_four_headers = headers[0:4]
            style0 = xlwt.easyxf('font: name Times New Roman, color-index red, bold on',
                    num_format_str='#,##0.00')
            # style1 = xlwt.easyxf(num_format_str='DD-MMM-YYYY')
            wb = xlwt.Workbook()
            ws = wb.add_sheet(self.name, cell_overwrite_ok=True)
            colh = 0
            # ws.write(0, 6, 'RECORDS GENERATED: %s - On %s' %(self.name, datetime.strftime(fields.Date.today(), '%Y-%m-%d')), style0)
            for head in headers:
                ws.write(0, colh, head)
                colh += 1
            rowh = 1
            for applicant in self.applicant_ids:
                panelist_ids = applicant.survey_panelist_input_ids
                for panelist in panelist_ids: # this is the panelists
                    panelist_survey = panelist.survey_user_input_ids[0] # the panelist surverys
                    panelist_survey_answer_ids = panelist_survey.user_input_line_ids
                    dynamic_column = 4
                    for panelist_answer in panelist_survey_answer_ids:
                        ws.write(rowh, 0, panelist_answer.write_date)
                        ws.write(rowh, 1, panelist.panelist_id.name)
                        ws.write(rowh, 2, applicant.partner_name)
                        ws.write(rowh, 3, applicant.partner_phone)
                        ws.write(rowh, dynamic_column, panelist_answer.display_name)
                        dynamic_column += 1
                    rowh += 1
            fp = io.BytesIO()
            wb.save(fp)
            filename = "{} ON {}.xls".format(
                self.name, datetime.strftime(fields.Date.today(), '%Y-%m-%d'), style0)
            self.excel_file = base64.encodestring(fp.getvalue())
            self.filename = filename
            fp.close()
            return { 
                    'type': 'ir.actions.act_url',
                    'url': '/web/content/?model=score.sheet.export&download=true&field=excel_file&id={}&filename={}'.format(self.id, self.filename),
                    'target': 'current',
                    'nodestroy': False,
            }
        else:
            raise ValidationError('No survey question set for applicants')
                  

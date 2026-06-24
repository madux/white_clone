# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _  


class SignTemplate(models.Model):
    _name = "recruitment.sign.template"

    name = fields.Char(
        string='Name'
        )
    applicant_ids = fields.Many2one(
        'hr.applicant',
        string='Applicants'
        )
    sign_request_ids = fields.Many2one(
        'recruitment.sign.request',
        string='Sign Requests'
        )
    
     
    reference = fields.Char(
        string='Reference'
        )
    subject = fields.Char(
        string='Subject'
        )
    
    message = fields.Char(
        string='Message'
        )
    

class SignRequest(models.Model):
    _name = "recruitment.sign.request.item"

    applicant_id = fields.Many2one(
        'hr.applicant',
        string='Applicant'
        )
    sign_request_id = fields.Many2one(
        'recruitment.sign.request',
        string='Applicant'
        )
    
    partner_id = fields.Many2one(
        'hr.applicant',
        string='Applicant'
        )
    
    reference = fields.Char(
        string='Reference'
        )
    subject = fields.Char(
        string='Subject'
        )
    
    message = fields.Char(
        string='Message'
        )
     

class SignRequest(models.Model):
    _name = "recruitment.sign.request"

    applicant_id = fields.Many2one(
        'hr.applicant',
        string='Applicant'
        )
    
    request_item_ids = fields.One2many(
        'recruitment.sign.request.item',
        'sign_request_id',
        string='sign.request.item'
        )
    
    
    partner_id = fields.Many2one(
        'hr.applicant',
        string='Applicant'
        )
    dummy_share_link = fields.Char(
        string='Dummy Shared Link'
        )
    is_currently_sent = fields.Boolean(
        string='Currently sent', 
        help="Used to determine the current signature request to send"
        )
    
    
    
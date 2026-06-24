# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _, Command
from odoo.exceptions import ValidationError


class CBTRecruitmentSignWizard(models.TransientModel):
    _name = 'cbt.recruitment.sign.wizard'
    _description = 'CBT Sign document in recruitment'

     
    applicant_ids = fields.Many2many('hr.applicant', string="Applicants")
    sign_template_ids = fields.Many2many(
        'recruitment.sign.template', string='Documents to sign',required=True)
        # domain="[('id', 'in', possible_template_ids)]",)
    
    subject = fields.Char(string="Subject", required=True, default='Signature Request')
    message = fields.Html("Message")
    cc_partner_ids = fields.Many2many('res.partner', string="Copy to")
    attachment_ids = fields.Many2many('ir.attachment')

    # applicant_role_id = fields.Many2one(
    #     "sign.item.role",
    #     string="Applicant Role", required=True,
    #     domain="[('id', 'in', sign_template_responsible_ids)]",
    #     compute='_compute_applicant_role_id', store=True, readonly=False,
    #     help="Applicant's role on the templates to sign. The same role must be present in all the templates")
    possible_template_ids = fields.Many2many(
        'recruitment.sign.template',
        'possible_template_rel',
        'cbtRecruitmentsign_wizard_id',
        'sign_template_id'
        # compute='_compute_possible_template_ids'
        )
    # sign_template_responsible_ids = fields.Many2many(
    #     'sign.item.role', compute='_compute_responsible_ids')
    
    # def _get_sign_template_ids(self):
    #     return self.env['sign.template'].search([])\
    #         .filtered(lambda t: 1 <= t.responsible_count <= 2)
    
    # @api.depends('sign_template_ids')
    # def _compute_possible_template_ids(self):
    #     possible_sign_templates = self._get_sign_template_ids()
    #     for wizard in self:
    #         if not wizard.sign_template_ids:
    #             wizard.possible_template_ids = possible_sign_templates
    #         else:
    #             roles = wizard.sign_template_ids.sign_item_ids.responsible_id
    #             wizard.possible_template_ids = possible_sign_templates.filtered(lambda t: t.sign_item_ids.responsible_id & roles)


    # @api.depends('sign_template_responsible_ids')
    # def _compute_applicant_role_id(self):
    #     for wizard in self:
    #         if wizard.applicant_role_id not in wizard.sign_template_responsible_ids:
    #             wizard.applicant_role_id = False
    #         if len(wizard.sign_template_responsible_ids) == 1:
    #             wizard.applicant_role_id = wizard.sign_template_responsible_ids._origin

    # @api.depends('sign_template_ids.sign_item_ids.responsible_id')
    # def _compute_responsible_ids(self):
    #     for r in self:
    #         responsible_ids = self.env['sign.item.role']
    #         for sign_template_id in r.sign_template_ids:
    #             if responsible_ids:
    #                 responsible_ids &= sign_template_id.sign_item_ids.responsible_id
    #             else:
    #                 responsible_ids |= sign_template_id.sign_item_ids.responsible_id
    #         r.sign_template_responsible_ids = responsible_ids

    def send_signature(self):
        pass 
        # self.ensure_one()
        # sign_request = self.env['sign.request']
        # if not self.check_access_rights('create', raise_exception=False):
        #     sign_request = sign_request.sudo()

        # sign_values = []
        # sign_templates_applicant_ids = self.sign_template_ids.filtered(lambda t: len(t.sign_item_ids.mapped('responsible_id')) == 1)
        # for applicant in self.applicant_ids:
        #     applicant_email = applicant.partner_id.email or applicant.email_from
        #     if applicant.partner_id and applicant_email:
        #         for st in sign_templates_applicant_ids:
        #             sign_values.append((
        #                 st,
        #                 [{
        #                     'role_id': self.applicant_role_id.id,
        #                     'partner_id': applicant.partner_id.id
        #                 }]
        #             ))
        #         # This is used to set the document process so that HR will
        #         # know the records that have been sent for documentation
        #         applicant.is_documentation_process = True
        # sign_requests = self.sudo().env['sign.request'].create([{
        #     'template_id': srv[0].id,
        #     'request_item_ids': [Command.create({
        #         'partner_id': signer['partner_id'],
        #         'role_id': signer['role_id'],
        #     }) for signer in srv[1]],
        #     'reference': _('Signature Request - %s', srv[0].name),
        #     'subject': self.subject,
        #     'message': self.message,
        #     'attachment_ids': [(4, attachment.copy().id) for attachment in self.attachment_ids], # Attachments may not be bound to multiple sign requests
        # } for srv in sign_values])
        # sign_requests.message_subscribe(partner_ids=self.cc_partner_ids.ids)
        # if not self.check_access_rights('write', raise_exception=False):
        #     sign_requests = sign_requests.sudo()
        # for sign_request in sign_requests:
        #     sign_request.toggle_favorited()
        # return True

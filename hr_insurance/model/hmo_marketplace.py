from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class hmoPlanValue(models.Model):
    _name = 'hmo.plan.value'
    _description = 'CLEON HMOPLAN VALUE'

    name = fields.Char("Name", required=True, size=10)
    description = fields.Char("Description", size=100)


class hmoTags(models.Model):
    _name = 'hmo.tags'
    _description = 'CLEON TAG'

    name = fields.Char("Tag name", required=True, size=10)

class hmoPlan(models.Model):
    _name = 'hmo.plan'
    _description = 'CLEON HMOPLAN'

    name = fields.Char("Plan", required=True, size=10)
    hmo_marketplace_id = fields.Many2one('hmo.marketplace')
    hmo_plan_value_ids = fields.Many2many('hmo.plan.value', string="Plan Values")
    plan_price = fields.Float("Amount per Person")
    max_person = fields.Integer("Maximum Person", default=1)


class hmoHospital(models.Model):
    _name = 'hmo.hospital'
    _description = 'CLEONHR Hospital' 
    _rec_name = 'hospital_name'

    # _inherits={
    #     'res.partner': 'partner_id',
    # }
    # # _order = 'booking_date desc, booking_start_time'

    # # ── Identification ──────────────────────────────────────────────────────
    # partner_id = fields.Many2one(
    #     comodel_name="res.partner",
    #     required=True,
    #     ondelete="cascade",
    #     readonly=True,
    #     string="Associated group",
    # )

    hospital_name = fields.Char("Hospital Name", required=True)
    hospital_no = fields.Char("Hospital Number", required=True)
    street = fields.Char("Hospital Address", required=True)
    phone = fields.Char("Hospital Phone", required=True)
    email = fields.Char("Hospital Email", required=False)
    country_id = fields.Many2one("res.country", "Country", required=False)
    state_id = fields.Many2one("res.country.state", "State", required=False)
    code = fields.Char("Hospital Code", readonly=True, compute="get_name_code")

    is_registered = fields.Boolean(
        string='is Registered',
        default=True,
    )
    active = fields.Boolean(
        string='is Active',
        default=True,
    )
    channel_ids = fields.Many2many(
        'discuss.channel',
        'hmo_discuss_channel_rel',
        'hmo_discuss_channel_id',
        'discuss_channel_id',
        string='Channels',
    )
    meeting_ids = fields.Many2many('calendar.event', 'hmo_calendar_event_res_partner_rel', 'hmo_res_partner_id',
                                   'hmo_calendar_event_id', string='Meetings', copy=False)
    @api.depends('hospital_name')
    def get_name_code(self):
        for rec in self:
            if rec.hospital_name:
                rec.code = rec.hospital_name[0].upper()
            else:
                rec.code = 'N'

    def open_record(self):
        view_id = self.env.ref('hr_insurance.view_hmo_hospital_form').id
        ret = {
            'name': "HMO",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': 'hmo.hospital',
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'new'
            }
        return ret

class hmoMarketplace(models.Model):
    _name = 'hmo.marketplace'
    _description = 'CLEONHR HMO PROVIDER' 
    _rec_name = 'name'

    # _inherits={
    #     'res.partner': 'partner_id',
    # }
    # # _order = 'booking_date desc, booking_start_time'

    # ── Identification ──────────────────────────────────────────────────────
    # partner_id = fields.Many2one(
    #     comodel_name="res.partner",
    #     required=True,
    #     ondelete="cascade",
    #     readonly=False,
    #     string="Associated group",
    # )
    name = fields.Char(
        string='Name',
        required=True,
        copy=False,
        readonly=False,
        index=True,
        default=lambda self: _('New'),
    )
    is_registered = fields.Boolean(
        string='is Registered',
        default=True,
    )
    street = fields.Char("Hospital Address", required=True)
    code = fields.Char("Hospital Code", readonly=True, compute="get_name_code")
    phone = fields.Char("Hospital Phone", required=True)
    email = fields.Char("Email", required=False)
    country_id = fields.Many2one("res.country", "Country", required=False)
    state_id = fields.Many2one("res.country.state", "State", required=False)
    hmo_employee_ids = fields.Many2many(
        'hr.employee',
        'hmo_employee_rel',
        'hmo_employee_id',
        'hmo_partner_id',
        string='HMO employees',
    )
    hmo_hospital_ids = fields.Many2many(
        'hmo.hospital',
        'hmo_hospital_rel',
        'hmo_hospital_id',
        'hmo_partner_id',
        string='Hospital',
    )
    hmo_tag_ids = fields.Many2many(
        'hmo.tags',
        string='HMO Tags',
    )
    hmo_plan_ids = fields.One2many(
        'hmo.plan',
        'hmo_marketplace_id',
        string='HMO Plans',
    )
    total_hospital = fields.Integer(
        string='Total Hospital',
        required=False,  
        compute="get_number_hospital",
    )
    channel_ids = fields.Many2many(
        'discuss.channel',
        'hmom_discuss_channel_rel',
        'hmom_discuss_channel_id',
        'discussm_channel_id',
        string='Channels',
    )
    meeting_ids = fields.Many2many('calendar.event', 'hmom_calendar_event_res_partner_rel', 'hmom_res_partner_id',
                                   'hmom_calendar_event_id', string='Meetings', copy=False)


    @api.depends('hmo_hospital_ids')
    def get_number_hospital(self):
        for rec in self:
            if rec.hmo_hospital_ids:
                rec.total_hospital = len(rec.hmo_hospital_ids.ids) 
            else:
                rec.total_hospital = 0

    @api.depends('name')
    def get_name_code(self):
        for rec in self:
            if rec.name:
                rec.code = rec.name[0].upper()
            else:
                rec.code = 'N'

    total_employee = fields.Integer(
        string='Total Employee',
        required=False,  
        compute="get_number_employee",
    )
    date_expiry = fields.Date(
        string='Expiry Date',
        required=False,  
    )

    @api.depends('hmo_employee_ids')
    def get_number_employee(self):
        for rec in self:
            if rec.hmo_employee_ids:
                rec.total_employee = len(rec.hmo_employee_ids.ids) 
            else:
                rec.total_employee = 0

    active = fields.Boolean(
        string='Active',
        default=True,
    )

    def not_open_button(self):
        pass 
    
    def open_action_hmo_marketplace(self):
        view_id = self.env.ref('hr_insurance.view_hmo_marketplace_form').id
        ret = {
            'name': "HMO",
            'view_mode': 'form',
            'view_id': view_id,
            'view_type': 'form',
            'res_model': 'hmo.marketplace',
            'res_id': self.id,
            'type': 'ir.actions.act_window',
            'domain': [],
            'target': 'new'
            }
        return ret

    # @api.model
    # def get_dashboard(self):
    #     record = self.search([], limit=1)

    #     if not record:
    #         record = super(HrInsurance, self).create({})

    #     # record._compute_dashboard_values()

    #     return {
    #         'type': 'ir.actions.act_window',
    #         'name': 'HMO',
    #         'res_model': 'hr.insurance',
    #         'view_mode': 'form',
    #         'res_id': record.id,
    #         'target': 'current',
    #     }
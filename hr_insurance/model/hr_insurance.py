from odoo import models, fields, api, _
from odoo.exceptions import ValidationError, UserError
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class Hrchecklist(models.Model):
    _name = 'hmo.checklist'
    _description = 'CLEONHR HMOChecklist'
    _rec_name = 'name'

    name = fields.Char(
        string='Name',
        required=True,
        copy=True,
        index=True,
        default=lambda self: _('New'),
    )

    description = fields.Char(
        string='Description',
        required=True,
        copy=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=1,
    )
    active = fields.Boolean(
        string='active',
        default=True,
    )
    access_right_ids = fields.Many2many(
        'ir.model.access',
        string='Access Rights'
    )

    state = fields.Selection([
        ('required', 'Required'),
        ('done', 'Done'),
    ],
        string='Status',
        default='required',
        compute='_compute_checklist_status',
        store=True,
    )

    def set_done(self):
        self.state = 'done'

    model_id = fields.Many2one('ir.model', string="App", domain="[('name', 'ilike', 'CLEONHR')]")
    view_type = fields.Selection([('tree', 'Tree'), ('form', 'Form')], string="View type", default="tree")

    @api.depends('model_id')
    def _compute_checklist_status(self):

        for rec in self:
            rec.state = 'required'
            if not rec.model_id:
                continue
            try:
                # get model name
                model_name = rec.model_id.model

                # check if model exists
                if model_name in self.env:

                    # count records in that model
                    count = self.env[model_name].search_count([])

                    # if records exist -> done
                    if count > 0:
                        rec.state = 'done'

            except Exception:
                rec.state = 'required'

    def action_open_setup(self):
        if self.model_id:
            ensure_records = self.env[f"{self.model_id.model}"].search([])
            if ensure_records: 
                '''if any record, set the checklist to done'''
                self.state = "done"
                return {
                    'type': 'ir.actions.act_window',
                    'name': 'Setup',
                    'res_model': self.model_id.model,
                    'view_mode': 'tree',
                    'domain': [('id', 'in', ensure_records.ids)],
                    'target': 'new',
                }
            else:
                return {
                    'type': 'ir.actions.act_window',
                    'name': 'Setup',
                    'res_model': self.model_id.model,
                    'view_mode': 'form',
                    'target': 'new',
                }

    @api.model
    def create(self, vals):
        record = super().create(vals)

        model_id = self.env.ref(
            'hr_insurance.model_hmo_checklist'
        ).id

        access_ids = self.env['ir.model.access'].search([
            ('model_id', '=', model_id)
        ]).ids

        record.access_right_ids = [(6, 0, access_ids)]

        return record


class HrInsurance(models.Model):
    _name = 'hr.insurance'
    _description = 'CLEONHR Insurance'
    # _inherit = ['mail.thread', 'mail.activity.mixin']
    # _order = 'booking_date desc, booking_start_time'
    _rec_name = 'name'

    # ── Identification ──────────────────────────────────────────────────────
    
    name = fields.Char(
        string='Name',
        required=False,
        copy=False,
        index=True,
        default=lambda self: _('New'),
    )
    user_name = fields.Char(
        string='User name',
        required=False,
        readonly=True,
        index=True,
        default=lambda self:self.env.user.name,
    )
    
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    setup_progress = fields.Float(
        string='Setup',
        required=False,  
        default=0
        # compute="get_number_completed",
    )
    setup_range = fields.Char(
        string='Setup range',
        required=False,
        default="0/4",
        # compute="get_number_completed",
    )
    setup_required = fields.Char(
        string='Setup required',
        required=False,
        default="0/4",
        # compute="get_number_completed",
    )

    hmo_checklist_ids = fields.Many2many(
        'hmo.checklist',
        string='Checklist',
        required=False, 
    )

    hmo_ids = fields.Many2many(
        'hmo.marketplace',
        string='HMO market place',
        required=False, 
        # compute="get_number_completed",
    )

    registered_hmo = fields.Integer(
        string='Registered hmo',
    )

    # @api.depends('hmo_ids.state')
    def _compute_dashboard_values(self):
        '''get the total number of health insurances
        checklists, get the total that is completed,
        get the percentage completion
        '''
        for rec in self:
            hmo_checklist_ids = self.env['hmo.checklist'].search([])
            hmo_ids = self.env['hmo.marketplace'].search([])
            if hmo_ids:
                rec.hmo_ids = hmo_ids.ids
            rec.registered_hmo = self.env['hmo.marketplace'].search_count([('is_registered', '=', True)])
            total_hmos = len(hmo_checklist_ids.ids)

            if hmo_checklist_ids:
                rec.hmo_checklist_ids = hmo_checklist_ids.ids
                completed_hmos = rec.mapped('hmo_checklist_ids').filtered(
                    lambda st: st.state == 'done')
                number_completed = len(completed_hmos.ids)
                uncompleted = total_hmos - number_completed
                complete_mod = total_hmos / total_hmos if number_completed == 0 else number_completed
                rec.setup_progress = 100 / complete_mod if complete_mod != 0 else 100
                rec.setup_range = f"{number_completed} / {total_hmos}"
                rec.setup_required = f"{uncompleted} / {total_hmos}"
            else:
                rec.setup_progress = 0
                rec.setup_range = f"0 / {total_hmos}"
                rec.setup_required = f"0 / {total_hmos}"
            
            
    @api.model
    def get_dashboard(self):
        record = self.search([], limit=1)

        if not record:
            record = super(HrInsurance, self).create({})
        record._compute_dashboard_values()
        return {
            'type': 'ir.actions.act_window',
            'name': 'HMO',
            'res_model': 'hr.insurance',
            'view_mode': 'form',
            'res_id': record.id,
            'target': 'current',
        }
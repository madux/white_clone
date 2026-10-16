# -*- coding: utf-8 -*-
from odoo import models, fields, api, _
from odoo.exceptions import UserError
from dateutil.relativedelta import relativedelta


class GrievanceCase(models.Model):
    _name = 'grievance.case'
    _description = 'Grievance Case'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'date_submitted desc, id desc'
    _rec_name = 'name'

    name = fields.Char(string='Case ID', required=True, copy=False, readonly=True, default='New')

    is_anonymous = fields.Boolean(string='Anonymous Complaint')
    complainant_id = fields.Many2one('hr.employee', string='Complainant',
                                      tracking=True,
                                      help="Leave empty and tick 'Anonymous' for anonymous complaints.")
    complainant_name = fields.Char(string='Complainant Name', compute='_compute_complainant_name', store=True)

    grievance_type_id = fields.Many2one('grievance.type', string='Type', required=True, tracking=True)
    category_id = fields.Many2one('grievance.category', string='Category',
                                   related='grievance_type_id.category_id', store=True, readonly=True)

    date_submitted = fields.Date(string='Date Submitted', default=fields.Date.context_today, required=True)
    date_closed = fields.Date(string='Date Closed', readonly=True, copy=False)

    priority = fields.Selection([
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ], default='medium', required=True, tracking=True)

    severity = fields.Selection([
        ('normal', 'Normal'),
        ('severe', 'Severe'),
    ], default='normal', required=True, tracking=True,
        help="Set to Severe to trigger the 'Severity = Severe' escalation rule.")

    stage_id = fields.Many2one('grievance.stage', string='Status', tracking=True,
                                group_expand='_read_group_stage_ids',
                                default=lambda self: self._default_stage_id())
    is_closed = fields.Boolean(related='stage_id.is_closed', store=True, string='Is Closed')

    handler_id = fields.Many2one('res.users', string='Handler', tracking=True,
                                  default=lambda self: self.env.user)

    description = fields.Text(string='Description')

    days_open = fields.Integer(string='Days Open', compute='_compute_days_open', store=True)

    escalated = fields.Boolean(string='Escalated', copy=False, tracking=True)
    escalation_rule_id = fields.Many2one('grievance.escalation.rule', string='Escalated By', copy=False)

    # Resolution
    resolution_id = fields.Many2one('grievance.resolution', string='Resolution')
    resolution_notes = fields.Text(string='Resolution Notes')
    compensation_amount = fields.Float(string='Compensation Amount')
    follow_up_date = fields.Date(string='Follow-Up Date')
    restorative_action_plan = fields.Text(string='Restorative Action Plan')
    requires_compensation_amount = fields.Boolean(related='resolution_id.requires_compensation_amount')
    requires_followup_date = fields.Boolean(related='resolution_id.requires_followup_date')
    requires_restorative_action = fields.Boolean(related='resolution_id.requires_restorative_action')

    panel_id = fields.Many2one('grievance.panel', string='Investigation Panel')

    color = fields.Integer(string='Kanban Color')
    company_id = fields.Many2one('res.company', default=lambda self: self.env.company)

    _sql_constraints = [
        ('name_uniq', 'unique(name, company_id)', 'Case ID must be unique.'),
    ]

    # ---------------------------------------------------------------
    # Defaults / computes
    # ---------------------------------------------------------------
    def _default_stage_id(self):
        return self.env['grievance.stage'].search([], order='sequence', limit=1).id

    @api.model
    def _read_group_stage_ids(self, stages, domain, order=None):
        """Always show every active stage as a kanban column, even if empty."""
        return stages.search([], order='sequence')

    @api.depends('is_anonymous', 'complainant_id')
    def _compute_complainant_name(self):
        for rec in self:
            rec.complainant_name = _('Anonymous') if rec.is_anonymous else (rec.complainant_id.name or '')

    @api.depends('date_submitted', 'date_closed')
    def _compute_days_open(self):
        today = fields.Date.context_today(self)
        for rec in self:
            if rec.date_submitted:
                end = rec.date_closed or today
                rec.days_open = (end - rec.date_submitted).days
            else:
                rec.days_open = 0

    @api.onchange('grievance_type_id')
    def _onchange_grievance_type_id(self):
        if self.grievance_type_id:
            self.priority = self.grievance_type_id.default_priority

    # ---------------------------------------------------------------
    # CRUD
    # ---------------------------------------------------------------
    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', 'New') == 'New':
                vals['name'] = self.env['ir.sequence'].next_by_code('grievance.case') or 'New'
        return super().create(vals_list)

    def write(self, vals):
        res = super().write(vals)
        if vals.get('stage_id'):
            stage = self.env['grievance.stage'].browse(vals['stage_id'])
            if stage.is_closed:
                self.filtered(lambda c: not c.date_closed).write({'date_closed': fields.Date.context_today(self)})
            else:
                self.write({'date_closed': False})
        return res

    # ---------------------------------------------------------------
    # Workflow actions
    # ---------------------------------------------------------------
    def action_move_to_stage(self, stage_xmlid):
        stage = self.env.ref(stage_xmlid, raise_if_not_found=False)
        if stage:
            self.write({'stage_id': stage.id})

    def action_resolve(self):
        if not self.resolution_id:
            raise UserError(_("Please select a Resolution before marking this case as Resolved."))
        if self.requires_compensation_amount and not self.compensation_amount:
            raise UserError(_("This resolution requires a Compensation Amount."))
        if self.requires_followup_date and not self.follow_up_date:
            raise UserError(_("This resolution requires a Follow-Up Date."))
        if self.requires_restorative_action and not self.restorative_action_plan:
            raise UserError(_("This resolution requires a Restorative Action Plan."))
        resolved_stage = self.env.ref('grievance_management.grievance_stage_resolved', raise_if_not_found=False)
        if resolved_stage:
            self.write({'stage_id': resolved_stage.id})
        self.message_post(body=_("Case resolved: %s") % (self.resolution_id.name,))

    def action_escalate_manually(self):
        escalated_stage = self.env.ref('grievance_management.grievance_stage_escalated', raise_if_not_found=False)
        for rec in self:
            if escalated_stage:
                rec.stage_id = escalated_stage.id
            rec.escalated = True
            rec.message_post(body=_("Case manually escalated."))

    def _apply_escalation(self, rule):
        """Called by grievance.escalation.rule when a case matches its trigger."""
        self.ensure_one()
        escalated_stage = self.env.ref('grievance_management.grievance_stage_escalated', raise_if_not_found=False)
        vals = {'escalated': True, 'escalation_rule_id': rule.id}
        if escalated_stage and not self.stage_id.is_closed:
            vals['stage_id'] = escalated_stage.id
        self.write(vals)

        if rule.target_user_id:
            self.activity_schedule(
                'mail.mail_activity_data_todo',
                summary=_("Escalation: %s") % rule.name,
                note=_("Case %s was automatically escalated by rule '%s'.") % (self.name, rule.name),
                user_id=rule.target_user_id.id,
            )
        self.message_post(body=_("Case escalated automatically by rule: %s") % rule.name)

    @api.model
    def _cron_check_escalations(self):
        rules = self.env['grievance.escalation.rule'].search([('active', '=', True)])
        rules.action_run_now()

    # ---------------------------------------------------------------
    # Dashboard
    # ---------------------------------------------------------------
    @api.model
    def get_dashboard_data(self):
        """Aggregated data for the OWL dashboard client action."""
        stages = self.env['grievance.stage'].search([], order='sequence')
        stage_counts = {s.id: 0 for s in stages}
        stage_groups = self.read_group([], ['stage_id'], ['stage_id'])
        for g in stage_groups:
            if g['stage_id']:
                stage_counts[g['stage_id'][0]] = g['stage_id_count']

        total = sum(stage_counts.values())

        stat_cards = [{'label': s.name, 'count': stage_counts.get(s.id, 0), 'key': s.name.lower()} for s in stages]
        stat_cards.insert(0, {'label': 'Total', 'count': total, 'key': 'total'})

        # Monthly grievances for the last 6 months, split by open/closed
        today = fields.Date.context_today(self)
        months = []
        for i in range(5, -1, -1):
            m = (today.replace(day=1) - relativedelta(months=i))
            months.append(m)
        month_labels = [m.strftime('%b %Y') for m in months]
        monthly_open = [0] * 6
        monthly_closed = [0] * 6
        cases = self.search_read([], ['date_submitted', 'is_closed'])
        for c in cases:
            d = c['date_submitted']
            if not d:
                continue
            for idx, m in enumerate(months):
                if d.year == m.year and d.month == m.month:
                    if c['is_closed']:
                        monthly_closed[idx] += 1
                    else:
                        monthly_open[idx] += 1
                    break

        # Breakdown by type
        type_groups = self.read_group([], ['grievance_type_id'], ['grievance_type_id'])
        by_type = [
            {'label': g['grievance_type_id'][1] if g['grievance_type_id'] else 'Unspecified',
             'count': g['grievance_type_id_count']}
            for g in type_groups
        ]

        return {
            'greeting_name': self.env.user.name,
            'stat_cards': stat_cards,
            'month_labels': month_labels,
            'monthly_open': monthly_open,
            'monthly_closed': monthly_closed,
            'by_type': by_type,
        }


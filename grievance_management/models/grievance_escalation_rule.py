# -*- coding: utf-8 -*-
from odoo import models, fields, api


class GrievanceEscalationRule(models.Model):
    _name = 'grievance.escalation.rule'
    _description = 'Grievance Escalation Rule'
    _order = 'sequence, id'

    name = fields.Char(required=True)
    sequence = fields.Integer(default=10)
    active = fields.Boolean(default=True)

    trigger_type = fields.Selection([
        ('deadline_exceeded', 'Deadline Exceeded'),
        ('severity_severe', 'Severity = Severe'),
    ], required=True, default='deadline_exceeded', string='Trigger')

    deadline_days = fields.Integer(
        string='Deadline (Days Open)', default=7,
        help="For 'Deadline Exceeded' triggers: number of days a case can stay open "
             "in a non-closed stage before this rule fires.")

    action_type = fields.Selection([
        ('escalate_to_hr_director', 'Escalate to HR Director'),
        ('notify_legal', 'Notify Legal'),
        ('notify_user', 'Notify Specific User'),
    ], required=True, default='escalate_to_hr_director', string='Action')

    target_user_id = fields.Many2one('res.users', string='Target User',
                                      help="User who receives the escalation activity/notification.")
    target_label = fields.Char(string='Target', compute='_compute_target_label', store=True)

    active_case_count = fields.Integer(compute='_compute_active_case_count', string='Active Cases')

    @api.depends('action_type', 'target_user_id')
    def _compute_target_label(self):
        for rec in self:
            if rec.target_user_id:
                rec.target_label = rec.target_user_id.name
            elif rec.action_type == 'notify_legal':
                rec.target_label = 'Legal Department'
            elif rec.action_type == 'escalate_to_hr_director':
                rec.target_label = 'HR Director'
            else:
                rec.target_label = ''

    def _get_matching_cases(self):
        """Return the grievance.case recordset currently matching this rule's trigger."""
        self.ensure_one()
        Case = self.env['grievance.case']
        domain = [('stage_id.is_closed', '=', False)]
        if self.trigger_type == 'severity_severe':
            domain.append(('severity', '=', 'severe'))
            return Case.search(domain)
        elif self.trigger_type == 'deadline_exceeded':
            cases = Case.search(domain)
            return cases.filtered(lambda c: c.days_open >= (self.deadline_days or 0))
        return Case.browse()

    @api.depends('trigger_type', 'deadline_days')
    def _compute_active_case_count(self):
        for rec in self:
            rec.active_case_count = len(rec._get_matching_cases()) if rec.id else 0

    def action_run_now(self):
        """Manually trigger this rule (also called by the escalation cron)."""
        for rule in self.filtered('active'):
            cases = rule._get_matching_cases().filtered(lambda c: not c.escalated)
            for case in cases:
                case._apply_escalation(rule)
        return True

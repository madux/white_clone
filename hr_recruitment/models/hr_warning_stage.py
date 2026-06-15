# -*- coding: utf-8 -*-
from odoo import models, fields


class HrWarningStage(models.Model):
    """
    Configurable pipeline stages for incident processing.
    Each stage can have one or more approver users who receive
    email notifications when an incident enters that stage.
    """
    _name = 'hr.warning.stage'
    _description = 'HR Warning Stage'
    _order = 'sequence, id'

    name = fields.Char(
        string='Stage Name',
        required=True,
        translate=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=10,
    )
    description = fields.Text(
        string='Stage Description',
        help='Internal notes about what happens at this stage.',
    )

    # ── Approvers ────────────────────────────────────────────────────────────
    approver_ids = fields.Many2many(
        comodel_name='res.users',
        relation='hr_warning_stage_approver_rel',
        column1='stage_id',
        column2='user_id',
        string='Approvers',
        domain=[('share', '=', False)],
        help='Users who approve incidents at this stage. '
             'They receive an email notification when a case enters this stage.',
    )

    # ── Behaviour flags ───────────────────────────────────────────────────────
    is_initial = fields.Boolean(
        string='Initial Stage',
        default=False,
        help='Mark as the starting stage for new incidents.',
    )
    is_closed = fields.Boolean(
        string='Closed Stage',
        default=False,
        help='Incidents in this stage are considered closed/resolved.',
    )
    is_hearing = fields.Boolean(
        string='Hearing & Decisions Stage',
        default=False,
        help='Incident hearing and Decisions',
    )
    fold = fields.Boolean(
        string='Folded in Kanban',
        default=False,
    )

    # ── Mail template ─────────────────────────────────────────────────────────
    mail_template_id = fields.Many2one(
        comodel_name='mail.template',
        string='Email Template',
        domain=[('model', '=', 'hr.warning')],
        help='Template sent to approvers when an incident enters this stage. '
             'Leave empty to use the module default template.',
    )

    active = fields.Boolean(default=True)

# -*- coding: utf-8 -*-
import logging
from datetime import datetime, date
from dateutil.relativedelta import relativedelta

from odoo import models, fields, api, _
from odoo.exceptions import UserError, ValidationError

_logger = logging.getLogger(__name__)


class HrWarningAppeal(models.Model):
    _name = 'hr.warning.appeal'
    _description = 'HR Warning measure'
    _rec_name = "warning_id"

    warning_id = fields.Many2one(
         'hr.warning',
        string='Case ID', 
    )
    employee_id = fields.Many2one(
         'hr.employee',
        string='Employee', 
    )

    appeal_description = fields.Text(
        string="Appeal Note",
    )
    appeal_date = fields.Date(
        string="Appeal Date",
    )
    appeal_state = fields.Selection(
        selection=[
            ('appealled', 'Appealled'),
            ('review', 'Under Review'),
            ('investigation', 'nvestigation'),
            ('descision', 'descision'),
            ('Action_issed', 'Action Issed'),
            ('cancelled', 'Cancelled'),
            ('cancelled', 'Cancelled'),
        ],
        string='Appeal Status',
        default='appealled',
        tracking=True,
        copy=False,
    )
    appeal_officer_ids = fields.Many2many(
        'hr.employee',
        'hr_warning_appeal_employee_rel',
        'hr_warning_appeal_employee_id',
        'warning_appeal_id',
        string='Appeal Officers',
    )

    start_date = fields.Datetime(
        string='State Date',
    )


    review_date = fields.Datetime(
        string='Review Date',
    )

    def apply_move_next_stage(self):
        if self.appeal_state == 'appealled':
            self.state = 'review'

        elif self.appeal_state == 'review':
            self.state = 'review'
 


class HrWarningInvestigator(models.Model):
    
    _name = 'hr.warning.investigator'
    _description = 'HR Warning investigator'

    warning_id = fields.Many2one('hr.warning', string="Disciplinary ID")
    model_id = fields.Many2one('ir.model', string="Model")
    record_id = fields.Integer(string="Record")
    investigator_id = fields.Many2one('res.users', string="Investigator")
    model_id_char = fields.Char(string="Model")

    def action_assign_investigator(self):
        if self.warning_id:
            self.warning_id.investigator_id = self.investigator_id.id
            self.warning_id._notify_stage_approvers()
        # return {'type': 'ir.actions.act_window_close', 'tag': 'reload',}
        return {'type': 'ir.actions.client', 'tag': 'reload',}

            # return {
            #         'type': 'ir.actions.client',
            #         'tag': 'display_notification',
            #             'params': {
            #                 'title': _('Investigator assigned'),
            #                 'message': _(f'{self.investigator_id.name} has been assigned as Investigator'),
            #                 'type': 'success',
            #                 'sticky': False
            #             }
            #     }
            # return {
            #         'type': 'ir.actions.client',
            #         'tag': 'reload',
            #     }


class HrWarning(models.Model):
    """
    Core incident / disciplinary warning model.

    Lifecycle
    ---------
    Draft  →  (stage pipeline)  →  Closed

    At every stage transition the system:
      1. Writes the new stage.
      2. Sends an email to all approvers configured on that stage
         (using the stage's template or the module default).
      3. Posts a chatter message for the audit trail.
    """
    _name = 'hr.warning'
    _description = 'HR Warning / Incident'
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = 'name desc'
    _rec_name = 'name'

    # ── Reference ─────────────────────────────────────────────────────────────
    name = fields.Char(
        string='Reference',
        required=True,
        copy=False,
        readonly=True,
        default=lambda self: _('New'),
        tracking=True,
    )

    # ── Core incident info ────────────────────────────────────────────────────
    description = fields.Text(
        string='Description',
        required=True,
        tracking=True,
    )
    subject = fields.Char(
        string='Title',
        required=True,
        tracking=True,
    )
    incident_type = fields.Selection(
        selection=[
            ('misconduct', 'Misconduct'),
            ('harassment', 'Harassment'),
            ('theft', 'Theft'),
            ('negligence', 'Negligence'),
            ('insubordination', 'Insubordination'),
            ('other', 'Other'),
        ],
        string='Incident Type',
        required=True,
        default='misconduct',
        tracking=True,
    )
    case_type_id = fields.Many2one(
        comodel_name='hr.warning.case.type',
        string='Case Type',
        ondelete='restrict',
        tracking=True,
    )
    date_incident = fields.Datetime(
        string='Date Occured',
        required=True,
        default=fields.Datetime.now,
        tracking=True,
    )
    location = fields.Char(
        string='Location',
        tracking=True,
    )
    priority = fields.Selection(
        selection=[
            ('0', 'Normal'),
            ('1', 'Low'),
            ('2', 'Medium'),
            ('3', 'High'),
        ],
        string='Priority',
        default='0',
        tracking=True,
    )

    action_taken = fields.Selection(
        selection=[
            ('No immediate Action', 'No immediate Action'),
            ('Sent home For Day', 'Sent home For Day'),
            ('Suspended pending investigation', 'Suspended pending investigation'),
            ('Verbal Warning', 'Verbal Warning'),
            ('Others', 'Others'),
        ],
        string='Action taken',
        default='No immediate Action',
        tracking=True,
    )
    other_action_taken = fields.Text(string="Other action taken")

    require_investigation = fields.Boolean(
        string='Require investigation',
        tracking=True,
    )
    reporter_id = fields.Many2one(
        'res.users',
        string='Reporter',
        default=lambda self: self.env.user.id,
    )
    disciplinary_committee_ids = fields.Many2many(
        'res.users',
        'disciplinary_committee_rel',
        'hr_warning_disciplinary_user_id',
        'disciplinary_user_id',
        string='Disciplinary Committee',
    )
    witness_ids = fields.Many2many(
        'hr.employee',
        string='Witness',
    )
    interim_measure_ids = fields.Many2many(
        'hr.warning.interim_measure',
        'interim_measure_rel',
        'hr_warning_interim_measure_id',
        'interim_measure_id',
        string='Interim measure',
    )
     
    policy_id = fields.Many2one(
        'hr.warning.policy',
        string='PolicyViolation',
    )

    severity_level = fields.Selection(
        selection=[
            ('Minor', 'Minor'),
            ('Major', 'Major'),
            ('Severe', 'Severe'),
            ('Gross Misconduct', 'Gross Misconduct'),
        ],
        string='Severity level',
        default='',
        tracking=True,
    )

    action_menu = fields.Char(string="title", compute="_compute_action_menu")

    def _compute_action_menu(self):
        for rec in self:
            rec.action_menu = ""

    # ── Employee ──────────────────────────────────────────────────────────────
    employee_id = fields.Many2one(
        comodel_name='hr.employee',
        string='Employee',
        required=True,
        tracking=True,
        ondelete='restrict',
    )
    employee_code = fields.Char(
        related='employee_id.barcode',
        string='Employee Code',
        readonly=True,
    )
    department_id = fields.Many2one(
        related='employee_id.department_id',
        string='Department',
        store=True,
        readonly=True,
    )
    job_id = fields.Many2one(
        related='employee_id.job_id',
        string='Job Position',
        store=True,
        readonly=True,
    )
    branch_id = fields.Many2one(
        related='employee_id.user_id.branch_id',
        string='Branch',
        store=True,
        readonly=True,
    )
    tenure = fields.Char(
        string='Tenure',
        compute='_compute_tenure',
        store=False,
    )


    # ── Stage / state ─────────────────────────────────────────────────────────
    stage_id = fields.Many2one(
        comodel_name='hr.warning.stage',
        string='Stage',
        group_expand='_read_group_stage_ids',
        tracking=True,
        copy=False,
        default=lambda self: self._default_stage(),
    )
    state = fields.Selection(
        selection=[
            ('draft', 'Draft'),
            ('pending_approval', 'Pending Approval'),
            ('under_investigation', 'Under Investigation'),
            ('hearing', 'Hearing & Decisions'),
            ('closed', 'Closed'),
            ('appeal', 'Appealled'),
            ('resolution', 'Resolution'),
            ('cancelled', 'Cancelled'),
        ],
        string='Status',
        default='draft',
        tracking=True,
        copy=False,
    )
    workflow_status = fields.Selection(
        selection=[
            ('1', 'Incident Details'),
            ('2', 'Parties'),
            ('3', 'Evidence'),
            ('4', 'Review & Submit'),
            ('5', 'Submitted'),
        ],
        string='Workflow status',
        default='1',
        tracking=True,
        copy=False,
    )

    display_unfinished_message = fields.Text()

    @api.model
    def get_last_draft_record(self):

        record = self.search(
            [
                ('state', '=', 'draft'),
                ('create_uid', '=', self.env.user.id),
            ],
            order='id desc',
            limit=1,
        )

        if record:
            record.display_unfinished_message = """You still have unfinished record creation... Would you like to continue or create a new one?"""

            form_view_id = self.env.ref(
                'hr_warning.hr_warning_dialog_form_view'
            ).id

            return [record.id, form_view_id]

        return [False, False]

    @api.model
    def get_all_hearing_records(self):
        records = self.search(
            [
                ('stage_id.is_hearing', '=', True),
            ],
            order='id desc',
        )

        if records:
            return records.ids
        return []

    def create_new_record(self):
        form_view_id = self.env.ref(
                'hr_warning.hr_warning_dialog_form_view'
            ).id
        return {
            'type': 'ir.actions.act_window',
            'name': _('New Incident Case'),
            'res_model': self._name,
            'view_mode': 'form',
            'views': [
                    (form_view_id, 'form')
                ],
            'target': 'new',
            'context': {
                'default_reporter_id': self.env.user.id,
            },
        }
    
    def button_next_step(self):
        if self.workflow_status == '4':
            self.workflow_status = '5'
            self.action_report_disciplinary()
            # open the submitted record 
            return self.open_record('new')
        else:
            if self.workflow_status == '1':
                self.workflow_status = '2'
            elif self.workflow_status == '2':
                self.workflow_status = '3'
            elif self.workflow_status == '3':
                self.workflow_status = '4'
            elif self.workflow_status == '4':
                self.workflow_status = '4'
        
            form_view_id = self.env.ref(
                'hr_warning.hr_warning_dialog_form_view'
            ).id

            return {
                'type': 'ir.actions.act_window',
                'res_model': self._name,
                'res_id': self.id,

                'view_mode': 'form',

                'views': [
                    (form_view_id, 'form')
                ],

                'target': 'new',
            }

    def button_previous_step(self):
        if self.workflow_status == '2':
            self.workflow_status = '1'
        elif self.workflow_status == '3':
            self.workflow_status = '2'
        elif self.workflow_status == '4':
            self.workflow_status = '3'
        else:
            self.workflow_status='1'
        form_view_id = self.env.ref(
            'hr_warning.hr_warning_dialog_form_view'
        ).id

        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'res_id': self.id,

            'view_mode': 'form',

            'views': [
                (form_view_id, 'form')
            ],

            'target': 'new',
        }
    reporter_identity_recorded = fields.Boolean("Identity recorded")

    # 

    kanban_state = fields.Selection(
        selection=[
            ('normal', 'In Progress'),
            ('done', 'Ready for Next Stage'),
            ('blocked', 'Blocked'),
        ],
        string='Kanban State',
        default='normal',
        tracking=True,
        copy=False,
    )

    # ── Investigation ─────────────────────────────────────────────────────────
    investigator_id = fields.Many2one(
        comodel_name='res.users',
        string='Assigned Investigator',
        tracking=True,
        domain=[('share', '=', False)],
    )
    investigation_note = fields.Text(
        string='Investigation Note',
        tracking=True,
    )
    date_assigned = fields.Date(
        string='Date Assigned',
        readonly=True,
        copy=False,
    )
    date_closed = fields.Date(
        string='Date Closed',
        readonly=True,
        copy=False,
    )
    confirm_option = fields.Boolean(
        string='Confirm',
        readonly=False,
        copy=False,
    )

    # ── Attachments (evidence) ────────────────────────────────────────────────
    evidence_ids = fields.Many2many(
        comodel_name='ir.attachment',
        relation='hr_warning_evidence_rel',
        column1='warning_id',
        column2='attachment_id',
        string='Evidence / Attachments',
    )
    evidence_count = fields.Integer(
        string='Evidence Count',
        compute='_compute_evidence_count',
    )

    # ── Company ───────────────────────────────────────────────────────────────
    company_id = fields.Many2one(
        comodel_name='res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
    )

    def action_hr_warning_evidence(self):
        pass 

    def open_record(self, target='new'):
        return {
            'type': 'ir.actions.act_window',
            'res_model': self._name,
            'view_mode': 'form',
            'res_id': self.id,
            'target': target,
            'view_id': self.env.ref('hr_warning.hr_warning_form_view').id,
        }

    def action_approve(self):

        self.write({
            'state': 'pending_approval'
        })

    appeal_description = fields.Text(
        string="Appeal Note",
    )
    appeal_date = fields.Date(
        string="Appeal Date",
    )
    appeal_state = fields.Selection(
        selection=[
            ('appealled', 'Appealled'),
            ('review', 'Under Review'),
            ('resolution', 'Resolution'),
            ('cancelled', 'Cancelled'),
        ],
        string='Appeal Status',
        default='appealled',
        tracking=True,
        copy=False,
    )
    appeal_officer_ids = fields.Many2many(
        'hr.employee',
        'hr_warning_appeal_employee_rel',
        'hr_warning_appeal_employee_id',
        'warning_appeal_id',
        string='Appeal Officers',
    )

    def action_appeal(self):

        self.write({
            'state': 'appeal'
        })

    def action_resolve(self):
        self.write({
            'state': 'resolution'
        })

    def action_appeal_case(self):
        rec_ids = self.env.context.get('active_ids', [])
        tree_view_id = self.env.ref(
                'hr_warning.hr_warning_appeal_tree_view'
            ).id
        for rec in rec_ids:
            record = self.env['hr.warning'].browse([rec])
            record.state = 'appeal'
        return {
            'type': 'ir.actions.act_window',
            'name': _('Appeal Case'),
            'res_model': self._name,
            'view_mode': 'tree,form',
            'views': [
                    (tree_view_id, 'tree')
                ],
            'context': {
                'default_appeal_state': 'review',
                'default_employee_id': self.employee_id.id,
                'default_employee_id': self.employee_id.id,
                'default_warning_id': self.warning_id.id,
                'default_case_type_id': self.case_type_id.id,
                'default_employee_id': self.employee_id.id,
                },
            'target': 'new',
            # 'domain': [('id', 'in', rec_ids)]
        }

            
    # ─────────────────────────────────────────────────────────────────────────
    # Defaults & group expand
    # ─────────────────────────────────────────────────────────────────────────

    def _default_stage(self):
        stage = self.env['hr.warning.stage'].search(
            [('is_initial', '=', True)], limit=1
        )
        return stage or self.env['hr.warning.stage'].search([], limit=1)

    @api.model
    def _read_group_stage_ids(self, stages, domain, order):
        return stages.search([], order=order)

    # ─────────────────────────────────────────────────────────────────────────
    # Computed fields
    # ─────────────────────────────────────────────────────────────────────────

    @api.depends('employee_id.birthday')
    def _compute_tenure(self):
        today = date.today()
        for rec in self:
            date_start = rec.employee_id.birthday if rec.employee_id else False
            if date_start:
                delta = relativedelta(today, date_start)
                parts = []
                if delta.years:
                    parts.append(f"{delta.years} Year{'s' if delta.years > 1 else ''}")
                if delta.months:
                    parts.append(f"{delta.months} Month{'s' if delta.months > 1 else ''}")
                rec.tenure = ', '.join(parts) if parts else '< 1 Month'
            else:
                rec.tenure = '—'

    @api.depends('evidence_ids')
    def _compute_evidence_count(self):
        for rec in self:
            rec.evidence_count = len(rec.evidence_ids)

    # ─────────────────────────────────────────────────────────────────────────
    # ORM overrides
    # ─────────────────────────────────────────────────────────────────────────

    @api.model_create_multi
    def create(self, vals_list):
        for vals in vals_list:
            if vals.get('name', _('New')) == _('New'):
                vals['name'] = self.env['ir.sequence'].next_by_code(
                    'hr.warning'
                ) or _('New')
        records = super().create(vals_list)
        for rec in records:
            # Notify approvers of the initial stage
            rec._notify_stage_approvers()
        return records

    audit_trail_desc = fields.Text("Audit Trail")

    def update_audit_trail(self, event_msg):
        old_desc = self.audit_trail_desc or ""
        current_time = datetime.now()
        self.audit_trail_desc = old_desc +'\n' + f"{self.env.user.name.capitalize()}: {event_msg} - Date: {datetime.strftime(current_time, '%d/%m/%Y %H:%M:%S')}"

    def write(self, vals):
        stage_changing = 'stage_id' in vals
        result = super().write(vals)
        if stage_changing:
            for rec in self:
                rec._sync_state_from_stage()
                # rec._notify_stage_approvers()
                # Track investigator assignment date
                if rec.investigator_id and not rec.date_assigned:
                    rec.date_assigned = fields.Date.today()
                # Track close date
                if rec.stage_id.is_closed and not rec.date_closed:
                    rec.date_closed = fields.Date.today()
        return result

    # ─────────────────────────────────────────────────────────────────────────
    # Stage / state helpers
    # ─────────────────────────────────────────────────────────────────────────

    def _sync_state_from_stage(self):
        """Keep state in sync with the current stage."""
        for rec in self:
            if rec.stage_id.is_closed:
                rec.state = 'closed'
            elif rec.stage_id.is_initial:
                rec.state = 'draft'
            else:
                # Use sequence position to infer state
                all_stages = self.env['hr.warning.stage'].search(
                    [], order='sequence'
                )
                stage_list = all_stages.ids
                current_idx = (
                    stage_list.index(rec.stage_id.id)
                    if rec.stage_id.id in stage_list else 0
                )
                if current_idx == 0:
                    rec.state = 'draft'
                elif current_idx == len(stage_list) - 1:
                    rec.state = 'closed'
                else:
                    rec.state = 'under_investigation'

    # ─────────────────────────────────────────────────────────────────────────
    # Email notifications
    # ─────────────────────────────────────────────────────────────────────────

    def _notify_stage_approvers(self):
        """
        Send an email to every approver configured on the current stage.
        Uses the stage's own mail template if set, otherwise falls back
        to the module-level default template.
        """
        for rec in self:
            stage = rec.stage_id
            if not stage or not stage.approver_ids:
                continue

            # Resolve template: stage-level → module default
            template = stage.mail_template_id
            if not template:
                template = self.env.ref(
                    'hr_warning.mail_template_hr_warning_stage_notify',
                    raise_if_not_found=False,
                )

            if not template:
                _logger.warning(
                    'hr.warning: no mail template found for stage %s', stage.name
                )
                continue
            approver_ids = stage.approver_ids | self.investigator_id
            for approver in stage.approver_ids:
                try:
                    template.with_context(
                        approver_name=approver.name,
                        lang=approver.lang,
                    ).send_mail(
                        rec.id,
                        force_send=True,
                        email_values={'email_to': approver.email},
                    )
                except Exception as exc:
                    _logger.error(
                        'hr.warning: failed to send mail to %s: %s',
                        approver.email, exc,
                    )

            # Chatter log
            approver_names = ', '.join(stage.approver_ids.mapped('name'))
            rec.message_post(
                body=_(
                    'Stage changed to <b>%(stage)s</b>. '
                    'Notification sent to: %(approvers)s.',
                    stage=stage.name,
                    approvers=approver_names,
                ),
                subtype_xmlid='mail.mt_note',
            )

    # ─────────────────────────────────────────────────────────────────────────
    # Button actions
    # ─────────────────────────────────────────────────────────────────────────
    def validate_approvers(self, stage_obj):
        if stage_obj.is_initial:
            # raise ValidationError("B1")

            pass 
        elif stage_obj.is_closed:
            # raise ValidationError("B2")

            if self.env.uid not in self.stage_id.approver_ids.ids or []:
                raise UserError("You are not allowed to close on this incident ")
                # return self.return_display_notice(
                #     title="User right",
                #     message="You are not allowed to close on this incident",
                #     typeof="danger",
                #     sticky=False
                # )
                 
        else:

            if self.env.uid not in stage_obj.approver_ids.ids or []:
                raise UserError("You are not allowed to approve this record because you are not an approver ")

            #     return self.return_display_notice(
            #         title="User right",
            #         message="You are not allowed to approve this record because you are not an approver ",
            #         typeof="danger",
            #         sticky=False
            #     )
            # else:
            #     raise ValidationError("B4")
 

    def action_submit_incident(self):
        if self.create_uid.id != self.env.user.id:
            return self.return_display_notice(
                title="Validation",
                message="You are not allowed to Submit record not created by you",
                typeof="danger",
                sticky=False
            )
        self.submit_feature()
        return {'type': 'ir.actions.client', 'tag': 'reload',}

    def return_display_notice(self, title="Notification", message="-", typeof='success', sticky=False):
        return {
                'type': 'ir.actions.client',
                'tag': 'display_notification',
                    'params': {
                        'title': _(title),
                        'message':  _(message),
                        'type': typeof,
                        'sticky': sticky
                    }
            }
    def action_report_disciplinary(self):
        self.ensure_one()

        if not self.confirm_option:
            return {
                    'type': 'ir.actions.client',
                    'tag': 'display_notification',
                        'params': {
                            'title': _('Confirm'),
                            'message': _(f'Please check the consent box before proceeding'),
                            'type': 'success',
                            'sticky': False
                        }
                }
        if self.create_uid.id != self.env.user.id:
            return self.return_display_notice(
                title="Validation",
                message="You are not allowed to Submit record not created by you",
                typeof="danger",
                sticky=False
            )
        self.submit_feature()

    def submit_feature(self):
        if self.stage_id.is_closed:
            next_stage = self.env['hr.warning.stage'].search(
            [('is_initial', '=', True)],
            order='sequence',
            limit=1,
            )

        else:
            next_stage = self.env['hr.warning.stage'].search(
            [('sequence', '>', self.stage_id.sequence)],
            order='sequence',
            limit=1,
            )
        
        if not next_stage:
            raise UserError(_(f'No next stage defined. Please contact admin to configure stages.'))
        self.stage_id = next_stage
        self.state = 'pending_approval'
        self.update_audit_trail(f'This record was submitted ')

    def action_start_investigation(self):
        """Move to the next stage after the initial one."""
        self.ensure_one()

        next_stage = self.env['hr.warning.stage'].search(
            [('sequence', '>', self.stage_id.sequence)],
            order='sequence',
            limit=1,
        )
        self.validate_approvers(self.stage_id)

        if not next_stage:
            raise UserError(_(f'No next stage defined. Please contact admin to configure {next_stage.name} stages.'))
        self.stage_id = next_stage
        self.state = 'under_investigation'
        self.update_audit_trail(f'This record was updated to under investigation')


    def action_move_next_stage(self):
        """Advance the incident to the immediately next stage."""
        self.ensure_one()
        if self.stage_id.is_closed:
            next_stage = self.env['hr.warning.stage'].search(
            [('is_initial', '=', True)],
            order='sequence',
            limit=1,
            )

        else:
            next_stage = self.env['hr.warning.stage'].search(
                [('sequence', '>', self.stage_id.sequence)],
                order='sequence',
                limit=1,
            )
        if not next_stage:
            raise UserError(_('This incident is already at the final stage.'))
        self.validate_approvers(self.stage_id)
        if next_stage.is_closed:
            if not self.interim_measure_ids.ids:
                raise ValidationError("Please Endevour to provide interim Measure")
        self.stage_id = next_stage
        self.update_audit_trail(f'This record was updated to {self.stage_id.name}')

    def action_close_case(self):
        """Close the incident: jump to the configured closed stage."""
        self.ensure_one()
        closed_stage = self.env['hr.warning.stage'].search(
            [('is_closed', '=', True)], order='sequence', limit=1
        )
        if not closed_stage:
            raise UserError(
                _(
                    'No closed stage is configured. '
                    'Please mark a stage as "Closed Stage" in the stage configuration.'
                )
            )
        self.stage_id = closed_stage
        self.state = 'closed'
        self.date_closed = fields.Date.today()
        # self.message_post(
        #     body=_('Case has been <b>closed</b>.'),
        #     subtype_xmlid='mail.mt_note',
        # )

    def action_cancel(self):
        self.ensure_one()
        if self.state == 'closed':
            raise UserError(_('A closed case cannot be cancelled.'))
        self.state = 'cancelled'
        self.message_post(
            body=_('Case has been <b>cancelled</b>.'),
            subtype_xmlid='mail.mt_note',
        )

    def action_reopen(self):
        """Reopen a cancelled case back to draft."""
        self.ensure_one()
        initial_stage = self.env['hr.warning.stage'].search(
            [('is_initial', '=', True)], limit=1
        )
        self.stage_id = initial_stage or self.env['hr.warning.stage'].search(
            [], order='sequence', limit=1
        )
        self.state = 'draft'
        self.date_closed = False
        # self.message_post(
        #     body=_('Case has been <b>reopened</b>.'),
        #     subtype_xmlid='mail.mt_note',
        # )

    def action_assign_investigator(self):
        """Open a wizard-like dialog to assign an investigator (quick action)."""
        return {
            'type': 'ir.actions.act_window',
            'name': _('Assign Investigator'),
            'res_model': 'hr.warning',
            'res_id': self.id,
            'view_mode': 'form',
            'view_id': self.env.ref('hr_warning.hr_warning_form_view').id,
            'target': 'current',
        }

    def action_email_employee(self):
        """Open the compose mail wizard pre-filled for the employee."""
        self.ensure_one()
        template = self.env.ref(
            'hr_warning.mail_template_hr_warning_employee_notify',
            raise_if_not_found=False,
        )
        return {
            'type': 'ir.actions.act_window',
            'name': _('Email Employee'),
            'res_model': 'mail.compose.message',
            'view_mode': 'form',
            'target': 'new',
            'context': {
                'default_model': 'hr.warning',
                'default_res_ids': [self.id],
                'default_template_id': template.id if template else False,
                'default_composition_mode': 'comment',
            },
        }

    def action_view_employee_profile(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'name': _('Employee Profile'),
            'res_model': 'hr.employee',
            'res_id': self.employee_id.id,
            'view_mode': 'form',
            'target': 'current',
        }

    def action_generate_document(self):
        """
        Placeholder: generate an action document (report / PDF).
        Wire to an actual ir.actions.report record in your report XML.
        """
        self.ensure_one()
        report = self.env.ref(
            'hr_warning.action_report_hr_warning',
            raise_if_not_found=False,
        )
        if report:
            return report.report_action(self)
        raise UserError(
            _('No report template configured. Please link a report to this action.')
        )

    # ─────────────────────────────────────────────────────────────────────────
    # Constraints
    # ─────────────────────────────────────────────────────────────────────────

    @api.constrains('date_incident')
    def _check_incident_date(self):
        for rec in self:
            if rec.date_incident and rec.date_incident > fields.Datetime.now():
                raise ValidationError(
                    _('The date of incident cannot be in the future.')
                )

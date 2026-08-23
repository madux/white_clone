# -*- coding: utf-8 -*-
from odoo import models, fields
from odoo.tools import html_escape


class HRStaffDirectorySegment(models.Model):
    """A saved set of filter conditions over the Staff Directory people list.

    Criteria are the source of truth; ``member_ids`` is a materialized cache
    of the last computation (refreshed whenever the segment is opened or its
    members are acted upon) so downstream consumers (bulk email, future
    Cleon AI analytics) get fast, stable ID sets without staleness risk.
    """
    _name = 'hr.staff.directory.segment'
    _inherit = ['staff_directory.sync.mixin']
    _description = 'Staff Directory Saved Segment'
    _order = 'name asc'

    name = fields.Char(string='Segment Name', required=True)
    color = fields.Char(string='Color', default='#F59E0B')
    icon = fields.Char(string='Icon', default='users')
    conditions = fields.Text(string='Conditions (JSON)', default='[]')
    user_id = fields.Many2one('res.users', string='User', required=True, default=lambda self: self.env.user, ondelete='cascade')
    member_ids = fields.Many2many(
        'hr.employee',
        'sdir_segment_member_rel',
        'segment_id',
        'employee_id',
        string='Cached Members',
    )
    members_computed_on = fields.Datetime(string='Members Computed On')

    # ─── Member Cache ────────────────────────────────────────────────────────

    def _compute_member_ids(self):
        """Re-run the condition engine and persist the resulting roster."""
        self.ensure_one()
        Employee = self.env['hr.employee']
        people = Employee._sd_people_list()
        filtered = Employee._apply_segment_conditions(people, self.conditions)
        employees = Employee.browse([p['id'] for p in filtered]).exists()
        self._refresh_members(employees)
        return employees

    def _refresh_members(self, employees):
        # sdir_no_notify: cache maintenance must not trigger the real-time
        # broadcast (the mixin would otherwise reload every open dashboard).
        self.with_context(sdir_no_notify=True).write({
            'member_ids': [(6, 0, employees.ids)],
            'members_computed_on': fields.Datetime.now(),
        })

    # ─── Actions ─────────────────────────────────────────────────────────────

    def action_email_members(self, subject, body_text):
        """Recompute members, refresh the cache and email all of them.

        Returns a stats dict so the UI can report exact results
        (including employees without a work email).
        """
        self.ensure_one()
        employees = self._compute_member_ids()
        return self._send_emails_to_employees(employees, subject, body_text)

    def _send_emails_to_employees(self, employees, subject, body_text):
        """Send one email per employee. Shared by segment emails and the
        People-list selection email (called via hr.employee.email_employees).
        """
        seen, recipients, skipped_no_email = set(), [], 0
        for emp in employees.exists():
            email = (emp.work_email or '').strip()
            if not email or email.lower() in seen:
                if not email:
                    skipped_no_email += 1
                continue
            seen.add(email.lower())
            recipients.append({'email': email, 'name': emp.name})

        if not recipients:
            return {
                'sent': 0,
                'failed': 0,
                'skipped_no_email': skipped_no_email,
                'total': len(employees),
            }

        body_html = '<div>%s</div>' % html_escape(body_text or '').replace('\n', '<br/>')
        author_partner = self.env.user.partner_id
        Mail = self.env['mail.mail'].sudo()
        mails = Mail.create([{
            'subject': subject or '(No subject)',
            'body_html': body_html,
            'email_to': r['email'],
            'recipient_ids': [],
            'author_id': author_partner.id,
        } for r in recipients])

        sent, failed = 0, 0
        for mail in mails:
            try:
                if mail.send(raise_exception=False):
                    sent += 1
                else:
                    failed += 1
            except Exception:
                failed += 1

        return {
            'sent': sent,
            'failed': failed,
            'skipped_no_email': skipped_no_email,
            'total': len(recipients) + skipped_no_email,
        }

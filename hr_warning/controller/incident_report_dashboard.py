# -*- coding: utf-8 -*-
# hr_warning/controllers/report_api.py

import json
from datetime import datetime, timedelta
from dateutil.relativedelta import relativedelta

from odoo import http, fields
from odoo.http import request

from odoo.tools import file_path
from odoo.modules.module import get_resource_path


class HrWarningReportController(http.Controller):
    """
    JSON API endpoints consumed by the Reports & Analytics dashboard.
    All routes are prefixed with /hr_warning/report/.
    """

    # ── helpers ──────────────────────────────────────────────────────────────

    @staticmethod
    def _json_response(data):
        return request.make_response(
            json.dumps(data, default=str),
            headers=[('Content-Type', 'application/json')],
        )

    @http.route('/incident-reporting', type='http', auth='user', website=False)
    def dashboard_incident_index(self, **kw):
        # Get actual file path inside the module
        file_path = get_resource_path(
            'hr_warning',  # your module name
            'static/src/html',          # folder path inside module
            'incident_report_dashboard.html'          # file name
        )
        if not file_path:
            return "File not found."

        # Read HTML file content
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()
        user = request.env.user
        data = {
            'user_id':   user.id,
            'user_name': user.name,
            'user_email': user.email or '',
        }
        # Return raw HTML content
        return request.make_response(
            html,
            # headers=[('Content-Type', 'text/html'),('defaultData', json.dumps(data))],
            headers=[('Content-Type', 'text/html'),('defaultData', json.dumps(data))],
        )

    # ── KPI cards ─────────────────────────────────────────────────────────────

    @http.route('/hr_warning/report/kpis', type='http', auth='user', methods=['GET'], csrf=False)
    def get_kpis(self, **kwargs):
        """
        Returns the six KPI card values:
          - total_cases_ytd
          - avg_resolution_days
          - repeat_offenders
          - pending_actions
          - sla_compliance_pct
          - appeal_rate_pct
        """
        Warning = request.env['hr.warning']
        today = fields.Date.today()
        year_start = today.replace(month=1, day=1)

        # Total cases YTD
        ytd_domain = [('date_incident', '>=', datetime(today.year, 1, 1))]
        total_ytd = Warning.search_count(ytd_domain)

        # Avg resolution time (days between date_incident and date_closed)
        closed = Warning.search([
            ('state', '=', 'closed'),
            ('date_closed', '!=', False),
            ('date_incident', '!=', False),
        ])
        if closed:
            deltas = []
            for w in closed:
                inc = w.date_incident.date() if isinstance(w.date_incident, datetime) else w.date_incident
                cls = w.date_closed if not isinstance(w.date_closed, datetime) else w.date_closed.date()
                deltas.append((cls - inc).days)
            avg_days = round(sum(deltas) / len(deltas))
        else:
            avg_days = 0

        # Repeat offenders: employees with > 1 incident in the last 12 months
        twelve_ago = datetime.now() - relativedelta(months=12)
        repeat_domain = [('date_incident', '>=', twelve_ago)]
        repeat_warnings = Warning.read_group(
            repeat_domain, ['employee_id'], ['employee_id']
        )
        repeat_offenders = sum(
            1 for r in repeat_warnings if r['employee_id_count'] > 1
        )

        # Pending actions: open incidents not yet closed/cancelled
        pending = Warning.search_count([
            ('state', 'not in', ['closed', 'cancelled']),
        ])

        # SLA compliance: closed within 30 days / total closed (YTD)
        closed_ytd = Warning.search([
            ('state', '=', 'closed'),
            ('date_closed', '!=', False),
            ('date_incident', '!=', False),
            ('date_incident', '>=', datetime(today.year, 1, 1)),
        ])
        sla_days = 30
        if closed_ytd:
            compliant = sum(
                1 for w in closed_ytd
                if (
                    (w.date_closed if not isinstance(w.date_closed, datetime) else w.date_closed.date()) -
                    (w.date_incident.date() if isinstance(w.date_incident, datetime) else w.date_incident)
                ).days <= sla_days
            )
            sla_pct = round(compliant / len(closed_ytd) * 100)
        else:
            sla_pct = 0

        # Appeal rate: % of cases that were appealed (has appeal record or tag)
        # Approximate: severity_level == 'Gross Misconduct' treated as appealed
        appealed = Warning.search_count([
            ('severity_level', '=', 'Gross Misconduct'),
            ('date_incident', '>=', datetime(today.year, 1, 1)),
        ])
        appeal_pct = round(appealed / total_ytd * 100) if total_ytd else 0

        return self._json_response({
            'total_cases_ytd': total_ytd,
            'avg_resolution_days': avg_days,
            'repeat_offenders': repeat_offenders,
            'pending_actions': pending,
            'sla_compliance_pct': sla_pct,
            'appeal_rate_pct': appeal_pct,
        })

    # ── Monthly trend chart (last 6 months) ───────────────────────────────────

    @http.route('/hr_warning/report/monthly_trend', type='http', auth='user', methods=['GET'], csrf=False)
    def monthly_trend(self, **kwargs):
        """
        Returns monthly counts for the last 6 months, split by:
          incidents_submitted, incidents_resolved,
          grievances_submitted, grievances_resolved
        Uses incident_type to distinguish grievances (harassment) vs incidents.
        """
        Warning = request.env['hr.warning']
        today = fields.Date.today()
        labels = []
        incidents_submitted = []
        incidents_resolved = []
        grievances_submitted = []
        grievances_resolved = []

        grievance_types = ['harassment']

        for i in range(5, -1, -1):
            month_start = (today.replace(day=1) - relativedelta(months=i))
            month_end = month_start + relativedelta(months=1) - timedelta(days=1)
            labels.append(month_start.strftime('%b'))

            ms_dt = datetime(month_start.year, month_start.month, 1)
            me_dt = datetime(month_end.year, month_end.month, month_end.day, 23, 59, 59)

            # Incidents submitted (non-grievance)
            inc_sub = Warning.search_count([
                ('date_incident', '>=', ms_dt),
                ('date_incident', '<=', me_dt),
                ('incident_type', 'not in', grievance_types),
            ])

            # Incidents resolved
            inc_res = Warning.search_count([
                ('date_closed', '>=', ms_dt),
                ('date_closed', '<=', me_dt),
                ('state', '=', 'closed'),
                ('incident_type', 'not in', grievance_types),
            ])

            # Grievances submitted
            grv_sub = Warning.search_count([
                ('date_incident', '>=', ms_dt),
                ('date_incident', '<=', me_dt),
                ('incident_type', 'in', grievance_types),
            ])

            # Grievances resolved
            grv_res = Warning.search_count([
                ('date_closed', '>=', ms_dt),
                ('date_closed', '<=', me_dt),
                ('state', '=', 'closed'),
                ('incident_type', 'in', grievance_types),
            ])

            incidents_submitted.append(inc_sub)
            incidents_resolved.append(inc_res)
            grievances_submitted.append(grv_sub)
            grievances_resolved.append(grv_res)

        return self._json_response({
            'labels': labels,
            'datasets': {
                'incidents_submitted': incidents_submitted,
                'incidents_resolved': incidents_resolved,
                'grievances_submitted': grievances_submitted,
                'grievances_resolved': grievances_resolved,
            },
        })

    # ── Incident reports tab ───────────────────────────────────────────────────

    @http.route('/hr_warning/report/incidents', type='http', auth='user', methods=['GET'], csrf=False)
    def incident_report(self, **kwargs):
        """
        Returns a breakdown of incidents by type and severity for the current year.
        """
        Warning = request.env['hr.warning']
        today = fields.Date.today()
        year_start = datetime(today.year, 1, 1)

        by_type = Warning.read_group(
            [('date_incident', '>=', year_start)],
            ['incident_type'],
            ['incident_type'],
        )
        by_severity = Warning.read_group(
            [('date_incident', '>=', year_start), ('severity_level', '!=', False)],
            ['severity_level'],
            ['severity_level'],
        )
        by_case_type = Warning.read_group(
            [('date_incident', '>=', year_start), ('case_type_id', '!=', False)],
            ['case_type_id'],
            ['case_type_id'],
        )

        return self._json_response({
            'by_type': [
                {'label': r['incident_type'], 'count': r['incident_type_count']}
                for r in by_type
            ],
            'by_severity': [
                {'label': r['severity_level'], 'count': r['severity_level_count']}
                for r in by_severity
            ],
            'by_case_type': [
                {'label': r['case_type_id'][1] if r['case_type_id'] else 'None', 'count': r['case_type_id_count']}
                for r in by_case_type
            ],
        })

    # ── Grievance reports tab ──────────────────────────────────────────────────

    @http.route('/hr_warning/report/grievances', type='http', auth='user', methods=['GET'], csrf=False)
    def grievance_report(self, **kwargs):
        """
        Grievance-specific breakdown (incident_type = harassment).
        """
        Warning = request.env['hr.warning']
        today = fields.Date.today()
        year_start = datetime(today.year, 1, 1)

        domain = [
            ('incident_type', '=', 'harassment'),
            ('date_incident', '>=', year_start),
        ]
        total = Warning.search_count(domain)
        resolved = Warning.search_count(domain + [('state', '=', 'closed')])
        pending = Warning.search_count(domain + [('state', 'not in', ['closed', 'cancelled'])])

        by_month = []
        for i in range(5, -1, -1):
            month_start = (today.replace(day=1) - relativedelta(months=i))
            month_end = month_start + relativedelta(months=1) - timedelta(days=1)
            ms_dt = datetime(month_start.year, month_start.month, 1)
            me_dt = datetime(month_end.year, month_end.month, month_end.day, 23, 59, 59)
            count = Warning.search_count([
                ('incident_type', '=', 'harassment'),
                ('date_incident', '>=', ms_dt),
                ('date_incident', '<=', me_dt),
            ])
            by_month.append({'month': month_start.strftime('%b'), 'count': count})

        return self._json_response({
            'total': total,
            'resolved': resolved,
            'pending': pending,
            'by_month': by_month,
        })

    # ── Compliance tab ─────────────────────────────────────────────────────────

    @http.route('/hr_warning/report/compliance', type='http', auth='user', methods=['GET'], csrf=False)
    def compliance_report(self, **kwargs):
        """
        SLA compliance stats and overdue cases.
        """
        Warning = request.env['hr.warning']
        today = fields.Date.today()
        sla_days = 30

        open_cases = Warning.search([('state', 'not in', ['closed', 'cancelled'])])
        overdue = []
        for w in open_cases:
            inc = w.date_incident.date() if isinstance(w.date_incident, datetime) else w.date_incident
            if inc and (today - inc).days > sla_days:
                overdue.append({
                    'name': w.name,
                    'employee': w.employee_id.name if w.employee_id else '',
                    'days_open': (today - inc).days,
                    'stage': w.stage_id.name if w.stage_id else '',
                })

        closed_ytd = Warning.search([
            ('state', '=', 'closed'),
            ('date_closed', '!=', False),
            ('date_incident', '!=', False),
            ('date_incident', '>=', datetime(today.year, 1, 1)),
        ])
        compliant_count = 0
        for w in closed_ytd:
            inc = w.date_incident.date() if isinstance(w.date_incident, datetime) else w.date_incident
            cls = w.date_closed if not isinstance(w.date_closed, datetime) else w.date_closed.date()
            if (cls - inc).days <= sla_days:
                compliant_count += 1

        total_closed = len(closed_ytd)

        return self._json_response({
            'sla_compliance_pct': round(compliant_count / total_closed * 100) if total_closed else 0,
            'total_closed_ytd': total_closed,
            'compliant_count': compliant_count,
            'overdue_cases': overdue,
            'overdue_count': len(overdue),
        })

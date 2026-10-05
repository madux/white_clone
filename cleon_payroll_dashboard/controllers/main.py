# -*- coding: utf-8 -*-
import json
import calendar
from collections import defaultdict
from datetime import date, datetime, timedelta

from odoo import http
from odoo.http import request
from odoo.modules.module import get_resource_path

import logging
_logger = logging.getLogger(__name__)

# If your organization renamed cleon.location -> multi.branch (or any
# other model/field name), this list is checked in order so the
# dashboard degrades gracefully instead of crashing when the field
# doesn't exist yet.
BRANCH_FIELD_CANDIDATES = [
    "multi_branch_id",
    "branch_id",
    "cleon_location_id",
    "location_id",
]
BRANCH_MODEL_CANDIDATES = ["multi.branch", "cleon.location"]

SALARY_BANDS = [
    (0, 100000, "Under 100k"),
    (100000, 300000, "100k - 300k"),
    (300000, 500000, "300k - 500k"),
    (500000, 1000000, "500k - 1M"),
    (1000000, float("inf"), "1M+"),
]


class CleonPayrollDashboardController(http.Controller):

    # ------------------------------------------------------------------
    # Page
    # ------------------------------------------------------------------
    @http.route('/payroll-reporting', type='http', auth='user', website=False)
    def payroll_dashboard(self, **kw):
        """Serve the raw HTML dashboard shell. All data is fetched
        client-side via jQuery against the JSON endpoints below."""
        file_path = get_resource_path(
            'cleon_payroll_dashboard', 'static/html', 'payroll.html')
        if not file_path:
            return request.not_found()
        with open(file_path, 'r', encoding='utf-8') as f:
            html = f.read()

        data = {
            'user_name': request.env.user.name,
            'company_name': request.env.company.name,
            'is_manager': request.env.user.has_group(
                'cleon_payroll.group_payroll_manager'),
        }
        return request.make_response(
            html,
            headers=[
                ('Content-Type', 'text/html'),
                ('X-Dashboard-Data', json.dumps(data)),
            ],
        )

    # ------------------------------------------------------------------
    # Filter options
    # ------------------------------------------------------------------
    @http.route('/payroll-reporting/filters', type='http', auth='user', csrf=False)
    def get_filters(self, **kw):
        env = request.env
        branch_model = self._get_branch_model(env)

        locations = []
        if branch_model:
            for rec in env[branch_model].sudo().search_read([], ['id', 'name'], limit=200):
                locations.append({'id': rec['id'], 'name': rec['name']})

        departments = [
            {'id': d.id, 'name': d.name}
            for d in env['hr.department'].sudo().search([], limit=200)
        ]

        deduction_types = [
            {'id': c.id, 'code': c.code, 'name': c.name}
            for c in env['cleon.payroll.category'].sudo().search(
                [('code', 'in', ['DED', 'COOP', 'PENSION'])])
        ] or [
            {'id': c.id, 'code': c.code, 'name': c.name}
            for c in env['cleon.payroll.category'].sudo().search([], limit=50)
        ]

        structures = [
            {'id': s.id, 'name': s.name, 'code': s.code}
            for s in env['cleon.payroll.structure'].sudo().search([], limit=100)
        ]

        return self._json_response({
            'locations': locations,
            'departments': departments,
            'deduction_types': deduction_types,
            'structures': structures,
        })

    # ------------------------------------------------------------------
    # Main data endpoint
    # ------------------------------------------------------------------
    @http.route('/payroll-reporting/data', type='http', auth='user', csrf=False)
    def get_dashboard_data(self, location_id=None, department_id=None,
                            deduction_code=None, structure_id=None,
                            date_from=None, date_to=None, **kw):
        env = request.env
        filters = {
            'location_id': int(location_id) if location_id else None,
            'department_id': int(department_id) if department_id else None,
            'deduction_code': deduction_code or None,
            'structure_id': int(structure_id) if structure_id else None,
            'date_from': date_from or None,
            'date_to': date_to or None,
        }

        payslips = self._filtered_payslips(env, filters)

        result = {}
        sections = {
            'kpis': self._kpis,
            'net_vs_gross': self._net_vs_gross,
            'department_distribution': self._department_distribution,
            'monthly_trend': self._monthly_trend,
            'upcoming_payments': self._upcoming_payments,
            'compensation_breakdown': self._compensation_breakdown,
            'benefits_cost': self._benefits_cost,
            'overtime_expenses': self._overtime_expenses,
            'turnover_metrics': self._turnover_metrics,
            'compliance_status': self._compliance_status,
            'salary_bands': self._salary_bands,
            'pending_approvals': self._pending_approvals,
            'processing_status': self._processing_status,
            'tax_deductions': self._tax_deductions,
            'pension_contributions': self._pension_contributions,
            'approval_tracker': self._approval_tracker,
            'exceptions': self._payroll_exceptions,
            'deduction_summary': lambda e, p, f: self._deduction_summary(e, p, f),
        }
        for key, fn in sections.items():
            try:
                result[key] = fn(env, payslips, filters)
            except Exception:
                _logger.exception("Cleon Payroll Dashboard: section '%s' failed", key)
                result[key] = None

        return self._json_response(result)

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _json_response(self, data):
        return request.make_response(
            json.dumps(data, default=str),
            headers=[('Content-Type', 'application/json')],
        )

    def _get_branch_model(self, env):
        for model_name in BRANCH_MODEL_CANDIDATES:
            if model_name in env:
                return model_name
        return None

    def _get_branch_field(self, env):
        emp_fields = env['hr.employee']._fields
        for f in BRANCH_FIELD_CANDIDATES:
            if f in emp_fields:
                return f
        return None

    def _filtered_payslips(self, env, filters):
        Payslip = env['cleon.payslip'].sudo()
        domain = [('state', '!=', 'cancel')]

        if filters.get('date_from'):
            domain.append(('date_to', '>=', filters['date_from']))
        if filters.get('date_to'):
            domain.append(('date_from', '<=', filters['date_to']))
        if filters.get('structure_id'):
            domain.append(('structure_id', '=', filters['structure_id']))
        if filters.get('department_id'):
            domain.append(('employee_id.department_id', '=', filters['department_id']))
        if filters.get('location_id'):
            branch_field = self._get_branch_field(env)
            if branch_field:
                domain.append(('employee_id.%s' % branch_field, '=', filters['location_id']))

        payslips = Payslip.search(domain)

        if filters.get('deduction_code'):
            code = filters['deduction_code']
            payslips = payslips.filtered(
                lambda p: any(
                    l.code == code or (l.category_id and l.category_id.code == code)
                    for l in p.line_ids
                )
            )
        return payslips

    def _period_bounds(self, filters):
        """Default to trailing 12 months if no explicit range given."""
        today = date.today()
        d_from = filters.get('date_from')
        d_to = filters.get('date_to')
        if not d_to:
            d_to = today
        else:
            d_to = datetime.strptime(d_to, '%Y-%m-%d').date()
        if not d_from:
            d_from = d_to.replace(day=1) - timedelta(days=365)
        else:
            d_from = datetime.strptime(d_from, '%Y-%m-%d').date()
        return d_from, d_to

    # ------------------------------------------------------------------
    # Widget builders
    # ------------------------------------------------------------------
    def _kpis(self, env, payslips, filters):
        active_employees = env['hr.employee'].sudo().search_count([('active', '=', True)])
        return {
            'total_payroll_cost': sum(payslips.mapped('net_wage')),
            'total_gross': sum(payslips.mapped('gross_wage')),
            'total_deductions': sum(payslips.mapped('total_deduction')),
            'total_employer_contribution': sum(payslips.mapped('total_employer_contribution')),
            'employee_count': active_employees,
            'payslip_count': len(payslips),
            'avg_net_pay': (sum(payslips.mapped('net_wage')) / len(payslips)) if payslips else 0.0,
        }

    def _net_vs_gross(self, env, payslips, filters):
        return {
            'gross': sum(payslips.mapped('gross_wage')),
            'net': sum(payslips.mapped('net_wage')),
            'deductions': sum(payslips.mapped('total_deduction')),
            'employer_contributions': sum(payslips.mapped('total_employer_contribution')),
        }

    def _department_distribution(self, env, payslips, filters):
        totals = defaultdict(float)
        for p in payslips:
            dept = p.employee_id.department_id.name or 'Unassigned'
            totals[dept] += p.net_wage
        return [{'label': k, 'value': round(v, 2)} for k, v in
                sorted(totals.items(), key=lambda kv: -kv[1])]

    def _monthly_trend(self, env, payslips, filters):
        d_from, d_to = self._period_bounds(filters)
        buckets = {}
        cursor = d_from.replace(day=1)
        while cursor <= d_to:
            key = cursor.strftime('%Y-%m')
            buckets[key] = {'label': cursor.strftime('%b %Y'), 'gross': 0.0, 'net': 0.0, 'deductions': 0.0}
            if cursor.month == 12:
                cursor = cursor.replace(year=cursor.year + 1, month=1)
            else:
                cursor = cursor.replace(month=cursor.month + 1)

        for p in payslips:
            if not p.date_to:
                continue
            key = p.date_to.strftime('%Y-%m')
            if key in buckets:
                buckets[key]['gross'] += p.gross_wage
                buckets[key]['net'] += p.net_wage
                buckets[key]['deductions'] += p.total_deduction

        ordered_keys = sorted(buckets.keys())
        return {
            'labels': [buckets[k]['label'] for k in ordered_keys],
            'gross': [round(buckets[k]['gross'], 2) for k in ordered_keys],
            'net': [round(buckets[k]['net'], 2) for k in ordered_keys],
            'deductions': [round(buckets[k]['deductions'], 2) for k in ordered_keys],
        }

    def _upcoming_payments(self, env, payslips, filters):
        today = date.today()
        upcoming = payslips.filtered(
            lambda p: p.state in ('confirm', 'computed') and p.date_to and p.date_to >= today
        ).sorted(key=lambda p: p.date_to)[:10]
        return [{
            'employee': p.employee_id.name,
            'net_wage': p.net_wage,
            'date_to': p.date_to.strftime('%Y-%m-%d') if p.date_to else '',
            'state': p.state,
        } for p in upcoming]

    def _compensation_breakdown(self, env, payslips, filters):
        totals = defaultdict(float)
        for p in payslips:
            for line in p.line_ids:
                cat = line.category_id.name or 'Other'
                totals[cat] += line.total
        return [{'label': k, 'value': round(v, 2)} for k, v in
                sorted(totals.items(), key=lambda kv: -abs(kv[1]))]

    def _benefits_cost(self, env, payslips, filters):
        totals = defaultdict(float)
        for p in payslips:
            for line in p.line_ids:
                if line.rule_type == 'employer_contribution':
                    totals[line.name] += line.total
        return [{'label': k, 'value': round(v, 2)} for k, v in
                sorted(totals.items(), key=lambda kv: -kv[1])]

    def _overtime_expenses(self, env, payslips, filters):
        total = 0.0
        by_month = defaultdict(float)
        for p in payslips:
            for inp in p.input_line_ids:
                if inp.code == 'OVERTIME':
                    total += inp.amount
                    if p.date_to:
                        by_month[p.date_to.strftime('%b %Y')] += inp.amount
        return {
            'total': round(total, 2),
            'labels': list(by_month.keys()),
            'values': [round(v, 2) for v in by_month.values()],
        }

    def _turnover_metrics(self, env, payslips, filters):
        Employee = env['hr.employee'].sudo()
        active = Employee.search_count([('active', '=', True)])
        d_from, d_to = self._period_bounds(filters)
        left = Employee.with_context(active_test=False).search_count([
            ('active', '=', False),
            ('write_date', '>=', d_from),
            ('write_date', '<=', d_to),
        ])
        total = active + left
        rate = (left / total * 100.0) if total else 0.0
        return {
            'active_employees': active,
            'departed_employees': left,
            'turnover_rate': round(rate, 2),
        }

    def _compliance_status(self, env, payslips, filters):
        total = len(payslips)
        paid = len(payslips.filtered(lambda p: p.state == 'paid'))
        confirmed = len(payslips.filtered(lambda p: p.state == 'confirm'))
        draft = len(payslips.filtered(lambda p: p.state in ('draft', 'computed')))
        compliance_pct = (paid / total * 100.0) if total else 0.0
        return {
            'total': total,
            'paid': paid,
            'confirmed': confirmed,
            'draft_or_pending': draft,
            'compliance_pct': round(compliance_pct, 2),
        }

    def _salary_bands(self, env, payslips, filters):
        counts = {label: 0 for _, _, label in SALARY_BANDS}
        seen_employees = set()
        for p in payslips:
            if p.employee_id.id in seen_employees:
                continue
            seen_employees.add(p.employee_id.id)
            wage = p.basic_wage
            for lo, hi, label in SALARY_BANDS:
                if lo <= wage < hi:
                    counts[label] += 1
                    break
        return [{'label': label, 'value': counts[label]} for _, _, label in SALARY_BANDS]

    def _pending_approvals(self, env, payslips, filters):
        pending = payslips.filtered(lambda p: p.state == 'computed')
        return {
            'count': len(pending),
            'lines': [{
                'employee': p.employee_id.name,
                'net_wage': p.net_wage,
                'date_to': p.date_to.strftime('%Y-%m-%d') if p.date_to else '',
            } for p in pending[:15]],
        }

    def _processing_status(self, env, payslips, filters):
        Run = env['cleon.payslip.run'].sudo()
        runs = Run.search([], order='date_start desc', limit=10)
        return [{
            'name': r.name,
            'state': r.state,
            'date_start': r.date_start.strftime('%Y-%m-%d') if r.date_start else '',
            'date_end': r.date_end.strftime('%Y-%m-%d') if r.date_end else '',
            'slip_count': r.slip_count,
        } for r in runs]

    def _tax_deductions(self, env, payslips, filters):
        totals = defaultdict(float)
        for p in payslips:
            for line in p.line_ids:
                if line.rule_id.tax_id or (line.category_id and line.category_id.code == 'DED'):
                    totals[line.name] += line.total
        return [{'label': k, 'value': round(v, 2)} for k, v in
                sorted(totals.items(), key=lambda kv: -kv[1])]

    def _pension_contributions(self, env, payslips, filters):
        total = 0.0
        for p in payslips:
            for line in p.line_ids:
                if 'PENSION' in (line.code or '').upper() or (
                        line.category_id and line.category_id.code == 'EMPCONT'):
                    total += line.total
        return {'total': round(total, 2)}

    def _approval_tracker(self, env, payslips, filters):
        stages = ['draft', 'computed', 'confirm', 'paid']
        labels = {'draft': 'Draft', 'computed': 'Computed', 'confirm': 'Confirmed', 'paid': 'Paid'}
        counts = {s: len(payslips.filtered(lambda p, s=s: p.state == s)) for s in stages}
        return [{'stage': labels[s], 'count': counts[s]} for s in stages]

    def _payroll_exceptions(self, env, payslips, filters):
        issues = []
        for p in payslips:
            if not p.structure_id:
                issues.append({'employee': p.employee_id.name, 'issue': 'Missing payroll structure', 'payslip': p.name})
            if p.net_wage <= 0:
                issues.append({'employee': p.employee_id.name, 'issue': 'Net pay is zero or negative', 'payslip': p.name})
            if not p.contract_id:
                issues.append({'employee': p.employee_id.name, 'issue': 'Missing contract', 'payslip': p.name})
        return issues[:30]

    def _deduction_summary(self, env, payslips, filters):
        totals = defaultdict(float)
        for p in payslips:
            for line in p.line_ids:
                if line.rule_type == 'deduction':
                    key = line.category_id.name if line.category_id else line.name
                    totals[key] += line.total
        return [{'label': k, 'value': round(v, 2)} for k, v in
                sorted(totals.items(), key=lambda kv: -kv[1])]

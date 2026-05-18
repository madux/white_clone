# -*- coding: utf-8 -*-
import json
from datetime import date, datetime, timedelta
from odoo import http
from odoo.http import request
import logging
from odoo import fields
from odoo.tools import file_path
from odoo.modules.module import get_resource_path

class HRAdministrationController(http.Controller):
 
    @http.route('/hr-employee-admin', type='http', auth='user', website=False)
    def dashboard_index(self, **kw):
        # Get actual file path inside the module
        file_path = get_resource_path(
            'hr_administration',  # your module name
            'static/src/html',          # folder path inside module
            'employee_admin_view.html'          # file name
        )
        if not file_path:
            return "HTML file not found."

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
            headers=[('Content-Type', 'text/html'),('defaultData', json.dumps(data))],
            
        )

    # ─── Key Metrics ──────────────────────────────────────────────────────────

    @http.route('/hr_administration/api/metrics', type='json', auth='user')
    def get_metrics(self, **kwargs):
        """Return all key HR metric counts."""
        env = request.env
        today = date.today()
        last_month = today.replace(day=1) - timedelta(days=1)
        last_month_start = last_month.replace(day=1)

        # Total employees
        total_employees = env['hr.employee'].search_count([('active', '=', True)])
        last_month_employees = env['hr.employee'].search_count([
            ('active', '=', True),
            ('create_date', '<=', last_month_start.strftime('%Y-%m-%d 23:59:59')),
        ])

        # Active employees (not on leave today)
        on_leave_today = env['hr.leave.allocation'].search_count([]) or 0
        leaves_today = env['hr.leave'].search_count([
            ('state', '=', 'validate'),
            ('date_from', '<=', today.strftime('%Y-%m-%d 23:59:59')),
            ('date_to', '>=', today.strftime('%Y-%m-%d 00:00:00')),
        ])
        active_employees = total_employees - leaves_today

        # Pending requests (leave requests awaiting approval)
        pending_requests = env['hr.leave'].search_count([('state', '=', 'confirm')])

        # Disciplinary cases — use hr.warning if available, fallback gracefully
        try:
            disciplinary_cases = env['hr.warning'].search_count([('state', 'not in', ['draft', 'cancel'])])
        except Exception:
            disciplinary_cases = 0

        # Expiring contracts within 30 days
        in_30_days = today + timedelta(days=30)
        expiring_contracts = env['hr.contract'].search_count([
            ('state', '=', 'open'),
            ('date_end', '>=', today.strftime('%Y-%m-%d')),
            ('date_end', '<=', in_30_days.strftime('%Y-%m-%d')),
        ])

        # Pending approvals (leave + allocation combined)
        pending_approvals = env['hr.leave'].search_count([
            ('state', 'in', ['confirm', 'validate1'])
        ]) + env['hr.leave.allocation'].search_count([
            ('state', 'in', ['confirm', 'validate1'])
        ])

        # HMO enrollments — use hr.insurance or fallback
        try:
            hmo_enrollments = env['hr.insurance'].search_count([('active', '=', True)])
        except Exception:
            hmo_enrollments = env['hr.employee'].search_count([
                ('active', '=', True),
                #TODO ('private_medical_examination', '!=', False),
            ])

        # Assets overdue — use maintenance.equipment or fallback
        try:
            assets_overdue = env['maintenance.equipment'].search_count([
                ('employee_id', '!=', False),
                ('effective_date', '<', today.strftime('%Y-%m-%d')),
            ])
        except Exception:
            assets_overdue = 0

        def pct_change(current, previous):
            if previous == 0:
                return 0
            return round(((current - previous) / previous) * 100, 1)

        return {
            'total_employees': total_employees,
            'total_employees_change': pct_change(total_employees, last_month_employees or total_employees),
            'active_employees': active_employees,
            'on_leave_today': leaves_today,
            'pending_requests': pending_requests,
            'disciplinary_cases': disciplinary_cases,
            'expiring_contracts': expiring_contracts,
            'pending_approvals': pending_approvals,
            'hmo_enrollments': hmo_enrollments,
            'assets_overdue': assets_overdue,
        }

    # ─── Headcount Trend ─────────────────────────────────────────────────────

    @http.route('/hr_administration/api/headcount_trend', type='json', auth='user')
    def get_headcount_trend(self, months=6, **kwargs):
        """Return monthly headcount over the past N months."""
        env = request.env
        today = date.today()
        data = []
        categories = []

        for i in range(int(months) - 1, -1, -1):
            month_date = (today.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
            next_month = (month_date.replace(day=28) + timedelta(days=4)).replace(day=1)
            count = env['hr.employee'].search_count([
                ('active', '=', True),
                ('create_date', '<=', next_month.strftime('%Y-%m-%d 00:00:00')),
            ])
            data.append(count)
            categories.append(month_date.strftime('%b'))

        return {'categories': categories, 'data': data}

    # ─── Department Distribution ──────────────────────────────────────────────

    @http.route('/hr_administration/api/department_distribution', type='json', auth='user')
    def get_department_distribution(self, **kwargs):
        """Return employee count per department."""
        env = request.env
        departments = env['hr.department'].search([])
        result = []
        for dept in departments:
            count = env['hr.employee'].search_count([
                ('department_id', '=', dept.id),
                ('active', '=', True),
            ])
            if count > 0:
                result.append({'name': dept.name, 'y': count})

        # Employees without department
        no_dept = env['hr.employee'].search_count([
            ('department_id', '=', False),
            ('active', '=', True),
        ])
        if no_dept > 0:
            result.append({'name': 'Others', 'y': no_dept})

        return result

    # ─── Leave Utilization ────────────────────────────────────────────────────

    @http.route('/hr_administration/api/leave_utilization', type='json', auth='user')
    def get_leave_utilization(self, **kwargs):
        """Return leave utilization percentage per department."""
        env = request.env
        today = date.today()
        year_start = today.replace(month=1, day=1)
        departments = env['hr.department'].search([])
        result = []

        for dept in departments:
            employees = env['hr.employee'].search([
                ('department_id', '=', dept.id),
                ('active', '=', True),
            ])
            if not employees:
                continue
            total_allocated = sum(
                env['hr.leave.allocation'].search([
                    ('employee_id', 'in', employees.ids),
                    ('state', '=', 'validate'),
                    # ('holiday_status_id.leave_type', '=', 'allocation'),
                ]).mapped('number_of_days') or [0]
            )
            total_taken = sum(
                env['hr.leave'].search([
                    ('employee_id', 'in', employees.ids),
                    ('state', '=', 'validate'),
                    ('date_from', '>=', year_start.strftime('%Y-%m-%d 00:00:00')),
                ]).mapped('number_of_days') or [0]
            )
            if total_allocated > 0:
                pct = round((total_taken / total_allocated) * 100, 1)
            elif total_taken > 0:
                pct = 100
            else:
                pct = round((total_taken / max(len(employees) * 20, 1)) * 100, 1)

            result.append({
                'department': dept.name,
                'utilized': min(pct, 100),
                'remaining': max(100 - pct, 0),
            })

        return result

    # ─── Requires Attention ───────────────────────────────────────────────────

    @http.route('/hr_administration/api/attention_items', type='json', auth='user')
    def get_attention_items(self, **kwargs):
        """Return items that require HR attention."""
        env = request.env
        today = date.today()
        in_7_days = today + timedelta(days=7)
        in_30_days = today + timedelta(days=30)
        items = []

        # 1. Leave requests pending approval
        pending_leaves = env['hr.leave'].search_count([('state', 'in', ['confirm', 'draft'])])
        if pending_leaves:
            items.append({
                'priority': 'high',
                'title': 'Leave Requests Pending Approval',
                'description': f'{pending_leaves} urgent requests require immediate attention',
                'module': 'Leave Management',
                'count': pending_leaves,
                'route': '/app/leave',
            })

        # 2. Contracts expiring soon
        expiring = env['hr.contract'].search_count([
            ('state', '=', 'open'),
            ('date_end', '>=', today.strftime('%Y-%m-%d')),
            ('date_end', '<=', in_30_days.strftime('%Y-%m-%d')),
        ])
        if expiring:
            items.append({
                'priority': 'high',
                'title': 'Contracts Expiring in 30 Days',
                'description': f'{expiring} contracts expire within the next 7 days',
                'module': 'Workforce Lifecycle',
                'count': expiring,
                'route': '/app/employees',
            })

        # 3. Disciplinary cases
        try:
            disc_cases = env['hr.warning'].search_count([('state', 'not in', ['draft', 'cancel'])])
            if disc_cases:
                items.append({
                    'priority': 'medium',
                    'title': 'Disciplinary Cases Pending Action',
                    'description': f'{disc_cases} cases require immediate review',
                    'module': 'Disciplinary Management',
                    'count': disc_cases,
                    'route': '/app/employees',
                })
        except Exception:
            pass

        # 4. Assets overdue
        try:
            overdue_assets = env['maintenance.equipment'].search_count([
                ('employee_id', '!=', False),
                ('effective_date', '<', today.strftime('%Y-%m-%d')),
            ])
            if overdue_assets:
                items.append({
                    'priority': 'low',
                    'title': 'Assets Overdue for Return',
                    'description': f'{overdue_assets} laptops overdue by more than 7 days',
                    'module': 'Asset Management',
                    'count': overdue_assets,
                    'route': '/app/maintenance',
                })
        except Exception:
            pass

        # 5. HMO enrollment approvals
        pending_alloc = env['hr.leave.allocation'].search_count([
            ('state', 'in', ['confirm', 'validate1'])
        ])
        if pending_alloc:
            items.append({
                'priority': 'medium',
                'title': 'HMO Enrollment Approvals',
                'description': 'Pending enrollment approvals',
                'module': 'Health Insurance',
                'count': pending_alloc,
                'route': '/app/leave',
            })

        return items

    # ─── Upcoming Events ──────────────────────────────────────────────────────

    @http.route('/hr_administration/api/upcoming_events', type='json', auth='user')
    def get_upcoming_events(self, **kwargs):
        """Return upcoming HR-relevant events from calendar."""
        env = request.env
        today = date.today()
        in_30_days = today + timedelta(days=30)
        events = []

        try:
            cal_events = env['calendar.event'].search([
                ('start', '>=', today.strftime('%Y-%m-%d 00:00:00')),
                ('start', '<=', in_30_days.strftime('%Y-%m-%d 23:59:59')),
            ], limit=5, order='start asc')
            for ev in cal_events:
                events.append({
                    'name': ev.name,
                    'date': ev.start.strftime('%b %d, %Y') if ev.start else '',
                    'type': 'calendar',
                })
        except Exception:
            pass

        # Add expiring contract events
        expiring = env['hr.contract'].search([
            ('state', '=', 'open'),
            ('date_end', '>=', today.strftime('%Y-%m-%d')),
            ('date_end', '<=', in_30_days.strftime('%Y-%m-%d')),
        ], limit=3)
        for c in expiring:
            events.append({
                'name': f'Contract Expiry: {c.employee_id.name}',
                'date': c.date_end.strftime('%b %d, %Y') if c.date_end else '',
                'type': 'contract',
            })

        # Sort by date
        events = sorted(events, key=lambda x: x.get('date', ''))[:6]
        return events

    # ─── Employee List (for navigation) ──────────────────────────────────────

    @http.route('/hr_administration/api/employees', type='json', auth='user')
    def get_employees(self, domain=None, limit=20, offset=0, **kwargs):
        """Return paginated employee list."""
        env = request.env
        search_domain = [('active', '=', True)]
        if domain:
            search_domain += domain

        employees = env['hr.employee'].search(search_domain, limit=int(limit), offset=int(offset))
        total = env['hr.employee'].search_count(search_domain)

        result = []
        for emp in employees:
            result.append({
                'id': emp.id,
                'name': emp.name,
                'job_title': emp.job_title or '',
                'department': emp.department_id.name if emp.department_id else '',
                'work_email': emp.work_email or '',
                'active': emp.active,
                'image_url': f'/web/image/hr.employee/{emp.id}/image_128',
            })
        return {'employees': result, 'total': total}

# -*- coding: utf-8 -*-
import json
import logging
from odoo import http
from odoo.http import request
from odoo.modules.module import get_resource_path

_logger = logging.getLogger(__name__)


class HROrganisationChartController(http.Controller):

    @http.route('/organisation-chart', type='http', auth='user', website=False)
    def org_chart_index(self, **kw):
        """Serve the organisation chart HTML page."""
        html_file_path = get_resource_path(
            'hr_employee',
            'static/src/html',
            'employee_chart_view.html'
        )
        if not html_file_path:
            return "HTML file not found. Please ensure employee_chart_view.html exists."

        with open(html_file_path, 'r', encoding='utf-8') as f:
            html = f.read()

        user = request.env.user
        data = {
            'user_id': user.id,
            'user_name': user.name,
            'user_email': user.email or '',
            'csrf_token': request.csrf_token(),
            'company_name': user.company_id.name if user.company_id else '',
        }

        # Inject data directly into HTML
        html = html.replace('__DEFAULT_DATA__', json.dumps(data))

        return request.make_response(
            html,
            headers=[('Content-Type', 'text/html; charset=utf-8')],
        )

    @http.route('/organisation-chart/employees', type='json', auth='user', methods=['POST'], csrf=False)
    def get_employees(self, department_id=None, company_id=None, job_id=None, **kw):
        """Return employees filtered by optional department, company, or job."""
        domain = [('active', '=', True)]

        if department_id:
            domain.append(('department_id', '=', int(department_id)))
        if company_id:
            domain.append(('company_id', '=', int(company_id)))
        if job_id:
            domain.append(('job_id', '=', int(job_id)))

        employees = request.env['hr.employee'].sudo().search_read(
            domain,
            fields=[
                'id',
                'name',
                'job_id',
                'job_title',
                'parent_id',
                'department_id',
                'work_email',
                'employee_number',
                'work_phone',
                'mobile_phone',
                'image_128',
                'company_id',
                'child_ids',
            ],
            order='name asc',
        )

        # Encode image as data URI for direct use in img src
        for emp in employees:
            if emp.get('image_128'):
                emp['avatar'] = 'data:image/png;base64,' + emp['image_128'].decode('utf-8') \
                    if isinstance(emp['image_128'], bytes) else \
                    'data:image/png;base64,' + emp['image_128']
            else:
                emp['avatar'] = None
            # Flatten relational fields
            emp['job_name'] = emp['job_id'][1] if emp.get('job_id') else ''
            emp['department_name'] = emp['department_id'][1] if emp.get('department_id') else ''
            emp['company_name'] = emp['company_id'][1] if emp.get('company_id') else ''
            emp['manager_id'] = emp['parent_id'][0] if emp.get('parent_id') else None

        return employees

    @http.route('/organisation-chart/filters', type='json', auth='user', methods=['POST'], csrf=False)
    def get_filters(self, **kw):
        """Return all filter options (departments, companies, job positions)."""
        departments = request.env['hr.department'].sudo().search_read(
            [('active', '=', True)],
            fields=['id', 'name'],
            order='name asc',
        )
        companies = request.env['res.company'].sudo().search_read(
            [],
            fields=['id', 'name'],
            order='name asc',
        )
        jobs = request.env['hr.job'].sudo().search_read(
            [('active', '=', True)],
            fields=['id', 'name'],
            order='name asc',
        )
        return {
            'departments': departments,
            'companies': companies,
            'jobs': jobs,
        }
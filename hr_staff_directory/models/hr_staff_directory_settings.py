# -*- coding: utf-8 -*-
from odoo import api, fields, models


class HRStaffDirectorySettings(models.Model):
    """Per-user Staff Directory preferences (follow the login across devices)."""
    _name = 'hr.staff.directory.settings'
    _description = 'Staff Directory User Settings'
    _rec_name = 'user_id'

    user_id = fields.Many2one(
        'res.users',
        string='User',
        required=True,
        default=lambda self: self.env.user,
        ondelete='cascade',
        index=True,
    )
    landing_tab = fields.Selection(
        [
            ('people', 'People'),
            ('teams', 'Organizational Structure'),
            ('relationship', 'Organizational Intelligence'),
        ],
        string='Default Landing Tab',
        default='people',
        required=True,
    )
    density = fields.Selection(
        [
            ('comfortable', 'Comfortable'),
            ('compact', 'Compact'),
        ],
        string='Display Density',
        default='comfortable',
        required=True,
    )
    people_view = fields.Selection(
        [
            ('table', 'Table'),
            ('cards', 'Cards'),
        ],
        string='People Default View',
        default='table',
        required=True,
    )
    people_page_size = fields.Selection(
        [
            ('10', '10'),
            ('12', '12'),
            ('25', '25'),
            ('50', '50'),
        ],
        string='People Rows Per Page',
        default='25',
        required=True,
    )
    people_sort_field = fields.Selection(
        [
            ('name', 'Name'),
            ('dept', 'Department'),
            ('role', 'Role'),
            ('startDate', 'Start date'),
            ('gradeLevel', 'Grade'),
            ('location', 'Location'),
        ],
        string='People Default Sort Field',
        default='name',
        required=True,
    )
    people_sort_dir = fields.Selection(
        [
            ('asc', 'A → Z'),
            ('desc', 'Z → A'),
        ],
        string='People Sort Direction',
        default='asc',
        required=True,
    )
    org_sub_tab = fields.Selection(
        [
            ('overview', 'Overview'),
            ('teams', 'Teams'),
            ('calendar', 'Calendar'),
            ('analytics', 'Analytics'),
        ],
        string='Org Structure Default Sub-tab',
        default='overview',
        required=True,
    )

    _sql_constraints = [
        ('user_uniq', 'unique(user_id)', 'Each user has one Staff Directory settings record.'),
    ]

    # ─── Serialisation ───────────────────────────────────────────────────────

    def _to_frontend(self):
        self.ensure_one()
        try:
            page_size = int(self.people_page_size or 25)
        except (TypeError, ValueError):
            page_size = 25
        return {
            'landingTab': self.landing_tab or 'people',
            'density': self.density or 'comfortable',
            'peopleView': self.people_view or 'table',
            'peoplePageSize': page_size,
            'peopleSortField': self.people_sort_field or 'name',
            'peopleSortDir': self.people_sort_dir or 'asc',
            'orgSubTab': self.org_sub_tab or 'overview',
        }

    @api.model
    def _sanitize_values(self, values):
        """Accept camelCase (OWL) or snake_case; keep only known fields."""
        if not isinstance(values, dict):
            return {}
        landing = values.get('landingTab', values.get('landing_tab'))
        density = values.get('density')
        people_view = values.get('peopleView', values.get('people_view'))
        page_size = values.get('peoplePageSize', values.get('people_page_size'))
        sort_field = values.get('peopleSortField', values.get('people_sort_field'))
        sort_dir = values.get('peopleSortDir', values.get('people_sort_dir'))
        org_sub_tab = values.get('orgSubTab', values.get('org_sub_tab'))
        clean = {}
        if landing in ('people', 'teams', 'relationship'):
            clean['landing_tab'] = landing
        if density in ('comfortable', 'compact'):
            clean['density'] = density
        if people_view in ('table', 'cards'):
            clean['people_view'] = people_view
        if page_size is not None:
            size_str = str(page_size)
            if size_str in ('10', '12', '25', '50'):
                clean['people_page_size'] = size_str
        if sort_field in ('name', 'dept', 'role', 'startDate', 'gradeLevel', 'location'):
            clean['people_sort_field'] = sort_field
        if sort_dir in ('asc', 'desc'):
            clean['people_sort_dir'] = sort_dir
        if org_sub_tab in ('overview', 'teams', 'calendar', 'analytics'):
            clean['org_sub_tab'] = org_sub_tab
        return clean

    @api.model
    def _get_or_create_mine(self):
        rec = self.search([('user_id', '=', self.env.uid)], limit=1)
        if not rec:
            rec = self.create({'user_id': self.env.uid})
        return rec

    # ─── Public API (OWL / call_kw) ──────────────────────────────────────────

    @api.model
    def get_my_settings(self):
        return self._get_or_create_mine()._to_frontend()

    @api.model
    def update_my_settings(self, values):
        clean = self._sanitize_values(values)
        rec = self._get_or_create_mine()
        if clean:
            rec.write(clean)
        return rec._to_frontend()

    @api.model
    def reset_my_settings(self):
        rec = self._get_or_create_mine()
        rec.write({
            'landing_tab': 'people',
            'density': 'comfortable',
            'people_view': 'table',
            'people_page_size': '25',
            'people_sort_field': 'name',
            'people_sort_dir': 'asc',
            'org_sub_tab': 'overview',
        })
        return rec._to_frontend()

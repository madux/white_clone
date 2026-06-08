from odoo import http
from odoo.http import request


class PlanViewController(http.Controller):

    @http.route('/plan_view/page', type='http', auth='user', website=False)
    def plan_page(self, **kwargs):
        """
        This is the local HTML route that will be embedded inside the
        Plan View iframe. You can pass model/record data via query params.
        """
        model = kwargs.get('model', '')
        res_id = kwargs.get('res_id', '')
        action_id = kwargs.get('action_id', '')

        # Optional: fetch actual record data to pass into the page
        record_data = {}
        if model and res_id:
            try:
                record = request.env[model].browse(int(res_id))
                record_data = {
                    'id': record.id,
                    'name': getattr(record, 'name', ''),
                }
            except Exception:
                pass

        return request.render(
            'plan_view_widget.plan_page_template',
            {
                'model': model,
                'res_id': res_id,
                'action_id': action_id,
                'record_data': record_data,
            }
        )

    @http.route('/plan_view/data', type='json', auth='user')
    def plan_data(self, model=None, domain=None, fields=None, **kwargs):
        """
        JSON endpoint — the embedded page can call this via fetch()
        to load live Odoo data without a full page reload.
        """
        if not model:
            return {'error': 'No model specified'}

        domain = domain or []
        fields = fields or ['name', 'id']

        try:
            records = request.env[model].search_read(domain, fields, limit=100)
            return {'records': records, 'count': len(records)}
        except Exception as e:
            return {'error': str(e)}

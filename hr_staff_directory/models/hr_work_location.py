from odoo import models, fields, api
import requests
import logging
import time
import re

_logger = logging.getLogger(__name__)

STRIP_WORDS = re.compile(
    r'\b(hq|office|branch|regional|satellite|center|centre|headquarters)\b',
    re.IGNORECASE,
)

class HrWorkLocation(models.Model):
    _inherit = 'hr.work.location'

    latitude = fields.Float(string="Latitude", digits=(10, 7))
    longitude = fields.Float(string="Longitude", digits=(10, 7))

    def _build_geocode_query(self):
        name = self.name or ''
        cleaned = STRIP_WORDS.sub('', name).strip(' ,')
        parts = [p.strip() for p in cleaned.split(',') if p.strip()]
        addr = self.address_id
        if addr:
            for val in [addr.city, addr.zip]:
                if val and val.strip() and val.strip() not in cleaned:
                    parts.append(val.strip())
            if addr.country_id and addr.country_id.name:
                parts.append(addr.country_id.name.strip())
        return ', '.join(parts) if parts else name

    def action_geocode(self):
        for loc in self:
            query = loc._build_geocode_query()
            _logger.info("Geocoding query for '%s': %s", loc.name, query)
            try:
                response = requests.get(
                    'https://nominatim.openstreetmap.org/search',
                    params={'q': query, 'format': 'json', 'limit': 1},
                    headers={'User-Agent': 'OdooHRStaffDirectory/1.0'},
                    timeout=10,
                )
                if response.status_code == 200:
                    data = response.json()
                    if data:
                        loc.latitude = float(data[0]['lat'])
                        loc.longitude = float(data[0]['lon'])
                        _logger.info("Geocoded '%s' -> %s, %s", loc.name, loc.latitude, loc.longitude)
                    else:
                        _logger.warning("No results for '%s' (query: %s)", loc.name, query)
                elif response.status_code == 429:
                    _logger.warning("Nominatim rate limited, sleeping 2s")
                    time.sleep(2)
                else:
                    _logger.warning("HTTP %d for '%s' (query: %s)", response.status_code, loc.name, query)
            except Exception as e:
                _logger.error("Geocoding failed for '%s': %s", loc.name, e)
            time.sleep(1.1)

    def _get_unmapped(self):
        return self.search([]).filtered(lambda l: not l.latitude and not l.longitude)

    @api.model
    def _cron_geocode_unmapped(self):
        to_geocode = self._get_unmapped()
        _logger.info("Geocoding %d unmapped work locations", len(to_geocode))
        for loc in to_geocode:
            loc.action_geocode()

    def _post_init_geocode(self):
        to_geocode = self._get_unmapped()
        _logger.info("Post-init: geocoding %d work locations", len(to_geocode))
        for loc in to_geocode:
            loc.action_geocode()

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records.action_geocode()
        return records

    def write(self, vals):
        res = super().write(vals)
        if 'name' in vals or 'address_id' in vals:
            self.action_geocode()
        return res

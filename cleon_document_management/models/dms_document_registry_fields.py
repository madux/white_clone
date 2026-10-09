# -*- coding: utf-8 -*-
from odoo import api, fields, models


class DocDocumentRegistryFields(models.Model):
    _inherit = "doc.document"

    registry_source_module = fields.Char(index=True)
    registry_location_path = fields.Char()
    registry_template_id = fields.Integer()
    registry_processing_state = fields.Char(index=True)
    registry_synced_at = fields.Datetime(index=True)

    @api.model_create_multi
    def create(self, vals_list):
        records = super().create(vals_list)
        records._sync_registry_metadata()
        return records

    def write(self, vals):
        result = super().write(vals)
        if not self.env.context.get("skip_registry_sync"):
            self._sync_registry_metadata()
        return result

    def _sync_registry_metadata(self):
        service = self.env["doc.registry.service"]
        service.sync_document_registry(self)

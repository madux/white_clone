# -*- coding: utf-8 -*-
from odoo import api, fields, models
from odoo.exceptions import ValidationError


class ResCompany(models.Model):
    _inherit = "res.company"

    dms_date_format = fields.Selection(
        [
            ("d_mmm_yyyy", "09 Oct 2026"),
            ("dd_mm_yyyy", "09/10/2026"),
            ("yyyy_mm_dd", "2026-10-09"),
        ],
        string="DMS date format",
        default="d_mmm_yyyy",
    )
    dms_language = fields.Selection(
        [("en_GB", "English (United Kingdom)")],
        string="DMS language",
        default="en_GB",
    )
    dms_working_weekdays = fields.Char(
        string="DMS working weekdays",
        default="0,1,2,3,4",
        help="Python weekday numbers (0=Monday … 6=Sunday), comma-separated.",
    )
    dms_reminder_digest_time = fields.Char(
        string="Reminder and digest time",
        default="09:00",
    )

    dms_audit_retention_years = fields.Integer(
        string="Audit retention (years)",
        default=7,
        help="Audit events must be kept between 7 and 25 years.",
    )

    dms_tenant_modules_json = fields.Text(
        string="DMS tenant modules",
        help="JSON map of enabled product modules for this company.",
    )

    @api.constrains("dms_audit_retention_years")
    def _check_dms_audit_retention_years(self):
        for company in self:
            years = company.dms_audit_retention_years or 0
            if years < 7 or years > 25:
                raise ValidationError("Audit must be kept for at least 7 years (maximum 25).")

    @api.model_create_multi
    def create(self, vals_list):
        companies = super().create(vals_list)
        catalog = self.env.get("doc.document.catalog.service")
        if catalog:
            for company in companies:
                catalog.ensure_default_catalog(company)
        return companies

# -*- coding: utf-8 -*-
from datetime import date

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class DocDmsPublicHoliday(models.Model):
    _name = "doc.dms.public.holiday"
    _description = "DMS public holiday"
    _order = "holiday_date, name"

    company_id = fields.Many2one(
        "res.company",
        required=True,
        ondelete="cascade",
        index=True,
        default=lambda self: self.env.company,
    )
    name = fields.Char(required=True)
    holiday_date = fields.Date(required=True, index=True)
    year = fields.Integer(compute="_compute_year", store=True, index=True)

    _sql_constraints = [
        (
            "company_date_uniq",
            "unique(company_id, holiday_date)",
            "A holiday already exists on this date.",
        ),
    ]

    @api.depends("holiday_date")
    def _compute_year(self):
        for row in self:
            row.year = row.holiday_date.year if row.holiday_date else 0

    @api.constrains("holiday_date")
    def _check_holiday_date(self):
        for row in self:
            if row.holiday_date and row.holiday_date.year != row.year:
                continue

    @api.model
    def serialize_list(self, company, year=None):
        domain = [("company_id", "=", company.id)]
        if year:
            domain.append(("year", "=", int(year)))
        return [
            {
                "id": row.id,
                "name": row.name,
                "date": fields.Date.to_string(row.holiday_date),
                "year": row.year,
            }
            for row in self.search(domain, order="holiday_date, id")
        ]

    @api.model
    def copy_from_last_year(self, company, target_year):
        target_year = int(target_year)
        source_year = target_year - 1
        existing = self.search(
            [
                ("company_id", "=", company.id),
                ("year", "=", target_year),
            ]
        )
        if existing:
            raise ValidationError(
                _("Remove or edit existing holidays for %s before copying.") % target_year
            )
        source = self.search(
            [
                ("company_id", "=", company.id),
                ("year", "=", source_year),
            ]
        )
        if not source:
            raise ValidationError(_("No holidays found for %s to copy.") % source_year)
        created = []
        for row in source:
            try:
                shifted = row.holiday_date.replace(year=target_year)
            except ValueError:
                shifted = date(target_year, row.holiday_date.month, row.holiday_date.day)
            created.append(
                {
                    "company_id": company.id,
                    "name": row.name,
                    "holiday_date": shifted,
                }
            )
        return self.create(created)

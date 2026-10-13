# -*- coding: utf-8 -*-
from zoneinfo import ZoneInfo, available_timezones

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class DocDmsGeneralService(models.AbstractModel):
    _name = "doc.dms.general.service"
    _description = "DMS General settings (Section General)"

    @api.model
    def timezone_options(self):
        preferred = [
            "UTC",
            "Europe/London",
            "Africa/Lagos",
            "Africa/Johannesburg",
            "Africa/Nairobi",
            "America/New_York",
            "America/Chicago",
            "America/Los_Angeles",
            "Asia/Dubai",
            "Asia/Singapore",
            "Australia/Sydney",
        ]
        options = []
        seen = set()
        for name in preferred:
            if name not in available_timezones():
                continue
            seen.add(name)
            options.append(self._timezone_option(name))
        for name in sorted(available_timezones()):
            if name in seen:
                continue
            if "/" not in name:
                continue
            options.append(self._timezone_option(name))
        return options

    @api.model
    def _timezone_option(self, name):
        try:
            from datetime import datetime

            offset = datetime.now(ZoneInfo(name)).utcoffset()
            if offset is not None:
                total = int(offset.total_seconds())
                sign = "+" if total >= 0 else "-"
                total = abs(total)
                hours, rem = divmod(total, 3600)
                minutes = rem // 60
                return {
                    "value": name,
                    "label": f"{name} (UTC{sign}{hours:02d}:{minutes:02d})",
                }
        except Exception:
            pass
        return {"value": name, "label": name}

    @api.model
    def get_timezone(self, company=None):
        company = company or self.env.company
        param = (
            self.env["ir.config_parameter"]
            .sudo()
            .get_param("cleon_document_management.org_timezone", "")
        )
        if param:
            return param
        return company.partner_id.tz or "UTC"

    @api.model
    def build_general_payload(self):
        company = self.env.company.sudo()
        calendar = self.env["doc.dms.working.calendar.service"]
        storage = self.env["doc.dms.storage.usage.service"]
        Holiday = self.env["doc.dms.public.holiday"]
        year = fields.Date.context_today(self).year
        params = self.env["ir.config_parameter"].sudo()
        return {
            "organisation_name": company.name,
            "organisation_name_readonly_hint": _(
                "Change this in CleonHR platform settings"
            ),
            "has_logo": bool(company.logo),
            "logo_label": _("%s logo (from platform)") % company.name
            if company.logo
            else _("No logo on platform"),
            "timezone": self.get_timezone(company),
            "timezone_options": self.timezone_options(),
            "date_format": company.dms_date_format or "d_mmm_yyyy",
            "date_format_options": [
                {"value": "d_mmm_yyyy", "label": "09 Oct 2026"},
                {"value": "dd_mm_yyyy", "label": "09/10/2026"},
                {"value": "yyyy_mm_dd", "label": "2026-10-09"},
            ],
            "language": company.dms_language or "en_GB",
            "language_options": [
                {"value": "en_GB", "label": "English (United Kingdom)"},
            ],
            "working_weekdays": calendar.get_working_weekdays(company),
            "reminder_digest_time": company.dms_reminder_digest_time or "09:00",
            "holidays_year": year,
            "holidays": Holiday.serialize_list(company, year),
            "storage": storage.general_storage_payload(company),
            "mail_smtp_host": params.get_param(
                "cleon_document_management.mail_smtp_host", ""
            ),
            "mail_smtp_port": params.get_param(
                "cleon_document_management.mail_smtp_port", "587"
            ),
            "mail_from_address": params.get_param(
                "cleon_document_management.mail_from_address", ""
            ),
            "mail_from_name": params.get_param(
                "cleon_document_management.mail_from_name", ""
            ),
        }

    @api.model
    def save_general(self, payload):
        if payload.get("organisation_name") or payload.get("platform_name"):
            raise ValidationError(
                _("Organisation name is read-only. Change this in CleonHR platform settings.")
            )
        company = self.env.company.sudo()
        calendar = self.env["doc.dms.working.calendar.service"]
        vals = {}
        tz = (payload.get("org_timezone") or payload.get("timezone") or "").strip()
        if not tz:
            raise ValidationError(_("Choose your organisation's time zone"))
        if tz:
            try:
                ZoneInfo(tz)
            except Exception:
                raise ValidationError(_("Choose a valid organisation time zone"))
            self.env["ir.config_parameter"].sudo().set_param(
                "cleon_document_management.org_timezone", tz
            )
            if company.partner_id:
                company.partner_id.sudo().write({"tz": tz})

        if "date_format" in payload:
            vals["dms_date_format"] = payload.get("date_format") or "d_mmm_yyyy"
        if "language" in payload:
            vals["dms_language"] = payload.get("language") or "en_GB"
        if "working_weekdays" in payload:
            days = payload.get("working_weekdays") or []
            if isinstance(days, str):
                parsed = calendar.parse_working_weekdays(days)
            else:
                parsed = []
                for item in days:
                    try:
                        parsed.append(int(item))
                    except (TypeError, ValueError):
                        continue
                parsed = sorted(set(parsed))
            if not parsed:
                raise ValidationError(_("Select at least one working day"))
            vals["dms_working_weekdays"] = ",".join(str(day) for day in parsed)
        if "reminder_digest_time" in payload:
            raw = (payload.get("reminder_digest_time") or "09:00").strip()
            if ":" not in raw:
                raise ValidationError(_("Enter a valid reminder time (HH:MM)"))
            vals["dms_reminder_digest_time"] = raw

        if vals:
            company.write(vals)

        params = self.env["ir.config_parameter"].sudo()
        mail_keys = {
            "mail_smtp_host": "cleon_document_management.mail_smtp_host",
            "mail_smtp_port": "cleon_document_management.mail_smtp_port",
            "mail_from_address": "cleon_document_management.mail_from_address",
            "mail_from_name": "cleon_document_management.mail_from_name",
        }
        for key, param_key in mail_keys.items():
            if key in payload:
                params.set_param(param_key, str(payload.get(key) or ""))

        return {"success": True}

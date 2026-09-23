from datetime import datetime, timedelta
import pytz

from odoo import api, fields, models, _
from odoo.exceptions import AccessError, UserError, ValidationError


class CleonBiometricDevice(models.Model):
    _name = "cleon.biometric.device"
    _description = "CleonHR Biometric Hardware Terminal Registration"
    _order = "name asc, id desc"

    name = fields.Char(string="Device Name", required=True)
    device_key = fields.Char(string="Authentication Device Key", required=True, copy=False, index=True, groups="hr_time_management.group_time_management_hr_admin,base.group_system")
    company_id = fields.Many2one("res.company", string="Company", required=True, default=lambda self: self.env.company, index=True)
    active = fields.Boolean(default=True)
    ip_address = fields.Char(string="Authorized IP Address")
    location_name = fields.Char(string="Terminal Physical Location")
    last_sync_at = fields.Datetime(string="Last Sync Timestamp", readonly=True)

    _sql_constraints = [
        ("device_key_unique", "unique(device_key)", "Device authentication key must be globally unique."),
    ]

    @api.model
    def cleon_biometric_device_punch(self, device_key, barcode, timestamp, event_id=False):
        """Authenticated API connector contract for physical biometric hardware terminals.

        Validates device identity, mandatory event_id, device source IP, timestamp skew, and delegates to central Attendance Punch Service.
        """
        if not device_key or not barcode or not timestamp:
            raise ValidationError(_("Device key, employee barcode/ID, and timestamp are required."))
        if not event_id or not str(event_id).strip():
            raise ValidationError(_("Biometric event ID (event_id) is required for terminal punch idempotency."))

        device = self.sudo().search([
            ("device_key", "=", device_key),
            ("active", "=", True),
        ], limit=1)
        if not device:
            raise AccessError(_("Unauthorized or inactive biometric terminal key."))

        # Device-specific SQL-backed event_id idempotency check
        existing_event = self.env["cleon.biometric.event"].sudo().search([
            ("device_id", "=", device.id),
            ("event_id", "=", str(event_id).strip()),
        ], limit=1)
        if existing_event:
            return {
                "status": "duplicate",
                "message": _("Duplicate punch event %s for device %s already processed.") % (event_id, device.name),
            }

        # Resolve employee within device company scope
        domain = [("company_id", "=", device.company_id.id), ("active", "=", True)]
        str_barcode = str(barcode).strip()
        employee = self.env["hr.employee"].sudo().search(
            domain + ["|", ("barcode", "=", str_barcode), ("identification_id", "=", str_barcode)],
            limit=1,
        )
        if not employee and str_barcode.isdigit():
            employee = self.env["hr.employee"].sudo().search(
                domain + [("id", "=", int(str_barcode))], limit=1
            )
        if not employee:
            raise UserError(_("No active employee found matching barcode or identification '%s' for company %s.") % (
                str_barcode, device.company_id.name
            ))

        # Delegate to single central Attendance Punch Service (pass device model, NOT device_key)
        Attendance = self.env["hr.attendance"].sudo()
        res = Attendance._cleon_attendance_punch_service(
            employee=employee,
            punch_type="biometric",
            device=device,
            event_id=str(event_id).strip(),
            timestamp=timestamp,
        )

        # Record structured biometric event for idempotency
        if res.get("status") == "success" and res.get("attendance_id"):
            self.env["cleon.biometric.event"].sudo().create({
                "device_id": device.id,
                "event_id": str(event_id).strip(),
                "punch_timestamp": fields.Datetime.to_datetime(timestamp),
                "attendance_id": res["attendance_id"],
                "employee_id": employee.id,
                "company_id": device.company_id.id,
            })

        device.sudo().write({"last_sync_at": fields.Datetime.now()})
        return res


class CleonBiometricEvent(models.Model):
    _name = "cleon.biometric.event"
    _description = "CleonHR Biometric Punch Event Log (Idempotency)"
    _order = "id desc"

    device_id = fields.Many2one("cleon.biometric.device", string="Terminal Device", required=True, ondelete="cascade", index=True)
    event_id = fields.Char(string="Event Unique ID", required=True, index=True)
    punch_timestamp = fields.Datetime(string="Punch Timestamp", required=True)
    attendance_id = fields.Many2one("hr.attendance", string="Attendance Record", ondelete="set null")
    employee_id = fields.Many2one("hr.employee", string="Employee", required=True, index=True)
    company_id = fields.Many2one("res.company", string="Company", required=True, index=True)

    _sql_constraints = [
        ("device_event_unique", "unique(device_id, event_id)", "Biometric event_id must be unique per device."),
    ]

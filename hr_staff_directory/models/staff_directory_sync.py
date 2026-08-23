# -*- coding: utf-8 -*-
from odoo import api, models


class StaffDirectorySyncMixin(models.AbstractModel):
    """Real-time sync for the Staff Directory.

    Any create/write/unlink on the models the Staff Directory aggregates
    broadcasts a bus notification on the 'hr_staff_directory' channel. The
    OWL client listens for it and silently reloads its data, so changes made
    anywhere in the application (employee edits, leave validation, contract
    updates, department/location renames, skill changes) appear immediately
    without a manual page refresh.

    Disable the broadcast for a call with the 'sdir_no_notify' context key
    (used by seeding / import jobs to avoid notification storms).
    """
    _name = 'staff_directory.sync.mixin'
    _description = 'Staff Directory Real-Time Sync Mixin'

    SDIR_CHANNEL = 'hr_staff_directory'
    SDIR_EVENT = 'hr_staff_directory_update'

    def _notify_staff_directory_update(self):
        if self.env.context.get('sdir_no_notify'):
            return
        self.env['bus.bus']._sendone(
            self.SDIR_CHANNEL,
            self.SDIR_EVENT,
            {
                'user_id': self.env.user.id,
                'model': self._name,
                'ids': list(self.ids),
            },
        )

    @api.model_create_multi
    def create(self, vals_list):
        res = super().create(vals_list)
        if vals_list:
            res._notify_staff_directory_update()
        return res

    def write(self, vals):
        res = super().write(vals)
        if self.ids:
            self._notify_staff_directory_update()
        return res

    def unlink(self):
        # Notify first: the bus message is queued in precommit and only sent on
        # commit, so a failed unlink rolls back and never reaches clients.
        self._notify_staff_directory_update()
        return super().unlink()


class HrEmployeeStaffDirectorySync(models.Model):
    _name = 'hr.employee'
    _inherit = ['hr.employee', 'staff_directory.sync.mixin']


class HrContractStaffDirectorySync(models.Model):
    _name = 'hr.contract'
    _inherit = ['hr.contract', 'staff_directory.sync.mixin']


class HrLeaveStaffDirectorySync(models.Model):
    _name = 'hr.leave'
    _inherit = ['hr.leave', 'staff_directory.sync.mixin']


class HrDepartmentStaffDirectorySync(models.Model):
    _name = 'hr.department'
    _inherit = ['hr.department', 'staff_directory.sync.mixin']


class HrWorkLocationStaffDirectorySync(models.Model):
    _name = 'hr.work.location'
    _inherit = ['hr.work.location', 'staff_directory.sync.mixin']


class HrEmployeeSkillStaffDirectorySync(models.Model):
    _name = 'hr.employee.skill'
    _inherit = ['hr.employee.skill', 'staff_directory.sync.mixin']


class HrJobStaffDirectorySync(models.Model):
    _name = 'hr.job'
    _inherit = ['hr.job', 'staff_directory.sync.mixin']


class HrSkillStaffDirectorySync(models.Model):
    _name = 'hr.skill'
    _inherit = ['hr.skill', 'staff_directory.sync.mixin']

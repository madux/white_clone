CLEONHR Time Management
=======================

Architecture
------------

This module is the CleonHR presentation and workflow layer for workforce time.
It deliberately reuses Odoo Community models instead of duplicating them:

* ``hr.attendance`` is the source of clock-in/out, location, device and raw hours.
* ``resource.calendar`` supplies an employee's expected working schedule.
* ``hr.leave`` supplies approved leave/absence information.
* ``account.analytic.line`` (``hr_timesheet``) remains the task timesheet source.
* ``cleon.hr.shift`` adds named shifts, grace time, breaks and assignments.
* ``cleon.attendance.regularization`` adds an approval workflow for corrections.
* ``cleon.time.audit.log`` records controlled attendance changes.

Navigation decision
-------------------

The Time Management top-level menu is a gateway for Attendance, Shifts,
Overtime and Time Tracking, so its selector opens on each fresh entry. Navigation
inside one area uses that area's sidebar and does not reopen the selector.

Implemented foundation
----------------------

The first slice includes the module selector, Attendance Dashboard, attendance
detail dialog, Attendance Sheets filters/export, and audited attendance editing.
Shift, overtime, regularisation, reports and task-timesheet screens build on the
models listed above and are intentionally separate subsequent slices.

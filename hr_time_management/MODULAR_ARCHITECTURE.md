# Time Management module split

`hr_time_management` is a non-application foundation: shared policy, time engine,
audit, period locks, access helpers and the reusable workspace shell.

Independently installable applications:

| Application | Addon | Owned workflows |
| --- | --- | --- |
| Attendance | `hr_attendance_management` | Presence, regularization, capture devices |
| Shift Management | `hr_shift_management` | Schedules, assignments, swaps |
| Overtime Management | `hr_overtime_management` | Submission, review and payroll handoff |
| Time & Work | `hr_time_work` | Work entries and timesheets |

Each depends on the foundation, not another operational app. Existing HR-suite
dependencies can still install native Odoo attendance/leave modules; these are
distinct from the four Cleon operational applications.

The attendance/shift and attendance/overtime bridge addons install automatically
when both participating apps are present. `hr_time_management_suite` installs all
four apps for existing deployments. Model names and database tables are retained.

## Existing database upgrade

Back up first. Install the suite in the same operation as the foundation upgrade:

```sh
../venv/bin/python ../odoo/odoo-bin -c conf/odoo.conf -d white_clone_db \
  -i hr_time_management_suite -u hr_time_management,white_clone_portal_time \
  --stop-after-init --no-http
```

The pre-migration transfers XML-ID/model metadata ownership. Do not uninstall the
old foundation to migrate: that would remove its data. Restart the application
server after upgrading.

## Shared calculation boundary

`cleon.time.engine` supplies the default working pattern and calculates worked,
regular, extra, undertime and qualifying overtime. Shift extends the expected
schedule provider. The overtime bridge consumes that calculation. Work tracking
does not create presence records. General owns the working-week editor; Time
Rules owns the common calculation editors.

## Remaining specification work

This is the structural migration, not completion of the entire revised functional
specification. Effective-dated immutable rule versions, controlled downstream
recalculation, the complete payable-time/paid-leave aggregation, revised break
semantics and the full new shared-settings UX still require implementation and
acceptance tests. Existing setup-wizard screens also need consolidation with the
new settings owners. Do not treat historical calculation snapshots or the full
Payroll Hours specification as delivered by this split.

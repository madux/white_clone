# TODO: hr_cleon_recruitment missing `hr_job_dashboard` dependency

## Status
PENDING — documented, not applied.

## Issue
Installing `cleon_settings` on fresh DB `white_clone_db_v2` fails with:

```
ValueError: External ID not found in the system: hr_job_dashboard.action_hr_job_dashboardx
odoo.tools.convert.ParseError: while parsing .../hr_cleon_recruitment/views/hr_recruitment_views.xml:44
```

`hr_administration` and `base_addons` installed fine; `cleon_settings` / `hr_cleon_recruitment` rolled back to `uninstalled` (DB can be retried without recreation).

## Root cause
`hr_cleon_recruitment` references `hr_job_dashboard.action_hr_job_dashboardx` in two places:

- `hr_cleon_recruitment/views/hr_recruitment_views.xml:67` — Dashboard `<button name="%(hr_job_dashboard.action_hr_job_dashboardx)d">`
- `hr_cleon_recruitment/views/menu.xml:24` — `<menuitem action="hr_job_dashboard.action_hr_job_dashboardx">`

but `hr_job_dashboard` is NOT in `hr_cleon_recruitment`'s `depends` list
(current: `hr, hr_recruitment, hr_cbt_portal_recruitment, ik_multi_branch`).

So when the module graph installs `hr_cleon_recruitment`, the action XMLID does not yet exist.

Why it worked on v1: the old DB was created before these references existed and the module was never upgraded afterward (`hr_job_dashboard` still `uninstalled` on v1).

## Fix
Add `'hr_job_dashboard'` to `depends` in `hr_cleon_recruitment/__manifest__.py`.

## Verified safe
- `hr_job_dashboard` depends on `hr_recruitment, web, mail` (all community).
- Its asset `"web/static/lib/Chart/Chart.js"` resolves to `addons/web/static/lib/Chart/Chart.js` (exists).
- No dependency cycle introduced (`hr_job_dashboard` is a leaf, nothing else depends on it).

## Verification steps
1. Apply the manifest change.
2. Re-run on `white_clone_db_v2` (no DB recreation needed):
   ```
   ./venv/bin/python ./odoo-bin -c ./white_clone.conf -d white_clone_db_v2 \
     -i cleon_settings,hr_staff_directory,hr_insurance,hr_work_entry_contract --stop-after-init
   ```

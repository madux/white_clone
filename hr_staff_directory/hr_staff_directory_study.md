# hr_staff_directory Module Study Notes

Verified against the live module (v17.0.1.0.4). Earlier drafts of this note were stale in several places; those are corrected here.

**Design rule:** the frontend should render; the backend is the single source of truth (SSOT). That is only partly true today. Several charts and team/project surfaces still fabricate or fall back to mock data.

---

## 1. Overview

`hr_staff_directory` is an OWL **client action**, not a classic Odoo list/form app. It hijacks the HR Admin “Staff Directory” menu and serves as the CleonHR workforce directory: people table, profile drawer, org visualizations, saved segments, and HR admin actions (lifecycle, transfer, promote, permissions, etc.).

| | |
|---|---|
| Name | CLEONHR Staff Directory |
| Version | 17.0.1.0.4 |
| Client action tag | `hr_staff_directory.dashboard` |
| Menu | Overrides `hr_administration.hr_admin_staff_directory` |
| Depends | `base`, `hr`, `hr_holidays`, `hr_contract`, `hr_skills`, `mail`, `web`, `hr_administration` |
| License | LGPL-3 |

---

## 2. How a user gets here

```
HR Administration → Staff Directory
        ↓
ir.actions.client  tag=hr_staff_directory.dashboard
        ↓
StaffDirectoryDashboard  (staff_directory_dashboard.js + .xml)
        ↓
JSON  POST /hr_staff_directory/people   (sudo)
        ↓
hr.employee.get_staff_directory_people_data()
```

---

## 3. File map

```
hr_staff_directory/
├── models/
│   ├── hr_employee.py                 # SSOT fields + all dashboard / HR APIs (~2000 lines)
│   ├── staff_directory_sync.py        # bus broadcast mixin on 8 models
│   ├── hr_staff_directory_segment.py  # saved people segments + smart-search filters
│   ├── sdir_employee_event.py         # activity / performance ledger
│   └── hr_work_location.py            # lat/lng + Nominatim geocode
├── controllers/main.py                # /data, /people, /toggle_pin  (all sudo)
├── views/                             # client action, menu, DM Sans font, mail branding
├── security/                          # segment ACL + personal ir.rule
├── data/hr_work_location_cron.xml     # daily geocode cron
└── static/src/
    ├── js/staff_directory_dashboard.js       # orchestrator (~2970 lines)
    ├── xml/staff_directory_dashboard.xml     # tabs + org / smart-search shell
    └── components/
        people_list, profile_panel, full_profile
        org_chart, org_analysis, geographic_map, relationship_graph
        heatmap, bar_chart
        toast, message, mail_modal
        chat_window + composer patches
```

`post_init_hook` geocodes unmapped work locations on install.

---

## 4. Tabs — what is real vs empty

| Tab | `activeTab` | State |
|---|---|---|
| **People** | `people` | Live. Table, filters, segments, selection, profile drawer, full profile. |
| **Organizational Structure** | `org` | Live. Org chart + view switcher (org / bar / heatmap / geo / graph), Smart Search sidebar, Org Analysis overlay. |
| **Workforce Intelligence** | `workforce` | Placeholder: “Coming Soon”. |
| **Organizational Intelligence** | `network` | Placeholder: “Coming Soon”. |

Default tab is `people`. Smart Search lives on the **org** tab sidebar, not the people tab.

---

## 5. Data flow and APIs

### Live entry point

On mount the dashboard:

1. RPC `/hr_staff_directory/people`
2. Joins bus channel `hr_staff_directory`
3. Subscribes once (module-level singleton — Odoo 17 `bus_service.subscribe` has no unsubscribe)
4. Polls again every 60s as a fallback
5. Reloads on websocket reconnect

`get_staff_directory_people_data()` returns:

```python
{
  stats,                 # KPI cards
  people,                # one fat dict per employee (incl. archived)
  segments,              # personal people-segments
  smart_search_filters,  # personal smart-search saves
  departments,
}
```

`_sd_people_list()` uses `active_test=False`, so terminated/alumni still appear. Each row is a large dict: identity, org, lifecycle, location/coords, skills, leave, permissions snapshot, activity timeline, pin state, etc.

### Dead / leftover API

`/hr_staff_directory/data` → `get_staff_directory_dashboard_data()` still builds the original KPI overview (headcount trend, compliance, training, diversity, alerts, …). **The current OWL dashboard never calls it.** That Python block is leftover from an earlier analytics homepage.

### HTTP routes (`controllers/main.py`)

| Route | Method | Notes |
|---|---|---|
| `/hr_staff_directory/people` | `get_staff_directory_people_data` | Used |
| `/hr_staff_directory/toggle_pin` | `toggle_employee_pin` | Used |
| `/hr_staff_directory/data` | `get_staff_directory_dashboard_data` | Unused by current UI |

All three use `request.env['hr.employee'].sudo()`. Any logged-in user who can hit the JSON route sees every employee the superuser can. That is a real access hole if this ships to mixed-role tenants.

HR writes go through `orm.call` / `orm.write` on `hr.employee` from `profile_panel.js`. Those writes hit the sync mixin → bus → silent reload.

---

## 6. Real-time sync

`staff_directory.sync.mixin` (`models/staff_directory_sync.py`) broadcasts on create/write/unlink for:

`hr.employee`, `hr.contract`, `hr.leave`, `hr.department`, `hr.work.location`, `hr.employee.skill`, `hr.job`, `hr.skill`, plus `hr.staff.directory.segment`.

- Channel: `hr_staff_directory`
- Event: `hr_staff_directory_update`
- Context key `sdir_no_notify` suppresses the broadcast (used for segment cache and imports).
- Unlink notifies **before** `super().unlink()` so a failed unlink rolls back and never reaches clients.

The OWL side keeps a single page-level subscription and a 50ms debounce so N open dashboards do not each subscribe.

---

## 7. Frontend architecture (OWL)

The dashboard is the orchestrator. Child components receive the same `people` payload (already filtered client-side).

| Component | Role |
|---|---|
| `staff_directory_dashboard.js` | Tabs, load, filters, smart search, bus, selection, CSV/email |
| `people_list` | People table, segments, column picker, pagination |
| `profile_panel` | Side drawer + all HR action modals |
| `full_profile` | Full-page profile (overview / activity / leave / CleonAI chrome) |
| `org_chart` | Reporting tree; pan/zoom; depth > 2 collapsed |
| `org_analysis` | Chart.js overlay: headcount, teams, span of control |
| `geographic_map` | Nominatim coords on SVG world background (`map_bg.svg`) |
| `relationship_graph` | D3 force layout (loaded from `https://d3js.org/d3.v7.min.js`) |
| `heatmap` / `bar_chart` | Skills × location |
| `toast` / `message` / `mail_modal` | Global services via `main_components` |
| chat/composer patches | Visual restyle of native Discuss |

DM Sans is loaded via a `web.layout` inherit (`views/assets.xml`). Do **not** `@import` Google Fonts inside bundled CSS — that corrupts `web.assets_backend`.

---

## 8. Backend models

### 8.1 `hr.employee` inherit (`models/hr_employee.py`)

All dashboard aggregation and HR actions live here as `@api.model` methods (a few action methods are missing the decorator; JS still calls them as model methods).

### 8.2 SSOT field map (what the people list actually uses)

| Concept | Field / source | Notes |
|---|---|---|
| Display name | `name` | Native |
| Role | `job_title` (Char) | **Not** `job_id` |
| Department / manager | `department_id`, `parent_id` | Transfer also sets manager to the new dept manager |
| Photo | `image_1920` | Written directly from the photo modal |
| Work email / phone | `work_email`, `work_phone` | Native |
| Emergency contact | `emergency_contact`, `emergency_phone` | Native |
| Home address | `sdir_home_address` | Bypasses `address_home_id` |
| Emergency relationship | `sdir_emergency_relationship` | Missing in core HR |
| Lifecycle | `sdir_lifecycle_status` | `terminated` / `alumni` also set `active=False` |
| Pin | `pinned_by_user_ids` | Per-user M2M |
| Employment type | `sdir_employment_type`, fallback `employee_type` | |
| Work mode | `work_mode`, fallback location type | Defaults to “Hybrid” if empty |
| Location | `work_location_id` + lat/lng | Geocoded via Nominatim |
| Staff ID | `employee_number` → barcode → `EMP-####` | |
| Tenure / anniversary | contract `date_start`, else `create_date` | Leap-year safe |
| Performance | latest `sdir.employee.event` of type `performance_review` | **Not** the `performance_score` Integer field |
| Skills | `skills` Char, else `_mock_skills_for_employee()` | Still mocked when empty |
| Leave | real `hr.leave` / `hr.leave.allocation` | |
| Permissions | mapped `res.groups` on `user_id` | Needs a linked user |
| Grade in the table | `grade_id.name` or mock `grade` / `band` | **Not** `sdir_grade` |
| Promotion grade | `sdir_grade` | Written by promote; the table does not read it |
| Transfer metadata | `sdir_transfer_date`, `sdir_transfer_reason` | |
| Promotion metadata | `sdir_promotion_date`, `sdir_promotion_reason`, `sdir_salary_adjustment` | |
| Availability / flight risk / last active | `availability`, `flight_risk`, `last_active` | Directory-only fields |
| Retention priority (field) | `retention_priority` | People-list KPI of the same name is **not** this field |

Also present but unused by the live people table: mock `grade` Selection (`L1 · Junior Associate` …), Integer `performance_score`.

### 8.3 Why some fields are custom (SSOT rationale)

**Job title (`job_title`) vs job position (`job_id`).** `job_id` is a structural recruitment/headcount field and is often empty or generic. The free-text `job_title` is the “business card” title the directory displays and promote updates.

**Lifecycle (`sdir_lifecycle_status`).** Values: `active`, `probation`, `onleave`, `suspended`, `terminated`, `exiting`, `alumni`. We do not derive this from contracts or time-off, so an HR admin can badge someone without fabricating legal records. Terminated/Alumni also set native `active=False`. Native archive on the employee form does **not** write back to this field (see §19).

**Photo (`image_1920`).** Native `image.mixin` already generates `image_128` / `avatar_128` / etc. The photo modal writes base64 to `image_1920` so the image propagates across Odoo.

**Contact.** Native: `work_email`, `work_phone`, `emergency_contact`, `emergency_phone`. Custom: `sdir_home_address` (avoids `address_home_id` partner linkage) and `sdir_emergency_relationship` (core HR has no relationship field).

**Transfer.** Native `department_id` + `work_location_id`. Metadata: `sdir_transfer_date`, `sdir_transfer_reason`. Also reassigns `parent_id` to the new department’s manager. Optional chatter pings to old/new managers.

**Promote.** Updates `job_title` + `sdir_grade` / `sdir_salary_adjustment` / dates / reason. Does **not** write `hr.contract`. Optional “announce to team” tags the dept manager and coworkers. Does **not** create an `sdir.employee.event` (see §12).

### 8.4 Other models

| Model | Role |
|---|---|
| `hr.staff.directory.segment` | Personal saved filters. `kind`: `people` or `smart_search`. `conditions` is JSON. `member_ids` is a materialized cache refreshed on open/email (`sdir_no_notify`). Record rule: `user_id = user.id`. |
| `sdir.employee.event` | Milestone / performance ledger. Types: hire, promotion, transfer, performance_review, anniversary, other. |
| `hr.work.location` inherit | `latitude`, `longitude`. Geocode via Nominatim on create / name / address change, daily cron, and post-init. |

`views/hr_work_location_views.xml` (Get Coordinates button + lat/lng on the form) exists but is **not listed in `__manifest__.py` `data`**, so that UI never loads.

---

## 9. HR actions (profile panel)

All of these sit in `profile_panel.js` and write through `hr.employee`. Every successful write posts chatter — that is the audit trail.

| Action | Backend | Side effects |
|---|---|---|
| Edit basics | `orm.write` name, title, location, work_mode, type, grade | |
| Lifecycle | `update_lifecycle_status` | Archives on terminated/alumni; chatter |
| Photo | `write({image_1920})` | Native image mixin |
| Contact | `update_contact_info` | Chatter |
| Transfer / change dept | `transfer_employee` | Sets `parent_id` to new dept manager; optional manager notify |
| Promote | `promote_employee` | Updates `job_title` + `sdir_*`; optional team announce |
| Reassign manager | `reassign_manager` | Tags old/new manager |
| Grant / revoke perms | `grant_permissions` / `revoke_permissions` | Native groups; implied-group quirks |
| Reset password | `reset_user_password` | Email link or temp password via `sudo` |
| Suspend | `suspend_account` | `active=False` on employee **and** user |
| Confirm probation | `confirm_probation` | Sets lifecycle `active` if pass; chatter only (no event row) |
| Rehire | `rehire_employee` | Unarchives employee + user |

`confirm_probation`, `suspend_account`, `revoke_permissions`, and `promote_employee` lack `@api.model`. Several other methods have duplicated `@api.model` decorators.

---

## 10. People tab

`StaffDirectoryPeopleList` owns:

- Stat cards from `_sd_people_stats()`: total, active, on leave, probation (open contract with future `trial_date_end`), “retention priority” (contracts ending in 60 days — **not** the `retention_priority` field)
- Search, column picker, sort, pagination
- Filter modal (department, grade, location, gender, performance, type, lifecycle, manager, flight risk, …)
- Saved **people segments** (AND conditions, preview audience, persist, delete)
- Row selection → CSV export, bulk email, bulk chat
- Pin via `/hr_staff_directory/toggle_pin`
- Click row → profile drawer

### Segment engine

- Conditions JSON. Fields include `dept`, `role`, `gradeLevel`, `location`, `workMode`, `employmentType`, `lifecycleState`, `flightRisk`, `retentionPriority`, `lineManager`, `tenureBucket`, `gender`, `id`, `skills`, `languages`, `performanceScore` (numeric `eq` / `gte` / `lte` / `between`).
- Operators: `is`, `isNot`, `contains`, `notContains`.
- Smart-search payloads are dicts and are never treated as people-segment condition lists.
- Email: `action_email_members` recomputes members then sends `mail.mail`; people-list selection uses `email_employees` (`message_post` to `work_contact_id`).

ACL: `base.group_user` full CRUD on segments and events. Segments are personal only.

---

## 11. Org tab

Same people payload, filtered client-side.

**Views**

- **Org chart** — tree from `manager_id` / `direct_report_ids`; pan/zoom; depth > 2 collapsed by default
- **Bar chart** — skills × location
- **Heatmap** — skills × location intensity
- **Geographic map** — Nominatim coords on an SVG world background
- **Relationship graph** — D3 force layout
- **Org analysis** — Chart.js overlay

**Smart Search** is a second filter engine (OR within a category, AND across). Saved as `hr.staff.directory.segment` with `kind='smart_search'`. Sidebar tabs: Overview / Teams / Calendar / Analytics. Teams comparison and “current projects” still invent names like “Platform v3 Rebuild” when project data is missing. CleonAI chat chrome is in the template; it is UI, not a backend.

### Relationship graph physics

`relationship_graph.js` uses d3-force.

- **Reporting lines:** employee → manager (`manager_id`). Standard tension edges.
- **Peer / team lines (chain optimization):** peers who share a manager are linked in a single chain (A → B → C), **O(N)** not a clique **O(N²)**. Change that in `buildGraphData()` if “peer” should mean same department instead.

D3 is loaded from `https://d3js.org/d3.v7.min.js`. The graph needs that CDN.

### Organization analysis KPIs

1. **Total Teams** — count of unique managers in the currently filtered list. A team is “people who report to the same manager.”
2. **Avg. Span of Control** — headcount / teams. Example: 100 employees and 20 managers → 5.0.
3. **Employment type** — backend now prefers `sdir_employment_type` and falls back to native `employee_type`. The frontend should still only render, not guess.

---

## 12. Employee event history (`sdir.employee.event`)

Lightweight ledger for hire, promotion, transfer, performance_review, anniversary, other.

**What is true**

- Performance shown in the directory (latest rating / `progress_score`) is derived from the most recent `performance_review` event, **not** from `hr.employee.performance_score`.
- The Activity tab accordion is grouped by year from `_get_activity_timeline()`.

**What the older notes got wrong**

Promote and transfer do **not** create `sdir.employee.event` rows. They only post chatter and write `sdir_*` metadata. The timeline stays empty unless something else inserts events.

---

## 13. Work anniversary calculation

Handled in `_sd_people_list` (and similarly in leftover `_sd_upcoming_anniversaries`).

1. **Start date:** active contract `date_start`, else employee `create_date`.
2. **Projection:** anniversary in the current year; if already passed, bump to next year and increment `years`.
3. **Leap year:** Feb 29 in a non-leap year → Feb 28 (`ValueError` from `.replace()`).
4. **Render:** card only if `anniv_display` is set, and only for employees with more than 0 years.

Tenure label uses the same hire date: `2y 3m`, `2y`, `3m`, or `< 1m`.

---

## 14. Geocoding

`hr.work.location`: `latitude` / `longitude`.

- Query: location name with words like HQ/office/branch stripped, plus partner city/zip/country.
- Provider: Nominatim (`User-Agent: OdooHRStaffDirectory/1.0`), 1.1s sleep between calls, 429 → sleep 2s.
- Triggers: create, write of `name`/`address_id`, daily cron `ir_cron_geocode_work_locations`, `post_init_hook`.
- Form inherit is **not installed** (missing from manifest `data`).

---

## 15. Reusable toast (`hr_staff_directory.toast`)

Service-driven, no prop-drilling. Modeled on core `notification_service`: reactive state in a service + container in `main_components`.

| File | Owns |
|---|---|
| `static/src/components/toast/toast.js` | Service + `StaffDirectoryToast` |
| `toast.xml` | Template `hr_staff_directory.Toast` |
| `toast.css` | `.sdir-toast*` + `slideUpToast` |

1. `start()` creates `reactive({ isVisible, type, message })`.
2. Registers `SDIRToastContainer` in `main_components` (sequence 100) at the webclient root — one container for the whole session, `z-index: 10001` (above in-page modals at 9999).
3. `show()` mutates state and (re)starts the auto-hide timer.

```js
import { useService } from "@web/core/utils/hooks";

// in setup():
this.toast = useService("hr_staff_directory.toast");

// anywhere:
this.toast.show("success", "Segment saved!");
this.toast.show("warning", "Give the segment a name");
this.toast.show("error",   "Failed to send email. Please try again.");
this.toast.show("warning", "Slow operation finished", 5000);  // optional duration, default 3000ms
```

| Type | Look | Icon |
|---|---|---|
| `success` | Green (`#EAFBF1` / `#10b981`) | check |
| `warning` | Red (`#FDECEC` / `#E53E3E`) | exclamation |
| `error` | Strong red (`#FEF2F2` / `#DC2626`) | circle-x |

Fixed bottom-right, 360px, slides up, auto-dismiss 3s. A second call replaces the message and restarts the timer.

**Consumers:** dashboard (pin, CSV, email results), people_list (segment validation / compare placeholder), profile_panel (HR action results), message service (missing partner).

**Extend:** add `.sdir-toast-{type}` in CSS and one icon branch in XML. No JS change.

An earlier revision mounted the toast inside the dashboard template. That dies when the client action unmounts. `main_components` is the correct pattern.

---

## 16. Global toast override (notification service patch)

`static/src/components/toast/notification_patch.js` patches core `notificationService.start()` and intercepts `add()`.

- Maps `success` / `warning` / `danger` → `success` / `warning` / `error`.
- Sticky or button toasts fall back to the native notification (our toast cannot host actions).
- Loaded in `web.assets_backend`.

```javascript
import { patch } from "@web/core/utils/patch";
import { notificationService } from "@web/core/notifications/notification_service";

patch(notificationService, {
    start(env) {
        const result = super.start(env);
        const originalAdd = result.add;

        result.add = (message, options = {}) => {
            if (options.buttons || options.sticky) {
                return originalAdd(message, options);
            }

            let type = "info";
            if (options.type === "danger") type = "error";
            else if (options.type === "warning") type = "warning";
            else if (options.type === "success") type = "success";

            const customToast = env.services["hr_staff_directory.toast"];
            if (customToast) {
                customToast.show(type, message);
                return () => {};
            }

            return originalAdd(message, options);
        };

        return result;
    }
});
```

---

## 17. Message and mail services

Both are global (`main_components`). Sending is implemented (not “planned”).

### `hr_staff_directory.message`

Proxy onto native Discuss / WebRTC. Closes other chat windows and hides the mail modal first.

```js
this.messageService = useService("hr_staff_directory.message");

this.messageService.show({ partner_id: 123 });
this.messageService.show({ partner_id: 123 }, { startVideoCall: true });
this.messageService.showBulk([{ partner_id: 10 }, { partner_id: 11 }]);
```

- 1:1 → `mailThread.openChat({ partnerId })`
- Bulk → `discuss.core.common.createGroupChat({ partners_to })`
- Video → `discuss.rtc.toggleCall(thread, { video: true })`
- Missing `partner_id` → warning toast

### `hr_staff_directory.mail_modal`

Slide-up email composer. `show(profile)` pre-fills the recipient. Sends via `hr.employee.message_post`.

---

## 18. Chat window redesign

We restyle native `mail.ChatWindow`; we do not rewrite Discuss.

- `chat_window_patch.xml` + `chat_window_redesign.css`: 450px floating window, 12px radius, `rgb(240, 242, 245)` background.
- Header actions map native IDs `"call"`, `"settings"`, `"search"` and bind `action.onSelect()` (not `action.action()`) so WebRTC still routes.
- Composer spacing: forced flex + `gap: 8px` on `.o-mail-Composer-actions …`.

---

## 19. Permissions, password, lifecycle sync

Permissions map to native `res.groups`, not custom SSOT fields, because access lives on `res.users`.

**Guard:** no `user_id` → block grant/revoke/reset and toast.

| UI toggle | Group |
|---|---|
| View Employee Records | `hr.group_hr_user` |
| Edit Employee Records | `hr.group_hr_manager` |
| Manage Leave | `hr_holidays.group_hr_holidays_user` |
| View Budgets | `account.group_account_readonly` |
| System Settings | `base.group_system` |

Payroll / Expenses / Projects / HR Reports toggles are greyed out when there is no standard group.

**Implied groups.** HR Manager implies Time Off Officer. Unchecking “Manage Leave” while keeping “Edit Employee Records” re-grants Leave on reload. Deferred; would need `implied_ids` handling or a decoupled mapping.

**“Manage Leave” checked by default.** Internal User plus HR Manager structurally forces the holidays user group. Not a UI bug.

**Revoke.** Modes: specific or all. Reason is mandatory and posted to chatter. UI reverse-implied validation: revoking a low-level group while a high-level implied parent is still granted forces the parent off too.

**Reset password.**

- Email: `user.sudo().action_reset_password()`
- Temporary: frontend generates a 12-char password; backend `user.sudo().write({'password': temp_password})`
- Both post chatter. No user account → toast.

**Lifecycle vs native archive.** Directory modals keep `sdir_lifecycle_status` and `active` in sync. Archiving on the native employee form (`active=False`) does **not** update lifecycle. Future work: override archive (or a write watcher) to set Suspended/Terminated.

---

## 20. What is real vs still fake

**Real (Odoo records):** people, org tree, leave balances/history, pins, lifecycle/contact/transfer/promote/suspend/rehire, segments, geocode, Discuss/email, permission groups.

**Fake or approximated**

- `_mock_skills_for_employee()` when `skills` is empty (heatmap/bar depend on this)
- `_sd_training()` 60/25/15 split of resume lines (unused by current UI)
- Unset work modes redistributed 60/30/10 in leftover `_sd_work_location()`
- Performance fallback scores if no `sdir.employee.event` / `hr.appraisal`
- Smart Search team projects / some calendar copy
- CleonAI panel (chrome only)
- Workforce / Org Intelligence tabs

---

## 21. Known issues and traps

1. Promote/transfer do **not** write `sdir.employee.event` (older notes claimed they did).
2. `performance_score` and `sdir_grade` are not what the people table shows. Table uses event reviews and `grade_id`.
3. `/hr_staff_directory/data` overview is dead from the current frontend.
4. JSON controllers `sudo()` — no HR-group gate.
5. Missing / duplicated `@api.model` on several action methods.
6. Native archive does not update `sdir_lifecycle_status`.
7. Implied groups make Grant/Revoke toggles bounce.
8. People-list “retention priority” KPI ≠ `retention_priority` field.
9. Geocode form view not in the manifest.
10. Relationship graph depends on the d3js.org CDN.
11. Employment-type mix in leftover `_sd_employment_gender()` still counts native `employee_type` (`employee` / `student` / `freelance`), not `sdir_employment_type`.

---

## 22. Local development

### Seed data

`.gitignore` excludes `dev_seed.sql`, `dev_gender_update.sql`, `dev_generate_seed_all.py`, `seed_data/`, `*.csv`, `*.sql`. Those were used to populate realistic hierarchies for the visualizations; they are not shipped.

### Testing outgoing email (Mailpit)

Use a mock SMTP server so directory emails do not hit real inboxes.

1. Install: `sudo bash -c "$(curl -sL https://raw.githubusercontent.com/axllent/mailpit/refs/heads/master/install.sh)"`
2. Run `mailpit` — SMTP `1025`, UI `8025`.
3. Odoo → Settings → Technical → Outgoing Mail Servers:
   - SMTP Server: `localhost`, Port: `1025`, Connection Security: None, no auth.
4. Inspect mail at `http://localhost:8025`.

`views/mail_templates.xml` strips “Powered by Odoo” from `mail.mail_notification_layout` and the light layout.

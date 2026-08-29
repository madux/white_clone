# hr_staff_directory Module Study Notes

## 1. Overview
The hr_staff_directory module is a custom Odoo 17 addon designed to provide a comprehensive **Staff Directory Dashboard** alongside workforce analytics. It acts as an interactive, highly visual frontend for exploring and analyzing employee data within the CleonHR suite.

## 2. Frontend Architecture (OWL / UI Components)
This module relies heavily on Odoo's web framework (OWL) to render a modern dashboard. The assets are modularized in static/src/ and grouped into specific visualization components:

*   **geographic_map**: Renders employee locations on a map (this is where map_bg.svg resides).
*   **org_chart**: Visualizes the reporting structure (managers and direct reports).
*   **heatmap**: Used for cross-sectional data visualization (e.g., skills distribution).
*   **bar_chart**: Displays headcount trends and department distribution.
*   **people_list & profile_panel**: Handles the individual employee cards and detailed views.
*   **toast**: Service-driven reusable toast container, mounted globally (see §7).
*   **staff_directory_dashboard.js**: The main orchestrator that fetches data and mounts these sub-components.

## 3. Backend Architecture (Python Models)
### Extending hr.employee
The module extends the base hr.employee model (models/hr_employee.py). Its most significant addition is the @api.model method _get_staff_directory_data. 

This method acts as the primary data provider for the frontend dashboard. It queries the employee records and constructs a dense dictionary of formatted data for each person, including:
*   **Core Info:** Name, Job Title, Department, Manager, Direct Reports count.
*   **Computed Tenure:** Dynamically calculates how long an employee has been with the company (e.g., 2y 3m or < 1m).
*   **Pinning System:** It checks emp.pinned_by_user_ids to determine if the current user has bookmarked/pinned an employee (is_pinned).
*   **Temporary Mock Data:** Interestingly, the method currently generates **mock data** for certain analytics to ensure the dashboard looks populated:
    *   progress_score: A pseudo-random integer.
    *   skills: Uses a deterministic helper method (_mock_skills_for_employee) to assign skills like "AWS", "B2B Sales", or "Operational Risk" based on the employee's ID and department. This is explicitly marked with a TODO to wire up to real performance/skill fields later.

### Other Models
*   hr_work_location.py: Likely extends the work location model, possibly adding coordinate data (latitude/longitude) required by the geographic_map component.

## 4. Development & Seed Data
The directory contains scripts like dev_seed.sql, dev_gender_update.sql, and dev_generate_seed_all.py. This indicates that the developers built a robust scaffolding system to generate realistic dummy data (names, hierarchies, skills) to test the complex dashboard visualizations during development.

## 5. Relationship Network Graph Physics & Architecture
The **relationship_graph** component uses d3.js (specifically d3-force) to simulate a force-directed network layout. This layout provides an interactive, physical simulation where nodes naturally float and adjust themselves.

### Linkage Strategies
*   **Reporting Lines:** Represented as direct links from an Employee to their Manager (based on manager_id). These act as standard tension lines in the physics simulation.
*   **Peer / Team Lines (Chain Optimization):** Instead of creating a complete graph (a clique) where every team member is connected to every other team member—which creates an (N^2)$ explosion of intersecting lines that crushes browser physics engines—peers are grouped by their shared manager and linked sequentially in a **single continuous chain** (A ➔ B ➔ C). This (N)$ optimization keeps the physics simulation incredibly lightweight while still ensuring the forces pull the entire team into a distinct, cohesive visual cluster on the canvas.
* If you ever want to change this logic (for instance, if you want peers to mean "people in the same Department" instead of "people with the same Manager"), that logic lives right inside the buildGraphData() function in **relationship_graph.js**

## 6. Organization Analysis KPIs
1. Total Teams
The Logic: I count the number of unique managers across the currently filtered list of employees.
The Rationale: In most organizational structures, a "team" is defined by a group of people reporting to a single manager. By counting how many distinct manager_ids exist in the current data, we get a highly accurate proxy for the number of active teams.
2. Avg. Span of Control
The Logic: I divide the Total Headcount by the Total Teams (the unique manager count from above).
The Rationale: "Span of control" is an HR metric that represents the average number of direct reports a manager is responsible for. For example, if you have 100 employees and 20 managers (teams), the average span of control is 100 / 20 = 5.0. This gives leadership a quick pulse on whether managers are stretched too thin or if the organization is too top-heavy.
If your organization has a different specific definition for what constitutes a "Team" (for example, if you have a dedicated team_id field on the employee record that differs from their manager), or if you want "Span of Control" calculated differently, we can easily tweak that logic before we move on to the charts!

3. Employment Type Mix (Backend Note)
Currently, the backend Python model simply passes the raw `employee_type` field directly to the frontend. If `employee_type` is empty or lacks robust contract/employment status checking, the frontend is forced to guess using fallback logic (e.g., checking if `contract_id` exists). 
**Note for Backend Developer:** Please ensure that any business logic for calculating the exact "Employment Type" (Permanent, Contract, Intern, etc.) is implemented in the `models/hr_employee.py` backend model. The `hr_staff_directory` module strictly relies on the **Single Source of Truth** approach—the frontend should only be responsible for rendering the data, not deducing it.

## 7. Reusable Toast Mechanism (Service-Driven)
The module ships a shared, animated toast notification system that **any component can raise from anywhere** — no prop-drilling, no local state, no per-template wiring. It is modeled directly on Odoo core's `notification_service` pattern (reactive state inside a service + a container registered in the `main_components` registry).

### Files
| File | Owns |
|---|---|
| `static/src/components/toast/toast.js` | `hr_staff_directory.toast` **service** (reactive state + `show()` API + container registration) and the `StaffDirectoryToast` OWL component |
| `static/src/components/toast/toast.xml` | Template `hr_staff_directory.Toast` (icon + message markup) |
| `static/src/components/toast/toast.css` | All `.sdir-toast*` rules + the `slideUpToast` keyframes (moved out of staff_directory.css) |

### How It Works
1. The service's `start()` creates a module-wide **reactive singleton**: `reactive({ isVisible, type, message })`.
2. The same `start()` registers the container once in the **`main_components` registry** (`SDIRToastContainer`, sequence 100). The webclient mounts main components at its **root**, so exactly one toast container exists for the whole session — independent of which client action is open. This is also why the toast reliably renders *above* in-page modals: it is `position: fixed; z-index: 10001` at the webclient root, while e.g. the New Segment modal overlay sits at `z-index: 9999`.
3. The reactive state object is passed to the container **as a prop** (the core-proven reactivity path — same as `props: { notifications }` in core's notification service). Mutating it re-renders the container.
4. Calling `show()` mutates the state (`isVisible = true`, type, message) and (re)starts the auto-hide timer.

### Usage (copy-paste for developers)
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

### Toast Types
| Type | Look | Icon |
|---|---|---|
| `success` | Green (`#EAFBF1` / `#10b981`) | check |
| `warning` | Red (`#FDECEC` / `#E53E3E`) | exclamation |
| `error`   | Strong red (`#FEF2F2` / `#DC2626`) | circle-x |

Behavior: fixed bottom-right, 360px, slides up (`slideUpToast`), auto-dismisses after 3s; a rapid second call replaces the message and restarts the timer.

### Current Consumers
*   **staff_directory_dashboard.js** — pin/unpin results, CSV export, email send results (`_reportEmailResult`).
*   **people_list.js** — Compare-Segments placeholder toast and the two save-segment validation guards ("Give the segment a name" / "Fill in all condition values").

### Extending
Adding a new toast type requires **no JS changes**: add `.sdir-toast-{type}` color rules in `toast.css` and one icon branch (`<svg t-if="state.type === '...'" .../>`) in `toast.xml`.

### Design Note — why `main_components`?
An earlier revision mounted the container inside the dashboard's template. That couples the toast to a single client action (it disappears when the action unmounts) and relies on a child component subscribing to service state through a getter. Registering in `main_components` — exactly what core's `notification_service` does — guarantees one always-mounted container at the webclient root, making `show()` truly global and the reactivity path identical to core.


## 8. Reusable Message and Mail Modals (Service-Driven)
The module provides reusable UI components for sending Direct Messages and Emails. Just like the Toast component, these are mounted as global services in the `main_components` registry. Any component can trigger them without prop-drilling or template wiring.

### The Message Component (`hr_staff_directory.message`)
This provides a custom, pixel-perfect floating message box (similar to standard Odoo Discuss UI but customized for this module).
*   **Usage**:
    ```js
    import { useService } from "@web/core/utils/hooks";
    
    // in setup():
    this.messageModal = useService("hr_staff_directory.message");
    
    // anywhere (pass the employee's profile object):
    this.messageModal.show(activeProfile);
    ```

### The Mail Modal Component (`hr_staff_directory.mail_modal`)
This provides a sleek, slide-up-from-bottom email composer modal.
*   **Usage**:
    ```js
    import { useService } from "@web/core/utils/hooks";
    
    // in setup():
    this.mailModal = useService("hr_staff_directory.mail_modal");
    
    // anywhere (pass the employee's profile object):
    this.mailModal.show(activeProfile);
    ```

### How They Work
1. The services `start()` create reactive singletons and register containers (`SDIRMessageContainer` and `SDIRMailModalContainer`) in the `main_components` registry.
2. The UI logic handles toggling `isVisible` and pre-filling the target recipient's details based on the `profile` object passed to `.show(profile)`.
3. (Planned) The actual sending of the message/email will execute headless RPC calls to Odoo's `discuss.channel` backend.


## 9. Local Development: Testing Outgoing Emails

When developing modules that send real emails in Odoo, it is critical to use a mock SMTP server to prevent accidentally emailing real users or crashing the email queue with "Connection Refused" exceptions.

**Mailpit** is the recommended tool. It runs a local SMTP server and provides a web interface to inspect all sent emails.

### Setting up Mailpit in WSL/Linux:

1. **Install Mailpit:**
   ```bash
   sudo bash -c "$(curl -sL https://raw.githubusercontent.com/axllent/mailpit/refs/heads/master/install.sh)"
   ```

2. **Run Mailpit:**
   Start the server by running `mailpit` in your terminal. It will occupy port `1025` for SMTP and `8025` for the web UI.

3. **Configure Odoo:**
   - Enable **Developer Mode**.
   - Navigate to **Settings -> Technical -> Outgoing Mail Servers**.
   - Create a new record:
     - **Description:** Local Mailpit
     - **SMTP Server:** `localhost`
     - **SMTP Port:** `1025`
     - **Connection Security:** None
   - Leave the username and password blank.
   - Click **Test Connection** to verify.

Once configured, all emails routed via `mail.mail` or `message_post` will be delivered to Mailpit. You can view the full HTML emails at `http://localhost:8025`.

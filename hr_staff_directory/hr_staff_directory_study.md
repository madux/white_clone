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

### Job Title (`job_title`) vs Job Position (`job_id`)
We deliberately use `hr_employee.job_title` (a Char field) instead of `hr_employee.job_id` (a Many2one to `hr.job`) as the **Single Source of Truth** for the employee's role in the directory.
* **Why:** In Odoo, `job_id` is a structural field used heavily by the Recruitment app for managing open headcount and formal job descriptions. Many companies leave it empty or use highly generic categories (e.g., all developers share the "Software Engineer" `job_id`). 
* **The Solution:** The free-text `job_title` field acts as the exact "Business Card" title. By relying on it, the Staff Directory ensures it displays exactly what the person is actually called internally, circumventing missing or rigid structural data.

### Lifecycle Status (`sdir_lifecycle_status`)
We deliberately use a custom Selection field `sdir_lifecycle_status` on `hr.employee` as the **Single Source of Truth** for the employee's lifecycle state (Active, Probation, On Leave, Suspended, Terminated, Exiting, Alumni) rather than relying on native Odoo structures like `hr.contract` and `hr.leave`.
* **Why:** While Odoo normally derives states like "Probation" from a Contract's trial dates, or "On Leave" from active Time Off requests, generating full legal contracts and leave requests just to update a visual dashboard badge is poor UX for an HR Admin managing the directory. 
* **The Solution:** The Staff Directory relies solely on `sdir_lifecycle_status`. When an admin changes the status to "Terminated" or "Alumni" via the directory modal, the backend automatically flips the native Odoo `active = False` field so they are properly hidden from standard Odoo views, maintaining system-wide consistency while offering a streamlined interface.

### Employee Profile Photo (`image_1920`)
Unlike other metadata fields where we've created custom variables (like `job_title` instead of `job_id`), the **Single Source of Truth** for the employee's profile photo remains Odoo's native `image_1920` field.
* **Why:** Odoo's `image.mixin` natively handles uploading a high-resolution image to `image_1920` and automatically generates scaled-down optimized variants (`avatar_128`, `image_512`, etc.) behind the scenes.
* **The Solution:** By writing the base64 image data directly to `image_1920` from the Staff Directory's "Update Profile Photo" modal, the photo instantly propagates across all Odoo apps, chatter, and standard forms without any extra logic required.

### Contact Information
The "Edit Contact Information" modal updates the employee's contact details adhering to a mix of native Odoo fields and custom SSOT fields depending on complexity:
* **Native Fields:** We strictly use the native `work_email`, `work_phone`, `emergency_contact`, and `emergency_phone` fields as the SSOT. They map 1:1 with Odoo's standard design.
* **Custom Field - `sdir_home_address` (Text):** Base Odoo natively manages home addresses via a complex Many2one relationship to a `res.partner` (`address_home_id`). To keep the Staff Directory streamlined, we bypass this by using a simple `sdir_home_address` Text field.
* **Custom Field - `sdir_emergency_relationship` (Char):** Base Odoo is entirely missing a field to store the relationship of the emergency contact (e.g. "Spouse"). We created `sdir_emergency_relationship` to serve as this SSOT.

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


## 10. Chat Window UI Redesign & Service Proxy

The module deeply redesigns the native Odoo `mail.ChatWindow` component to look incredibly modern and premium, while carefully preserving all underlying WebRTC, Discuss, and Thread logic.

### 10.1 UI Customization via XPath and CSS
Instead of reinventing the complex Odoo messaging and WebRTC wheel, we extended the native `mail.ChatWindow` using `xpath` (in `chat_window_patch.xml`) and injected a highly specific CSS layer (`chat_window_redesign.css`).
*   **The Overrides**: We aggressively override the native layout, stripping out Odoo's default borders and box-shadows. We force the chat window to be 450px wide, floating, with 12px border radii and a clean `rgb(240, 242, 245)` background.
*   **Action Buttons**: The native Odoo action icons (Call, Settings) were missing or misplaced. We patched the XML `t-if` condition to correctly map the `"call"`, `"settings"`, and `"search"` native Odoo action IDs so they seamlessly render in our custom header. Crucially, we bind these clicks to `action.onSelect()` rather than `action.action()`, ensuring Odoo's internal JS continues to route WebRTC requests properly.
*   **Composer Gaps**: We targeted deep internal DOM elements (`.o-mail-Composer-actions .d-flex.flex-grow-1.align-items-center`) to inject `gap: 8px !important;` alongside forced flexbox layouts, making the emoji, attachment, and voice recorder buttons perfectly spaced.

### 10.2 The Proxy Service (`hr_staff_directory.message`)
To control the lifecycle of this redesigned chat window and prevent UI overlapping, we built a proxy service: `hr_staff_directory.message`.

When a user clicks "Message", "Call", or "Video Call", they do not trigger Odoo directly. Instead, they call our service, which safely orchestrates the launch:
1.  **Mutual Exclusivity**: It aggressively sweeps `chatWindowService.visible` and closes any currently open chat boxes, ensuring only one chat is open at a time. It also forces the `mailModalService` (Email Box) to hide.
2.  **1-on-1 Chats**: For a single target, it invokes the native `mailThread.openChat({ partnerId: ID })`.
3.  **Group/Bulk Chats**: When triggered from the "Message All" button on the table or inside a Segment, the service's `showBulk(profiles)` method intercepts. If multiple users are passed, it seamlessly proxies the array of `partner_id`s to Odoo's native `discuss.core.common.createGroupChat({ partners_to: partnerIds })`. This spins up a native group chat without any backend RPC boilerplate on our end.
4.  **Auto-Video Call Integration**: If triggered with the `{ startVideoCall: true }` option (e.g., from the Video Call button), the service awaits the chat window, resolves the `thread`, and automatically triggers `rtc.toggleCall(thread, { video: true })` via `discuss.rtc`, dropping the user directly into a live camera feed.

### 10.3 How Other Devs Can Trigger It
Other modules or custom components in Odoo 17 can easily leverage this proxy to trigger our redesigned chat window or initiate a native WebRTC video call.

**Triggering a 1-on-1 Chat / Video Call:**
```javascript
import { useService } from "@web/core/utils/hooks";

// In your setup():
this.messageService = useService("hr_staff_directory.message");

// Trigger a normal chat:
this.messageService.show({ partner_id: 123 });

// Trigger an instant WebRTC Video Call:
this.messageService.show({ partner_id: 123 }, { startVideoCall: true });
```

**Triggering a Bulk Group Chat:**
```javascript
import { useService } from "@web/core/utils/hooks";

this.messageService = useService("hr_staff_directory.message");

// Pass an array of objects containing partner_ids
const selectedUsers = [
    { partner_id: 10 },
    { partner_id: 11 },
    { partner_id: 12 }
];
this.messageService.showBulk(selectedUsers);
```

## 11. Global Toast Override (Notification Service Patch)

To ensure visual consistency across the entire dashboard and module, we surgically overridden Odoo's native `notification_service`. This guarantees that if any underlying Odoo core components (like the ORM or Discuss module) throw a standard toast notification, they are instantly hijacked and rendered using our custom, premium `.sdir-toast` component instead.

### 11.1 How It Works
We leverage Odoo's native `@web/core/utils/patch` utility in a dedicated file `static/src/components/toast/notification_patch.js`.

1. **Monkey Patching**: We hook into `notificationService.start()` and intercept its `add()` method.
2. **Type Mapping**: Odoo's native `type` attributes (`success`, `warning`, `danger`, `info`) are dynamically mapped to our custom toast styles (`success`, `warning`, `error`, `info`).
3. **Smart Fallback**: The native Odoo notification system supports interactive toasts (with buttons) or "sticky" toasts that require explicit dismissal. Because our custom toast is designed for simple, auto-dismissing visual alerts, the patch intelligently inspects the incoming arguments. If a toast requires buttons or is sticky, the patch seamlessly falls back to the native Odoo notification component, ensuring that critical functionality never breaks.

### 11.2 The Implementation
```javascript
import { patch } from "@web/core/utils/patch";
import { notificationService } from "@web/core/notifications/notification_service";

patch(notificationService, {
    start(env) {
        const result = super.start(env);
        const originalAdd = result.add;
        
        result.add = (message, options = {}) => {
            // Fallback for sticky or actionable toasts since our custom toast is simple auto-closing
            if (options.buttons || options.sticky) {
                return originalAdd(message, options);
            }
            
            // Map Odoo's native types to our custom toast
            let type = "info";
            if (options.type === "danger") type = "error";
            else if (options.type === "warning") type = "warning";
            else if (options.type === "success") type = "success";
            
            const customToast = env.services["hr_staff_directory.toast"];
            if (customToast) {
                customToast.show(type, message);
                return () => {}; // return dummy close function
            }
            
            return originalAdd(message, options);
        };
        
        return result;
    }
});
```
This patch script is then registered directly into the `__manifest__.py` under the `web.assets_backend` bundle so it loads seamlessly with the Odoo webclient.
/** @odoo-module **/
/**
 * Company Calendar — Form Controller + Calendar Renderer
 * File: /static/src/js/company_calendar_form.js
 *
 * Registers:
 *   - js_class="company_calendar_form"  (FormController override)
 *   - Tab switching (Events / Meetings / Announcements / Chat)
 *   - Calendar sub-view switching (List / Month / Week / Day)
 *   - Calendar renderers (pure JS, no external deps)
 *   - Server action trigger on wizard open
 */

import { FormController } from "@web/views/form/form_controller";
import { registry }       from "@web/core/registry";
import { patch }          from "@web/core/utils/patch";
import { useService }     from "@web/core/utils/hooks";
import { onMounted, onWillUnmount } from "@odoo/owl";

// ─── helpers ──────────────────────────────────────────────────────────────────

const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June",
                "July","August","September","October","November","December"];

function fmt(d){ return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function isSameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

// ─── Calendar renderers ───────────────────────────────────────────────────────

function renderMonth(container, date, events=[]) {
    const today = new Date();
    const yr = date.getFullYear(), mo = date.getMonth();
    const first = new Date(yr, mo, 1);
    const startDay = first.getDay();   // 0=Sun
    const daysInMonth = new Date(yr, mo+1, 0).getDate();
    const daysInPrev  = new Date(yr, mo, 0).getDate();

    let html = `
      <div class="cc_month_daynames">
        ${DAYS.map(d=>`<div class="cc_month_dayname">${d}</div>`).join("")}
      </div>
      <div class="cc_month_weeks">`;

    let day = 1 - startDay;   // could be negative (prev month)
    for(let week=0; week<6; week++){
        // skip last row if it's entirely next-month
        if(day > daysInMonth) break;
        html += `<div class="cc_month_week">`;
        for(let col=0; col<7; col++, day++){
            let cellDate, otherCls="";
            if(day<=0){
                cellDate = new Date(yr, mo-1, daysInPrev + day);
                otherCls = "other-month";
            } else if(day > daysInMonth){
                cellDate = new Date(yr, mo+1, day - daysInMonth);
                otherCls = "other-month";
            } else {
                cellDate = new Date(yr, mo, day);
            }
            const todayCls = isSameDay(cellDate, today) ? "today" : "";
            const evts = events.filter(e => isSameDay(new Date(e.start), cellDate));
            const evtHtml = evts.slice(0,2).map(e=>
                `<div class="cc_day_event">${e.name}</div>`
            ).join("") + (evts.length>2 ? `<div class="cc_day_event">+${evts.length-2} more</div>` : "");
            html += `
              <div class="cc_month_day ${otherCls} ${todayCls}">
                <div class="cc_day_num">${cellDate.getDate()}</div>
                ${evtHtml}
              </div>`;
        }
        html += `</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function renderWeek(container, date, events=[]) {
    const today = new Date();
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());

    // header row
    let headerHtml = `<div class="cc_week_time_col" style="border-bottom:1.5px solid var(--cc-gray-200);background:var(--cc-gray-50)"></div>`;
    for(let d=0; d<7; d++){
        const cur = new Date(startOfWeek); cur.setDate(startOfWeek.getDate()+d);
        const todayCls = isSameDay(cur, today) ? "today" : "";
        headerHtml += `<div class="cc_week_day_header ${todayCls}">${DAYS[d]}<br>${cur.getDate()}</div>`;
    }

    let slotsHtml = "";
    for(let h=7; h<=19; h++){
        slotsHtml += `<div class="cc_week_time_label">${h}:00</div>`;
        for(let d=0; d<7; d++){
            const cur = new Date(startOfWeek); cur.setDate(startOfWeek.getDate()+d);
            const slotEvts = events.filter(e => {
                const es = new Date(e.start);
                return isSameDay(es, cur) && es.getHours()===h;
            });
            const evtHtml = slotEvts.map(e=>
                `<div class="cc_week_event">${e.name}</div>`
            ).join("");
            slotsHtml += `<div class="cc_week_slot">${evtHtml}</div>`;
        }
    }
    container.innerHTML = headerHtml + slotsHtml;
}

function renderDay(container, date, events=[]) {
    const dayEvents = events.filter(e => isSameDay(new Date(e.start), date));
    let html = "";
    for(let h=7; h<=19; h++){
        const label = h < 12 ? `${h} AM` : h===12 ? `12 PM` : `${h-12} PM`;
        const slotEvts = dayEvents.filter(e => new Date(e.start).getHours() === h);
        const evtHtml = slotEvts.map(e=>{
            const start = new Date(e.start), end = new Date(e.stop||e.start);
            return `<div class="cc_day_event_block">
                      ${e.name}
                      <div style="font-size:10.5px;font-weight:400;margin-top:2px">
                        ${start.getHours()}:${String(start.getMinutes()).padStart(2,"0")} –
                        ${end.getHours()}:${String(end.getMinutes()).padStart(2,"0")}
                      </div>
                    </div>`;
        }).join("");
        html += `<div class="cc_day_time">${label}</div>
                 <div class="cc_day_col">${evtHtml}</div>`;
    }
    container.innerHTML = html;
}

// ─── Form Controller patch ────────────────────────────────────────────────────

export class CompanyCalendarController extends FormController {
    setup() {
        super.setup();
        this.orm     = useService("orm");
        this.action  = useService("action");

        // Calendar state
        this._currentDate  = new Date();
        this._currentCalView = "list";  // list | month | week | day
        this._cachedEvents = [];

        onMounted(() => this._onMount());
        onWillUnmount(() => this._onDestroy());
    }

    async _onMount() {
        const root = this.el;
        if (!root) return;

        // 1. Trigger server action to auto-populate transient model
        await this._autoLoadData();

        // 2. Wire tab navigation
        this._bindTabs(root);

        // 3. Wire calendar sub-nav
        this._bindCalNav(root);

        // 4. Render initial calendar (month view pre-renders silently)
        await this._loadEvents();
        this._renderCurrentCal(root);
    }

    _onDestroy() { /* cleanup if needed */ }

    // ── Auto-load via server action ──────────────────────────────────────────
    async _autoLoadData() {
        try {
            const recordId = this.model.root.resId;
            if (recordId) {
                await this.orm.call(
                    "company.calendar.dashboard",
                    "action_load_data",
                    [[recordId]]
                );
                // Re-read the record so field values reflect the populated data
                await this.model.root.load();
            }
        } catch(e) {
            console.warn("CompanyCalendar: auto-load failed", e);
        }
    }

    // ── Load calendar.event records ──────────────────────────────────────────
    async _loadEvents() {
        try {
            this._cachedEvents = await this.orm.searchRead(
                "calendar.event",
                [["start", ">=", new Date(this._currentDate.getFullYear(), this._currentDate.getMonth()-1, 1).toISOString()]],
                ["name","start","stop","description","categ_ids"],
                { limit: 200 }
            );
        } catch(e) {
            this._cachedEvents = [];
        }
    }

    // ── Tab switching ────────────────────────────────────────────────────────
    _bindTabs(root) {
        root.querySelectorAll(".cc_tab").forEach(btn => {
            btn.addEventListener("click", () => {
                const tab = btn.dataset.tab;

                root.querySelectorAll(".cc_tab").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                root.querySelectorAll(".cc_panel").forEach(p => p.classList.remove("active"));
                const panel = root.querySelector(`#cc_panel_${tab}`);
                if (panel) panel.classList.add("active");
            });
        });
    }

    // ── Calendar sub-nav ─────────────────────────────────────────────────────
    _bindCalNav(root) {
        root.querySelectorAll(".cc_cal_btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const mode = btn.dataset.cal;
                this._currentCalView = mode;

                root.querySelectorAll(".cc_cal_btn").forEach(b => b.classList.remove("active"));
                btn.classList.add("active");

                root.querySelectorAll(".cc_cal_panel").forEach(p => p.classList.remove("active"));
                const panel = root.querySelector(`#cc_cal_${mode}`);
                if (panel) {
                    panel.classList.add("active");
                    this._renderCurrentCal(root);
                }
            });
        });

        // Prev / Next / Today navigation
        this._bindNavBtn(root, "#cc_month_prev",  () => { this._currentDate.setMonth(this._currentDate.getMonth()-1);   this._refreshCal(root,"month"); });
        this._bindNavBtn(root, "#cc_month_next",  () => { this._currentDate.setMonth(this._currentDate.getMonth()+1);   this._refreshCal(root,"month"); });
        this._bindNavBtn(root, "#cc_week_prev",   () => { this._currentDate.setDate(this._currentDate.getDate()-7);     this._refreshCal(root,"week"); });
        this._bindNavBtn(root, "#cc_week_next",   () => { this._currentDate.setDate(this._currentDate.getDate()+7);     this._refreshCal(root,"week"); });
        this._bindNavBtn(root, "#cc_day_prev",    () => { this._currentDate.setDate(this._currentDate.getDate()-1);     this._refreshCal(root,"day"); });
        this._bindNavBtn(root, "#cc_day_next",    () => { this._currentDate.setDate(this._currentDate.getDate()+1);     this._refreshCal(root,"day"); });

        // Today buttons (all three)
        root.querySelectorAll(".cc_cal_btn_today").forEach(btn => {
            btn.addEventListener("click", () => {
                this._currentDate = new Date();
                this._refreshCal(root, this._currentCalView);
            });
        });
    }

    _bindNavBtn(root, selector, cb) {
        const btn = root.querySelector(selector);
        if (btn) btn.addEventListener("click", () => { cb(); });
    }

    async _refreshCal(root, mode) {
        await this._loadEvents();
        this._renderCalView(root, mode);
    }

    _renderCurrentCal(root) {
        this._renderCalView(root, this._currentCalView);
    }

    _renderCalView(root, mode) {
        const d = this._currentDate;
        const evts = this._cachedEvents;

        if (mode === "month") {
            const grid = root.querySelector("#cc_month_grid");
            const label = root.querySelector("#cc_month_label");
            if (grid)  renderMonth(grid, d, evts);
            if (label) label.textContent = `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
        }
        if (mode === "week") {
            const grid = root.querySelector("#cc_week_grid");
            const label = root.querySelector("#cc_week_label");
            if (grid) renderWeek(grid, d, evts);
            if (label) {
                const sow = new Date(d); sow.setDate(d.getDate()-d.getDay());
                const eow = new Date(sow); eow.setDate(sow.getDate()+6);
                label.textContent = `${sow.getDate()} ${MONTHS[sow.getMonth()]} – ${eow.getDate()} ${MONTHS[eow.getMonth()]} ${sow.getFullYear()}`;
            }
        }
        if (mode === "day") {
            const grid = root.querySelector("#cc_day_grid");
            const label = root.querySelector("#cc_day_label");
            if (grid) renderDay(grid, d, evts);
            if (label) label.textContent = fmt(d);
        }
    }
}

// Register
registry.category("views").add("company_calendar_form", {
    ...registry.category("views").get("form"),
    Controller: CompanyCalendarController,
});
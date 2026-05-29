/** @odoo-module **/

import { registry }   from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Component, useState, onWillStart } from "@odoo/owl";

// ── Odoo 17 date helpers (no luxon import needed) ─────────────────────────────
import { deserializeDate, deserializeDateTime } from "@web/core/l10n/dates";

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEKDAYS   = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOT_COLORS = [
    "#875a7b", "#00a09d", "#f06050",
    "#f4a261", "#2a9d8f", "#264653",
];

// ─── Pure-JS date helpers (no luxon) ─────────────────────────────────────────

/** "2024-04-01" */
function toISODate(year, month, day) {
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Days in a given month (JS months are 0-based → day-0 trick). */
function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();   // month is 1-based here
}

/** Today as ISO string "YYYY-MM-DD". */
function todayISO() {
    const d = new Date();
    return toISODate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** Day-of-week (0=Sun) for the 1st of a month. */
function firstDayOfWeek(year, month) {
    return new Date(year, month - 1, 1).getDay();
}

/** Build 42-slot calendar grid for a month. */
function buildGrid(year, month, events) {
    const today  = todayISO();
    const total  = daysInMonth(year, month);
    const offset = firstDayOfWeek(year, month);
    const slots  = [];

    for (let i = 0; i < offset; i++)
        slots.push({ inMonth: false, key: `pre-${i}` });

    for (let d = 1; d <= total; d++) {
        const dateStr = toISODate(year, month, d);
        slots.push({
            inMonth:  true,
            day:      d,
            dateStr,
            isToday:  dateStr === today,
            events:   events.filter(e => e.startDate <= dateStr && e.stopDate >= dateStr),
            key:      dateStr,
        });
    }

    const tail = 42 - slots.length;
    for (let i = 0; i < tail; i++)
        slots.push({ inMonth: false, key: `post-${i}` });

    return slots;
}

/** Format "YYYY-MM-DD HH:MM:SS" for ORM domain / context values. */
function toOdooDatetime(year, month, day, hour = 0, minute = 0) {
    return `${toISODate(year, month, day)} ${String(hour).padStart(2,"0")}:${String(minute).padStart(2,"0")}:00`;
}

/** Month name from JS (no luxon). */
function monthName(year, month) {
    return new Date(year, month - 1, 1)
        .toLocaleString("en-US", { month: "long", year: "numeric" });
}

// ─── Component ────────────────────────────────────────────────────────────────

class CalendarFieldWidget extends Component {
    static template = "calendar_field_widget.CalendarFieldWidget";
    static props = {
        name:     { type: String },
        record:   { type: Object },
        readonly: { type: Boolean, optional: true },
        value:    { optional: true },
        "*":      true,
    };

    setup() {
        this.orm           = useService("orm");
        this.actionService = useService("action");
        this.WEEKDAYS      = WEEKDAYS;

        const now = new Date();
        this.state = useState({
            year:    now.getFullYear(),
            month:   now.getMonth() + 1,   // 1-based
            events:  [],
            loading: false,
        });

        onWillStart(() => this._loadEvents());
    }

    // ── Computed ──────────────────────────────────────────────────────────────

    get selectedDateStr() {
        const v = this.props.value;
        // props.value is a luxon DateTime from Odoo – call toISODate() safely
        return v && typeof v.toISODate === "function" ? v.toISODate() : null;
    }

    get monthLabel() {
        return monthName(this.state.year, this.state.month);
    }

    get calendarGrid() {
        return buildGrid(this.state.year, this.state.month, this.state.events);
    }

    // ── Event loading ─────────────────────────────────────────────────────────

    async _loadEvents() {
        this.state.loading = true;
        try {
            const { year, month } = this.state;
            const firstStr = toOdooDatetime(year, month, 1);
            const lastStr  = toOdooDatetime(year, month, daysInMonth(year, month), 23, 59);

            const raw = await this.orm.searchRead(
                "calendar.event",
                [
                    ["start", "<=", lastStr],
                    ["stop",  ">=", firstStr],
                ],
                ["name", "start", "stop"],
                { limit: 100 }
            );

            this.state.events = raw.map((e) => ({
                id:        e.id,
                name:      e.name,
                color:     DOT_COLORS[e.id % DOT_COLORS.length],
                startDate: (e.start || "").split(" ")[0],
                stopDate:  (e.stop  || "").split(" ")[0],
            }));
        } catch (err) {
            console.error("[CalendarFieldWidget] load error:", err);
            this.state.events = [];
        }
        this.state.loading = false;
    }

    // ── Navigation ────────────────────────────────────────────────────────────

    prevMonth() {
        if (this.state.month === 1) { this.state.month = 12; this.state.year--; }
        else this.state.month--;
        this._loadEvents();
    }

    nextMonth() {
        if (this.state.month === 12) { this.state.month = 1; this.state.year++; }
        else this.state.month++;
        this._loadEvents();
    }

    goToToday() {
        const now = new Date();
        this.state.year  = now.getFullYear();
        this.state.month = now.getMonth() + 1;
        this._loadEvents();
    }

    // ── Day interaction ───────────────────────────────────────────────────────

    onDayClick(slot) {
        if (!slot.inMonth || this.props.readonly) return;

        // Convert ISO string → luxon DateTime via Odoo's helper (no direct luxon import)
        const fieldType = this.props.record.fields[this.props.name]?.type;
        const luxonVal  = fieldType === "datetime"
            ? deserializeDateTime(slot.dateStr + " 00:00:00")
            : deserializeDate(slot.dateStr);

        this.props.record.update({ [this.props.name]: luxonVal });
    }

    async onDayDblClick(slot) {
        if (!slot.inMonth) return;
        await this.actionService.doAction({
            type:      "ir.actions.act_window",
            res_model: "calendar.event",
            views:     [[false, "form"]],
            target:    "new",
            context: {
                default_start: toOdooDatetime(
                    this.state.year, this.state.month, slot.day, 0, 0),
                default_stop:  toOdooDatetime(
                    this.state.year, this.state.month, slot.day, 1, 0),
            },
        });
        this._loadEvents();
    }

    async onEventClick(ev, event) {
        ev.stopPropagation();
        await this.actionService.doAction({
            type:      "ir.actions.act_window",
            res_model: "calendar.event",
            res_id:    event.id,
            views:     [[false, "form"]],
            target:    "new",
        });
        this._loadEvents();
    }

    openOdooCalendar() {
        this.actionService.doAction("calendar.action_calendar_event");
    }
}

// ─── Register ─────────────────────────────────────────────────────────────────

registry.category("fields").add("calendar_field_widget", {
    component:      CalendarFieldWidget,
    supportedTypes: ["date", "datetime"],
});

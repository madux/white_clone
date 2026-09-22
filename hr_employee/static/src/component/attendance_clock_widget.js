/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";

const { DateTime } = luxon;

/**
 * AttendanceClockWidget
 * ----------------------
 * A non-field Owl widget (registered under "view_widgets") that renders
 * a live-ticking attendance clock: today's date, an HH:MM:SS session
 * timer, current wall-clock time, and a small stats row.
 *
 * It reads several sibling fields off the record rather than being
 * bound to a single field, so declare it in the view like:
 *
 *   <widget name="attendance_clock"/>
 *
 * Expected fields on the model (all optional — the widget degrades
 * gracefully if any are missing):
 *   - work_start_datetime  (Datetime)  when the current session began
 *   - is_present            (Boolean)   true while clocked in
 *   - total_work_duration   (Float)     stored session hours (fallback
 *                                       once clocked out, or if
 *                                       work_start_datetime is empty)
 *   - hours_today           (Float)     today's total, for the stat card
 *   - overtime_hours        (Float)     overtime, for the stat card
 *   - hours_week            (Float)     week total, for the stat card
 *   - shift_label           (Char)      e.g. "Morning Shift · 09:00 – 17:00"
 */
export class AttendanceClockWidget extends Component {
    static template = "cleon_license.AttendanceClockWidget";
    static props = { ...standardWidgetProps };

    setup() {
        this.state = useState({ now: DateTime.local() });
        this.timer = null;

        onWillStart(() => {
            // Tick every second. Using setInterval (not a recursive
            // setTimeout) is fine here since the interval is cleared on
            // unmount and the work done per tick is trivial.
            this.timer = setInterval(() => {
                this.state.now = DateTime.local();
            }, 1000);
        });

        onWillUnmount(() => {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        });
    }

    /* ---------------------------------------------------------------- */
    /*  Data helpers                                                      */
    /* ---------------------------------------------------------------- */

    get data() {
        return this.props.record.data;
    }

    get isPresent() {
        return !!this.data.is_present;
    }

    get workStart() {
        // Odoo datetime fields arrive as luxon DateTime objects already.
        return this.data.work_start_datetime || false;
    }

    /** Live session length in whole seconds. */
    get sessionSeconds() {
        if (this.isPresent && this.workStart) {
            const diffSeconds = this.state.now.diff(this.workStart, "seconds").seconds;
            return Math.max(0, Math.floor(diffSeconds));
        }
        const hours = this.data.total_work_duration || 0;
        return Math.max(0, Math.floor(hours * 3600));
    }

    get hh() {
        return String(Math.floor(this.sessionSeconds / 3600)).padStart(2, "0");
    }

    get mm() {
        return String(Math.floor((this.sessionSeconds % 3600) / 60)).padStart(2, "0");
    }

    get ss() {
        return String(this.sessionSeconds % 60).padStart(2, "0");
    }

    /** "20h 23m" style label for the SESSION TIME line. */
    get sessionTimeLabel() {
        const h = Math.floor(this.sessionSeconds / 3600);
        const m = Math.floor((this.sessionSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    }

    get todayDateLabel() {
        // e.g. "Tue, Aug 18"
        return this.state.now.toFormat("ccc, MMM d");
    }

    get todayTimeLabel() {
        // e.g. "5:58 PM"
        return this.state.now.toFormat("h:mm a");
    }

    get shiftLabel() {
        return this.data.shift_label || "Shift not set";
    }

    get onlineLabel() {
        return this.isPresent ? "Online" : "Offline";
    }

    /* ---------------------------------------------------------------- */
    /*  Stats row                                                         */
    /* ---------------------------------------------------------------- */

    _formatHours(hours) {
        const total = Math.max(0, hours || 0);
        const h = Math.floor(total);
        const m = Math.round((total - h) * 60);
        return `${h}h ${m}m`;
    }

    get todayStat() {
        return this._formatHours(this.data.hours_today);
    }

    get overtimeStat() {
        return this._formatHours(this.data.overtime_hours);
    }

    get weekStat() {
        return this._formatHours(this.data.hours_week);
    }
}

registry.category("view_widgets").add("attendance_clock", {
    component: AttendanceClockWidget,
});
/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";

const { DateTime } = luxon;

export class AttendanceClockWidget extends Component {
    static template = "hr_employee.AttendanceClockWidget";
    static props = { ...standardWidgetProps };

    setup() {
        this.state = useState({ now: DateTime.local() });
        this.timer = null;
        onWillStart(() => {
            this.timer = setInterval(() => { this.state.now = DateTime.local(); }, 1000);
        });
        onWillUnmount(() => {
            if (this.timer) {
                clearInterval(this.timer);
                this.timer = null;
            }
        });
    }

    get data() { return this.props.record.data; }
    get isPresent() { return !!this.data.is_present; }
    get workStart() { return this.data.work_start_datetime || false; }
    get sessionSeconds() {
        if (this.isPresent && this.workStart) {
            return Math.max(0, Math.floor(this.state.now.diff(this.workStart, "seconds").seconds));
        }
        return Math.max(0, Math.floor((this.data.total_work_duration || 0) * 3600));
    }
    get hh() { return String(Math.floor(this.sessionSeconds / 3600)).padStart(2, "0"); }
    get mm() { return String(Math.floor((this.sessionSeconds % 3600) / 60)).padStart(2, "0"); }
    get ss() { return String(this.sessionSeconds % 60).padStart(2, "0"); }
    get sessionTimeLabel() {
        const h = Math.floor(this.sessionSeconds / 3600);
        const m = Math.floor((this.sessionSeconds % 3600) / 60);
        return `${h}h ${m}m`;
    }
    get todayDateLabel() { return this.state.now.toFormat("ccc, MMM d"); }
    get todayTimeLabel() { return this.state.now.toFormat("h:mm a"); }
    get shiftLabel() { return this.data.shift_label || "Shift not set"; }
    get onlineLabel() { return this.isPresent ? "Online" : "Offline"; }
    _formatHours(hours) {
        const total = Math.max(0, hours || 0);
        const h = Math.floor(total);
        return `${h}h ${Math.round((total - h) * 60)}m`;
    }
    get todayStat() { return this._formatHours(this.data.hours_today); }
    get overtimeStat() { return this._formatHours(this.data.overtime_hours); }
    get weekStat() { return this._formatHours(this.data.hours_week); }
}

registry.category("view_widgets").add("attendance_clock", { component: AttendanceClockWidget });


/** @odoo-module **/

import { Component, onWillUpdateProps, useExternalListener, useState } from "@odoo/owl";
import {
    CALENDAR_VIEWS,
    addDays,
    buildMonthWeeks,
    eventInRange,
    eventTime,
    formatYMD,
    getViewRange,
    parseYMD,
    shiftDate,
    startOfWeek,
} from "./calendar_utils";

const VIEW_META = {
    month: { icon: "fa-th-large", title: "Month View" },
    week: { icon: "fa-th-list", title: "Week View" },
    day: { icon: "fa-calendar-minus-o", title: "Day View" },
    year: { icon: "fa-calendar", title: "Year View" },
};
const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Data-agnostic calendar shared by every CleonHR app.
 *
 * Event shape (only id/title/start are required):
 *   {
 *     id, title, start: "YYYY-MM-DD[ HH:MM]", end: same format (inclusive, defaults to start),
 *     subtitle, detail,          // extra lines in week / day views
 *     color, textColor,          // block colours (any CSS colour)
 *     type: "event" | "marker",  // "marker" = neutral all-day banner (holidays, closures)
 *     icon,                      // FontAwesome class, e.g. "fa-star text-warning"
 *     className,                 // extra classes, e.g. "o_ccal_dashed" for tentative items
 *     badge: { label, className },
 *     tooltip, clickable (default true for events, false for markers),
 *     data,                      // anything; handed back untouched in callbacks
 *   }
 *
 * Navigation is uncontrolled by default; pass `date` / `view` to drive it from the
 * parent. Every user navigation calls onRangeChange({ view, date, dateFrom, dateTo }).
 *
 * Slots: toolbarStart / actions (toolbar, before / after the view switcher), banner
 * (between toolbar and grid), dayContent {day, events} (replaces a month cell's event
 * stack while showDayContent is true), event {event, view} (custom block), yearHeader,
 * yearMonthSummary {month}, yearMonthFooter {month}, legend.
 */
export class CleonCalendar extends Component {
    static template = "cleon_calendar.Calendar";
    static props = {
        events: { type: Array, optional: true },
        date: { optional: true },
        view: { type: String, optional: true },
        views: { type: Array, optional: true },
        weekStart: { type: Number, optional: true },
        locale: { type: String, optional: true },
        showToolbar: { type: Boolean, optional: true },
        loading: { type: Boolean, optional: true },
        error: { type: String, optional: true },
        selectable: { type: Boolean, optional: true },
        showDayContent: { type: Boolean, optional: true },
        maxEventsPerDay: { type: Number, optional: true },
        dayTitle: { type: String, optional: true },
        emptyText: { type: String, optional: true },
        dayHeading: { type: String, optional: true },
        yearDayCount: { type: Function, optional: true },
        onRangeChange: { type: Function, optional: true },
        onDayClick: { type: Function, optional: true },
        onSelectRange: { type: Function, optional: true },
        onEventClick: { type: Function, optional: true },
        onMoreClick: { type: Function, optional: true },
        onRetry: { type: Function, optional: true },
        slots: { type: Object, optional: true },
    };
    static defaultProps = {
        events: [],
        views: CALENDAR_VIEWS,
        weekStart: 0,
        locale: "en-US",
        showToolbar: true,
        loading: false,
        error: "",
        selectable: false,
        showDayContent: true,
        maxEventsPerDay: 3,
        emptyText: "Nothing scheduled",
        dayHeading: "Schedule for",
    };

    setup() {
        this.viewMeta = VIEW_META;
        this.monthShort = MONTH_SHORT;
        this.nav = useState({
            view: this.props.view || this.props.views[0],
            date: parseYMD(this.props.date || new Date()),
            pickerOpen: false,
            pickerYear: 0,
            selectionStart: "",
            selectionCurrent: "",
        });
        onWillUpdateProps((next) => {
            // Only follow the parent when *it* changed the value, so internal
            // navigation is not reset by unrelated re-renders.
            if (next.date && (!this.props.date || formatYMD(parseYMD(next.date)) !== formatYMD(parseYMD(this.props.date)))) {
                this.nav.date = parseYMD(next.date);
            }
            if (next.view && next.view !== this.props.view) {
                this.nav.view = next.view;
            }
            if (!(next.views || CALENDAR_VIEWS).includes(this.nav.view)) {
                this.nav.view = (next.views || CALENDAR_VIEWS)[0];
            }
        });
        // A drag released outside the grid would otherwise leave a stuck selection.
        useExternalListener(window, "mouseup", () => this.cancelSelection());
    }

    // ---------------------------------------------------------------- navigation

    get range() {
        return getViewRange(this.nav.view, this.nav.date, this.props.weekStart);
    }

    notifyRange() {
        this.props.onRangeChange?.({ view: this.nav.view, date: new Date(this.nav.date), ...this.range });
    }

    setView(view) {
        if (view === this.nav.view) return;
        this.nav.view = view;
        this.notifyRange();
    }

    navigate(direction) {
        this.nav.date = shiftDate(this.nav.view, this.nav.date, direction);
        this.notifyRange();
    }

    goToToday() {
        this.nav.date = parseYMD(new Date());
        this.notifyRange();
    }

    goTo(date, view = this.nav.view) {
        this.nav.date = parseYMD(date);
        this.nav.view = view;
        this.nav.pickerOpen = false;
        this.notifyRange();
    }

    togglePicker() {
        this.nav.pickerYear = this.nav.date.getFullYear();
        this.nav.pickerOpen = !this.nav.pickerOpen;
    }

    get periodLabel() {
        const d = this.nav.date;
        const locale = this.props.locale;
        if (this.nav.view === "month") {
            return d.toLocaleDateString(locale, { month: "long", year: "numeric" });
        }
        if (this.nav.view === "week") {
            const start = startOfWeek(d, this.props.weekStart);
            const end = addDays(start, 6);
            return `${start.toLocaleDateString(locale, { month: "short", day: "numeric" })} – ${end.toLocaleDateString(locale, { month: "short", day: "numeric", year: "numeric" })}`;
        }
        if (this.nav.view === "day") {
            return d.toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        }
        return `${d.getFullYear()}`;
    }

    // ---------------------------------------------------------------- data

    get weekdayLabels() {
        const start = startOfWeek(new Date(2024, 0, 7), this.props.weekStart); // any Sunday
        return Array.from({ length: 7 }, (_, i) => addDays(start, i).toLocaleDateString(this.props.locale, { weekday: "short" }));
    }

    get monthWeeks() {
        return buildMonthWeeks(this.nav.date, this.props.weekStart);
    }

    get weekDays() {
        const start = startOfWeek(this.nav.date, this.props.weekStart);
        const todayStr = formatYMD(new Date());
        return Array.from({ length: 7 }, (_, i) => {
            const d = addDays(start, i);
            const ymd = formatYMD(d);
            return {
                ymd,
                dayName: d.toLocaleDateString(this.props.locale, { weekday: "short" }).toUpperCase(),
                dayNumber: d.getDate(),
                isToday: ymd === todayStr,
                events: this.getDayEvents(ymd),
            };
        });
    }

    get dayEvents() {
        return this.getDayEvents(formatYMD(this.nav.date));
    }

    /** Markers first, then events in start order. */
    getDayEvents(ymd) {
        return this.props.events
            .filter((ev) => eventInRange(ev, ymd))
            .sort((a, b) => (this.isMarker(b) - this.isMarker(a)) || String(a.start).localeCompare(String(b.start)));
    }

    get yearMonths() {
        const year = this.nav.date.getFullYear();
        return MONTH_SHORT.map((_, idx) => {
            const first = new Date(year, idx, 1);
            return {
                number: idx + 1,
                name: first.toLocaleDateString(this.props.locale, { month: "long" }),
                date: first,
                days: buildMonthWeeks(first, this.props.weekStart).flat(),
            };
        });
    }

    getYearDayClass(day) {
        if (!day.isCurrentMonth) return "o_ccal_other";
        if (day.isToday) return "o_ccal_today";
        const count = this.props.yearDayCount
            ? this.props.yearDayCount(day.ymd)
            : this.getDayEvents(day.ymd).filter((ev) => !this.isMarker(ev)).length;
        return count ? `o_ccal_heat_${Math.min(count, 3)}` : "";
    }

    // ---------------------------------------------------------------- events

    isMarker(event) {
        return event.type === "marker";
    }

    isClickable(event) {
        return event.clickable ?? !this.isMarker(event);
    }

    eventClass(event) {
        return [this.isMarker(event) ? "o_ccal_marker" : "o_ccal_event", event.className || "", this.isClickable(event) ? "o_ccal_clickable" : ""].join(" ");
    }

    eventStyle(event) {
        if (this.isMarker(event)) return "";
        return `background-color: ${event.color || "#64748B"}; color: ${event.textColor || "#ffffff"};`;
    }

    eventTimeLabel(event) {
        const start = eventTime(event.start);
        const end = eventTime(event.end);
        return start && end ? `${start} – ${end}` : start;
    }

    onEventClick(event) {
        if (this.isClickable(event)) this.props.onEventClick?.(event);
    }

    onMoreClick(ymd, events) {
        if (this.props.onMoreClick) this.props.onMoreClick(ymd, events);
        else this.props.onDayClick?.(ymd, events);
    }

    // ---------------------------------------------------------------- selection

    onCellMouseDown(ymd, ev) {
        if (ev.button !== 0 || !this.props.selectable) return;
        this.nav.selectionStart = ymd;
        this.nav.selectionCurrent = ymd;
    }

    onCellMouseEnter(ymd) {
        if (this.nav.selectionStart) this.nav.selectionCurrent = ymd;
    }

    onCellMouseUp(ymd) {
        if (!this.nav.selectionStart) return;
        const [from, to] = [this.nav.selectionStart, ymd].sort();
        this.cancelSelection();
        if (from !== to && this.props.onSelectRange) {
            this.props.onSelectRange(from, to);
        } else {
            this.props.onDayClick?.(ymd, this.getDayEvents(ymd));
        }
    }

    onCellClick(ymd) {
        // Selectable grids route clicks through mouseup so drag and click share one path.
        if (!this.props.selectable) this.props.onDayClick?.(ymd, this.getDayEvents(ymd));
    }

    cancelSelection() {
        this.nav.selectionStart = "";
        this.nav.selectionCurrent = "";
    }

    isSelected(ymd) {
        if (!this.nav.selectionStart) return false;
        const [from, to] = [this.nav.selectionStart, this.nav.selectionCurrent].sort();
        return ymd >= from && ymd <= to;
    }
}

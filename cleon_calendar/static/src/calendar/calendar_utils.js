/** @odoo-module **/

// Pure date helpers shared by CleonCalendar and its consumers. Dates travel as
// local "YYYY-MM-DD" strings so they compare lexically and never shift with
// timezones.

export const CALENDAR_VIEWS = ["month", "week", "day", "year"];

export function formatYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

export function parseYMD(value) {
    if (value instanceof Date) {
        return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}

export function addDays(dateObj, days) {
    const d = new Date(dateObj);
    d.setDate(d.getDate() + days);
    return d;
}

export function startOfWeek(dateObj, weekStart = 0) {
    const d = parseYMD(dateObj);
    return addDays(d, -((d.getDay() - weekStart + 7) % 7));
}

/** Visible [dateFrom, dateTo] (inclusive, YMD strings) for a view anchored on `date`. */
export function getViewRange(view, date, weekStart = 0) {
    const d = parseYMD(date);
    if (view === "month") {
        const first = new Date(d.getFullYear(), d.getMonth(), 1);
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
        const start = startOfWeek(first, weekStart);
        const end = addDays(startOfWeek(last, weekStart), 6);
        return { dateFrom: formatYMD(start), dateTo: formatYMD(end) };
    }
    if (view === "week") {
        const start = startOfWeek(d, weekStart);
        return { dateFrom: formatYMD(start), dateTo: formatYMD(addDays(start, 6)) };
    }
    if (view === "year") {
        return { dateFrom: `${d.getFullYear()}-01-01`, dateTo: `${d.getFullYear()}-12-31` };
    }
    return { dateFrom: formatYMD(d), dateTo: formatYMD(d) };
}

/** Move `date` by `direction` (+1 / -1) units of `view`. */
export function shiftDate(view, date, direction) {
    const d = parseYMD(date);
    if (view === "month") {
        // Anchor on the 1st so Jan 31 + 1 month does not overflow into March.
        return new Date(d.getFullYear(), d.getMonth() + direction, 1);
    }
    if (view === "week") return addDays(d, direction * 7);
    if (view === "year") return new Date(d.getFullYear() + direction, d.getMonth(), 1);
    return addDays(d, direction);
}

/** Weeks (arrays of 7 day descriptors) covering the month that contains `date`. */
export function buildMonthWeeks(date, weekStart = 0) {
    const d = parseYMD(date);
    const month = d.getMonth();
    const { dateFrom, dateTo } = getViewRange("month", d, weekStart);
    const todayStr = formatYMD(new Date());
    const weeks = [];
    let curr = parseYMD(dateFrom);
    while (formatYMD(curr) <= dateTo) {
        const week = [];
        for (let i = 0; i < 7; i++) {
            const ymd = formatYMD(curr);
            week.push({
                date: new Date(curr),
                ymd,
                dayNumber: curr.getDate(),
                isCurrentMonth: curr.getMonth() === month,
                isToday: ymd === todayStr,
            });
            curr = addDays(curr, 1);
        }
        weeks.push(week);
    }
    return weeks;
}

/** Event overlaps the inclusive [from, to] YMD range. Times on start/end are ignored. */
export function eventInRange(event, from, to = from) {
    const start = String(event.start).slice(0, 10);
    const end = String(event.end || event.start).slice(0, 10);
    return start <= to && end >= from;
}

export function eventTime(value) {
    const str = String(value || "");
    return str.length > 10 ? str.slice(11, 16) : "";
}

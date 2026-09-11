/** @odoo-module **/

import { Component, onMounted, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { CalendarSidebar } from "../components/calendar_sidebar";
import { LeaveRequestDetailModal } from "../components/leave_request_detail/leave_request_detail";
import { EmployeeRequestModal } from "../components/employee_request_modal/employee_request_modal";
import { CalendarDayPanel } from "../components/calendar_day_panel/calendar_day_panel";
import { SmartDateRecommendationsModal } from "../components/smart_date_modal/smart_date_modal";

export class LeaveCalendarPage extends Component {
    static template = "hr_leave_dashboard.LeaveCalendarPage";
    static components = { CalendarSidebar, LeaveRequestDetailModal, EmployeeRequestModal, CalendarDayPanel, SmartDateRecommendationsModal };
    static props = {
        embedded: { type: Boolean, optional: true },
        forceEmployee: { type: Boolean, optional: true },
        "*": true,
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");

        const today = new Date();

        this.state = useState({
            loading: true,

            viewMode: "month", // "month" | "week" | "day" | "year"
            currentDate: new Date(today.getFullYear(), today.getMonth(), today.getDate()),
            coverageMode: false,
            employeeView: false,
            calendarScope: "personal",
            canSwitchPerspective: false,
            canUsePersonal: false,
            canUseTeam: false,
            canUseOrganisation: false,
            canBook: false,
            canRequest: false,
            canViewCoverage: false,

            leaves: [],
            holidays: [],
            leaveTypes: [],
            departments: [],
            employees: [],
            totalActiveEmployees: 1,

            yearData: null,
            selectedCountryId: null,

            filterPanelOpen: false,
            periodPickerOpen: false,
            downloadDropdownOpen: false,

            filterDraft: {
                dateFrom: "",
                dateTo: "",
                departmentIds: [],
                leaveTypeIds: [],
                statuses: [],
                employeeIds: [],
                employeeSearch: "",
            },

            filters: {
                dateFrom: "",
                dateTo: "",
                departmentIds: [],
                leaveTypeIds: [],
                statuses: [],
                employeeIds: [],
            },

            detailRequestId: null,
            dayPanelOpen: false,
            dayPanelDateFrom: "",
            dayPanelDateTo: "",
            selectionStart: "",
            selectionCurrent: "",
            employeeRequestOpen: false,
            employeeRequestInitial: {},
            loadError: "",
            employeeEventFilters: ["all"],
            aiSummary: { open: false, loading: false, bullets: [], heading: "", error: null },
            canDateRec: false,
            showDateRecModal: false,
        });

        onWillStart(async () => {
            const access = await this.orm.call("hr.leave", "get_leave_access_profile", []);
            this.state.canBook = access.can_operate;
            this.state.canRequest = access.has_personal_scope;
            this.state.canViewCoverage = access.has_team_scope || access.can_operate || access.can_view_audit;
            this.state.canViewAiSummary = Boolean(access.ai_capabilities?.calendar_summary);
            this.state.canDateRec = Boolean(access.ai_capabilities?.date_recommendations);
            this.state.canUsePersonal = access.has_personal_scope;
            this.state.canUseTeam = access.has_team_scope;
            this.state.canUseOrganisation = access.can_operate || access.can_view_audit;
            const scopes = [this.state.canUsePersonal, this.state.canUseTeam, this.state.canUseOrganisation].filter(Boolean);
            this.state.canSwitchPerspective = scopes.length > 1;
            const defaults = access.calendar_defaults || {};
            if (defaults.view === "week") this.state.viewMode = "week";
            const defaultScope = defaults.view === "organisation" ? "organisation" : defaults.view === "team" ? "team" : false;
            this.state.calendarScope = Boolean(this.props.forceEmployee)
                ? "personal"
                : defaultScope === "organisation" && this.state.canUseOrganisation ? "organisation"
                : defaultScope === "team" && this.state.canUseTeam ? "team"
                : this.state.canUseOrganisation ? "organisation" : this.state.canUseTeam ? "team" : "personal";
            this.state.employeeView = this.state.calendarScope !== "organisation";
            await this.loadCalendarData();
        });
        this.onOpenCalendarEvent = (ev) => {
            if (ev.detail && ev.detail.date) {
                const parts = ev.detail.date.split("-").map(Number);
                if (parts.length === 3) {
                    this.state.currentDate = new Date(parts[0], parts[1] - 1, parts[2]);
                    this.loadCalendarData();
                }
            }
        };

        // The global assistant may mount after the initial RPC completes, so
        // publish the same permission-safe context once the page is present.
        onMounted(() => {
            this.emitAssistantContext();
            window.addEventListener("cleon-open-calendar", this.onOpenCalendarEvent);
        });
        onWillUnmount(() => {
            window.removeEventListener("cleon-open-calendar", this.onOpenCalendarEvent);
        });
    }

    // ---------------------------------------------------------
    // CALENDAR DATA LOADING
    // ---------------------------------------------------------

    async loadCalendarData() {
        this.state.loading = true;
        this.state.loadError = "";
        try {
            if (this.state.viewMode === "year") {
                const year = this.state.currentDate.getFullYear();
                this.state.yearData = await this.orm.call(
                    "hr.leave",
                    "get_leave_calendar_year_summary",
                    [],
                    {
                        year: year,
                        department_ids: this.state.filters.departmentIds,
                        leave_type_ids: this.state.filters.leaveTypeIds,
                        statuses: this.state.filters.statuses,
                        employee_ids: this.state.filters.employeeIds,
                        employee_view: this.state.employeeView,
                        calendar_scope: this.state.calendarScope,
                        country_id: this.state.selectedCountryId || false,
                    }
                );
            } else {
                let range = this.getRangeForView();
                if (this.state.filters.dateFrom) {
                    range.dateFrom = this.state.filters.dateFrom;
                }
                if (this.state.filters.dateTo) {
                    range.dateTo = this.state.filters.dateTo;
                }

                const res = await this.orm.call(
                    "hr.leave",
                    "get_leave_calendar_data",
                    [],
                    {
                        date_from: range.dateFrom,
                        date_to: range.dateTo,
                        department_ids: this.state.filters.departmentIds,
                        leave_type_ids: this.state.filters.leaveTypeIds,
                        statuses: this.state.filters.statuses,
                        employee_ids: this.state.filters.employeeIds,
                        employee_view: this.state.employeeView,
                        calendar_scope: this.state.calendarScope,
                    }
                );

                this.state.leaves = res.leaves || [];
                this.state.holidays = res.holidays || [];
                this.state.leaveTypes = res.leave_types || [];
                this.state.departments = res.departments || [];
                this.state.employees = res.employees || [];
                this.state.totalActiveEmployees = res.total_active_employees || 1;
            }
            this.emitAssistantContext();
        } catch (err) {
            console.error("Failed to load leave calendar data", err);
            this.state.loadError = "Calendar data could not be loaded. Check your connection and try again.";
            this.notification.add("Failed to load calendar data.", { type: "danger" });
        } finally {
            this.state.loading = false;
        }
    }

    getRangeForView() {
        const d = this.state.currentDate;
        const year = d.getFullYear();
        const month = d.getMonth();

        if (this.state.viewMode === "month") {
            const firstDayOfMonth = new Date(year, month, 1);
            const startDay = new Date(firstDayOfMonth);
            startDay.setDate(startDay.getDate() - startDay.getDay()); // Sunday start

            const lastDayOfMonth = new Date(year, month + 1, 0);
            const endDay = new Date(lastDayOfMonth);
            endDay.setDate(endDay.getDate() + (6 - endDay.getDay())); // Saturday end

            return {
                dateFrom: this.formatYMD(startDay),
                dateTo: this.formatYMD(endDay),
            };
        } else if (this.state.viewMode === "week") {
            const startDay = new Date(d);
            startDay.setDate(startDay.getDate() - startDay.getDay());
            const endDay = new Date(startDay);
            endDay.setDate(endDay.getDate() + 6);

            return {
                dateFrom: this.formatYMD(startDay),
                dateTo: this.formatYMD(endDay),
            };
        } else {
            // Day view
            return {
                dateFrom: this.formatYMD(d),
                dateTo: this.formatYMD(d),
            };
        }
    }

    // ---------------------------------------------------------
    // VIEW SWITCHING & NAVIGATION
    // ---------------------------------------------------------

    setViewMode(mode) {
        if (this.state.employeeView && mode === "year") return;
        this.state.viewMode = mode;
        this.loadCalendarData();
    }

    async setPerspective(scope) {
        const allowed = {
            personal: this.state.canUsePersonal,
            team: this.state.canUseTeam,
            organisation: this.state.canUseOrganisation,
        };
        if (!allowed[scope]) return;
        this.state.calendarScope = scope;
        this.state.employeeView = scope !== "organisation";
        if (this.state.employeeView && this.state.viewMode === "year") this.state.viewMode = "month";
        if (this.state.employeeView) this.state.coverageMode = false;
        this.state.employeeEventFilters = ["all"];
        this.state.filters = { dateFrom: "", dateTo: "", departmentIds: [], leaveTypeIds: [], statuses: [], employeeIds: [] };
        await this.loadCalendarData();
    }

    toggleCoverageMode() {
        this.state.coverageMode = !this.state.coverageMode;
    }

    openEmployeeRequest() {
        this.state.employeeRequestInitial = {};
        this.state.employeeRequestOpen = true;
    }
    openRequestRange(dateFrom, dateTo = dateFrom) {
        if (!this.state.canRequest) return;
        this.state.dayPanelOpen = false;
        this.state.employeeRequestInitial = { date_from: dateFrom, date_to: dateTo };
        this.state.employeeRequestOpen = true;
    }
    openDayPanel(dateFrom, dateTo = dateFrom) {
        this.state.dayPanelDateFrom = dateFrom;
        this.state.dayPanelDateTo = dateTo;
        this.state.dayPanelOpen = true;
    }
    closeDayPanel() { this.state.dayPanelOpen = false; }
    get dayPanelLeaves() {
        const from = this.state.dayPanelDateFrom;
        const to = this.state.dayPanelDateTo || from;
        return this.visibleLeaves.filter(leave => leave.date_from <= to && leave.date_to >= from);
    }
    get dayPanelHolidays() {
        const from = this.state.dayPanelDateFrom;
        const to = this.state.dayPanelDateTo || from;
        return this.visibleHolidays.filter(holiday => holiday.date_from <= to && holiday.date_to >= from);
    }
    beginDateSelection(ymd, event) {
        if (event.button !== 0 || !this.state.canRequest && !this.state.canBook) return;
        this.state.selectionStart = ymd;
        this.state.selectionCurrent = ymd;
    }
    extendDateSelection(ymd) {
        if (this.state.selectionStart) this.state.selectionCurrent = ymd;
    }
    finishDateSelection(ymd) {
        if (!this.state.selectionStart) return;
        const values = [this.state.selectionStart, ymd].sort();
        const isRange = values[0] !== values[1];
        this.state.selectionStart = "";
        this.state.selectionCurrent = "";
        if (isRange) {
            if (this.state.canRequest) this.openRequestRange(values[0], values[1]);
            else this.openDayPanel(values[0], values[1]);
            return;
        }
        const hasEntries = this.getDayLeaves(ymd).length || this.getDayHolidays(ymd).length;
        if (!this.state.employeeView || hasEntries) this.openDayPanel(ymd);
        else this.openRequestRange(ymd);
    }
    isDateSelected(ymd) {
        if (!this.state.selectionStart) return false;
        const [from, to] = [this.state.selectionStart, this.state.selectionCurrent].sort();
        return ymd >= from && ymd <= to;
    }
    closeEmployeeRequest() {
        this.state.employeeRequestOpen = false;
        this.state.employeeRequestInitial = {};
    }

    navigate(direction) {
        const d = new Date(this.state.currentDate);
        if (this.state.viewMode === "month") {
            d.setMonth(d.getMonth() + direction);
        } else if (this.state.viewMode === "week") {
            d.setDate(d.getDate() + direction * 7);
        } else if (this.state.viewMode === "day") {
            d.setDate(d.getDate() + direction);
        } else if (this.state.viewMode === "year") {
            d.setFullYear(d.getFullYear() + direction);
        }
        this.state.currentDate = d;
        this.loadCalendarData();
    }

    goToToday() {
        const today = new Date();
        this.state.currentDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        this.loadCalendarData();
    }

    togglePeriodPicker() {
        this.state.periodPickerOpen = !this.state.periodPickerOpen;
    }

    selectMonthYear(year, monthIdx) {
        this.state.currentDate = new Date(year, monthIdx, 1);
        this.state.periodPickerOpen = false;
        this.loadCalendarData();
    }

    selectCountry(countryId) {
        this.state.selectedCountryId = Number(countryId);
        this.loadCalendarData();
    }

    get periodLabel() {
        const d = this.state.currentDate;
        if (this.state.viewMode === "month") {
            return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
        } else if (this.state.viewMode === "week") {
            const startDay = new Date(d);
            startDay.setDate(startDay.getDate() - startDay.getDay());
            const endDay = new Date(startDay);
            endDay.setDate(endDay.getDate() + 6);
            return `${startDay.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${endDay.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
        } else if (this.state.viewMode === "day") {
            return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
        } else {
            return `${d.getFullYear()}`;
        }
    }

    // ---------------------------------------------------------
    // MONTH VIEW GRID COMPUTATION (FR-146 to FR-151)

    // ---------------------------------------------------------

    get monthGridWeeks() {
        const d = this.state.currentDate;
        const year = d.getFullYear();
        const month = d.getMonth();

        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const daysInMonth = lastDayOfMonth.getDate();
        const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun

        const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
        const numWeeks = totalCells / 7;

        const startDate = new Date(firstDayOfMonth);
        startDate.setDate(startDate.getDate() - startDayOfWeek);

        const weeks = [];
        const curr = new Date(startDate);
        const todayStr = this.formatYMD(new Date());

        for (let w = 0; w < numWeeks; w++) {
            const weekDays = [];
            for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
                const dayYMD = this.formatYMD(curr);
                weekDays.push({
                    date: new Date(curr),
                    ymd: dayYMD,
                    dayNumber: curr.getDate(),
                    isCurrentMonth: curr.getMonth() === month,
                    isToday: dayYMD === todayStr,
                });
                curr.setDate(curr.getDate() + 1);
            }
            weeks.push(weekDays);
        }
        return weeks;
    }

    // FR-150: Preprocess multi-day continuous blocks for a given week.

    getWeekSegments(weekDays) {
        const weekStartStr = weekDays[0].ymd;
        const weekEndStr = weekDays[6].ymd;

        const matchingLeaves = this.visibleLeaves.filter(l => l.date_from <= weekEndStr && l.date_to >= weekStartStr);

        const segments = [];
        for (const leave of matchingLeaves) {
            const segStartStr = leave.date_from < weekStartStr ? weekStartStr : leave.date_from;
            const segEndStr = leave.date_to > weekEndStr ? weekEndStr : leave.date_to;

            const startIndex = weekDays.findIndex(d => d.ymd === segStartStr);
            const endIndex = weekDays.findIndex(d => d.ymd === segEndStr);

            if (startIndex !== -1 && endIndex !== -1) {
                segments.push({
                    leave: leave,
                    startIndex: startIndex, // 0 to 6
                    endIndex: endIndex,     // 0 to 6
                    span: endIndex - startIndex + 1,
                    isStartOfLeave: leave.date_from === segStartStr,
                });
            }
        }
        return segments;
    }

    // Get leaves specifically for a day cell
    getDayLeaves(ymdStr) {
        return this.visibleLeaves.filter(l => l.date_from <= ymdStr && l.date_to >= ymdStr);
    }

    getDayHolidays(ymdStr) {
        return this.visibleHolidays.filter(h => h.date_from <= ymdStr && h.date_to >= ymdStr);
    }

    get visibleLeaves() {
        const selected = this.state.employeeEventFilters;
        if (!this.state.employeeView || selected.includes("all")) return this.state.leaves;
        return this.state.leaves.filter(leave =>
            (selected.includes("mine") && leave.is_own) ||
            (selected.includes("team") && !leave.is_own)
        );
    }

    get visibleHolidays() {
        const selected = this.state.employeeEventFilters;
        if (!this.state.employeeView || selected.includes("all") || selected.includes("holidays")) {
            return this.state.holidays;
        }
        return [];
    }

    // Coverage tile calculations with unique absent employee count (Feedback Item 10)
    getDayCoverageInfo(ymdStr) {
        const dayLeaves = this.getDayLeaves(ymdStr);
        const uniqueEmployeeIds = new Set(dayLeaves.map(l => l.employee_id));
        const absentCount = uniqueEmployeeIds.size;

        const total = this.state.totalActiveEmployees || 1;
        const availableCount = Math.max(0, total - absentCount);
        const pct = Math.max(0, Math.min(100, Math.round((availableCount / total) * 100)));

        let level = "good";
        if (pct === 100 && absentCount === 0) {
            level = "neutral";
        } else if (pct >= 85) {
            level = "good";
        } else if (pct >= 70) {
            level = "medium";
        } else {
            level = "low";
        }

        return {
            percentage: pct,
            absentCount: absentCount,
            level: level,
        };
    }

    // ---------------------------------------------------------
    // WEEK & DAY VIEW DATA
    // ---------------------------------------------------------

    get weekViewDays() {
        const d = new Date(this.state.currentDate);
        d.setDate(d.getDate() - d.getDay());
        const days = [];
        const todayStr = this.formatYMD(new Date());

        for (let i = 0; i < 7; i++) {
            const dayYMD = this.formatYMD(d);
            days.push({
                date: new Date(d),
                ymd: dayYMD,
                dayName: d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase(),
                dayNumber: d.getDate(),
                isToday: dayYMD === todayStr,
                leaves: this.getDayLeaves(dayYMD),
                holidays: this.getDayHolidays(dayYMD),
            });
            d.setDate(d.getDate() + 1);
        }
        return days;
    }

    get dayViewLeaves() {
        const todayYMD = this.formatYMD(this.state.currentDate);
        return this.getDayLeaves(todayYMD);
    }

    get dayViewHolidays() {
        return this.getDayHolidays(this.formatYMD(this.state.currentDate));
    }

    // ---------------------------------------------------------
    // YEAR VIEW MINI-CALENDAR GRID GENERATOR (FR-162 to FR-168)

    // ---------------------------------------------------------

    get yearMonths() {
        if (!this.state.yearData) return [];
        const year = this.state.yearData.year;
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];
        const todayYMD = this.formatYMD(new Date());

        return monthNames.map((name, idx) => {
            const mNum = idx + 1;
            const summary = this.state.yearData.month_summary[mNum] || { approved: 0, pending: 0, holidays: 0 };
            const firstDay = new Date(year, idx, 1);
            const daysInMonth = new Date(year, idx + 1, 0).getDate();
            const startDayOfWeek = firstDay.getDay();

            const totalCells = Math.ceil((startDayOfWeek + daysInMonth) / 7) * 7;
            const startDay = new Date(firstDay);
            startDay.setDate(startDay.getDate() - startDayOfWeek);

            const days = [];
            const curr = new Date(startDay);
            for (let i = 0; i < totalCells; i++) {
                const dayYMD = this.formatYMD(curr);
                const occ = this.state.yearData.day_occupancy[dayYMD] || { approved: 0, pending: 0, total: 0 };
                days.push({
                    date: new Date(curr),
                    ymd: dayYMD,
                    dayNumber: curr.getDate(),
                    isCurrentMonth: curr.getMonth() === idx,
                    isToday: dayYMD === todayYMD,
                    totalLeaves: occ.total,
                });
                curr.setDate(curr.getDate() + 1);
            }

            const monthHolidays = (this.state.yearData.holidays || []).filter(h => h.month === mNum);

            return {
                number: mNum,
                name: name,
                summary: summary,
                days: days,
                holidays: monthHolidays,
            };
        });
    }

    getYearDayClass(day) {
        if (!day.isCurrentMonth) return "other-month";
        if (day.isToday) return "today-highlight";
        if (day.totalLeaves >= 3) return "leave-intense-3";
        if (day.totalLeaves === 2) return "leave-intense-2";
        if (day.totalLeaves === 1) return "leave-intense-1";
        return "";
    }

    // ---------------------------------------------------------
    // FILTERS SIDE PANEL LOGIC (FR-169 to FR-177)

    // ---------------------------------------------------------

    cloneFilterObj(f) {
        return {
            dateFrom: f.dateFrom || "",
            dateTo: f.dateTo || "",
            departmentIds: [...(f.departmentIds || [])],
            leaveTypeIds: [...(f.leaveTypeIds || [])],
            statuses: [...(f.statuses || [])],
            employeeIds: [...(f.employeeIds || [])],
            employeeSearch: f.employeeSearch || "",
        };
    }

    openFilters() {
        this.state.filterDraft = this.cloneFilterObj(this.state.filters);
        this.state.filterDraft.employeeSearch = "";
        this.state.filterPanelOpen = true;
    }

    closeFilters() {
        this.state.filterPanelOpen = false;
    }

    toggleDraftDepartment(deptId) {
        const list = this.state.filterDraft.departmentIds;
        const idx = list.indexOf(deptId);
        if (idx === -1) list.push(deptId);
        else list.splice(idx, 1);
    }

    toggleDraftLeaveType(typeId) {
        const list = this.state.filterDraft.leaveTypeIds;
        const idx = list.indexOf(typeId);
        if (idx === -1) list.push(typeId);
        else list.splice(idx, 1);
    }

    toggleDraftStatus(statusKey) {
        const list = this.state.filterDraft.statuses;
        const idx = list.indexOf(statusKey);
        if (idx === -1) list.push(statusKey);
        else list.splice(idx, 1);
    }

    toggleDraftEmployee(empId) {
        const list = this.state.filterDraft.employeeIds;
        const idx = list.indexOf(empId);
        if (idx === -1) list.push(empId);
        else list.splice(idx, 1);
    }

    toggleEmployeeEventFilter(filterKey) {
        if (filterKey === "all") {
            this.state.employeeEventFilters = ["all"];
            return;
        }
        const selected = this.state.employeeEventFilters.filter(key => key !== "all");
        const index = selected.indexOf(filterKey);
        if (index === -1) selected.push(filterKey);
        else selected.splice(index, 1);
        this.state.employeeEventFilters = selected.length ? selected : ["all"];
    }

    get visibleFilterEmployees() {
        const term = (this.state.filterDraft.employeeSearch || "").trim().toLowerCase();
        if (!term) return this.state.employees;
        return this.state.employees.filter(emp =>
            `${emp.name} ${emp.department}`.toLowerCase().includes(term)
        );
    }

    clearAllFilters() {
        this.state.employeeEventFilters = ["all"];
        this.state.filterDraft = {
            dateFrom: "",
            dateTo: "",
            departmentIds: [],
            leaveTypeIds: [],
            statuses: [],
            employeeIds: [],
            employeeSearch: "",
        };
    }

    async applyFilters() {
        this.state.filters = this.cloneFilterObj(this.state.filterDraft);
        this.state.filterPanelOpen = false;
        await this.loadCalendarData();
    }

    get activeFilterCount() {
        const f = this.state.filters;
        let count = 0;
        if (f.dateFrom || f.dateTo) count += 1;
        count += f.departmentIds.length;
        count += f.leaveTypeIds.length;
        count += f.statuses.length;
        count += f.employeeIds.length;
        if (this.state.employeeView && !this.state.employeeEventFilters.includes("all")) {
            count += this.state.employeeEventFilters.length;
        }
        return count;
    }

    // ---------------------------------------------------------
    // DOWNLOAD CONTROL & FILE EXPORT (FR-143)

    // ---------------------------------------------------------

    toggleDownloadDropdown() {
        this.state.downloadDropdownOpen = !this.state.downloadDropdownOpen;
    }

    exportCalendar(format) {
        this.state.downloadDropdownOpen = false;

        if (!this.visibleLeaves || this.visibleLeaves.length === 0) {
            this.notification.add("No leave records available in current view to export.", { type: "warning" });
            return;
        }

        if (format === "csv" || format === "excel") {
            let csvContent = "Employee,Department,Leave Type,Start Date,End Date,Days,Status\n";
            for (const l of this.visibleLeaves) {
                csvContent += `"${l.employee_name}","${l.department_name}","${l.leave_type_name}","${l.date_from}","${l.date_to}",${l.number_of_days},"${l.status}"\n`;
            }
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `leave_calendar_${this.state.viewMode}_export.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.notification.add("Calendar exported as CSV successfully.", { type: "success" });
        } else if (format === "ical" || format === "ics") {
            let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//CleonHR//Leave Calendar//EN\n";
            for (const l of this.visibleLeaves) {
                const sDate = l.date_from.replace(/-/g, "");
                const eDate = l.date_to.replace(/-/g, "");
                icsContent += "BEGIN:VEVENT\n";
                icsContent += `SUMMARY:${l.employee_name} - ${l.leave_type_name}\n`;
                icsContent += `DESCRIPTION:${l.department_name} (${l.number_of_days} days)\n`;
                icsContent += `DTSTART;VALUE=DATE:${sDate}\n`;
                icsContent += `DTEND;VALUE=DATE:${eDate}\n`;
                icsContent += "END:VEVENT\n";
            }
            icsContent += "END:VCALENDAR\n";
            const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `leave_calendar_export.ics`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            this.notification.add("Calendar exported as iCal (.ics) successfully.", { type: "success" });
        } else if (format === "pdf") {
            window.print();
            this.notification.add("Preparing PDF print view...", { type: "info" });
        }
    }

    // ---------------------------------------------------------
    // SCREEN 10 REUSED MODAL TRIGGER (FR-152)

    // ---------------------------------------------------------

    openLeaveDetail(id) {
        const leave = this.state.leaves.find(item => item.id === id);
        if (this.state.employeeView && leave && !leave.can_open_detail) {
            this.notification.add("A colleague is away on this date. Request details remain private.", { type: "info" });
            return;
        }
        this.state.detailRequestId = id;
    }

    closeDetailModal() {
        this.state.detailRequestId = null;
    }

    async showAiSummary() {
        if (this.state.aiSummary.loading) return;
        this.state.aiSummary.open = true;
        this.state.aiSummary.loading = true;
        this.state.aiSummary.error = null;
        this.state.aiSummary.bullets = [];
        this.state.aiSummary.heading = "";
        this.emitAssistantContext();
        try {
            const year = this.state.currentDate.getFullYear();
            const range = this.state.viewMode === "year"
                ? { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` }
                : this.getRangeForView();
            const context = {
                screen: "leave.calendar",
                perspective: this.state.calendarScope,
                date_from: this.state.filters.dateFrom || range.dateFrom,
                date_to: this.state.filters.dateTo || range.dateTo,
                filters: {
                    department_ids: [...this.state.filters.departmentIds],
                    leave_type_ids: [...this.state.filters.leaveTypeIds],
                    statuses: [...this.state.filters.statuses],
                    employee_ids: [...this.state.filters.employeeIds],
                },
            };
            const result = await this.orm.call("cleon.ai.gateway", "get_assistant_state", [context]);
            this.state.aiSummary.heading = result.heading || "Calendar Summary";
            this.state.aiSummary.bullets = result.bullets || [];
        } catch (err) {
            this.state.aiSummary.error = err?.data?.message || err.message || "Summary unavailable.";
        } finally {
            this.state.aiSummary.loading = false;
        }
    }

    closeAiSummary() {
        this.state.aiSummary.open = false;
    }

    async refreshAiSummary() {
        await this.showAiSummary();
    }

    async copyAiSummary() {
        const text = (this.state.aiSummary.bullets || []).join("\n• ");
        if (!text) return;
        try {
            await navigator.clipboard.writeText("• " + text);
            this.notification.add("Summary copied to clipboard!", { type: "success" });
        } catch (e) {
            this.notification.add("Could not copy to clipboard.", { type: "warning" });
        }
    }

    onSelectRecommendedDate(item) {
        this.state.showDateRecModal = false;
        if (this.state.canRequest) {
            this.state.employeeRequestInitial = {
                date_from: item.date_from,
                date_to: item.date_to,
                leave_type_id: item.leave_type_id ? String(item.leave_type_id) : "",
                submission_channel: "ai_assisted",
            };
            this.state.employeeRequestOpen = true;
        }
    }

    emitAssistantContext() {
        const year = this.state.currentDate.getFullYear();
        const range = this.state.viewMode === "year"
            ? { dateFrom: `${year}-01-01`, dateTo: `${year}-12-31` }
            : this.getRangeForView();
        window.dispatchEvent(new CustomEvent("cleon-ai-context", { detail: {
            screen: "leave.calendar",
            title: "Leave Calendar",
            view_mode: this.state.viewMode,
            perspective: this.state.calendarScope,
            date_from: this.state.filters.dateFrom || range.dateFrom,
            date_to: this.state.filters.dateTo || range.dateTo,
            filters: {
                department_ids: [...this.state.filters.departmentIds],
                leave_type_ids: [...this.state.filters.leaveTypeIds],
                statuses: [...this.state.filters.statuses],
                employee_ids: [...this.state.filters.employeeIds],
            },
        }}));
    }

    getLeaveTypeColor(colorHex) {
        return /^#[0-9A-F]{6}$/i.test(colorHex || "") ? colorHex : "#64748B";
    }

    formatYMD(dateObj) {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, "0");
        const d = String(dateObj.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
    }
}

registry.category("actions").add("hr_leave_dashboard.LeaveCalendarPage", LeaveCalendarPage);

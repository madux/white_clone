/** @odoo-module **/
import { _t } from "@web/core/l10n/translation";
import { employeePortalRegistry } from "@white_clone_portal/portal_registry";
import { EmployeeLeaveDashboard } from "@hr_leave_dashboard/components/employee_dashboard/employee_dashboard";
import { MyLeaveRequestsPage } from "@hr_leave_dashboard/components/my_leave_requests/my_leave_requests";
import { LeaveCalendarPage } from "@hr_leave_dashboard/js/leave_calendar";

employeePortalRegistry.add("leave", {
    id: "leave", label: _t("Leave Management"), icon: "fa-calendar-o",
    load: ({ orm }) => orm.call("res.users", "get_employee_portal_leave_access", []),
    pages: [
        { id: "leaveRequests", aliases: ["leave"], label: _t("Leave Requests"), icon: "fa-file-text-o", sequence: 10, component: MyLeaveRequestsPage, props: { embedded: true, personalOnly: true } },
        { id: "leaveBalance", label: _t("Leave Balance"), icon: "fa-pie-chart", sequence: 20, component: EmployeeLeaveDashboard, props: { embedded: true } },
        { id: "leaveCalendar", label: _t("Leave Calendar"), icon: "fa-calendar", sequence: 30, component: LeaveCalendarPage, props: { embedded: true, forceEmployee: true } },
    ].map(page => ({ ...page, visible: context => context.enabled })),
}, { sequence: 20 });

/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LeaveRequestDetailModal extends Component {
    static template = "hr_leave_dashboard.LeaveRequestDetailModal";
    static props = {
        requestId: Number,
        close: Function,
        onChanged: { type: Function, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.previousFocusedElement = document.activeElement;

        this.state = useState({
            loading: true,
            detail: null,

            balanceExpanded: true,

            showRejectModal: false,
            rejectReason: "",

            showCancelModal: false,
            cancelReason: "",

            processing: false,
        });

        onWillStart(() => this.loadDetail());

        onWillUnmount(() => {
            if (this.previousFocusedElement && typeof this.previousFocusedElement.focus === "function") {
                try {
                    this.previousFocusedElement.focus();
                } catch (e) {}
            }
        });
    }

    async loadDetail() {
        this.state.loading = true;
        try {
            this.state.detail = await this.orm.call(
                "hr.leave",
                "get_leave_request_detail",
                [this.props.requestId]
            );
        } catch (err) {
            this.notification.add("Failed to load leave request details.", { type: "danger" });
            this.props.close();
        } finally {
            this.state.loading = false;
        }
    }

    formatDate(dateStr) {
        if (!dateStr) return "—";
        const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
    }

    formatDateTime(dtStr) {
        if (!dtStr) return "—";
        const d = new Date(dtStr);
        if (isNaN(d.getTime())) return dtStr;
        return (
            d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
            " · " +
            d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
        );
    }

    getLeaveTypeColor(colorIdx) {
        const palette = [
            "#3b82f6", // 0: blue
            "#ef4444", // 1: red
            "#f59e0b", // 2: orange
            "#eab308", // 3: yellow
            "#8b5cf6", // 4: purple
            "#ec4899", // 5: pink
            "#06b6d4", // 6: cyan
            "#10b981", // 7: teal
            "#22c55e", // 8: green
            "#6366f1", // 9: indigo
            "#f97316", // 10: deep orange
            "#64748b", // 11: slate
        ];
        const idx = Math.abs(Number(colorIdx) || 0) % palette.length;
        return palette[idx];
    }

    toggleBalanceImpact() {
        this.state.balanceExpanded = !this.state.balanceExpanded;
    }

    async approve() {
        if (this.state.processing) return;
        this.state.processing = true;

        try {
            const updated = await this.orm.call(
                "hr.leave",
                "approve_leave_request",
                [],
                { leave_id: this.props.requestId }
            );
            this.state.detail = updated;
            this.notification.add(
                updated.status === "approved"
                    ? "Leave request approved successfully!"
                    : "First approval recorded. Request forwarded for final approval.",
                { type: "success" }
            );
            this.props.onChanged?.();
        } catch (err) {
            this.notification.add(err.message || "Approval failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    openReject() {
        this.state.rejectReason = "";
        this.state.showRejectModal = true;
    }

    closeReject() {
        this.state.showRejectModal = false;
    }

    async confirmReject() {
        const reason = (this.state.rejectReason || "").trim();
        if (reason.length < 3) {
            this.notification.add("Rejection reason must contain at least 3 characters.", { type: "warning" });
            return;
        }

        this.state.processing = true;
        try {
            const updated = await this.orm.call(
                "hr.leave",
                "reject_leave_request",
                [],
                { leave_id: this.props.requestId, reason: reason }
            );
            this.state.detail = updated;
            this.state.showRejectModal = false;
            this.notification.add("Leave request rejected.", { type: "info" });
            this.props.onChanged?.();
        } catch (err) {
            this.notification.add(err.message || "Rejection failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    openCancel() {
        this.state.cancelReason = "";
        this.state.showCancelModal = true;
    }

    closeCancel() {
        this.state.showCancelModal = false;
    }

    async confirmCancel() {
        const reason = (this.state.cancelReason || "").trim();
        if (reason.length < 3) {
            this.notification.add("Cancellation reason must contain at least 3 characters.", { type: "warning" });
            return;
        }

        this.state.processing = true;
        try {
            const updated = await this.orm.call(
                "hr.leave",
                "cancel_approved_leave",
                [],
                { leave_id: this.props.requestId, reason: reason }
            );
            this.state.detail = updated;
            this.state.showCancelModal = false;
            this.notification.add("Approved leave cancelled and balance restored.", { type: "warning" });
            this.props.onChanged?.();
        } catch (err) {
            this.notification.add(err.message || "Cancellation failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    close() {
        this.props.close();
    }

    getLeaveTypeColor(colorIdx, typeName = "") {
        const name = (typeName || "").toLowerCase();
        if (name.includes("annual") || name.includes("paid time off")) return "#3b82f6";
        if (name.includes("sick")) return "#ef4444";
        if (name.includes("maternity") || name.includes("paternity")) return "#8b5cf6";
        if (name.includes("compensatory") || name.includes("comp")) return "#f59e0b";
        if (name.includes("study")) return "#10b981";
        if (name.includes("unpaid")) return "#64748b";
        if (name.includes("remote")) return "#06b6d4";

        const palette = [
            "#3b82f6", "#ef4444", "#8b5cf6", "#f59e0b",
            "#10b981", "#8b5cf6", "#06b6d4", "#ec4899",
            "#22c55e", "#6366f1", "#f97316", "#64748b"
        ];
        const idx = Math.abs(Number(colorIdx) || 0) % palette.length;
        return palette[idx];
    }
}

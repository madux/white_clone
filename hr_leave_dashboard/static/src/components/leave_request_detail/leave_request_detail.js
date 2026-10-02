/** @odoo-module **/

import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";

export class LeaveRequestDetailModal extends Component {
    static template = "hr_leave_dashboard.LeaveRequestDetailModal";
    static props = {
        requestId: Number,
        close: Function,
        onChanged: { type: Function, optional: true },
        readOnly: { type: Boolean, optional: true },
    };

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");
        this.notification = useService("notification");
        this.previousFocusedElement = document.activeElement;

        this.state = useState({
            loading: true,
            detail: null,

            balanceExpanded: true,
            recommendationExpanded: false,

            showRejectModal: false,
            rejectReason: "",
            rejectCategory: "",

            showCancelModal: false,
            cancelReason: "",

            showChangesModal: false,
            changesComment: "",
            insights: null,
            insightFeedback: null,

            conflictsExpanded: true,
            showOverrideConfirmModal: false,
            overrideAcknowledgment: "I have reviewed the coverage risk and choose to proceed.",

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
            if (!this.props.readOnly && this.state.detail.actions?.can_approve) {
                this.state.insights = await this.orm.call(
                    "hr.leave.ai.service", "get_approval_insights", [this.props.requestId]
                );
            }
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

    toggleBalanceImpact() {
        this.state.balanceExpanded = !this.state.balanceExpanded;
    }

    toggleRecommendation() {
        this.state.recommendationExpanded = !this.state.recommendationExpanded;
    }

    toggleConflicts() {
        this.state.conflictsExpanded = !this.state.conflictsExpanded;
    }

    openTeamCalendar() {
        this.props.close();
        const dateFrom = this.state.detail?.date_from;
        window.dispatchEvent(new CustomEvent("cleon-open-calendar", { detail: { date: dateFrom } }));
        if (this.action) {
            this.action.doAction("hr_leave_dashboard.action_hr_leave_calendar", {
                additionalContext: { default_date: dateFrom },
            });
        }
    }

    async approve(override = false) {
        if (this.state.processing) return;

        // If threshold exceeded and not yet confirmed with override, prompt confirmation (LM-041 AC6)
        if (!override && this.state.detail?.coverage_impact?.threshold_exceeded) {
            this.state.showOverrideConfirmModal = true;
            return;
        }

        this.state.processing = true;
        try {
            const updated = await this.orm.call(
                "hr.leave",
                "approve_leave_request",
                [],
                {
                    leave_id: this.props.requestId,
                    override_conflict: override,
                    conflict_acknowledgment: override ? this.state.overrideAcknowledgment : "",
                }
            );
            this.state.detail = updated;
            this.state.showOverrideConfirmModal = false;
            this.notification.add(
                updated.status === "approved"
                    ? (override ? "Leave request approved with coverage risk acknowledgment." : "Leave request approved successfully!")
                    : "First approval recorded. Request forwarded for final approval.",
                { type: "success" }
            );
            this.props.onChanged?.();
            this.props.close();
        } catch (err) {
            this.notification.add(err.message || "Approval failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    async confirmOverrideApproval() {
        await this.approve(true);
    }

    openReject() {
        this.state.rejectReason = "";
        this.state.rejectCategory = "";
        this.state.showRejectModal = true;
    }

    closeReject() {
        this.state.showRejectModal = false;
    }

    async confirmReject() {
        const reason = (this.state.rejectReason || "").trim();
        if (!this.state.rejectCategory || reason.length < 3) {
            this.notification.add("Select a category and provide comments of at least 3 characters.", { type: "warning" });
            return;
        }

        this.state.processing = true;
        try {
            const updated = await this.orm.call(
                "hr.leave",
                "reject_leave_request",
                [],
                { leave_id: this.props.requestId, reason: reason, category: this.state.rejectCategory }
            );
            this.state.detail = updated;
            this.state.showRejectModal = false;
            this.notification.add("Leave request rejected.", { type: "info" });
            this.props.onChanged?.();
            this.props.close();
        } catch (err) {
            this.notification.add(err.message || "Rejection failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    openChanges() {
        this.state.changesComment = "";
        this.state.showChangesModal = true;
    }

    closeChanges() {
        this.state.showChangesModal = false;
    }

    async confirmChanges() {
        const comment = this.state.changesComment.trim();
        if (!comment || comment.length > 500) {
            this.notification.add("A comment of no more than 500 characters is required.", { type: "warning" });
            return;
        }
        this.state.processing = true;
        try {
            this.state.detail = await this.orm.call("hr.leave", "request_leave_changes", [this.props.requestId, comment]);
            this.state.showChangesModal = false;
            this.state.insights = null;
            this.notification.add("Request returned to the employee for changes.", { type: "info" });
            this.props.onChanged?.();
            this.props.close();
        } catch (err) {
            this.notification.add(err.message || "Could not request changes.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    async rateInsight(helpful) {
        await this.orm.call("hr.leave.ai.service", "record_approval_insight_feedback", [this.props.requestId, helpful]);
        this.state.insightFeedback = helpful;
        this.notification.add("Insight feedback recorded.", { type: "success" });
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
            this.props.close();
        } catch (err) {
            this.notification.add(err.message || "Cancellation failed.", { type: "danger" });
        } finally {
            this.state.processing = false;
        }
    }

    close() {
        this.props.close();
    }

    getLeaveTypeColor(colorHex) {
        return /^#[0-9A-F]{6}$/i.test(colorHex || "") ? colorHex : "#64748B";
    }
}

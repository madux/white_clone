/** @odoo-module **/

import { Component, useState, onWillStart } from "@odoo/owl";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

import { JobHeader } from "./job_header";
import { JobHealthScore } from "./components/job_health_score";
import { JobTimeline } from "./components/job_timeline";
import { PipelineOverview } from "./components/pipeline_overview";
import { CleonAIPanel } from "./components/cleon_ai_panel";
import { HiringTeam } from "./components/hiring_team";
import { RecentActivity } from "./components/recent_activity";
import { JobSideBar } from "./components/sidebar";

// Buckets shown in the Pipeline Overview chart. Map your real
// hr.recruitment.stage names to these keys below in _loadPipeline().
const PIPELINE_BUCKETS = ["Applied", "Screening", "Interview", "Offer", "Hired"];

const TEAM_COLORS = ["#ec4899", "#2563eb", "#8b5cf6", "#f59e0b", "#16a34a"];

export class JobDashboard extends Component {
    static template = "hr_job_dashboard.JobDashboard";
    static components = {
        JobHeader,
        JobHealthScore,
        JobTimeline,
        PipelineOverview,
        CleonAIPanel,
        HiringTeam,
        RecentActivity,
        JobSideBar,
    };
    static props = ["*"];

    setup() {
        this.orm = useService("orm");
        this.action = useService("action");

        this.state = useState({
            activeTab: "overview",
            activeSection: "dashboard",   // NEW — drives the sidebar
            loading: true,
            job: null,
            timeline: null,
            pipeline: [],
            team: [],
            activity: [],
        }); 

        // action.context.active_id is how Odoo passes the record the
        // action was opened from (e.g. a button on the hr.job form).
        this.jobId = this.props.action?.context?.active_id || this.props.action?.params?.job_id;

        onWillStart(() => this.loadAll());
    }

    onSidebarNavigate(key) {
        this.state.activeSection = key;

        // "dashboard" stays inside this component (renders the cards below).
        // Everything else routes to a real Odoo view/action.
        const routes = {
            candidates: () => this.action.doAction({
                type: "ir.actions.act_window",
                res_model: "hr.applicant",
                views: [[false, "list"], [false, "form"]],
                domain: [["job_id", "=", this.jobId]],
                target: "current",
            }),
            jobs: () => this.action.doAction("hr_recruitment.action_hr_job"),
            // offers_hired, vendors, requisition, cbt_test, talent_mobility,
            // settings, get_started: wire these to real actions/models once
            // you know what they should point to.
        };

        if (routes[key]) routes[key]();
    }

    async loadAll() {
        await Promise.all([
            this._loadJob(),
            this._loadPipeline(),
            this._loadTeam(),
            this._loadActivity(),
        ]);
        this.state.loading = false;
    }

    async _loadJob() {
        const [job] = await this.orm.read(
            "hr.job",
            [this.jobId],
            [
                "name",
                "department_id",
                "location",
                "job_stage",
                "no_of_recruitment",
                "application_count",
                "create_date",
            ]
        );

        const postedDate = new Date(job.create_date);
        const today = new Date();
        const postedDaysAgo = Math.max(0, Math.floor((today - postedDate) / 86400000));

        // hr.job has no native target-close-date field — default to a
        // 30-day window. Swap in a custom field if you add one.
        const targetClose = new Date(postedDate.getTime() + 30 * 86400000);
        const daysToClose = Math.max(0, Math.ceil((targetClose - today) / 86400000));
        const daysOpen = postedDaysAgo;

        // Simple health-score heuristic: reward candidate flow, penalize
        // a job sitting open too long relative to its 30-day target.
        // Replace with a real KPI/formula field if you track one.
        const candidateScore = Math.min(60, job.application_count * 6);
        const paceScore = Math.max(0, 40 - Math.floor((daysOpen / 30) * 40));
        const score = Math.min(100, candidateScore + paceScore) || 70;

        this.state.job = {
            id: job.id,
            name: job.name,
            department: job.department_id?.[1] || "",
            city: job.location || "",
            candidateCount: job.application_count,
            daysOpen,
            published: job.job_stage === "hired" || job.job_stage === "published",
        };

        this.state.timeline = {
            postedDaysAgo,
            totalCandidates: job.application_count,
            daysToClose,
        };

        this.state.health = { score, candidates: job.application_count, daysOpen };
    }

    async _loadPipeline() {
        const groups = await this.orm.readGroup(
            "hr.applicant",
            [["job_id", "=", this.jobId]],
            ["stage_id"],
            ["stage_id"]
        );

        const counts = {};
        for (const g of groups) {
            const stageName = g.stage_id ? g.stage_id[1] : "Applied";
            counts[stageName] = g.stage_id_count;
        }

        this.state.pipeline = PIPELINE_BUCKETS.map((label) => ({
            label,
            count: counts[label] || 0,
        }));
    }

    async _loadTeam() {
        const [job] = await this.orm.read("hr.job", [this.jobId], ["user_id", "interviewer_ids"]);
        const userIds = [job.user_id?.[0], ...(job.interviewer_ids || [])].filter(Boolean);
        if (!userIds.length) {
            this.state.team = [];
            return;
        }

        const users = await this.orm.read("res.users", userIds, ["name", "im_status"]);

        this.state.team = users.map((u, i) => ({
            id: u.id,
            name: u.name,
            role: i === 0 ? "Hiring Manager" : "Interviewer",
            initials: u.name
                .split(" ")
                .map((p) => p[0])
                .slice(0, 2)
                .join("")
                .toUpperCase(),
            color: TEAM_COLORS[i % TEAM_COLORS.length],
            online: u.im_status === "online",
        }));
    }

    async _loadActivity() {
        const messages = await this.orm.searchRead(
            "mail.message",
            [
                ["model", "=", "hr.job"],
                ["res_id", "=", this.jobId],
            ],
            ["subject", "body", "date"],
            { order: "date desc", limit: 3 }
        );

        this.state.activity = messages.map((m) => ({
            id: m.id,
            icon: "fa-comment",
            colorClass: "activity-icon--note",
            title: m.subject || "Activity update",
            timeLabel: this._relativeTime(m.date),
        }));
    }

    _relativeTime(dateStr) {
        const diffMs = new Date() - new Date(dateStr + "Z");
        const hours = Math.floor(diffMs / 3600000);
        if (hours < 1) return "Just now";
        if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
        const days = Math.floor(hours / 24);
        return days === 1 ? "Yesterday" : `${days} days ago`;
    }

    onTabChange(key) {
        this.state.activeTab = key;
    }

    onBack() {
        this.action.doAction({ type: "ir.actions.act_window_close" });
    }

    onAddCandidate() {
        this.action.doAction({
            type: "ir.actions.act_window",
            res_model: "hr.applicant",
            views: [[false, "form"]],
            target: "current",
            context: { default_job_id: this.jobId },
        });
    }

    onCleonAction(actionKey) {
        // Hook your CleonAI service calls up here (rank candidates,
        // run bias audit, detect duplicates, pipeline insight, etc).
        console.log("CleonAI action:", actionKey);
    }
}

registry.category("actions").add("hr_job_dashboard", JobDashboard);

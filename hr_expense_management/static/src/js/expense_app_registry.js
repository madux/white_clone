/** @odoo-module **/

/**
 * Presentation registry for the Expense Management shell.
 *
 * Module identity, renderer selection, descriptive copy, record detail fields,
 * KPI formatting, and state tones live here instead of being scattered through
 * the root component.  The server remains authoritative for visible modules and
 * action field contracts.
 */
export const MODULE_REGISTRY = Object.freeze({
    dashboard: {
        view: "governance",
        description: "Quick actions, recent activity, assigned tasks, and announcements",
        details: ["description", "employee", "amount", "date", "reference"],
    },
    setup: {
        view: "governance",
        description: "Company onboarding, policies, and implementation readiness",
        details: ["description", "email", "phone", "currency", "country"],
    },
    claims: {
        view: "claims",
        description: "Create, review, configure, approve, and reimburse employee expenses",
        details: ["amount", "date", "employee", "department", "type", "category", "assignee"],
    },
    requests: {
        view: "requests",
        description: "Submit and track expense pre-approval requests",
        details: ["amount", "needed_date", "employee", "department", "type", "purpose"],
    },
    advances: {
        view: "advances",
        description: "Track issued funds, aging, and employee retirement balances",
        details: ["issued", "retired", "outstanding", "due_date", "days", "age", "reason"],
    },
    workflow: {
        view: "workflow",
        description: "Review approval queues, outcomes, and routing rules",
        details: ["kind_label", "employee", "department", "amount", "date", "description"],
    },
    payments: {
        view: "payments",
        description: "Payables, batch disbursement, methods, and history",
        details: ["amount", "employee", "department", "method", "date", "count", "days"],
    },
    petty_cash: {
        view: "petty_cash",
        description: "Funds, expenses, cash counts, replenishments, and custodians",
        details: ["fund", "balance", "amount", "variance", "custodian", "payee", "category"],
    },
    teams: {
        view: "governance",
        description: "Members, departments, role permissions, exposure, and team analytics",
        details: ["department", "manager", "members", "exposure", "job", "email"],
    },
    accounts: {
        view: "accounts",
        description: "Odoo Community Accounting chart, mappings, and journal entries",
        details: ["code", "type", "subtype", "parent", "balance", "debit", "credit", "source"],
    },
    vendors: {
        view: "vendors",
        description: "Suppliers, service providers, spend links, and payment terms",
        details: ["code", "category", "rating", "spend", "claim_count", "account", "email"],
    },
    budget: {
        view: "budget",
        description: "Department allocations, commitments, actuals, and variance",
        details: ["department", "period", "approved", "committed", "actual", "available", "utilization"],
    },
    reports: {
        view: "governance",
        description: "Financial, claims, employee, custom, and scheduled reporting",
        details: ["type", "date_basis", "frequency", "format", "next_run", "recipient"],
    },
    audit: {
        view: "governance",
        description: "Immutable user, workflow, configuration, and system activity",
        details: ["user", "module", "category", "severity", "date", "description"],
    },
    settings: {
        view: "governance",
        description: "Policies, workflow defaults, notifications, and integration adapters",
        details: ["event", "provider", "subject", "description", "configured"],
    },
    theme: {
        view: "governance",
        description: "Company branding, density, typography, and a live application preview",
        details: ["primary_color", "secondary_color", "font_family", "density", "corner_style"],
    },
});

const STATUS_TONES = Object.freeze({
    approved: "success", fulfilled: "success", retired: "success", paid: "success",
    posted: "success", active: "success", under: "success", complete: "success",
    submitted: "warning", appealed: "warning", outstanding: "warning", partial: "warning",
    pending: "warning", track: "warning", risk: "warning", draft: "warning",
    rejected: "danger", cancelled: "danger", written_off: "danger", over: "danger",
});

export function moduleView(module, page) {
    if (module === "dashboard" && page === "overview") return "dashboard";
    return MODULE_REGISTRY[module]?.view || "unsupported";
}

export function moduleDescription(module) {
    return MODULE_REGISTRY[module]?.description || "Expense Management";
}

export function statusClass(state) {
    return `text-bg-${STATUS_TONES[state] || "light"}`;
}

export function detailFields(module) {
    return MODULE_REGISTRY[module]?.details || [];
}

export function featureKpis(module, pageKpis, dashboardKpis, formatMoney) {
    const kpis = pageKpis || {};
    const specs = {
        setup: [
            ["Progress", `${kpis.percent || 0}%`, "fa-tasks", "pink"],
            ["Complete", kpis.complete || 0, "fa-check", "success"],
            ["Remaining", Math.max((kpis.total || 0) - (kpis.complete || 0), 0), "fa-clock-o", "warning"],
        ],
        teams: [
            ["Members", kpis.members || 0, "fa-users", "pink"],
            ["Departments", kpis.departments || 0, "fa-sitemap", "violet"],
            ["Managers", kpis.managers || 0, "fa-user-secret", "success"],
            ["Exposure", formatMoney(kpis.exposure), "fa-money", "warning"],
        ],
        reports: [
            ["Claims", kpis.claims || 0, "fa-file-text-o", "pink"],
            ["Submitted", formatMoney(kpis.submitted), "fa-line-chart", "violet"],
            ["Approved", formatMoney(kpis.approved), "fa-check", "success"],
            ["Paid", formatMoney(kpis.paid), "fa-credit-card", "warning"],
        ],
        audit: [
            ["Events", kpis.events || 0, "fa-history", "pink"],
            ["Users", kpis.users || 0, "fa-users", "violet"],
            ["Configuration", kpis.configuration || 0, "fa-cog", "success"],
            ["Critical", kpis.critical || 0, "fa-exclamation-triangle", "warning"],
        ],
        settings: [
            ["Policies", kpis.policies || 0, "fa-book", "pink"],
            ["Templates", kpis.templates || 0, "fa-envelope", "violet"],
            ["Connected", kpis.integrations || 0, "fa-plug", "success"],
            ["Configured", kpis.configured || 0, "fa-check", "warning"],
        ],
        theme: [["Theme", kpis.configured ? "Configured" : "Default", "fa-paint-brush", "pink"]],
        dashboard: [
            ["Claims", dashboardKpis.total || 0, "fa-file-text-o", "pink"],
            ["Pending", dashboardKpis.submitted || 0, "fa-clock-o", "warning"],
            ["Approved", dashboardKpis.approved || 0, "fa-check", "success"],
            ["Paid", dashboardKpis.paid || 0, "fa-credit-card", "violet"],
        ],
    };
    return (specs[module] || []).map(([label, value, icon, tone], id) => ({
        id, label, value, icon, tone,
    }));
}


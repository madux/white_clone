/** @odoo-module **/
import { Component, onWillStart, onWillUnmount, useState } from "@odoo/owl";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { _t } from "@web/core/l10n/translation";
import { employeePortalRegistry } from "./portal_registry";

export class EmployeePortalApp extends Component {
    static template = "white_clone_portal.EmployeePortal";
    static props = ["*"];
    setup() {
        this.orm = useService("orm");
        this.user = useService("user");
        this.notification = useService("notification");
        this.providers = employeePortalRegistry.getAll();
        this.state = useState({ page: "dashboard", contexts: {}, collapsed: {}, failures: [] });
        onWillStart(async () => {
            await Promise.all(this.providers.map(async provider => {
                try {
                    this.state.contexts[provider.id] = await provider.load({ orm: this.orm, user: this.user });
                } catch {
                    this.state.failures.push(provider.label);
                }
            }));
            const requested = this.props.action?.params?.initial_page || "dashboard";
            const page = this.resolvePage(requested);
            if (this.findPage(page)) this.state.page = page;
            document.documentElement.classList.add("has-cleon-employee-portal");
            window.CleonAppLauncher?.load();
        });
        onWillUnmount(() => document.documentElement.classList.remove("has-cleon-employee-portal"));
    }
    get employeeName() {
        return Object.values(this.state.contexts).find(context => context.employeeName)?.employeeName || this.user.name;
    }
    get sections() {
        return this.providers.map(provider => {
            const context = this.state.contexts[provider.id];
            const pages = context ? provider.pages.filter(page => page.visible(context)).sort((a, b) => a.sequence - b.sequence) : [];
            return { ...provider, pages, context };
        }).filter(section => section.pages.length);
    }
    get dashboards() {
        return this.providers.filter(provider => provider.dashboard && this.state.contexts[provider.id]?.dashboard);
    }
    get welcomeActions() {
        return this.sections.flatMap(section => section.pages.filter(page => page.welcome));
    }
    resolvePage(id) {
        return this.providers.flatMap(provider => provider.pages).find(page => page.id === id || page.aliases?.includes(id))?.id || id;
    }
    findPage(id) { return this.sections.flatMap(section => section.pages).find(page => page.id === id); }
    get currentPage() { return this.findPage(this.state.page); }
    get currentProps() { return this.currentPage?.props || {}; }
    setPage(id) {
        const page = this.resolvePage(id);
        if (page !== "dashboard" && !this.findPage(page)) {
            this.notification.add(_t("This employee screen is not currently available."), { type: "warning" });
            return;
        }
        this.state.page = page;
    }
    toggleSection(id) { this.state.collapsed[id] = !this.state.collapsed[id]; }
}
registry.category("actions").add("white_clone_portal.EmployeePortal", EmployeePortalApp);

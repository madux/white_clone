/** @odoo-module **/
import { registry } from "@web/core/registry";
import { formView } from "@web/views/form/form_view";
import { FormRenderer } from "@web/views/form/form_renderer";
import { AdminSidebar } from "./admin_sidebar";

export class AdminSidebarFormRenderer extends FormRenderer {
    static template = "cc_admin.FormRendererWithSidebar";
    static components = { ...FormRenderer.components, AdminSidebar };

    onSidebarNavigate(actionName) {
        // Route the sidebar's action names (openRecord, openCalendar, ...)
        // to whatever you need — e.g. this.env.services.action.doAction(...)
        console.log("Sidebar action clicked:", actionName);
    }
}

export const adminSidebarFormView = {
    ...formView,
    Renderer: AdminSidebarFormRenderer,
};

registry.category("views").add("experience_sidebar_form", adminSidebarFormView);
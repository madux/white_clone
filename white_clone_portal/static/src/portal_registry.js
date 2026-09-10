/** @odoo-module **/
import { registry } from "@web/core/registry";

// Providers own their pages, access loader and optional dashboard component.
// Odoo loads a provider's assets only when its integration module is installed.
export const employeePortalRegistry = registry.category("cleon.employee_portal");

/** @odoo-module **/

import { Component } from "@odoo/owl";

export class StaffDirectoryFullProfile extends Component {
    static template = "hr_staff_directory.StaffDirectoryFullProfile";
    static props = ["*"];

    setup() {
        this.AVATAR_COLORS = [
            '#ec4899', '#8B5CF6', '#22C55E', '#3B82F6', 
            '#F59E0B', '#0EA5E9', '#EF4444', '#14B8A6'
        ];
    }

    avatarColor(name) {
        if (!name) return this.AVATAR_COLORS[0];
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const index = Math.abs(hash) % this.AVATAR_COLORS.length;
        return this.AVATAR_COLORS[index];
    }

    initials(name) {
        if (!name) return "";
        const parts = name.trim().split(" ");
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
}

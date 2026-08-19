/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export class StaffDirectoryOrgChart extends Component {
    static template = "hr_staff_directory.OrgChart";
    static props = {
        people: { type: Array },
        openProfile: { type: Function }
    };

    setup() {
        this.state = useState({
            orgZoom: 1,
            orgPanX: 0,
            orgPanY: 0,
            orgCollapsedNodes: {},
            orgActiveNodeId: null,
            orgPopupOffsetX: 0,
            orgPopupOffsetY: 0,
            isDraggingOrg: false,
            isDraggingPopup: false,
            orgSidebarOpen: false
        });
        
        // Private variables for drag calculations
        this._lastMouseX = 0;
        this._lastMouseY = 0;
    }

    // ─── Org Chart Computed Properties ───────────────────────────────────

    get orgRootNodes() {
        return this.props.people.filter(p => !p.manager_id);
    }

    getOrgChildren(personId) {
        return this.props.people.filter(p => p.manager_id === personId);
    }

    getOrgDirectReportsCount(personId) {
        return this.props.people.filter(p => p.manager_id === personId).length;
    }

    getRoleCode(role) {
        if (!role) return 'EMP';
        return role.split(' ').map(w => w[0]).join('').toUpperCase().substring(0, 3);
    }

    // ─── Org Chart Actions ─────────────────────────────────────────────

    onOrgCanvasWheel(ev) {
        ev.preventDefault();
        const delta = ev.deltaY > 0 ? -0.1 : 0.1;
        let newZoom = this.state.orgZoom + delta;
        if (newZoom < 0.2) newZoom = 0.2;
        if (newZoom > 3) newZoom = 3;
        this.state.orgZoom = newZoom;
    }

    onOrgCanvasMouseDown(ev) {
        if (ev.target.closest('.sdir-org-node') || ev.target.closest('.sdir-org-popup')) return;
        this.state.isDraggingOrg = true;
        this._lastMouseX = ev.clientX;
        this._lastMouseY = ev.clientY;
    }

    onOrgCanvasMouseMove(ev) {
        if (this.state.isDraggingOrg) {
            const dx = ev.clientX - this._lastMouseX;
            const dy = ev.clientY - this._lastMouseY;
            this.state.orgPanX += dx;
            this.state.orgPanY += dy;
            this._lastMouseX = ev.clientX;
            this._lastMouseY = ev.clientY;
        } else if (this.state.isDraggingPopup) {
            const dx = ev.clientX - this._lastMouseX;
            const dy = ev.clientY - this._lastMouseY;
            this.state.orgPopupOffsetX += dx;
            this.state.orgPopupOffsetY += dy;
            this._lastMouseX = ev.clientX;
            this._lastMouseY = ev.clientY;
        }
    }

    onOrgCanvasMouseUp(ev) {
        this.state.isDraggingOrg = false;
        this.state.isDraggingPopup = false;
    }

    zoomOrgIn() {
        let newZoom = this.state.orgZoom + 0.1;
        if (newZoom > 3) newZoom = 3;
        this.state.orgZoom = newZoom;
    }

    zoomOrgOut() {
        let newZoom = this.state.orgZoom - 0.1;
        if (newZoom < 0.2) newZoom = 0.2;
        this.state.orgZoom = newZoom;
    }

    resetOrgZoomPan() {
        this.state.orgZoom = 1;
        this.state.orgPanX = 0;
        this.state.orgPanY = 0;
    }

    panOrgDirection(dir) {
        const step = 50;
        if (dir === 'up') this.state.orgPanY += step;
        if (dir === 'down') this.state.orgPanY -= step;
        if (dir === 'left') this.state.orgPanX += step;
        if (dir === 'right') this.state.orgPanX -= step;
    }

    toggleOrgNodeCollapse(id) {
        this.state.orgCollapsedNodes[id] = !this.state.orgCollapsedNodes[id];
    }

    toggleOrgSidebar() {
        this.state.orgSidebarOpen = !this.state.orgSidebarOpen;
    }

    openOrgNodePopup(personId, ev) {
        if (ev) ev.stopPropagation();
        this.state.orgActiveNodeId = personId;
        this.state.orgPopupOffsetX = 0;
        this.state.orgPopupOffsetY = 0;
    }

    closeOrgPopup(ev) {
        if (ev) ev.stopPropagation();
        this.state.orgActiveNodeId = null;
    }

    onPopupDragStart(ev) {
        this.state.isDraggingPopup = true;
        this._lastMouseX = ev.clientX;
        this._lastMouseY = ev.clientY;
    }
}

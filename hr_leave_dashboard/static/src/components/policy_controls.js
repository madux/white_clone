/** @odoo-module **/
import { Component, useState, useRef, onPatched } from "@odoo/owl";

export class SettingsPanel extends Component {
    static template = "hr_leave_dashboard.SettingsPanel";
    static props = { close: Function, wide: { type: Boolean, optional: true }, slots: Object };
}

export class TagsPicker extends Component {
    static template = "hr_leave_dashboard.TagsPicker";
    static props = { options: Array, selected: Array, toggle: Function, create: { type: Function, optional: true }, placeholder: { type: String, optional: true }, employee: { type: Boolean, optional: true } };
    setup() {
        this.state = useState({ query: "", open: false, active: 0 });
        this.input = useRef("input");
        this.options = useRef("options");
        onPatched(() => this.options.el?.querySelector(".is-active")?.scrollIntoView({ block: "nearest" }));
    }
    focus() { this.input.el.focus(); this.state.open = true; }
    blur(ev) { if (!ev.currentTarget.contains(ev.relatedTarget)) this.state.open = false; }
    search(ev) { this.state.query = ev.target.value; this.state.active = 0; this.state.open = true; }
    get matches() {
        return this.props.options.filter(item => !this.props.selected.some(value => value.id === item.id) && item.name.toLowerCase().includes(this.state.query.toLowerCase()));
    }
    get canCreate() {
        const name = this.state.query.trim().toLowerCase();
        return this.props.create && name && ![...this.props.options, ...this.props.selected].some(item => item.name.toLowerCase() === name);
    }
    pick(item) { this.props.toggle(item.id); this.state.query = ""; this.state.active = 0; this.state.open = false; this.input.el.focus(); }
    create() { this.props.create(this.state.query.trim()); this.state.query = ""; this.state.active = 0; this.state.open = false; this.input.el.focus(); }
    keydown(ev) {
        if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
            ev.preventDefault();
            const count = this.matches.length + (this.canCreate ? 1 : 0);
            this.state.active = this.state.open ? Math.max(0, Math.min(count - 1, this.state.active + (ev.key === "ArrowDown" ? 1 : -1))) : 0;
            this.state.open = true;
        }
        if (ev.key === "Escape") { this.state.open = false; ev.stopPropagation(); }
        if (ev.key === "Enter" && this.state.open) {
            ev.preventDefault();
            if (this.matches[this.state.active]) this.pick(this.matches[this.state.active]);
            else if (this.canCreate) this.create();
        }
    }
}

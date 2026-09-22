/** @odoo-module **/

import { Component } from "@odoo/owl";

/** Reusable footer for client-side lists; callers own filtering and page slicing. */
export class ListPager extends Component {
    static template = "hr_leave_dashboard.ListPager";
    static props = {
        total: Number,
        page: Number,
        pageSize: Number,
        label: String,
        onPageChange: Function,
        onPageSizeChange: Function,
        pageSizes: { type: Array, optional: true },
    };

    get sizes() { return this.props.pageSizes || [10, 25, 50, 100]; }
    get pageCount() { return Math.max(1, Math.ceil(this.props.total / this.props.pageSize)); }
    get currentPage() { return Math.min(this.props.page, this.pageCount); }
    get start() { return this.props.total ? (this.currentPage - 1) * this.props.pageSize + 1 : 0; }
    get end() { return Math.min(this.currentPage * this.props.pageSize, this.props.total); }
    get pageNumbers() { return Array.from({ length: this.pageCount }, (_, index) => index + 1); }
}

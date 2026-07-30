/** @odoo-module **/

import { registry } from "@web/core/registry";
import { Component, onMounted, onWillUnmount, useState, useRef, onWillStart, useEffect } from "@odoo/owl";
import { loadJS, loadBundle} from "@web/core/assets";

export class HrLeaveDashboard extends Component {
    static template = "hr_leave_dashboard.Dashboard";

    setup() {
        this.charts = {};
        this.isDestroyed = false;   // <-- guard flag
        this.currentRequest = null; // <-- track in-flight ajax so we can abort it
        this.charts_trends = null;
        this.canvasRef = useRef("trendsChart");
        this.byTypeChart = useRef("byTypeChart");
        this.approvalChart = useRef("approvalChart");
        
        this.state = useState({
            months: 6,
            kpis: {},
            trends: {labels: [], total: [], approved: [], pending: [], rejected: [], summary: {} },
            byType: [],
            balance: [],
            approval: { approved: 0, pending: 0, rejected: 0, approval_rate: 0 },
            loading: true,
        });
        // onMounted(async () => {
        //     await loadJS("/web/static/lib/Chart/Chart.js");
        //     this.fetchAndRender(6);

        //     $(this.el).on("click", ".range-btn", (ev) => {
        //         const months = $(ev.currentTarget).data("months");
        //         $(".range-btn").removeClass("active");
        //         $(ev.currentTarget).addClass("active");
        //         this.fetchAndRender(months);
        //     });
        // });

        // onWillUnmount(() => {
        //     this.isDestroyed = true;
        //     if (this.currentRequest) {
        //         this.currentRequest.abort(); // cancel pending ajax
        //     }
        //     Object.values(this.charts).forEach((c) => c && c.destroy());
        //     if (this.el) {
        //         $(this.el).off("click", ".range-btn");
        //     }
        // });
        onWillStart(async () => await loadBundle("web.chartjs_lib"));

        useEffect(
            () => {
                this.fetchAndRender(this.state.months);
                return () => {
                    if (this.charts.trends) this.charts.trends.destroy();
                    if (this.charts.byType) this.charts.byType.destroy();
                    if (this.charts.approval) this.charts.approval.destroy();
                };
            },
            () => [this.state.months]   // <-- only re-run when "months" changes
        );

        // useEffect(() => {
        //     this.fetchAndRender();
        //     return () => { 
        //         if (this.charts.trends) this.charts.trends.destroy();

        //     };
        // });
    }
    fetchAndRender(months) {
        // abort any previous in-flight request before starting a new one
        if (this.currentRequest) {
            this.currentRequest.abort();
        }

        this.currentRequest = $.ajax({
            url: "/hr_leave_dashboard/data",
            type: "POST",
            contentType: "application/json",
            data: JSON.stringify({ jsonrpc: "2.0", params: { months } }),
            dataType: "json",
        }).done((res) => {
            if (this.isDestroyed || !$(this.el)) {
                console.log(`logger22-2 ${res}`)

                return; // <-- key guard

            }

            const data = res.result;
            /**data == {
             * "kpis":{
             *      "total_employees":7,
             *      "on_leave_today":0,
             *      "pending_approvals":1,
             *      "upcoming_7_days":0,
             *      "utilisation_rate":50,
             *       "coverage_alerts":0},
             * "trends":{
                    * "labels":["Jan","Feb","Mar","Apr","May","Jun"],
                    * "total":[0,0,0,0,2,0],
                    * "approved":[0,0,0,0,1,0],
                    * "pending":[0,0,0,0,1,0],
                    * "rejected":[0,0,0,0,0,0],
                    * "summary":{
                    *   "total":2,
                    *   "approved":1,   
                    *   "pending":1,
                    *   "rejected":0
                    * }
                },
                "by_type":[
                    {"name":"Paid Time Off","count":2,"percent":100}
                ],
                "balance":[
                    {"name":"Paid Time Off","color":2,"used":10,"allocated":20,"percent":50}
                ],
                "approval_overview":{
                    "approved":1,"pending":1,"rejected":0,"approval_rate":50
                    }
                }*/

            console.log(`logger22-3 ${JSON.stringify(data)}`)
            this.state.kpis = data.kpis;
            this.state.trends = data.trends;
            this.state.byType = data.by_type;
            this.state.balance = data.balance;
            this.state.approval = data.approval_overview;

            this.renderKpis(data.kpis);
            this.renderTrends(data.trends);
            this.renderByType(data.by_type);
            this.renderBalance(data.balance);
            this.renderApproval(data.approval_overview);
        }).fail((err) => {
            if (err.statusText === "abort") return; // expected on unmount
            console.error("Dashboard load failed", err);
        });
    }

    renderTrends(d) {
        const canvas = this.canvasRef.el; //$(this.el)?.querySelector("#trendsChart");
        console.log(`The main canvas ${canvas}`)
        if (!canvas) return; // extra safety
        const ctx = canvas.getContext("2d");
        if (this.charts.trends) this.charts.trends.destroy();
        this.charts.trends = new Chart(ctx, {
            type: "line",
            data: {
                labels: d.labels,
                datasets: [
                    { label: "Total", data: d.total, borderColor: "#e91e8c", tension: 0.4, fill: true, backgroundColor: "rgba(233,30,140,0.08)" },
                    { label: "Approved", data: d.approved, borderColor: "#17a673", tension: 0.4 },
                    { label: "Pending", data: d.pending, borderColor: "#f0ad4e", tension: 0.4 },
                    { label: "Rejected", data: d.rejected, borderColor: "#dc3545", tension: 0.4 },
                ],
                // datasets: [
                //     { label: "Total", data: [3, 3, 10, 18, 40, 8], borderColor: "#e91e8c", tension: 0.4, fill: true, backgroundColor: "rgba(233,30,140,0.08)" },
                //     { label: "Approved", data: [3, 3, 34, 18, 40, 8], borderColor: "#17a673", tension: 0.4 },
                //     { label: "Pending", data: [3, 23, 10, 28, 20, 8], borderColor: "#f0ad4e", tension: 0.4 },
                //     { label: "Rejected", data: [3, 3, 10, 18, 5, 8], borderColor: "#dc3545", tension: 0.4 },
                // ],
            },
            options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { beginAtZero: true } } },
        });

        $(this.el).find("[data-summary='total']").text(d.summary.total);
        $(this.el).find("[data-summary='approved']").text(d.summary.approved);
        $(this.el).find("[data-summary='pending']").text(d.summary.pending);
        $(this.el).find("[data-summary='rejected']").text(d.summary.rejected);
    }

    renderKpis(k) {
        const $root = $(this.el);
        $root.find("[data-kpi='total_employees']").text(k.total_employees);
        $root.find("[data-kpi='pending_approvals']").text(k.pending_approvals);
        $root.find("[data-kpi='on_leave_today']").text(k.on_leave_today);
        $root.find("[data-kpi='upcoming']").text(k.upcoming_7_days);
        $root.find("[data-kpi='utilisation']").text(k.utilisation_rate + "%");
        $root.find("[data-kpi='coverage']").text(k.coverage_alerts);
    }

    
    renderByType(items) {
        const ctx = this.byTypeChart.el.getContext("2d");
        if (this.charts.byType) this.charts.byType.destroy();
        const palette = ["#4e73df", "#e74a3b", "#e91e8c", "#f6a623", "#1cc88a", "#36b9cc", "#6f42c1", "#858796"];
        this.charts.byType = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: items.map((i) => i.name),
                datasets: [{ data: items.map((i) => i.count), backgroundColor: palette }],
            },
            options: { plugins: { legend: { display: false } }, cutout: "70%" },
        });

        const $legend = $(this.el).find("#byTypeLegend").empty();
        items.forEach((i, idx) => {
            $legend.append(`
                <div class="legend-row">
                    <span class="legend-dot" style="background:${palette[idx % palette.length]}"></span>
                    <span class="legend-name">${i.name}</span>
                    <span class="legend-count">${i.count}</span>
                    <span class="legend-pct">${i.percent}%</span>
                </div>
            `);
        });
    }

    renderBalance(items) {
        const $list = $(this.el).find("#balanceList").empty();
        items.forEach((i) => {
            $list.append(`
                <div class="balance-row">
                    <div class="balance-header">
                        <span class="legend-dot" style="background:${i.color}"></span>
                        <span class="balance-name">${i.name}</span>
                        <span class="balance-figures">${i.used} used / ${i.allocated} allocated &nbsp; ${i.percent}%</span>
                    </div>
                    <div class="balance-track">
                        <div class="balance-fill" style="width:${i.percent}%; background:${i.color}"></div>
                    </div>
                </div>
            `);
        });
    }

    renderApproval(a) {
        // const canvas = this.approvalChart.el;
        //  //$(this.el)?.querySelector("#trendsChart");
        // const canvas = this.approvalChart.el.getContext("2d");
        // console.log(`The main2 canvas ${canvas}`)
        const canvas = this.approvalChart.el; //$(this.el)?.querySelector("#trendsChart");
        console.log(`The main canvas ${canvas}`)
        if (!canvas) return; // extra safety
        const ctx = canvas.getContext("2d");
        if (this.charts.approval) this.charts.approval.destroy();
        this.charts.approval = new Chart(ctx, {
            type: "doughnut",
            data: {
                datasets: [{
                    data: [a.approved, a.pending, a.rejected],
                    backgroundColor: ["#1cc88a", "#f6c343", "#e74a3b"],
                }],
            },
            options: { cutout: "75%", plugins: { legend: { display: false } } },
        });
        $(this.el).find("[data-approval='rate']").text(a.approval_rate + "%");
        $(this.el).find("[data-approval='approved']").text(a.approved);
        $(this.el).find("[data-approval='pending']").text(a.pending);
        $(this.el).find("[data-approval='rejected']").text(a.rejected);
    }
}

registry.category("actions").add("hr_leave_dashboard", HrLeaveDashboard);


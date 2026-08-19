/** @odoo-module **/

import { Component, useRef, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";

// Ordered pipeline stages shown regardless of what the recruitment
// stages are internally named — map your hr.recruitment.stage records
// to these buckets in the parent (job_dashboard.js).
export class PipelineOverview extends Component {
    static template = "hr_job_dashboard.PipelineOverview";
    static props = {
        stages: { type: Array }, // [{ label: 'Applied', count: 0 }, ...]
    };

    setup() {
        this.canvasRef = useRef("barCanvas");
        this.chart = null;

        onMounted(() => this.renderChart());
        onWillUpdateProps((next) => this.renderChart(next.stages));
        onWillUnmount(() => this.chart && this.chart.destroy());
    }

    renderChart(stages = this.props.stages) {
        const ctx = this.canvasRef.el.getContext("2d");
        const data = {
            labels: stages.map((s) => s.label),
            datasets: [
                {
                    data: stages.map((s) => s.count),
                    backgroundColor: "#ec4899",
                    borderRadius: 8,
                    borderSkipped: false,
                    // keep a visible sliver even when a stage is empty,
                    // matching the "pink nub" look in the design
                    minBarLength: 6,
                    barPercentage: 0.55,
                },
            ],
        };

        if (this.chart) {
            this.chart.data = data;
            this.chart.update();
            return;
        }

        this.chart = new Chart(ctx, {
            type: "bar",
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600 },
                plugins: { legend: { display: false }, tooltip: { enabled: true } },
                scales: {
                    x: { grid: { display: false }, ticks: { display: false }, border: { display: false } },
                    y: { display: false, grid: { display: false } },
                },
            },
        });
    }
}

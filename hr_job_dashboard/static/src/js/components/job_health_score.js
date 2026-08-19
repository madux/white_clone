/** @odoo-module **/

import { Component, useRef, onMounted, onWillUnmount, onWillUpdateProps } from "@odoo/owl";

export class JobHealthScore extends Component {
    static template = "hr_job_dashboard.JobHealthScore";
    static props = {
        score: Number,
        candidates: Number,
        daysOpen: Number,
    };

    setup() {
        this.canvasRef = useRef("gaugeCanvas");
        this.chart = null;

        onMounted(() => this.renderChart());
        onWillUpdateProps((nextProps) => this.renderChart(nextProps.score));
        onWillUnmount(() => this.chart && this.chart.destroy());
    }

    get scoreColor() {
        if (this.props.score >= 80) return "#16a34a";
        if (this.props.score >= 50) return "#f59e0b";
        return "#dc2626";
    }

    renderChart(score = this.props.score) {
        const ctx = this.canvasRef.el.getContext("2d");
        const color = this.scoreColor;

        const data = {
            datasets: [
                {
                    data: [score, 100 - score],
                    backgroundColor: [color, "#eef0f3"],
                    borderWidth: 0,
                    cutout: "78%",
                    borderRadius: 12,
                },
            ],
        };

        if (this.chart) {
            this.chart.data = data;
            this.chart.update();
            return;
        }

        this.chart = new Chart(ctx, {
            type: "doughnut",
            data,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                rotation: -90,
                circumference: 360,
                animation: { animateRotate: true, duration: 700 },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
            },
        });
    }
}

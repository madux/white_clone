document.addEventListener("DOMContentLoaded", () => {
    // --- Layout view tab switching logic routing ---
    const tabs = document.querySelectorAll(".rc-tab-link");
    const tabPanes = document.querySelectorAll(".rc-tab-pane");

    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            tabs.forEach(t => t.classList.remove("active"));
            tabPanes.forEach(pane => pane.classList.remove("active"));

            tab.classList.add("active");
            const targetPane = document.getElementById(tab.dataset.tab);
            if (targetPane) {
                targetPane.classList.add("active");
            }
        });
    });

    // Color Config constant map variables
    const primaryPink = '#e63988';
    const accentOrange = '#f97316';
    const accentTeal = '#14b8a6';
    const gridLineColor = '#f2f4f7';

    // Global helper config overrides
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.color = '#667085';

    // --- CHART CREATION & CONFIGURATIONS ---

    // 1. Overview Tab Chart
    new Chart(document.getElementById('overviewChart'), {
        type: 'bar',
        data: {
            labels: ['Technical Interview', 'Phone Screen', 'Applied'],
            datasets: [{
                label: 'count',
                data: [1, 1, 1],
                backgroundColor: primaryPink,
                barThickness: 160
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 1, ticks: { stepSize: 0.25 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 2. Pipeline Funnel (Horizontal Bar) Chart
    new Chart(document.getElementById('pipelineFunnelChart'), {
        type: 'bar',
        indexAxis: 'y',
        data: {
            labels: ['New', 'Screening', 'Interview', 'Offer', 'Hired'],
            datasets: [{
                label: 'count',
                data: [1, 1, 1, 0, 0],
                backgroundColor: primaryPink,
                barThickness: 24
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { min: 0, max: 1, ticks: { stepSize: 0.25 }, grid: { color: gridLineColor } },
                y: { grid: { display: false } }
            }
        }
    });

    // 3. Average Time in Stage Chart
    new Chart(document.getElementById('avgTimeStageChart'), {
        type: 'bar',
        data: {
            labels: ['New', 'Screening', 'Interview', 'Offer', 'Hired'],
            datasets: [{
                label: 'Average Days',
                data: [16, 21, 28, 0, 0],
                backgroundColor: primaryPink,
                barThickness: 120
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { title: { display: true, text: 'Days' }, min: 0, max: 28, ticks: { stepSize: 7 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 4. Source & Attribution Pie Chart
    new Chart(document.getElementById('candidatesSourceChart'), {
        type: 'pie',
        data: {
            labels: ['LinkedIn', 'Career Site', 'Referral'],
            datasets: [{
                data: [1, 1, 1],
                backgroundColor: [primaryPink, accentOrange, accentTeal]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { usePointStyle: true } } }
        }
    });

    // 5. Conversion Rate By Source Bar Chart
    new Chart(document.getElementById('conversionSourceChart'), {
        type: 'bar',
        data: {
            labels: ['LinkedIn', 'Career Site', 'Referral'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: primaryPink
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { title: { display: true, text: '%' }, min: 0, max: 4, ticks: { stepSize: 1 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 6. Recruiter Performance - Hires Chart
    new Chart(document.getElementById('hiresRecruiterChart'), {
        type: 'bar',
        data: {
            labels: ['Sarah Chen', 'Michael Rodriguez', 'Emily Thompson'],
            datasets: [
                { label: 'Hires', data: [0, 0, 0], backgroundColor: primaryPink },
                { label: 'Candidates Handled', data: [1, 1, 1], backgroundColor: accentOrange }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { min: 0, max: 1, ticks: { stepSize: 0.25 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 7. Candidate Quality - AI Score Chart
    new Chart(document.getElementById('aiScoreChart'), {
        type: 'bar',
        data: {
            labels: ['Technical Interview', 'Phone Screen', 'Applied'],
            datasets: [{
                data: [90, 85, 82],
                backgroundColor: primaryPink,
                barThickness: 80
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 100, ticks: { stepSize: 25 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 8. Candidate Quality - Rating Distribution Chart
    new Chart(document.getElementById('ratingDistributionChart'), {
        type: 'bar',
        data: {
            labels: ['1', '2', '3', '4', '5'],
            datasets: [{
                data: [0, 0, 0, 1, 0],
                backgroundColor: primaryPink,
                barThickness: 50
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { min: 0, max: 1, ticks: { stepSize: 0.25 }, grid: { color: gridLineColor } },
                x: { grid: { display: false } }
            }
        }
    });

    // 9. Communication Tab - Messages by Type Chart
    new Chart(document.getElementById('msgTypeChart'), {
        type: 'bar',
        data: {
            labels: ['Emails', 'SMS'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [primaryPink, accentOrange]
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 10. Communication Tab - Automation vs Manual
    new Chart(document.getElementById('msgAutomationChart'), {
        type: 'bar',
        data: {
            labels: ['Automated', 'Manual'],
            datasets: [{
                data: [0, 0],
                backgroundColor: [primaryPink, accentOrange]
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });

    // 11. Communication Tab - Messages over Time line Chart
    new Chart(document.getElementById('msgOverTimeChart'), {
        type: 'line',
        data: {
            labels: ['2026-06-08'],
            datasets: [{
                label: 'count',
                data: [3],
                borderColor: primaryPink,
                backgroundColor: primaryPink,
                borderWidth: 2,
                tension: 0.1,
                pointBackgroundColor: '#fff',
                pointBorderColor: primaryPink,
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom' } },
            scales: {
                y: { min: 0, max: 3, ticks: { stepSize: 0.75 }, grid: { color: gridLineColor } },
                x: { grid: { color: gridLineColor } }
            }
        }
    });
});
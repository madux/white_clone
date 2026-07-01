// ═══════════════════════════════════════════════════════════
// CleonHR Document Management — document-management.js
// Dashboard chart rendering + CTA animation
// ═══════════════════════════════════════════════════════════

document.addEventListener("DOMContentLoaded", function () {

    // --- Document Activity Trends (Line Chart) ---
    var trendsCtx = document.getElementById('trendsChart');
    if (trendsCtx && typeof Chart !== 'undefined') {
        trendsCtx = trendsCtx.getContext('2d');
        new Chart(trendsCtx, {
            type: 'line',
            data: {
                labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                datasets: [{
                    label: 'Document Uploads',
                    data: [12, 19, 3, 15, 2, 25, 10],
                    borderColor: '#ec4899',
                    backgroundColor: 'rgba(236, 72, 153, 0.1)',
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { display: false }
                }
            }
        });
    }

    // --- Status Distribution (Pie Chart) ---
    var distributionCtx = document.getElementById('distributionChart');
    if (distributionCtx && typeof Chart !== 'undefined') {
        distributionCtx = distributionCtx.getContext('2d');
        new Chart(distributionCtx, {
            type: 'pie',
            data: {
                labels: ['Approved', 'Sent', 'Expired', 'Voided'],
                datasets: [{
                    data: [15, 16, 11, 12],
                    backgroundColor: ['#10b981', '#3b82f6', '#f59e0b', '#ec4899'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } }
            }
        });
    }

    // CTA arrow animation
    var heroCta = document.querySelector('.dm-btn-primary');
    if (heroCta) {
        heroCta.addEventListener('mouseenter', function () {
            var arrow = heroCta.querySelector('.fa-arrow-right');
            if (arrow) arrow.style.transform = 'translateX(4px)';
        });
        heroCta.addEventListener('mouseleave', function () {
            var arrow = heroCta.querySelector('.fa-arrow-right');
            if (arrow) arrow.style.transform = 'translateX(0px)';
        });
    }
});

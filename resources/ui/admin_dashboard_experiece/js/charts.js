/**
 * charts.js — Chart.js charts matching reference design
 */

let chartInstances = {};

function destroyChart(id) {
  if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

const FONT = "'DM Sans', sans-serif";
const PINK = '#E91E8C';
const PINK_LIGHT = '#FF6BA8';

const TOOLTIP_DEFAULTS = {
  backgroundColor: '#1a1a2e',
  titleFont: { family: FONT, size: 12, weight: '600' },
  bodyFont:  { family: FONT, size: 11 },
  padding: 10, cornerRadius: 8
};

/* ============================================================
   1. HEADCOUNT TREND — Line chart with gradient fill
   ============================================================ */
function initHeadcountChart() {
  destroyChart('headcount');
  const ctx = document.getElementById('headcountChart');
  if (!ctx) return;

  const labels = ['Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan'];
  const data   = [202, 208, 211, 218, 220, 224, 228, 233, 237, 240, 244, 247];

  const grad = ctx.getContext('2d').createLinearGradient(0, 0, 0, 180);
  grad.addColorStop(0, 'rgba(233,30,140,0.20)');
  grad.addColorStop(1, 'rgba(233,30,140,0.00)');

  chartInstances['headcount'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Headcount',
        data,
        borderColor: PINK,
        backgroundColor: grad,
        borderWidth: 2.5,
        pointRadius: 3,
        pointHoverRadius: 6,
        pointBackgroundColor: PINK,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { ...TOOLTIP_DEFAULTS, callbacks: { label: c => ` Headcount: ${c.parsed.y}` } }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: FONT, size: 10 }, color: '#aaaacc' },
          border: { display: false }
        },
        y: {
          min: 190, max: 260,
          grid: { color: '#f0f0f8' },
          ticks: { font: { family: FONT, size: 10 }, color: '#aaaacc', stepSize: 20, padding: 6 },
          border: { display: false }
        }
      }
    }
  });
}

/* ============================================================
   2. BY DEPARTMENT — Vertical bar chart (matching reference design)
   ============================================================ */
function initDeptBarChart() {
  destroyChart('dept');
  const ctx = document.getElementById('deptBarChart');
  if (!ctx) return;

  const labels = ['Eng','Sales','Mktg','Finance','Ops','HR','Design','Exec'];
  const data   = [48, 31, 22, 18, 14, 11, 8, 4];
  const colors = ['#E91E8C','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f97316','#ec4899'];

  chartInstances['dept'] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Employees',
        data,
        backgroundColor: colors,
        borderRadius: { topLeft: 5, topRight: 5 },
        borderSkipped: false,
        barThickness: 18
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TOOLTIP_DEFAULTS,
          callbacks: { label: c => ` ${c.label}: ${c.parsed.y} employees` }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { family: FONT, size: 10 }, color: '#aaaacc' },
          border: { display: false }
        },
        y: {
          grid: { color: '#f0f0f8' },
          ticks: { font: { family: FONT, size: 10 }, color: '#aaaacc', padding: 6 },
          border: { display: false }
        }
      }
    }
  });
}

/* ============================================================
   INIT ALL
   ============================================================ */
function initAllCharts() {
  initHeadcountChart();
  initDeptBarChart();
}

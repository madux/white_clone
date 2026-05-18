/* ═══════════════════════════════════════════════
       CONFIG — change BASE_URL to your Odoo instance
    ═══════════════════════════════════════════════ */
    const BASE_URL = window.location.origin; // e.g. 'https://your-odoo.com'

    /* ═══════════════════════════════════════════════
       TABS
    ═══════════════════════════════════════════════ */
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panelId = 'tab-' + tab.dataset.tab;
        document.getElementById(panelId).classList.add('active');

        // lazy-load secondary tabs
        if (tab.dataset.tab === 'incidents' && !window._incLoaded) loadIncidents();
        if (tab.dataset.tab === 'grievances' && !window._grvLoaded) loadGrievances();
        if (tab.dataset.tab === 'compliance' && !window._compLoaded) loadCompliance();
      });
    });

    /* ═══════════════════════════════════════════════
       API helpers
    ═══════════════════════════════════════════════ */
    async function apiFetch(path) {
      const res = await fetch(BASE_URL + path, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    }

    /* ═══════════════════════════════════════════════
       CHART defaults
    ═══════════════════════════════════════════════ */
    Chart.defaults.font.family = "'DM Sans', sans-serif";
    Chart.defaults.font.size = 11;
    Chart.defaults.color = '#8891a8';

    const PINK = '#e91e8c';
    const TEAL = '#0fb8a0';
    const AMBER = '#f59e0b';
    const PURPLE = '#8b5cf6';
    const RED = '#ef4444';
    const GREEN = '#22c55e';
    const BLUE = '#3b82f6';

    const PALETTE = [PINK, TEAL, AMBER, PURPLE, RED, GREEN, BLUE];

    function lineDataset(label, data, color, dashed = false) {
      return {
        label,
        data,
        borderColor: color,
        backgroundColor: 'transparent',
        pointBackgroundColor: color,
        pointRadius: 4,
        pointHoverRadius: 6,
        borderWidth: 2,
        borderDash: dashed ? [5, 4] : [],
        tension: 0.4,
      };
    }

    function barDataset(label, data, color) {
      return {
        label,
        data,
        backgroundColor: color + '33',
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 4,
      };
    }

    const trendOpts = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { usePointStyle: true, pointStyleWidth: 12, padding: 18, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1a1d2e',
          titleColor: '#fff',
          bodyColor: '#c5cad8',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: {
          min: 0,
          grid: { color: '#f0f2f8', lineWidth: 1 },
          border: { display: false, dash: [4, 4] },
          ticks: { stepSize: 2 },
        },
      },
    };

    /* ═══════════════════════════════════════════════
       KPI CARDS
    ═══════════════════════════════════════════════ */
    const KPI_CONFIG = [
      {
        key: 'total_cases_ytd', label: 'Total Cases YTD', color: 'kpi-pink',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 15V5l6-4 6 4v10"/><rect x="6" y="9" width="6" height="6"/></svg>`,
        format: v => v
      },
      {
        key: 'avg_resolution_days', label: 'Avg Resolution Time', color: 'kpi-amber',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="7"/><path d="M9 5v5l3 2"/></svg>`,
        format: v => v + 'd'
      },
      {
        key: 'repeat_offenders', label: 'Repeat Offenders', color: 'kpi-blue',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="6" r="3"/><path d="M1 16c0-3.3 2.7-6 6-6"/><circle cx="13" cy="9" r="2.5"/><path d="M11 16c0-2.2 1-4 2-4s2 1.8 2 4"/></svg>`,
        format: v => v
      },
      {
        key: 'pending_actions', label: 'Pending Actions', color: 'kpi-red',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 3v6M9 12v1"/><circle cx="9" cy="9" r="7"/></svg>`,
        format: v => v
      },
      {
        key: 'sla_compliance_pct', label: 'SLA Compliance', color: 'kpi-green',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 9l4 4 6-6"/><circle cx="9" cy="9" r="7"/></svg>`,
        format: v => v + '%'
      },
      {
        key: 'appeal_rate_pct', label: 'Appeal Rate', color: 'kpi-purple',
        icon: `<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 13V7l5-4 5 4v6l-5 3-5-3z"/></svg>`,
        format: v => v + '%'
      },
    ];

    function renderKPIs(data) {
      const grid = document.getElementById('kpi-grid');
      grid.innerHTML = KPI_CONFIG.map(cfg => `
    <div class="kpi-card ${cfg.color}">
      <div class="kpi-icon">${cfg.icon}</div>
      <div class="kpi-value">${cfg.format(data[cfg.key] ?? 0)}</div>
      <div class="kpi-label">${cfg.label}</div>
    </div>
  `).join('');
    }

    /* ═══════════════════════════════════════════════
       DEMO DATA (used if API is unavailable)
    ═══════════════════════════════════════════════ */
    const DEMO_KPIS = {
      total_cases_ytd: 9, avg_resolution_days: 18,
      repeat_offenders: 1, pending_actions: 0,
      sla_compliance_pct: 78, appeal_rate_pct: 25,
    };
    const DEMO_TREND = {
      labels: ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'],
      datasets: {
        incidents_submitted: [3, 5, 4, 7, 6, 4],
        incidents_resolved: [2, 4, 4, 5, 4, 3],
        grievances_submitted: [2, 2, 3, 4, 3, 3],
        grievances_resolved: [1, 2, 2, 3, 2, 2],
      },
    };
    const DEMO_INC = {
      by_type: [{ label: 'Misconduct', count: 4 }, { label: 'Harassment', count: 2 }, { label: 'Theft', count: 1 }, { label: 'Negligence', count: 2 }],
      by_severity: [{ label: 'Minor', count: 3 }, { label: 'Major', count: 4 }, { label: 'Severe', count: 1 }, { label: 'Gross Misconduct', count: 1 }],
      by_case_type: [{ label: 'Workplace Safety', count: 2 }, { label: 'Conduct', count: 5 }, { label: 'Other', count: 2 }],
    };
    const DEMO_GRV = {
      total: 3, resolved: 2, pending: 1,
      by_month: [
        { month: 'Sep', count: 0 }, { month: 'Oct', count: 1 },
        { month: 'Nov', count: 0 }, { month: 'Dec', count: 1 },
        { month: 'Jan', count: 1 }, { month: 'Feb', count: 0 },
      ],
    };
    const DEMO_COMP = {
      sla_compliance_pct: 78, total_closed_ytd: 7, compliant_count: 6, overdue_count: 1,
      overdue_cases: [{ name: 'INC-2026-003', employee: 'Jane Smith', days_open: 42, stage: 'Under Investigation' }],
    };

    /* ═══════════════════════════════════════════════
       LOAD DASHBOARD
    ═══════════════════════════════════════════════ */
    async function loadDashboard() {
      let kpiData = DEMO_KPIS;
      let trendData = DEMO_TREND;

      try {
        [kpiData, trendData] = await Promise.all([
          apiFetch('/hr_warning/report/kpis'),
          apiFetch('/hr_warning/report/monthly_trend'),
        ]);
      } catch (e) {
        console.warn('Using demo data:', e.message);
      }

      renderKPIs(kpiData);

      const ctx = document.getElementById('trendChart').getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: trendData.labels,
          datasets: [
            lineDataset('Incidents Submitted', trendData.datasets.incidents_submitted, PINK),
            lineDataset('Incidents Resolved', trendData.datasets.incidents_resolved, TEAL),
            lineDataset('Grievances Submitted', trendData.datasets.grievances_submitted, BLUE, true),
            lineDataset('Grievances Resolved', trendData.datasets.grievances_resolved, PURPLE, true),
          ],
        },
        options: trendOpts,
      });
    }

    /* ═══════════════════════════════════════════════
       LOAD INCIDENTS
    ═══════════════════════════════════════════════ */
    async function loadIncidents() {
      window._incLoaded = true;
      let data = DEMO_INC;

      try { data = await apiFetch('/hr_warning/report/incidents'); }
      catch (e) { console.warn('Using demo data:', e.message); }

      // By type — doughnut
      new Chart(document.getElementById('incTypeChart').getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: data.by_type.map(d => d.label),
          datasets: [{ data: data.by_type.map(d => d.count), backgroundColor: PALETTE, borderWidth: 2, borderColor: '#fff' }],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { position: 'right', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } },
            tooltip: { backgroundColor: '#1a1d2e', padding: 10, cornerRadius: 8 },
          },
          cutout: '62%',
        },
      });

      // By severity — bar
      new Chart(document.getElementById('incSeverityChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.by_severity.map(d => d.label),
          datasets: [barDataset('Severity', data.by_severity.map(d => d.count), PINK)],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d2e', padding: 10, cornerRadius: 8 } },
          scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { grid: { color: '#f0f2f8' }, border: { display: false }, ticks: { stepSize: 1 } },
          },
        },
      });

      // By case type — horizontal bar
      new Chart(document.getElementById('incCaseTypeChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.by_case_type.map(d => d.label),
          datasets: [barDataset('Cases', data.by_case_type.map(d => d.count), TEAL)],
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d2e', padding: 10, cornerRadius: 8 } },
          scales: {
            x: { grid: { color: '#f0f2f8' }, border: { display: false }, ticks: { stepSize: 1 } },
            y: { grid: { display: false }, border: { display: false } },
          },
        },
      });
    }

    /* ═══════════════════════════════════════════════
       LOAD GRIEVANCES
    ═══════════════════════════════════════════════ */
    async function loadGrievances() {
      window._grvLoaded = true;
      let data = DEMO_GRV;

      try { data = await apiFetch('/hr_warning/report/grievances'); }
      catch (e) { console.warn('Using demo data:', e.message); }

      document.querySelector('#grv-total .kpi-value').textContent = data.total;
      document.querySelector('#grv-resolved .kpi-value').textContent = data.resolved;
      document.querySelector('#grv-pending .kpi-value').textContent = data.pending;

      new Chart(document.getElementById('grvMonthChart').getContext('2d'), {
        type: 'bar',
        data: {
          labels: data.by_month.map(d => d.month),
          datasets: [barDataset('Grievances', data.by_month.map(d => d.count), PINK)],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { backgroundColor: '#1a1d2e', padding: 10, cornerRadius: 8 } },
          scales: {
            x: { grid: { display: false }, border: { display: false } },
            y: { grid: { color: '#f0f2f8' }, border: { display: false }, ticks: { stepSize: 1 } },
          },
        },
      });
    }

    /* ═══════════════════════════════════════════════
       LOAD COMPLIANCE
    ═══════════════════════════════════════════════ */
    async function loadCompliance() {
      window._compLoaded = true;
      let data = DEMO_COMP;

      try { data = await apiFetch('/hr_warning/report/compliance'); }
      catch (e) { console.warn('Using demo data:', e.message); }

      document.querySelector('#comp-sla .kpi-value').textContent = data.sla_compliance_pct + '%';
      document.querySelector('#comp-closed .kpi-value').textContent = data.total_closed_ytd;
      document.querySelector('#comp-overdue .kpi-value').textContent = data.overdue_count;

      const wrap = document.getElementById('overdue-table-wrap');
      if (!data.overdue_cases || data.overdue_cases.length === 0) {
        wrap.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/></svg>
      <p>No overdue cases — great compliance!</p>
    </div>`;
        return;
      }

      wrap.innerHTML = `
    <table class="overdue-table">
      <thead>
        <tr>
          <th>Reference</th><th>Employee</th>
          <th>Days Open</th><th>Stage</th>
        </tr>
      </thead>
      <tbody>
        ${data.overdue_cases.map(c => `
          <tr>
            <td><strong>${c.name}</strong></td>
            <td>${c.employee || '—'}</td>
            <td><span class="days-badge ${c.days_open > 60 ? 'critical' : 'warning'}">${c.days_open}d</span></td>
            <td>${c.stage || '—'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
    }

    /* ═══════════════════════════════════════════════
       EXPORT
    ═══════════════════════════════════════════════ */
    function exportReport() {
      alert('Export triggered — wire to /hr_warning/report/export in your Odoo controller.');
    }

    /* ═══════════════════════════════════════════════
       INIT
    ═══════════════════════════════════════════════ */
    loadDashboard();
/**
 * HR Administration Dashboard — dashboard.js
 * Odoo 17 Module: hr_administration
 *
 * Fetches live data from /hr_administration/api/* endpoints
 * and renders all charts & widgets using Highcharts.
 */

(function () {
  'use strict';

  /* ─── Colors ──────────────────────────────────────────────── */
  const C = {
    pink:   '#FF2D78',
    blue:   '#4F7FFA',
    green:  '#22C997',
    orange: '#FF8C42',
    yellow: '#FFD166',
    purple: '#9B72CF',
    teal:   '#06D6A0',
    red:    '#FF4757',
    text1:  '#1A1D2E',
    text2:  '#5A6172',
    text3:  '#9AA0B2',
    border: '#EDEEF2',
    bg:     '#F7F8FC',
  };

  const DEPT_COLORS = [C.blue, C.pink, C.orange, C.green, C.purple, C.teal, C.yellow, C.red];

  /* ─── Utility ─────────────────────────────────────────────── */
  function rpc(route, params = {}) {
    return fetch(route, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: Date.now(), params }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error.message || 'RPC error');
        return d.result;
      });
  }

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
    return String(n);
  }

  /* ─── Date ────────────────────────────────────────────────── */
  function initDate() {
    const d = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const el = document.getElementById('currentDate');
    if (el) el.textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
  }

  /* ─── User Info ───────────────────────────────────────────── */
  function initUser() {
    // Read from Odoo session if available
    try {
      const session = window.odoo && odoo.session_info;
      if (session) {
        const name = session.name || 'User';
        const first = name.split(' ')[0];
        document.getElementById('greetingName').textContent = first;
        document.getElementById('userName').textContent = first;
        const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
        document.getElementById('userInitials').textContent = initials;
        // Update greeting time
        const hour = new Date().getHours();
        const greetEl = document.querySelector('.greeting-headline');
        if (greetEl) {
          let greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';
          greetEl.innerHTML = `${greeting}, <span class="accent-name" id="greetingName">${first}</span>! 👋`;
        }
      }
    } catch (e) { /* ignore */ }
  }

  /* ─── Metrics Grid ────────────────────────────────────────── */
  const METRIC_DEFS = [
    { key: 'total_employees',   label: 'Total Employees',    sublabel: 'vs last month', icon: '👥', color: C.blue,   changeKey: 'total_employees_change', route: '/odoo/employees' },
    { key: 'active_employees',  label: 'Active Employees',   sublabel: 'vs last month', icon: '✅', color: C.green,  route: '/odoo/employees' },
    { key: 'on_leave_today',    label: 'On Leave Today',     sublabel: 'employees',     icon: '🌴', color: C.orange, route: '/odoo/time-off' },
    { key: 'pending_requests',  label: 'Pending Requests',   sublabel: 'awaiting approval', icon: '📋', color: C.pink, route: '/odoo/time-off' },
    { key: 'disciplinary_cases',label: 'Disciplinary Cases', sublabel: 'open cases',    icon: '⚠️', color: C.red,    route: '/odoo/employees' },
    { key: 'expiring_contracts',label: 'Expiring Soon',      sublabel: 'in 30 days',    icon: '📄', color: C.yellow, route: '/odoo/employees' },
    { key: 'pending_approvals', label: 'Pending Approvals',  sublabel: 'across modules',icon: '🔔', color: C.purple, route: '/odoo/time-off' },
    { key: 'hmo_enrollments',   label: 'HMO Enrollments',   sublabel: 'active plans',  icon: '🏥', color: C.teal,   route: '/odoo/employees' },
    { key: 'assets_overdue',    label: 'Assets Overdue',     sublabel: 'unreturned',    icon: '💻', color: '#FF8C42', route: '/odoo/maintenance' },
  ];

  function renderMetrics(data) {
    const grid = document.getElementById('metricsGrid');
    if (!grid) return;
    grid.innerHTML = '';

    METRIC_DEFS.forEach(def => {
      const val = data[def.key] ?? 0;
      const change = def.changeKey ? data[def.changeKey] : null;
      let changeHtml = '';
      if (change !== null && change !== undefined) {
        const dir = change >= 0 ? 'up' : 'down';
        const arrow = change >= 0 ? '↑' : '↓';
        changeHtml = `<span class="metric-change ${dir}">${arrow} ${Math.abs(change)}%</span>`;
      }

      const card = el('a', 'metric-card fade-in');
      card.href = def.route || '#';
      card.style.textDecoration = 'none';
      card.innerHTML = `
        ${changeHtml}
        <div class="metric-icon" style="background:${def.color}22; color:${def.color};">${def.icon}</div>
        <div class="metric-value">${fmt(val)}</div>
        <div class="metric-label">${def.label}</div>
        <div class="metric-sublabel">${def.sublabel}</div>
      `;
      grid.appendChild(card);
    });
  }

  /* ─── Headcount Trend Chart ───────────────────────────────── */
  function renderHeadcountChart(data) {
    if (!window.Highcharts) return;
    const max = Math.max(...data.data);
    Highcharts.chart('headcountChart', {
      chart: {
        type: 'areaspline',
        backgroundColor: 'transparent',
        margin: [10, 10, 30, 40],
        style: { fontFamily: "'DM Sans', sans-serif" },
        animation: { duration: 600 },
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      tooltip: {
        backgroundColor: '#fff',
        borderColor: C.border,
        borderRadius: 8,
        shadow: true,
        style: { fontSize: '12px', color: C.text1 },
        formatter: function () {
          return `<b>${this.x}</b><br/>Headcount: <b>${this.y}</b>`;
        },
      },
      xAxis: {
        categories: data.categories,
        lineColor: 'transparent',
        tickColor: 'transparent',
        labels: { style: { color: C.text3, fontSize: '11px' } },
      },
      yAxis: {
        title: { text: null },
        min: Math.max(0, max - Math.ceil(max * 0.5)),
        gridLineColor: C.border,
        gridLineDashStyle: 'Dash',
        labels: { style: { color: C.text3, fontSize: '11px' } },
        plotLines: [{
          value: max,
          color: C.text3,
          dashStyle: 'Dash',
          width: 1,
          label: { text: 'Target', style: { color: C.text3, fontSize: '10px' } },
        }],
      },
      plotOptions: {
        areaspline: {
          color: C.pink,
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [[0, 'rgba(255,45,120,0.18)'], [1, 'rgba(255,45,120,0)']],
          },
          lineWidth: 2,
          marker: {
            symbol: 'circle',
            radius: 4,
            fillColor: '#fff',
            lineColor: C.pink,
            lineWidth: 2,
          },
        },
      },
      series: [{ data: data.data, name: 'Headcount' }],
    });
  }

  /* ─── Department Donut Chart ─────────────────────────────── */
  function renderDeptChart(data) {
    if (!window.Highcharts || !data.length) return;
    const total = data.reduce((s, d) => s + d.y, 0);
    const colored = data.map((d, i) => ({
      ...d,
      color: DEPT_COLORS[i % DEPT_COLORS.length],
    }));

    Highcharts.chart('deptChart', {
      chart: {
        type: 'pie',
        backgroundColor: 'transparent',
        margin: [0, 0, 0, 0],
        style: { fontFamily: "'DM Sans', sans-serif" },
        animation: { duration: 600 },
      },
      title: { text: null },
      credits: { enabled: false },
      tooltip: {
        backgroundColor: '#fff',
        borderColor: C.border,
        borderRadius: 8,
        style: { fontSize: '12px', color: C.text1 },
        pointFormat: '<b>{point.name}</b>: {point.y} ({point.percentage:.0f}%)',
      },
      plotOptions: {
        pie: {
          innerSize: '65%',
          dataLabels: { enabled: false },
          borderWidth: 3,
          borderColor: '#fff',
          states: { hover: { halo: { size: 6 } } },
        },
      },
      series: [{
        name: 'Employees',
        data: colored,
      }],
    });

    // Inject center label
    setTimeout(() => {
      const container = document.getElementById('deptChart');
      if (container) {
        const existing = container.querySelector('.donut-center');
        if (!existing) {
          const center = el('div', 'donut-center');
          center.style.cssText = `
            position:absolute; top:50%; left:50%;
            transform:translate(-50%,-60%);
            text-align:center; pointer-events:none;
          `;
          center.innerHTML = `<div style="font-size:22px;font-weight:700;color:${C.text1}">${fmt(total)}</div><div style="font-size:11px;color:${C.text3}">total</div>`;
          container.style.position = 'relative';
          container.appendChild(center);
        }
      }
    }, 100);

    // Legend
    const legend = document.getElementById('deptLegend');
    if (legend) {
      legend.innerHTML = colored.map(d =>
        `<div class="dept-legend-item">
          <div class="dept-dot" style="background:${d.color}"></div>
          <span>${d.name} (${d.y})</span>
        </div>`
      ).join('');
    }
  }

  /* ─── Leave Utilization Bars ─────────────────────────────── */
  function renderLeaveUtilization(data) {
    const container = document.getElementById('leaveUtilization');
    if (!container || !data.length) {
      if (container) container.innerHTML = `<div class="empty-state">No leave data available</div>`;
      return;
    }

    container.innerHTML = '';
    data.forEach(item => {
      const row = el('div', 'leave-bar-row fade-in');
      row.innerHTML = `
        <div class="leave-dept-name">${item.department}</div>
        <div class="leave-bar-track">
          <div class="leave-bar-fill" style="width:0%" data-target="${item.utilized}"></div>
        </div>
        <div class="leave-pct">${item.utilized}%</div>
      `;
      container.appendChild(row);
    });

    // Animate bars after render
    requestAnimationFrame(() => {
      container.querySelectorAll('.leave-bar-fill').forEach(bar => {
        const target = bar.dataset.target;
        setTimeout(() => { bar.style.width = target + '%'; }, 100);
      });
    });
  }

  /* ─── Attention Items ─────────────────────────────────────── */
  function renderAttentionItems(items) {
    const list = document.getElementById('attentionList');
    if (!list) return;

    if (!items.length) {
      list.innerHTML = `<div class="empty-state">
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
          <circle cx="20" cy="20" r="18" stroke="currentColor" stroke-width="1.5"/>
          <path d="M20 12v10M20 26v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        No urgent items — all clear!
      </div>`;
      return;
    }

    list.innerHTML = '';
    items.forEach(item => {
      const card = el('a', 'attention-item fade-in');
      card.href = item.route || '#';
      card.innerHTML = `
        <span class="priority-badge ${item.priority}">${item.priority}</span>
        <div class="attention-content">
          <div class="attention-title">${item.title}</div>
          <div class="attention-desc">${item.description}</div>
          <div class="attention-module">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1"/>
            </svg>
            ${item.module}
          </div>
        </div>
        <div class="attention-count">${item.count}</div>
        <svg class="attention-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      list.appendChild(card);
    });

    // Update notif badge
    const badge = document.getElementById('notifBadge');
    const highCount = items.filter(i => i.priority === 'high').length;
    if (badge) badge.textContent = highCount || '';
  }

  /* ─── Upcoming Events ─────────────────────────────────────── */
  const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function renderEvents(events) {
    const container = document.getElementById('upcomingEvents');
    if (!container) return;

    if (!events.length) {
      container.innerHTML = `<div class="empty-state">No upcoming events</div>`;
      return;
    }

    container.innerHTML = '';
    events.forEach(ev => {
      const dateStr = ev.date || '';
      let day = '--', month = '--';
      try {
        const d = new Date(dateStr);
        day = d.getDate();
        month = MONTH_ABBR[d.getMonth()];
      } catch (e) { /* ignore */ }

      const colors = { calendar: C.blue, contract: C.orange, default: C.purple };
      const color = colors[ev.type] || colors.default;
      const typeLabel = { calendar: 'Calendar Event', contract: 'Contract Expiry' }[ev.type] || 'Event';

      const item = el('div', 'event-item fade-in');
      item.innerHTML = `
        <div class="event-date-badge" style="background:${color}">
          <span>${day}</span>
          <span class="month">${month}</span>
        </div>
        <div>
          <div class="event-name">${ev.name}</div>
          <div class="event-type">${typeLabel}</div>
        </div>
      `;
      container.appendChild(item);
    });
  }

  /* ─── Sidebar Toggle ──────────────────────────────────────── */
  function initSidebar() {
    const btn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (btn && sidebar) {
      btn.addEventListener('click', () => sidebar.classList.toggle('open'));
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !btn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  /* ─── Headcount Period Selector ───────────────────────────── */
  function initPeriodSelector() {
    const sel = document.getElementById('headcountPeriod');
    if (!sel) return;
    sel.addEventListener('change', () => {
      rpc('/hr_administration/api/headcount_trend', { months: parseInt(sel.value) })
        .then(renderHeadcountChart)
        .catch(err => console.warn('Headcount reload failed:', err));
    });
  }

  /* ─── Refresh Button ──────────────────────────────────────── */
  function initRefresh() {
    const btn = document.getElementById('refreshBtn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      btn.querySelector('svg').classList.add('spin');
      loadAll().finally(() => {
        setTimeout(() => btn.querySelector('svg').classList.remove('spin'), 600);
      });
    });
  }

  /* ─── Load All Data ───────────────────────────────────────── */
  function loadAll() {
    const promises = [
      rpc('/hr_administration/api/metrics')
        .then(renderMetrics)
        .catch(err => {
          console.warn('Metrics API failed, using demo data:', err);
          renderMetrics(getDemoMetrics());
        }),

      rpc('/hr_administration/api/headcount_trend', { months: 6 })
        .then(renderHeadcountChart)
        .catch(() => renderHeadcountChart(getDemoHeadcount())),

      rpc('/hr_administration/api/department_distribution')
        .then(renderDeptChart)
        .catch(() => renderDeptChart(getDemoDepts())),

      rpc('/hr_administration/api/leave_utilization')
        .then(renderLeaveUtilization)
        .catch(() => renderLeaveUtilization(getDemoLeave())),

      rpc('/hr_administration/api/attention_items')
        .then(renderAttentionItems)
        .catch(() => renderAttentionItems(getDemoAttention())),

      rpc('/hr_administration/api/upcoming_events')
        .then(renderEvents)
        .catch(() => renderEvents(getDemoEvents())),
    ];

    return Promise.all(promises);
  }

  /* ─── Demo / Fallback Data ────────────────────────────────── */
  function getDemoMetrics() {
    return {
      total_employees: 23, total_employees_change: 5.2,
      active_employees: 23, on_leave_today: 3,
      pending_requests: 38, disciplinary_cases: 7,
      expiring_contracts: 15, pending_approvals: 94,
      hmo_enrollments: 17, assets_overdue: 18,
    };
  }

  function getDemoHeadcount() {
    return {
      categories: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan'],
      data: [105, 110, 115, 118, 122, 128],
    };
  }

  function getDemoDepts() {
    return [
      { name: 'Engineering', y: 385 },
      { name: 'Marketing', y: 156 },
      { name: 'Finance', y: 124 },
      { name: 'Others', y: 32 },
      { name: 'Sales', y: 248 },
      { name: 'Operations', y: 195 },
      { name: 'HR', y: 60 },
    ];
  }

  function getDemoLeave() {
    return [
      { department: 'Engineering', utilized: 68, remaining: 32 },
      { department: 'Sales',       utilized: 82, remaining: 18 },
      { department: 'Marketing',   utilized: 75, remaining: 25 },
      { department: 'Operations',  utilized: 71, remaining: 29 },
      { department: 'Finance',     utilized: 88, remaining: 12 },
      { department: 'HR',          utilized: 65, remaining: 35 },
    ];
  }

  function getDemoAttention() {
    return [
      { priority: 'high',   title: 'Leave Requests Pending Approval',  description: '12 urgent requests require immediate attention', module: 'Leave Management',      count: 38, route: '/odoo/time-off' },
      { priority: 'high',   title: 'Contracts Expiring in 30 Days',    description: '5 contracts expire within the next 7 days',     module: 'Workforce Lifecycle',   count: 15, route: '/odoo/employees' },
      { priority: 'medium', title: 'Disciplinary Cases Pending Action', description: '3 cases require immediate review',               module: 'Disciplinary Mgmt',     count: 7,  route: '/odoo/employees' },
      { priority: 'low',    title: 'Assets Overdue for Return',         description: '8 laptops overdue by more than 7 days',          module: 'Asset Management',      count: 18, route: '/odoo/maintenance' },
      { priority: 'medium', title: 'HMO Enrollment Approvals',          description: 'Pending enrollment approvals',                   module: 'Health Insurance',      count: 25, route: '/odoo/time-off' },
      { priority: 'low',    title: 'Performance Reviews Pending',        description: 'Q1 2026 performance reviews',                    module: 'Workforce Lifecycle',   count: 45, route: '/odoo/employees' },
    ];
  }

  function getDemoEvents() {
    return [
      { name: 'Q2 Performance Review Kickoff',  date: '2026-05-15', type: 'calendar' },
      { name: 'Contract Expiry: John Adeyemi',  date: '2026-05-20', type: 'contract' },
      { name: 'HMO Renewal Deadline',           date: '2026-05-25', type: 'calendar' },
      { name: 'New Employee Onboarding',        date: '2026-06-01', type: 'calendar' },
    ];
  }

  /* ─── Init ────────────────────────────────────────────────── */
  function init() {
    initDate();
    initUser();
    initSidebar();
    initPeriodSelector();
    initRefresh();

    // Load Highcharts if not present, then load data
    if (typeof window.Highcharts === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://code.highcharts.com/highcharts.js';
      script.onload = loadAll;
      document.head.appendChild(script);
    } else {
      loadAll();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

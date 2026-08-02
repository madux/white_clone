/* ─── Staff Directory Dashboard — staff_directory.js ───────────────────────
   Fetches data from 13 JSON endpoints in parallel and renders all sections.
   Follows CleonHR Pattern A: standalone HTML, no Odoo asset pipeline.
   Charts: Chart.js v4 via CDN.
   ─────────────────────────────────────────────────────────────────────────── */
'use strict';

(function () {

  // ─── Global Chart Defaults ────────────────────────────────────────────────
  Chart.defaults.font.family = "'DM Sans', sans-serif";
  Chart.defaults.font.size   = 11;
  Chart.defaults.color       = '#9AA0B2';

  // ─── Design Tokens ────────────────────────────────────────────────────────
  const C = {
    pink:    '#ec4899',
    cobalt:  '#3D5AFE',
    emerald: '#00C48C',
    amber:   '#FF8F00',
    purple:  '#8B5CF6',
    border:  '#EDEEF2',
    text1:   '#1A1D2E',
    textM:   '#9AA0B2',
    pinkA15: 'rgba(236,72,153,.15)',
    pinkA30: 'rgba(236,72,153,.30)',
    pinkA0:  'rgba(236,72,153,0)',
  };

  // ─── API Routes ───────────────────────────────────────────────────────────
  const API = {
    overview:          '/staff-directory/api/overview',
    alerts:            '/staff-directory/api/alerts',
    headcountTrend:    '/staff-directory/api/headcount_trend',
    deptDist:          '/staff-directory/api/dept_distribution',
    empGender:         '/staff-directory/api/employment_gender',
    activities:        '/staff-directory/api/activities',
    birthdaysAnnivs:   '/staff-directory/api/birthdays_anniversaries',
    compliance:        '/staff-directory/api/compliance',
    training:          '/staff-directory/api/training',
    workLocation:      '/staff-directory/api/work_location',
    probationContracts:'/staff-directory/api/probation_contracts',
    perfSkills:        '/staff-directory/api/performance_skills',
    diversity:         '/staff-directory/api/diversity',
  };

  // Stored chart instances so we can destroy on re-render
  const _charts = {};

  // ─── API Helper ───────────────────────────────────────────────────────────
  async function call(route, params = {}) {
    try {
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method: 'call', id: 1, params }),
      });
      const json = await res.json();
      if (json.error) { console.error('[SDIR]', route, json.error); return null; }
      return json.result;
    } catch (e) {
      console.error('[SDIR] fetch error', route, e);
      return null;
    }
  }

  // ─── DOM Helpers ──────────────────────────────────────────────────────────
  const el    = (id)       => document.getElementById(id);
  const setText = (id, v)  => { const e = el(id); if (e) e.textContent = v ?? '—'; };
  const setHTML = (id, h)  => { const e = el(id); if (e) e.innerHTML   = h; };

  function makeChart(canvasId, config) {
    const canvas = el(canvasId);
    if (!canvas) return null;
    if (_charts[canvasId]) _charts[canvasId].destroy();
    _charts[canvasId] = new Chart(canvas, config);
    return _charts[canvasId];
  }

  // ─── Format Helpers ───────────────────────────────────────────────────────
  function num(n)  { return (n ?? 0).toLocaleString(); }
  function pct(n)  { const s = (n >= 0 ? '+' : '') + n + '%'; return s; }

  function timeAgo(iso) {
    if (!iso) return '';
    const diff = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (diff < 60)   return `${diff}s ago`;
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
    if (diff < 86400)return `${Math.round(diff / 3600)}h ago`;
    return `${Math.round(diff / 86400)}d ago`;
  }

  function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
  }

  // Avatar HTML — falls back to coloured initials circle
  function avatarHTML(id, name, size = 34) {
    const colors = [C.pink, C.cobalt, C.emerald, C.amber, C.purple, '#0EA5E9', '#F59E0B'];
    const bg = colors[(name || '').charCodeAt(0) % colors.length];
    const fs = Math.round(size * 0.36);
    const imgSrc = id ? `/web/image/hr.employee/${id}/image_128` : null;
    if (imgSrc) {
      return `<div class="sdir-avatar" style="width:${size}px;height:${size}px;background:${bg};">
                <img src="${imgSrc}" alt="${name}" loading="lazy"
                     onerror="this.parentElement.textContent='${initials(name)}';"
                     style="width:${size}px;height:${size}px;object-fit:cover;border-radius:50%;">
              </div>`;
    }
    return `<div class="sdir-avatar" style="width:${size}px;height:${size}px;background:${bg};color:#fff;font-size:${fs}px;">
              ${initials(name)}
            </div>`;
  }

  // Trend arrow + percentage chip
  function trendHTML(change) {
    if (!change && change !== 0) return '';
    if (change > 0) return `<span class="sdir-trend-up">▲ ${change}% vs last month</span>`;
    if (change < 0) return `<span class="sdir-trend-dn">▼ ${Math.abs(change)}% vs last month</span>`;
    return `<span class="sdir-trend-flat">— No change</span>`;
  }

  // ─── 1. Overview KPIs ─────────────────────────────────────────────────────
  function renderOverview(d) {
    if (!d) return;
    setText('kpiTotalVal',    num(d.total));
    setHTML('kpiTotalTrend',  trendHTML(d.total_change));
    setText('kpiActiveVal',   num(d.active));
    setHTML('kpiActiveTrend', d.on_leave
      ? `<span class="sdir-trend-flat">${num(d.on_leave)} on leave today</span>`
      : '<span class="sdir-trend-up">All present today</span>');
    setText('kpiNewHiresVal', num(d.new_hires));
    setHTML('kpiNewHiresTrend', `<span class="sdir-trend-flat">Last 30 days</span>`);
    setText('kpiExecVal', num(d.executives));
    setHTML('kpiExecTrend',   `<span class="sdir-trend-flat">Senior leadership</span>`);

    // Pending approvals banner
    if (d.pending_approvals > 0) {
      const banner = el('pendingBanner');
      if (banner) banner.style.display = '';
      setText('pendingCount', num(d.pending_approvals));
      setText('pendingDesc',  `${num(d.pending_approvals)} leave request${d.pending_approvals > 1 ? 's' : ''} awaiting review`);
    }

    // Sidebar employee badge
    setText('navEmpBadge', num(d.total));
  }

  // ─── 2. Alert Tiles ───────────────────────────────────────────────────────
  function renderAlerts(d) {
    if (!d) return;
    setText('alertBirthdays',   num(d.birthdays_this_week));
    setText('alertAnniversaries', num(d.work_anniversaries));
    setText('alertExpiring',    num(d.contracts_expiring));
    setText('alertPending',     num(d.pending_approvals));
  }

  // ─── 3. Headcount Growth Trend ────────────────────────────────────────────
  function renderHeadcountTrend(d) {
    if (!d) return;
    setText('statOverHires', num(d.over_hires));
    setText('statNewHires',  num(d.new_hires));

    makeChart('chartHeadcount', {
      type: 'line',
      data: {
        labels: d.categories,
        datasets: [{
          label: 'Headcount',
          data: d.data,
          borderColor: C.pink,
          borderWidth: 2.5,
          pointBackgroundColor: '#fff',
          pointBorderColor: C.pink,
          pointBorderWidth: 2,
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          backgroundColor: (ctx) => {
            const chart = ctx.chart;
            const { ctx: c, chartArea } = chart;
            if (!chartArea) return C.pinkA15;
            const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            grad.addColorStop(0, C.pinkA30);
            grad.addColorStop(1, C.pinkA0);
            return grad;
          },
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1D2E',
            padding: 10,
            callbacks: { label: (i) => ` ${i.raw} employees` },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'DM Sans'", size: 11 }, color: C.textM },
          },
          y: {
            grid: { color: C.border, drawBorder: false },
            ticks: { font: { family: "'DM Sans'", size: 11 }, color: C.textM, stepSize: 1 },
            beginAtZero: false,
          },
        },
      },
    });
  }

  // ─── 4. Department Distribution ───────────────────────────────────────────
  function renderDeptDistribution(d) {
    if (!d || !d.length) return;
    const names  = d.map(x => x.name);
    const counts = d.map(x => x.count);
    const bgs    = d.map((_, i) => i % 2 === 0 ? C.pink : C.purple);

    makeChart('chartDept', {
      type: 'bar',
      data: {
        labels: names,
        datasets: [{
          data: counts,
          backgroundColor: bgs,
          borderRadius: 5,
          borderSkipped: false,
        }],
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1D2E',
            padding: 10,
            callbacks: { label: (i) => ` ${i.raw} employees` },
          },
        },
        scales: {
          x: {
            grid: { color: C.border },
            ticks: { font: { family: "'DM Sans'", size: 10 }, color: C.textM },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            ticks: { font: { family: "'DM Sans'", size: 11 }, color: '#5A6172' },
          },
        },
      },
    });
  }

  // ─── 5. Employment Type + Gender (donuts) ─────────────────────────────────
  function renderEmpGender(d) {
    if (!d) return;

    // Employment Type
    const et = d.employment_type || {};
    const etData   = [et.employee || 0, et.student || 0, et.freelance || 0];
    const etLabels = ['Full Time', 'Part Time', 'Contract'];
    const etColors = [C.pink, C.amber, C.cobalt];
    renderDonut('chartEmpType', 'legendEmpType', etLabels, etData, etColors);

    // Gender
    const g = d.gender || {};
    const gData   = [g.male || 0, g.female || 0, g.other || 0];
    const gLabels = ['Male', 'Female', 'Other'];
    const gColors = [C.cobalt, C.pink, C.emerald];
    renderDonut('chartGender', 'legendGender', gLabels, gData, gColors);
  }

  function renderDonut(canvasId, legendId, labels, data, colors) {
    const total = data.reduce((a, b) => a + b, 0) || 1;
    makeChart(canvasId, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 0,
          hoverOffset: 5,
        }],
      },
      options: {
        cutout: '72%',
        responsive: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#1A1D2E',
            padding: 10,
            callbacks: {
              label: (i) => ` ${i.label}: ${i.raw} (${Math.round(i.raw / total * 100)}%)`,
            },
          },
        },
      },
    });

    // Custom legend
    const legendEl = el(legendId);
    if (!legendEl) return;
    legendEl.innerHTML = labels.map((lbl, i) => {
      if (!data[i]) return '';
      const pctVal = Math.round(data[i] / total * 100);
      return `
        <div class="sdir-legend-row">
          <span class="sdir-legend-dot-name">
            <span class="sdir-dot" style="background:${colors[i]};"></span>
            ${lbl}
          </span>
          <span class="sdir-legend-val">${num(data[i])} &nbsp;<span style="color:${C.textM};font-weight:400;">(${pctVal}%)</span></span>
        </div>`;
    }).join('');
  }

  // ─── 6. Recent Activities ─────────────────────────────────────────────────
  function renderActivities(items) {
    const wrap = el('listActivities');
    if (!wrap) return;
    if (!items || !items.length) {
      wrap.innerHTML = '<div class="sdir-empty">No recent activities</div>';
      return;
    }
    wrap.innerHTML = items.map(a => `
      <div class="sdir-list-row">
        ${avatarHTML(a.author_id, a.author, 34)}
        <div class="sdir-list-body">
          <div class="sdir-list-name">${escHtml(a.author)}</div>
          <div class="sdir-list-sub">${escHtml(a.body)}</div>
        </div>
        <div class="sdir-list-right">
          <span style="font-size:11px;color:var(--text-m);">${timeAgo(a.date)}</span>
        </div>
      </div>`).join('');
  }

  // ─── 7. Birthdays + Anniversaries ────────────────────────────────────────
  function renderBirthdaysAnniversaries(d) {
    if (!d) return;

    // Birthdays
    const bEl = el('listBirthdays');
    const bdays = (d.birthdays || []);
    setText('bdayBadge', num(bdays.length));
    if (bEl) {
      if (!bdays.length) {
        bEl.innerHTML = '<div class="sdir-empty">No upcoming birthdays</div>';
      } else {
        bEl.innerHTML = bdays.map(b => {
          const daysLbl = b.days_until === 0 ? 'Today! 🎉' : `in ${b.days_until}d`;
          return `
            <div class="sdir-list-row">
              ${avatarHTML(b.id, b.name, 34)}
              <div class="sdir-list-body">
                <div class="sdir-list-name">${escHtml(b.name)}</div>
                <div class="sdir-list-sub">${escHtml(b.department)}</div>
              </div>
              <div class="sdir-list-right">
                <span class="sdir-date-badge">${escHtml(b.date)}</span>
                <div style="font-size:10.5px;color:var(--text-m);text-align:right;margin-top:2px;">${daysLbl}</div>
              </div>
            </div>`;
        }).join('');
      }
    }

    // Anniversaries
    const aEl = el('listAnniversaries');
    const annivs = (d.anniversaries || []);
    setText('annivBadge', num(annivs.length));
    if (aEl) {
      if (!annivs.length) {
        aEl.innerHTML = '<div class="sdir-empty">No upcoming anniversaries</div>';
      } else {
        aEl.innerHTML = annivs.map(a => `
          <div class="sdir-list-row">
            ${avatarHTML(a.id, a.name, 34)}
            <div class="sdir-list-body">
              <div class="sdir-list-name">${escHtml(a.name)}</div>
              <div class="sdir-list-sub">${escHtml(a.department)}</div>
            </div>
            <div class="sdir-list-right">
              <span class="sdir-year-badge">${a.years} yr${a.years > 1 ? 's' : ''}</span>
              <div style="font-size:10.5px;color:var(--text-m);text-align:right;margin-top:2px;">${escHtml(a.date)}</div>
            </div>
          </div>`).join('');
      }
    }
  }

  // ─── 8. Compliance Status ─────────────────────────────────────────────────
  function renderCompliance(items) {
    const wrap = el('complianceList');
    if (!wrap || !items) return;
    wrap.innerHTML = items.map(item => `
      <div class="sdir-comp-item">
        <div class="sdir-comp-hd">
          <span class="sdir-comp-lbl">${escHtml(item.label)}</span>
          <span class="sdir-comp-val">${item.count} &nbsp;<span style="color:var(--text-m);">${item.value}%</span></span>
        </div>
        <div class="sdir-progress">
          <div class="sdir-progress-fill" style="width:0%;background:${item.color};"
               data-target="${item.value}"></div>
        </div>
      </div>`).join('');

    // Animate progress bars after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        wrap.querySelectorAll('.sdir-progress-fill').forEach(bar => {
          bar.style.width = bar.dataset.target + '%';
        });
      });
    });
  }

  // ─── 9. Training Progress ─────────────────────────────────────────────────
  function renderTraining(d) {
    if (!d) return;
    makeChart('chartTraining', {
      type: 'bar',
      data: {
        labels: d.categories,
        datasets: [
          { label: 'Completed',   data: d.completed,   backgroundColor: C.emerald, borderRadius: 3 },
          { label: 'In Progress', data: d.in_progress,  backgroundColor: C.amber,   borderRadius: 3 },
          { label: 'Planned',     data: d.planned,      backgroundColor: C.pink,    borderRadius: 3 },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              font: { family: "'DM Sans'", size: 11 },
              boxWidth: 10,
              padding: 10,
            },
          },
          tooltip: { backgroundColor: '#1A1D2E', padding: 10 },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { font: { family: "'DM Sans'", size: 10 }, color: C.textM, maxRotation: 30 },
          },
          y: {
            grid: { color: C.border },
            ticks: { font: { family: "'DM Sans'", size: 10 }, color: C.textM, stepSize: 1 },
            beginAtZero: true,
          },
        },
      },
    });
  }

  // ─── 10. Work Location ────────────────────────────────────────────────────
  function renderWorkLocation(d) {
    if (!d) return;
    const labels = ['Office', 'Remote', 'Field'];
    const data   = [d.office || 0, d.remote || 0, d.field || 0];
    const colors = [C.cobalt, C.emerald, C.amber];
    renderDonut('chartWorkLoc', 'legendWorkLoc', labels, data, colors);
  }

  // ─── 11. Probation + Contract Renewals ────────────────────────────────────
  function renderProbationContracts(d) {
    if (!d) return;

    // Probation
    const probEl = el('probationList');
    const prob = d.probation || [];
    setText('probationCount', num(prob.length));
    if (probEl) {
      if (!prob.length) {
        probEl.innerHTML = '<div class="sdir-empty">No employees in probation</div>';
      } else {
        probEl.innerHTML = prob.map(p => {
          const pillClass = p.status === 'at_risk' ? 'pill-pink' : 'pill-green';
          const pillText  = p.status === 'at_risk' ? 'At Risk' : 'On Track';
          return `
            <div class="sdir-item-row">
              <div>
                <div class="sdir-item-name">${escHtml(p.name)}</div>
                <div class="sdir-item-sub">${escHtml(p.job_title || p.department)}</div>
              </div>
              <div class="sdir-item-right">
                <span class="sdir-pill ${pillClass}">${pillText}</span>
                <span style="font-size:11px;color:var(--text-m);">${p.days_left}d left</span>
              </div>
            </div>`;
        }).join('');
      }
    }

    // Contract Renewals
    const contEl = el('contractList');
    const contracts = d.renewals || [];
    setText('contractCount', num(contracts.length));
    if (contEl) {
      if (!contracts.length) {
        contEl.innerHTML = '<div class="sdir-empty">No contracts due for renewal</div>';
      } else {
        contEl.innerHTML = contracts.map(c => {
          const statusMap = { urgent: 'pill-pink', expiring: 'pill-amber', soon: 'pill-blue' };
          const textMap   = { urgent: 'Urgent',    expiring: 'Expiring',   soon: 'Soon' };
          const pillClass = statusMap[c.status] || 'pill-blue';
          const pillText  = textMap[c.status] || 'Soon';
          return `
            <div class="sdir-item-row">
              <div>
                <div class="sdir-item-name">${escHtml(c.name)}</div>
                <div class="sdir-item-sub">${escHtml(c.contract_type)} · ends ${escHtml(c.end_date)}</div>
              </div>
              <div class="sdir-item-right">
                <span class="sdir-pill ${pillClass}">${pillText}</span>
                <span style="font-size:11px;color:var(--text-m);">${c.days_left}d away</span>
              </div>
            </div>`;
        }).join('');
      }
    }
  }

  // ─── 12. Performance + Skills ─────────────────────────────────────────────
  function renderPerfSkills(d) {
    if (!d) return;

    // Performance bar chart
    const perf = d.performance || {};
    if (perf.categories && perf.categories.length) {
      const barColors = [C.emerald, C.cobalt, C.purple, C.amber, C.pink];
      makeChart('chartPerformance', {
        type: 'bar',
        data: {
          labels: perf.categories,
          datasets: [{
            label: 'Avg Rating',
            data: perf.scores,
            backgroundColor: perf.categories.map((_, i) => barColors[i % barColors.length]),
            borderRadius: 6,
            borderSkipped: false,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: '#1A1D2E',
              padding: 10,
              callbacks: { label: (i) => ` ${i.raw} / 5.0` },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { font: { family: "'DM Sans'", size: 10 }, color: C.textM, maxRotation: 30 },
            },
            y: {
              grid: { color: C.border },
              ticks: { font: { family: "'DM Sans'", size: 10 }, color: C.textM },
              beginAtZero: true,
              max: 5,
            },
          },
        },
      });
    }

    setText('perfScorecard',   (perf.scorecard_pct   ?? 50) + '%');
    setText('perfImprovement', (perf.improvement_pct ?? 8)  + '%');

    // Skills overview progress bars
    const skills = d.skills || [];
    const skillsEl = el('skillsList');
    if (skillsEl && skills.length) {
      skillsEl.innerHTML = skills.map(s => `
        <div class="sdir-skill">
          <div class="sdir-skill-hd">
            <span class="sdir-skill-name">${escHtml(s.name)}</span>
            <span class="sdir-skill-pct">${s.score}%</span>
          </div>
          <div class="sdir-progress">
            <div class="sdir-progress-fill" style="width:0%;background:var(--pink);"
                 data-target="${s.score}"></div>
          </div>
        </div>`).join('');

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          skillsEl.querySelectorAll('.sdir-progress-fill').forEach(bar => {
            bar.style.width = bar.dataset.target + '%';
          });
        });
      });
    }
  }

  // ─── 13. Diversity & Inclusion ────────────────────────────────────────────
  function renderDiversity(d) {
    const wrap = el('diversityRow');
    if (!wrap || !d) return;
    const items = [
      {
        val:   d.female_pct + '%',
        label: 'Female Representation',
        bg:    'rgba(236,72,153,.12)',
        color: 'var(--pink)',
        icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3.314 2.686-6 6-6s6 2.686 6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="17" cy="9" r="2" stroke="currentColor" stroke-width="1.6"/><path d="M14 19c0-2.21 1.343-4 3-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
      },
      {
        val:   d.avg_age || '—',
        label: 'Average Age',
        bg:    'rgba(61,90,254,.10)',
        color: 'var(--cobalt)',
        icon:  `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M8 14h1l1-3 1.5 5L14 13l1 1h1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
      },
      {
        val:   d.international || 0,
        label: 'International Staff',
        bg:    'rgba(0,196,140,.10)',
        color: 'var(--emerald)',
        icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 3c-2.5 2.5-4 5.5-4 9s1.5 6.5 4 9M12 3c2.5 2.5 4 5.5 4 9s-1.5 6.5-4 9M3 12h18" stroke="currentColor" stroke-width="1.4"/></svg>`,
      },
      {
        val:   d.nationalities || 1,
        label: 'Nationalities',
        bg:    'rgba(255,143,0,.10)',
        color: 'var(--amber)',
        icon:  `<svg viewBox="0 0 24 24" fill="none"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22v-7" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
      },
      {
        val:   d.disabled || 0,
        label: 'Disability Inclusive',
        bg:    'rgba(139,92,246,.10)',
        color: 'var(--purple)',
        icon:  `<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="5" r="2" stroke="currentColor" stroke-width="1.8"/><path d="M12 9v5l3 3M9 14.5l-2 4.5M15 14.5l2 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="12" cy="17" r="4" stroke="currentColor" stroke-width="1.8"/></svg>`,
      },
    ];

    wrap.innerHTML = items.map(i => `
      <div class="sdir-div-item">
        <div class="sdir-div-icon" style="background:${i.bg};color:${i.color};">
          ${i.icon}
        </div>
        <div class="sdir-div-val">${i.val}</div>
        <div class="sdir-div-label">${i.label}</div>
      </div>`).join('');
  }

  // ─── Security: HTML escape ─────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Bootstrap Init Data ──────────────────────────────────────────────────
  function applyInitData() {
    const data = window.SDIR_INIT || {};

    // Sidebar footer
    if (data.user_name) setText('sdirUserName', data.user_name);

    // Odoo navbar — systray (right side)
    const systray = document.getElementById('navSystray');
    if (!systray || !data.user_name) return;

    systray.innerHTML = `
      <a href="/odoo/settings" class="sdir-onav-entry sdir-onav-icon" title="Settings">
        <i class="fa fa-cog" aria-hidden="true"></i>
      </a>
      <a href="/web/session/logout" class="sdir-onav-entry sdir-onav-icon" title="Log out">
        <i class="fa fa-sign-out" aria-hidden="true"></i>
      </a>
      <a href="/odoo/settings" class="sdir-onav-entry" id="navUserBtn"
         title="${escHtml(data.user_name)}">
        <img id="navUserAvatar"
             src="${escHtml(data.user_avatar || '')}"
             alt="${escHtml(data.user_name)}"
             width="28" height="28"
             style="border-radius:50%;object-fit:cover;
                    border:1.5px solid rgba(255,255,255,.35);
                    flex-shrink:0;"
             onerror="this.style.display='none'">
        <span id="navUserLabel">${escHtml(data.user_name)}</span>
      </a>`;
  }

  // ─── Main Init ────────────────────────────────────────────────────────────
  async function init() {
    applyInitData();

    // Fire all 13 API calls in parallel for fastest load
    const [
      overview, alerts, trend, depts, empGender,
      activities, birthdaysAnnivs, compliance, training,
      workLoc, probContracts, perfSkills, diversity,
    ] = await Promise.all([
      call(API.overview),
      call(API.alerts),
      call(API.headcountTrend),
      call(API.deptDist),
      call(API.empGender),
      call(API.activities),
      call(API.birthdaysAnnivs),
      call(API.compliance),
      call(API.training),
      call(API.workLocation),
      call(API.probationContracts),
      call(API.perfSkills),
      call(API.diversity),
    ]);

    renderOverview(overview);
    renderAlerts(alerts);
    renderHeadcountTrend(trend);
    renderDeptDistribution(depts);
    renderEmpGender(empGender);
    renderActivities(activities);
    renderBirthdaysAnniversaries(birthdaysAnnivs);
    renderCompliance(compliance);
    renderTraining(training);
    renderWorkLocation(workLoc);
    renderProbationContracts(probContracts);
    renderPerfSkills(perfSkills);
    renderDiversity(diversity);
  }

  // Run after DOM + Chart.js are ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

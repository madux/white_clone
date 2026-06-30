/* ═══════════════════════════════════════════════════════════
   CleonHR Landing Page — main.js
   Module selector, attendance chart, toast
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── MODULE DATA ─────────────────────────────────────────── */
const MODULES = [
  {
    id: 'recruitment',
    title: 'Recruitment',
    color: 'chr-c-blue',
    icon: 'fa-users',
    desc: 'End-to-end recruitment and applicant tracking system',
    features: ['Job posting', 'Candidate pipeline', 'Interview scheduling'],
    more: '+ 1 more feature'
  },
  {
    id: 'hr-admin',
    title: 'HR Administration',
    color: 'chr-c-purple',
    icon: 'fa-building',
    desc: 'Core HR management and employee lifecycle',
    features: ['Employee records', 'Onboarding', 'Document management'],
    more: '+ 1 more feature'
  },
  {
    id: 'payroll',
    title: 'Payroll & Remittance',
    color: 'chr-c-green',
    icon: 'fa-money',
    desc: 'Automated payroll processing and tax remittance',
    features: ['Salary calculation', 'Tax automation', 'Bank integration'],
    more: '+ 3 more features'
  },
  {
    id: 'finance',
    title: 'Finance',
    color: 'chr-c-green',
    icon: 'fa-bar-chart',
    desc: 'Financial management and accounting integration',
    features: ['Budgeting', 'Expense tracking', 'Financial reports'],
    more: '+ 1 more feature'
  },
  {
    id: 'cleon-time',
    title: 'Cleon Time (Claims)',
    color: 'chr-c-orange',
    icon: 'fa-clock-o',
    desc: 'Claims processing and time management',
    features: ['Claims requests', 'Overtime', 'Timesheets'],
    more: '+ 2 more features'
  },
  {
    id: 'leave',
    title: 'Leave & Absence',
    color: 'chr-c-cyan',
    icon: 'fa-calendar',
    desc: 'Leave management and absence tracking',
    features: ['Leave requests', 'Absence tracking', 'Leave policies'],
    more: '+ 1 more feature'
  },
  {
    id: 'performance',
    title: 'Performance Appraisal',
    color: 'chr-c-blue',
    icon: 'fa-trophy',
    desc: 'Employee performance tools and HR tracking',
    features: ['HR management', 'Appraisals', 'Feedback cycles'],
    more: '+ 1 more feature'
  },
  {
    id: 'kyc',
    title: 'Verification & KYC',
    color: 'chr-c-teal',
    icon: 'fa-id-card-o',
    desc: 'Employee verification and compliance management',
    features: ['ID verification', 'Background checks', 'Compliance screening'],
    more: '+ 2 more features'
  },
  {
    id: 'internal-control',
    title: 'Internal Control',
    color: 'chr-c-gray',
    icon: 'fa-shield',
    desc: 'Internal audit and operational compliance tool',
    features: ['Audit logs', 'Risk management', 'Compliance monitoring'],
    more: '+ 1 more feature'
  },
  {
    id: 'marketplace',
    title: 'Cleon Market Place',
    color: 'chr-c-violet',
    icon: 'fa-shopping-cart',
    desc: 'Integrated HR services and partner marketplace',
    features: ['Vendor access', 'Service listings', 'Service integrations'],
    more: '+ 1 more feature'
  },
  {
    id: 'hmo',
    title: 'Health & HMO',
    color: 'chr-c-pink',
    icon: 'fa-heartbeat',
    desc: 'Healthcare benefits and HMO administration',
    features: ['Health plans', 'Provider management', 'Claims support'],
    more: '+ 4 more features'
  },
  {
    id: 'attendance',
    title: 'Attendance & Shift Management',
    color: 'chr-c-orange',
    icon: 'fa-clock-o',
    desc: 'Shift scheduling and attendance tracking system',
    features: ['Clock-in tracking', 'Shift scheduling', 'Attendance analytics'],
    more: '+ 3 more features'
  },
  {
    id: 'elearning',
    title: 'e-Learning',
    color: 'chr-c-purple',
    icon: 'fa-graduation-cap',
    desc: 'Employee learning and training management',
    features: ['Course library', 'Training plans', 'Certifications tracking'],
    more: '+ 1 more feature'
  },
  {
    id: 'hr-advisory',
    title: 'HR Advisory',
    color: 'chr-c-red',
    icon: 'fa-comments',
    desc: 'HR consulting and advisory support services',
    features: ['Expert consultation', 'Policy guidance', 'Best practices'],
    more: '+ 1 more feature'
  },
  {
    id: 'contracts',
    title: 'Client & Contract Management',
    color: 'chr-c-blue-l',
    icon: 'fa-file-text',
    desc: 'Manage client relationships and contracts',
    features: ['Client profiles', 'Contract lifecycle', 'Document storage'],
    more: '+ 1 more feature'
  },
];

const TOTAL = MODULES.length;
const installed = new Set();

/* ── INSTALL-ALL BUTTON STATE ────────────────────────────── */
const installAllBtn = document.getElementById('chr-install-all-btn');

function updateInstallAllBtn() {
  if (installed.size === 0) {
    installAllBtn.innerHTML = '<i class="fa fa-download"></i> Install All Modules';
    installAllBtn.classList.remove('chr-btn-install-all--cta');
  } else if (installed.size === TOTAL) {
    installAllBtn.innerHTML = '<i class="fa fa-times"></i> Uninstall All Modules';
    installAllBtn.classList.add('chr-btn-install-all--cta');
  } else {
    installAllBtn.innerHTML = 'Get started with a free trial <i class="fa fa-arrow-right"></i>';
    installAllBtn.classList.add('chr-btn-install-all--cta');
  }
}

/* ── COUNTER + PROGRESS ──────────────────────────────────── */
function updateCounter() {
  const n = installed.size;
  document.getElementById('chr-installed-count').textContent = n;
  document.getElementById('chr-progress-bar').style.width = `${(n / TOTAL) * 100}%`;
  updateInstallAllBtn();
}

/* ── TOAST ───────────────────────────────────────────────── */
function showToast(msg) {
  const toast = document.getElementById('chr-toast');
  document.getElementById('chr-toast-msg').textContent = msg;
  toast.classList.add('chr-toast--show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('chr-toast--show'), 2600);
}

/* ── TOGGLE SINGLE MODULE ────────────────────────────────── */
function toggleModule(id) {
  const m = MODULES.find(x => x.id === id);
  if (installed.has(id)) {
    installed.delete(id);
    showToast(`${m.title} uninstalled`);
  } else {
    installed.add(id);
    showToast(`${m.title} installed`);
  }
  updateCounter();
  renderModules();
}

/* ── RENDER MODULES ──────────────────────────────────────── */
function renderModules() {
  const grid = document.getElementById('chr-modules-grid');
  grid.innerHTML = '';

  MODULES.forEach(mod => {
    const isInstalled = installed.has(mod.id);

    const card = document.createElement('div');
    card.className = `chr-module-card${isInstalled ? ' chr-card--selected' : ''}`;
    card.dataset.id = mod.id;

    const featuresHTML = mod.features.map(f => `<li>${f}</li>`).join('');
    const btnIcon  = isInstalled ? '<i class="fa fa-check"></i>' : '<i class="fa fa-download"></i>';
    const btnLabel = isInstalled ? 'Installed' : 'Install Module';
    const btnExtra = isInstalled ? ' chr-installed' : '';

    card.innerHTML = `
      <div class="chr-card__checkbox">
        <i class="fa fa-check"></i>
      </div>
      <div class="chr-card__icon ${mod.color}">
        <i class="fa ${mod.icon}"></i>
      </div>
      <div class="chr-card__title">${mod.title}</div>
      <div class="chr-card__desc">${mod.desc}</div>
      <ul class="chr-card__features">
        ${featuresHTML}
        <li class="chr-feat-more">${mod.more}</li>
      </ul>
      <button class="chr-btn-install ${mod.color}${btnExtra}" data-id="${mod.id}">
        ${btnIcon} ${btnLabel}
      </button>
    `;

    card.addEventListener('click', e => {
      if (e.target.closest('.chr-btn-install')) return;
      toggleModule(mod.id);
    });

    card.querySelector('.chr-btn-install').addEventListener('click', e => {
      e.stopPropagation();
      toggleModule(mod.id);
    });

    grid.appendChild(card);
  });
}

/* ── INSTALL ALL BUTTON ──────────────────────────────────── */
installAllBtn.addEventListener('click', () => {
  if (installed.size === TOTAL) {
    installed.clear();
    showToast('All modules uninstalled');
  } else {
    MODULES.forEach(m => installed.add(m.id));
    showToast(`All ${TOTAL} modules installed`);
  }
  updateCounter();
  renderModules();
});

/* ── ATTENDANCE CHART ────────────────────────────────────── */
function initAttChart() {
  const canvas = document.getElementById('chr-att-chart');
  if (!canvas) return;

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: ['Thu', 'Fri', 'Mon', 'Tue', 'Today'],
      datasets: [{
        data: [1050, 1090, 980, 1110, 1128],
        borderColor: '#E91E8C',
        backgroundColor: 'rgba(233,30,140,.08)',
        borderWidth: 2.5,
        pointBackgroundColor: '#E91E8C',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} employees` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { family: 'DM Sans', size: 10 }, color: '#9CA3AF' } },
        y: { display: false, min: 900 }
      }
    }
  });
}

/* ── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  renderModules();
  updateCounter();
  initAttChart();
});

/* ═══════════════════════════════════════════════════════════
   CleonHR Landing Page — navbar.js
   Dropdown toggle, chevron animation, click-outside-to-close
   Services category switcher, mobile burger
═══════════════════════════════════════════════════════════ */

'use strict';

/* ── DYNAMIC BASE PATH ────────────────────────────────────── */
/* Resolves URLs relative to the interactive/ folder, regardless of page depth */
function chrGetBasePath() {
  const path = window.location.pathname;
  const parts = path.split('/').filter(Boolean);
  const idx = parts.indexOf('interactive');
  if (idx === -1) return '';
  const depth = parts.length - idx - 2;
  return depth > 0 ? '../'.repeat(depth) : '';
}

/* ── DETECT ACTIVE MODULE FROM URL ───────────────────────── */
function chrDetectActiveModule() {
  const path = window.location.pathname.replace(/\\/g, '/');
  for (const [category, data] of Object.entries(CHR_SVC_DATA)) {
    for (const m of data.modules) {
      if (m.url && path.endsWith(m.url)) {
        return { category, moduleId: m.id };
      }
    }
  }
  return null;
}

/* ── SERVICES DROPDOWN DATA ──────────────────────────────── */
const CHR_SVC_DATA = {
  'core-hr': {
    eyebrow: 'CORE HR OPERATIONS',
    title: 'Core HR Operations',
    desc: 'Manage employee records, organizational structure, and core HR operations.',
    modules: [
      { id: 'hr-admin', icon: 'fa-building', iconClass: 'chr-svc-card__icon--pink', title: 'HR Administration', badge: 'core', badgeClass: 'chr-svc-card__badge--core', desc: 'Complete employee lifecycle management' },
      { id: 'workforce-lifecycle', icon: 'fa-refresh', iconClass: 'chr-svc-card__icon--blue', title: 'Workforce Lifecycle', desc: 'Onboarding, offboarding, and employee transitions', url: 'all-modules/core-hr-operations/work-force/workforce-lifecycle.html' },
      { id: 'employee-experience', icon: 'fa-star', iconClass: 'chr-svc-card__icon--purple', title: 'Employee Experience', desc: 'Self-service portal and engagement tools', url: 'all-modules/core-hr-operations/employee-experience/employee-experience.html' },
      { id: 'staff-directory', icon: 'fa-users', iconClass: 'chr-svc-card__icon--green', title: 'Staff Directory', badge: 'free', badgeClass: 'chr-svc-card__badge--free', desc: 'Employee profiles, org charts, and search' },
      { id: 'ess', icon: 'fa-th-large', iconClass: 'chr-svc-card__icon--teal', title: 'Employee Self-Service (ESS)', desc: 'Empower employees with self-service capabilities' },
      { id: 'doc-management', icon: 'fa-file-text', iconClass: 'chr-svc-card__icon--orange', title: 'Document Management', desc: 'Enterprise document repository and e-signatures' },
      { id: 'company-calendar', icon: 'fa-calendar', iconClass: 'chr-svc-card__icon--pink', title: 'Company Calendar', desc: 'Company-wide events and team scheduling' },
      { id: 'company-documentary', icon: 'fa-film', iconClass: 'chr-svc-card__icon--blue', title: 'Company Documentary', desc: 'Video library for company culture and events' },
      { id: 'social-gallery', icon: 'fa-camera', iconClass: 'chr-svc-card__icon--purple', title: 'Social Gallery', desc: 'Photo gallery and social feed for engagement' }
    ]
  },
  'workforce': {
    eyebrow: 'WORKFORCE MANAGEMENT',
    title: 'Workforce Management',
    desc: 'Manage attendance, scheduling, compensation, and employee operations.',
    modules: [
      { id: 'attendance', icon: 'fa-clock-o', iconClass: 'chr-svc-card__icon--pink', title: 'Attendance & Shift Management', desc: 'Clock-in/out and shift scheduling' },
      { id: 'time-management', icon: 'fa-calendar-check-o', iconClass: 'chr-svc-card__icon--blue', title: 'Time Management', desc: 'Attendance tracking, schedules, and timesheets' },
      { id: 'leave', icon: 'fa-calendar-o', iconClass: 'chr-svc-card__icon--green', title: 'Leave Management', desc: 'Leave requests, approvals, and balances' },
      { id: 'compensation', icon: 'fa-money', iconClass: 'chr-svc-card__icon--teal', title: 'Compensation Management', desc: 'Salary management, payroll, and bonuses' },
      { id: 'hmo', icon: 'fa-heartbeat', iconClass: 'chr-svc-card__icon--orange', title: 'Health Insurance (HMO)', desc: 'HMO enrollment, provider management, and claims' },
      { id: 'asset-mgmt', icon: 'fa-laptop', iconClass: 'chr-svc-card__icon--purple', title: 'Asset Management', desc: 'Track company assets and assignments' }
    ]
  },
  'talent': {
    eyebrow: 'TALENT & PERFORMANCE',
    title: 'Talent & Performance',
    desc: 'Manage hiring, employee growth, learning, and performance.',
    modules: [
      { id: 'recruitment', icon: 'fa-users', iconClass: 'chr-svc-card__icon--pink', title: 'Recruitment', desc: 'End-to-end hiring and applicant tracking' },
      { id: 'performance', icon: 'fa-trophy', iconClass: 'chr-svc-card__icon--blue', title: 'Performance Appraisal', desc: 'KPI management and 360° reviews' },
      { id: 'elearning', icon: 'fa-graduation-cap', iconClass: 'chr-svc-card__icon--green', title: 'E-Learning & Knowledge Management', desc: 'Training, courses, and certifications' },
      { id: 'hr-advisory', icon: 'fa-comments', iconClass: 'chr-svc-card__icon--teal', title: 'HR Advisory & Knowledge Base', desc: 'HR consulting and policy guidance' }
    ]
  },
  'payroll': {
    eyebrow: 'PAYROLL & FINANCE',
    title: 'Payroll & Finance',
    desc: 'Handle payroll, accounting, claims, and workforce finance operations.',
    modules: [
      { id: 'payroll', icon: 'fa-money', iconClass: 'chr-svc-card__icon--pink', title: 'Payroll & Remittance', desc: 'Automated payroll and tax filing' },
      { id: 'hr-finance', icon: 'fa-bar-chart', iconClass: 'chr-svc-card__icon--blue', title: 'HR Finance Management', desc: 'Budgeting, expenses, and financial reporting' },
      { id: 'cleontime', icon: 'fa-clock-o', iconClass: 'chr-svc-card__icon--green', title: 'CleonTime — Claims', desc: 'Timesheets, claims, and overtime management' },
      { id: 'expense-mgmt', icon: 'fa-credit-card', iconClass: 'chr-svc-card__icon--teal', title: 'Expense Management', desc: 'Employee expense tracking and reimbursements' },
      { id: 'petty-cash', icon: 'fa-briefcase', iconClass: 'chr-svc-card__icon--orange', title: 'Petty Cash', desc: 'Petty cash management and tracking' },
      { id: 'chart-of-accounts', icon: 'fa-book', iconClass: 'chr-svc-card__icon--purple', title: 'Chart of Accounts', desc: 'Financial account structure and management' },
      { id: 'journal-entries', icon: 'fa-file-text-o', iconClass: 'chr-svc-card__icon--pink', title: 'Journal Entries', desc: 'Manual journal entries and adjustments' }
    ]
  },
  'compliance': {
    eyebrow: 'COMPLIANCE & GOVERNANCE',
    title: 'Compliance & Governance',
    desc: 'Ensure compliance, auditability, and organizational governance.',
    modules: [
      { id: 'kyc', icon: 'fa-id-card-o', iconClass: 'chr-svc-card__icon--pink', title: 'Verification & KYC', desc: 'Employee verification and background screening' },
      { id: 'internal-control', icon: 'fa-shield', iconClass: 'chr-svc-card__icon--blue', title: 'Internal Control & Compliance', desc: 'Audit trails and compliance monitoring' },
      { id: 'audit-trail', icon: 'fa-history', iconClass: 'chr-svc-card__icon--green', title: 'Audit Trail', desc: 'Complete audit trail and activity logging' }
    ]
  },
  'client': {
    eyebrow: 'CLIENT & BUSINESS OPERATIONS',
    title: 'Client & Business Operations',
    desc: 'Manage external relationships, contracts, and client operations.',
    modules: [
      { id: 'client-mgmt', icon: 'fa-handshake-o', iconClass: 'chr-svc-card__icon--pink', title: 'Client Management', desc: 'Client relationship and account management' },
      { id: 'contracts', icon: 'fa-file-text', iconClass: 'chr-svc-card__icon--blue', title: 'Contract Management', desc: 'Contract lifecycle and billing' }
    ]
  },
  'platform': {
    eyebrow: 'PLATFORM & INTELLIGENCE',
    title: 'Platform & Intelligence',
    desc: 'Power the CleonHR ecosystem with AI, analytics, and automation.',
    modules: [
      { id: 'hr-ai', icon: 'fa-bolt', iconClass: 'chr-svc-card__icon--pink', title: 'AI Integration Engine', desc: 'AI-powered HR insights and automation' },
      { id: 'analytics', icon: 'fa-line-chart', iconClass: 'chr-svc-card__icon--blue', title: 'Reporting & Analytics Platform', desc: 'Comprehensive HR analytics and dashboards' },
      { id: 'notifications', icon: 'fa-bell', iconClass: 'chr-svc-card__icon--green', title: 'Notification & Communication Engine', desc: 'Multi-channel notifications and alerts' },
      { id: 'cleon-guide', icon: 'fa-question-circle', iconClass: 'chr-svc-card__icon--teal', title: 'Cleon Guide', desc: 'Interactive HR guidance and support' },
      { id: 'gems', icon: 'fa-globe', iconClass: 'chr-svc-card__icon--orange', title: 'Global Employee Management System (GEMS)', desc: 'Multi-country employee management' }
    ]
  },
  'marketplace': {
    eyebrow: 'MARKETPLACE & ECOSYSTEM',
    title: 'Marketplace & Ecosystem',
    desc: 'Extend CleonHR with integrations, partner services, and ecosystem tools.',
    modules: [
      { id: 'marketplace', icon: 'fa-shopping-cart', iconClass: 'chr-svc-card__icon--pink', title: 'Cleon Marketplace & Services Ecosystem', desc: 'API integrations, third-party services, payroll partners, and HR vendors' }
    ]
  }
};

/* ── INDUSTRIES DATA ─────────────────────────────────────── */
const CHR_IND_DATA = [
  { icon: 'fa-heartbeat', iconClass: 'chr-ind-card__icon--pink', title: 'Healthcare & HMO', desc: 'Manage hospitals, HMOs, medical staff, compliance, shift scheduling, and healthcare payroll.' },
  { icon: 'fa-university', iconClass: 'chr-ind-card__icon--blue', title: 'Financial Services', desc: 'Support regulated workforce operations, KYC verification, internal controls, and payroll automation.' },
  { icon: 'fa-industry', iconClass: 'chr-ind-card__icon--purple', title: 'Manufacturing', desc: 'Track workforce attendance, shift operations, compliance, and employee productivity across factories.' },
  { icon: 'fa-shopping-bag', iconClass: 'chr-ind-card__icon--green', title: 'Retail & E-Commerce', desc: 'Simplify scheduling, payroll, contract staff management, and workforce performance.' },
  { icon: 'fa-truck', iconClass: 'chr-ind-card__icon--teal', title: 'Logistics & Transportation', desc: 'Manage mobile teams, attendance, claims, contracts, and operational workforce tracking.' },
  { icon: 'fa-graduation-cap', iconClass: 'chr-ind-card__icon--orange', title: 'Education', desc: 'Digitize staff management, payroll, e-learning, leave management, and institutional HR operations.' },
  { icon: 'fa-shield', iconClass: 'chr-ind-card__icon--indigo', title: 'Government & Public Sector', desc: 'Enterprise workforce governance, payroll compliance, approvals, and employee lifecycle management.' },
  { icon: 'fa-fire', iconClass: 'chr-ind-card__icon--red', title: 'Oil & Gas', desc: 'Support complex workforce structures, offshore scheduling, compliance, and contractor management.' }
];

/* ── NAVBAR INIT ─────────────────────────────────────────── */
function initNavbar() {
  const nav = document.getElementById('chr-nav');
  const navLinks = document.getElementById('chr-nav-links');

  /* ── Scroll effect ── */
  window.addEventListener('scroll', () => {
    nav.classList.toggle('chr-nav--scrolled', window.scrollY > 20);
  }, { passive: true });

  /* ── Dropdown toggle (click-triggered) ── */
  const dropdownTriggers = navLinks.querySelectorAll('li[data-dropdown]');
  let activeDropdown = null;

  function doOpen(trigger) {
    trigger.classList.add('chr-nav--open');
    document.body.classList.add('chr-nav-dropdown-open');
  }

  function doClose(trigger) {
    trigger.classList.remove('chr-nav--open');
    document.body.classList.remove('chr-nav-dropdown-open');
  }

  dropdownTriggers.forEach(trigger => {
    const link = trigger.querySelector('a');
    link.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();

      if (activeDropdown === trigger) {
        doClose(trigger);
        activeDropdown = null;
      } else {
        if (activeDropdown) doClose(activeDropdown);
        doOpen(trigger);
        activeDropdown = trigger;
      }
    });
  });

  /* ── Click outside to close ── */
  document.addEventListener('click', e => {
    if (activeDropdown && !activeDropdown.contains(e.target)) {
      doClose(activeDropdown);
      activeDropdown = null;
    }
  });

  /* ── Escape key to close ── */
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && activeDropdown) {
      doClose(activeDropdown);
      activeDropdown = null;
    }
  });

  /* ── Services sidebar category switch ── */
  const svcSidebar = nav.querySelector('.chr-svc-sidebar');
  if (svcSidebar) {
    svcSidebar.querySelectorAll('.chr-svc-sidebar__item').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.category;
        renderSvcContent(key, nav);
        svcSidebar.querySelectorAll('.chr-svc-sidebar__item').forEach(b => b.classList.remove('chr-svc--active'));
        btn.classList.add('chr-svc--active');
        /* highlight active card if current page is in this category */
        const detected = chrDetectActiveModule();
        if (detected && detected.category === key) {
          const activeCard = nav.querySelector(`.chr-svc-card[data-module="${detected.moduleId}"]`);
          if (activeCard) activeCard.classList.add('chr-svc-card--active');
        }
      });
    });
    /* render default category, or auto-detect from URL */
    const detected = chrDetectActiveModule();
    if (detected) {
      renderSvcContent(detected.category, nav);
      svcSidebar.querySelectorAll('.chr-svc-sidebar__item').forEach(b => {
        b.classList.toggle('chr-svc--active', b.dataset.category === detected.category);
      });
      const activeCard = nav.querySelector(`.chr-svc-card[data-module="${detected.moduleId}"]`);
      if (activeCard) activeCard.classList.add('chr-svc-card--active');
    } else {
      renderSvcContent('core-hr', nav);
    }
  }

  /* ── Mobile burger ── */
  let burgerOpen = false;
  const burger = document.getElementById('chr-burger');
  if (burger) {
    burger.addEventListener('click', () => {
      burgerOpen = !burgerOpen;
      if (burgerOpen) {
        Object.assign(navLinks.style, {
          display: 'flex', flexDirection: 'column',
          position: 'absolute', top: '58px', left: '0', right: '0',
          background: '#fff', padding: '16px 24px',
          borderBottom: '1px solid #E5E7EB',
          boxShadow: '0 8px 24px rgba(0,0,0,.08)',
          gap: '4px', zIndex: '199'
        });
      } else {
        navLinks.removeAttribute('style');
      }
    });
  }
}

/* ── RENDER SERVICES CONTENT ─────────────────────────────── */
function renderSvcContent(category, container) {
  const data = CHR_SVC_DATA[category];
  if (!data) return;

  const contentArea = container.querySelector('.chr-svc-content');
  if (!contentArea) return;

  const header = contentArea.querySelector('.chr-svc-content__header');
  if (header) {
    header.querySelector('.chr-svc-content__eyebrow').textContent = data.eyebrow;
    header.querySelector('.chr-svc-content__title').textContent = data.title;
    header.querySelector('.chr-svc-content__desc').textContent = data.desc;
  }

  const grid = contentArea.querySelector('.chr-svc-cards');
  if (!grid) return;

  grid.innerHTML = data.modules.map(m => {
    const badgeHTML = m.badge
      ? `<span class="chr-svc-card__badge ${m.badgeClass}">${m.badge}</span>`
      : '';
    const linkHref = m.url ? chrGetBasePath() + m.url : '#';
    return `
      <a href="${linkHref}" class="chr-svc-card" data-module="${m.id}">
        <div class="chr-svc-card__icon ${m.iconClass}">
          <i class="fa ${m.icon}"></i>
        </div>
        <div class="chr-svc-card__title-row">
          <span class="chr-svc-card__title">${m.title}</span>
          ${badgeHTML}
        </div>
        <div class="chr-svc-card__desc">${m.desc}</div>
        <span class="chr-svc-card__link">Explore <i class="fa fa-angle-right"></i></span>
      </a>
    `;
  }).join('');
}

/* ── INIT ON DOM READY ───────────────────────────────────── */
document.addEventListener('DOMContentLoaded', initNavbar);

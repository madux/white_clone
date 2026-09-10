/* ================================================================
   Industries Mega Menu – Interactive JS
   ================================================================ */

(function () {
  const btn = document.getElementById('industries-btn');
  const menu = document.getElementById('industries-mega-menu');
  const backdrop = document.getElementById('services-backdrop');
  const servicesMenu = document.getElementById('services-mega-menu');

  if (!btn || !menu) return;

  const arrowRight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>`;

  const INDUSTRIES = [
    {
      title: 'Healthcare & HMO',
      desc: 'Manage hospitals, HMOs, medical staff, compliance, shift scheduling, and healthcare payroll.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
    },
    {
      title: 'Financial Services',
      desc: 'Support regulated workforce operations, KYC verification, internal controls, and payroll automation.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" x2="21" y1="22" y2="22"/><line x1="6" x2="6" y1="18" y2="11"/><line x1="10" x2="10" y1="18" y2="11"/><line x1="14" x2="14" y1="18" y2="11"/><line x1="18" x2="18" y1="18" y2="11"/><polygon points="12 2 20 7 4 7"/></svg>`,
    },
    {
      title: 'Manufacturing',
      desc: 'Track workforce attendance, shift operations, compliance, and employee productivity across factories.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8l-7 5V8l-7 5V4a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M17 18h1"/><path d="M12 18h1"/><path d="M7 18h1"/></svg>`,
    },
    {
      title: 'Retail & E-Commerce',
      desc: 'Simplify scheduling, payroll, contract staff management, and workforce performance.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
    },
    {
      title: 'Logistics & Transportation',
      desc: 'Manage mobile teams, attendance, claims, contracts, and operational workforce tracking.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>`,
    },
    {
      title: 'Education',
      desc: 'Digitize staff management, payroll, e-learning, leave management, and institutional HR operations.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/></svg>`,
    },
    {
      title: 'Government & Public Sector',
      desc: 'Enterprise workforce governance, payroll compliance, approvals, and employee lifecycle management.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`,
    },
    {
      title: 'Oil & Gas',
      desc: 'Support complex workforce structures, offshore scheduling, compliance, and contractor management.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>`,
    },
  ];

  const TRUSTED = ['Healthcare', 'Finance', 'Logistics', 'Manufacturing', 'Government'];

  const buildingIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`;

  function servicesOpen() {
    return !!(servicesMenu && servicesMenu.classList.contains('open'));
  }

  function syncBackdrop(show) {
    if (!backdrop) return;
    if (show || servicesOpen()) backdrop.classList.add('visible');
    else backdrop.classList.remove('visible');
  }

  function buildMenu() {
    const cards = INDUSTRIES.map(
      (item) => `
      <button type="button" class="industry-card">
        <div class="industry-card-icon">${item.icon}</div>
        <div class="industry-card-body">
          <p class="industry-card-title">${item.title}</p>
          <p class="industry-card-desc">${item.desc}</p>
        </div>
      </button>`
    ).join('');

    const tags = TRUSTED.map(
      (label) => `<span class="industries-trusted-tag">${label}</span>`
    ).join('');

    menu.innerHTML = `
      <div class="industries-header">
        <p class="industries-header-label">Industry Solutions</p>
        <p class="industries-header-desc">Purpose-built workflows tailored for different industries and workforce structures.</p>
      </div>
      <div class="industries-body">
        <div class="industries-grid-wrap">
          <div class="industries-grid">${cards}</div>
        </div>
        <aside class="industries-sidebar">
          <div class="industries-sidebar-main">
            <div class="industries-sidebar-icon">${buildingIcon}</div>
            <h3 class="industries-sidebar-title">Built for Enterprise Workforce Management</h3>
            <p class="industries-sidebar-desc">CleonHR adapts to the operational, compliance, payroll, and workforce requirements of your industry.</p>
            <button type="button" class="industries-cta-primary">Explore All Industries${arrowRight}</button>
            <button type="button" class="industries-cta-secondary">Book Enterprise Demo</button>
          </div>
          <div class="industries-trusted">
            <p class="industries-trusted-label">Trusted by:</p>
            <div class="industries-trusted-tags">${tags}</div>
          </div>
        </aside>
      </div>
      <div class="industries-footer">
        <p class="industries-footer-note">Serving 8+ industries across Africa</p>
        <button type="button" class="industries-footer-link">View all industry solutions →</button>
      </div>`;
  }

  function openMenu() {
    document.dispatchEvent(new CustomEvent('cleon:close-services'));
    menu.classList.add('open');
    btn.classList.add('active');
    syncBackdrop(true);
  }

  function closeMenu() {
    menu.classList.remove('open');
    btn.classList.remove('active');
    syncBackdrop(false);
  }

  buildMenu();

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      if (menu.classList.contains('open')) closeMenu();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menu.classList.contains('open')) closeMenu();
  });

  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });

  document.addEventListener('cleon:close-industries', closeMenu);
})();

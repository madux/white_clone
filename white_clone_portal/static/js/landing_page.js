const MODULES = [
  {
    id: 'recruitment', title: 'Recruitment',
    desc: 'End-to-end recruitment and applicant tracking system',
    features: ['Job posting', 'Candidate pipeline', 'Interview scheduling'],
    more: '+ 4 more features',
    technical_name: 'hr_cleon_recruitment',
    action: 'hr_cleon_recruitment.action_hr_job_recruitment',
    gradient: ['rgb(233, 30, 99)', 'rgb(194, 24, 91)'],
    iconBg: 'rgb(253, 242, 248)', primaryColor: 'rgb(233, 30, 99)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-plus w-5 h-5" style="color: rgb(233, 30, 99);"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><line x1="19" x2="19" y1="8" y2="14"></line><line x1="22" x2="16" y1="11" y2="11"></line></svg>`
  },
  {
    id: 'hradmin', title: 'HR Administration',
    desc: 'Core HR management and employee lifecycle',
    features: ['Employee records', 'Onboarding', 'Document management'],
    more: '+ 5 more features',
    technical_name: 'hr_administration',
    action: 'hr_administration.action_dashboard',
    gradient: ['rgb(233, 30, 99)', 'rgb(194, 24, 91)'],
    iconBg: 'rgb(253, 242, 248)', primaryColor: 'rgb(233, 30, 99)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-building2 lucide-building-2 w-5 h-5" style="color: rgb(233, 30, 99);"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"></path><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"></path><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"></path><path d="M10 6h4"></path><path d="M10 10h4"></path><path d="M10 14h4"></path><path d="M10 18h4"></path></svg>`
  },
  {
    id: 'payroll', title: 'Payroll & Remittance',
    desc: 'Automated payroll processing and tax remittance',
    features: ['Salary calculation', 'Tax automation', 'Bank integration'],
    more: '+ 3 more features',
    technical_name: 'cleon_payroll',
    action: 'cleon_payroll.action_open_cleon_payroll_dashboard',
    gradient: ['rgb(5, 150, 105)', 'rgb(13, 148, 136)'],
    iconBg: 'rgb(236, 253, 245)', primaryColor: 'rgb(5, 150, 105)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-credit-card w-5 h-5" style="color: rgb(5, 150, 105);"><rect width="20" height="14" x="2" y="5" rx="2"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>`
  },
  {
    id: 'expense-mgt', title: 'Finance',
    desc: 'Financial management and accounting integration',
    features: ['Budgeting', 'Expense tracking', 'Financial reports'],
    more: '+ 4 more features',
    technical_name: 'hr_expense_management',
    action: 'hr_expense_management.action_hr_claim_dashboard',
    gradient: ['rgb(37, 99, 235)', 'rgb(79, 70, 229)'],
    iconBg: 'rgb(239, 246, 255)', primaryColor: 'rgb(37, 99, 235)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-trending-up w-5 h-5" style="color: rgb(37, 99, 235);"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"></polyline><polyline points="16 7 22 7 22 13"></polyline></svg>`
  },
  {
    id: 'cleon-time', title: 'Cleon Time (Claims)',
    desc: 'Claims processing and time management',
    features: ['Claims requests', 'Overtime', 'Timesheets'],
    more: '+ 3 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_hr_core_time_attendance',
    gradient: ['rgb(234, 88, 12)', 'rgb(217, 119, 6)'],
    iconBg: 'rgb(255, 247, 237)', primaryColor: 'rgb(234, 88, 12)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clock w-5 h-5" style="color: rgb(234, 88, 12);"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`
  },
  {
    id: 'leave', title: 'Leave & Absence',
    desc: 'Leave management and absence tracking',
    features: ['Leave requests', 'Absence tracking', 'Leave policies'],
    more: '+ 4 more features',
    technical_name: 'hr_leave_dashboard',
    action: 'hr_leave_dashboard.action_hr_leave_dashboard',
    gradient: ['rgb(13, 148, 136)', 'rgb(8, 145, 178)'],
    iconBg: 'rgb(240, 253, 250)', primaryColor: 'rgb(13, 148, 136)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar w-5 h-5" style="color: rgb(13, 148, 136);"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path></svg>`
  },
  {
    id: 'performance', title: 'Performance Appraisal',
    desc: 'Employee performance review and KPI tracking',
    features: ['KPI management', 'Appraisals', 'Feedback cycles'],
    more: '+ 5 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(236, 72, 153)', 'rgb(233, 30, 140)'],
    iconBg: 'rgb(253, 242, 248)', primaryColor: 'rgb(236, 72, 153)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-target w-5 h-5" style="color: rgb(236, 72, 153);"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>`
  },
  {
    id: 'kyc', title: 'Verification & KYC',
    desc: 'Employee verification and compliance management',
    features: ['ID verification', 'Compliance checks', 'Background screening'],
    more: '+ 3 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(29, 78, 216)', 'rgb(37, 99, 235)'],
    iconBg: 'rgb(239, 246, 255)', primaryColor: 'rgb(29, 78, 216)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shield-check w-5 h-5" style="color: rgb(29, 78, 216);"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"></path><path d="m9 12 2 2 4-4"></path></svg>`
  },
  {
    id: 'internal-control', title: 'Internal Control',
    desc: 'Internal audit and operational compliance tools',
    features: ['Audit logs', 'Risk management', 'Compliance monitoring'],
    more: '+ 4 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(220, 38, 38)', 'rgb(225, 29, 72)'],
    iconBg: 'rgb(254, 242, 242)', primaryColor: 'rgb(220, 38, 38)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-check w-5 h-5" style="color: rgb(220, 38, 38);"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"></rect><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><path d="m9 14 2 2 4-4"></path></svg>`
  },
  {
    id: 'marketplace', title: 'Cleon Market Place',
    desc: 'Integrated HR services and partner marketplace',
    features: ['Vendor access', 'HR tools', 'Service integrations'],
    more: '+ 3 more features',
    technical_name: 'hr_cleon_recruitment',
    action: 'hr_cleon_recruitment.action_hr_job_recruitment',
    gradient: ['rgb(217, 119, 6)', 'rgb(234, 88, 12)'],
    iconBg: 'rgb(255, 251, 235)', primaryColor: 'rgb(217, 119, 6)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-shopping-bag w-5 h-5" style="color: rgb(217, 119, 6);"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"></path><path d="M3 6h18"></path><path d="M16 10a4 4 0 0 1-8 0"></path></svg>`
  },
  {
    id: 'hmo', title: 'Health & HMO',
    desc: 'Healthcare benefits and HMO administration',
    features: ['Health plans', 'Claims support', 'Provider management'],
    more: '+ 4 more features',
    technical_name: 'hr_insurance',
    action: 'hr_insurance.action_dashboard_server',
    gradient: ['rgb(225, 29, 72)', 'rgb(236, 72, 153)'],
    iconBg: 'rgb(255, 241, 242)', primaryColor: 'rgb(225, 29, 72)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-heart w-5 h-5" style="color: rgb(225, 29, 72);"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path></svg>`
  },
  {
    id: 'attendance', title: 'Attendance & Shift Management',
    desc: 'Shift scheduling and attendance tracking system',
    features: ['Clock-in tracking', 'Shift planning', 'Attendance analytics'],
    more: '+ 3 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_hr_core_time_attendance',
    gradient: ['rgb(8, 145, 178)', 'rgb(13, 148, 136)'],
    iconBg: 'rgb(236, 254, 255)', primaryColor: 'rgb(8, 145, 178)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-calendar-check w-5 h-5" style="color: rgb(8, 145, 178);"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path><path d="m9 16 2 2 4-4"></path></svg>`
  },
  {
    id: 'elearning', title: 'e-Learning',
    desc: 'Employee learning and training management',
    features: ['Course library', 'Training plans', 'Certification tracking'],
    more: '+ 5 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(233, 30, 99)', 'rgb(194, 24, 91)'],
    iconBg: 'rgb(253, 242, 248)', primaryColor: 'rgb(233, 30, 99)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-book-open w-5 h-5" style="color: rgb(233, 30, 99);"><path d="M12 7v14"></path><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"></path></svg>`
  },
  {
    id: 'advisory', title: 'HR Advisory',
    desc: 'HR consulting and advisory support services',
    features: ['HR consultation', 'Policy guidance', 'Employee relations'],
    more: '+ 3 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(71, 85, 105)', 'rgb(51, 65, 85)'],
    iconBg: 'rgb(248, 250, 252)', primaryColor: 'rgb(71, 85, 105)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-message-square w-5 h-5" style="color: rgb(71, 85, 105);"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>`
  },
  {
    id: 'contract', title: 'Client & Contract Management',
    desc: 'Manage client relationships and contracts',
    features: ['Client profiles', 'Contract lifecycle', 'Document storage'],
    more: '+ 4 more features',
    technical_name: 'hr_employee',
    action: 'hr_employee.action_profile_dashboard_server',
    gradient: ['rgb(194, 65, 12)', 'rgb(220, 38, 38)'],
    iconBg: 'rgb(255, 247, 237)', primaryColor: 'rgb(194, 65, 12)',
    svgIcon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-briefcase w-5 h-5" style="color: rgb(194, 65, 12);"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path><rect width="20" height="14" x="2" y="6" rx="2"></rect></svg>`
  }
];

const installed = new Set();

function updateCount() {
  const n = installed.size;
  const countEl = document.getElementById('installed-count');
  if (countEl) countEl.textContent = n;
  
  const progEl = document.getElementById('progress-bar');
  if (progEl) progEl.style.width = (n / 15 * 100) + '%';
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  document.getElementById('toast-msg').textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2500);
}

async function callKw(route, params) {
  const res = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'call',
      params,
    }),
  });
  const data = await res.json();
  if (data.error) {
    throw new Error(data.error.data?.message || data.error.message || 'Request failed');
  }
  return data.result;
}

// ── Hydrate MODULES with live install state + action urls ──
async function hydrateModuleStates() {
  const payload = MODULES.map(m => ({
    id: m.id,
    technical_name: m.technical_name,
    action: m.action,
  }));

  try {
    const statusMap = await callKw('/landing/modules/init', { modules: payload });
    MODULES.forEach(m => {
      const info = statusMap[m.id];
      if (!info) return;
      m.isInstalled = info.installed;
      m.state = info.state;
      m.actionUrl = info.action_url;
      if (info.installed) installed.add(m.id);
    });
  } catch (e) {
    console.error("Hydration failed", e);
  }
}

// ── Card click handling ──────────────────────────────────────
async function handleModuleButtonClick(mod, cardEl, btnEl) {
  if (mod.isInstalled) {
    if (mod.actionUrl) {
      window.location.href = mod.actionUrl;
    } else {
      showToast(`${mod.title} is installed, but no action is configured for it.`);
    }
    return;
  }

  // Not installed yet → install, with spinner state
  const originalHtml = btnEl.innerHTML;
  cardEl.disabled = true;
  btnEl.classList.add('installing');
  btnEl.innerHTML = `<span class="spinner"></span> Installing…`;

  try {
    const result = await callKw('/landing/module/install', {
      technical_name: mod.technical_name,
      action_xmlid: mod.action,
    });

    if (!result.success) {
      showToast(result.error || `Failed to install ${mod.title}`);
      cardEl.disabled = false;
      btnEl.classList.remove('installing');
      btnEl.innerHTML = originalHtml;
      return;
    }

    // Mark every card sharing this technical_name as installed
    MODULES.forEach(m => {
      if (m.technical_name === mod.technical_name) {
        m.isInstalled = true;
        m.state = result.state || 'installed';
        installed.add(m.id);
      }
    });
    mod.actionUrl = result.action_url;

    showToast(`${mod.title} installed successfully`);
    updateCount();
    renderModules();

    if (result.action_url) {
      btnEl.innerHTML = `<span class="spinner"></span> Opening module…`;
      window.location.href = result.action_url;
    }
  } catch (err) {
    showToast(err.message || `Failed to install ${mod.title}`);
    cardEl.disabled = false;
    btnEl.classList.remove('installing');
    btnEl.innerHTML = originalHtml;
  }
}

// ── Updated renderModules() ──────────────────────────────────
function renderModules() {
  const grid = document.getElementById('modules-grid');
  if (!grid) return;
  grid.innerHTML = '';
  
  MODULES.forEach(m => {
    const isInstalled = !!m.isInstalled;
    const card = document.createElement('button');
    card.className = "relative bg-white border-2 rounded-2xl overflow-hidden transition-all duration-200 flex flex-col text-left focus:outline-none";
    card.style.boxShadow = "rgba(0, 0, 0, 0.06) 0px 2px 8px -2px";
    card.style.borderColor = "rgb(229, 231, 235)";
    card.style.backgroundColor = "white";
    
    card.innerHTML = `
      <div class="h-1 w-full" style="background: linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]});"></div>
      <div class="absolute top-4 right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-150 flex-shrink-0" style="border-color: ${isInstalled ? m.primaryColor : 'rgb(209, 213, 219)'}; background-color: ${isInstalled ? m.primaryColor : 'white'};">
        ${isInstalled ? `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
      </div>
      <div class="p-5 flex flex-col flex-1">
        <div class="flex items-center gap-3 mb-3 pr-6">
          <div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style="background-color: ${m.iconBg};">
            ${m.svgIcon}
          </div>
          <div>
            <h3 class="font-bold text-sm leading-tight" style="color: rgb(17, 24, 39);">${m.title}</h3>
          </div>
        </div>
        <p class="text-gray-500 text-xs mb-3 leading-relaxed">${m.desc}</p>
        <ul class="space-y-1.5 mb-3 flex-1">
          ${m.features.map(f => `<li class="flex items-center gap-2 text-xs text-gray-700"><div class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: ${m.primaryColor};"></div>${f}</li>`).join('')}
        </ul>
        <span class="text-xs font-medium text-left mb-4" style="color: ${m.primaryColor};">${m.more}</span>
        
        <div class="btn-install w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all duration-200" style="background: linear-gradient(135deg, ${m.gradient[0]}, ${m.gradient[1]}); color: white;">
          ${isInstalled
            ? `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Open Module`
            : `<svg viewBox="0 0 24 24" class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install Module`
          }
        </div>
      </div>
    `;
    
    card.addEventListener('click', (e) => {
      const btnInstall = card.querySelector('.btn-install');
      handleModuleButtonClick(m, card, btnInstall);
    });
    
    grid.appendChild(card);
  });
}

// ── Boot sequence ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const installAllBtn = document.getElementById('install-all-btn');
  if (installAllBtn) {
    installAllBtn.addEventListener('click', async (e) => {
      const originalHtml = installAllBtn.innerHTML;
      installAllBtn.disabled = true;
      installAllBtn.innerHTML = `<span class="spinner"></span> Installing all modules...`;
      
      // Install uninstalled modules sequentially
      for (const m of MODULES) {
        if (!m.isInstalled) {
          try {
            const res = await callKw('/landing/module/install', {
              technical_name: m.technical_name,
              action_xmlid: m.action,
            });
            if (res.success) {
              m.isInstalled = true;
              installed.add(m.id);
            }
          } catch(err) {
            console.error(err);
          }
        }
      }
      
      showToast('Finished processing modules');
      installAllBtn.disabled = false;
      installAllBtn.innerHTML = originalHtml;
      updateCount();
      renderModules();
    });
  }

  await hydrateModuleStates();
  renderModules();
  updateCount();
});

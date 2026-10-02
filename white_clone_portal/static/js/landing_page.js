const MODULES = [
        {
          id: 'recruitment', title: 'Recruitment', color: 'c-blue',
          desc: 'End-to-end recruitment and applicant tracking system',
          features: ['Job posting', 'Candidate pipeline', 'Interview scheduling'],
          more: '+ 1 more feature'
        },
        {
          id: 'employee-experience', title: 'Employee Experience', color: 'c-purple',
          desc: 'Core HR management and employee lifecycle',
          features: ['Employee records', 'Onboarding', 'Document management'],
          more: '+ 1 more feature'
        },
        {
          id: 'payroll', title: 'Payroll & Remittance', color: 'c-green',
          desc: 'Automated payroll processing and tax remittance',
          features: ['Salary calculation', 'Tax automation', 'Bank integration'],
          more: '+ 3 more features'
        },
        {
          id: 'finance', title: 'Finance', color: 'c-green',
          desc: 'Financial management and accounting integration',
          features: ['Budgeting', 'Expense tracking', 'Financial reports'],
          more: '+ 1 more feature'
        },
        {
          id: 'cleon-time', title: 'Cleon Time', color: 'c-orange',
          desc: 'Comprehensive time and attendance management',
          features: ['Time tracking', 'Overtime', 'Timesheets'],
          more: '+ 1 more feature'
        },
        {
          id: 'leave', title: 'Leave & Absence', color: 'c-cyan',
          desc: 'Leave management and absence tracking',
          features: ['Leave requests', 'Absence tracking', 'Leave policies'],
          more: '+ 1 more feature'
        },
        {
          id: 'performance', title: 'Performance Appraisal', color: 'c-blue',
          desc: 'Goal setting, appraisals, and performance tracking',
          features: ['Goal setting', 'Performance reviews', '360° feedback'],
          more: '+ 1 more feature'
        },
        {
          id: 'kyc', title: 'Verification & KYC', color: 'c-teal',
          desc: 'Employee verification and KYC compliance',
          features: ['Background checks', 'Document verification', 'Compliance tracking'],
          more: '+ 2 more features'
        },
        {
          id: 'internal-control', title: 'Internal Control', color: 'c-gray',
          desc: 'Risk management and internal controls',
          features: ['Risk assessment', 'Control monitoring', 'Policy enforcement'],
          more: '+ 1 more feature'
        },
        {
          id: 'marketplace', title: 'Cleon Market Place', color: 'c-violet',
          desc: 'Internal marketplace for HR services and benefits',
          features: ['Service catalog', 'Benefits marketplace', 'Vendor management'],
          more: '+ 1 more feature'
        },
        {
          id: 'hmo', title: 'Health & HMO', color: 'c-pink',
          desc: 'Comprehensive health insurance and HMO management',
          features: ['HMO enrollment', 'Hospital listings', 'Claims management'],
          more: '+ 1 more feature'
        },
        {
          id: 'attendance', title: 'Attendance & Shift Management', color: 'c-orange',
          desc: 'Attendance tracking and shift scheduling',
          features: ['Attendance tracking', 'Shift scheduling', 'Shift swaps'],
          more: '+ 3 more features'
        },
        {
          id: 'elearning', title: 'e-Learning', color: 'c-purple',
          desc: 'Learning management and training platform',
          features: ['Course library', 'Training programs', 'Certifications'],
          more: '+ 1 more feature'
        },
        {
          id: 'hr-advisory', title: 'HR Advisory', color: 'c-red',
          desc: 'HR consulting and advisory services',
          features: ['Expert consultation', 'HR policies', 'Best practices'],
          more: '+ 1 more feature'
        },
        {
          id: 'contracts', title: 'Client & Contract Management', color: 'c-blue-l',
          desc: 'Manage client relationships and contracts',
          features: ['Client portal', 'Contract lifecycle', 'SLA tracking'],
          more: '+ 1 more feature'
        },
      ];

      const ICONS = {
        'c-blue': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M19 8l2 2 4-4"/></svg>`,
        'c-purple': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>`,
        'c-green': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
        'c-teal': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
        'c-orange': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
        'c-cyan': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
        'c-gray': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,
        'c-violet': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>`,
        'c-pink': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,
        'c-red': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
        'c-blue-l': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
      };

      const installed = new Set();

      function updateCount() {
        const n = installed.size;
        document.getElementById('installed-count').textContent = n;
        document.getElementById('progress-bar').style.width = (n / 15 * 100) + '%';
      }

      function showToast(msg) {
        const t = document.getElementById('toast');
        document.getElementById('toast-msg').textContent = msg;
        t.classList.add('show');
        setTimeout(() => t.classList.remove('show'), 2500);
      }

      function renderModules() {
        const grid = document.getElementById('modules-grid');
        grid.innerHTML = '';
        MODULES.forEach(m => {
          const isInstalled = installed.has(m.id);
          const card = document.createElement('div');
          card.className = 'module-card';
          card.innerHTML = `
      <div class="card-icon ${m.color}">${ICONS[m.color] || ICONS['c-blue']}</div>
      <div class="card-title">${m.title}</div>
      <div class="card-desc">${m.desc}</div>
      <ul class="card-features">
        ${m.features.map(f => `<li>${f}</li>`).join('')}
        <li class="more">${m.more}</li>
      </ul>
      <button class="btn-install ${m.color} ${isInstalled ? 'installed' : ''}" data-id="${m.id}">
        ${isInstalled
              ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Installed`
              : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Install Module`
            }
      </button>
    `;
          card.querySelector('.btn-install').addEventListener('click', (e) => {
            const id = e.currentTarget.dataset.id;
            const mod = MODULES.find(x => x.id === id);
            if (installed.has(id)) {
              installed.delete(id);
              showToast(`${mod.title} uninstalled`);
            } else {
              installed.add(id);
              showToast(`${mod.title} installed successfully`);
            }
            updateCount();
            renderModules();
          });
          grid.appendChild(card);
        });
      }

      document.getElementById('install-all-btn').addEventListener('click', () => {
        if (installed.size === 15) {
          installed.clear();
          showToast('All modules uninstalled');
        } else {
          MODULES.forEach(m => installed.add(m.id));
          showToast('All 15 modules installed');
        }
        updateCount();
        renderModules();
      });

      renderModules();
      updateCount();
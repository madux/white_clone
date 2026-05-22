const employees = [
  { id: 'EMP001', name: 'Adaeze Okonkwo',    dept: 'Engineering',      role: 'Senior Software Developer',  initials: 'AO', active: true  },
  { id: 'EMP009', name: 'Blessing Eze',       dept: 'Customer Service', role: 'Customer Success Manager',   initials: 'BE', active: false },
  { id: 'EMP005', name: 'Chiamaka Obiora',    dept: 'Marketing',        role: 'Marketing Specialist',       initials: 'CO', active: false },
  { id: 'EMP002', name: 'Chukwuemeka Eze',    dept: 'Human Resources',  role: 'HR Manager',                 initials: 'CE', active: false },
  { id: 'EMP003', name: 'Emeka Nwosu',        dept: 'Finance',          role: 'Financial Analyst',          initials: 'EN', active: false },
  { id: 'EMP007', name: 'Ngozi Adeyemi',      dept: 'Legal',            role: 'Legal Counsel',              initials: 'NA', active: false },
  { id: 'EMP011', name: 'Tunde Okafor',       dept: 'Operations',       role: 'Operations Manager',         initials: 'TO', active: false },
];

let activeIndex = 0;

function renderProfileList() {
  const list = document.getElementById('profileList');
  list.innerHTML = employees.map((e, i) => `
    <div class="pd-item ${i === activeIndex ? 'active' : ''}" onclick="selectProfile(${i})">
      <div class="pd-avatar">${e.initials}</div>
      <div class="pd-info">
        <div class="pd-name">${e.name}</div>
        <div class="pd-emp">${e.id} • ${e.dept}</div>
        <div class="pd-role">${e.role}</div>
      </div>
      ${i === activeIndex ? '<svg class="pd-check" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
    </div>
  `).join('');
}

function selectProfile(i) {
  activeIndex = i;
  const currentTab = document.querySelector('#sidebar-root .nav-item.active');
  const tab = currentTab ? currentTab.getAttribute('data-tab') || 'home' : 'home';
  renderSidebar(tab);
  renderProfileList();
  toggleProfileDropdown(false);
}

function toggleProfileDropdown(forceClose) {
  const btn = document.getElementById('switchProfileBtn');
  const dd  = document.getElementById('profileDropdown');
  const isOpen = dd.classList.contains('open');
  if (forceClose === false || isOpen) {
    dd.classList.remove('open');
    btn.classList.remove('open');
  } else {
    dd.classList.add('open');
    btn.classList.add('open');
  }
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.switch-profile-wrap');
  if (wrap && !wrap.contains(e.target)) {
    toggleProfileDropdown(false);
  }
});

function toggleFilterPanel() {
  const panel = document.getElementById('filterPanel');
  const btn = document.querySelector('.pd-filter-btn');
  const isOpen = panel.classList.contains('open');
  if (isOpen) {
    panel.classList.remove('open');
    btn.classList.remove('open');
  } else {
    panel.classList.add('open');
    btn.classList.add('open');
  }
}

document.addEventListener('click', (e) => {
  const wrap = document.querySelector('.pd-documents-top');
  if (wrap && !wrap.contains(e.target)) {
    const panel = document.getElementById('filterPanel');
    const btn = document.querySelector('.pd-filter-btn');
    if (panel) panel.classList.remove('open');
    if (btn) btn.classList.remove('open');
  }
});

function switchEeTab(el) {
  document.querySelectorAll('#tab-employee-experience .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const tabId = el.getAttribute('data-ee-tab');
  if (tabId) {
    document.querySelectorAll('.ee-tab-content').forEach(s => s.style.display = 'none');
    const section = document.getElementById('ee-tab-' + tabId);
    if (section) section.style.display = 'block';
  }
}

function openTab(tabName) {
  const navItem = document.querySelector(`#sidebar-root .nav-item[data-tab="${tabName}"]`);
  if (navItem) setActiveSidebar(navItem);
}

function openAiAssistant() {
  alert('AI Assistant coming soon. For now, please contact support at support@cleonhr.com.');
}

document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

renderSidebar('home');
renderProfileList();

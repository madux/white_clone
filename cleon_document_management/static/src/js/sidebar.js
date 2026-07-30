const SIDEBAR_ITEMS = [
  { icon: 'house',            label: 'Home',                   tab: 'home' },
  { icon: 'smile',            label: 'Employee Experience',    tab: 'employee-experience' },
  { icon: 'repeat',           label: 'Workforce Life-cycle',   tab: 'workforce-lifecycle' },
  { icon: 'credit-card',      label: 'Staff Directory',        tab: 'staff-directory' },
  { icon: 'clock-3',          label: 'Time Management',        tab: 'time-management' },
  { icon: 'palmtree',         label: 'Leave Management',       tab: 'leave-management' },
  { icon: 'wallet',           label: 'Compensation Management', tab: 'compensation-management' },
  { icon: 'folder',           label: 'Document Management',    tab: 'personal-documents' },
  { icon: 'calendar-days',    label: 'Company Calendar',       tab: 'company-calendar' },
  { icon: 'box',              label: 'Asset Management',       tab: 'asset-management' },
  { icon: 'grid-2x2',         label: 'More',                   tab: '', more: true },
];

function renderSidebar(activeTab) {
  const root = document.getElementById('sidebar-root');
  if (!root) return;

  root.innerHTML = `
    <div class="sidebar-logo"><span>CleonHR</span></div>
    <div class="sidebar-header-row">
      <div class="nav-title">NAVIGATION</div>
      <div class="sidebar-toggle" onclick="toggleSidebar()">
        <i data-lucide="chevron-left"></i>
      </div>
    </div>
    <div class="nav">
      ${SIDEBAR_ITEMS.map((item, i) => {
        const isActive = (item.tab && item.tab === activeTab) || (!activeTab && i === 0 && !item.more);
        return `
          <div class="nav-item${isActive ? ' active' : ''}${item.more ? ' more' : ''}" data-tab="${item.tab || ''}" onclick="setActiveSidebar(this)">
            <div class="icon-wrap"><i data-lucide="${item.icon}"></i></div>
            <span>${item.label}</span>
          </div>
        `;
      }).join('')}
    </div>
    <div class="settings">
      <div class="nav-item" data-tab="settings" onclick="setActiveSidebar(this)">
        <div class="icon-wrap"><i data-lucide="settings"></i></div>
        <span>Settings</span>
      </div>
    </div>
  `;

  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }
}

function toggleSidebar() {
  const sb = document.querySelector('.sidebar');
  sb.classList.toggle('collapsed');
  const icon = sb.querySelector('.sidebar-toggle i');
  const collapsed = sb.classList.contains('collapsed');
  icon.setAttribute('data-lucide', collapsed ? 'chevron-right' : 'chevron-left');
  if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
}

function setActiveSidebar(el) {
  document.querySelectorAll('#sidebar-root .nav-item').forEach(n => n.classList.remove('active'));
  el.classList.add('active');

  const tab = el.getAttribute('data-tab');
  if (!tab) return;

  document.querySelectorAll('.tab-content').forEach(s => s.style.display = 'none');

  const section = document.getElementById('tab-' + tab);
  if (section) section.style.display = 'block';
}

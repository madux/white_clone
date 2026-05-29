/**
 * sidebar.js — Primary & Secondary Sidebar Logic
 * Handles hover expand, item clicks, secondary nav population,
 * and page-level tab switching (decoupled per sidebar item).
 */

/* ============================================================
   DATA — Secondary nav items & page tabs per primary item
   ============================================================ */
const SIDEBAR_DATA = {
  overview: {
    label: 'Overview',
    icon: 'layout-dashboard',
    navItems: [
      { id: 'dashboard', icon: 'layout-dashboard', label: 'Dashboard' }
    ],
    defaultNav: 'dashboard',
    pageTabs: {
      dashboard: []
    }
  },
  'org-setup': {
    label: 'Org Setup',
    icon: 'building-2',
    navItems: [
      { id: 'branches-locations', icon: 'building',        label: 'Branches & Locations' },
      { id: 'departments-units',  icon: 'network',         label: 'Departments & Units' },
      { id: 'job-roles',          icon: 'briefcase',       label: 'Job Roles' },
      { id: 'grade-levels',       icon: 'bar-chart-big',   label: 'Grade Levels' },
      { id: 'employment-types',   icon: 'clipboard-list',  label: 'Employment Types' },
      { id: 'reporting-structure',icon: 'link',            label: 'Reporting Structure' }
    ],
    defaultNav: 'branches-locations',
    pageTabs: {}
  },
  organization: {
    label: 'Organization',
    icon: 'users',
    navItems: [
      { id: 'org-chart',       icon: 'git-branch',  label: 'Org Chart' },
      { id: 'staff-directory', icon: 'users',        label: 'Staff Directory' }
    ],
    defaultNav: 'org-chart',
    pageTabs: {
      'org-chart':       ['Org Chart', 'Staff Directory'],
      'staff-directory': ['Org Chart', 'Staff Directory']
    }
  },
  'talent-acquisition': {
    label: 'Talent Acquisition',
    icon: 'user-search',
    navItems: [
      { id: 'job-postings',  icon: 'file-text',      label: 'Job Postings' },
      { id: 'applications',  icon: 'inbox',           label: 'Applications' },
      { id: 'interviews',    icon: 'calendar-check',  label: 'Interviews' },
      { id: 'offers',        icon: 'handshake',       label: 'Offers' },
      { id: 'ta-reports',    icon: 'bar-chart-2',     label: 'Reports' }
    ],
    defaultNav: 'job-postings',
    pageTabs: {
      'job-postings': ['All Jobs', 'Active', 'Draft', 'Closed'],
      'applications': ['All', 'Screening', 'Shortlisted', 'Rejected'],
      'interviews':   ['Scheduled', 'Completed', 'Cancelled'],
      'offers':       ['Pending', 'Accepted', 'Declined'],
      'ta-reports':   ['Funnel Report', 'Time-to-Hire', 'Source Analysis']
    }
  },
  onboarding: {
    label: 'Onboarding',
    icon: 'user-plus',
    navItems: [
      { id: 'ob-plans',      icon: 'clipboard-list',  label: 'Plans' },
      { id: 'new-hires',     icon: 'user-check',      label: 'New Hires' },
      { id: 'ob-tasks',      icon: 'check-square',    label: 'Task Templates' },
      { id: 'buddy-system',  icon: 'users-round',     label: 'Buddy System' },
      { id: 'ob-reports',    icon: 'bar-chart-2',     label: 'Reports' }
    ],
    defaultNav: 'new-hires',
    pageTabs: {
      'ob-plans':     ['Active Plans', 'Templates', 'Archive'],
      'new-hires':    ['In Progress', 'Completed', 'Overdue'],
      'ob-tasks':     ['All Templates', 'Department-wise', 'Role-wise'],
      'buddy-system': ['Active Pairs', 'Requests', 'History'],
      'ob-reports':   ['Completion Rate', 'Time Report', 'Feedback']
    }
  },
  offboarding: {
    label: 'Offboarding',
    icon: 'user-minus',
    navItems: [
      { id: 'exit-requests',   icon: 'log-out',        label: 'Exit Requests' },
      { id: 'exit-interviews', icon: 'message-circle', label: 'Exit Interviews' },
      { id: 'clearance',       icon: 'shield-check',   label: 'Clearance' },
      { id: 'ob-off-reports',  icon: 'bar-chart-2',    label: 'Reports' }
    ],
    defaultNav: 'exit-requests',
    pageTabs: {
      'exit-requests':   ['Pending', 'Approved', 'Rejected'],
      'exit-interviews': ['Scheduled', 'Completed', 'Pending'],
      'clearance':       ['Checklist', 'Pending Clearance', 'Cleared'],
      'ob-off-reports':  ['Attrition', 'Exit Reasons', 'Timeline']
    }
  },
  documentation: {
    label: 'Documentation',
    icon: 'file-stack',
    navItems: [
      { id: 'all-docs',    icon: 'files',       label: 'All Documents' },
      { id: 'templates',   icon: 'file-code-2', label: 'Templates' },
      { id: 'doc-policy',  icon: 'book-open',   label: 'Policies' },
      { id: 'archives',    icon: 'archive',     label: 'Archives' }
    ],
    defaultNav: 'all-docs',
    pageTabs: {
      'all-docs':   ['Recent', 'Shared', 'My Documents'],
      'templates':  ['HR Templates', 'Legal', 'Finance'],
      'doc-policy': ['Active', 'Under Review', 'Archived'],
      'archives':   ['2024', '2023', '2022']
    }
  },
  verification: {
    label: 'Verification',
    icon: 'shield-check',
    navItems: [
      { id: 'bg-checks',  icon: 'search',       label: 'Background Checks' },
      { id: 'id-verify',  icon: 'id-card',      label: 'ID Verification' },
      { id: 'references', icon: 'users',         label: 'References' },
      { id: 'ver-status', icon: 'activity',      label: 'Status Report' }
    ],
    defaultNav: 'bg-checks',
    pageTabs: {
      'bg-checks':  ['Pending', 'In Progress', 'Cleared', 'Flagged'],
      'id-verify':  ['Pending', 'Verified', 'Rejected'],
      'references': ['Requests Sent', 'Received', 'Completed'],
      'ver-status': ['Overview', 'Compliance', 'Timeline']
    }
  },
  workforce: {
    label: 'Workforce',
    icon: 'users',
    navItems: [
      { id: 'employees',   icon: 'users',            label: 'Employees' },
      { id: 'leave-mgmt',  icon: 'calendar-off',     label: 'Leave' },
      { id: 'attendance',  icon: 'clock',            label: 'Attendance' },
      { id: 'shifts',      icon: 'calendar-range',   label: 'Shifts' },
      { id: 'time-off',    icon: 'umbrella',         label: 'Time Off' }
    ],
    defaultNav: 'employees',
    pageTabs: {
      'employees':  ['All Employees', 'Active', 'Inactive', 'On Leave'],
      'leave-mgmt': ['Requests', 'Approved', 'Pending', 'History'],
      'attendance': ['Daily', 'Weekly', 'Monthly', 'Exceptions'],
      'shifts':     ['Current', 'Upcoming', 'Templates'],
      'time-off':   ['Balances', 'Taken', 'Carry Forward']
    }
  },
  compensation: {
    label: 'Compensation',
    icon: 'dollar-sign',
    navItems: [
      { id: 'payroll',       icon: 'credit-card',  label: 'Payroll' },
      { id: 'benefits',      icon: 'heart-pulse',  label: 'Benefits' },
      { id: 'salary-grades', icon: 'layers',       label: 'Salary Grades' },
      { id: 'allowances',    icon: 'plus-circle',  label: 'Allowances' },
      { id: 'comp-reports',  icon: 'bar-chart-2',  label: 'Reports' }
    ],
    defaultNav: 'payroll',
    pageTabs: {
      'payroll':       ['Current Cycle', 'History', 'Adjustments', 'Tax'],
      'benefits':      ['Health', 'Pension', 'Allowances', 'Perks'],
      'salary-grades': ['Grade Structure', 'Pay Bands', 'Audit'],
      'allowances':    ['Types', 'Assignments', 'History'],
      'comp-reports':  ['Payroll Summary', 'Benefits Cost', 'Grade Analysis']
    }
  },
  'performance-dev': {
    label: 'Performance & Dev',
    icon: 'trending-up',
    navItems: [
      { id: 'reviews',    icon: 'star',           label: 'Reviews' },
      { id: 'goals',      icon: 'target',         label: 'Goals' },
      { id: 'training',   icon: 'graduation-cap', label: 'Training' },
      { id: 'skills',     icon: 'sparkles',       label: 'Skills Matrix' },
      { id: 'pd-reports', icon: 'bar-chart-2',    label: 'Reports' }
    ],
    defaultNav: 'reviews',
    pageTabs: {
      'reviews':    ['Pending', 'In Progress', 'Completed', 'Overdue'],
      'goals':      ['Active Goals', 'Completed', 'Cancelled'],
      'training':   ['Upcoming', 'Ongoing', 'Completed', 'Catalogue'],
      'skills':     ['Skills Overview', 'By Role', 'Gaps Analysis'],
      'pd-reports': ['Performance Summary', 'Training ROI', 'Growth Trends']
    }
  },
  'staff-engagement': {
    label: 'Staff Engagement',
    icon: 'heart-handshake',
    navItems: [
      { id: 'surveys',       icon: 'clipboard-check', label: 'Surveys' },
      { id: 'recognition',   icon: 'award',            label: 'Recognition' },
      { id: 'announcements', icon: 'megaphone',        label: 'Announcements' },
      { id: 'feedback',      icon: 'message-square',   label: 'Feedback' },
      { id: 'se-reports',    icon: 'bar-chart-2',      label: 'Reports' }
    ],
    defaultNav: 'surveys',
    pageTabs: {
      'surveys':       ['Active', 'Drafts', 'Completed', 'Analysis'],
      'recognition':   ['Wall of Fame', 'Nominations', 'History'],
      'announcements': ['Active', 'Scheduled', 'Archive'],
      'feedback':      ['Received', 'Sent', 'Anonymous'],
      'se-reports':    ['Engagement Score', 'Participation', 'Trends']
    }
  },
  system: {
    label: 'System',
    icon: 'settings',
    navItems: [
      { id: 'settings',      icon: 'settings-2',    label: 'Settings' },
      { id: 'roles',         icon: 'shield',         label: 'Roles & Permissions' },
      { id: 'audit-logs',    icon: 'scroll',         label: 'Audit Logs' },
      { id: 'integrations',  icon: 'plug',           label: 'Integrations' },
      { id: 'app-config',    icon: 'sliders',        label: 'App Config' }
    ],
    defaultNav: 'settings',
    pageTabs: {
      'settings':     ['General', 'Notifications', 'Security', 'Appearance'],
      'roles':        ['Roles', 'Permissions', 'User Assignments'],
      'audit-logs':   ['All Logs', 'User Actions', 'System Events', 'Errors'],
      'integrations': ['Active', 'Available', 'Configure'],
      'app-config':   ['Modules', 'Workflow Rules', 'Automation']
    }
  }
};

/* ============================================================
   STATE
   ============================================================ */
let currentPrimaryItem = 'overview';
let currentNavItem     = 'dashboard';
const ORG_SETUP_CACHE  = {};

/* ============================================================
   APP DATA — populated by the active module script
   ============================================================ */
let TOTAL_EMPLOYEES = 0;

/* ============================================================
   INIT
   ============================================================ */
function initSidebar() {
  buildPrimaryNav();
  activatePrimary('overview');
}

/* ============================================================
   OPEN ORGANIZATION → STAFF DIRECTORY (from Talent Pipeline card)
   ============================================================ */
function openOrgStaffDirectory() {
  activatePrimary('organization');
  requestAnimationFrame(() => {
    const data = SIDEBAR_DATA['organization'];
    activateSecondaryNav('staff-directory', data);
  });
}

/* ============================================================
   BUILD PRIMARY NAV ITEMS
   ============================================================ */
function buildPrimaryNav() {
  const nav = document.getElementById('primaryNav');
  if (!nav) return;

  const items = [
    { id: 'overview',           icon: 'layout-dashboard', label: 'Overview' },
    { id: 'org-setup',          icon: 'building-2',        label: 'Org Setup' },
    { id: 'organization',       icon: 'users',           label: 'Organization' },
    { id: 'talent-acquisition', icon: 'user-search',       label: 'Talent Acquisition' },
    { id: 'onboarding',         icon: 'user-plus',         label: 'Onboarding' },
    { id: 'offboarding',        icon: 'user-minus',        label: 'Offboarding' },
    { id: 'documentation',      icon: 'file-stack',        label: 'Documentation' },
    { id: 'verification',       icon: 'shield-check',      label: 'Verification' },
    { id: 'workforce',          icon: 'users',             label: 'Workforce' },
    { id: 'compensation',       icon: 'dollar-sign',       label: 'Compensation' },
    { id: 'performance-dev',    icon: 'trending-up',       label: 'Performance & Dev' },
    { id: 'staff-engagement',   icon: 'heart-handshake',   label: 'Staff Engagement' },
    { id: 'system',             icon: 'settings',          label: 'System' }
  ];

  // Split: main items (first 12) + system at bottom
  const mainItems   = items.slice(0, 12);
  const systemItems = items.slice(12);

  mainItems.forEach(item => {
    nav.appendChild(createPrimaryNavItem(item));
  });

  // Divider
  const div = document.createElement('div');
  div.className = 'nav-divider';
  nav.appendChild(div);

  systemItems.forEach(item => {
    nav.appendChild(createPrimaryNavItem(item));
  });
}

function createPrimaryNavItem({ id, icon, label }) {
  const el = document.createElement('div');
  el.className = 'nav-item';
  el.dataset.item = id;
  el.innerHTML = `
    <span class="nav-icon"><i data-lucide="${icon}"></i></span>
    <span class="nav-label">${label}</span>
  `;
  el.addEventListener('click', () => activatePrimary(id));
  return el;
}

/* ============================================================
   ACTIVATE PRIMARY ITEM
   ============================================================ */
function activatePrimary(itemId) {
  currentPrimaryItem = itemId;
  const data = SIDEBAR_DATA[itemId] || SIDEBAR_DATA['overview'];

  // Update primary nav active state
  document.querySelectorAll('#primaryNav .nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.item === itemId);
  });

  // Update secondary sidebar header
  const secIcon  = document.getElementById('secHeaderIcon');
  const secLabel = document.getElementById('secHeaderLabel');
  if (secIcon)  secIcon.innerHTML  = `<i data-lucide="${data.icon}"></i>`;
  if (secLabel) secLabel.textContent = data.label;

  // Rebuild secondary nav
  buildSecondaryNav(data);

  // Activate default nav item
  activateSecondaryNav(data.defaultNav, data);

  // Re-init Lucide icons
  if (window.lucide) lucide.createIcons();
}

/* ============================================================
   BUILD SECONDARY NAV
   ============================================================ */
function buildSecondaryNav(data) {
  const nav = document.getElementById('secondaryNav');
  if (!nav) return;
  nav.innerHTML = '';

  data.navItems.forEach(item => {
    const el = document.createElement('div');
    el.className = 'sec-nav-item';
    el.dataset.nav = item.id;
    const countHtml = item.id === 'staff-directory' ? `<span class="sec-nav-count">${TOTAL_EMPLOYEES}</span>` : '';
    el.innerHTML  = `<i data-lucide="${item.icon}"></i><span class="sec-nav-label">${item.label}</span>${countHtml}<span class="sec-nav-chevron">›</span>`;
    el.addEventListener('click', () => activateSecondaryNav(item.id, data));
    nav.appendChild(el);
  });
}

/* ============================================================
   ACTIVATE SECONDARY NAV ITEM → update page tabs & header title
   ============================================================ */
function activateSecondaryNav(navId, data) {
  currentNavItem = navId;

  // Highlight active sec nav item
  document.querySelectorAll('#secondaryNav .sec-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.nav === navId);
  });

  // Find nav item label
  const navItem = data.navItems.find(n => n.id === navId) || data.navItems[0];

  // Update global header page title
  const titleEl = document.getElementById('headerPageTitle');
  if (titleEl) {
    titleEl.textContent = currentPrimaryItem === 'overview' ? 'Overview' : (navItem ? navItem.label : data.label);
  }

  // Build page tabs for this nav item
  const tabs = (data.pageTabs || {})[navId] || [];
  const tabIdx = navId === 'staff-directory' ? 1 : 0;
  buildPageTabs(tabs, tabIdx);

  // Show page content for current primary item
  showPageContent(currentPrimaryItem, navId);

  // Re-init icons
  if (window.lucide) lucide.createIcons();
}

/* ============================================================
   ORG SETUP — Tab nav arrow scroll (delegated)
   ============================================================ */
document.addEventListener('click', function (e) {
  var arrow = e.target.closest('.tab-nav-arrow');
  if (arrow) {
    var bar = arrow.closest('.tab-navigation-bar');
    if (bar) {
      var container = bar.querySelector('.tabs-scroll-container');
      if (container) container.scrollBy({ left: 200, behavior: 'smooth' });
    }
  }
  // Branch edit action
  var editLink = e.target.closest('#view-org-setup .action-link[data-action="edit"]');
  if (editLink) {
    e.preventDefault();
    var row = editLink.closest('tr');
    if (row) {
      var cells = row.querySelectorAll('td');
      document.getElementById('editBranchName').value    = cells[0].textContent.trim();
      document.getElementById('editBranchCode').value    = cells[1].textContent.trim();
      document.getElementById('editBranchCountry').value = cells[2].textContent.trim();
      document.getElementById('editBranchAddress').value = cells[3].textContent.trim();
      var statusSpan = cells[5].querySelector('.badge');
      document.getElementById('editBranchStatus').value  = statusSpan ? statusSpan.textContent.trim() : 'Active';
      var modal = document.getElementById('branchEditModal');
      modal._editingRow = row;
      modal.classList.add('open');
    }
  }
  // Create Branch button
  var createBtn = e.target.closest('#view-org-setup .btn-primary');
  if (createBtn && createBtn.textContent.indexOf('Create Branch') !== -1) {
    e.preventDefault();
    document.getElementById('branchCreateModal').classList.add('open');
  }
  // Department edit action (card Edit button)
  var editDept = e.target.closest('#view-org-setup .action-btn[data-action="edit-dept"]');
  if (editDept) {
    e.preventDefault();
    var card = editDept.closest('.dept-card');
    if (card) {
      document.getElementById('deptModalTitle').textContent = 'Edit Department';
      document.getElementById('deptModalActionBtn').textContent = 'Save Changes';
      document.getElementById('deptName').value = card.querySelector('.dept-title').textContent.trim();
      document.getElementById('deptCode').value = card.getAttribute('data-code') || '';
      var locIcon = card.querySelector('.dept-location i');
      if (locIcon && locIcon.nextSibling) {
        document.getElementById('deptLocation').value = locIcon.nextSibling.textContent.trim();
      }
      document.getElementById('deptHead').value = card.querySelector('.meta-highlight').textContent.trim();
      document.getElementById('deptBudget').value = card.getAttribute('data-budget') || '';
      document.getElementById('deptHeadcount').value = card.getAttribute('data-target') || '';
      var modal = document.getElementById('deptModal');
      modal._editingCard = card;
      modal.classList.add('open');
      lucide.createIcons();
    }
  }
  // Create Department button
  var createDeptBtn = e.target.closest('#view-org-setup .btn-create-dept');
  if (createDeptBtn) {
    e.preventDefault();
    resetDeptModal();
    document.getElementById('deptModalTitle').textContent = 'Create New Department';
    document.getElementById('deptModalActionBtn').textContent = 'Create Department';
    document.getElementById('deptModal').classList.add('open');
  }
});

function saveBranchEdit() {
  var modal = document.getElementById('branchEditModal');
  var name    = document.getElementById('editBranchName').value.trim();
  var code    = document.getElementById('editBranchCode').value.trim();
  var country = document.getElementById('editBranchCountry').value.trim();
  var address = document.getElementById('editBranchAddress').value.trim();
  var status  = document.getElementById('editBranchStatus').value;

  if (!name) return;

  var row = modal._editingRow;
  if (!row) return;

  var cells = row.querySelectorAll('td');
  cells[0].innerHTML = '<span class="font-semibold text-dark">' + name + '</span>';
  cells[1].innerHTML = '<span class="text-muted text-xs">' + code + '</span>';
  cells[2].textContent = country;
  cells[3].innerHTML = '<span class="text-muted text-sm">' + address + '</span>';
  cells[5].innerHTML = '<span class="badge status-' + status.toLowerCase() + '">' + status + '</span>';

  modal.classList.remove('open');
}

function closeCreateBranch() {
  var modal = document.getElementById('branchCreateModal');
  modal.classList.remove('open');
  document.getElementById('newBranchName').value = '';
  document.getElementById('newBranchCode').value = '';
  document.getElementById('newBranchAddress').value = '';
  document.getElementById('newBranchCity').value = '';
  document.getElementById('newBranchPostal').value = '';
  document.getElementById('newBranchManager').value = '';
  document.getElementById('newBranchCurrency').value = '';
}

function createBranch() {
  var name = document.getElementById('newBranchName').value.trim();
  if (!name) { document.getElementById('newBranchName').focus(); return; }
  var code    = document.getElementById('newBranchCode').value.trim();
  var country = document.getElementById('newBranchCountry').value;
  var address = document.getElementById('newBranchAddress').value.trim();
  var city    = document.getElementById('newBranchCity').value.trim();
  var postal  = document.getElementById('newBranchPostal').value.trim();
  var manager = document.getElementById('newBranchManager').value;
  var currency = document.getElementById('newBranchCurrency').value;

  if (!code) {
    var rows = document.querySelectorAll('#branchesTable tbody tr');
    code = 'BR-' + String(rows.length + 1).padStart(3, '0');
  }
  var fullAddress = address;
  if (city) fullAddress += (fullAddress ? ', ' : '') + city;
  if (postal) fullAddress += (fullAddress ? ' ' : '') + postal;

  var tbody = document.querySelector('#branchesTable tbody');
  var row = document.createElement('tr');
  row.innerHTML =
    '<td class="font-semibold text-dark">' + name + '</td>' +
    '<td class="text-muted text-xs">' + code + '</td>' +
    '<td>' + country + '</td>' +
    '<td class="text-muted text-sm">' + (fullAddress || 'TBD') + '</td>' +
    '<td class="count-highlight font-bold">0</td>' +
    '<td><span class="badge status-active">Active</span></td>' +
    '<td class="actions-cell"><a href="#" class="action-link" data-action="edit">Edit</a><a href="#" class="action-link" data-action="depts">Depts</a></td>';
  tbody.appendChild(row);
  closeCreateBranch();
}

function closeDeptModal() {
  document.getElementById('deptModal').classList.remove('open');
}

function resetDeptModal() {
  document.getElementById('deptName').value = '';
  document.getElementById('deptCode').value = '';
  document.getElementById('deptLocation').value = 'HQ New York';
  document.getElementById('deptHead').value = '';
  document.getElementById('deptBudget').value = '';
  document.getElementById('deptHeadcount').value = '';
  var modal = document.getElementById('deptModal');
  modal._editingCard = null;
}

function saveDeptDraft() {
  closeDeptModal();
}

function createDept() {
  var name = document.getElementById('deptName').value.trim();
  if (!name) { document.getElementById('deptName').focus(); return; }
  var code     = document.getElementById('deptCode').value.trim();
  var location = document.getElementById('deptLocation').value;
  var head     = document.getElementById('deptHead').value;
  var budget   = document.getElementById('deptBudget').value.trim();
  var target   = document.getElementById('deptHeadcount').value.trim();

  if (!code) {
    var cards = document.querySelectorAll('#view-org-setup .dept-card');
    code = 'DEPT-' + String(cards.length + 1).padStart(3, '0');
  }

  var card = document.getElementById('deptModal')._editingCard;
  if (card) {
    card.querySelector('.dept-title').textContent = name;
    card.setAttribute('data-code', code);
    card.querySelector('.meta-highlight').textContent = head;
    var locIcon = card.querySelector('.dept-location i');
    if (locIcon) locIcon.nextSibling.textContent = ' ' + location;
    card.setAttribute('data-budget', budget);
    card.setAttribute('data-target', target);
    closeDeptModal();
    return;
  }

  var grid = document.querySelector('#view-org-setup .departments-grid');
  var newCard = document.createElement('div');
  newCard.className = 'dept-card';
  newCard.setAttribute('data-code', code);
  newCard.setAttribute('data-budget', budget);
  newCard.setAttribute('data-target', target);
  newCard.innerHTML =
    '<div class="card-header-row">' +
      '<span class="emoji-icon">📁</span>' +
      '<span class="staff-badge">0 staff</span>' +
    '</div>' +
    '<h3 class="dept-title">' + name + '</h3>' +
    '<p class="dept-meta">Head: <span class="meta-highlight">' + (head || '—') + '</span></p>' +
    '<p class="dept-location"><i data-lucide="map-pin"></i> ' + location + '</p>' +
    '<div class="metric-row">' +
      '<div class="metric-block"><span class="metric-val text-pink">' + (budget ? '$' + Number(budget).toLocaleString() : '$0') + '</span><span class="metric-lbl">Budget</span></div>' +
      '<div class="metric-block"><span class="metric-val text-pink">0</span><span class="metric-lbl">Open Roles</span></div>' +
      '<div class="metric-block"><span class="metric-val text-muted">0</span><span class="metric-lbl">Headcount</span></div>' +
    '</div>' +
    '<div class="progress-container">' +
      '<div class="progress-labels"><span>Budget used</span><span>0%</span></div>' +
      '<div class="progress-bar-bg"><div class="progress-bar-fill fill-green" style="width:0%;"></div></div>' +
    '</div>' +
    '<div class="card-actions-row">' +
      '<button class="action-btn text-dark">View Detail</button>' +
      '<button class="action-btn text-muted" data-action="edit-dept">Edit</button>' +
      '<button class="action-btn text-red">Delete</button>' +
    '</div>';
  grid.insertBefore(newCard, grid.querySelector('.add-dept-card'));

  if (window.lucide) lucide.createIcons();
  closeDeptModal();
}

/* ============================================================
   BUILD PAGE TABS (decoupled per nav item)
   ============================================================ */
function buildPageTabs(tabs, activeIndex) {
  const container = document.getElementById('pageTabs');
  if (!container) return;

  if (!tabs || tabs.length === 0) {
    container.innerHTML = '';
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';
  container.innerHTML = tabs.map((tab, i) => {
    var iconHtml = '';
    var label = tab;
    if (tab === 'Org Chart') {
      iconHtml = '<i data-lucide="git-branch" style="width:14px;height:14px;"></i> ';
    } else if (tab === 'Staff Directory') {
      iconHtml = '<i data-lucide="users" style="width:14px;height:14px;"></i> ';
      label = 'Staff Directory <span class="tab-count">' + TOTAL_EMPLOYEES + '</span>';
    }
    return '<div class="page-tab ' + (i === (activeIndex ?? 0) ? 'active' : '') + '" data-tab="' + i + '">' + iconHtml + label + '</div>';
  }).join('');

  container.querySelectorAll('.page-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.page-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      var data = SIDEBAR_DATA[currentPrimaryItem];
      if (data) {
        var tabText = (tab.textContent || '').trim();
        var match = data.navItems.find(function(n) { return tabText.startsWith(n.label); });
        if (match && match.id !== currentNavItem) {
          activateSecondaryNav(match.id, data);
        }
      }
    });
  });
}

/* ============================================================
   SHOW PAGE CONTENT (toggle which page-view is shown)
   ============================================================ */
function showPageContent(primaryId, navId) {
  document.querySelectorAll('.page-view').forEach(el => el.classList.remove('active'));

  // Overview/Dashboard → show dashboard content
  if (primaryId === 'overview' && navId === 'dashboard') {
    const el = document.getElementById('view-dashboard');
    if (el) el.classList.add('active');
    return;
  }

  // Staff Directory → show dedicated view
  if (navId === 'staff-directory') {
    const el = document.getElementById('view-staff-directory');
    if (el) el.classList.add('active');
    return;
  }

  // Org Chart → show dedicated view
  if (navId === 'org-chart') {
    const el = document.getElementById('view-org-chart');
    if (el) el.classList.add('active');
    return;
  }

  // Org Setup → dynamic fetch + inject
  if (primaryId === 'org-setup') {
    const el = document.getElementById('view-org-setup');
    if (el) {
      el.classList.add('active');
      if (ORG_SETUP_CACHE[navId]) {
        el.innerHTML = ORG_SETUP_CACHE[navId];
        if (window.lucide) lucide.createIcons();
      } else {
        fetch('org_setup/tabs/' + navId + '.html')
          .then(function(r) { return r.text(); })
          .then(function(html) {
            ORG_SETUP_CACHE[navId] = html;
            el.innerHTML = html;
            if (window.lucide) lucide.createIcons();
          });
      }
    }
    return;
  }

  // Generic placeholder for all other views
  const genericEl = document.getElementById('view-generic');
  if (genericEl) {
    const data = SIDEBAR_DATA[primaryId];
    const navItem = data ? data.navItems.find(n => n.id === navId) : null;
    const label   = navItem ? navItem.label : (data ? data.label : 'Page');

    document.getElementById('generic-title').textContent  = label;
    document.getElementById('generic-module').textContent = data ? data.label : '';
    genericEl.classList.add('active');
  }
}

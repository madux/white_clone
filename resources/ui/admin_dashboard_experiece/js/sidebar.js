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
      { id: 'company-profile', icon: 'building-2',  label: 'Company Profile' },
      { id: 'departments',     icon: 'network',      label: 'Departments' },
      { id: 'job-titles',      icon: 'briefcase',    label: 'Job Titles' },
      { id: 'grade-levels',    icon: 'layers',       label: 'Grade Levels' },
      { id: 'work-locations',  icon: 'map-pin',      label: 'Work Locations' },
      { id: 'policies',        icon: 'scroll-text',  label: 'Policies' }
    ],
    defaultNav: 'company-profile',
    pageTabs: {
      'company-profile': ['General Info', 'Branding', 'Legal'],
      'departments':     ['All Departments', 'Structure', 'Assignments'],
      'job-titles':      ['Job Titles', 'Descriptions', 'Requirements'],
      'grade-levels':    ['Grade Structure', 'Pay Bands', 'Benefits Map'],
      'work-locations':  ['Locations', 'Remote Policy', 'Zones'],
      'policies':        ['HR Policies', 'Leave Policies', 'Code of Conduct']
    }
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

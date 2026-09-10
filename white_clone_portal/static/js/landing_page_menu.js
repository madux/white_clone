/* ================================================================
   Services Mega Menu – Interactive JS
   ================================================================ */

(function () {
  const btn = document.getElementById('services-btn');
  const menu = document.getElementById('services-mega-menu');
  const backdrop = document.getElementById('services-backdrop');
  const searchInput = document.getElementById('mega-search');
  const panel = document.getElementById('mega-center-panel') || document.getElementById('mega-panel');

  if (!btn || !menu) return;

  // ── SVG helpers ───────────────────────────────────────────────
  const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-3.5 h-3.5"><path d="m9 18 6-6-6-6"></path></svg>`;
  const chevronRightSm = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mega-search-result-chevron" aria-hidden="true"><path d="m9 18 6-6-6-6"></path></svg>`;

  // ── Category data ─────────────────────────────────────────────
  const CATEGORIES = {
    'core-hr': {
      label: 'Core HR Operations',
      description: 'Manage employee records, organizational structure, and core HR operations.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>`,
          title: 'HR Administration', slug: 'hr-administration', badge: { text: 'Core', type: 'core' },
          desc: 'Complete employee lifecycle management',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`,
          title: 'Workforce Lifecycle', slug: 'workforce-lifecycle',
          desc: 'Onboarding, offboarding, and employee transitions',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/><path d="M20 3v4"/><path d="M22 5h-4"/><path d="M4 17v2"/><path d="M5 18H3"/></svg>`,
          title: 'Employee Experience', slug: 'employee-experience',
          desc: 'Self-service portal and engagement tools',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
          title: 'Staff Directory', slug: 'staff-directory', badge: { text: 'Free', type: 'free' },
          desc: 'Employee profiles, org charts, and search',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>`,
          title: 'Employee Self-Service (ESS)', slug: 'employee-self-service',
          desc: 'Empower employees with self-service capabilities',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
          title: 'Document Management', slug: 'document-management',
          desc: 'Enterprise document repository and e-signatures',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
          title: 'Company Calendar',
          desc: 'Company-wide events and team scheduling',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M7 3v18"/><path d="M3 7.5h4"/><path d="M3 12h18"/><path d="M3 16.5h4"/><path d="M17 3v18"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/></svg>`,
          title: 'Company Documentary',
          desc: 'Video library for company culture and events',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`,
          title: 'Social Gallery',
          desc: 'Photo gallery and social feed for engagement',
        },
      ],
    },
    'workforce': {
      label: 'Workforce Management',
      description: 'Manage attendance, scheduling, compensation, and employee operations.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>`,
          title: 'Attendance & Shift Management',
          desc: 'Clock-in/out and shift scheduling',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
          title: 'Time Management',
          desc: 'Attendance tracking, schedules, and timesheets',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>`,
          title: 'Leave Management',
          desc: 'Leave requests, approvals, and balances',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>`,
          title: 'Compensation Management',
          desc: 'Salary management, payroll, and bonuses',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>`,
          title: 'Health Insurance (HMO)',
          desc: 'HMO enrollment, provider management, and claims',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6" style="color:rgb(233,30,140)"><path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/></svg>`,
          title: 'Asset Management',
          desc: 'Track company assets and assignments',
        },
      ],
    },
    'talent': {
      label: 'Talent & Performance',
      description: 'Manage hiring, employee growth, learning, and performance.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" x2="19" y1="8" y2="14"/><line x1="22" x2="16" y1="11" y2="11"/></svg>`,
          title: 'Recruitment',
          desc: 'End-to-end hiring and applicant tracking',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>`,
          title: 'Performance Appraisal',
          desc: 'KPI management and 360° reviews',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 0 3 3 0 0 0-3-3z"/></svg>`,
          title: 'E-Learning & Knowledge Management',
          desc: 'Training, courses, and certifications',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
          title: 'HR Advisory & Knowledge Base',
          desc: 'HR consulting and policy guidance',
        },
      ],
    },
    'payroll': {
      label: 'Payroll & Finance',
      description: 'Handle payroll, accounting, claims, and workforce finance operations.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`,
          title: 'Payroll & Remittance',
          desc: 'Automated payroll and tax filing',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
          title: 'HR Finance Management',
          desc: 'Budgeting, expenses, and financial reporting',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/></svg>`,
          title: 'CleonTime — Claims',
          desc: 'Timesheets, claims, and overtime management',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/></svg>`,
          title: 'Expense Management',
          desc: 'Employee expense tracking and reimbursements',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/></svg>`,
          title: 'Petty Cash',
          desc: 'Petty cash management and tracking',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M10 2v8l3-3 3 3V2"/><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/></svg>`,
          title: 'Chart of Accounts',
          desc: 'Financial account structure and management',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m9 15 2 2 4-4"/></svg>`,
          title: 'Journal Entries',
          desc: 'Manual journal entries and adjustments',
        },
      ],
    },
    'compliance': {
      label: 'Compliance & Governance',
      description: 'Ensure compliance, auditability, and organizational governance.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
          title: 'Verification & KYC',
          desc: 'Employee verification and background screening',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></svg>`,
          title: 'Internal Control & Compliance',
          desc: 'Audit trails and compliance monitoring',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
          title: 'Audit Trail',
          desc: 'Complete audit trail and activity logging',
        },
      ],
    },
    'client-ops': {
      label: 'Client & Business Operations',
      description: 'Manage external relationships, contracts, and client operations.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
          title: 'Client Management',
          desc: 'Client relationship and account management',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
          title: 'Contract Management',
          desc: 'Contract lifecycle and billing',
        },
      ],
    },
    'platform': {
      label: 'Platform & Intelligence',
      description: 'Power the CleonHR ecosystem with AI, analytics, and automation.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/></svg>`,
          title: 'AI Integration Engine',
          desc: 'AI-powered HR insights and automation',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>`,
          title: 'Reporting & Analytics Platform',
          desc: 'Comprehensive HR analytics and dashboards',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/></svg>`,
          title: 'Notification & Communication Engine',
          desc: 'Multi-channel notifications and alerts',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>`,
          title: 'Cleon Guide',
          desc: 'Interactive HR guidance and support',
        },
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`,
          title: 'Global Employee Management System (GEMS)',
          desc: 'Multi-country employee management',
        },
      ],
    },
    'marketplace': {
      label: 'Marketplace & Ecosystem',
      description: 'Extend CleonHR with integrations, partner services, and ecosystem tools.',
      modules: [
        {
          icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg>`,
          title: 'Cleon Marketplace & Services Ecosystem',
          desc: 'API integrations, third-party services, payroll partners, and HR vendors',
        },
      ],
    },
  };

  // ── Sidebar button data (order + category key) ────────────────
  const SIDEBAR_ITEMS = [
    { key: 'core-hr',     label: 'Core HR Operations',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/></svg>` },
    { key: 'workforce',   label: 'Workforce Management',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/><path d="m9 16 2 2 4-4"/></svg>` },
    { key: 'talent',      label: 'Talent & Performance',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>` },
    { key: 'payroll',     label: 'Payroll & Finance',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>` },
    { key: 'compliance',  label: 'Compliance & Governance',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>` },
    { key: 'client-ops',  label: 'Client & Business Operations',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><rect width="20" height="14" x="2" y="6" rx="2"/></svg>` },
    { key: 'platform',    label: 'Platform & Intelligence',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/></svg>` },
    { key: 'marketplace', label: 'Marketplace & Ecosystem',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-4 h-4"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M2 7h20"/></svg>` },
  ];

  // ── Render helpers (styles: landing_page_menu_panel.css) ───────
  function toSlug(title) {
    return String(title || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function moduleCardHTML(m) {
    const slug = m.slug || toSlug(m.title);
    let badge = '';
    if (m.badge) {
      if (m.badge.type === 'core') {
        badge = `<span class="mega-module-badge mega-module-badge--core flex-shrink-0 mt-0.5">${m.badge.text}</span>`;
      } else if (m.badge.type === 'featured') {
        badge = `<span class="mega-search-badge mega-search-badge--featured flex-shrink-0 mt-0.5">${m.badge.text}</span>`;
      } else if (m.badge.type === 'free') {
        badge = `<span class="mega-search-badge mega-search-badge--free flex-shrink-0 mt-0.5">${m.badge.text}</span>`;
      } else if (m.badge.cls) {
        badge = `<span class="text-xs px-1.5 py-0.5 rounded-full font-bold ${m.badge.cls} flex-shrink-0 mt-0.5">${m.badge.text}</span>`;
      }
    }
    return `
      <button type="button" class="mega-module-card" data-module-slug="${slug}" data-module-title="${m.title.replace(/"/g, '&quot;')}">
        <div class="mega-module-card-icon">${m.icon}</div>
        <div class="mega-module-card-title-row">
          <p class="mega-module-card-title">${m.title}</p>
          ${badge}
        </div>
        <p class="mega-module-card-desc">${m.desc}</p>
        <div class="mega-module-card-explore">Explore ${chevronRight}</div>
      </button>`;
  }

  function bindModuleCardClicks() {
    if (!panel) return;
    panel.querySelectorAll('.mega-module-card[data-module-slug]').forEach((card) => {
      card.addEventListener('click', () => {
        const slug = card.dataset.moduleSlug;
        const title = card.dataset.moduleTitle || '';
        if (!slug) return;
        try {
          sessionStorage.setItem('cleon_active_module', JSON.stringify({ slug, title }));
        } catch (e) { /* ignore */ }
        window.location.href = '/explore/' + encodeURIComponent(slug);
      });
    });
  }

  function renderPanel(catKey) {
    if (!panel) return;
    const cat = CATEGORIES[catKey];
    if (!cat) return;
    panel.innerHTML = `
      <div class="mega-panel-inner">
        <div class="mega-panel-header">
          <div class="mega-panel-header-label">
            <div class="mega-panel-header-dot"></div>
            <h3 class="mega-panel-header-title">${cat.label}</h3>
          </div>
          <p class="mega-panel-header-desc">${cat.description}</p>
        </div>
        <div class="mega-panel-grid">
          ${cat.modules.map(moduleCardHTML).join('')}
        </div>
      </div>`;
    bindModuleCardClicks();
  }

  function selectCategory(catKey) {
    const sidebarEl = menu.querySelector('.p-4.space-y-0\\.5.flex-1') ||
                      menu.querySelector('[class*="space-y-0"]');
    if (sidebarEl) {
      sidebarEl.querySelectorAll('.mega-cat-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cat === catKey);
      });
    }
    renderPanel(catKey);
  }

  function highlightModuleCard(title) {
    if (!panel || !title) return;
    const cards = panel.querySelectorAll('.mega-module-card');
    let target = null;
    cards.forEach(card => {
      const cardTitle = card.querySelector('.mega-module-card-title');
      if (cardTitle && cardTitle.textContent.trim() === title) {
        target = card;
      }
    });
    if (!target) return;

    // Clear any previous highlight timers/classes
    cards.forEach(card => card.classList.remove('is-search-highlight'));

    target.classList.add('is-search-highlight');
    target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });

    window.clearTimeout(highlightModuleCard._timer);
    highlightModuleCard._timer = window.setTimeout(() => {
      target.classList.remove('is-search-highlight');
    }, 1600);
  }

  // ── Search dropdown (styles: landing_page_menu_search.css) ─────
  let searchDropdown = null;
  let activeResultIndex = -1;

  function ensureSearchDropdown() {
    if (!searchInput) return null;
    const wrap = searchInput.closest('.relative') || searchInput.parentElement;
    if (!wrap) return null;
    wrap.classList.add('mega-search-wrap');

    if (!searchDropdown) {
      searchDropdown = document.createElement('div');
      searchDropdown.className = 'mega-search-dropdown';
      searchDropdown.setAttribute('role', 'listbox');
      searchDropdown.id = 'mega-search-dropdown';
      wrap.appendChild(searchDropdown);
    }
    return searchDropdown;
  }

  function flattenModules() {
    const items = [];
    Object.keys(CATEGORIES).forEach(catKey => {
      const cat = CATEGORIES[catKey];
      cat.modules.forEach(m => {
        items.push({
          ...m,
          catKey,
          categoryLabel: cat.label,
          haystack: `${m.title} ${m.desc} ${cat.label}`.toLowerCase(),
        });
      });
    });
    return items;
  }

  /** Simple fuzzy score: substring match preferred, else subsequence. */
  function fuzzyScore(haystack, query) {
    if (!query) return 0;
    if (haystack.includes(query)) {
      // Prefer earlier / title-like matches
      const idx = haystack.indexOf(query);
      return 1000 - idx;
    }
    // subsequence fuzzy
    let hi = 0;
    let score = 0;
    for (let qi = 0; qi < query.length; qi++) {
      const ch = query[qi];
      const found = haystack.indexOf(ch, hi);
      if (found === -1) return -1;
      score += 10 - Math.min(found - hi, 9);
      hi = found + 1;
    }
    return score;
  }

  function searchModules(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return flattenModules()
      .map(item => ({ item, score: fuzzyScore(item.haystack, q) }))
      .filter(r => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.item);
  }

  function searchResultBadgeHTML(badge) {
    if (!badge) return '';
    if (badge.type === 'core' || /^core$/i.test(badge.text)) {
      return `<span class="mega-module-badge mega-module-badge--core">Core</span>`;
    }
    if (badge.type === 'featured' || /featured/i.test(badge.text)) {
      return `<span class="mega-search-badge mega-search-badge--featured">Featured</span>`;
    }
    if (badge.type === 'free' || /free/i.test(badge.text)) {
      return `<span class="mega-search-badge mega-search-badge--free">Free</span>`;
    }
    return `<span class="mega-search-badge mega-search-badge--featured">${badge.text}</span>`;
  }

  function searchResultHTML(item) {
    const slug = item.slug || toSlug(item.title);
    return `
      <button type="button" class="mega-search-result" role="option"
              data-cat="${item.catKey}" data-title="${item.title.replace(/"/g, '&quot;')}"
              data-module-slug="${slug}">
        <div class="mega-search-result-icon">${item.icon}</div>
        <div class="mega-search-result-body">
          <p class="mega-search-result-title">${item.title}</p>
          <p class="mega-search-result-desc">${item.desc}</p>
          <div class="mega-search-result-meta">
            <span class="mega-search-result-category">${item.categoryLabel}</span>
            ${searchResultBadgeHTML(item.badge)}
          </div>
        </div>
        ${chevronRightSm}
      </button>`;
  }

  function hideSearchDropdown() {
    if (!searchDropdown) return;
    searchDropdown.classList.remove('open');
    searchDropdown.innerHTML = '';
    activeResultIndex = -1;
  }

  function showSearchDropdown(results, query) {
    const dd = ensureSearchDropdown();
    if (!dd) return;

    if (!query.trim()) {
      hideSearchDropdown();
      return;
    }

    const count = results.length;
    const headerLabel = count === 1 ? '1 Result' : `${count} Results`;
    const listHTML = count
      ? results.map(searchResultHTML).join('')
      : `<div class="mega-search-empty">No modules match “${query.trim()}”</div>`;

    dd.innerHTML = `
      <div class="mega-search-dropdown-header"><p>${headerLabel}</p></div>
      <div class="mega-search-dropdown-list">${listHTML}</div>`;
    dd.classList.add('open');
    activeResultIndex = -1;

    dd.querySelectorAll('.mega-search-result').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slug = btn.dataset.moduleSlug;
        const title = btn.dataset.title || '';
        if (slug) {
          try {
            sessionStorage.setItem('cleon_active_module', JSON.stringify({ slug, title }));
          } catch (err) { /* ignore */ }
          window.location.href = '/explore/' + encodeURIComponent(slug);
          return;
        }
        const catKey = btn.dataset.cat;
        if (searchInput) searchInput.value = '';
        hideSearchDropdown();
        selectCategory(catKey);
        requestAnimationFrame(() => highlightModuleCard(title));
      });
    });
  }

  function setActiveResult(index) {
    if (!searchDropdown) return;
    const rows = [...searchDropdown.querySelectorAll('.mega-search-result')];
    if (!rows.length) return;
    activeResultIndex = ((index % rows.length) + rows.length) % rows.length;
    rows.forEach((row, i) => row.classList.toggle('is-active', i === activeResultIndex));
    rows[activeResultIndex].scrollIntoView({ block: 'nearest' });
  }

  // ── Build sidebar dynamically ─────────────────────────────────
  function buildSidebar() {
    const sidebarEl = menu.querySelector('.p-4.space-y-0\\.5.flex-1') ||
                      menu.querySelector('[class*="space-y-0"]');
    if (!sidebarEl) return;

    const chevR = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-chevron-right w-4 h-4 flex-shrink-0"><path d="m9 18 6-6-6-6"></path></svg>`;

    sidebarEl.innerHTML = SIDEBAR_ITEMS.map((item, i) => `
      <button class="mega-cat-btn w-full flex items-center gap-3 px-3 py-3 text-left transition-all rounded-xl${i === 0 ? ' active' : ''}"
              data-cat="${item.key}">
        <div class="cat-icon-wrap w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
          ${item.icon}
        </div>
        <span class="flex-1 font-semibold leading-tight" style="font-size:14px;">${item.label}</span>
        <span class="cat-chevron">${chevR}</span>
      </button>`).join('');

    // Wire up clicks
    sidebarEl.querySelectorAll('.mega-cat-btn').forEach(catBtn => {
      catBtn.addEventListener('click', () => {
        sidebarEl.querySelectorAll('.mega-cat-btn').forEach(b => b.classList.remove('active'));
        catBtn.classList.add('active');
        renderPanel(catBtn.dataset.cat);
      });
    });
  }

  const industriesMenu = document.getElementById('industries-mega-menu');

  function industriesOpen() {
    return !!(industriesMenu && industriesMenu.classList.contains('open'));
  }

  function syncBackdrop(show) {
    if (!backdrop) return;
    if (show || industriesOpen()) backdrop.classList.add('visible');
    else backdrop.classList.remove('visible');
  }

  // ── open / close helpers ──────────────────────────────────────
  function openMenu() {
    document.dispatchEvent(new CustomEvent('cleon:close-industries'));
    menu.classList.add('open');
    syncBackdrop(true);
    btn.classList.add('active');
    // Render default (Core HR) on every open
    buildSidebar();
    renderPanel('core-hr');
    if (searchInput) searchInput.focus();
  }

  function closeMenu() {
    menu.classList.remove('open');
    syncBackdrop(false);
    btn.classList.remove('active');
    if (searchInput) searchInput.value = '';
    hideSearchDropdown();
  }

  // ── toggle on Services button click ──────────────────────────
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.classList.contains('open') ? closeMenu() : openMenu();
  });

  // ── close on backdrop ─────────────────────────────────────────
  if (backdrop) backdrop.addEventListener('click', closeMenu);

  // ── close on Escape ───────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (searchDropdown && searchDropdown.classList.contains('open')) {
        hideSearchDropdown();
        return;
      }
      if (menu.classList.contains('open')) closeMenu();
    }
  });

  // ── close on outside click ────────────────────────────────────
  document.addEventListener('click', (e) => {
    if (!menu.classList.contains('open')) return;
    if (!menu.contains(e.target) && !btn.contains(e.target)) closeMenu();
  });

  document.addEventListener('cleon:close-services', closeMenu);

  // ── live fuzzy search dropdown ────────────────────────────────
  if (searchInput) {
    ensureSearchDropdown();

    searchInput.addEventListener('input', () => {
      const q = searchInput.value;
      showSearchDropdown(searchModules(q), q);
    });

    searchInput.addEventListener('focus', () => {
      const q = searchInput.value;
      if (q.trim()) showSearchDropdown(searchModules(q), q);
    });

    searchInput.addEventListener('keydown', (e) => {
      if (!searchDropdown || !searchDropdown.classList.contains('open')) return;
      const rows = searchDropdown.querySelectorAll('.mega-search-result');
      if (!rows.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveResult(activeResultIndex + 1);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveResult(activeResultIndex - 1);
      } else if (e.key === 'Enter' && activeResultIndex >= 0) {
        e.preventDefault();
        rows[activeResultIndex].click();
      }
    });

    // Clicking elsewhere inside the mega menu dismisses results
    menu.addEventListener('click', (e) => {
      const wrap = searchInput.closest('.mega-search-wrap');
      if (wrap && !wrap.contains(e.target)) hideSearchDropdown();
    });
  }
})();

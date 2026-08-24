const fullPrimaryMenuData = [
  {
    id: "dashboard",
    label: "Dashboard",
    canHaveNotification: false,
    subMenus: [
      {
        id: "dashboard_dashboard-overview",
        label: "Dashboard Overview",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-chart-no-axes-column-increasing transition-colors text-white"
                  >
                    <line x1="12" x2="12" y1="20" y2="10"></line>
                    <line x1="18" x2="18" y1="20" y2="4"></line>
                    <line x1="6" x2="6" y1="20" y2="16"></line>
                  </svg>`,
      },
      {
        id: "dashboard_quick-actions",
        label: "Quick Actions",
        canHaveNotification: false,
        icon: ` <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-activity transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path
                      d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
                    ></path>
                  </svg>`,
      },
      {
        id: "dashboard_recent-activities",
        label: "Recent Activities",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-clock transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>`,
      },
      {
        id: "dashboard_my-tasks",
        label: "My Tasks",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-square-check-big transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path
                      d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"
                    ></path>
                    <path d="m9 11 3 3L22 4"></path>
                  </svg>`,
      },
      {
        id: "dashboard_announcements",
        label: "Announcements",
        canHaveNotification: true,
        icon: ` <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-briefcase transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    <rect width="20" height="14" x="2" y="6" rx="2"></rect>
                  </svg>`,
      },
    ],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-house transition-colors text-white"
            >
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
              <path
                d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
              ></path>
            </svg>`,
  },
  {
    id: "setup",
    label: "Setup",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-sparkles transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
              ></path>
              <path d="M20 3v4"></path>
              <path d="M22 5h-4"></path>
              <path d="M4 17v2"></path>
              <path d="M5 18H3"></path>
            </svg>`,
  },
  {
    id: "claims",
    label: "Claims",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-file-text transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
              ></path>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
              <path d="M10 9H8"></path>
              <path d="M16 13H8"></path>
              <path d="M16 17H8"></path>
            </svg>`,
  },
  {
    id: "requests",
    label: "Requests",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-send transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
              ></path>
              <path d="m21.854 2.147-10.94 10.939"></path>
            </svg>`,
  },
  {
    id: "advances",
    label: "Advances",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-dollar-sign transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <line x1="12" x2="12" y1="2" y2="22"></line>
              <path
                d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              ></path>
            </svg>`,
  },
  {
    id: "workflow",
    label: "Workflow",
    canHaveNotification: true,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-square-check-big transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"
              ></path>
              <path d="m9 11 3 3L22 4"></path>
            </svg>`,
  },
  {
    id: "payments",
    label: "Payments",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-credit-card transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <rect width="20" height="14" x="2" y="5" rx="2"></rect>
              <line x1="2" x2="22" y1="10" y2="10"></line>
            </svg>`,
  },
  {
    id: "petty-cash",
    label: "Petty Cash",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-dollar-sign transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <line x1="12" x2="12" y1="2" y2="22"></line>
              <path
                d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              ></path>
            </svg>`,
  },
  {
    id: "teams",
    label: "Teams",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-users transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>`,
  },
  {
    id: "accounts",
    label: "Accounts",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-book-open transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path d="M12 7v14"></path>
              <path
                d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
              ></path>
            </svg>`,
  },
  {
    id: "vendors",
    label: "Vendors",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-building transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
              <path d="M9 22v-4h6v4"></path>
              <path d="M8 6h.01"></path>
              <path d="M16 6h.01"></path>
              <path d="M12 6h.01"></path>
              <path d="M12 10h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 10h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 10h.01"></path>
              <path d="M8 14h.01"></path>
            </svg>`,
  },
  {
    id: "budget",
    label: "Budget",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-target transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>`,
  },
  {
    id: "reports",
    label: "Reports",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-chart-pie transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
              ></path>
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            </svg>`,
  },
  {
    id: "audit",
    label: "Audit",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-file-check transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
              ></path>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
              <path d="m9 15 2 2 4-4"></path>
            </svg>`,
  },
  {
    id: "setting",
    label: "Setting",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-settings transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              ></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>`,
  },
  {
    id: "theme",
    label: "Theme",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-palette transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <path
                d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
              ></path>
            </svg>`,
  },
];

const firstPrimaryMenuData = [
  {
    id: "dashboard",
    label: "Dashboard",
    canHaveNotification: false,
    subMenus: [
      {
        id: "dashboard_dashboard-overview",
        label: "Dashboard Overview",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-chart-no-axes-column-increasing transition-colors text-white"
                  >
                    <line x1="12" x2="12" y1="20" y2="10"></line>
                    <line x1="18" x2="18" y1="20" y2="4"></line>
                    <line x1="6" x2="6" y1="20" y2="16"></line>
                  </svg>`,
      },
      {
        id: "dashboard_quick-actions",
        label: "Quick Actions",
        canHaveNotification: false,
        icon: ` <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-activity transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path
                      d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
                    ></path>
                  </svg>`,
      },
      {
        id: "dashboard_recent-activities",
        label: "Recent Activities",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-clock transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>`,
      },
      {
        id: "dashboard_my-tasks",
        label: "My Tasks",
        canHaveNotification: false,
        icon: `<svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-square-check-big transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path
                      d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"
                    ></path>
                    <path d="m9 11 3 3L22 4"></path>
                  </svg>`,
      },
      {
        id: "dashboard_announcements",
        label: "Announcements",
        canHaveNotification: true,
        icon: ` <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-briefcase transition-colors text-gray-800 group-hover:text-gray-900"
                  >
                    <path d="M16 20V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    <rect width="20" height="14" x="2" y="6" rx="2"></rect>
                  </svg>`,
      },
    ],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-house transition-colors text-white"
            >
              <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"></path>
              <path
                d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
              ></path>
            </svg>`,
  },
  {
    id: "setup",
    label: "Setup",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-sparkles transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"
              ></path>
              <path d="M20 3v4"></path>
              <path d="M22 5h-4"></path>
              <path d="M4 17v2"></path>
              <path d="M5 18H3"></path>
            </svg>`,
  },
  {
    id: "claims",
    label: "Claims",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-file-text transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
              ></path>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
              <path d="M10 9H8"></path>
              <path d="M16 13H8"></path>
              <path d="M16 17H8"></path>
            </svg>`,
  },
  {
    id: "requests",
    label: "Requests",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-send transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"
              ></path>
              <path d="m21.854 2.147-10.94 10.939"></path>
            </svg>`,
  },
  {
    id: "advances",
    label: "Advances",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-dollar-sign transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <line x1="12" x2="12" y1="2" y2="22"></line>
              <path
                d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              ></path>
            </svg>`,
  },
  {
    id: "workflow",
    label: "Workflow",
    canHaveNotification: true,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-square-check-big transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M21 10.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12.5"
              ></path>
              <path d="m9 11 3 3L22 4"></path>
            </svg>`,
  },
  {
    id: "payments",
    label: "Payments",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-credit-card transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <rect width="20" height="14" x="2" y="5" rx="2"></rect>
              <line x1="2" x2="22" y1="10" y2="10"></line>
            </svg>`,
  },
  {
    id: "petty-cash",
    label: "Petty Cash",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-dollar-sign transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <line x1="12" x2="12" y1="2" y2="22"></line>
              <path
                d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
              ></path>
            </svg>`,
  },
  {
    id: "teams",
    label: "Teams",
    canHaveNotification: false,
    subMenus: [],
    icon: ` <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-users transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
              <circle cx="9" cy="7" r="4"></circle>
              <path d="M22 21v-2a4 4 0 0 0-3-3.87"></path>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
            </svg>`,
  },
];

const secondPrimaryMenuData = [
  {
    id: "accounts",
    label: "Accounts",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-book-open transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path d="M12 7v14"></path>
              <path
                d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"
              ></path>
            </svg>`,
  },
  {
    id: "vendors",
    label: "Vendors",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-building transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect>
              <path d="M9 22v-4h6v4"></path>
              <path d="M8 6h.01"></path>
              <path d="M16 6h.01"></path>
              <path d="M12 6h.01"></path>
              <path d="M12 10h.01"></path>
              <path d="M12 14h.01"></path>
              <path d="M16 10h.01"></path>
              <path d="M16 14h.01"></path>
              <path d="M8 10h.01"></path>
              <path d="M8 14h.01"></path>
            </svg>`,
  },
  {
    id: "budget",
    label: "Budget",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-target transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="6"></circle>
              <circle cx="12" cy="12" r="2"></circle>
            </svg>`,
  },
];
const thirdPrimaryMenuData = [
  {
    id: "reports",
    label: "Reports",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-chart-pie transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M21 12c.552 0 1.005-.449.95-.998a10 10 0 0 0-8.953-8.951c-.55-.055-.998.398-.998.95v8a1 1 0 0 0 1 1z"
              ></path>
              <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
            </svg>`,
  },
  {
    id: "audit",
    label: "Audit",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-file-check transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"
              ></path>
              <path d="M14 2v4a2 2 0 0 0 2 2h4"></path>
              <path d="m9 15 2 2 4-4"></path>
            </svg>`,
  },
];

const fourthPrimaryMenuData = [
  {
    id: "setting",
    label: "Setting",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-settings transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <path
                d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
              ></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>`,
  },
  {
    id: "theme",
    label: "Theme",
    canHaveNotification: false,
    subMenus: [],
    icon: `<svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              class="lucide lucide-palette transition-colors text-gray-700 group-hover:text-gray-900"
            >
              <circle cx="13.5" cy="6.5" r=".5" fill="currentColor"></circle>
              <circle cx="17.5" cy="10.5" r=".5" fill="currentColor"></circle>
              <circle cx="8.5" cy="7.5" r=".5" fill="currentColor"></circle>
              <circle cx="6.5" cy="12.5" r=".5" fill="currentColor"></circle>
              <path
                d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"
              ></path>
            </svg>`,
  },
];

const firstPrimaryMenuCont = document.getElementById("first-primary-menu-cont");
const secondPrimaryMenuCont = document.getElementById(
  "second-primary-menu-cont",
);
const thirdPrimaryMenuCont = document.getElementById("third-primary-menu-cont");

const nav = document.getElementById("exm-sidebar-menu");

function createPrimaryNavItem({ id, icon, label, canHaveNotification }) {
  const el = document.createElement("div");

  el.innerHTML = `
   <button
            class="exm-rail-button "
            type="button"
            data-label="${label}"
            data-id="${id}"
            aria-label="${label}"
          >
            ${icon}
            ${canHaveNotification ? `<span class="exm-notification">2</span>` : ""}
          </button>
  `;
  el.addEventListener("click", () => activatePrimary(id));
  return el;
}

const createSideBar = () => {
  firstPrimaryMenuData.forEach((item) => {
    nav.appendChild(createPrimaryNavItem(item));
  });

  const divForGreen1 = document.createElement("span");
  const divForGreen2 = document.createElement("span");
  divForGreen1.className = "exm-green-rail-divider exm-rail-divider";
  divForGreen1.setAttribute("aria-hidden", "true");
  divForGreen2.className = "exm-green-status-dot exm-status-dot";
  divForGreen2.setAttribute("aria-hidden", "true");
  nav.appendChild(divForGreen1);
  nav.appendChild(divForGreen2);

  secondPrimaryMenuData.forEach((item) => {
    nav.appendChild(createPrimaryNavItem(item));
  });

  const divForPink1 = document.createElement("span");
  const divForPink2 = document.createElement("span");
  divForPink1.className = "exm-pink-rail-divider exm-rail-divider";
  divForPink1.setAttribute("aria-hidden", "true");
  divForPink2.className = "exm-pink-status-dot exm-status-dot";
  divForPink2.setAttribute("aria-hidden", "true");
  nav.appendChild(divForPink1);
  nav.appendChild(divForPink2);

  thirdPrimaryMenuData.forEach((item) => {
    nav.appendChild(createPrimaryNavItem(item));
  });

  const divForBlue1 = document.createElement("span");
  const divForBlue2 = document.createElement("span");
  divForBlue1.className = "exm-blue-rail-divider exm-rail-divider";
  divForBlue1.setAttribute("aria-hidden", "true");
  divForBlue2.className = "exm-blue-status-dot exm-status-dot";
  divForBlue2.setAttribute("aria-hidden", "true");
  nav.appendChild(divForBlue1);
  nav.appendChild(divForBlue2);

  fourthPrimaryMenuData.forEach((item) => {
    nav.appendChild(createPrimaryNavItem(item));
  });
};

// Activate primary menu item based on the id

const activatePrimary = (id) => {
  const allPrimaryItems = document.querySelectorAll(".exm-rail-button");

  allPrimaryItems.forEach((item) => {
    item.classList.toggle(
      "exm-rail-button-active",
      item.dataset.id === String(id),
    );
  });
};

document.querySelectorAll(".exm-rail-button").forEach((item) => {
  item.addEventListener("click", () => {
    activatePrimary(item.dataset.id);
  });
});

createSideBar();

/** @odoo-module **/

import { markup } from "@odoo/owl";

const ICON_PATHS = {
    search: '<circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.3-4.3"></path>',
    chart: '<line x1="18" x2="18" y1="20" y2="10"></line><line x1="12" x2="12" y1="20" y2="4"></line><line x1="6" x2="6" y1="20" y2="14"></line>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
    building: '<rect width="16" height="20" x="4" y="2" rx="2" ry="2"></rect><path d="M9 22v-4h6v4"></path><path d="M8 6h.01"></path><path d="M16 6h.01"></path><path d="M12 6h.01"></path><path d="M12 10h.01"></path><path d="M12 14h.01"></path><path d="M16 10h.01"></path><path d="M16 14h.01"></path><path d="M8 10h.01"></path><path d="M8 14h.01"></path>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle>',
    coffee: '<path d="M10 2v2"></path><path d="M14 2v2"></path><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1"></path><path d="M6 2v2"></path>',
    sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path><path d="M20 3v4"></path><path d="M22 5h-4"></path><path d="M4 17v2"></path><path d="M5 18H3"></path>',
    ellipsis: '<circle cx="12" cy="12" r="1"></circle><circle cx="19" cy="12" r="1"></circle><circle cx="5" cy="12" r="1"></circle>',
    chevronLeft: '<path d="m15 18-6-6 6-6"></path>',
    chevronRight: '<path d="m9 18 6-6-6-6"></path>',
    plus: '<path d="M5 12h14"></path><path d="M12 5v14"></path>',
    trash: '<path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line>',
    x: '<path d="M18 6 6 18"></path><path d="m6 6 12 12"></path>',
    arrowRight: '<path d="M5 12h14"></path><path d="m12 5 7 7-7 7"></path>',
    trending: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"></polyline><polyline points="16 17 22 17 22 11"></polyline>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"></path><circle cx="12" cy="10" r="3"></circle>',
    award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"></path><circle cx="12" cy="8" r="6"></circle>',
    calendar: '<path d="M8 2v4"></path><path d="M16 2v4"></path><rect width="18" height="18" x="3" y="4" rx="2"></rect><path d="M3 10h18"></path>',
    mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" x2="12" y1="19" y2="22"></line>',
    send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"></path><path d="m21.854 2.147-10.94 10.939"></path>',
    globe: '<circle cx="12" cy="12" r="10"></circle><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"></path><path d="M2 12h20"></path>',
};

function safeColor(color) {
    return /^#[0-9A-Fa-f]{6}$/.test(color || "") ? color : "#6B7280";
}

function safeSize(size) {
    const n = Number(size);
    return n > 0 && n < 64 ? n : 16;
}

export function cleonIcon(name, size, color) {
    const body = ICON_PATHS[name] || ICON_PATHS.sparkles;
    const px = safeSize(size);
    return markup(
        '<svg xmlns="http://www.w3.org/2000/svg" width="' + px + '" height="' + px +
        '" viewBox="0 0 24 24" fill="none" stroke="' + safeColor(color) +
        '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>"
    );
}

export const CLEON_CATEGORIES = [
    { id: "all", label: "All Suggestions", icon: "sparkles" },
    { id: "organizational", label: "Organizational Intelligence", icon: "chart" },
    { id: "employee", label: "Employee Insights", icon: "users" },
    { id: "organization", label: "Organization", icon: "building" },
    { id: "personal", label: "Personal", icon: "user" },
    { id: "casual", label: "Casual", icon: "coffee" },
    { id: "more", label: "More", icon: "ellipsis" },
];

export const CLEON_SUGGESTIONS = [
    { id: "headcount", category: "organizational", icon: "users", color: "#3B82F6", text: "What is our total headcount across all departments?" },
    { id: "trend", category: "organizational", icon: "chart", color: "#8B5CF6", text: "Show me the headcount trend over the last 12 months." },
    { id: "largest-dept", category: "organization", icon: "building", color: "#0EA5E9", text: "Which department has the highest number of employees?" },
    { id: "attrition", category: "organizational", icon: "trending", color: "#EF4444", text: "What is the attrition rate this year?" },
    { id: "gender", category: "employee", icon: "users", color: "#EC4899", text: "Show me the gender distribution in the organization." },
    { id: "location", category: "organization", icon: "pin", color: "#F59E0B", text: "Which location has the highest employee count?" },
    { id: "top-depts", category: "organizational", icon: "award", color: "#10B981", text: "What are the top 5 performing departments?" },
    { id: "diversity", category: "employee", icon: "users", color: "#6B7280", text: "Give me insights on our workforce diversity." },
    { id: "leave-today", category: "employee", icon: "calendar", color: "#F59E0B", text: "How many employees are on leave today?" },
    { id: "manager-prep", category: "personal", icon: "user", color: "#8B5CF6", text: "How can I prepare for a conversation with my manager?" },
    { id: "productivity", category: "casual", icon: "coffee", color: "#F59E0B", text: "How can I improve my productivity?" },
    { id: "skills", category: "more", icon: "award", color: "#10B981", text: "Which skills show up most often in this view?" },
    { id: "hiring", category: "more", icon: "users", color: "#3B82F6", text: "How is hiring showing up in the current roster?" },
];

export const CLEON_TOPICS = [
    { id: "headcount", label: "Headcount", prompt: "What is our current headcount?" },
    { id: "attrition", label: "Attrition", prompt: "What should I know about attrition?" },
    { id: "performance", label: "Performance", prompt: "What should I know about performance?" },
    { id: "diversity", label: "Diversity", prompt: "What should I know about diversity?" },
    { id: "skills", label: "Skills", prompt: "What should I know about skills?" },
    { id: "hiring", label: "Hiring", prompt: "What should I know about hiring?" },
    { id: "leave", label: "Leave", prompt: "What should I know about leave?" },
    { id: "organization", label: "Organization", prompt: "What should I know about the organization?" },
    { id: "trends", label: "Trends", prompt: "What trends should I look at?" },
];

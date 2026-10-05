/** @odoo-module **/

import { Component, useState } from "@odoo/owl";

export const SDIR_SETTINGS_KEY = "sdir_directory_settings";
export const SDIR_SETTINGS_MIGRATED_KEY = "sdir_directory_settings_migrated";

export const SDIR_DEFAULT_SETTINGS = {
    landingTab: "people", // people | teams | relationship
    density: "comfortable", // comfortable | compact
    peopleView: "table", // table | cards
    peoplePageSize: 25, // 10 | 12 | 25 | 50
    peopleSortField: "name", // name | dept | role | startDate | gradeLevel | location
    peopleSortDir: "asc", // asc | desc
    orgSubTab: "overview", // overview | teams | calendar | analytics
};

/** Map settings landingTab → dashboard activeTab */
export const SDIR_LANDING_TO_TAB = {
    people: "people",
    teams: "org",
    relationship: "network",
};

/** Map People settings sort field → people_list sortBy key */
export const SDIR_PEOPLE_SORT_TO_COLUMN = {
    name: "name",
    dept: "department",
    role: "role",
    startDate: "start_date",
    gradeLevel: "grade",
    location: "location",
};

export const SDIR_PEOPLE_VIEW_TO_ACTIVE = {
    table: "list",
    cards: "grid",
};

export function normalizeDirectorySettings(raw) {
    const src = raw && typeof raw === "object" ? raw : {};
    const pageSize = Number(src.peoplePageSize);
    return {
        landingTab: ["people", "teams", "relationship"].includes(src.landingTab)
            ? src.landingTab
            : SDIR_DEFAULT_SETTINGS.landingTab,
        density: ["comfortable", "compact"].includes(src.density)
            ? src.density
            : SDIR_DEFAULT_SETTINGS.density,
        peopleView: ["table", "cards"].includes(src.peopleView)
            ? src.peopleView
            : SDIR_DEFAULT_SETTINGS.peopleView,
        peoplePageSize: [10, 12, 25, 50].includes(pageSize)
            ? pageSize
            : SDIR_DEFAULT_SETTINGS.peoplePageSize,
        peopleSortField: ["name", "dept", "role", "startDate", "gradeLevel", "location"].includes(src.peopleSortField)
            ? src.peopleSortField
            : SDIR_DEFAULT_SETTINGS.peopleSortField,
        peopleSortDir: ["asc", "desc"].includes(src.peopleSortDir)
            ? src.peopleSortDir
            : SDIR_DEFAULT_SETTINGS.peopleSortDir,
        orgSubTab: ["overview", "teams", "calendar", "analytics"].includes(src.orgSubTab)
            ? src.orgSubTab
            : SDIR_DEFAULT_SETTINGS.orgSubTab,
    };
}

/** Local cache only — server (hr.staff.directory.settings) is the source of truth. */
export function loadCachedDirectorySettings() {
    try {
        const raw = localStorage.getItem(SDIR_SETTINGS_KEY);
        if (!raw) return { ...SDIR_DEFAULT_SETTINGS };
        return normalizeDirectorySettings(JSON.parse(raw));
    } catch {
        return { ...SDIR_DEFAULT_SETTINGS };
    }
}

export function cacheDirectorySettings(settings) {
    try {
        localStorage.setItem(SDIR_SETTINGS_KEY, JSON.stringify(normalizeDirectorySettings(settings)));
    } catch {
        // ignore quota / private mode
    }
}

export function settingsEqual(a, b) {
    const left = normalizeDirectorySettings(a);
    const right = normalizeDirectorySettings(b);
    return (
        left.landingTab === right.landingTab &&
        left.density === right.density &&
        left.peopleView === right.peopleView &&
        left.peoplePageSize === right.peoplePageSize &&
        left.peopleSortField === right.peopleSortField &&
        left.peopleSortDir === right.peopleSortDir &&
        left.orgSubTab === right.orgSubTab
    );
}

export function isDefaultDirectorySettings(settings) {
    return settingsEqual(settings, SDIR_DEFAULT_SETTINGS);
}

/** Apply People-tab prefs onto a people_list-like state object. */
export function applyPeopleSettingsToListState(listState, settings) {
    const s = normalizeDirectorySettings(settings);
    const nextView = SDIR_PEOPLE_VIEW_TO_ACTIVE[s.peopleView] || "list";
    if (listState.activeView === "list" || listState.activeView === "grid") {
        listState.activeView = nextView;
    }
    listState.pageSize = s.peoplePageSize;
    listState.sortBy = SDIR_PEOPLE_SORT_TO_COLUMN[s.peopleSortField] || "name";
    listState.sortDesc = s.peopleSortDir === "desc";
    listState.currentOffset = 0;
}

const NAV_ITEMS = [
    { id: "general", label: "General", desc: "Defaults & density", icon: "settings" },
    { id: "people", label: "People", desc: "Table, sort, pagination", icon: "users" },
    { id: "org", label: "Org Structure", desc: "Default sub-tab", icon: "layers" },
    { id: "workforce", label: "Workforce Intel.", desc: "Recs, health, thresholds", icon: "chart" },
    { id: "cleo", label: "Cleo & Cleon AI", desc: "Cleo, evidence, tips", icon: "sparkles" },
    { id: "data", label: "Data Sources", desc: "Connection status", icon: "database" },
];

export class StaffDirectorySettings extends Component {
    static template = "hr_staff_directory.Settings";
    static props = {
        settings: { type: Object },
        onUpdate: { type: Function },
        onReset: { type: Function },
        onClose: { type: Function },
        onDone: { type: Function },
    };

    setup() {
        this.navItems = NAV_ITEMS;
        this.state = useState({
            activeSection: "general",
        });
    }

    selectSection(id) {
        this.state.activeSection = id;
    }

    get activeSectionLabel() {
        const item = this.navItems.find((i) => i.id === this.state.activeSection);
        return item ? item.label : "Settings";
    }

    onLandingTabChange(ev) {
        this.props.onUpdate({ landingTab: ev.target.value });
    }

    setDensity(density) {
        this.props.onUpdate({ density });
    }

    setPeopleView(view) {
        this.props.onUpdate({ peopleView: view });
    }

    onPeoplePageSizeChange(ev) {
        this.props.onUpdate({ peoplePageSize: parseInt(ev.target.value, 10) });
    }

    onPeopleSortFieldChange(ev) {
        this.props.onUpdate({ peopleSortField: ev.target.value });
    }

    setPeopleSortDir(dir) {
        this.props.onUpdate({ peopleSortDir: dir });
    }

    onOrgSubTabChange(ev) {
        this.props.onUpdate({ orgSubTab: ev.target.value });
    }
}

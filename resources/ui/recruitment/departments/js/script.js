let globalDepartmentsState = [
    {
        id: "DEPT-001",
        name: "yuui",
        description: "",
        location: "enugu",
        jobCount: 0,
        owner: { name: "Sarah Chen", role: "Admin", initials: "SC", avatarClass: "chr-avatar-pink" },
        team: [
            { name: "Sarah Chen", role: "Admin", email: "sarah.chen@cleonhr.com", initials: "SC", avatarClass: "chr-avatar-pink" },
            { name: "Michael Rodriguez", role: "Recruiter", email: "michael.rodriguez@cleonhr.com", initials: "MR", avatarClass: "chr-avatar-pink" }
        ],
        createdDate: "06/15/2026 22:06",
        color: "#10b981",
        avatarClass: "chr-avatar-green"
    },
    {
        id: "DEPT-002",
        name: "Human Resources",
        description: "Talent acquisition and employee relations",
        location: "Dallas, TX, United States",
        jobCount: 2,
        owner: { name: "Michael Rodriguez", role: "Recruiter", initials: "MR", avatarClass: "chr-avatar-pink" },
        team: [
            { name: "Michael Rodriguez", role: "Recruiter", email: "michael.rodriguez@cleonhr.com", initials: "MR", avatarClass: "chr-avatar-pink" },
            { name: "Emily Thompson", role: "HR Generalist", email: "emily.t@cleonhr.com", initials: "ET", avatarClass: "chr-avatar-pink" }
        ],
        createdDate: "07/24/2021 15:36",
        color: "#ec4899",
        avatarClass: "chr-avatar-pink"
    },
    {
        id: "DEPT-003",
        name: "Information Technology",
        description: "Technology infrastructure and support",
        location: "Seattle, WA, United States",
        jobCount: 1,
        owner: { name: "Emily Thompson", role: "HR Generalist", initials: "ET", avatarClass: "chr-avatar-pink" },
        team: [
            { name: "Emily Thompson", role: "HR Generalist", email: "emily.t@cleonhr.com", initials: "ET", avatarClass: "chr-avatar-pink" }
        ],
        createdDate: "08/15/2021 11:22",
        color: "#3b82f6",
        avatarClass: "chr-avatar-blue"
    },
    {
        id: "DEPT-004",
        name: "Marketing",
        description: "Brand strategy and digital marketing",
        location: "Miami, FL, United States",
        jobCount: 1,
        owner: null,
        team: [],
        createdDate: "09/01/2021 17:45",
        color: "#f59e0b",
        avatarClass: "chr-avatar-orange"
    },
    {
        id: "DEPT-005",
        name: "Operations and Support",
        description: "Customer service and operational excellence",
        location: "New York, NY, United States",
        jobCount: 4,
        owner: null,
        team: [
            { name: "Michael Rodriguez", role: "Recruiter", email: "michael.rodriguez@cleonhr.com", initials: "MR", avatarClass: "chr-avatar-pink" }
        ],
        createdDate: "10/12/2021 10:15",
        color: "#14b8a6",
        avatarClass: "chr-avatar-teal"
    }
];

let activeSelectedDepartment = null;

function captureDomReferences() {
    window.chrDOM = {
        departmentsListView: document.getElementById("chr-departments-list-container"),
        masterView: document.getElementById("chr-master-view"),
        detailView: document.getElementById("chr-detail-view"),
        rowsRoot: document.getElementById("chr-department-rows-root"),
        paginationCounter: document.getElementById("chr-pagination-counter"),
        filterPanel: document.getElementById("chr-filter-panel"),
        filterToggleBtn: document.getElementById("chr-filter-toggle-btn"),
        locationFilter: document.getElementById("chr-location-filter"),
        searchInput: document.getElementById("chr-search-input"),
        refreshBtn: document.getElementById("chr-refresh-btn"),
        backToMasterBtn: document.getElementById("chr-back-to-master-btn"),
        detailAvatar: document.getElementById("chr-detail-avatar"),
        detailName: document.getElementById("chr-detail-name"),
        detailLocation: document.getElementById("chr-detail-location"),
        tabLinks: document.querySelectorAll(".chr-tab-link"),
        tabPanels: document.querySelectorAll(".chr-tab-panel"),
        modalBackdrop: document.getElementById("chr-create-dept-modal"),
        createTriggerBtn: document.getElementById("chr-create-dept-trigger"),
        summaryTotalJobs: document.getElementById("chr-summary-total-jobs"),
        summaryTeamSize: document.getElementById("chr-summary-team-size"),
        summaryOwnerAvatar: document.getElementById("chr-summary-owner-avatar"),
        summaryOwnerName: document.getElementById("chr-summary-owner-name"),
        summaryOwnerRole: document.getElementById("chr-summary-owner-role"),
        teamCountBadge: document.getElementById("chr-team-count-badge"),
        teamMembersRoot: document.getElementById("chr-team-members-root")
    };
}

function bindFunctionalInteractiveEventListeners() {
    chrDOM.filterToggleBtn.addEventListener("click", function() {
        chrDOM.filterPanel.classList.toggle("expanded");
    });

    chrDOM.locationFilter.addEventListener("change", executeActiveFilterSearchPipeline);
    chrDOM.searchInput.addEventListener("input", executeActiveFilterSearchPipeline);

    chrDOM.refreshBtn.addEventListener("click", function() {
        chrDOM.searchInput.value = "";
        chrDOM.locationFilter.value = "All Locations";
        renderDepartmentsMasterTable(globalDepartmentsState);
    });

    chrDOM.backToMasterBtn.addEventListener("click", navigateToMasterViewScreen);

    chrDOM.tabLinks.forEach(function(tab) {
        tab.addEventListener("click", function(e) {
            var targetPanelId = e.currentTarget.getAttribute("data-target");

            chrDOM.tabLinks.forEach(function(t) { t.classList.remove("active"); });
            chrDOM.tabPanels.forEach(function(p) { p.classList.remove("active"); });

            e.currentTarget.classList.add("active");
            document.getElementById("chr-panel-" + targetPanelId).classList.add("active");
        });
    });

    chrDOM.createTriggerBtn.addEventListener("click", function() {
        if (window.openCreateDeptModal) window.openCreateDeptModal();
    });
}

function renderDepartmentsMasterTable(dataset) {
    chrDOM.rowsRoot.innerHTML = "";

    if (dataset.length === 0) {
        chrDOM.rowsRoot.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 48px; color: var(--chr-clr-txt-muted);">No matching departments found.</td></tr>';
        chrDOM.paginationCounter.textContent = "Showing 0 of 0 departments";
        return;
    }

    dataset.forEach(function(dept) {
        var tr = document.createElement("tr");
        tr.setAttribute("data-id", dept.id);

        var ownerTemplate = '<span style="color: var(--chr-clr-txt-placeholder);">No owner</span>';
        if (dept.owner) {
            ownerTemplate = '<div class="chr-table-identity-card">' +
                '<div class="chr-user-profile-avatar ' + dept.owner.avatarClass + '">' + dept.owner.initials + '</div>' +
                '<span class="chr-identity-primary-label">' + dept.owner.name + '</span>' +
                '</div>';
        }

        var teamTemplate = '<span style="color: var(--chr-clr-txt-placeholder);">No team</span>';
        if (dept.team && dept.team.length > 0) {
            teamTemplate = '<div class="chr-avatar-group-stack">';
            dept.team.forEach(function(member) {
                teamTemplate += '<div class="chr-user-profile-avatar ' + member.avatarClass + '" title="' + member.name + '">' + member.initials + '</div>';
            });
            teamTemplate += '</div>';
        }

        tr.innerHTML = '<td><input type="checkbox" class="chr-checkbox-control" onclick="event.stopPropagation();"></td>' +
            '<td><div class="chr-table-identity-card">' +
                '<div class="chr-dept-badge-icon ' + dept.avatarClass + '">' + dept.name.charAt(0) + '</div>' +
                '<div class="chr-identity-meta-stack">' +
                    '<span class="chr-identity-primary-label">' + dept.name + '</span>' +
                    (dept.description ? '<span class="chr-identity-sub-label">' + dept.description + '</span>' : '') +
                '</div></div></td>' +
            '<td><div class="chr-location-marker-text">' +
                '<i class="fa-solid fa-location-dot"></i><span>' + dept.location + '</span>' +
                '</div></td>' +
            '<td style="font-weight: 500;">' + dept.jobCount + '</td>' +
            '<td>' + ownerTemplate + '</td>' +
            '<td>' + teamTemplate + '</td>' +
            '<td style="color: var(--chr-clr-txt-muted); font-size: 13px;">' + dept.createdDate + '</td>';

        tr.addEventListener("click", function() { navigateToDetailViewProfileScreen(dept.id); });
        chrDOM.rowsRoot.appendChild(tr);
    });

    chrDOM.paginationCounter.textContent = "Showing " + dataset.length + " of " + globalDepartmentsState.length + " departments";
}

function executeActiveFilterSearchPipeline() {
    var searchString = chrDOM.searchInput.value.toLowerCase().trim();
    var targetLocation = chrDOM.locationFilter.value;

    var filteredDataset = globalDepartmentsState.filter(function(dept) {
        var matchesSearch = dept.name.toLowerCase().includes(searchString) ||
            (dept.description && dept.description.toLowerCase().includes(searchString)) ||
            dept.id.toLowerCase().includes(searchString);
        var matchesLocation = (targetLocation === "All Locations" || dept.location === targetLocation);
        return matchesSearch && matchesLocation;
    });

    renderDepartmentsMasterTable(filteredDataset);
}

function navigateToDetailViewProfileScreen(departmentId) {
    var department = globalDepartmentsState.find(function(d) { return d.id === departmentId; });
    if (!department) return;

    activeSelectedDepartment = department;

    chrDOM.detailName.textContent = department.name;
    chrDOM.detailLocation.textContent = department.location;

    chrDOM.detailAvatar.className = "chr-dept-badge-icon " + department.avatarClass;
    chrDOM.detailAvatar.textContent = department.name.charAt(0);

    chrDOM.summaryTotalJobs.textContent = department.jobCount;
    chrDOM.summaryTeamSize.textContent = department.team ? department.team.length : 0;

    if (department.owner) {
        chrDOM.summaryOwnerAvatar.className = "chr-user-profile-avatar " + department.owner.avatarClass;
        chrDOM.summaryOwnerAvatar.textContent = department.owner.initials;
        chrDOM.summaryOwnerName.textContent = department.owner.name;
        chrDOM.summaryOwnerRole.textContent = department.owner.role;
    } else {
        chrDOM.summaryOwnerAvatar.className = "chr-user-profile-avatar chr-avatar-pink";
        chrDOM.summaryOwnerAvatar.textContent = "--";
        chrDOM.summaryOwnerName.textContent = "No owner assigned";
        chrDOM.summaryOwnerRole.textContent = "Unassigned";
    }

    chrDOM.teamCountBadge.textContent = department.team ? department.team.length : 0;
    chrDOM.teamMembersRoot.innerHTML = "";

    if (department.team && department.team.length > 0) {
        department.team.forEach(function(member) {
            var memberRow = document.createElement("div");
            memberRow.className = "chr-team-row-item";
            memberRow.innerHTML = '<div class="chr-team-member-left">' +
                '<div class="chr-user-profile-avatar ' + member.avatarClass + '">' + member.initials + '</div>' +
                '<div class="chr-identity-meta-stack">' +
                    '<span class="chr-identity-primary-label">' + member.name + '</span>' +
                    '<span class="chr-identity-sub-label">' + member.role + '</span>' +
                '</div></div>' +
                '<div class="chr-team-member-email">' + member.email + '</div>';
            chrDOM.teamMembersRoot.appendChild(memberRow);
        });
    } else {
        chrDOM.teamMembersRoot.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--chr-clr-txt-muted); font-size: 14px;">No assigned team personnel records associated with this asset profile.</div>';
    }

    chrDOM.tabLinks.forEach(function(t) { t.classList.remove("active"); });
    chrDOM.tabPanels.forEach(function(p) { p.classList.remove("active"); });
    chrDOM.tabLinks[0].classList.add("active");
    chrDOM.tabPanels[0].classList.add("active");

    chrDOM.departmentsListView.style.display = "none";
    chrDOM.detailView.style.display = "block";
}

function navigateToMasterViewScreen() {
    activeSelectedDepartment = null;
    chrDOM.detailView.style.display = "none";
    chrDOM.departmentsListView.style.display = "block";
    executeActiveFilterSearchPipeline();
}

function appendUniqueFilterLocationOptionsItem(locationString) {
    var existingOptions = Array.from(chrDOM.locationFilter.options).map(function(opt) { return opt.value; });
    if (!existingOptions.includes(locationString)) {
        var newOptionNode = document.createElement("option");
        newOptionNode.value = locationString;
        newOptionNode.textContent = locationString;
        chrDOM.locationFilter.appendChild(newOptionNode);
    }
}

function initApp() {
    captureDomReferences();
    bindFunctionalInteractiveEventListeners();
    renderDepartmentsMasterTable(globalDepartmentsState);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

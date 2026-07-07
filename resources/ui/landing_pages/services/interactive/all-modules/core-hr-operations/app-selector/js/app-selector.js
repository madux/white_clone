// ═══════════════════════════════════════════════════════════
// CleonHR App Selector — app-selector.js
// Handles module selection, sidebar stack, and navigation
// ═══════════════════════════════════════════════════════════

const appModules = [
    { id: "exp", title: "Employee Experience", desc: "Complete employee experience suite with self-service and engagement tools.", theme: "pink", icon: "fa-magic", free: false, fixed: false },
    { id: "wfl", title: "Workforce Life-Cycle", desc: "Employee onboarding, offboarding, master records and lifecycle management.", theme: "teal", icon: "fa-refresh", free: false, fixed: false },
    { id: "dir", title: "Staff Directory", desc: "Comprehensive employee directory with profiles, org charts and search.", theme: "blue", icon: "fa-users", free: true, fixed: true },
    { id: "tm", title: "Time Management", desc: "Clock in/out, attendance tracking, schedules and timesheets.", theme: "blue", icon: "fa-clock-o", free: false, fixed: false },
    { id: "lm", title: "Leave Management", desc: "Leave requests, approvals, balances and policy management.", theme: "orange", icon: "fa-calendar-check-o", free: false, fixed: false },
    { id: "cm", title: "Compensation Management", desc: "Salary management, payroll, bonuses and compensation planning.", theme: "teal", icon: "fa-money", free: false, fixed: false },
    { id: "cc", title: "Company Calendar", desc: "Company-wide events, announcements and team scheduling.", theme: "purple", icon: "fa-calendar", free: false, fixed: false },
    { id: "dm", title: "Disciplinary Management", desc: "Manage disciplinary cases, warnings and compliance tracking.", theme: "orange", icon: "fa-shield", free: false, fixed: false },
    { id: "hi", title: "Health Insurance", desc: "HMO enrollment, provider management, claims and benefits tracking.", theme: "pink", icon: "fa-heart-o", free: false, fixed: false },
    { id: "doc", title: "Document Management", desc: "Enterprise document repository with version control and e-signatures.", theme: "pink", icon: "fa-file-text-o", free: false, fixed: false },
    { id: "am", title: "Asset Management", desc: "Track company assets, assignments, maintenance and depreciation.", theme: "teal", icon: "fa-cube", free: false, fixed: false },
    { id: "cd", title: "Company Documentary", desc: "Video library showcasing company culture, events and achievements.", theme: "purple", icon: "fa-film", free: false, fixed: false },
    { id: "sg", title: "Social Gallery", desc: "Photo gallery and social feed for team engagement and culture.", theme: "orange", icon: "fa-picture-o", free: false, fixed: false }
];

let selectedAppIds = ["dir"];

document.addEventListener("DOMContentLoaded", function () {
    const gridContainer = document.getElementById("chr-apps-grid");
    const stackList = document.getElementById("chr-stack-list");
    const selectedCounterText = document.getElementById("chr-selected-counter");
    const sidebarBadgeCount = document.getElementById("chr-sidebar-badge-count");
    const continueBtn = document.getElementById("chr-continue-btn");
    const validationMsg = document.getElementById("chr-val-msg");
    const stackHint = document.getElementById("chr-stack-hint");
    const selectAllBtn = document.getElementById("chr-select-all-btn");
    const backBtn = document.getElementById("chr-back-btn");

    function renderGrid() {
        gridContainer.innerHTML = "";
        appModules.forEach(function (app) {
            var isSelected = selectedAppIds.includes(app.id);
            var card = document.createElement("div");
            card.className = "chr-app-card" + (isSelected ? " selected" : "");
            card.setAttribute("data-id", app.id);
            card.setAttribute("data-theme", app.theme);

            if (app.free) {
                card.innerHTML =
                    '<span class="chr-free-pill-tag"><i class="fa fa-globe"></i> Free</span>' +
                    '<div class="chr-card-icon-box" style="background-color: #f0f9ff; color: #3b82f6;"><i class="fa ' + app.icon + '"></i></div>' +
                    "<h4>" + app.title + "</h4>" +
                    "<p>" + app.desc + "</p>" +
                    '<span class="chr-always-free-text">Always included - Free forever</span>';
            } else {
                card.innerHTML =
                    '<div class="chr-card-check-indicator"><i class="fa fa-check"></i></div>' +
                    '<div class="chr-card-icon-box" style="background-color: ' + getThemeLightBg(app.theme) + "; color: " + getThemeMainColor(app.theme) + ';">' +
                    '<i class="fa ' + app.icon + '"></i></div>' +
                    "<h4>" + app.title + "</h4>" +
                    "<p>" + app.desc + "</p>";
            }

            card.addEventListener("click", function () {
                handleSelectionToggle(app.id);
            });
            gridContainer.appendChild(card);
        });
    }

    function handleSelectionToggle(id) {
        var matchingApp = appModules.find(function (a) { return a.id === id; });
        if (matchingApp && matchingApp.fixed) return;

        if (selectedAppIds.includes(id)) {
            selectedAppIds = selectedAppIds.filter(function (appId) { return appId !== id; });
        } else {
            selectedAppIds.push(id);
        }
        updateInterface();
    }

    function updateInterface() {
        renderGrid();

        var computedAdditionsCount = selectedAppIds.filter(function (id) { return id !== "dir"; }).length;
        selectedCounterText.innerText = computedAdditionsCount + " of 12 apps selected";
        sidebarBadgeCount.innerText = selectedAppIds.length;

        stackList.innerHTML = "";

        if (selectedAppIds.length === 0) {
            stackHint.style.display = "block";
        } else {
            stackHint.style.display = "none";
            selectedAppIds.forEach(function (id) {
                var app = appModules.find(function (a) { return a.id === id; });
                if (app) {
                    var item = document.createElement("div");
                    item.className = "chr-stack-item";
                    item.setAttribute("data-theme", app.theme);

                    item.innerHTML =
                        '<i class="fa ' + app.icon + '"></i>' +
                        "<span>" + app.title + "</span>" +
                        (app.free
                            ? '<span style="margin-left:auto; font-size:10px; opacity:0.8;">Free</span>'
                            : '<button class="chr-remove-item-btn" data-id="' + app.id + '">' +
                              '<i class="fa fa-times-circle"></i></button>');
                    stackList.appendChild(item);
                }
            });
        }

        document.querySelectorAll(".chr-remove-item-btn").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                var targetId = this.getAttribute("data-id");
                handleSelectionToggle(targetId);
            });
        });

        if (computedAdditionsCount >= 1) {
            continueBtn.disabled = false;
            validationMsg.style.display = "none";
        } else {
            continueBtn.disabled = true;
            validationMsg.style.display = "block";
        }
    }

    selectAllBtn.addEventListener("click", function () {
        if (selectedAppIds.length === appModules.length) {
            selectedAppIds = ["dir"];
        } else {
            selectedAppIds = appModules.map(function (a) { return a.id; });
        }
        updateInterface();
    });

    backBtn.addEventListener("click", function () {
        var ref = document.referrer || "";
        if (ref.indexOf("workforce-lifecycle") !== -1) {
            window.location.href = "../work-force/workforce-lifecycle.html";
        } else {
            window.location.href = "../employee-experience/employee-experience.html";
        }
    });

    continueBtn.addEventListener("click", function () {
        window.location.href = "../signup/signup.html";
    });

    function getThemeLightBg(theme) {
        var maps = { pink: "#fdf2f8", teal: "#f0fdfa", blue: "#f0f9ff", orange: "#fff7ed", purple: "#f5f3ff" };
        return maps[theme] || "#f8fafc";
    }
    function getThemeMainColor(theme) {
        var maps = { pink: "#ec4899", teal: "#14b8a6", blue: "#3b82f6", orange: "#f97316", purple: "#8b5cf6" };
        return maps[theme] || "#475569";
    }

    updateInterface();
});

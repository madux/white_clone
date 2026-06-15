/**
 * Global App Engine Mock State Layer Array
 */
const INITIAL_CANDIDATES_DATASET = [
    { id: "CN-8941", name: "Theresa Webb", phone: "(208) 555-0112", email: "theresa.w@gmail.com", role: "Product Designer", experience: "4 Years", rating: 4.5, status: "Shortlisted", code: "TW" },
    { id: "CN-3214", name: "Eleanor Pena", phone: "(406) 555-0120", email: "eleanor.p@hotmail.com", role: "Software Engineer", experience: "6 Years", rating: 5.0, status: "Interviewing", code: "EP" },
    { id: "CN-7721", name: "Arlene McCoy", phone: "(303) 555-0105", email: "arlene.mccoy@yahoo.com", role: "Data Analyst", experience: "2 Years", rating: 3.5, status: "Applied", code: "AM" },
    { id: "CN-4410", name: "Albert Flores", phone: "(704) 555-0189", email: "albert.flores@aol.com", role: "Product Designer", experience: "5 Years", rating: 4.0, status: "Shortlisted", code: "AF" },
    { id: "CN-5932", name: "Savannah Nguyen", phone: "(907) 555-0143", email: "savannah.n@outlook.com", role: "Software Engineer", experience: "3 Years", rating: 4.5, status: "Interviewing", code: "SN" },
    { id: "CN-1109", name: "Kristin Watson", phone: "(252) 555-0126", email: "kristin.w@gmail.com", role: "Software Engineer", experience: "7 Years", rating: 4.8, status: "Hired", code: "KW" },
    { id: "CN-6652", name: "Courtney Henry", phone: "(308) 555-0176", email: "courtney.h@live.com", role: "Product Designer", experience: "1 Year", rating: 2.5, status: "Rejected", code: "CH" }
];

let workingDatasetState = [...INITIAL_CANDIDATES_DATASET];
let activeSelectedCandidateIds = new Set();
let currentActiveViewProfile = "list"; // Configured mapping scopes: 'list' | 'grid' | 'pipeline'

document.addEventListener("DOMContentLoaded", () => {
    // Structural Node Mappings Initialization
    initializeDashboardViews();
    registerEventHandlers();
    renderActiveViewContexts();
    
    // Process Vector Icons Engine
    if (window.lucide) {
        window.lucide.createIcons();
    }
});

/**
 * Handle Primary Pipeline View Render Switches 
 */
function initializeDashboardViews() {
    const segmentedButtons = document.querySelectorAll(".cn-view-toggle-pill");
    segmentedButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            segmentedButtons.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            currentActiveViewProfile = btn.getAttribute("data-view-target");
            
            // Switch Active Pane Visibility classes
            document.querySelectorAll(".cn-view-content-pane").forEach(pane => pane.classList.remove("active"));
            if (currentActiveViewProfile === "list") document.getElementById("viewPaneList").classList.add("active");
            if (currentActiveViewProfile === "grid") document.getElementById("viewPaneGrid").classList.add("active");
            if (currentActiveViewProfile === "pipeline") document.getElementById("viewPanePipeline").classList.add("active");
            
            renderActiveViewContexts();
        });
    });
}

/**
 * Bind DOM Control Event Triggers
 */
function registerEventHandlers() {
    // Open/Close Dropdown Filter Panel Layer Drawer
    const filterToggle = document.getElementById("filterDropdownToggleBtn");
    const filterDrawer = document.getElementById("filterDropdownDrawer");
    
    filterToggle.addEventListener("click", (e) => {
        e.stopPropagation();
        filterDrawer.classList.toggle("open");
        filterToggle.classList.toggle("active-filtering");
    });
    
    filterDrawer.addEventListener("click", (e) => e.stopPropagation());
    document.addEventListener("click", () => {
        filterDrawer.classList.remove("open");
        filterToggle.classList.remove("active-filtering");
    });

    // Apply & Reset Filters Operations
    document.getElementById("applyFiltersActionBtn").addEventListener("click", evaluateFormFilters);
    document.getElementById("resetFiltersActionBtn").addEventListener("click", resetFormFilters);

    // Live Search Keyup Binding Input Handling
    document.getElementById("candidateSearchInput").addEventListener("input", (e) => {
        const query = e.target.value.toLowerCase().trim();
        workingDatasetState = INITIAL_CANDIDATES_DATASET.filter(item => 
            item.name.toLowerCase().includes(query) || 
            item.role.toLowerCase().includes(query) ||
            item.email.toLowerCase().includes(query)
        );
        renderActiveViewContexts();
    });

    // Global Selection Table Header Tracker Checking
    const masterCheck = document.getElementById("masterSelectAllCheckbox");
    masterCheck.addEventListener("change", (e) => {
        if (e.target.checked) {
            workingDatasetState.forEach(item => activeSelectedCandidateIds.add(item.id));
        } else {
            activeSelectedCandidateIds.clear();
        }
        evaluateSelectionToastState();
        renderActiveViewContexts();
    });

    // Clear Selection Overlay Actions Triggers
    document.getElementById("clearSelectionBtn").addEventListener("click", () => {
        activeSelectedCandidateIds.clear();
        masterCheck.checked = false;
        evaluateSelectionToastState();
        renderActiveViewContexts();
    });

    // Window Modal Closing Triggers
    document.getElementById("closeModalWindowBtn").addEventListener("click", toggleModalBackdropWindow);
    document.getElementById("candidateDetailsModal").addEventListener("click", (e) => {
        if (e.target === document.getElementById("candidateDetailsModal")) toggleModalBackdropWindow();
    });
}

/**
 * Dispatch Hub for Render Loop Passes
 */
function renderActiveViewContexts() {
    if (currentActiveViewProfile === "list") renderListTableStructure();
    if (currentActiveViewProfile === "grid") renderFlexGridStructure();
    if (currentActiveViewProfile === "pipeline") renderKanbanWorkflowStructure();
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

/**
 * View 1: Data Table Template Layout Generation Loop
 */
function renderListTableStructure() {
    const container = document.getElementById("candidatesTableBody");
    container.innerHTML = "";

    if (workingDatasetState.length === 0) {
        container.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 32px; color: #64748B;">No applicant data entries match active queries.</td></tr>`;
        return;
    }

    workingDatasetState.forEach(item => {
        const isChecked = activeSelectedCandidateIds.has(item.id);
        const tr = document.createElement("tr");
        if (isChecked) tr.classList.add("row-selected");

        tr.innerHTML = `
            <td class="cn-col-checkbox cn-cell-pinned-left-1">
                <label class="cn-cell-checkbox-container">
                    <input type="checkbox" class="cn-row-selector-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                    <span class="cn-custom-checkbox-checkmark"></span>
                </label>
            </td>
            <td class="cn-col-candidate cn-cell-pinned-left-2">
                <div class="cn-candidate-meta-cell">
                    <div class="cn-avatar-circle-sm">${item.code}</div>
                    <div class="cn-identity-text-box">
                        <span class="cn-candidate-click-trigger" onclick="bindTargetProfileDossier('${item.id}')">${item.name}</span>
                        <span class="cn-cell-subtext">${item.id}</span>
                    </div>
                </div>
            </td>
            <td class="cn-col-phone cn-cell-pinned-left-3">${item.phone}</td>
            <td class="cn-col-email cn-cell-pinned-left-4">${item.email}</td>
            <td class="cn-col-role">${item.role}</td>
            <td class="cn-col-experience">${item.experience}</td>
            <td class="cn-col-rating">${renderStarRatingElements(item.rating)}</td>
            <td class="cn-col-status"><span class="cn-status-badge-indicator-pill ${item.status.toLowerCase()}">${item.status}</span></td>
            <td class="cn-col-date">12 May 2026</td>
            <td class="cn-col-actions cn-cell-pinned-right-end">
                <button class="cn-row-options-dropdown-trigger-btn"><i data-lucide="more-vertical"></i></button>
            </td>
        `;

        // Selection Listener Injection Inside Render Generation Block
        tr.querySelector(".cn-row-selector-checkbox").addEventListener("change", (e) => {
            if (e.target.checked) {
                activeSelectedCandidateIds.add(item.id);
            } else {
                activeSelectedCandidateIds.delete(item.id);
                document.getElementById("masterSelectAllCheckbox").checked = false;
            }
            evaluateSelectionToastState();
            renderActiveViewContexts();
        });

        container.appendChild(tr);
    });
}

/**
 * View 2: Flex Profile Cards Functional Loop Renderer
 */
function renderFlexGridStructure() {
    const container = document.getElementById("candidatesGridBody");
    container.innerHTML = "";

    workingDatasetState.forEach(item => {
        const isChecked = activeSelectedCandidateIds.has(item.id);
        const card = document.createElement("div");
        card.className = "cn-grid-profile-card-node";
        
        card.innerHTML = `
            <div class="cn-card-absolute-checkbox-wrapper">
                <label class="cn-cell-checkbox-container">
                    <input type="checkbox" class="cn-card-selector-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''}>
                    <span class="cn-custom-checkbox-checkmark"></span>
                </label>
            </div>
            <div class="cn-grid-avatar-circle-md">${item.code}</div>
            <h3 class="cn-grid-card-name">${item.name}</h3>
            <p class="cn-grid-card-role-lbl">${item.role}</p>
            
            <div class="cn-grid-card-metrics-divider-row">
                <div class="cn-grid-meta-metric-cell">
                    <span class="val">${item.experience}</span>
                    <span class="lbl">Exp</span>
                </div>
                <div class="cn-grid-meta-metric-cell">
                    <span class="val">${item.rating}</span>
                    <span class="lbl">Rating</span>
                </div>
            </div>

            <div class="cn-grid-card-footer-flex-row">
                <span class="cn-status-badge-indicator-pill ${item.status.toLowerCase()}">${item.status}</span>
                <span class="cn-cell-subtext">${item.id}</span>
            </div>
        `;

        // Prevent deep card trigger fires if users hit the item selection box targets
        card.querySelector(".cn-cell-checkbox-container").addEventListener("click", (e) => e.stopPropagation());
        card.querySelector(".cn-card-selector-checkbox").addEventListener("change", (e) => {
            if (e.target.checked) {
                activeSelectedCandidateIds.add(item.id);
            } else {
                activeSelectedCandidateIds.delete(item.id);
            }
            evaluateSelectionToastState();
            renderActiveViewContexts();
        });

        // Open details overlay on generic layout bounding card node hits
        card.addEventListener("click", () => bindTargetProfileDossier(item.id));
        container.appendChild(card);
    });
}

/**
 * View 3: Kanban Pipeline Phase Workspaces Render Engine Pass
 */
function renderKanbanWorkflowStructure() {
    const stages = ["Applied", "Shortlisted", "Interviewing", "Hired"];
    
    // Clear child lists inside mapping targets
    stages.forEach(stage => {
        document.getElementById(`lane${stage}`).innerHTML = "";
        document.getElementById(`count-${stage}`).textContent = "0";
    });

    stages.forEach(stage => {
        const laneContainer = document.getElementById(`lane${stage}`);
        const candidatesInStage = workingDatasetState.filter(item => item.status === stage);
        
        document.getElementById(`count-${stage}`).textContent = candidatesInStage.length;

        candidatesInStage.forEach(item => {
            const el = document.createElement("div");
            el.className = "cn-pipeline-card-component";
            el.innerHTML = `
                <div class="cn-pipe-card-top-row">
                    <div>
                        <h4 class="cn-pipe-card-name-title">${item.name}</h4>
                        <p class="cn-pipe-card-role-sub">${item.role}</p>
                    </div>
                    <span class="cn-cell-subtext">${item.id}</span>
                </div>
                <div class="cn-pipe-card-bottom-meta">
                    <span>Exp: <strong>${item.experience}</strong></span>
                    <span>★ ${item.rating}</span>
                </div>
            `;
            el.addEventListener("click", () => bindTargetProfileDossier(item.id));
            laneContainer.appendChild(el);
        });
    });
}

/**
 * UI State Utilities: Render SVGs for rating components
 */
function renderStarRatingElements(rating) {
    let html = "";
    const fullStars = Math.floor(rating);
    const hasHalf = rating % 1 !== 0;

    for (let i = 1; i <= 5; i++) {
        if (i <= fullStars) {
            html += `<i data-lucide="star" style="fill: currentColor;"></i>`;
        } else if (i === fullStars + 1 && hasHalf) {
            html += `<i data-lucide="star-half" style="fill: currentColor;"></i>`;
        } else {
            html += `<i data-lucide="star" class="star-empty"></i>`;
        }
    }
    return `<div class="cn-star-rating-row">${html}</div>`;
}

/**
 * Modal Data Binding Pipeline Loader Function
 */
function bindTargetProfileDossier(id) {
    const targetCandidate = INITIAL_CANDIDATES_DATASET.find(c => c.id === id);
    if (!targetCandidate) return;

    document.getElementById("modalDisplayId").textContent = targetCandidate.id;
    document.getElementById("modalDisplayName").textContent = targetCandidate.name;
    document.getElementById("modalDisplayRole").textContent = targetCandidate.role;
    document.getElementById("modalDisplayPhone").textContent = targetCandidate.phone;
    document.getElementById("modalDisplayEmail").textContent = targetCandidate.email;
    document.getElementById("modalDisplayExperience").textContent = targetCandidate.experience;
    document.getElementById("modalDisplayAvatar").textContent = targetCandidate.code;
    
    const statusPill = document.getElementById("modalDisplayStatus");
    statusPill.className = `cn-status-badge-indicator-pill ${targetCandidate.status.toLowerCase()}`;
    statusPill.textContent = targetCandidate.status;

    const ratingBox = document.getElementById("modalDisplayRating");
    ratingBox.innerHTML = renderStarRatingElements(targetCandidate.rating);

    toggleModalBackdropWindow();
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function toggleModalBackdropWindow() {
    const modal = document.getElementById("candidateDetailsModal");
    const isVisible = modal.style.display === "flex";
    modal.style.display = isVisible ? "none" : "flex";
}

/**
 * Process Filtering form structures state evaluations
 */
function evaluateFormFilters() {
    const statusValue = document.getElementById("filterStatus").value;
    const expValue = document.getElementById("filterExperience").value;
    const roleValue = document.getElementById("filterRole").value;
    const ratingValue = document.getElementById("filterRating").value;

    workingDatasetState = INITIAL_CANDIDATES_DATASET.filter(item => {
        let match = true;
        if (statusValue !== "all" && item.status !== statusValue) match = false;
        if (roleValue !== "all" && item.role !== roleValue) match = false;
        
        if (expValue !== "all") {
            const numericYears = parseInt(item.experience);
            if (expValue === "Junior" && numericYears > 2) match = false;
            if (expValue === "Mid-Level" && (numericYears < 3 || numericYears > 5)) match = false;
            if (expValue === "Senior" && numericYears <= 5) match = false;
        }

        if (ratingValue !== "all" && item.rating < parseFloat(ratingValue)) match = false;

        return match;
    });

    renderActiveViewContexts();
    document.getElementById("filterDropdownDrawer").classList.remove("open");
    document.getElementById("filterDropdownToggleBtn").classList.remove("active-filtering");
}

function resetFormFilters() {
    document.getElementById("filterStatus").value = "all";
    document.getElementById("filterExperience").value = "all";
    document.getElementById("filterRole").value = "all";
    document.getElementById("filterRating").value = "all";
    
    workingDatasetState = [...INITIAL_CANDIDATES_DATASET];
    renderActiveViewContexts();
}

/**
 * Track Selection Sets state metrics to adjust global bottom toast panels
 */
function evaluateSelectionToastState() {
    const toast = document.getElementById("bulkActionToast");
    const countBadge = document.getElementById("selectedCountBadge");
    const activeSize = activeSelectedCandidateIds.size;

    if (activeSize > 0) {
        countBadge.textContent = activeSize;
        toast.classList.add("visible");
    } else {
        toast.classList.remove("visible");
    }
}
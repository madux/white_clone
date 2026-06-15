const INITIAL_CANDIDATES_DATASET = [
    { id: "CN-8941", name: "Theresa Webb", phone: "(208) 555-0112", email: "theresa.w@gmail.com", role: "Product Designer", experience: "4 Years", rating: 4.5, status: "Shortlisted", code: "TW", location: "Lagos, Nigeria", source: "LinkedIn", sourcedBy: "Michael Rodriguez", skills: ["Figma", "UI Design", "Prototyping", "User Research"], appliedDate: "2 weeks ago" },
    { id: "CN-3214", name: "Eleanor Pena", phone: "(406) 555-0120", email: "eleanor.p@hotmail.com", role: "Software Engineer", experience: "6 Years", rating: 5.0, status: "Interviewing", code: "EP", location: "Abuja, Nigeria", source: "Career Site", sourcedBy: "Direct Application", skills: ["JavaScript", "React", "Node.js", "TypeScript", "AWS"], appliedDate: "1 week ago" },
    { id: "CN-7721", name: "Arlene McCoy", phone: "(303) 555-0105", email: "arlene.mccoy@yahoo.com", role: "Data Analyst", experience: "2 Years", rating: 3.5, status: "Applied", code: "AM", location: "Port Harcourt, Nigeria", source: "Referral", sourcedBy: "Jessica Park", skills: ["Python", "SQL", "Tableau", "Statistics", "Excel"], appliedDate: "5 days ago" },
    { id: "CN-4410", name: "Albert Flores", phone: "(704) 555-0189", email: "albert.flores@aol.com", role: "Product Designer", experience: "5 Years", rating: 4.0, status: "Shortlisted", code: "AF", location: "Accra, Ghana", source: "LinkedIn", sourcedBy: "David Kim", skills: ["Sketch", "InVision", "Design Systems", "HTML/CSS"], appliedDate: "1 week ago" },
    { id: "CN-5932", name: "Savannah Nguyen", phone: "(907) 555-0143", email: "savannah.n@outlook.com", role: "Software Engineer", experience: "3 Years", rating: 4.5, status: "Interviewing", code: "SN", location: "Nairobi, Kenya", source: "Company Website", sourcedBy: "Direct Application", skills: ["Java", "Spring Boot", "Microservices", "Docker", "Kubernetes"], appliedDate: "3 days ago" },
    { id: "CN-1109", name: "Kristin Watson", phone: "(252) 555-0126", email: "kristin.w@gmail.com", role: "Software Engineer", experience: "7 Years", rating: 4.8, status: "Hired", code: "KW", location: "Cape Town, SA", source: "Referral", sourcedBy: "Sarah Chen", skills: ["Python", "Django", "PostgreSQL", "Redis", "CI/CD"], appliedDate: "1 month ago" },
    { id: "CN-6652", name: "Courtney Henry", phone: "(308) 555-0176", email: "courtney.h@live.com", role: "Product Designer", experience: "1 Year", rating: 2.5, status: "Rejected", code: "CH", location: "Lagos, Nigeria", source: "LinkedIn", sourcedBy: "Michael Rodriguez", skills: ["Photoshop", "Illustrator", "Wireframing"], appliedDate: "3 weeks ago" }
];

let workingDatasetState = [...INITIAL_CANDIDATES_DATASET];
let activeSelectedCandidateIds = new Set();
let currentActiveViewProfile = "list"; // Configured mapping scopes: 'list' | 'grid' | 'pipeline'

document.addEventListener("DOMContentLoaded", () => {
    initializeDashboardViews();
    registerEventHandlers();
    updateMetricCardValues();
    renderActiveViewContexts();
    
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

    // Add Candidate button — opens the modal backdrop
    document.getElementById("addCandidateBtn").addEventListener("click", () => {
        const backdrop = document.getElementById("candidateModalBackdrop");
        if (backdrop) backdrop.style.display = "flex";
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
    
    // Metric card click handlers
    document.querySelectorAll('.cn-metric-card-item').forEach(card => {
        card.addEventListener('click', (e) => {
            e.stopPropagation();
            const metric = card.dataset.metric;
            openMetricCandidatesModal(metric);
        });
    });
    
    // Tab navigation for candidate detail view
    document.querySelectorAll('.tab-item').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
        });
    });

    // Copy button for quick info
    document.addEventListener('click', (e) => {
        const copyBtn = e.target.closest('.quick-info-copy');
        if (copyBtn) {
            const key = copyBtn.dataset.copy;
            const val = key === 'email' ? document.getElementById('detailDisplayEmail').textContent.trim() :
                        key === 'phone' ? document.getElementById('detailDisplayPhone').textContent.trim() : '';
            if (val && navigator.clipboard) {
                navigator.clipboard.writeText(val);
                const original = copyBtn.innerHTML;
                copyBtn.innerHTML = '<svg data-lucide="check" style="color:#22C55E;width:11px;height:11px"></svg>';
                if (window.lucide) window.lucide.createIcons();
                setTimeout(() => { copyBtn.innerHTML = original; if (window.lucide) window.lucide.createIcons(); }, 1500);
            }
        }
    });

    // Popover event delegation
    document.addEventListener("click", (e) => {
        const popoverHeader = e.target.closest(".cn-popover-header");
        if (popoverHeader) {
            const content = popoverHeader.nextElementSibling;
            const icon = popoverHeader.querySelector("i:last-child");
            content.classList.toggle("show");
            icon.style.transform = content.classList.contains("show") ? "rotate(180deg)" : "rotate(0deg)";
            return;
        }
        
        const popover = document.querySelector(".cn-card-popover");
        if (popover && !e.target.closest(".cn-card-popover") && !e.target.closest(".cn-card-options-btn")) {
            hidePopover();
        }
    });
}

/**
 * Dispatch Hub for Render Loop Passes
 */
function renderActiveViewContexts() {
    if (currentActiveViewProfile === "list") renderListTableStructure();
    if (currentActiveViewProfile === "grid") renderFlexGridStructure();
    if (currentActiveViewProfile === "pipeline") renderKanbanWorkflowStructure();
    updateMetricCardValues();
    
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
                        <span class="cn-candidate-click-trigger" onclick="showCandidateDashboard('${item.id}')">${item.name}</span>
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
                <div class="cn-card-options-wrapper">
                    <button class="cn-card-options-btn" data-card-id="${item.id}"><i data-lucide="more-vertical"></i></button>
                </div>
            </td>
        `;

// Attach popover click to table row options button
tr.querySelector(".cn-card-options-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    showPopover(item.id, e.currentTarget, e);
});

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
        
        // Create checkbox wrapper
        const checkboxWrapper = document.createElement("div");
        checkboxWrapper.className = "cn-card-absolute-checkbox-wrapper";
        
        const checkboxLabel = document.createElement("label");
        checkboxLabel.className = "cn-cell-checkbox-container";
        
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.className = "cn-card-selector-checkbox";
        checkbox.setAttribute("data-id", item.id);
        checkbox.checked = isChecked;
        
        const checkboxMark = document.createElement("span");
        checkboxMark.className = "cn-custom-checkbox-checkmark";
        
        checkboxLabel.appendChild(checkbox);
        checkboxLabel.appendChild(checkboxMark);
        checkboxWrapper.appendChild(checkboxLabel);
        card.appendChild(checkboxWrapper);
        
        // Create avatar
        const avatar = document.createElement("div");
        avatar.className = "cn-grid-avatar-circle-md";
        avatar.textContent = item.code;
        card.appendChild(avatar);
        
        // Create name
        const name = document.createElement("h3");
        name.className = "cn-grid-card-name";
        name.textContent = item.name;
        card.appendChild(name);
        
        // Create role
        const role = document.createElement("p");
        role.className = "cn-grid-card-role-lbl";
        role.textContent = item.role;
        card.appendChild(role);
        
        // Create metrics row
        const metricsRow = document.createElement("div");
        metricsRow.className = "cn-grid-card-metrics-divider-row";
        
        const expCell = createMetricCell(item.experience, "Exp");
        const ratingCell = createMetricCell(item.rating, "Rating");
        
        metricsRow.appendChild(expCell);
        metricsRow.appendChild(ratingCell);
        card.appendChild(metricsRow);
        
        // Create footer
        const footer = document.createElement("div");
        footer.className = "cn-grid-card-footer-flex-row";
        
        const statusBadge = document.createElement("span");
        statusBadge.className = `cn-status-badge-indicator-pill ${item.status.toLowerCase()}`;
        statusBadge.textContent = item.status;
        
        const idText = document.createElement("span");
        idText.className = "cn-cell-subtext";
        idText.textContent = item.id;
        
        footer.appendChild(statusBadge);
        footer.appendChild(idText);
        card.appendChild(footer);
        
        // Add options button (3-dot popover trigger)
        const optionsBtn = createOptionsButton(item.id);
        card.appendChild(optionsBtn);
        
        // Event listeners
        checkboxLabel.addEventListener("click", (e) => e.stopPropagation());
        checkbox.addEventListener("change", (e) => {
            if (e.target.checked) {
                activeSelectedCandidateIds.add(item.id);
            } else {
                activeSelectedCandidateIds.delete(item.id);
            }
            evaluateSelectionToastState();
            renderActiveViewContexts();
        });
        
        // Main card click handler — opens inline detail dashboard
        card.addEventListener("click", () => showCandidateDashboard(item.id));
        
        container.appendChild(card);
    });
}

/**
 * Helper function to create metric cells
 */
function createMetricCell(value, label) {
    const cell = document.createElement("div");
    cell.className = "cn-grid-meta-metric-cell";
    
    const val = document.createElement("span");
    val.className = "val";
    val.textContent = value;
    
    const lbl = document.createElement("span");
    lbl.className = "lbl";
    lbl.textContent = label;
    
    cell.appendChild(val);
    cell.appendChild(lbl);
    return cell;
}

/**
 * Create options button for card
 */
function createOptionsButton(cardId) {
    const wrapper = document.createElement("div");
    wrapper.className = "cn-card-options-wrapper";
    
    const btn = document.createElement("button");
    btn.className = "cn-card-options-btn";
    btn.setAttribute("data-card-id", cardId);
    btn.innerHTML = '<i data-lucide="more-vertical"></i>';
    
    btn.addEventListener("click", (e) => {
        e.stopPropagation();
        showPopover(cardId, btn, e);
    });
    
    wrapper.appendChild(btn);
    return wrapper;
}

let activePopoverId = null;

function showPopover(cardId, triggerBtn, event) {
    hidePopover();
    if (activePopoverId === cardId) return;
    
    const candidate = INITIAL_CANDIDATES_DATASET.find(c => c.id === cardId);
    if (!candidate) return;
    
    const popover = document.createElement("div");
    popover.className = "cn-card-popover";
    popover.id = `popover-${cardId}`;
    
    const rect = triggerBtn.getBoundingClientRect();
    const popoverW = 240;
    const popoverH = 360;
    
    // Use click coordinates for vertical position (avoids sticky-cell offset issues)
    const clickY = event ? event.clientY : rect.top;
    const spaceBelow = window.innerHeight - clickY;
    const spaceRight = window.innerWidth - rect.right;
    
    let top, left;
    if (spaceBelow > popoverH || spaceBelow > 200) {
        top = clickY + 8;
    } else {
        top = clickY - popoverH - 8;
    }
    if (spaceRight > popoverW) {
        left = rect.right - popoverW + 20;
    } else {
        left = Math.max(8, rect.left - popoverW + 20);
    }
    
    popover.style.top = top + "px";
    popover.style.left = left + "px";
    
    popover.innerHTML = `
        <div class="cn-popover-arrow"></div>
        <div class="cn-popover-section">
            <button class="cn-popover-header" data-section="primary-${cardId}">
                <i data-lucide="user-check"></i><span>Primary</span><i data-lucide="chevron-down"></i>
            </button>
            <div class="cn-popover-content" id="popover-primary-${cardId}">
                <button class="cn-popover-item" onclick="showCandidateDashboard('${candidate.id}')">
                    <i data-lucide="eye"></i><span>View Profile</span>
                </button>
                <button class="cn-popover-item">${'<i data-lucide="edit-3"></i><span>Edit Candidate</span>'}</button>
            </div>
        </div>
        <div class="cn-popover-section">
            <button class="cn-popover-header" data-section="communication-${cardId}">
                <i data-lucide="mail"></i><span>Communication</span><i data-lucide="chevron-down"></i>
            </button>
            <div class="cn-popover-content" id="popover-communication-${cardId}">
                <button class="cn-popover-item" onclick="sendEmail('${candidate.email}')">
                    <i data-lucide="mail"></i><span>Send Email</span>
                </button>
                <button class="cn-popover-item">
                    <i data-lucide="calendar"></i><span>Schedule Interview</span>
                </button>
            </div>
        </div>
        <div class="cn-popover-section">
            <button class="cn-popover-header" data-section="management-${cardId}">
                <i data-lucide="briefcase"></i><span>Management</span><i data-lucide="chevron-down"></i>
            </button>
            <div class="cn-popover-content" id="popover-management-${cardId}">
                <button class="cn-popover-item" onclick="assignToJob('${candidate.id}')">
                    <i data-lucide="tag"></i><span>Assign to Job</span>
                </button>
                <button class="cn-popover-item">
                    <i data-lucide="users"></i><span>Assign Recruiter</span>
                </button>
            </div>
        </div>
        <div class="cn-popover-section">
            <button class="cn-popover-header" data-section="sharing-${cardId}">
                <i data-lucide="share-2"></i><span>Sharing & Export</span><i data-lucide="chevron-down"></i>
            </button>
            <div class="cn-popover-content" id="popover-sharing-${cardId}">
                <button class="cn-popover-item" onclick="shareProfile('${candidate.id}')">
                    <i data-lucide="share-2"></i><span>Share Profile</span>
                </button>
                <button class="cn-popover-item" onclick="exportToPDF('${candidate.id}')">
                    <i data-lucide="file-text"></i><span>Export to PDF</span>
                </button>
                <button class="cn-popover-item" onclick="addToTalentPool('${candidate.id}')">
                    <i data-lucide="star"></i><span>Add to Talent Pool</span>
                </button>
            </div>
        </div>
        <div class="cn-popover-section">
            <button class="cn-popover-header" data-section="destructive-${cardId}">
                <i data-lucide="alert-triangle"></i><span>Destructive</span><i data-lucide="chevron-down"></i>
            </button>
            <div class="cn-popover-content" id="popover-destructive-${cardId}">
                <button class="cn-popover-item destructive" onclick="rejectCandidate('${candidate.id}')">
                    <i data-lucide="x-circle"></i><span>Reject Candidate</span>
                </button>
                <button class="cn-popover-item destructive" onclick="deleteCandidate('${candidate.id}')">
                    <i data-lucide="trash-2"></i><span>Delete Candidate</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(popover);
    activePopoverId = cardId;
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function hidePopover() {
    const existing = document.querySelector(".cn-card-popover");
    if (existing) {
        existing.remove();
    }
    activePopoverId = null;
}

window.sendEmail = function(email) { console.log("Send email to:", email); };
window.assignToJob = function(id) { console.log("Assign to job:", id); };
window.shareProfile = function(id) { console.log("Share profile:", id); };
window.exportToPDF = function(id) { console.log("Export PDF:", id); };
window.addToTalentPool = function(id) { console.log("Add to talent pool:", id); };
window.rejectCandidate = function(id) { console.log("Reject candidate:", id); };
window.deleteCandidate = function(id) { console.log("Delete candidate:", id); };

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
            el.addEventListener("click", () => showCandidateDashboard(item.id));
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

function updateMetricCardValues() {
    const total = workingDatasetState.length;
    const shortlisted = workingDatasetState.filter(c => c.status === "Shortlisted").length;
    const interviewing = workingDatasetState.filter(c => c.status === "Interviewing").length;
    const hired = workingDatasetState.filter(c => c.status === "Hired").length;
    
    const cards = document.querySelectorAll('.cn-metric-card-item');
    if (cards.length >= 4) {
        cards[0].querySelector('.cn-metric-value-display').textContent = total;
        cards[1].querySelector('.cn-metric-value-display').textContent = shortlisted;
        cards[2].querySelector('.cn-metric-value-display').textContent = interviewing;
        cards[3].querySelector('.cn-metric-value-display').textContent = hired;
    }
}

function showCandidateDashboard(id) {
    const targetCandidate = INITIAL_CANDIDATES_DATASET.find(c => c.id === id);
    if (!targetCandidate) return;
    
    document.getElementById("detailDisplayId").textContent = targetCandidate.id;
    document.getElementById("detailDisplayName").textContent = targetCandidate.name;
    document.getElementById("detailDisplayRole").textContent = targetCandidate.role;
    document.getElementById("detailDisplayPhone").textContent = targetCandidate.phone;
    document.getElementById("detailDisplayEmail").textContent = targetCandidate.email;
    document.getElementById("detailDisplayExperience").textContent = targetCandidate.experience;
    document.getElementById("detailDisplayAvatar").textContent = targetCandidate.code;
    document.getElementById("detailDisplayLocation").textContent = targetCandidate.location || "—";
    document.getElementById("detailDisplaySource").textContent = targetCandidate.source || "—";
    document.getElementById("detailDisplaySourcedBy").textContent = targetCandidate.sourcedBy || "—";
    document.getElementById("detailDisplayAppliedDate").textContent = targetCandidate.appliedDate || "—";
    
    const statusPill = document.getElementById("detailDisplayStatus");
    statusPill.textContent = targetCandidate.status;
    const statusColors = {
        applied: 'rgba(100,116,139,0.55)',
        shortlisted: 'rgba(37,99,235,0.55)',
        interviewing: 'rgba(217,119,6,0.55)',
        hired: 'rgba(22,163,74,0.55)',
        rejected: 'rgba(239,68,68,0.55)'
    };
    statusPill.style.background = statusColors[targetCandidate.status.toLowerCase()] || statusColors.applied;
    
    const ratingBox = document.getElementById("detailDisplayRating");
    const stars = Math.round(targetCandidate.rating);
    const starStr = '★'.repeat(Math.min(stars, 5)) + '☆'.repeat(Math.max(5 - stars, 0));
    ratingBox.textContent = `${starStr} ${targetCandidate.rating} Star Candidate`;
    
    document.getElementById("candidateListingView").style.display = "none";
    document.getElementById("candidateDetailView").style.display = "block";
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function hideCandidateDashboard() {
    document.getElementById("candidateDetailView").style.display = "none";
    document.getElementById("candidateListingView").style.display = "block";
    renderActiveViewContexts();
}

function bindTargetProfileDossier(id) {
    showCandidateDashboard(id);
}

function openMetricCandidatesModal(metric) {
    const modal = document.getElementById("candidateDetailsModal");
    const container = document.getElementById("metricCandidatesList");
    const titleEl = document.getElementById("metricModalTitle");
    
    container.innerHTML = "";
    
    let candidates, title;
    switch (metric) {
        case "total":
            candidates = workingDatasetState;
            title = "All Candidates";
            break;
        case "shortlisted":
            candidates = workingDatasetState.filter(c => c.status === "Shortlisted");
            title = "Shortlisted Candidates";
            break;
        case "interviewing":
            candidates = workingDatasetState.filter(c => c.status === "Interviewing");
            title = "Interviewing Candidates";
            break;
        case "hired":
            candidates = workingDatasetState.filter(c => c.status === "Hired");
            title = "Hired Candidates";
            break;
        default:
            candidates = workingDatasetState;
            title = "All Candidates";
    }
    
    titleEl.textContent = title;
    
    const subtitle = container.previousElementSibling.querySelector(".cn-metric-modal-subtitle");
    if (subtitle) {
        subtitle.textContent = `Showing all ${candidates.length} candidate${candidates.length !== 1 ? 's' : ''}`;
    }
    
    if (candidates.length === 0) {
        container.innerHTML = '<div class="cn-metric-modal-empty">No candidates found in this category.</div>';
        modal.style.display = "flex";
        return;
    }
    
    candidates.forEach(c => {
        const card = document.createElement("div");
        card.className = "cn-metric-modal-candidate-card";
        card.onclick = function() {
            modal.style.display = "none";
            showCandidateDashboard(c.id);
        };
        
        const skillsHtml = c.skills && c.skills.length 
            ? c.skills.map(s => `<span class="cn-tag-pill-node">${s}</span>`).join("")
            : "";
        
        card.innerHTML = `
            <div class="cn-metric-card-header">
                <div class="cn-metric-card-avatar">${c.code}</div>
                <div class="cn-metric-card-info">
                    <h4 class="cn-metric-card-name">${c.name}</h4>
                    <p class="cn-metric-card-role">${c.role}</p>
                </div>
                <span class="cn-status-badge-indicator-pill ${c.status.toLowerCase()}">${c.status}</span>
            </div>
            <div class="cn-metric-card-row">
                <span class="cn-metric-card-label"><i data-lucide="mail"></i> ${c.email}</span>
                <span class="cn-metric-card-label"><i data-lucide="phone"></i> ${c.phone}</span>
            </div>
            <div class="cn-metric-card-row">
                <span class="cn-metric-card-label"><i data-lucide="map-pin"></i> ${c.location || "—"}</span>
                <span class="cn-metric-card-label"><i data-lucide="clock"></i> ${c.appliedDate || "—"}</span>
            </div>
            <div class="cn-metric-card-row">
                <span class="cn-metric-card-label"><i data-lucide="link"></i> ${c.source || "—"}</span>
                <span class="cn-metric-card-label"><i data-lucide="user"></i> Sourced by ${c.sourcedBy || "—"}</span>
            </div>
            <div class="cn-metric-card-row">
                <span class="cn-metric-card-label"><i data-lucide="briefcase"></i> ${c.experience}</span>
            </div>
            ${skillsHtml ? `<div class="cn-metric-card-skills">${skillsHtml}</div>` : ""}
        `;
        
        container.appendChild(card);
    });
    
    modal.style.display = "flex";
    
    if (window.lucide) {
        window.lucide.createIcons();
    }
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

/**
 * Bulk action functions
 */
function moveToStage() {
    console.log("Move to stage for candidates:", [...activeSelectedCandidateIds]);
}

function sendBulkEmail() {
    console.log("Send email to candidates:", [...activeSelectedCandidateIds]);
}

function exportCandidates() {
    console.log("Export candidates:", [...activeSelectedCandidateIds]);
}

function deleteSelectedCandidates() {
    if (confirm(`Delete ${activeSelectedCandidateIds.size} candidate(s)?`)) {
        workingDatasetState = workingDatasetState.filter(item => !activeSelectedCandidateIds.has(item.id));
        activeSelectedCandidateIds.clear();
        document.getElementById("masterSelectAllCheckbox").checked = false;
        evaluateSelectionToastState();
        renderActiveViewContexts();
    }
}
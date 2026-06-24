const OH_OFFERS_DATASET = [
    { id: 1, candidate: "Blessing Okoro", email: "blessing.okoro@gmail.com", avatarColor: "#E60067", job: "Sales Executive", dept: "Sales", salary: "₦350,000", contract: "permanent", status: "draft", sentDate: "Not sent", expiry: "—", recruiter: "Emeka", options: ["edit", "delete"] },
    { id: 2, candidate: "Fatima Ibrahim", email: "fatima.ibrahim@gmail.com", avatarColor: "#9C27B0", job: "Marketing Manager", dept: "Marketing", salary: "₦500,000", contract: "permanent", status: "viewed", sentDate: "Mar 20, 2026", timePassed: "02 days ago", expiry: "Expired", recruiter: "Emeka", options: ["withdraw"] },
    { id: 3, candidate: "Yusuf Mohammed", email: "yusuf.mohammed@gmail.com", avatarColor: "#009688", job: "Backend Developer", dept: "Engineering", salary: "₦500,000", contract: "contract", status: "pending", sentDate: "Not sent", expiry: "—", recruiter: "Emeka", options: ["edit", "delete"] },
    { id: 4, candidate: "Hauwa Yusuf", email: "hauwa.yusuf@gmail.com", avatarColor: "#FF9800", job: "Business Analyst", dept: "Operations", salary: "₦420,000", contract: "permanent", status: "sent", sentDate: "Mar 20, 2026", timePassed: "03 days ago", expiry: "Expired", recruiter: "Emeka", options: ["withdraw"] },
    { id: 5, candidate: "Chinedu Obi", email: "chinedu.obi@gmail.com", avatarColor: "#E91E63", job: "Product Manager", dept: "Product", salary: "₦550,000", contract: "permanent", status: "sent", sentDate: "Mar 19, 2026", timePassed: "04 days ago", expiry: "Expired", recruiter: "Emeka", options: ["withdraw"] },
    { id: 6, candidate: "David Nwankwo", email: "david.nwankwo@gmail.com", avatarColor: "#3F51B5", job: "Content Writer", dept: "Marketing", salary: "₦200,000", contract: "part_time", status: "sent", sentDate: "Mar 18, 2026", timePassed: "05 days ago", expiry: "Expired", recruiter: "Emeka", options: ["withdraw"] },
    { id: 7, candidate: "Ibrahim Suleiman", email: "ibrahim.suleiman@gmail.com", avatarColor: "#4CAF50", job: "Chief Technology Officer", dept: "Executive", salary: "₦2,500,000", contract: "permanent", status: "sent", sentDate: "Mar 16, 2026", timePassed: "07 days ago", expiry: "Expired", recruiter: "Emeka", options: ["withdraw"] },
    { id: 8, candidate: "Aisha Bello", email: "aisha.bello@gmail.com", avatarColor: "#9C27B0", job: "Senior Software Engineer", dept: "Engineering", salary: "₦600,000", contract: "permanent", status: "countered", sentDate: "Mar 16, 2026", timePassed: "07 days ago", expiry: "—", recruiter: "Emeka", actionRequired: true, options: ["edit", "withdraw"] },
    { id: 9, candidate: "Chiamaka Okonkwo", email: "chiamaka.okonkwo@gmail.com", avatarColor: "#00BCD4", job: "Software Engineering Intern", dept: "Engineering", salary: "₦150,000", contract: "internship", status: "accepted", sentDate: "Mar 11, 2026", timePassed: "12 days ago", expiry: "—", recruiter: "Emeka", options: [] },
    { id: 10, candidate: "Kunle Bamidele", email: "kunle.bamidele@gmail.com", avatarColor: "#FF5722", job: "Frontend Developer", dept: "Engineering", salary: "₦550,000", contract: "permanent", status: "accepted", sentDate: "Mar 9, 2026", timePassed: "14 days ago", expiry: "—", recruiter: "Emeka", options: [] },
    { id: 11, candidate: "Oluwaseun Adeyemi", email: "oluwaseun.adeyemi@gmail.com", avatarColor: "#795548", job: "QA Engineer", dept: "Engineering", salary: "₦480,000", contract: "permanent", status: "withdrawn", sentDate: "Mar 6, 2026", timePassed: "17 days ago", expiry: "—", recruiter: "Emeka", options: ["delete"] },
    { id: 12, candidate: "Ahmed Hassan", email: "ahmed.hassan@gmail.com", avatarColor: "#607D8B", job: "DevOps Engineer", dept: "Engineering", salary: "₦650,000", contract: "permanent", status: "signed", sentDate: "Mar 2, 2026", timePassed: "21 days ago", expiry: "—", recruiter: "Emeka", options: [] },
    { id: 13, candidate: "Ngozi Adebayo", email: "ngozi.adebayo@gmail.com", avatarColor: "#E60067", job: "UX Designer", dept: "Design", salary: "₦450,000", contract: "permanent", status: "accepted", sentDate: "Feb 26, 2026", timePassed: "25 days ago", expiry: "—", recruiter: "Emeka", options: [] },
    { id: 14, candidate: "Tunde Lawal", email: "tunde.lawal@gmail.com", avatarColor: "#9E9E9E", job: "Data Analyst", dept: "Analytics", salary: "₦400,000", contract: "permanent", status: "rejected", sentDate: "Feb 2, 2026", timePassed: "120 days ago", expiry: "—", recruiter: "Emeka", options: ["delete"] },
    { id: 15, candidate: "Grace Eze", email: "grace.eze@gmail.com", avatarColor: "#3F51B5", job: "HR Manager", dept: "Human Resources", salary: "₦520,000", contract: "permanent", status: "expired", sentDate: "Jan 2, 2026", timePassed: "150 days ago", expiry: "Expired", recruiter: "Emeka", options: ["delete"] }
];

let ohCurrentActiveTab = "total";

document.addEventListener("DOMContentLoaded", () => {
    initOHTabActions();
    renderOHTable();
    initOHDrawerMechanics();
    initOHSearch();

    document.getElementById("ohCreateOfferBtn").addEventListener("click", () => {
        const modalContainer = document.getElementById("ohCreateOfferModalContainer").querySelector(".oh-modal-overlay");
        if (modalContainer) modalContainer.classList.add("open");
    });
});

function initOHSearch() {
    const input = document.getElementById("ohSearchInput");
    input.addEventListener("input", () => {
        renderOHTable();
    });
}

function initOHTabActions() {
    const metricCards = document.querySelectorAll(".oh-metric-card");
    const activeFiltersRow = document.getElementById("ohActiveFiltersRow");
    const filterBadgeValue = document.getElementById("ohFilterBadgeValue");
    const clearFiltersBtn = document.getElementById("ohClearFilters");

    metricCards.forEach(card => {
        card.addEventListener("click", () => {
            metricCards.forEach(c => c.classList.remove("active"));
            card.classList.add("active");

            ohCurrentActiveTab = card.getAttribute("data-tab");

            if (ohCurrentActiveTab === "total") {
                activeFiltersRow.style.display = "none";
            } else {
                activeFiltersRow.style.display = "flex";
                let displayTag = ohCurrentActiveTab;
                if (ohCurrentActiveTab === "awaiting") displayTag = "sent";
                filterBadgeValue.textContent = "Status: " + displayTag;
            }
            renderOHTable();
        });
    });

    clearFiltersBtn.addEventListener("click", () => {
        metricCards.forEach(c => c.classList.remove("active"));
        const totalCard = document.querySelector('[data-tab="total"]');
        if (totalCard) totalCard.classList.add("active");

        ohCurrentActiveTab = "total";
        activeFiltersRow.style.display = "none";
        renderOHTable();
    });
}

function renderOHTable() {
    const tableBody = document.getElementById("ohOffersTableBody");
    const tableCountBadge = document.getElementById("ohTableCountBadge");
    const paginationTracker = document.getElementById("ohPaginationTracker");
    const searchQuery = document.getElementById("ohSearchInput").value.toLowerCase().trim();

    let filteredData = OH_OFFERS_DATASET;

    if (ohCurrentActiveTab === "awaiting") {
        filteredData = OH_OFFERS_DATASET.filter(item => item.status === "sent" || item.status === "viewed");
    } else if (ohCurrentActiveTab !== "total") {
        filteredData = OH_OFFERS_DATASET.filter(item => item.status === ohCurrentActiveTab);
    }

    if (searchQuery) {
        filteredData = filteredData.filter(item =>
            item.candidate.toLowerCase().includes(searchQuery) ||
            item.job.toLowerCase().includes(searchQuery) ||
            item.email.toLowerCase().includes(searchQuery)
        );
    }

    tableCountBadge.textContent = filteredData.length + " offers";
    paginationTracker.textContent = "Showing " + filteredData.length + " of " + OH_OFFERS_DATASET.length + " total";

    tableBody.innerHTML = "";

    if (filteredData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#999; padding:40px;">No records match the selected status category criteria.</td></tr>';
        return;
    }

    let openDropdownId = null;

    document.addEventListener("click", () => {
        if (openDropdownId) {
            const openMenu = document.querySelector(".oh-options-dropdown.open");
            if (openMenu) openMenu.classList.remove("open");
            openDropdownId = null;
        }
    });

    filteredData.forEach(row => {
        const initials = row.candidate.split(' ').map(n => n[0]).join('');

        const tr = document.createElement("tr");
        tr.setAttribute("data-row-id", row.id);

        let optionsHTML = '';
        if (row.options && row.options.length > 0) {
            optionsHTML = '<div class="oh-options-dropdown"><div class="oh-options-menu">';
            row.options.forEach(opt => {
                const label = opt.charAt(0).toUpperCase() + opt.slice(1);
                optionsHTML += '<button class="oh-opt-btn ' + opt + '">' + label + '</button>';
            });
            optionsHTML += '</div></div>';
        }

        tr.innerHTML = `
            <td>
                <div class="oh-candidate-cell">
                    <div class="oh-avatar-badge" style="background-color: ${row.avatarColor}">${initials}</div>
                    <div class="oh-candidate-info">
                        <h4>${row.candidate}</h4>
                        <p>${row.email}</p>
                    </div>
                </div>
            </td>
            <td>
                <div class="oh-job-cell">
                    <h4>${row.job}</h4>
                    <span class="oh-department-tag">${row.dept}</span>
                </div>
            </td>
            <td>
                <div class="oh-salary-text">${row.salary}<span style="font-size:11px; font-weight:400; color:#666;">/month</span></div>
                <span class="oh-contract-tag ${row.contract}">${row.contract.replace('_', ' ')}</span>
            </td>
            <td>
                <span class="oh-status-pill ${row.status}">${row.status}</span>
                ${row.actionRequired ? '<span style="display:block; font-size:10px; color:#8338EC; font-weight:700; margin-top:4px;"><i class="fa-solid fa-circle-exclamation" style="font-size:10px; vertical-align:middle;"></i> ACTION REQUIRED</span>' : ''}
            </td>
            <td>
                <span>${row.sentDate}</span>
                ${row.timePassed ? '<span class="oh-time-passed-txt">' + row.timePassed + '</span>' : ''}
            </td>
            <td>
                <span style="color: ${row.expiry === 'Expired' ? '#E61C24' : 'inherit'}">${row.expiry}</span>
            </td>
            <td>
                <div class="oh-recruiter-avatar-wrap">
                    <div class="oh-recruiter-mini-ico">${row.recruiter[0]}</div>
                    <span>${row.recruiter}</span>
                </div>
            </td>
            <td>
                <div class="oh-actions-cell-container">
                    ${optionsHTML}
                    <button class="oh-action-row-trigger oh-eye-trigger-btn" title="View details">
                        <i class="fa-regular fa-eye"></i>
                    </button>
                    <button class="oh-action-row-trigger oh-dots-trigger-btn" title="More actions">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                    </button>
                </div>
            </td>
        `;

        tr.addEventListener("click", (e) => {
            if (e.target.closest('.oh-options-dropdown') || e.target.closest('.oh-eye-trigger-btn') || e.target.closest('.oh-dots-trigger-btn')) return;
            openOHDetailSheet(row);
        });

        tr.querySelector(".oh-eye-trigger-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openOHDetailSheet(row);
        });

        const dotsBtn = tr.querySelector(".oh-dots-trigger-btn");
        const dropdown = tr.querySelector(".oh-options-dropdown");
        if (dotsBtn && dropdown) {
            dotsBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (openDropdownId === row.id) {
                    dropdown.classList.remove("open");
                    openDropdownId = null;
                } else {
                    document.querySelectorAll(".oh-options-dropdown.open").forEach(m => m.classList.remove("open"));
                    dropdown.classList.add("open");
                    openDropdownId = row.id;
                }
            });
        }

        tableBody.appendChild(tr);
    });

}

function initOHDrawerMechanics() {
    const overlay = document.getElementById("ohSheetOverlay");
    const sheet = document.getElementById("ohDetailSheet");
    const closeBtn = document.getElementById("ohCloseSheetBtn");

    const closeHandler = () => {
        overlay.classList.remove("open");
        sheet.classList.remove("open");
    };

    overlay.addEventListener("click", closeHandler);
    closeBtn.addEventListener("click", closeHandler);
}

function openOHDetailSheet(rowData) {
    const overlay = document.getElementById("ohSheetOverlay");
    const sheet = document.getElementById("ohDetailSheet");
    const contentArea = document.getElementById("ohSheetDynamicContent");

    let contextActionButtons = '';
    let timelineNodes = '';

    if (rowData.status === 'sent' || rowData.status === 'viewed' || rowData.status === 'pending') {
        contextActionButtons = `
            <div class="oh-sheet-action-row">
                <button class="oh-btn oh-btn-secondary">Withdraw</button>
                <button class="oh-btn oh-btn-primary" style="background:#E60067; border-color:#E60067;">Resend</button>
            </div>`;
    } else if (rowData.status === 'accepted') {
        contextActionButtons = `
            <div class="oh-sheet-action-row">
                <button class="oh-btn oh-btn-primary" style="width:100%; background:#E60067; border-color:#E60067;"><i class="fa-solid fa-briefcase"></i> Create Placement</button>
            </div>`;
    }

    if (rowData.status === 'accepted' || rowData.status === 'signed') {
        timelineNodes = `
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Created</h5><p>Mar 10, 10:00 AM</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot"><i class="fa-regular fa-circle"></i></div>
                <div class="oh-node-details-text"><h5>Approved</h5><p>—</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Sent</h5><p>Mar 11, 11:00 AM</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Viewed</h5><p>Mar 11, 05:00 PM</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Response</h5><p>Accepted • Mar 13, 12:00 PM</p></div>
            </div>`;
    } else {
        timelineNodes = `
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Created</h5><p>Mar 19, 10:00 AM</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot"><i class="fa-regular fa-circle"></i></div>
                <div class="oh-node-details-text"><h5>Approved</h5><p>—</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot completed"><i class="fa-solid fa-check"></i></div>
                <div class="oh-node-details-text"><h5>Sent</h5><p>${rowData.sentDate !== 'Not sent' ? rowData.sentDate : '—'}</p></div>
            </div>
            <div class="oh-timeline-node-item">
                <div class="oh-node-icon-dot"><i class="fa-regular fa-circle"></i></div>
                <div class="oh-node-details-text"><h5>Viewed</h5><p>—</p></div>
            </div>`;
    }

    contentArea.innerHTML = `
        <div class="oh-sheet-header-status">
            <span class="oh-status-pill ${rowData.status}">${rowData.status}</span>
            <h2>${rowData.candidate}</h2>
            <p>${rowData.job} · ${rowData.dept}</p>
        </div>

        ${contextActionButtons}

        <div class="oh-timeline-section-card">
            <h4 class="oh-section-block-title">Offer Timeline</h4>
            <div class="oh-timeline-stream">
                ${timelineNodes}
            </div>
        </div>

        <div class="summary-section">
            <h4 class="oh-section-block-title" style="margin-left:4px;">Offer Summary</h4>
            <div class="oh-summary-attributes-list">
                <div class="oh-attr-row-item">
                    <span class="oh-attr-label">Candidate</span>
                    <span class="oh-attr-value">${rowData.candidate}</span>
                </div>
                <div class="oh-attr-row-item">
                    <span class="oh-attr-label">Job</span>
                    <span class="oh-attr-value">${rowData.job}</span>
                </div>
                <div class="oh-attr-row-item">
                    <span class="oh-attr-label">Base Salary</span>
                    <span class="oh-attr-value">${rowData.salary}/month</span>
                </div>
                <div class="oh-attr-row-item">
                    <span class="oh-attr-label">Contract</span>
                    <span class="oh-attr-value" style="text-transform: capitalize;">${rowData.contract.replace('_', ' ')}</span>
                </div>
                <div class="oh-attr-row-item">
                    <span class="oh-attr-label">Start Date</span>
                    <span class="oh-attr-value">Apr 10, 2026</span>
                </div>
            </div>
        </div>
    `;

    overlay.classList.add("open");
    sheet.classList.add("open");

}

function addOHNewOffer(offerData) {
    const newId = Math.max(...OH_OFFERS_DATASET.map(o => o.id)) + 1;
    OH_OFFERS_DATASET.unshift({
        id: newId,
        ...offerData,
        avatarColor: "#E60067",
        sentDate: "Not sent",
        expiry: "—",
        recruiter: "Emeka",
        options: ["edit", "delete"]
    });
    renderOHTable();
}
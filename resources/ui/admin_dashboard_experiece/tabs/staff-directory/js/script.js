const employees = [
  { name: "John Doe", role: "Senior Software Engineer", department: "ENGINEERING", grade: "5A", mode: "Hybrid", status: "Active", id: "CO-ENG-001", compliance: "Verified", tags: ["Employee", "Tech Lead"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=12" },
  { name: "Sarah Wilson", role: "Head of Engineering", department: "ENGINEERING", grade: "7B", mode: "Office", status: "Active", id: "CO-ENG-007", compliance: "Verified", tags: ["Employee", "Executive"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=32" },
  { name: "Michael Brown", role: "Financial Analyst", department: "FINANCE", grade: "3A", mode: "Office", status: "Pre-Onboarding", id: "CO-FIN-022", compliance: "In Progress", tags: ["New Hire"], dotColor: "#3468ff", image: "https://i.pravatar.cc/300?img=45" },
  { name: "Grace Adams", role: "HR Manager", department: "HUMAN RESOURCES", grade: "5B", mode: "Office", status: "Active", id: "CO-HR-001", compliance: "Verified", tags: ["Employee", "HR Admin"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=20" },
  { name: "Alex Rivera", role: "UX Lead", department: "PRODUCT DESIGN", grade: "5A", mode: "Remote", status: "Active", id: "CO-DES-003", compliance: "Verified", tags: ["Employee", "Remote"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=51" },
  { name: "James Carter", role: "CFO", department: "FINANCE", grade: "8A", mode: "Office", status: "Active", id: "CO-FIN-001", compliance: "Verified", tags: ["Employee", "Executive"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=60" },
  { name: "Lisa Park", role: "Marketing Director", department: "MARKETING", grade: "6B", mode: "Hybrid", status: "Active", id: "CO-MKT-001", compliance: "Verified", tags: ["Employee", "Director"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=47" },
  { name: "Anna Chen", role: "Frontend Developer", department: "ENGINEERING", grade: "3B", mode: "Hybrid", status: "Active", id: "CO-ENG-014", compliance: "Verified", tags: ["Employee", "Probation"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=38" },
  { name: "Tom Nash", role: "Operations Manager", department: "OPERATIONS", grade: "5A", mode: "Office", status: "On Leave", id: "CO-OPS-004", compliance: "Verified", tags: ["Employee", "On Leave"], dotColor: "#f59d0d", image: "https://i.pravatar.cc/300?img=53" },
  { name: "David Kim", role: "Marketing Analyst", department: "MARKETING", grade: "2A", mode: "Office", status: "Offboarding", id: "CO-MKT-009", compliance: "Verified", tags: ["Employee", "Exiting"], dotColor: "#ff4f6d", image: "https://i.pravatar.cc/300?img=68" },
  { name: "Priya Sharma", role: "HR Business Partner", department: "HUMAN RESOURCES", grade: "4A", mode: "Hybrid", status: "Active", id: "CO-HR-003", compliance: "Verified", tags: ["Employee"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=43" },
  { name: "Robert Hayes", role: "CEO", department: "EXECUTIVE", grade: "9A", mode: "Office", status: "Active", id: "CO-EXEC-001", compliance: "Verified", tags: ["Employee", "C-Suite"], dotColor: "#16c47f", image: "https://i.pravatar.cc/300?img=11" }
];

TOTAL_EMPLOYEES = employees.length;

let currentView = "cards";
let filterStatus = "All";
let filterDept = "All";
let filterMode = "All";
let filterAlpha = "";
let searchQuery = "";
let selectedEmployees = new Set();

const container = document.getElementById("viewContainer");

const getFilteredData = () => {
  return employees.filter(emp => {
    const matchesStatus = (filterStatus === "All" || emp.status.toLowerCase() === filterStatus.toLowerCase());
    const matchesDept = (filterDept === "All" || emp.department === filterDept);
    const matchesMode = (filterMode === "All" || emp.mode === filterMode);
    const matchesAlpha = (filterAlpha === "" || emp.name.toUpperCase().startsWith(filterAlpha));
    const textStr = `${emp.name} ${emp.role} ${emp.id} ${emp.department}`.toLowerCase();
    const matchesSearch = textStr.includes(searchQuery.toLowerCase());
    return matchesStatus && matchesDept && matchesMode && matchesAlpha && matchesSearch;
  });
};

const updateStatsAndCounters = () => {
  const activeCount = employees.filter(e => e.status === "Active").length;
  const preCount = employees.filter(e => e.status === "Pre-Onboarding").length;
  const leaveCount = employees.filter(e => e.status === "On Leave").length;
  const offCount = employees.filter(e => e.status === "Offboarding").length;

  document.getElementById("stat-total").innerText = employees.length;
  document.getElementById("stat-active").innerText = activeCount;
  document.getElementById("stat-pre").innerText = preCount;
  document.getElementById("stat-leave").innerText = leaveCount;
  document.getElementById("stat-off").innerText = offCount;
};

const renderView = () => {
  const data = getFilteredData();
  document.getElementById("recordCountLabel").innerHTML = `Showing <strong>${data.length}</strong> of ${employees.length} employees`;

  if (currentView === "cards") {
    container.innerHTML = `<section class="employees-grid">${data.map((emp, idx) => `
      <div class="employee-card">
        <div class="card-controls-wrap">
          <input type="checkbox" class="card-checkbox"
                 ${selectedEmployees.has(emp.id) ? 'checked' : ''}
                 onclick="handleCardSelect('${emp.id}')">
          <button class="menu-trigger" onclick="toggleDropdown(event, ${idx})">
            <i data-lucide="more-vertical" size="18"></i>
          </button>
        </div>

        <div class="dropdown" id="dropdown-${idx}">
          <div class="dropdown-item"><i data-lucide="user" size="9"></i>View Profile</div>
          <div class="dropdown-item"><i data-lucide="scan-eye" size="9"></i>Deep View</div>
          <div class="dropdown-item"><i data-lucide="square-pen" size="9"></i>Edit Employee</div>
          <div class="dropdown-item"><i data-lucide="mail" size="9"></i>Send Email</div>
          <div class="dropdown-item"><i data-lucide="phone" size="9"></i>Call</div>
          <div class="dropdown-item"><i data-lucide="message-square" size="9"></i>Send SMS</div>
          <div class="dropdown-item danger"><i data-lucide="ban" size="9"></i>Suspend Employee</div>
          <div class="dropdown-item danger"><i data-lucide="log-out" size="9"></i>Initiate Offboarding</div>
        </div>

        <div class="employee-top">
          <div class="avatar-wrap">
            <img class="avatar" src="${emp.image}" onclick="openPhotoPreview('${emp.image}', '${emp.name}')" />
            <div class="online" style="background: ${emp.dotColor}"></div>
          </div>
          <h3 class="employee-name">${emp.name}</h3>
          <p class="employee-role">${emp.role}</p>
          <p class="employee-dept">${emp.department}</p>
          <div class="tags">
            ${emp.tags.map((t, i) => `<div class="tag ${i > 0 ? 'sec-tag' : ''}">${t}</div>`).join('')}
          </div>
          <div class="status-badge ${emp.status.toLowerCase().replace(' ', '-')}">
            ${emp.status}
          </div>
        </div>

        <div class="meta">
          <div class="meta-box"><h6>GRADE</h6><p>${emp.grade}</p></div>
          <div class="meta-box"><h6>MODE</h6><p style="color:#ff1f8f">${emp.mode}</p></div>
        </div>

        <div class="card-id-row">
          <span>ID: ${emp.id}</span> · 
          <span class="compliance-check ${emp.compliance === 'In Progress' ? 'pending' : ''}">
            <i data-lucide="${emp.compliance === 'Verified' ? 'shield-check' : 'shield-alert'}" size="12"></i> ${emp.compliance}
          </span>
        </div>

        <div class="employee-bottom">
          <div class="employee-actions">
            <div class="icon-btn"><i data-lucide="mail" size="14"></i></div>
            <div class="icon-btn"><i data-lucide="phone" size="14"></i></div>
            <div class="icon-btn"><i data-lucide="message-square" size="14"></i></div>
          </div>
          <div class="view-profile">View Profile <i data-lucide="arrow-right" size="14"></i></div>
        </div>
      </div>
    `).join("")}</section>`;

  } else if (currentView === "table") {
    container.innerHTML = `
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>ID</th>
              <th>Department</th>
              <th>Grade</th>
              <th>Work Mode</th>
              <th>Compliance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.map(emp => `
              <tr>
                <td>
                  <div class="table-user-cell">
                    <img src="${emp.image}" class="table-avatar">
                    <div>
                      <strong style="display:block;">${emp.name}</strong>
                      <span style="color:#666; font-size:12px;">${emp.role}</span>
                    </div>
                  </div>
                </td>
                <td style="font-weight:600; color:#444;">${emp.id}</td>
                <td style="font-weight:700; color:#888; font-size:11px;">${emp.department}</td>
                <td><strong>${emp.grade}</strong></td>
                <td style="color:var(--pink); font-weight:600;">${emp.mode}</td>
                <td>
                  <span class="compliance-check ${emp.compliance === 'In Progress' ? 'pending' : ''}" style="justify-content:flex-start;">
                    <i data-lucide="${emp.compliance === 'Verified' ? 'shield-check' : 'shield-alert'}" size="14"></i> ${emp.compliance}
                  </span>
                </td>
                <td><span class="status-badge ${emp.status.toLowerCase().replace(' ', '-')}">${emp.status}</span></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>`;

  } else if (currentView === "structure") {
    const ceo = employees.find(e => e.role === "CEO") || employees[0];
    const directReports = employees.filter(e => e.role.includes("Head") || e.role.includes("CFO") || e.role.includes("Director"));

    container.innerHTML = `
      <div class="tree-wrapper">
        <div class="tree-node" style="border-color: var(--pink); background: #fff0f6;">
          <img src="${ceo.image}" class="table-avatar" style="width:44px; height:44px;">
          <div>
            <strong>${ceo.name}</strong>
            <p style="font-size:11px; color:var(--pink); font-weight:700;">${ceo.role}</p>
          </div>
        </div>
        <div class="tree-connector"></div>
        <div class="tree-children">
          ${directReports.map(emp => `
            <div style="display:flex; flex-direction:column; align-items:center;">
              <div class="tree-node">
                <img src="${emp.image}" class="table-avatar" style="width:38px; height:38px;">
                <div>
                  <strong>${emp.name}</strong>
                  <p style="font-size:11px; color:#666;">${emp.role}</p>
                </div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>`;
  }
  lucide.createIcons();
};

window.toggleDropdown = (e, idx) => {
  e.stopPropagation();
  document.querySelectorAll("#view-staff-directory .dropdown").forEach(d => {
    if (d.id !== `dropdown-${idx}`) d.classList.remove("open");
  });
  const targetDropdown = document.getElementById(`dropdown-${idx}`);
  if (targetDropdown) targetDropdown.classList.toggle("open");
};

window.switchViewType = (type) => {
  currentView = type;
  document.querySelectorAll("#view-staff-directory .view-btn").forEach(b => b.classList.remove("active"));
  const activeBtn = document.getElementById(`view-${type}`);
  if (activeBtn) activeBtn.classList.add("active");
  renderView();
};

window.filterByStatus = (status) => {
  filterStatus = status;
  document.getElementById("statusFilter").value = status;
  const buttons = document.querySelectorAll("#view-staff-directory #statusToolbarTabs button");
  buttons.forEach(btn => {
    if (btn.textContent.includes(status)) {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    }
  });
  renderView();
};

window.handleDropdownFilters = () => {
  filterDept = document.getElementById("deptFilter").value;
  filterStatus = document.getElementById("statusFilter").value;
  filterMode = document.getElementById("modeFilter").value;
  renderView();
};

window.handleSearch = () => {
  searchQuery = document.getElementById("searchInput").value;
  renderView();
};

window.resetAllFilters = () => {
  filterDept = "All";
  filterStatus = "All";
  filterMode = "All";
  filterAlpha = "";
  searchQuery = "";
  document.getElementById("deptFilter").value = "All";
  document.getElementById("statusFilter").value = "All";
  document.getElementById("modeFilter").value = "All";
  document.getElementById("searchInput").value = "";
  document.querySelectorAll("#view-staff-directory .alpha-btn").forEach(b => b.classList.remove("active"));
  filterByStatus("All");
};

window.handleCardSelect = (empId) => {
  if (selectedEmployees.has(empId)) {
    selectedEmployees.delete(empId);
  } else {
    selectedEmployees.add(empId);
  }
  const panel = document.getElementById("selectionPanel");
  const countLabel = document.getElementById("selectedCount");
  if (selectedEmployees.size > 0) {
    countLabel.innerText = selectedEmployees.size;
    panel.classList.add("visible");
  } else {
    panel.classList.remove("visible");
  }
};

document.addEventListener("click", () => {
  document.querySelectorAll("#view-staff-directory .dropdown").forEach(d => d.classList.remove("open"));
});

document.getElementById("filterBtn").addEventListener("click", () => {
  document.getElementById("filtersPanel").classList.toggle("open");
});

const alphabet = document.getElementById("alphabet");
"ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").forEach(letter => {
  const btn = document.createElement("button");
  btn.className = "alpha-btn";
  btn.textContent = letter;
  btn.onclick = () => {
    if (filterAlpha === letter) {
      filterAlpha = "";
      btn.classList.remove("active");
    } else {
      document.querySelectorAll("#view-staff-directory .alpha-btn").forEach(b => b.classList.remove("active"));
      filterAlpha = letter;
      btn.classList.add("active");
    }
    renderView();
  };
  alphabet.appendChild(btn);
});

document.getElementById("addEmployeeBtn").addEventListener("click", () => {
  document.getElementById("employeeModal").classList.add("open");
});

document.getElementById("employeeModal").addEventListener("click", (e) => {
  if (e.target.id === "employeeModal") e.target.classList.remove("open");
});

updateStatsAndCounters();
renderView();

const btnSuspend = document.getElementById("btnSuspend");
const btnOffboard = document.getElementById("btnOffboard");
if (btnSuspend) btnSuspend.addEventListener("click", () => document.getElementById("modalSuspend").classList.add("active"));
if (btnOffboard) btnOffboard.addEventListener("click", () => document.getElementById("modalOffboard").classList.add("active"));

window.closeModal = (modalId) => {
  document.getElementById(modalId).classList.remove("active");
};

window.handleAction = (actionType) => {
  alert(`Employee status updated to: ${actionType}`);
  document.querySelectorAll(".modal-overlay").forEach(o => o.classList.remove("active"));
};

document.querySelectorAll(".modal-overlay").forEach(overlay => {
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.remove("active");
  });
});

let currentZoom = 1;

window.openPhotoPreview = (src, name) => {
  const img = document.getElementById("photoPreviewImg");
  img.src = src;
  document.getElementById("photoPreviewName").textContent = name;
  currentZoom = 1;
  img.style.transform = "scale(1)";
  document.getElementById("photoZoomLevel").textContent = "100%";
  document.getElementById("photoPreviewOverlay").classList.add("open");
};

window.closePhotoPreview = (e) => {
  if (!e || e.target === document.getElementById("photoPreviewOverlay")) {
    document.getElementById("photoPreviewOverlay").classList.remove("open");
  }
};

window.zoomPhoto = (delta) => {
  currentZoom = Math.max(0.3, Math.min(5, currentZoom + delta));
  document.getElementById("photoPreviewImg").style.transform = `scale(${currentZoom})`;
  document.getElementById("photoZoomLevel").textContent = `${Math.round(currentZoom * 100)}%`;
};

window.resetPhotoZoom = () => {
  currentZoom = 1;
  document.getElementById("photoPreviewImg").style.transform = "scale(1)";
  document.getElementById("photoZoomLevel").textContent = "100%";
};

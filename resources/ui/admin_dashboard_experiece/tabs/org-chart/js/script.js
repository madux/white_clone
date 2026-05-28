document.addEventListener("DOMContentLoaded", function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  var scope = document.getElementById('view-org-chart');
  if (!scope) scope = document;

  var vacanciesToggleBtn = scope.querySelector('.btn-toggle-vacancies');
  var vacantSection = scope.querySelector('.vacant-section-container');

  if (vacanciesToggleBtn && vacantSection) {
    vacanciesToggleBtn.addEventListener('click', function() {
      if (vacantSection.style.display === "none") {
        vacantSection.style.display = "block";
        vacanciesToggleBtn.innerHTML = '<i data-lucide="eye" style="width:15px; height:15px;"></i> Vacancies ON';
        vacanciesToggleBtn.style.background = "#FFF1F2";
        vacanciesToggleBtn.style.color = "#E11D48";
      } else {
        vacantSection.style.display = "none";
        vacanciesToggleBtn.innerHTML = '<i data-lucide="eye-off" style="width:15px; height:15px;"></i> Vacancies OFF';
        vacanciesToggleBtn.style.background = "#F1F5F9";
        vacanciesToggleBtn.style.color = "#64748B";
      }
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });
  }
});

var EMP_COMP_DATA = {
  'Robert Hayes':    { empId: 'EMP001', grade: 'Grade 8',  role: 'CEO',          dept: 'Executive',       initials: 'RH', minSalary: 240000, maxSalary: 464000, currentSalary: 380000 },
  'Grace Adams':     { empId: 'EMP002', grade: 'Grade 5',  role: 'HR Manager',   dept: 'Human Resources', initials: 'GA', minSalary: 150000, maxSalary: 290000, currentSalary: 115000 },
  'James Carter':    { empId: 'EMP003', grade: 'Grade 7',  role: 'CFO',          dept: 'Finance',         initials: 'JC', minSalary: 200000, maxSalary: 380000, currentSalary: 275000 },
  'Lisa Park':       { empId: 'EMP004', grade: 'Grade 6',  role: 'Marketing Director', dept: 'Marketing', initials: 'LP', minSalary: 140000, maxSalary: 260000, currentSalary: 185000 },
  'Anna Chen':       { empId: 'EMP005', grade: 'Grade 4',  role: 'Frontend Developer', dept: 'Engineering', initials: 'AC', minSalary: 90000,  maxSalary: 170000, currentSalary: 105000 },
  'Priya Sharma':    { empId: 'EMP006', grade: 'Grade 4',  role: 'HR Business Partner', dept: 'Human Resources', initials: 'PS', minSalary: 90000, maxSalary: 170000, currentSalary: 98000 },
  'Michael Brown':   { empId: 'EMP007', grade: 'Grade 3',  role: 'Financial Analyst', dept: 'Finance', initials: 'MB', minSalary: 65000,  maxSalary: 120000, currentSalary: 82000 },
  'Alex Rivera':     { empId: 'EMP008', grade: 'Grade 5',  role: 'UX Lead',      dept: 'Product Design',  initials: 'AR', minSalary: 110000, maxSalary: 200000, currentSalary: 145000 }
};

function navigateToProfile(name, role, department, initials, email) {
  var empData = EMP_COMP_DATA[name];
  var empId = empData ? empData.empId : '—';
  document.getElementById('pCardName').innerText = name;
  document.getElementById('pCardRole').innerText = role;
  document.getElementById('pCardMetaDept').innerText = department + " \u2022 " + empId;
  document.getElementById('pCardInitials').innerText = initials;
  document.getElementById('pCardEmail').innerText = email;

  document.getElementById('mFullName').innerText = name;
  document.getElementById('mRole').innerText = role;
  document.getElementById('mDept').innerText = department;

  var appShell = document.querySelector('.app-shell');
  var profileView = document.getElementById('view-employee-profile');
  if (appShell && profileView) {
    document.querySelectorAll('.page-view').forEach(function(el) { el.classList.remove('active'); });
    profileView.classList.add('active');
    appShell.classList.add('secondary-hidden');
    var headerTitle = document.getElementById('headerPageTitle');
    if (headerTitle) headerTitle.innerText = 'Employee Profile';
    var pageTabs = document.getElementById('pageTabs');
    if (pageTabs) pageTabs.style.display = 'none';
  } else {
    document.getElementById('orgChartPage').classList.remove('active-view');
    document.getElementById('profilePage').classList.add('active-view');
  }

  var overviewTabBtn = document.querySelector('#view-employee-profile .profile-nav-stack-item, #view-org-chart .profile-nav-stack-item, #view-org-chart .profile-navigation-box .profile-nav-item');
  if (overviewTabBtn) switchProfileTab('Overview', overviewTabBtn);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToOrgChart() {
  var appShell = document.querySelector('.app-shell');
  var profileView = document.getElementById('view-employee-profile');
  if (appShell && profileView) {
    document.querySelectorAll('.page-view').forEach(function(el) { el.classList.remove('active'); });
    var orgChartView = document.getElementById('view-org-chart');
    if (orgChartView) orgChartView.classList.add('active');
    appShell.classList.remove('secondary-hidden');
    var headerTitle = document.getElementById('headerPageTitle');
    if (headerTitle) headerTitle.innerText = 'Organization Chart';
    var pageTabs = document.getElementById('pageTabs');
    if (pageTabs) pageTabs.style.display = 'flex';
  } else {
    document.getElementById('profilePage').classList.remove('active-view');
    document.getElementById('orgChartPage').classList.add('active-view');
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchProfileTab(tabName, element) {
  // Handle both old and new nav item selectors
  document.querySelectorAll('#view-org-chart .profile-nav-item, #view-employee-profile .profile-nav-stack-item, #view-org-chart .profile-nav-stack-item').forEach(function(el) {
    el.classList.remove('active-tab');
    el.classList.remove('active-profile-tab');
  });
  element.classList.add('active-tab');
  element.classList.add('active-profile-tab');

  document.getElementById('dynamicTabTitle').innerText = tabName;
  var subtitles = {
    'Overview': 'Detailed employee data management.',
    'Time & Leave': 'Manage leave balances and track attendance.'
  };
  document.getElementById('dynamicTabSubtitle').innerText = subtitles[tabName] || 'The more details page.';

  // Try new panel system first, fall back to old subview system
  var panelMap = {
    'Overview': document.getElementById('subView-Overview'),
    'Body Composition': document.getElementById('subView-BodyComposition'),
    'Compensation': document.getElementById('subView-Compensation'),
    'Time & Leave': document.getElementById('subView-TimeLeave'),
    'Documents': document.getElementById('subView-Documents'),
    'Assets': document.getElementById('subView-Assets'),
    'Performance': document.getElementById('subView-Performance'),
    'Exit Details': document.getElementById('subView-ExitDetails')
  };
  var fallbackView = document.getElementById('subView-GenericFallback');
  var fallbackTitle = document.getElementById('fallbackTitle');
  var fallbackIcon = document.getElementById('fallbackIcon');

  // Hide all panels
  Object.values(panelMap).forEach(function(p) { if (p) {
    p.classList.remove('active-panel');
    p.style.display = 'none';
  }});
  if (fallbackView) { fallbackView.classList.remove('active-panel'); fallbackView.style.display = 'none'; }

  if (tabName === 'Overview' && panelMap['Overview']) {
    panelMap['Overview'].classList.add('active-panel');
    panelMap['Overview'].style.display = 'block';
  } else if (tabName === 'Body Composition' && panelMap['Body Composition']) {
    panelMap['Body Composition'].classList.add('active-panel');
    panelMap['Body Composition'].style.display = 'block';
  } else if (tabName === 'Compensation' && panelMap['Compensation']) {
    panelMap['Compensation'].classList.add('active-panel');
    panelMap['Compensation'].style.display = 'block';
  } else if (tabName === 'Time & Leave' && panelMap['Time & Leave']) {
    panelMap['Time & Leave'].classList.add('active-panel');
    panelMap['Time & Leave'].style.display = 'block';
    initLeaveBars();
  } else if (tabName === 'Documents' && panelMap['Documents']) {
    panelMap['Documents'].classList.add('active-panel');
    panelMap['Documents'].style.display = 'block';
    initDocuments();
  } else if (tabName === 'Assets' && panelMap['Assets']) {
    panelMap['Assets'].classList.add('active-panel');
    panelMap['Assets'].style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } else if (tabName === 'Performance' && panelMap['Performance']) {
    panelMap['Performance'].classList.add('active-panel');
    panelMap['Performance'].style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } else if (tabName === 'Exit Details' && panelMap['Exit Details']) {
    panelMap['Exit Details'].classList.add('active-panel');
    panelMap['Exit Details'].style.display = 'block';
    if (window.lucide) lucide.createIcons();
  } else if (fallbackView) {
    fallbackView.classList.add('active-panel');
    fallbackView.style.display = 'flex';
    fallbackTitle.innerText = tabName + " Component Workspace";

    var iconName = 'layers';
    if (tabName === 'Documents') iconName = 'file-text';
    fallbackIcon.setAttribute('data-lucide', iconName);
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
  }
}

function openSalaryReviewModal() {
  var modal = document.getElementById('salaryReviewModal');
  if (!modal) return;

  var select = document.getElementById('employeeSelect');
  var currentName = document.getElementById('pCardName');
  if (select && currentName) {
    select.value = currentName.innerText;
  }

  updateEmployeeView();
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSalaryReviewModal() {
  var modal = document.getElementById('salaryReviewModal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

function updateEmployeeView() {
  var select = document.getElementById('employeeSelect');
  if (!select) return;

  var comp = EMP_COMP_DATA[select.value];
  if (!comp) return;

  var empAvatar = document.getElementById('empAvatar');
  var empName = document.getElementById('empName');
  var empRole = document.getElementById('empRole');
  var bandRangeText = document.getElementById('bandRangeText');
  var sliderFill = document.getElementById('sliderFill');
  var bandStatus = document.getElementById('currentBandStatus');
  var changeInput = document.getElementById('changePercentage');
  var justificationInput = document.getElementById('justification');

  if (empAvatar) empAvatar.textContent = comp.initials;
  if (empName) empName.textContent = comp.name || select.value;
  if (empRole) empRole.textContent = comp.grade + ' - ' + comp.role + ' - ' + comp.dept;
  if (bandRangeText) bandRangeText.textContent = '$' + (comp.minSalary / 1000) + 'K - $' + (comp.maxSalary / 1000) + 'K';

  if (changeInput) changeInput.value = '';
  if (justificationInput) {
    justificationInput.value = '';
    justificationInput.required = false;
  }

  calculateSalaryMetrics(comp, NaN);
}

function calculateSalaryMetrics(comp, percentageChange) {
  var sliderFill = document.getElementById('sliderFill');
  var bandStatus = document.getElementById('currentBandStatus');
  var justificationInput = document.getElementById('justification');

  if (!comp || !sliderFill || !bandStatus) return;

  var min = comp.minSalary;
  var max = comp.maxSalary;
  var base = comp.currentSalary;
  var totalRange = max - min;

  if (isNaN(percentageChange)) {
    var defaultOffset = base - min;
    var defaultPercent = Math.round((defaultOffset / totalRange) * 100);
    sliderFill.style.width = Math.min(100, Math.max(0, defaultPercent)) + '%';
    bandStatus.textContent = 'Current: $' + base.toLocaleString() + ' (' + defaultPercent + '% of band)';
    syncRangeSlider(defaultPercent);
    return;
  }

  var salaryDelta = base * (percentageChange / 100);
  var updatedSalary = base + salaryDelta;
  var relativeOffset = updatedSalary - min;
  var targetPercent = Math.round((relativeOffset / totalRange) * 100);
  targetPercent = Math.max(0, Math.min(100, targetPercent));

  sliderFill.style.width = targetPercent + '%';
  bandStatus.textContent = 'Revised: $' + Math.round(updatedSalary).toLocaleString() + ' (' + targetPercent + '% of band)';
  syncRangeSlider(targetPercent);

  if (justificationInput) {
    justificationInput.required = Math.abs(percentageChange) > 10;
  }
}

function syncRangeSlider(percent) {
  var rangeInput = document.getElementById('salaryRange');
  if (rangeInput) rangeInput.value = Math.max(0, Math.min(100, Math.round(percent)));
}

function initLeaveBars() {
  var leaveItems = document.querySelectorAll('#view-org-chart .leave-item, #view-employee-profile .leave-item');
  leaveItems.forEach(function(item) {
    var used = parseFloat(item.getAttribute('data-used')) || 0;
    var total = parseFloat(item.getAttribute('data-total')) || 1;
    var fillElement = item.querySelector('.progress-bar-fill');
    if (!fillElement) return;
    var pct = Math.min(100, Math.max(0, (used / total) * 100));
    setTimeout(function() {
      fillElement.style.width = pct + '%';
    }, 150);
  });
}

document.addEventListener('change', function(e) {
  if (e.target.id === 'employeeSelect') {
    var comp = EMP_COMP_DATA[e.target.value];
    updateEmployeeView();
  }
});

document.addEventListener('input', function(e) {
  if (e.target.id === 'changePercentage') {
    var select = document.getElementById('employeeSelect');
    var comp = select ? EMP_COMP_DATA[select.value] : null;
    if (comp) {
      var pct = parseFloat(e.target.value);
      calculateSalaryMetrics(comp, pct);
      if (!isNaN(pct)) {
        var newSalary = comp.currentSalary * (1 + pct / 100);
        var rangePct = ((newSalary - comp.minSalary) / (comp.maxSalary - comp.minSalary)) * 100;
        syncRangeSlider(rangePct);
      }
    }
  }
  if (e.target.id === 'salaryRange') {
    var select = document.getElementById('employeeSelect');
    var comp = select ? EMP_COMP_DATA[select.value] : null;
    if (comp) {
      var rangeVal = parseFloat(e.target.value);
      var salaryAtPos = comp.minSalary + (comp.maxSalary - comp.minSalary) * (rangeVal / 100);
      var pctChange = ((salaryAtPos - comp.currentSalary) / comp.currentSalary) * 100;
      var changeInput = document.getElementById('changePercentage');
      if (changeInput) changeInput.value = pctChange.toFixed(1);
      calculateSalaryMetrics(comp, pctChange);
    }
  }
});

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay')) {
    closeSalaryReviewModal();
  }
  if (e.target.id === 'cancelBtn') {
    closeSalaryReviewModal();
  }
  if (e.target.id === 'viewTimesheetLink') {
    e.preventDefault();
    alert('Navigating to Timesheet Log Panel...');
  }
});

document.addEventListener('submit', function(e) {
  if (e.target.id === 'salaryRevisionForm') {
    e.preventDefault();
    var select = document.getElementById('employeeSelect');
    var comp = select ? EMP_COMP_DATA[select.value] : null;
    if (comp) alert('Salary Revision for ' + select.value + ' submitted successfully for approval!');
    closeSalaryReviewModal();
  }
});

/* ============================================================
   DOCUMENTS MODULE
   ============================================================ */
var DOCUMENTS_DATA = [
  { id: 1, name: 'Employment Contract.pdf', category: 'Contract', date: 'Jan 15, 2024', size: '2.4 MB' },
  { id: 2, name: 'NIN_Verification.pdf',    category: 'Identity', date: 'Jan 18, 2024', size: '1.1 MB' },
  { id: 3, name: 'Degree_Certificate.pdf',   category: 'Education', date: 'Jan 20, 2024', size: '4.8 MB' },
  { id: 4, name: 'Tax_Clearance_2025.pdf',   category: 'Tax',       date: 'Jan 5, 2026',  size: '840 KB' }
];

function renderDocuments() {
  var container = document.getElementById('docFileListContainer');
  if (!container) return;
  container.innerHTML = '';
  DOCUMENTS_DATA.forEach(function(file) {
    var row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML =
      '<div class="file-meta-side">' +
        '<div class="file-icon-box"><i data-lucide="file-text" style="width:20px;height:20px;"></i></div>' +
        '<div class="file-details">' +
          '<h4>' + file.name + '</h4>' +
          '<div class="file-subtext">' + file.category + '<span class="divider">\u2022</span>' + file.date + '<span class="divider">\u2022</span>' + file.size + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="file-actions-side">' +
        '<button class="btn-icon download-trigger" data-id="' + file.id + '" title="Download"><i data-lucide="download" style="width:18px;height:18px;"></i></button>' +
      '</div>';
    container.appendChild(row);
  });
  if (window.lucide) lucide.createIcons();
  document.querySelectorAll('.download-trigger').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      var id = e.currentTarget.getAttribute('data-id');
      var f = DOCUMENTS_DATA.find(function(d) { return d.id == id; });
      if (f) alert('Downloading: ' + f.name);
    });
  });
}

function toggleDocUploadModal(show) {
  var modal = document.getElementById('docUploadModal');
  if (!modal) return;
  if (show) {
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  } else {
    modal.classList.remove('open');
    document.body.style.overflow = '';
    var form = document.getElementById('docUploadForm');
    if (form) form.reset();
  }
}

function initDocuments() {
  var triggerBtn = document.getElementById('triggerDocModalBtn');
  var closeBtn = document.getElementById('closeDocModalBtn');
  var cancelBtn = document.getElementById('cancelDocModalBtn');
  var form = document.getElementById('docUploadForm');
  var modal = document.getElementById('docUploadModal');

  if (triggerBtn) {
    triggerBtn.onclick = function() { toggleDocUploadModal(true); };
  }
  if (closeBtn) {
    closeBtn.onclick = function() { toggleDocUploadModal(false); };
  }
  if (cancelBtn) {
    cancelBtn.onclick = function() { toggleDocUploadModal(false); };
  }
  if (modal) {
    modal.onclick = function(e) {
      if (e.target === modal) toggleDocUploadModal(false);
    };
  }
  if (form) {
    form.onsubmit = function(e) {
      e.preventDefault();
      var nameEl = document.getElementById('docName');
      var catEl = document.getElementById('docCategory');
      var fileEl = document.getElementById('docFile');
      if (!nameEl || !catEl || !fileEl) return;
      var name = nameEl.value;
      var category = catEl.value;
      var file = fileEl.files[0];
      if (!name || !category || !file) return;
      var sizeInBytes = file.size;
      var sizeDisplay = sizeInBytes >= 1048576
        ? (sizeInBytes / 1048576).toFixed(1) + ' MB'
        : (sizeInBytes / 1024).toFixed(1) + ' KB';
      var options = { month: 'short', day: 'numeric', year: 'numeric' };
      var formattedDate = new Date().toLocaleDateString('en-US', options);
      var displayName = name.toLowerCase().endsWith('.pdf') ? name : name + '.pdf';
      DOCUMENTS_DATA.unshift({
        id: Date.now(),
        name: displayName,
        category: category.charAt(0).toUpperCase() + category.slice(1),
        date: formattedDate,
        size: sizeDisplay
      });
      renderDocuments();
      toggleDocUploadModal(false);
    };
  }

  renderDocuments();
}

/* ============================================================
   EMPLOYEE DEEP VIEW DATA
   ============================================================ */
var EMP_DEEP_DATA = {
  'Robert Hayes': {
    status:'Active',type:'Permanent',workMode:'Office',grade:'Grade 8',joiningDate:'Jan 15, 2018',tenure:'8 Years',
    gender:'Male',dob:'Mar 12, 1985',nationality:'American',reportsTo:'—',directReports:'5 Employees',emergency:'+1 555-0100',bloodGroup:'A+',
    leave:[
      {l:'Annual Leave',u:18,t:25,c:'#d21787'},{l:'Sick Leave',u:3,t:10,c:'#f59e0b'},{l:'Compassionate',u:1,t:5,c:'#5c67f2'},{l:'Paternity Leave',u:0,t:10,c:'#14b8a6'}
    ],
    att:{present:'21 / 22',lateness:'1 Time',overtime:'8.5 hrs',wlb:'90%'},
    fin:{gross:'$380,000',grossTrend:'12% Increase from last year',net:'$22,800',bonus:'$45,000',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Executive Platinum',v:'$2,400 /mo'},
      {i:'wallet',n:'Transportation',d:'Executive Allowance',v:'$600 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Executive Group',v:'$2,000,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Pro 16"',s:'SN-4491-002',st:'Excellent'},
      {i:'phone',n:'iPhone 15 Pro',s:'SN-9921-X43',st:'Good'},
      {i:'shield',n:'Security Access Card',s:'AC-10443',st:'Active'}
    ],
    app:{r:4.8,m:5,lbl:'Outstanding',yr:'2025',filled:5,t:'"Robert has demonstrated exceptional executive leadership this year, driving record growth."',rev:'— Board of Directors'},
    disc:{clean:true},
    exit:false
  },
  'Grace Adams': {
    status:'Active',type:'Permanent',workMode:'Hybrid',grade:'Grade 5',joiningDate:'Jun 12, 2021',tenure:'4 Years',
    gender:'Female',dob:'Sep 8, 1990',nationality:'British',reportsTo:'Robert Hayes',directReports:'2 Employees',emergency:'+1 555-0102',bloodGroup:'O+',
    leave:[
      {l:'Annual Leave',u:21,t:25,c:'#d21787'},{l:'Sick Leave',u:6,t:10,c:'#f59e0b'},{l:'Compassionate',u:2,t:5,c:'#5c67f2'},{l:'Maternity Leave',u:0,t:26,c:'#14b8a6'}
    ],
    att:{present:'19 / 22',lateness:'0 Times',overtime:'5.2 hrs',wlb:'78%'},
    fin:{gross:'$115,000',grossTrend:'5% Increase from last year',net:'$6,900',bonus:'$8,500',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Family Plan',v:'$1,200 /mo'},
      {i:'wallet',n:'Transportation',d:'Hybrid Allowance',v:'$250 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$500,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Air M3',s:'SN-8823-A12',st:'Excellent'},
      {i:'phone',n:'iPhone 15',s:'SN-7745-Y99',st:'Good'},
      {i:'shield',n:'Access Card Level 3',s:'AC-20456',st:'Active'}
    ],
    app:{r:3.8,m:5,lbl:'Exceeds Expectations',yr:'2025',filled:4,t:'"Grace has been a reliable HR partner, handling complex employee relations with care."',rev:'— Robert Hayes (CEO)'},
    disc:{clean:true},
    exit:false
  },
  'James Carter': {
    status:'Active',type:'Permanent',workMode:'Office',grade:'Grade 7',joiningDate:'Mar 1, 2019',tenure:'7 Years',
    gender:'Male',dob:'Jul 22, 1982',nationality:'Canadian',reportsTo:'Robert Hayes',directReports:'3 Employees',emergency:'+1 555-0103',bloodGroup:'B+',
    leave:[
      {l:'Annual Leave',u:10,t:25,c:'#d21787'},{l:'Sick Leave',u:2,t:10,c:'#f59e0b'},{l:'Compassionate',u:0,t:5,c:'#5c67f2'},{l:'Paternity Leave',u:0,t:10,c:'#14b8a6'}
    ],
    att:{present:'20 / 22',lateness:'3 Times',overtime:'15.0 hrs',wlb:'65%'},
    fin:{gross:'$275,000',grossTrend:'8% Increase from last year',net:'$16,500',bonus:'$30,000',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Executive Plus',v:'$1,800 /mo'},
      {i:'wallet',n:'Transportation',d:'Executive Allowance',v:'$500 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$750,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Pro 14"',s:'SN-5512-B88',st:'Excellent'},
      {i:'phone',n:'iPhone 15 Pro',s:'SN-3321-K77',st:'Good'},
      {i:'shield',n:'Access Card Level 5',s:'AC-10444',st:'Active'}
    ],
    app:{r:4.0,m:5,lbl:'Exceeds Expectations',yr:'2025',filled:4,t:'"James has strengthened our financial controls and reporting accuracy significantly."',rev:'— Robert Hayes (CEO)'},
    disc:{clean:true},
    exit:false
  },
  'Lisa Park': {
    status:'Active',type:'Permanent',workMode:'Remote',grade:'Grade 6',joiningDate:'Nov 3, 2020',tenure:'5 Years',
    gender:'Female',dob:'Feb 14, 1988',nationality:'South Korean',reportsTo:'Robert Hayes',directReports:'4 Employees',emergency:'+1 555-0104',bloodGroup:'AB+',
    leave:[
      {l:'Annual Leave',u:19,t:25,c:'#d21787'},{l:'Sick Leave',u:4,t:10,c:'#f59e0b'},{l:'Compassionate',u:3,t:5,c:'#5c67f2'},{l:'Maternity Leave',u:0,t:26,c:'#14b8a6'}
    ],
    att:{present:'22 / 22',lateness:'0 Times',overtime:'3.0 hrs',wlb:'92%'},
    fin:{gross:'$185,000',grossTrend:'10% Increase from last year',net:'$11,100',bonus:'$20,000',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Family Plan',v:'$1,200 /mo'},
      {i:'wallet',n:'Remote Work',d:'WFH Stipend',v:'$350 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$500,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Pro 14"',s:'SN-6677-C44',st:'Excellent'},
      {i:'phone',n:'iPhone 14 Pro',s:'SN-2211-P90',st:'Good'},
      {i:'shield',n:'Access Card Level 4',s:'AC-30567',st:'Active'}
    ],
    app:{r:4.5,m:5,lbl:'Outstanding',yr:'2025',filled:5,t:'"Lisa\'s marketing campaigns have driven exceptional brand growth this year."',rev:'— Robert Hayes (CEO)'},
    disc:{clean:true},
    exit:false
  },
  'Anna Chen': {
    status:'Active',type:'Contract',workMode:'Hybrid',grade:'Grade 4',joiningDate:'Jan 10, 2023',tenure:'3 Years',
    gender:'Female',dob:'Apr 5, 1993',nationality:'Chinese',reportsTo:'—',directReports:'0 Employees',emergency:'+1 555-0105',bloodGroup:'A+',
    leave:[
      {l:'Annual Leave',u:12,t:20,c:'#d21787'},{l:'Sick Leave',u:5,t:10,c:'#f59e0b'},{l:'Compassionate',u:1,t:5,c:'#5c67f2'},{l:'Maternity Leave',u:0,t:26,c:'#14b8a6'}
    ],
    att:{present:'20 / 22',lateness:'4 Times',overtime:'2.5 hrs',wlb:'70%'},
    fin:{gross:'$105,000',grossTrend:'3% Increase from last year',net:'$6,300',bonus:'$5,000',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Basic Plan',v:'$600 /mo'},
      {i:'wallet',n:'Transportation',d:'Public Transit',v:'$150 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$250,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Air M2',s:'SN-9988-D66',st:'Good'},
      {i:'phone',n:'iPhone 14',s:'SN-6543-M21',st:'Good'},
      {i:'shield',n:'Access Card Level 2',s:'AC-40889',st:'Active'}
    ],
    app:{r:3.5,m:5,lbl:'Meets Expectations',yr:'2025',filled:3,t:'"Anna has delivered solid frontend work, though could improve on deadlines."',rev:'— Lead Engineer'},
    disc:{clean:true},
    exit:false
  },
  'Priya Sharma': {
    status:'Active',type:'Permanent',workMode:'Office',grade:'Grade 4',joiningDate:'Aug 21, 2022',tenure:'3 Years',
    gender:'Female',dob:'Oct 30, 1991',nationality:'Indian',reportsTo:'Grace Adams',directReports:'0 Employees',emergency:'+1 555-0106',bloodGroup:'O-',
    leave:[
      {l:'Annual Leave',u:16,t:25,c:'#d21787'},{l:'Sick Leave',u:7,t:10,c:'#f59e0b'},{l:'Compassionate',u:4,t:5,c:'#5c67f2'},{l:'Maternity Leave',u:0,t:26,c:'#14b8a6'}
    ],
    att:{present:'18 / 22',lateness:'2 Times',overtime:'6.0 hrs',wlb:'72%'},
    fin:{gross:'$98,000',grossTrend:'4% Increase from last year',net:'$5,880',bonus:'$4,500',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Family Plan',v:'$1,200 /mo'},
      {i:'wallet',n:'Transportation',d:'Public Transit',v:'$150 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$250,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Air M2',s:'SN-1122-E55',st:'Good'},
      {i:'phone',n:'iPhone 14',s:'SN-8876-L44',st:'Fair'},
      {i:'shield',n:'Access Card Level 2',s:'AC-50990',st:'Active'}
    ],
    app:{r:3.2,m:5,lbl:'Meets Expectations',yr:'2025',filled:3,t:'"Priya is detailed in her HR work and continues to grow in employee relations."',rev:'— Grace Adams (HR Manager)'},
    disc:{clean:true},
    exit:false
  },
  'Michael Brown': {
    status:'Active',type:'Permanent',workMode:'Office',grade:'Grade 3',joiningDate:'Feb 17, 2026',tenure:'0 Years',
    gender:'Male',dob:'Nov 5, 1995',nationality:'British',reportsTo:'James Carter',directReports:'0 Employees',emergency:'+1 555-0107',bloodGroup:'B-',
    leave:[
      {l:'Annual Leave',u:5,t:20,c:'#d21787'},{l:'Sick Leave',u:2,t:10,c:'#f59e0b'},{l:'Compassionate',u:0,t:5,c:'#5c67f2'},{l:'Paternity Leave',u:0,t:10,c:'#14b8a6'}
    ],
    att:{present:'21 / 22',lateness:'1 Time',overtime:'4.0 hrs',wlb:'85%'},
    fin:{gross:'$82,000',grossTrend:'New Hire',net:'$4,920',bonus:'$2,500',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Basic Plan',v:'$600 /mo'},
      {i:'wallet',n:'Transportation',d:'Public Transit',v:'$150 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$250,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Pro 14"',s:'SN-7711-F33',st:'New'},
      {i:'phone',n:'iPhone 15',s:'SN-2233-R88',st:'New'},
      {i:'shield',n:'Access Card Level 2',s:'AC-61001',st:'Active'}
    ],
    app:{r:0,m:5,lbl:'Not Yet Rated',yr:'—',filled:0,t:'"Michael is new to the team and has shown strong initial progress."',rev:'— James Carter (CFO)'},
    disc:{clean:true},
    exit:false
  },
  'Alex Rivera': {
    status:'Active',type:'Permanent',workMode:'Remote',grade:'Grade 5',joiningDate:'Apr 8, 2022',tenure:'4 Years',
    gender:'Male',dob:'Jun 17, 1990',nationality:'Mexican',reportsTo:'Lisa Park',directReports:'2 Employees',emergency:'+1 555-0108',bloodGroup:'AB-',
    leave:[
      {l:'Annual Leave',u:20,t:25,c:'#d21787'},{l:'Sick Leave',u:1,t:10,c:'#f59e0b'},{l:'Compassionate',u:0,t:5,c:'#5c67f2'},{l:'Paternity Leave',u:5,t:10,c:'#14b8a6'}
    ],
    att:{present:'21 / 22',lateness:'0 Times',overtime:'7.0 hrs',wlb:'82%'},
    fin:{gross:'$145,000',grossTrend:'7% Increase from last year',net:'$8,700',bonus:'$12,000',bonusDate:'Dec 2026'},
    ben:[
      {i:'wallet',n:'Health Insurance',d:'Family Plan',v:'$1,200 /mo'},
      {i:'wallet',n:'Remote Work',d:'WFH Stipend',v:'$350 /mo'},
      {i:'briefcase',n:'Life Insurance',d:'Standard Group',v:'$500,000'}
    ],
    assets:[
      {i:'laptop',n:'MacBook Pro 16"',s:'SN-3344-G11',st:'Excellent'},
      {i:'phone',n:'iPhone 15 Pro',s:'SN-9988-T66',st:'Good'},
      {i:'shield',n:'Access Card Level 3',s:'AC-10445',st:'Active'}
    ],
    app:{r:4.2,m:5,lbl:'Exceeds Expectations',yr:'2025',filled:4,t:'"Alex has elevated our design system and user experience across all products."',rev:'— Lisa Park (Marketing Director)'},
    disc:{clean:true},
    exit:false
  }
};

/* ============================================================
   DEEP VIEW MODAL
   ============================================================ */
var dvDonutChart = null;

function populateDeepView(name) {
  var d = EMP_DEEP_DATA[name];
  if (!d) return;

  var metaEl = document.getElementById('pCardMetaDept');
  var roleEl = document.getElementById('pCardRole');
  var dept = metaEl ? metaEl.innerText.split(' \u2022 ')[0] : '—';
  var role = roleEl ? roleEl.innerText : '—';

  /* Employment Details */
  var empCard = document.getElementById('dvEmploymentCard');
  if (empCard) {
    empCard.innerHTML =
      '<div class="dv-card-headline"><i data-lucide="shield-check" style="width:18px;height:18px;"></i><h3>Employment Details</h3></div>' +
      '<div class="dv-kv-grid">' +
        '<div class="dv-field"><label>Department</label><p>' + dept + '</p></div>' +
        '<div class="dv-field"><label>Job Role</label><p>' + role + '</p></div>' +
        '<div class="dv-field"><label>Status</label><p>' + d.status + '</p></div>' +
        '<div class="dv-field"><label>Type</label><p>' + d.type + '</p></div>' +
        '<div class="dv-field"><label>Work Mode</label><p>' + d.workMode + '</p></div>' +
        '<div class="dv-field"><label>Grade Level</label><p>' + d.grade + '</p></div>' +
        '<div class="dv-field"><label>Joining Date</label><p>' + d.joiningDate + '</p></div>' +
        '<div class="dv-field"><label>Tenure</label><p>' + d.tenure + '</p></div>' +
      '</div>';
  }

  /* Personal Information */
  var perCard = document.getElementById('dvPersonalCard');
  if (perCard) {
    perCard.innerHTML =
      '<div class="dv-card-headline"><i data-lucide="user" style="width:18px;height:18px;"></i><h3>Personal Information</h3></div>' +
      '<div class="dv-kv-grid">' +
        '<div class="dv-field" style="grid-column:span 2"><label>Full Name</label><p>' + name + '</p></div>' +
        '<div class="dv-field"><label>Gender</label><p>' + d.gender + '</p></div>' +
        '<div class="dv-field" style="grid-column:span 2"><label>Date of Birth</label><p>' + d.dob + '</p></div>' +
        '<div class="dv-field"><label>Nationality</label><p>' + d.nationality + '</p></div>' +
        '<div class="dv-field" style="grid-column:span 2"><label>Reporting Manager</label><p>' + d.reportsTo + '</p></div>' +
        '<div class="dv-field"><label>Direct Reports</label><p>' + d.directReports + '</p></div>' +
        '<div class="dv-field"><label>Emergency Contact</label><p>' + d.emergency + '</p></div>' +
        '<div class="dv-field"><label>Blood Group</label><p>' + d.bloodGroup + '</p></div>' +
      '</div>';
  }

  /* Leave balances */
  var leaveList = document.querySelector('#deepViewModal .dv-leave-list');
  if (leaveList && d.leave) {
    leaveList.innerHTML = '';
    d.leave.forEach(function(lv) {
      var pct = lv.t > 0 ? (lv.u / lv.t) * 100 : 0;
      var row = document.createElement('div');
      row.className = 'dv-leave-row';
      row.innerHTML =
        '<div class="dv-leave-meta"><span>' + lv.l + '</span><span><strong>' + lv.u + '</strong> / ' + lv.t + ' Days Used</span></div>' +
        '<div class="dv-bar-track"><div class="dv-bar-fill" style="width:' + pct + '%;background:' + lv.c + '"></div></div>';
      leaveList.appendChild(row);
    });
  }

  /* Attendance */
  var dvCapsules = document.querySelectorAll('#deepViewModal .dv-capsule');
  if (dvCapsules.length >= 4 && d.att) {
    var attMap = [d.att.present, d.att.lateness, d.att.overtime, d.att.wlb];
    dvCapsules.forEach(function(cap, ci) {
      var valSpan = cap.querySelector('.dv-capsule-val');
      if (valSpan && attMap[ci]) valSpan.innerText = attMap[ci];
    });
  }

  /* Financial */
  var dvCash = document.querySelectorAll('#deepViewModal .dv-financial-trio .dv-cash');
  if (dvCash.length >= 3 && d.fin) {
    dvCash[0].innerText = d.fin.gross;
    dvCash[1].innerText = d.fin.net;
    dvCash[2].innerText = d.fin.bonus;
  }
  var dvCaps = document.querySelectorAll('#deepViewModal .dv-financial-trio .dv-caption');
  if (dvCaps.length >= 3 && d.fin) {
    dvCaps[0].innerHTML = '<i data-lucide="trending-up" style="width:14px;height:14px;"></i> ' + d.fin.grossTrend;
    dvCaps[2].innerHTML = 'Next payout: ' + d.fin.bonusDate;
  }

  /* Benefits */
  if (d.ben) {
    var benParent = document.querySelector('#deepViewModal .dv-card .dv-benefit-row') ?
      document.querySelector('#deepViewModal .dv-card .dv-benefit-row').parentNode : null;
    if (benParent) {
      benParent.innerHTML = '';
      d.ben.forEach(function(b) {
        var row = document.createElement('div');
        row.className = 'dv-benefit-row';
        row.innerHTML =
          '<div class="dv-benefit-left"><div class="dv-benefit-icon"><i data-lucide="' + b.i + '" style="width:18px;height:18px;"></i></div><div><h5>' + b.n + '</h5><p>' + b.d + '</p></div></div>' +
          '<div class="dv-benefit-val">' + b.v + '</div>';
        benParent.appendChild(row);
      });
    }
  }

  /* Assets */
  if (d.assets) {
    var assetStack = document.querySelector('#deepViewModal .dv-asset-stack');
    if (assetStack) {
      assetStack.innerHTML = '';
      d.assets.forEach(function(a) {
        var card = document.createElement('div');
        card.className = 'dv-asset-card';
        card.innerHTML =
          '<div class="dv-asset-icon"><i data-lucide="' + a.i + '" style="width:20px;height:20px;"></i></div>' +
          '<h4>' + a.n + '</h4><span class="dv-serial">' + a.s + '</span>' +
          '<div class="dv-asset-footer"><span>Status</span><span class="dv-status ' + a.st.toLowerCase() + '">' + a.st + '</span></div>';
        assetStack.appendChild(card);
      });
    }
  }

  /* Appraisal */
  if (d.app) {
    var donutText = document.querySelector('#deepViewModal .dv-donut-text');
    if (donutText) donutText.innerText = d.app.r > 0 ? d.app.r : '—';
    var apprH = document.querySelector('#deepViewModal .dv-appraisal-text h4');
    if (apprH) apprH.innerText = d.app.lbl;
    var apprP = document.querySelector('#deepViewModal .dv-appraisal-text p');
    if (apprP) apprP.innerText = 'Annual Review ' + d.app.yr;
    var starIcons = document.querySelectorAll('#deepViewModal .dv-stars i');
    starIcons.forEach(function(si, idx) {
      si.className = idx < d.app.filled ? 'dv-star-filled' : 'dv-star-empty';
      si.setAttribute('data-lucide', 'star');
    });
    var tP = document.querySelector('#deepViewModal .dv-testimonial p');
    if (tP) tP.innerText = d.app.t;
    var tS = document.querySelector('#deepViewModal .dv-testimonial span');
    if (tS) tS.innerText = '\u2014 ' + d.app.rev;
  }

  /* Disciplinary */
  var discCard = document.querySelector('#deepViewModal .dv-empty-state');
  if (discCard && d.disc) {
    if (d.disc.clean) {
      var shieldIcon = discCard.querySelector('.dv-shield-icon i');
      if (shieldIcon) {
        shieldIcon.setAttribute('data-lucide', 'shield-check');
        shieldIcon.setAttribute('style', 'width:28px;height:28px;');
      }
      discCard.querySelector('h4').innerText = 'Clear Record';
      discCard.querySelector('p').innerText = 'No disciplinary actions or warnings found.';
    } else {
      var shieldIcon2 = discCard.querySelector('.dv-shield-icon i');
      if (shieldIcon2) {
        shieldIcon2.setAttribute('data-lucide', 'alert-triangle');
        shieldIcon2.setAttribute('style', 'width:28px;height:28px;');
      }
      discCard.querySelector('h4').innerText = d.disc.title || 'Record Found';
      discCard.querySelector('p').innerText = d.disc.message || '';
    }
  }

  /* Exit */
  var exitBlock = document.querySelector('#deepViewModal .dv-exit-block');
  if (exitBlock) {
    if (d.exit) {
      exitBlock.querySelector('h4').innerText = 'In Exit Cycle';
      exitBlock.querySelector('p').innerText = 'This employee is flagged for offboarding or termination.';
      exitBlock.querySelector('.dv-exit-action').innerText = 'View Exit Plan';
    } else {
      exitBlock.querySelector('h4').innerText = 'Not in Exit Cycle';
      exitBlock.querySelector('p').innerText = 'This employee is currently active and not flagged for offboarding or termination.';
      exitBlock.querySelector('.dv-exit-action').innerText = 'Initiate Separation';
    }
  }

  /* Donut chart */
  if (d.app && d.app.r > 0) {
    var pct = (d.app.r / d.app.m) * 100;
    if (dvDonutChart) {
      dvDonutChart.destroy();
      dvDonutChart = null;
    }
    initDvDonutChart(pct);
  }
}

function openDeepViewModal() {
  var modal = document.getElementById('deepViewModal');
  if (!modal) return;

  var nameEl = document.getElementById('pCardName');
  var roleEl = document.getElementById('pCardRole');
  var metaEl = document.getElementById('pCardMetaDept');
  var initEl = document.getElementById('pCardInitials');

  var name = nameEl ? nameEl.innerText : 'Employee';
  var role = roleEl ? roleEl.innerText : '—';
  var meta = metaEl ? metaEl.innerText : '—';
  var initials = initEl ? initEl.innerText : '—';

  var dvAvatar = document.getElementById('dvAvatar');
  var dvTitle = document.getElementById('dvTitle');
  var dvSubtitle = document.getElementById('dvSubtitle');
  if (dvAvatar) dvAvatar.innerText = initials;
  if (dvTitle) dvTitle.innerText = name + ' \u2014 Deep View';
  if (dvSubtitle) dvSubtitle.innerText = meta;

  populateDeepView(name);

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  lucide.createIcons();
}

function closeDeepViewModal() {
  var modal = document.getElementById('deepViewModal');
  if (modal) {
    modal.classList.remove('open');
    document.body.style.overflow = '';
  }
}

function initDvDonutChart(fillPct) {
  if (fillPct === undefined) fillPct = 84;
  var canvas = document.getElementById('dvDonutCanvas');
  if (!canvas || typeof Chart === 'undefined') return;
  if (dvDonutChart) {
    dvDonutChart.destroy();
    dvDonutChart = null;
  }
  canvas.width = 80;
  canvas.height = 80;
  var ctx = canvas.getContext('2d');
  dvDonutChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [fillPct, 100 - fillPct],
        backgroundColor: ['#d21787', '#fdf2f8'],
        borderWidth: 0
      }]
    },
    options: {
      cutout: '78%',
      responsive: false,
      plugins: { tooltip: { enabled: false }, legend: { display: false } }
    }
  });
}

document.addEventListener('click', function(e) {
  if (e.target.classList.contains('modal-overlay') && e.target.id === 'deepViewModal') {
    closeDeepViewModal();
  }
});
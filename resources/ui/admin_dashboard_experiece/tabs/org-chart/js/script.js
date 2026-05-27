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

function navigateToProfile(name, role, department, initials, email) {
  document.getElementById('pCardName').innerText = name;
  document.getElementById('pCardRole').innerText = role;
  document.getElementById('pCardMetaDept').innerText = department + " \u2022 EMP004";
  document.getElementById('pCardInitials').innerText = initials;
  document.getElementById('pCardEmail').innerText = email;

  document.getElementById('mFullName').innerText = name;
  document.getElementById('mRole').innerText = role;
  document.getElementById('mDept').innerText = department;

  document.getElementById('orgChartPage').classList.remove('active-view');
  document.getElementById('profilePage').classList.add('active-view');

  var overviewTabBtn = document.querySelector('#view-org-chart .profile-navigation-box .profile-nav-item');
  if (overviewTabBtn) switchProfileTab('Overview', overviewTabBtn);

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToOrgChart() {
  document.getElementById('profilePage').classList.remove('active-view');
  document.getElementById('orgChartPage').classList.add('active-view');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function switchProfileTab(tabName, element) {
  document.querySelectorAll('#view-org-chart .profile-nav-item').forEach(function(el) {
    el.classList.remove('active-tab');
  });
  element.classList.add('active-tab');

  document.getElementById('dynamicTabTitle').innerText = tabName;
  document.getElementById('dynamicTabSubtitle').innerText = tabName === 'Overview' ? 'Detailed employee data management.' : 'The more details page.';

  var overviewView = document.getElementById('subView-Overview');
  var fallbackView = document.getElementById('subView-GenericFallback');
  var fallbackTitle = document.getElementById('fallbackTitle');
  var fallbackIcon = document.getElementById('fallbackIcon');

  if (tabName === 'Overview') {
    overviewView.style.display = 'block';
    fallbackView.style.display = 'none';
  } else {
    overviewView.style.display = 'none';
    fallbackView.style.display = 'flex';
    fallbackTitle.innerText = tabName + " Component Workspace";

    var iconName = 'layers';
    if (tabName === 'Body Composition') iconName = 'activity';
    else if (tabName === 'Compensation') iconName = 'credit-card';
    else if (tabName === 'Time & Leave') iconName = 'calendar';
    else if (tabName === 'Documents') iconName = 'file-text';
    else if (tabName === 'Assets') iconName = 'laptop';
    else if (tabName === 'Performance') iconName = 'award';
    else if (tabName === 'Exit Details') iconName = 'door-open';

    fallbackIcon.setAttribute('data-lucide', iconName);
    if (typeof lucide !== 'undefined') { lucide.createIcons(); }
  }
}
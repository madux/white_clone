document.addEventListener('DOMContentLoaded', () => {

  const rolesDataset = {
    'recruiter': { name: 'Recruiter', desc: 'Create jobs, manage candidates, moving stages, schedules, and workflows setup.', dotColor: '#8B5CF6', isSystem: true },
    'super-admin': { name: 'Super Admin', desc: 'Full programmatic control over platform instances, system logs, metrics tracking, global parameters.', dotColor: '#EF4444', isSystem: true },
    'admin': { name: 'Admin', desc: 'Manage workspace configuration, departments, billing profiles, and integration hooks.', dotColor: '#F59E0B', isSystem: true },
    'hiring-manager': { name: 'Hiring Manager', desc: 'Review assigned pipeline candidates, input scorecard feedback, and approve selection proposals.', dotColor: '#06B6D4', isSystem: true },
    'viewer': { name: 'Viewer', desc: 'Read-only access to workspace data and pipeline overviews.', dotColor: '#6B7280', isSystem: true },
    'agency-partner': { name: 'Agency Partner', desc: 'External access configured for third-party contractor submissions.', dotColor: '#10B981', isSystem: false },
    'finance-reviewer': { name: 'Finance Reviewer', desc: 'Reports and billing access with read permissions on compensation data.', dotColor: '#8B5CF6', isSystem: false }
  };

  const roleItems = document.querySelectorAll('.tm-role-item');
  const activeRoleDot = document.getElementById('activeRoleDot');
  const activeRoleName = document.getElementById('activeRoleName');
  const activeRoleDesc = document.getElementById('activeRoleDesc');
  const systemPill = document.querySelector('.tm-system-pill');
  const alertBanner = document.querySelector('.tm-alert-banner');

  roleItems.forEach(item => {
    item.addEventListener('click', () => {
      roleItems.forEach(i => i.classList.remove('tm-active'));
      item.classList.add('tm-active');
      const selectedId = item.getAttribute('data-role-id');
      const meta = rolesDataset[selectedId];
      if (meta) {
        activeRoleName.textContent = meta.name;
        activeRoleDesc.textContent = meta.desc;
        activeRoleDot.style.backgroundColor = meta.dotColor;
        if (meta.isSystem) {
          systemPill.style.display = 'inline-block';
          if (alertBanner) alertBanner.style.display = 'flex';
        } else {
          systemPill.style.display = 'none';
          if (alertBanner) alertBanner.style.display = 'none';
        }
      }
    });
  });

  const tabs = document.querySelectorAll('.tm-tab-btn');
  const tabUsersPane = document.getElementById('tabContentUsers');
  const tabPermissionsPane = document.getElementById('tabContentPermissions');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('tm-active'));
      tab.classList.add('tm-active');
      const target = tab.getAttribute('data-tab-target');
      if (target === 'users-in-this-role-tab') {
        tabUsersPane.classList.add('tm-active');
        tabPermissionsPane.classList.remove('tm-active');
      } else {
        tabPermissionsPane.classList.add('tm-active');
        tabUsersPane.classList.remove('tm-active');
      }
    });
  });

  document.querySelectorAll('.tm-toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isChecked = toggle.classList.toggle('tm-checked');
      toggle.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });
  });

  document.querySelectorAll('.tm-quick-set-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      document.querySelectorAll('#tabContentPermissions .tm-toggle-switch').forEach(toggle => {
        if (action === 'full') {
          toggle.classList.add('tm-checked');
          toggle.setAttribute('aria-checked', 'true');
        } else if (action === 'none') {
          toggle.classList.remove('tm-checked');
          toggle.setAttribute('aria-checked', 'false');
        } else if (action === 'view') {
          const label = toggle.closest('.tm-permission-row')?.querySelector('.tm-perm-label')?.textContent?.toLowerCase() || '';
          if (label.includes('view') || label.includes('read')) {
            toggle.classList.add('tm-checked');
            toggle.setAttribute('aria-checked', 'true');
          } else {
            toggle.classList.remove('tm-checked');
            toggle.setAttribute('aria-checked', 'false');
          }
        }
      });
    });
  });

  document.querySelectorAll('.tm-accordion-trigger').forEach(trigger => {
    trigger.addEventListener('click', () => {
      const parentNode = trigger.closest('.tm-accordion-node');
      const arrow = trigger.querySelector('.tm-arrow-indicator');
      const isOpen = parentNode.classList.toggle('tm-expanded');
      if (arrow) {
        if (isOpen) {
          arrow.classList.remove('fa-chevron-down');
          arrow.classList.add('fa-chevron-up');
        } else {
          arrow.classList.remove('fa-chevron-up');
          arrow.classList.add('fa-chevron-down');
        }
      }
    });
  });

  document.querySelectorAll('.tm-palette-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.tm-palette-color-dot').forEach(d => d.classList.remove('tm-selected'));
      dot.classList.add('tm-selected');
    });
  });

  document.querySelectorAll('.tm-trigger-create-role, .tm-inline-trigger-create-custom').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      console.log('Create Role clicked');
    });
  });

});
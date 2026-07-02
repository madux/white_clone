document.addEventListener('DOMContentLoaded', () => {

  // --- STATE ---
  const rolesDataset = {
    'recruiter': { name: 'Recruiter', desc: 'Create jobs, manage candidates, moving stages, schedules, and workflows setup.', dotColor: '#8B5CF6', isSystem: true },
    'super-admin': { name: 'Super Admin', desc: 'Full programmatic control over platform instances, system logs, metrics tracking, global parameters.', dotColor: '#EF4444', isSystem: true },
    'admin': { name: 'Admin', desc: 'Manage workspace configuration, departments, billing profiles, and integration hooks.', dotColor: '#F59E0B', isSystem: true },
    'hiring-manager': { name: 'Hiring Manager', desc: 'Review assigned pipeline candidates, input scorecard feedback, and approve selection proposals.', dotColor: '#06B6D4', isSystem: true },
    'viewer': { name: 'Viewer', desc: 'Read-only access to workspace data and pipeline overviews.', dotColor: '#6B7280', isSystem: true },
    'agency-partner': { name: 'Agency Partner', desc: 'External access configured for third-party contractor submissions.', dotColor: '#10B981', isSystem: false },
    'finance-reviewer': { name: 'Finance Reviewer', desc: 'Reports and billing access with read permissions on compensation data.', dotColor: '#8B5CF6', isSystem: false }
  };
  let activeRoleId = 'recruiter';

  // --- PRIMARY TAB SWITCHER ---
  const primaryTabs = document.querySelectorAll('.tm-primary-tab');
  const primaryPanes = {
    members: document.getElementById('paneMembers'),
    teams: document.getElementById('paneTeams'),
    autojoin: document.getElementById('paneAutojoin'),
    roles: document.getElementById('paneRoles'),
    'team-permissions': document.getElementById('paneTeamPermissions'),
  };

  primaryTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      primaryTabs.forEach(t => t.classList.remove('tm-primary-tab--active'));
      tab.classList.add('tm-primary-tab--active');
      const target = tab.getAttribute('data-primary-target');
      Object.values(primaryPanes).forEach(p => { if (p) p.classList.remove('tm-primary-pane--active'); });
      if (primaryPanes[target]) primaryPanes[target].classList.add('tm-primary-pane--active');
    });
  });

  // --- ROLE SUB-TABS ---
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

  // --- ROLE ITEM CLICKS ---
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
      activeRoleId = selectedId;
      const meta = rolesDataset[selectedId];
      if (meta) {
        activeRoleName.textContent = meta.name;
        activeRoleDesc.textContent = meta.desc;
        activeRoleDot.style.backgroundColor = meta.dotColor;
        const roleLabel = document.getElementById('sheetInviteRoleLabel');
        if (roleLabel) roleLabel.textContent = meta.name;
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

  // --- OVERLAY / SHEET / MODAL LOGIC ---
  const globalBackdrop = document.getElementById('globalBackdrop');
  const sheetInviteUser = document.getElementById('sheetInviteUser');
  const sheetAddExistingUser = document.getElementById('sheetAddExistingUser');
  const modalCreateRole = document.getElementById('modalCreateRole');
  const modalCreateTeam = document.getElementById('modalCreateTeam');

  function openOverlay(el) {
    globalBackdrop.classList.add('tm-visible');
    el.classList.add('tm-visible');
  }

  function closeAllOverlays() {
    globalBackdrop.classList.remove('tm-visible');
    [sheetInviteUser, sheetAddExistingUser, modalCreateRole, modalCreateTeam].forEach(el => {
      if (el) el.classList.remove('tm-visible');
    });
  }

  const btnInviteNewUser = document.getElementById('btnInviteNewUser');
  const btnAddUserToRole = document.getElementById('btnAddUserToRole');
  const btnCreateTeam = document.getElementById('btnOpenCreateTeam');

  if (btnInviteNewUser) btnInviteNewUser.addEventListener('click', () => openOverlay(sheetInviteUser));
  if (btnAddUserToRole) btnAddUserToRole.addEventListener('click', () => openOverlay(sheetAddExistingUser));
  if (btnCreateTeam) btnCreateTeam.addEventListener('click', () => openOverlay(modalCreateTeam));

  document.querySelectorAll('.tm-trigger-create-role, .tm-inline-trigger-create-custom').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      openOverlay(modalCreateRole);
    });
  });

  document.querySelectorAll('.tm-sheet-close-btn, .tm-modal-close-btn, .tm-modal-cancel, .tm-global-overlay-backdrop, #btnCancelCreateTeam').forEach(el => {
    el.addEventListener('click', closeAllOverlays);
  });

  document.querySelectorAll('.tm-modal-cancel-plain').forEach(el => {
    el.addEventListener('click', closeAllOverlays);
  });

  // --- TOGGLE SWITCHES ---
  document.querySelectorAll('.tm-toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', () => {
      const isChecked = toggle.classList.toggle('tm-checked');
      toggle.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });
  });

  // --- QUICK SET ---
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

  // --- ACCORDION ---
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

  // --- COLOR PALETTE ---
  document.querySelectorAll('.tm-palette-color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      document.querySelectorAll('.tm-palette-color-dot').forEach(d => d.classList.remove('tm-selected'));
      dot.classList.add('tm-selected');
    });
  });

  // --- FORM SUBMITS ---
  document.querySelectorAll('#btnSubmitInvite, #btnSubmitAddExisting, #btnSubmitCreateRole, #btnSavePermissions, #btnSubmitCreateTeam').forEach(btn => {
    if (btn) btn.addEventListener('click', closeAllOverlays);
  });

  // ============================================================
  // --- INVITE MEMBER MODAL ---
  // ============================================================
  const inviteBackdrop = document.getElementById('modalInviteMemberBackdrop');
  const inviteModal = document.getElementById('modalInviteMember');

  function openInviteModal() {
    if (inviteBackdrop) inviteBackdrop.style.display = 'flex';
  }

  function closeInviteModal() {
    if (inviteBackdrop) inviteBackdrop.style.display = 'none';
  }

  document.querySelectorAll('#paneMembers .btn-invite-member').forEach(btn => {
    btn.addEventListener('click', openInviteModal);
  });

  const btnCloseInvite = document.getElementById('btnCloseInviteModal');
  const btnCancelInvite = document.getElementById('btnCancelInviteModal');
  const btnSubmitInviteMember = document.getElementById('btnSubmitInviteMember');

  if (btnCloseInvite) btnCloseInvite.addEventListener('click', closeInviteModal);
  if (btnCancelInvite) btnCancelInvite.addEventListener('click', closeInviteModal);
  if (btnSubmitInviteMember) btnSubmitInviteMember.addEventListener('click', closeInviteModal);

  if (inviteBackdrop) {
    inviteBackdrop.addEventListener('click', (e) => {
      if (e.target === inviteBackdrop) closeInviteModal();
    });
  }

  // ============================================================
  // --- TEAMS SEARCH FILTER ---
  // ============================================================
  const teamsSearch = document.querySelector('#paneTeams .tm-search-input');
  if (teamsSearch) {
    teamsSearch.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      const rows = document.querySelectorAll('#teamsTableBody tr');
      rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(query) ? '' : 'none';
      });
    });
  }

  // ============================================================
  // --- TEAM PERMISSIONS: MEMBER SELECTION ---
  // ============================================================
  const permMembers = document.querySelectorAll('.tm-perm-member-item');
  const emptyState = document.getElementById('permEmptyState');
  const detailContent = document.getElementById('permDetailContent');

  permMembers.forEach(member => {
    member.addEventListener('click', function() {
      permMembers.forEach(m => m.classList.remove('tm-active'));
      this.classList.add('tm-active');

      if (emptyState) emptyState.style.display = 'none';
      if (detailContent) {
        detailContent.style.display = 'block';
        const nameEl = this.querySelector('.tm-perm-member-name');
        const labelEl = detailContent.querySelector('.tm-configuring-label strong');
        if (nameEl && labelEl) {
          labelEl.textContent = nameEl.textContent;
        }
      }
    });
  });

  // --- CARD HEADER ACCORDION TOGGLE ---
  document.querySelectorAll('[data-toggle="perm-card"]').forEach(header => {
    header.addEventListener('click', function() {
      const body = this.nextElementSibling;
      if (body && body.classList.contains('tm-perm-card-body')) {
        body.classList.toggle('tm-open');
      }
    });
  });

  // --- PERM CHECKBOX -> UPDATE COUNT ---
  document.querySelectorAll('.tm-perm-checkbox').forEach(cb => {
    cb.addEventListener('change', function() {
      const module = this.getAttribute('data-module');
      const countEl = document.getElementById('count-' + module);
      if (!countEl) return;
      const card = this.closest('.tm-perm-module-card');
      if (!card) return;
      const checkboxes = card.querySelectorAll('.tm-perm-checkbox');
      const total = checkboxes.length;
      const checked = card.querySelectorAll('.tm-perm-checkbox:checked').length;
      countEl.textContent = checked + '/' + total;

      // Show unsaved footer
      const footer = document.getElementById('permUnsavedFooter');
      if (footer) footer.style.display = 'flex';
    });
  });

  // --- DISCARD / SAVE ---
  function discardChanges() {
    const footer = document.getElementById('permUnsavedFooter');
    if (footer) footer.style.display = 'none';
  }

  function savePermissions() {
    const footer = document.getElementById('permUnsavedFooter');
    if (footer) footer.style.display = 'none';
  }

  document.querySelectorAll('#btnPermDiscard, #btnPermDiscardFooter').forEach(btn => {
    if (btn) btn.addEventListener('click', discardChanges);
  });

  document.querySelectorAll('#btnPermSave, #btnPermSaveFooter').forEach(btn => {
    if (btn) btn.addEventListener('click', savePermissions);
  });

});

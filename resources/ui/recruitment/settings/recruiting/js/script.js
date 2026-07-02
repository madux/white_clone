document.addEventListener('DOMContentLoaded', () => {

  // ---- TAB SWITCHING ----
  const tabs = document.querySelectorAll('.rec-tab');
  const panels = document.querySelectorAll('.rec-tab-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('rec-tab--active'));
      panels.forEach(p => p.classList.add('rec-hidden'));
      tab.classList.add('rec-tab--active');
      const id = 'panel-' + tab.dataset.tab;
      const panel = document.getElementById(id);
      if (panel) panel.classList.remove('rec-hidden');
    });
  });

  // ---- MODAL HELPERS ----
  function openModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('rec-modal--open');
      document.body.style.overflow = 'hidden';
    }
  }
  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove('rec-modal--open');
      document.body.style.overflow = '';
    }
  }

  document.querySelectorAll('.rec-modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) closeModal(overlay.id);
    });
  });

  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.rec-modal-overlay.rec-modal--open').forEach(el => closeModal(el.id));
    }
  });

  // ---- CUSTOM FIELDS ----
  document.getElementById('btnAddField').addEventListener('click', () => openModal('modalAddField'));

  // ---- INTERVIEW GUIDES ----
  document.getElementById('btnCreateGuide').addEventListener('click', () => openModal('modalCreateGuide'));

  // ---- PIPELINES ----
  document.getElementById('btnCreatePipeline').addEventListener('click', () => openModal('modalCreatePipeline'));

  // ---- SCHEDULING LINKS ----
  document.getElementById('btnCreateLink').addEventListener('click', () => openModal('modalCreateLink'));

  // ---- LABELS ----
  const btnCreateLabel = document.getElementById('btnCreateLabel');
  const createLabelPanel = document.getElementById('createLabelPanel');
  const btnCancelLabel = document.getElementById('btnCancelLabel');

  btnCreateLabel.addEventListener('click', () => {
    createLabelPanel.classList.toggle('rec-panel--open');
    if (createLabelPanel.classList.contains('rec-panel--open')) {
      createLabelPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
  btnCancelLabel.addEventListener('click', () => {
    createLabelPanel.classList.remove('rec-panel--open');
  });

  document.querySelectorAll('.rec-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      document.querySelectorAll('.rec-swatch').forEach(s => s.classList.remove('rec-swatch--selected'));
      swatch.classList.add('rec-swatch--selected');
    });
  });

  // ---- COPY BUTTONS ----
  document.querySelectorAll('.rec-copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const orig = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
      btn.style.color = 'var(--rec-primary)';
      setTimeout(() => {
        btn.innerHTML = orig;
        btn.style.color = '';
      }, 1500);
    });
  });

  // ---- TASK TEMPLATES ----
  document.getElementById('btnCreateTemplate').addEventListener('click', () => openModal('modalCreateTemplate'));
  document.getElementById('btnNewTemplateCard').addEventListener('click', () => openModal('modalCreateTemplate'));

  document.getElementById('addCreateTemplateTask').addEventListener('click', () => {
    addTaskRow('createTemplateTasks');
  });

  document.getElementById('addEditTemplateTask').addEventListener('click', () => {
    addTaskRow('editTemplateTasks');
  });

  function addTaskRow(containerId) {
    const container = document.getElementById(containerId);
    const row = document.createElement('div');
    row.className = 'rec-task-editor-row';
    row.innerHTML = `
      <input class="rec-task-editor-input" type="text" placeholder="Task title" />
      <div class="rec-task-editor-controls">
        <select class="rec-task-editor-select">
          <option>Recruiter</option>
          <option>Hiring Manager</option>
          <option>Admin</option>
        </select>
        <input class="rec-task-editor-num" type="number" value="1" min="1" />
        <select class="rec-task-editor-select">
          <option>Medium</option>
          <option>High</option>
          <option>Low</option>
        </select>
      </div>
    `;
    container.appendChild(row);
  }

  // ---- TEMPLATE DATA ----
  const templateData = {
    'software-eng': {
      name: 'Software Engineering Hire',
      iconBg: '#dbeafe', iconColor: '#1d4ed8', iconClass: 'fa-laptop',
      tasks: '9', usedCount: '12',
      phases: [
        {
          name: 'SOURCING PHASE',
          tasks: [
            { name: 'Post job to Jobberman & LinkedIn', role: 'Recruiter', day: 1, priority: 'High', auto: null },
            { name: 'Review incoming CVs (target: 50)', role: 'Recruiter', day: 7, priority: 'High', auto: 'Notify if overdue by 1 day' },
          ]
        },
        {
          name: 'SCREENING PHASE',
          tasks: [
            { name: 'Shortlist top 10 candidates', role: 'Recruiter', day: 10, priority: 'Medium', auto: null },
            { name: 'Send screening call invitations', role: 'Recruiter', day: 11, priority: 'Medium', auto: 'Auto-send when shortlist complete' },
            { name: 'Conduct phone screenings', role: 'Recruiter', day: 18, priority: 'Medium', auto: null },
          ]
        },
        {
          name: 'INTERVIEW PHASE',
          tasks: [
            { name: 'Schedule technical interviews', role: 'Recruiter', day: 17, priority: 'High', auto: 'Auto-schedule based on availability' },
            { name: 'Collect hiring manager scorecards', role: 'Hiring Manager', day: 23, priority: 'High', auto: 'Remind 2 hours after interview' },
          ]
        },
        {
          name: 'DECISION PHASE',
          tasks: [
            { name: 'Make hiring decision', role: 'Hiring Manager', day: 25, priority: 'High', auto: null },
            { name: 'Send offer letter', role: 'Recruiter', day: 27, priority: 'High', auto: 'Auto-send when decision approved' },
          ]
        }
      ]
    },
    'marketing': {
      name: 'Marketing Hire',
      iconBg: '#fce7f3', iconColor: '#be185d', iconClass: 'fa-chart-simple',
      tasks: '6', usedCount: '5',
      phases: [
        {
          name: 'SOURCING PHASE',
          tasks: [
            { name: 'Post job to Indeed & Glassdoor', role: 'Recruiter', day: 1, priority: 'High', auto: null },
            { name: 'Review applications and portfolios', role: 'Recruiter', day: 5, priority: 'High', auto: null },
          ]
        },
        {
          name: 'SCREENING PHASE',
          tasks: [
            { name: 'Portfolio review session', role: 'Hiring Manager', day: 8, priority: 'Medium', auto: null },
          ]
        },
        {
          name: 'INTERVIEW PHASE',
          tasks: [
            { name: 'Schedule case study presentation', role: 'Recruiter', day: 12, priority: 'High', auto: 'Auto-schedule with team' },
            { name: 'Final interview with CMO', role: 'Admin', day: 16, priority: 'High', auto: null },
          ]
        },
        {
          name: 'DECISION PHASE',
          tasks: [
            { name: 'Send offer letter', role: 'Recruiter', day: 20, priority: 'High', auto: 'Auto-send on approval' },
          ]
        }
      ]
    },
    'sales': {
      name: 'Sales Representative',
      iconBg: '#d1fae5', iconColor: '#065f46', iconClass: 'fa-briefcase',
      tasks: '7', usedCount: '9',
      phases: [
        {
          name: 'SOURCING PHASE',
          tasks: [
            { name: 'Post to job boards', role: 'Recruiter', day: 1, priority: 'High', auto: null },
            { name: 'Screen applications', role: 'Recruiter', day: 4, priority: 'High', auto: null },
          ]
        },
        {
          name: 'INTERVIEW PHASE',
          tasks: [
            { name: 'Role-play sales scenario', role: 'Recruiter', day: 8, priority: 'High', auto: null },
            { name: 'Panel interview', role: 'Hiring Manager', day: 12, priority: 'High', auto: null },
          ]
        },
        {
          name: 'DECISION PHASE',
          tasks: [
            { name: 'Background check', role: 'Admin', day: 15, priority: 'Medium', auto: null },
            { name: 'Reference check', role: 'Recruiter', day: 16, priority: 'Medium', auto: null },
            { name: 'Send offer letter', role: 'Recruiter', day: 18, priority: 'High', auto: null },
          ]
        }
      ]
    },
    'executive': {
      name: 'Executive Hire',
      iconBg: '#ede9fe', iconColor: '#6d28d9', iconClass: 'fa-user-tie',
      tasks: '10', usedCount: '3',
      phases: [
        {
          name: 'SOURCING PHASE',
          tasks: [
            { name: 'Define executive search criteria', role: 'Admin', day: 1, priority: 'High', auto: null },
            { name: 'Engage executive search firm', role: 'Admin', day: 3, priority: 'High', auto: null },
            { name: 'Review candidate slate', role: 'Hiring Manager', day: 14, priority: 'High', auto: null },
          ]
        },
        {
          name: 'INTERVIEW PHASE',
          tasks: [
            { name: 'Board member interviews', role: 'Admin', day: 20, priority: 'High', auto: null },
            { name: 'Final presentation', role: 'Hiring Manager', day: 25, priority: 'High', auto: null },
          ]
        }
      ]
    },
    'customer-support': {
      name: 'Customer Support Agent',
      iconBg: '#f0fdf4', iconColor: '#16a34a', iconClass: 'fa-headphones',
      tasks: '6', usedCount: '8',
      phases: [
        {
          name: 'SOURCING PHASE',
          tasks: [
            { name: 'Post job to job boards', role: 'Recruiter', day: 1, priority: 'High', auto: null },
            { name: 'Review applications', role: 'Recruiter', day: 3, priority: 'High', auto: null },
          ]
        },
        {
          name: 'SCREENING PHASE',
          tasks: [
            { name: 'Phone screening', role: 'Recruiter', day: 5, priority: 'Medium', auto: null },
            { name: 'Skills assessment test', role: 'Recruiter', day: 7, priority: 'High', auto: null },
          ]
        },
        {
          name: 'INTERVIEW PHASE',
          tasks: [
            { name: 'Team fit interview', role: 'Hiring Manager', day: 10, priority: 'High', auto: null },
          ]
        },
        {
          name: 'DECISION PHASE',
          tasks: [
            { name: 'Send offer letter', role: 'Recruiter', day: 14, priority: 'High', auto: null },
          ]
        }
      ]
    }
  };

  // ---- EDIT template ----
  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const templateKey = btn.dataset.template;
      const data = templateData[templateKey];
      if (!data) return;
      openEditModal(data);
    });
  });

  function openEditModal(data) {
    document.getElementById('editTemplateName').value = data.name;
    const container = document.getElementById('editTemplateTasks');
    container.innerHTML = '';
    const allTasks = data.phases.flatMap(p => p.tasks);
    allTasks.forEach(task => {
      const row = document.createElement('div');
      row.className = 'rec-task-editor-row';
      row.innerHTML = `
        <input class="rec-task-editor-input" type="text" value="${task.name}" />
        <div class="rec-task-editor-controls">
          <select class="rec-task-editor-select">
            <option${task.role === 'Recruiter' ? ' selected' : ''}>Recruiter</option>
            <option${task.role === 'Hiring Manager' ? ' selected' : ''}>Hiring Manager</option>
            <option${task.role === 'Admin' ? ' selected' : ''}>Admin</option>
          </select>
          <input class="rec-task-editor-num" type="number" value="${task.day}" min="1" />
          <select class="rec-task-editor-select">
            <option${task.priority === 'Medium' ? ' selected' : ''}>Medium</option>
            <option${task.priority === 'High' ? ' selected' : ''}>High</option>
            <option${task.priority === 'Low' ? ' selected' : ''}>Low</option>
          </select>
        </div>
      `;
      container.appendChild(row);
    });
    openModal('modalEditTemplate');
  }

  // ---- PREVIEW template ----
  document.querySelectorAll('.btn-preview').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const templateKey = btn.dataset.template;
      openPreviewModal(templateKey);
    });
  });

  document.querySelectorAll('.rec-template-card:not(.rec-template-card--new)').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.rec-btn')) return;
      const templateKey = card.dataset.template;
      const data = templateData[templateKey];
      if (data) openEditModal(data);
    });
  });

  function openPreviewModal(templateKey) {
    const data = templateData[templateKey];
    if (!data) return;

    const headerEl = document.getElementById('previewModalHeader');
    headerEl.innerHTML = `
      <div class="rec-preview-modal-head">
        <div class="rec-preview-modal-info">
          <div class="rec-preview-modal-icon" style="background:${data.iconBg};color:${data.iconColor}">
            <i class="fa-solid ${data.iconClass}"></i>
          </div>
          <div>
            <div class="rec-preview-modal-name">${data.name}</div>
            <div class="rec-preview-modal-meta">${data.tasks} tasks · Used ${data.usedCount} times</div>
          </div>
        </div>
        <div class="rec-preview-modal-btns">
          <button class="rec-btn rec-btn--secondary rec-btn--sm" onclick="openEditFromPreview('${templateKey}')">
            <i class="fa-solid fa-pencil"></i> Edit Template
          </button>
          <button class="rec-btn rec-btn--primary rec-btn--sm">Apply to Job</button>
          <button class="rec-modal-close rec-modal-close--dark" data-close="modalPreviewTemplate" onclick="closeModal('modalPreviewTemplate')">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
      </div>
    `;

    const bodyEl = document.getElementById('previewModalBody');
    let html = '';
    data.phases.forEach(phase => {
      html += `<div class="rec-phase-header">${phase.name}</div>`;
      phase.tasks.forEach(task => {
        const priorityClass = `rec-priority-tag--${task.priority.toLowerCase()}`;
        let autoTag = '';
        if (task.auto) {
          autoTag = `<span class="rec-auto-tag"><i class="fa-solid fa-bolt"></i> AUTO</span> ${task.auto}`;
        }
        html += `
          <div class="rec-preview-task-row">
            <div class="rec-preview-task-name">
              <input type="checkbox" />
              ${task.name}
            </div>
            <div class="rec-preview-task-meta">
              <span>Assign role: ${task.role}</span>
              <span>Due: Day ${task.day} after job published</span>
              <span class="rec-priority-tag ${priorityClass}">${task.priority}</span>
              ${autoTag ? `<span style="display:flex;align-items:center;gap:6px;margin-top:2px">${autoTag}</span>` : ''}
            </div>
          </div>
        `;
      });
    });
    bodyEl.innerHTML = html;

    openModal('modalPreviewTemplate');
  }

  window.openEditFromPreview = function(templateKey) {
    closeModal('modalPreviewTemplate');
    const data = templateData[templateKey];
    if (data) openEditModal(data);
  };

});

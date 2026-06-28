document.addEventListener('DOMContentLoaded', () => {

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

  document.querySelectorAll('[data-toggle="perm-card"]').forEach(header => {
    header.addEventListener('click', function() {
      const body = this.nextElementSibling;
      if (body && body.classList.contains('tm-perm-card-body')) {
        body.classList.toggle('tm-open');
      }
    });
  });

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

      const footer = document.getElementById('permUnsavedFooter');
      if (footer) footer.style.display = 'flex';
    });
  });

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
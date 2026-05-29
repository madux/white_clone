lucide.createIcons();

function switchTab(el) {
  document.querySelectorAll('.tf-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
}

function setView(mode) {
  const grid = document.getElementById('template-grid');
  const gridBtn = document.getElementById('grid-btn');
  const listBtn = document.getElementById('list-btn');
  if (mode === 'grid') {
    grid.style.gridTemplateColumns = '1fr 1fr';
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
  } else {
    grid.style.gridTemplateColumns = '1fr';
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
  }
}

function downloadTemplate(btn) {
  const card = btn.closest('.t-card');
  const name = card ? card.querySelector('.card-info h3').textContent.trim() : 'template';
  const ext = card && card.querySelector('.file-badge.docx') ? 'docx' : 'pdf';
  const content = `This is a placeholder for the "${name}" template.\n\nDownload the actual file from the CleonHR document library.`;
  const blob = new Blob([content], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\s+/g, '-')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
}

function openTemplateModal() {
  document.getElementById('templateModal').classList.add('open');
}

function closeTemplateModal() {
  document.getElementById('templateModal').classList.remove('open');
}

function submitTemplateRequest() {
  const name = document.getElementById('tmplName').value.trim();
  const reason = document.getElementById('tmplReason').value.trim();
  if (!name) { alert('Please enter a template name.'); return; }
  if (!reason) { alert('Please describe why you need this template.'); return; }
  alert('Your request has been submitted. You\'ll receive a response within 2-3 business days.');
  closeTemplateModal();
  document.getElementById('tmplName').value = '';
  document.getElementById('tmplReason').value = '';
}

document.querySelectorAll('.role-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.role-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
  });
});

document.getElementById('templateModal').addEventListener('click', e => {
  if (e.target === e.currentTarget) closeTemplateModal();
});

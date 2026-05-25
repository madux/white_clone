function toggleDmSidebar() {
  const sb = document.getElementById('dm-sidebar');
  if (sb) sb.classList.toggle('collapsed');
}

function toggleLeaveFilters() {
  const el = document.getElementById('leaveFilters');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

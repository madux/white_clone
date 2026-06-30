document.addEventListener('DOMContentLoaded', () => {
  const teamsSearch = document.querySelector('.tm-search-input');
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
});
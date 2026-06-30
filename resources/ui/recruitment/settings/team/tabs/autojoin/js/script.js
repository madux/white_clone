document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('autojoinToggle');
  if (toggle) {
    toggle.addEventListener('click', () => {
      const isChecked = toggle.classList.toggle('tm-checked');
      toggle.setAttribute('aria-checked', isChecked ? 'true' : 'false');
    });
  }

  const copyBtn = document.getElementById('copyUrlBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const input = document.querySelector('.tm-autojoin-url-input');
      if (input) {
        input.select();
        document.execCommand('copy');
        console.log('Auto-Join URL copied');
      }
    });
  }
});
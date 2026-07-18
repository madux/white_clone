/* ═══════════════════════════════════════════════════════════
   CleonHR HR Administration — hr-administration.js
═══════════════════════════════════════════════════════════ */
'use strict';

document.addEventListener('DOMContentLoaded', () => {
  const primaryCta = document.querySelector('.hra-btn-primary');
  if (primaryCta) {
    primaryCta.addEventListener('click', e => {
      e.preventDefault();
      window.location.href = '../signup/signup.html';
    });
  }
});

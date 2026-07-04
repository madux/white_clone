/* ═══════════════════════════════════════════════════════════
   CleonHR Signup Form — signup.js
   Password toggle, strength meter, phone country sync, validation
═══════════════════════════════════════════════════════════ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ── PHONE COUNTRY SYNC ────────────────────────────────────── */
  const countrySelect = document.getElementById('su-country');
  const phoneCountrySelect = document.getElementById('su-phone-country');
  const countryCodes = {
    NG: '+234', GH: '+233', KE: '+254', ZA: '+27', EG: '+20',
    ET: '+251', TZ: '+255', UG: '+256', RW: '+250', SN: '+221'
  };

  if (countrySelect && phoneCountrySelect) {
    /* mirror country options into phone select */
    Array.from(countrySelect.options).forEach(opt => {
      if (opt.value && opt.value !== 'OTHER') {
        const clone = opt.cloneNode(true);
        clone.textContent = `${opt.textContent} (${countryCodes[opt.value] || ''})`;
        phoneCountrySelect.appendChild(clone);
      }
    });

    /* sync selection */
    countrySelect.addEventListener('change', () => {
      phoneCountrySelect.value = countrySelect.value;
    });
    phoneCountrySelect.addEventListener('change', () => {
      countrySelect.value = phoneCountrySelect.value;
    });
  }

  /* ── PASSWORD TOGGLE ──────────────────────────────────────── */
  const passInput = document.getElementById('su-password');
  const passToggle = document.getElementById('su-pass-toggle');

  if (passToggle && passInput) {
    passToggle.addEventListener('click', () => {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      passToggle.querySelector('.fa').className = isPass ? 'fa fa-eye-slash' : 'fa fa-eye';
    });
  }

  /* ── PASSWORD STRENGTH METER ──────────────────────────────── */
  const strengthBar = document.querySelector('.su-pass-strength__bar');

  const strengthLevels = [
    { min: 0,  width: '0%',   color: '#E5E7EB' },
    { min: 1,  width: '25%',  color: '#DC2626' },
    { min: 3,  width: '50%',  color: '#D97706' },
    { min: 5,  width: '75%',  color: '#16A34A' },
    { min: 7,  width: '100%', color: '#16A34A' }
  ];

  function getStrength(pw) {
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    if (pw.length >= 16) score++;
    if (/(.)\1{2,}/.test(pw)) score--;
    return Math.max(0, score);
  }

  if (passInput && strengthBar) {
    passInput.addEventListener('input', () => {
      const val = passInput.value;
      const score = getStrength(val);

      let level = strengthLevels[0];
      for (let i = strengthLevels.length - 1; i >= 1; i--) {
        if (score >= strengthLevels[i].min) { level = strengthLevels[i]; break; }
      }
      if (val.length === 0) level = strengthLevels[0];

      strengthBar.style.width = level.width;
      strengthBar.style.background = level.color;
    });
  }

  /* ── FORM SUBMIT ──────────────────────────────────────────── */
  const form = document.getElementById('su-form');

  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();

      const needs = document.getElementById('su-needs').value;
      const size = document.getElementById('su-size').value;
      const country = document.getElementById('su-country').value;
      const first = document.getElementById('su-first').value.trim();
      const last = document.getElementById('su-last').value.trim();
      const company = document.getElementById('su-company').value.trim();
      const email = document.getElementById('su-email').value.trim();
      const phone = document.getElementById('su-phone').value.trim();
      const password = document.getElementById('su-password').value;
      const terms = document.getElementById('su-terms').checked;

      const missing = [];
      if (!needs) missing.push('Operational Needs');
      if (!size) missing.push('Company Size');
      if (!country) missing.push('Country');
      if (!first) missing.push('First Name');
      if (!last) missing.push('Last Name');
      if (!company) missing.push('Company Name');
      if (!email) missing.push('Email');
      if (!phone) missing.push('Phone');
      if (!password || password.length < 8) missing.push('Password (min 8 chars)');
      if (!terms) missing.push('Terms agreement');

      if (missing.length > 0) {
        alert('Please complete:\n• ' + missing.join('\n• '));
        return;
      }

      const btn = form.querySelector('.su-submit');
      btn.innerHTML = '<i class="fa fa-check"></i> Account Created!';
      btn.style.background = '#16A34A';
      btn.disabled = true;

      setTimeout(() => {
        alert('Welcome to CleonHR! Your workspace is ready.');
      }, 800);
    });
  }
});
/* ═══════════════════════════════════════════════════════════
   CleonHR AI Page — ai.js
   Chat typing animation, suggestion click, scroll reveal
═══════════════════════════════════════════════════════════ */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  /* ── CHAT MOCKUP TYPING ANIMATION ──────────────────────── */
  const typingEl = document.querySelector('.chr-ai-chat-mockup__typing');
  const inputEl = document.querySelector('.chr-ai-chat-mockup__input');

  if (typingEl && inputEl) {
    const phrases = [
      'Summarize the attendance report for this week...',
      'Which employees are at flight risk?',
      'Show leave balance summary for my team',
      'Draft a PIP for an underperforming employee',
      'Generate payroll anomaly alerts for May'
    ];
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typeLoop() {
      const current = phrases[phraseIndex];

      if (!isDeleting) {
        inputEl.textContent = current.substring(0, charIndex + 1);
        charIndex++;

        if (charIndex === current.length) {
          setTimeout(() => { isDeleting = true; typeLoop(); }, 2000);
          return;
        }
        setTimeout(typeLoop, 40 + Math.random() * 30);
      } else {
        inputEl.textContent = current.substring(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
          isDeleting = false;
          phraseIndex = (phraseIndex + 1) % phrases.length;
          setTimeout(typeLoop, 500);
          return;
        }
        setTimeout(typeLoop, 20);
      }
    }

    setTimeout(typeLoop, 1000);
  }

  /* ── ASK AI INPUT ──────────────────────────────────────── */
  const askInput = document.querySelector('.chr-ai-ask__input');
  const suggestions = document.querySelectorAll('.chr-ai-ask__suggestion');

  suggestions.forEach(btn => {
    btn.addEventListener('click', () => {
      if (askInput) {
        askInput.value = btn.textContent;
        askInput.focus();
      }
    });
  });

  /* ── SCROLL REVEAL (simple) ────────────────────────────── */
  const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -40px 0px' };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.chr-ai-feature').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity .5s ease, transform .5s ease';
    observer.observe(el);
  });

});

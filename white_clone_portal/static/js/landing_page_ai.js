/* ================================================================
   CleonHR AI Page – Interactive JS
   ================================================================ */

(function () {
  const TYPE_PHRASE = 'Draft a disciplinary warning letter for John D';
  const queryEl = document.getElementById('ai-demo-query-text');
  const chatInput = document.getElementById('ai-chat-input');
  const exploreBtn = document.getElementById('ai-explore-features');
  const featuresSection = document.getElementById('ai-features');

  // ── Hero typewriter ───────────────────────────────────────────
  function runTypewriter() {
    if (!queryEl) return;
    let i = 0;
    let deleting = false;

    function tick() {
      if (!deleting) {
        i += 1;
        queryEl.textContent = TYPE_PHRASE.slice(0, i);
        if (i >= TYPE_PHRASE.length) {
          deleting = true;
          setTimeout(tick, 1800);
          return;
        }
        setTimeout(tick, 42);
      } else {
        i -= 1;
        queryEl.textContent = TYPE_PHRASE.slice(0, i);
        if (i <= 0) {
          deleting = false;
          setTimeout(tick, 600);
          return;
        }
        setTimeout(tick, 24);
      }
    }

    tick();
  }

  runTypewriter();

  // ── Smooth scroll to features ─────────────────────────────────
  if (exploreBtn && featuresSection) {
    exploreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      featuresSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // ── Suggested question chips ──────────────────────────────────
  document.querySelectorAll('.ai-chat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.ai-chat-chip').forEach((c) => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      if (chatInput) {
        chatInput.value = chip.textContent.trim();
        chatInput.focus();
      }
    });
  });

  // ── Send is UI-only for now ───────────────────────────────────
  const sendBtn = document.getElementById('ai-chat-send');
  if (sendBtn && chatInput) {
    sendBtn.addEventListener('click', () => {
      chatInput.focus();
    });
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        chatInput.blur();
      }
    });
  }
})();

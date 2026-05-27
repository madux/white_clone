/**
 * dashboard.js — Entry point & dashboard page logic
 */

document.addEventListener('DOMContentLoaded', () => {
  setDateGreeting();
  startClock();
  initSidebar();    // sidebar.js
  initAllCharts();  // charts.js
  animateCounters();
  if (window.lucide) lucide.createIcons();
});

/* ============================================================
   DATE + GREETING
   ============================================================ */
function setDateGreeting() {
  const now  = new Date();
  const hour = now.getHours();

  const greeting = hour < 12 ? 'Good morning'
                 : hour < 17 ? 'Good afternoon'
                 :              'Good evening';

  const nameEl = document.getElementById('greetingName');
  const dateEl = document.getElementById('jumbotronDate');

  if (nameEl) {
    // Update h1 prefix text via the parent
    const h1 = nameEl.closest('h1');
    if (h1) h1.childNodes[0].textContent = greeting + ', ';
  }

  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
  }
}

/* ============================================================
   LIVE CLOCK
   ============================================================ */
function startClock() {
  function tick() {
    const el = document.getElementById('clockTime');
    if (!el) return;
    const now = new Date();
    const hh  = String(now.getHours()).padStart(2, '0');
    const mm  = String(now.getMinutes()).padStart(2, '0');
    const ss  = String(now.getSeconds()).padStart(2, '0');
    el.textContent = `${hh}:${mm}:${ss}`;
  }
  tick();
  setInterval(tick, 1000);
}

/* ============================================================
   COUNTER ANIMATION
   ============================================================ */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count, 10);
    if (isNaN(target)) return;
    const dur   = 900;
    const step  = 16;
    const steps = Math.ceil(dur / step);
    const inc   = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += inc;
      if (current >= target) {
        el.textContent = target.toLocaleString();
        clearInterval(timer);
      } else {
        el.textContent = Math.floor(current).toLocaleString();
      }
    }, step);
  });
}

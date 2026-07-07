document.addEventListener('DOMContentLoaded', () => {

  /* ── 1. Cycle Switch Toggle (Monthly vs Yearly) ── */
  const cycleSwitch = document.getElementById('cprCycleSwitch');
  const priceAmounts = document.querySelectorAll('.cpr-amount');
  const periodLabels = document.querySelectorAll('.cpr-period');
  const cycleLabels = document.querySelectorAll('.cpr-cycle-label');

  if (cycleSwitch) {
    cycleSwitch.addEventListener('click', () => {
      const isYearlyActive = cycleSwitch.classList.toggle('active');

      if (isYearlyActive) {
        cycleLabels[0].classList.remove('cpr-cycle-active');
        cycleLabels[1].classList.add('cpr-cycle-active');
      } else {
        cycleLabels[0].classList.add('cpr-cycle-active');
        cycleLabels[1].classList.remove('cpr-cycle-active');
      }

      priceAmounts.forEach((amountEl, idx) => {
        if (isYearlyActive) {
          amountEl.textContent = amountEl.getAttribute('data-yearly');
          periodLabels[idx].textContent = '/user/year';
        } else {
          amountEl.textContent = amountEl.getAttribute('data-monthly');
          periodLabels[idx].textContent = '/user/month';
        }
      });
    });
  }

  /* ── 2. FAQ Accordion ── */
  const faqItems = document.querySelectorAll('.cpr-faq-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.cpr-faq-trigger');
    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('cpr-faq-active');
      faqItems.forEach(el => el.classList.remove('cpr-faq-active'));
      if (!isActive) {
        item.classList.add('cpr-faq-active');
      }
    });
  });

  /* ── 3. More Modules Modal ── */
  const btnMoreModules = document.getElementById('cprBtnMoreModules');
  const modalOverlay = document.getElementById('cprMoreModulesModal');
  const btnCloseModal = document.getElementById('cprCloseModalBtn');

  if (btnMoreModules && modalOverlay && btnCloseModal) {
    btnMoreModules.addEventListener('click', (e) => {
      e.preventDefault();
      modalOverlay.style.display = 'flex';
      document.body.style.overflow = 'hidden';
    });

    const closeModalFunc = () => {
      modalOverlay.style.display = 'none';
      document.body.style.overflow = 'auto';
    };

    btnCloseModal.addEventListener('click', closeModalFunc);

    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModalFunc();
      }
    });
  }

  /* ── 4. Modal Card Selection Toggle ── */
  const selectionCards = document.querySelectorAll('.cpr-modal-selection-card');
  selectionCards.forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });
  });
});

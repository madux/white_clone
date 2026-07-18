document.addEventListener('DOMContentLoaded', () => {
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

  const selectionCards = document.querySelectorAll('.cpr-modal-selection-card');
  selectionCards.forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });
  });
});
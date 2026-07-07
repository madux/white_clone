document.addEventListener('DOMContentLoaded', () => {
  const demoButton = document.querySelector('.chm-btn-action-primary');
  const pricingButton = document.querySelector('.chm-btn-action-secondary');

  const statBoxes = document.querySelectorAll('.chm-stat-box');
  statBoxes.forEach(box => {
    box.addEventListener('mouseenter', () => {
      box.style.transform = 'scale(1.03)';
      box.style.transition = 'transform 0.2s ease';
    });
    box.addEventListener('mouseleave', () => {
      box.style.transform = 'scale(1)';
    });
  });
});
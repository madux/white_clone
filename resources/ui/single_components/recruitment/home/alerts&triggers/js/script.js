document.addEventListener("DOMContentLoaded", function() {
    lucide.createIcons();

    const panels = document.querySelectorAll('.at-alert-panel');
    panels.forEach(panel => {
        const dismissBtn = panel.querySelector('.at-btn-dismiss');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                panel.style.opacity = '0';
                panel.style.transform = 'scale(0.98) translateY(-4px)';
                setTimeout(() => {
                    panel.remove();
                }, 250);
            });
        }
    });
});

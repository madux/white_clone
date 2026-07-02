document.addEventListener('DOMContentLoaded', () => {
    const tabButtons = document.querySelectorAll('.ap-tab-btn');
    const tabPanes = document.querySelectorAll('.ap-tab-pane');
    const stateToggles = document.querySelectorAll('.ap-state-toggle');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-tab');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            tabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === targetTab);
            });
        });
    });

    const subTabButtons = document.querySelectorAll('.ap-sub-tab-btn');
    const subTabPanes = document.querySelectorAll('.ap-sub-tab-pane');

    subTabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetSubTab = button.getAttribute('data-subtab');

            subTabButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            subTabPanes.forEach(pane => {
                pane.classList.toggle('active', pane.id === targetSubTab);
            });
        });
    });

    stateToggles.forEach(toggle => {
        if (toggle.hasAttribute('disabled')) return;

        toggle.addEventListener('click', () => {
            toggle.classList.toggle('enabled');
            toggle.classList.toggle('disabled');
            toggle.textContent = toggle.classList.contains('enabled') ? 'Visible' : 'Hidden';
        });
    });
});

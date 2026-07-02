document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.querySelector('[data-toggle="sidebar-collapse"]');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.rsb-sidebar').classList.toggle('rsb-collapsed');
        });
    }

    const tabButtons = document.querySelectorAll('.comp-tab-btn');
    const tabContents = document.querySelectorAll('.comp-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-target');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const currentView = document.getElementById(`view-${targetTab}`);
            if (currentView) {
                currentView.classList.add('active');
            }
        });
    });

    const interactiveToggles = document.querySelectorAll('.comp-toggle-switch input');
    interactiveToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const rowWrapper = e.target.closest('.comp-policy-row');
            if (rowWrapper) {
                if (e.target.checked) {
                    rowWrapper.style.opacity = '1';
                } else {
                    rowWrapper.style.opacity = '0.85';
                }
            }
        });
    });
});
document.addEventListener('DOMContentLoaded', () => {
    const sidebarToggle = document.querySelector('[data-toggle="sidebar-collapse"]');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelector('.rsb-sidebar').classList.toggle('rsb-collapsed');
        });
    }

    const tabButtons = document.querySelectorAll('.cfg-tab-btn');
    const tabContents = document.querySelectorAll('.cfg-tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetTab = button.getAttribute('data-target');

            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            button.classList.add('active');
            const targetView = document.getElementById(`view-${targetTab}`);
            if (targetView) {
                targetView.classList.add('active');
            }
        });
    });

    const dynamicToggles = document.querySelectorAll('.cfg-toggle-switch input');
    dynamicToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
            const componentContext = e.target.closest('.cfg-card, .cfg-integration-card, tr');
            if (componentContext) {
                if (e.target.checked) {
                    componentContext.style.opacity = '1';
                } else {
                    componentContext.style.opacity = '0.85';
                }
            }
        });
    });
});
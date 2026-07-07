document.addEventListener('DOMContentLoaded', () => {
    const anchors = document.querySelectorAll('.ic-nav-link, .ic-footer-links a, .ic-auth-buttons a');
    anchors.forEach(anchor => {
        if (anchor.getAttribute('href') === '#') {
            anchor.addEventListener('click', (event) => event.preventDefault());
        }
    });
});

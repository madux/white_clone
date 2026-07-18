document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.mp-nav-link, .mp-footer-links a, .mp-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

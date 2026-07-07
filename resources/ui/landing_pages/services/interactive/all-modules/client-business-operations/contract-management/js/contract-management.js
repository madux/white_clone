document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.ctm-nav-link, .ctm-footer-links a, .ctm-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

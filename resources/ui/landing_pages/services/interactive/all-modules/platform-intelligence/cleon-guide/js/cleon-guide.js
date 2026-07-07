document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.cg-nav-link, .cg-footer-links a, .cg-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

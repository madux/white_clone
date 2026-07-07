document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.rp-nav-link, .rp-footer-links a, .rp-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

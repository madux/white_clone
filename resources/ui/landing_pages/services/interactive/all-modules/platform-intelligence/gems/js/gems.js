document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.gems-nav-link, .gems-footer-links a, .gems-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

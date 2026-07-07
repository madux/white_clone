document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.ne-nav-link, .ne-footer-links a, .ne-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

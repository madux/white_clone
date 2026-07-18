document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.cm-nav-link, .cm-footer-links a, .cm-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

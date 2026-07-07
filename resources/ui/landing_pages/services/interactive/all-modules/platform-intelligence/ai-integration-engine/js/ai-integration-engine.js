document.addEventListener('DOMContentLoaded', () => {
    const elements = document.querySelectorAll('.ai-nav-link, .ai-footer-links a, .ai-auth-buttons a');
    elements.forEach(element => {
        if (element.getAttribute('href') === '#') {
            element.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

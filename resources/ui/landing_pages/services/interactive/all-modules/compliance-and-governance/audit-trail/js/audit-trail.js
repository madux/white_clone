document.addEventListener('DOMContentLoaded', () => {
    const links = document.querySelectorAll('.at-nav-link, .at-footer-links a, .at-auth-buttons a');
    links.forEach(link => {
        if (link.getAttribute('href') === '#') {
            link.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

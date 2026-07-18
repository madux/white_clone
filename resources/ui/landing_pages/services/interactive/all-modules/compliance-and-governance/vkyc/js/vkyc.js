document.addEventListener('DOMContentLoaded', () => {
    const interactiveLinks = document.querySelectorAll('.vkyc-nav-link, .vkyc-footer-links a');
    interactiveLinks.forEach(link => {
        if (link.getAttribute('href') === '#') {
            link.addEventListener('click', (e) => e.preventDefault());
        }
    });
});

/* ═══════════════════════════════════════════════════════════
   CleonHR Performance Appraisal — performance-appraisal.js
   Prefix: perf-  |  Font: DM Sans  |  Icons: FA 4.7
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    const internalLinks = document.querySelectorAll('a[href^="#"]');

    internalLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            const target = this.getAttribute('href');
            if(target !== '#') {
                e.preventDefault();
                const matchedElement = document.querySelector(target);
                if(matchedElement) {
                    matchedElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
});

/* ═══════════════════════════════════════════════════════════
   CleonHR HR Advisory — hr-advisory.js
   Prefix: adv-  |  Font: DM Sans  |  Icons: FA 4.7
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    const targetAnchorLinks = document.querySelectorAll('a[href^="#"]');

    targetAnchorLinks.forEach(anchor => {
        anchor.addEventListener('click', function(event) {
            const anchorTargetId = this.getAttribute('href');
            if(anchorTargetId !== '#') {
                event.preventDefault();
                const contextualElement = document.querySelector(anchorTargetId);
                if(contextualElement) {
                    contextualElement.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
});

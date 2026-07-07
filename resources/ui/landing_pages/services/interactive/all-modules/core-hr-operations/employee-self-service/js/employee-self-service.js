// ═══════════════════════════════════════════════════════════
// CleonHR Employee Self-Service — employee-self-service.js
// CTA arrow animation only
// ═══════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function () {
    initCtaAnimation();
});

function initCtaAnimation() {
    var heroCta = document.querySelector('.ess-btn-primary');
    if (heroCta) {
        heroCta.addEventListener('mouseenter', function () {
            var arrow = heroCta.querySelector('.fa-arrow-right');
            if (arrow) arrow.style.transform = 'translateX(4px)';
        });
        heroCta.addEventListener('mouseleave', function () {
            var arrow = heroCta.querySelector('.fa-arrow-right');
            if (arrow) arrow.style.transform = 'translateX(0px)';
        });
    }
}

/* ═══════════════════════════════════════════════════════════
   CleonHR Petty Cash — petty-cash.js
   CTA arrow animation + smooth scroll
═══════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', function () {
    initCtaArrowAnimation();
    initSmoothScroll();
});

function initCtaArrowAnimation() {
    var heroCta = document.querySelector('.pc-btn-primary');
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

function initSmoothScroll() {
    var ctaBtn = document.querySelector('.pc-btn-white');
    if (ctaBtn) {
        ctaBtn.addEventListener('click', function (e) {
            var banner = document.querySelector('.pc-cta');
            if (banner) {
                e.preventDefault();
                banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
}

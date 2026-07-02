document.addEventListener('DOMContentLoaded', () => {
    const tabBtns = document.querySelectorAll('.cs-tab-btn');
    const tabPanes = document.querySelectorAll('.cs-tab-pane');
    const overviewCards = document.querySelectorAll('.cs-overview-card');
    const portalCards = document.querySelectorAll('.cs-portal-card');
    const copyBtn = document.querySelector('[data-copy]');
    const seoTitleInput = document.getElementById('seo-title-input');
    const seoDescInput = document.getElementById('seo-desc-input');
    const seoTitlePrev = document.getElementById('seo-title-preview');
    const seoDescPrev = document.getElementById('seo-desc-preview');

    function switchTab(targetTabId) {
        tabBtns.forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-tab') === targetTabId);
        });
        tabPanes.forEach(pane => {
            pane.classList.toggle('active', pane.id === targetTabId);
        });
    }

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.getAttribute('data-tab'));
        });
    });

    overviewCards.forEach(card => {
        card.addEventListener('click', () => {
            const target = card.getAttribute('data-target');
            if (target) switchTab(target);
        });
    });

    portalCards.forEach(card => {
        card.addEventListener('click', () => {
            portalCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const input = copyBtn.closest('.cs-input-with-action').querySelector('input');
            if (input) {
                input.select();
                navigator.clipboard.writeText(input.value).then(() => {
                    const icon = copyBtn.querySelector('i');
                    icon.className = 'fa-solid fa-check';
                    setTimeout(() => { icon.className = 'fa-solid fa-copy'; }, 1500);
                });
            }
        });
    }

    if (seoTitleInput && seoTitlePrev) {
        seoTitleInput.addEventListener('input', () => {
            seoTitlePrev.textContent = seoTitleInput.value || 'Careers | Join Our Team';
        });
    }

    if (seoDescInput && seoDescPrev) {
        seoDescInput.addEventListener('input', () => {
            seoDescPrev.textContent = seoDescInput.value || 'Explore exciting career opportunities and join our growing team.';
        });
    }
});

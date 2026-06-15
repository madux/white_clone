let modalTagArray = [];

function initAddVendorModal() {
    var overlay = document.getElementById('vn-modal-overlay');
    var closeBtn = document.getElementById('vn-modal-close-btn');
    var cancelBtn = document.getElementById('vn-cancel-modal-btn');
    var form = document.getElementById('vn-vendor-form');
    var tagInput = document.getElementById('vn-input-tag');
    var addTagBtn = document.getElementById('vn-add-tag-btn');

    if (!overlay || !form) return;

    function openModal() {
        overlay.classList.add('vn-active');
    }

    function closeModal() {
        overlay.classList.remove('vn-active');
        form.reset();
        modalTagArray = [];
        renderTagZone();
    }

    function addTag() {
        var tagVal = tagInput ? tagInput.value.trim() : '';
        if (tagVal && modalTagArray.indexOf(tagVal) === -1) {
            modalTagArray.push(tagVal);
            renderTagZone();
        }
        if (tagInput) tagInput.value = '';
    }

    function removeTag(index) {
        modalTagArray.splice(index, 1);
        renderTagZone();
    }

    function renderTagZone() {
        var zone = document.getElementById('vn-tags-zone');
        if (!zone) return;
        zone.innerHTML = '';
        modalTagArray.forEach(function(tag, idx) {
            var tagSpan = document.createElement('span');
            tagSpan.className = 'vn-interactive-tag';
            tagSpan.innerHTML = tag + ' <i class="fa-solid fa-xmark" onclick="window.removeModalTag(' + idx + ')"></i>';
            zone.appendChild(tagSpan);
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (addTagBtn) addTagBtn.addEventListener('click', addTag);
    if (tagInput) {
        tagInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var nameEl = document.getElementById('vn-input-name');
        var emailEl = document.getElementById('vn-input-email');
        var phoneEl = document.getElementById('vn-input-phone');
        var webEl = document.getElementById('vn-input-web');
        var statusEl = document.getElementById('vn-input-status');
        var notesEl = document.getElementById('vn-input-notes');

        var newVendor = {
            id: Date.now(),
            name: nameEl ? nameEl.value.trim() : '',
            email: emailEl ? emailEl.value.trim() : '',
            phone: phoneEl ? phoneEl.value.trim() : '',
            website: webEl ? webEl.value.trim() : '',
            specializations: modalTagArray.slice(),
            status: statusEl ? statusEl.value : 'Active',
            notes: notesEl ? notesEl.value.trim() : ''
        };

        if (typeof vendors !== 'undefined' && vendors) {
            vendors.push(newVendor);
        }

        closeModal();

        if (typeof renderVendors === 'function') {
            var searchBar = document.getElementById('vn-search-bar');
            renderVendors(searchBar ? searchBar.value : '');
        }
    });

    window.openAddVendorModal = openModal;
    window.closeAddVendorModal = closeModal;
    window.addModalTag = addTag;
    window.removeModalTag = removeTag;
}

function initCreateDeptModal() {
    var backdrop = document.getElementById('chr-create-dept-modal');
    var closeBtn = document.getElementById('chr-modal-close-btn');
    var cancelBtn = document.getElementById('chr-modal-cancel-btn');
    var form = document.getElementById('chr-create-department-form');
    var colorNative = document.getElementById('chr-form-dept-color');
    var colorText = document.getElementById('chr-form-dept-color-text');

    if (!backdrop || !form) return;

    function openModal() {
        backdrop.classList.add('active');
    }

    function closeModal() {
        backdrop.classList.remove('active');
        form.reset();
        if (colorText) colorText.value = '#ec4899';
        if (colorNative) colorNative.value = '#ec4899';
    }

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    if (colorNative && colorText) {
        colorNative.addEventListener('input', function(e) {
            colorText.value = e.target.value;
        });
    }

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var nameVal = document.getElementById('chr-form-dept-name').value.trim();
        var descVal = document.getElementById('chr-form-dept-desc').value.trim();
        var locVal = document.getElementById('chr-form-dept-loc').value.trim();
        var ownerVal = document.getElementById('chr-form-dept-owner').value;

        var teamSelectNode = document.getElementById('chr-form-dept-team');
        var chosenTeamMembers = Array.from(teamSelectNode.selectedOptions).map(function(opt) {
            var initials = 'ET', role = 'HR Generalist';
            if (opt.value === 'Sarah Chen') { initials = 'SC'; role = 'Admin'; }
            if (opt.value === 'Michael Rodriguez') { initials = 'MR'; role = 'Recruiter'; }
            return {
                name: opt.value,
                role: role,
                email: opt.value.toLowerCase().replace(' ', '.') + '@cleonhr.com',
                initials: initials,
                avatarClass: 'chr-avatar-pink'
            };
        });

        var assignedHexColor = colorNative ? colorNative.value : '#ec4899';
        var avatarBackgroundPool = ['chr-avatar-green', 'chr-avatar-pink', 'chr-avatar-blue', 'chr-avatar-orange', 'chr-avatar-teal'];
        var randomlyAllocatedClass = avatarBackgroundPool[Math.floor(Math.random() * avatarBackgroundPool.length)];

        var now = new Date();
        var formattedTimestampString = String(now.getMonth() + 1).padStart(2, '0') + '/' +
            String(now.getDate()).padStart(2, '0') + '/' +
            now.getFullYear() + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0');

        var ownerRecord = null;
        if (ownerVal) {
            var initials = 'ET', role = 'HR Generalist';
            if (ownerVal === 'Sarah Chen') { initials = 'SC'; role = 'Admin'; }
            if (ownerVal === 'Michael Rodriguez') { initials = 'MR'; role = 'Recruiter'; }
            ownerRecord = { name: ownerVal, role: role, initials: initials, avatarClass: 'chr-avatar-pink' };
        }

        var compiledDepartmentDataPayload = {
            id: 'DEPT-' + Date.now().toString().slice(-3),
            name: nameVal,
            description: descVal,
            location: locVal,
            jobCount: 0,
            owner: ownerRecord,
            team: chosenTeamMembers,
            createdDate: formattedTimestampString,
            color: assignedHexColor,
            avatarClass: randomlyAllocatedClass
        };

        if (typeof globalDepartmentsState !== 'undefined') {
            globalDepartmentsState.unshift(compiledDepartmentDataPayload);
        }

        closeModal();

        if (typeof appendUniqueFilterLocationOptionsItem === 'function') {
            appendUniqueFilterLocationOptionsItem(locVal);
        }
        if (typeof executeActiveFilterSearchPipeline === 'function') {
            executeActiveFilterSearchPipeline();
        }
    });

    window.openCreateDeptModal = openModal;
    window.closeCreateDeptModal = closeModal;
}

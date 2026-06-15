document.addEventListener("DOMContentLoaded", function() {
    lucide.createIcons();

    var advancedFilterToggleBtn = document.getElementById('advancedFilterToggleBtn');
    var advancedFilterDrawer = document.getElementById('advancedFilterDrawer');
    var closeDrawerX = document.getElementById('closeDrawerX');
    var masterSelectAllCheckbox = document.getElementById('masterSelectAllCheckbox');
    var rowCheckboxes = document.querySelectorAll('.jb-row-selector-checkbox');
    var bulkActionToast = document.getElementById('bulkActionToast');
    var selectedCountBadge = document.getElementById('selectedCountBadge');
    var clearSelectionBtn = document.getElementById('clearSelectionBtn');
    var tabPills = document.querySelectorAll('.jb-tab-pill');
    var filterDeptDropdown = document.getElementById('filterDeptDropdown');
    var filterPriorityDropdown = document.getElementById('filterPriorityDropdown');
    var tableRows = document.querySelectorAll('#jobsTableBody tr');
    var showingCountText = document.getElementById('showingCountText');
    var deptFilterBar = document.getElementById('deptFilterBar');
    var deptFilterBackBtn = document.getElementById('deptFilterBackBtn');
    var deptFilterLabel = document.getElementById('deptFilterLabel');

    var mainJobsTableContext = document.getElementById('mainJobsTableContext');
    var jobDetailViewContext = document.getElementById('jobDetailViewContext');
    var backToJobsListBtn = document.getElementById('backToJobsListBtn');
    var detailJobTitle = document.getElementById('detailJobTitle');
    var detailDept = document.getElementById('detailDept');
    var detailLocation = document.getElementById('detailLocation');
    var detailType = document.getElementById('detailType');

    var rowActionMenu = document.getElementById('rowActionMenu');
    var actionMenuTriggers = document.querySelectorAll('.jb-row-options-dropdown-trigger-btn');

    var currentStatusFilter = 'all';
    var currentDeptFilter = 'all';
    var currentPriorityFilter = 'all';

    var advLocation = document.getElementById('advLocation');
    var advJobType = document.getElementById('advJobType');
    var advJobNature = document.getElementById('advJobNature');
    var advJobStage = document.getElementById('advJobStage');
    var applyAdvancedFiltersBtn = document.getElementById('applyAdvancedFiltersBtn');
    var resetAdvancedFiltersBtn = document.getElementById('resetAdvancedFiltersBtn');

    advancedFilterToggleBtn.addEventListener('click', function() {
        this.classList.toggle('jb-active-pink');
        if (advancedFilterDrawer.classList.contains('jb-open-slide')) {
            advancedFilterDrawer.classList.remove('jb-open-slide');
        } else {
            advancedFilterDrawer.classList.add('jb-open-slide');
        }
    });

    closeDrawerX.addEventListener('click', function() {
        advancedFilterToggleBtn.classList.remove('jb-active-pink');
        advancedFilterDrawer.classList.remove('jb-open-slide');
    });

    function refreshLucide() {
        lucide.createIcons();
    }

    function applyCombinedFilters() {
        var visibleCount = 0;
        var totalCount = tableRows.length;

        tableRows.forEach(function(row) {
            var status = row.getAttribute('data-status');
            var dept = row.getAttribute('data-dept');
            var priority = row.getAttribute('data-priority');
            var loc = row.getAttribute('data-location') ? row.getAttribute('data-location').toLowerCase() : '';
            var type = row.getAttribute('data-type');
            var nature = row.getAttribute('data-nature');
            var stage = row.getAttribute('data-stage');

            var matchStatus = (currentStatusFilter === 'all' || status === currentStatusFilter);
            var matchDept = (currentDeptFilter === 'all' || dept === currentDeptFilter);
            var matchPriority = (currentPriorityFilter === 'all' || priority === currentPriorityFilter);
            var matchLoc = (advLocation.value === '' || loc.includes(advLocation.value.toLowerCase()));
            var matchType = (advJobType.value === 'all' || type === advJobType.value);
            var matchNature = (advJobNature.value === 'all' || nature === advJobNature.value);
            var matchStage = (advJobStage.value === 'all' || stage === advJobStage.value);

            if (matchStatus && matchDept && matchPriority && matchLoc && matchType && matchNature && matchStage) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });

        showingCountText.textContent = 'Showing ' + visibleCount + ' of ' + totalCount + ' jobs';
    }

    tabPills.forEach(function(pill) {
        pill.addEventListener('click', function() {
            tabPills.forEach(function(p) { p.classList.remove('active'); });
            this.classList.add('active');
            currentStatusFilter = this.getAttribute('data-filter');
            applyCombinedFilters();
        });
    });

    filterDeptDropdown.addEventListener('change', function() {
        currentDeptFilter = this.value;
        if (this.value === 'all') {
            deptFilterBar.classList.remove('jb-visible');
        }
        applyCombinedFilters();
    });

    filterPriorityDropdown.addEventListener('change', function() {
        currentPriorityFilter = this.value;
        applyCombinedFilters();
    });

    applyAdvancedFiltersBtn.addEventListener('click', function() {
        applyCombinedFilters();
        advancedFilterToggleBtn.classList.remove('jb-active-pink');
        advancedFilterDrawer.classList.remove('jb-open-slide');
    });

    resetAdvancedFiltersBtn.addEventListener('click', function() {
        advLocation.value = '';
        advJobType.value = 'all';
        advJobNature.value = 'all';
        advJobStage.value = 'all';
        applyCombinedFilters();
    });

    function evaluateBulkSelectionUI() {
        var checkedCount = document.querySelectorAll('.jb-row-selector-checkbox:checked').length;
        if (checkedCount > 0) {
            selectedCountBadge.textContent = checkedCount;
            bulkActionToast.classList.add('jb-visible-toast');
        } else {
            bulkActionToast.classList.remove('jb-visible-toast');
            masterSelectAllCheckbox.checked = false;
        }
    }

    masterSelectAllCheckbox.addEventListener('change', function() {
        var targetState = this.checked;
        rowCheckboxes.forEach(function(cb) {
            var tr = cb.closest('tr');
            if (tr.style.display !== 'none') {
                cb.checked = targetState;
                if (targetState) {
                    tr.classList.add('jb-row-selected-highlight');
                } else {
                    tr.classList.remove('jb-row-selected-highlight');
                }
            }
        });
        evaluateBulkSelectionUI();
    });

    rowCheckboxes.forEach(function(cb) {
        cb.addEventListener('change', function() {
            var tr = this.closest('tr');
            if (this.checked) {
                tr.classList.add('jb-row-selected-highlight');
            } else {
                tr.classList.remove('jb-row-selected-highlight');
            }
            evaluateBulkSelectionUI();
        });
    });

    clearSelectionBtn.addEventListener('click', function() {
        rowCheckboxes.forEach(function(cb) {
            cb.checked = false;
            cb.closest('tr').classList.remove('jb-row-selected-highlight');
        });
        masterSelectAllCheckbox.checked = false;
        evaluateBulkSelectionUI();
    });

    // Drilldown: Job Title -> Detail View
    document.querySelectorAll('.jb-drilldown-trigger').forEach(function(trigger) {
        trigger.addEventListener('click', function() {
            var parentRow = this.closest('tr');
            var title = parentRow.querySelector('.jb-job-title-strong').textContent;
            var dept = parentRow.querySelector('.jb-dept-flex-cell span').textContent;
            var subtext = parentRow.querySelector('.jb-subtext-lbl') ? parentRow.querySelector('.jb-subtext-lbl').textContent : '';
            var location = parentRow.getAttribute('data-location');

            detailJobTitle.textContent = title;
            detailDept.textContent = dept;
            detailLocation.textContent = location;
            detailType.textContent = subtext;

            mainJobsTableContext.style.display = 'none';
            jobDetailViewContext.style.display = 'block';
            window.scrollTo({ top: 0, behavior: 'smooth' });
            refreshLucide();
        });
    });

    // Drilldown: Department -> Filter Table
    document.querySelectorAll('.jb-dept-filter-trigger').forEach(function(cell) {
        cell.addEventListener('click', function() {
            var parentRow = this.closest('tr');
            var deptName = parentRow.getAttribute('data-dept');
            filterDeptDropdown.value = deptName;
            currentDeptFilter = deptName;
            applyCombinedFilters();
            deptFilterLabel.textContent = deptName;
            deptFilterBar.classList.add('jb-visible');
        });
    });

    // Filter Bar Back Button
    deptFilterBackBtn.addEventListener('click', function() {
        filterDeptDropdown.value = 'all';
        currentDeptFilter = 'all';
        applyCombinedFilters();
        deptFilterBar.classList.remove('jb-visible');
    });

    // Detail View Back Button: Return to full table
    backToJobsListBtn.addEventListener('click', function() {
        jobDetailViewContext.style.display = 'none';
        mainJobsTableContext.style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // Context Menu
    actionMenuTriggers.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var rect = this.getBoundingClientRect();
            rowActionMenu.style.top = (rect.bottom + window.scrollY + 6) + 'px';
            rowActionMenu.style.left = (rect.left + window.scrollX - 160) + 'px';
            rowActionMenu.classList.add('jb-active-menu');
        });
    });

    document.addEventListener('click', function() {
        rowActionMenu.classList.remove('jb-active-menu');
    });

    // Drag and Drop Headers
    var draggableHeaders = document.querySelectorAll('.jb-draggable-header');
    var sourceDragElement = null;

    draggableHeaders.forEach(function(header) {
        header.addEventListener('dragstart', function(e) {
            sourceDragElement = this;
            e.dataTransfer.effectAllowed = 'move';
            this.classList.add('jb-dragging-active');
        });

        header.addEventListener('dragover', function(e) {
            if (e.preventDefault) e.preventDefault();
            return false;
        });

        header.addEventListener('dragenter', function() {
            if (this !== sourceDragElement) this.classList.add('jb-drag-hovering');
        });

        header.addEventListener('dragleave', function() {
            this.classList.remove('jb-drag-hovering');
        });

        header.addEventListener('drop', function(e) {
            e.stopPropagation();
            if (sourceDragElement !== this) {
                var savedHTML = this.innerHTML;
                this.innerHTML = sourceDragElement.innerHTML;
                sourceDragElement.innerHTML = savedHTML;
                refreshLucide();
            }
            return false;
        });

        header.addEventListener('dragend', function() {
            draggableHeaders.forEach(function(h) {
                h.classList.remove('jb-dragging-active');
                h.classList.remove('jb-drag-hovering');
            });
        });
    });
});

document.addEventListener("DOMContentLoaded", function() {
    lucide.createIcons();

    var btnSchedule = document.getElementById('tab-schedule-trigger');
    var btnTasks = document.getElementById('tab-tasks-trigger');
    var panelSchedule = document.getElementById('panel-schedule');
    var panelTasks = document.getElementById('panel-tasks');

    btnSchedule.addEventListener('click', function() {
        btnSchedule.classList.add('active');
        btnTasks.classList.remove('active');
        panelSchedule.classList.add('active');
        panelTasks.classList.remove('active');
    });

    btnTasks.addEventListener('click', function() {
        btnTasks.classList.add('active');
        btnSchedule.classList.remove('active');
        panelTasks.classList.add('active');
        panelSchedule.classList.remove('active');
    });

    var overdueCount = 7;
    var completedCount = 2;
    var totalTasks = 10;

    var taskCheckboxes = document.querySelectorAll('.st-task-native-checkbox');
    taskCheckboxes.forEach(function(checkbox) {
        checkbox.addEventListener('change', function() {
            if (this.checked) {
                var row = this.closest('.st-task-row-card');
                row.style.opacity = '0.4';
                row.style.transform = 'translateX(10px)';
                row.style.transition = 'all 0.4s ease';

                setTimeout(function() {
                    row.remove();

                    overdueCount--;
                    completedCount++;

                    document.getElementById('overdue-counter-badge').textContent = overdueCount;
                    document.getElementById('completed-counter-badge').textContent = completedCount;
                    document.getElementById('overdue-section-title-banner').textContent = 'Overdue Tasks (' + overdueCount + ')';

                    var newPct = Math.round((completedCount / totalTasks) * 100);
                    document.getElementById('progress-percentage-text').textContent = newPct + '%';
                    document.getElementById('progress-fill-element').style.width = newPct + '%';

                    document.getElementById('tasks-summary-subline-text').textContent = (totalTasks - completedCount) + ' pending \u2022 ' + completedCount + ' completed';
                }, 400);
            }
        });
    });

    var taskScopeDropdown = document.getElementById('task-scope-toggle-dropdown');
    var taskRows = document.querySelectorAll('.st-task-row-card');
    var taskHeadingTitle = document.getElementById('tasks-scope-heading-title');

    taskScopeDropdown.addEventListener('change', function() {
        var val = this.value;
        var visibleOverdueCount = 0;

        if (val === 'my') {
            taskHeadingTitle.textContent = "My Tasks";
            taskRows.forEach(function(row) {
                if (row.getAttribute('data-owner') === 'my') {
                    row.style.display = 'flex';
                    visibleOverdueCount++;
                } else {
                    row.style.display = 'none';
                }
            });
        } else {
            taskHeadingTitle.textContent = "All Team Tasks";
            taskRows.forEach(function(row) {
                row.style.display = 'flex';
                visibleOverdueCount++;
            });
        }
        document.getElementById('overdue-section-title-banner').textContent = 'Overdue Tasks (' + visibleOverdueCount + ')';
    });

    var interviewSelector = document.getElementById('interview-view-selector');
    var interviewCards = document.querySelectorAll('#interviews-list-container .st-feed-item-card');

    interviewSelector.addEventListener('change', function() {
        var value = this.value;
        interviewCards.forEach(function(card) {
            if (value === 'all' || card.getAttribute('data-scope') === value) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

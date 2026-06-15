let activeFormPrioritySelection = "Medium";

function initTaskModal() {
    var backdrop = document.getElementById('ts-new-task-modal-backdrop');
    var dismissBtn = document.getElementById('ts-dismiss-modal-action');
    var cancelBtn = document.getElementById('ts-cancel-modal-action');
    var form = document.getElementById('ts-create-task-submission-form');
    var priorityButtons = document.querySelectorAll('.ts-priority-btn');

    if (!backdrop || !form) return;

    function openModal() {
        backdrop.classList.add('ts-modal-visible');
    }

    function closeModal() {
        backdrop.classList.remove('ts-modal-visible');
        form.reset();
        resetPrioritySelectionUI();
    }

    function resetPrioritySelectionUI() {
        priorityButtons.forEach(function(btn) {
            if (btn.getAttribute('data-priority') === 'Medium') {
                btn.classList.add('ts-selected-priority');
            } else {
                btn.classList.remove('ts-selected-priority');
            }
        });
        activeFormPrioritySelection = "Medium";
    }

    if (dismissBtn) dismissBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

    priorityButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            priorityButtons.forEach(function(b) { b.classList.remove('ts-selected-priority'); });
            e.currentTarget.classList.add('ts-selected-priority');
            activeFormPrioritySelection = e.currentTarget.getAttribute('data-priority');
        });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        var titleVal = document.getElementById('ts-field-title').value.trim();
        var descVal = document.getElementById('ts-field-desc').value.trim();
        var assigneeVal = document.getElementById('ts-field-assignee').value;
        var rawDate = document.getElementById('ts-field-due-date').value;
        var jobVal = document.getElementById('ts-field-job-link').value;
        var reminderChecked = document.getElementById('ts-field-reminder').checked;
        var isAutoChecked = document.getElementById('ts-field-is-auto').checked;

        if (!titleVal || !assigneeVal) {
            alert("Please fill in all mandatory inputs starred in red.");
            return;
        }

        var formattedDate = null;
        var urgencyGroupCalculated = "no-due-date";
        var dotColorCalculated = "amber";

        if (rawDate) {
            var dateObj = new Date(rawDate + 'T00:00:00');
            var formattingOptions = { month: 'long', day: 'numeric', year: 'numeric' };
            formattedDate = dateObj.toLocaleDateString('en-US', formattingOptions);
            urgencyGroupCalculated = "overdue";
            dotColorCalculated = "red";
        }

        var freshlyBuiltTaskModel = {
            id: 'tsk-' + Date.now(),
            title: titleVal,
            assignee: assigneeVal,
            dueDate: formattedDate,
            daysOverdue: rawDate ? 1 : null,
            jobLink: jobVal || null,
            isAutoTriggered: isAutoChecked,
            hasAlarmNotification: reminderChecked,
            urgencyGroup: urgencyGroupCalculated,
            dotStatusColor: dotColorCalculated,
            description: descVal || "No descriptive brief specified for this task item tracking ledger node context.",
            isCompleted: false
        };

        if (typeof TS_APPLICATION_STATE !== 'undefined' && TS_APPLICATION_STATE) {
            TS_APPLICATION_STATE.tasksCollection.unshift(freshlyBuiltTaskModel);
        }

        closeModal();

        if (typeof renderTasksCoreEngineViews === 'function') {
            renderTasksCoreEngineViews();
        }
        if (typeof updateSystemHeaderMetricsPanelSummary === 'function') {
            updateSystemHeaderMetricsPanelSummary();
        }
    });

    window.openTaskModal = openModal;
    window.closeTaskModal = closeModal;
}

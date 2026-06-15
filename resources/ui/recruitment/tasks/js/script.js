const TS_APPLICATION_STATE = {
    currentActiveTab: 'all-tasks',
    isAutomationViewActive: false,
    selectedTaskCardId: null,
    tasksCollection: [
        { id: "tsk-1", title: "Complete quarterly performance reviews", assignee: "Emily Thompson", dueDate: "February 15, 2025", daysOverdue: 485, jobLink: null, isAutoTriggered: false, hasAlarmNotification: false, urgencyGroup: "overdue", dotStatusColor: "red", description: "Review and submit performance evaluations for Q4 2024 to human resources management division tracking milestones metrics.", isCompleted: false },
        { id: "tsk-2", title: "Update employee handbook", assignee: "Emily Thompson", dueDate: "February 15, 2025", daysOverdue: 480, jobLink: null, isAutoTriggered: false, hasAlarmNotification: false, urgencyGroup: "overdue", dotStatusColor: "amber", description: "Revise workplace safety codes, remote employment guidelines compliance, code updates and standard behavior procedures.", isCompleted: false },
        { id: "tsk-3", title: "Review CVs for Senior Software Engineer", assignee: "Emeka Okafor", dueDate: "March 20, 2026", daysOverdue: 87, jobLink: "Administrative Assistant", isAutoTriggered: true, hasAlarmNotification: true, urgencyGroup: "overdue", dotStatusColor: "red", description: "Review incoming applications and shortlist top 50 candidates for functional team leads tech stack evaluation loops.", isCompleted: false },
        { id: "tsk-4", title: "Schedule interviews for Product Manager role", assignee: "Sarah Adeola", dueDate: "March 27, 2026", daysOverdue: 80, jobLink: "Chief Executive Officer", isAutoTriggered: true, hasAlarmNotification: true, urgencyGroup: "overdue", dotStatusColor: "red", description: "Coordinate slots across senior execution steering board calendars for candidate interviews phase-2 evaluation.", isCompleted: false },
        { id: "tsk-5", title: "Send offer letter to finalist candidate", assignee: "Chioma Nwosu", dueDate: "April 02, 2026", daysOverdue: 74, jobLink: "HR Specialist", isAutoTriggered: true, hasAlarmNotification: false, urgencyGroup: "overdue", dotStatusColor: "red", description: "Prepare and dispatch complete formal employment bundle including initial compensation breakdown details packages.", isCompleted: false },
        { id: "tsk-6", title: "Post job to Jobberman and LinkedIn", assignee: "Emeka Okafor", dueDate: "April 07, 2026", daysOverdue: 79, jobLink: "Python Data Scientist", isAutoTriggered: false, hasAlarmNotification: false, urgencyGroup: "overdue", dotStatusColor: "red", description: "Publish data department engineering position open criteria across active boards tracking referral parameter metrics.", isCompleted: false },
        { id: "tsk-7", title: "Shortlist candidates for UI/UX Designer", assignee: "Sarah Adeola", dueDate: null, daysOverdue: null, jobLink: "SEC Specialist", isAutoTriggered: false, hasAlarmNotification: false, urgencyGroup: "no-due-date", dotStatusColor: "amber", description: "Filter design portfolio links verifying user interaction case studies matching current brand alignment system updates.", isCompleted: false },
        { id: "tsk-completed-1", title: "Collect scorecards from interviewers", assignee: "David Adeleke", dueDate: "March 15, 2026", daysOverdue: null, jobLink: "Administrative Assistant", isAutoTriggered: true, hasAlarmNotification: false, urgencyGroup: "completed", dotStatusColor: "amber", description: "Compile and aggregate structured score matrices evaluation sheets following engineering interview loops sync.", isCompleted: true }
    ],
    automationRulesCollection: [
        { id: "auto-1", title: "CV Review Overdue Escalation", isActive: true, when: "Task is overdue by 7 days", ifCondition: "Task is not marked complete", thenAction: "2 actions: notify, escalate", lastTriggered: "Mar 25, 3:30 PM", weeklyCount: 3, fullConfigDump: ["Trigger: Task is overdue by 7 days", "Condition: Task is not marked complete", "Actions: Notify assigned user via both email & internal notification dashboard context, then automatically escalate priority elevation matrix tier to admin-1 level ruleset automatically."] },
        { id: "auto-2", title: "Interview Scorecard Missing Reminder", isActive: true, when: "Task is completed", ifCondition: "No scorecard submitted within 2 hours of interview end", thenAction: "Notify assigned user via both", lastTriggered: "Mar 27, 12:00 PM", weeklyCount: 8, fullConfigDump: ["Trigger: Task is completed status transition fired", "Condition: No scorecard submitted within 2 hours of interview session end markers", "Actions: Fire automated operational logging notification block to current user dashboards."] },
        { id: "auto-3", title: "Offer Task Escalation", isActive: true, when: "Task is overdue by 2 days", ifCondition: null, thenAction: "2 actions: notify, create_task", lastTriggered: "Mar 20, 5:00 PM", weeklyCount: 2, fullConfigDump: ["Trigger: Task is overdue by 2 days threshold check", "Condition: Global run mode active", "Actions: Dispatch instant manager escalation alert logs and spin up dependent verification side tasks automatically."] },
        { id: "auto-4", title: "Auto-Create Checklist on Job Post", isActive: true, when: "A new job is published", ifCondition: null, thenAction: "Create task: \"Create all checklist tasks from template\"", lastTriggered: "Mar 26, 11:30 AM", weeklyCount: 15, fullConfigDump: ["Trigger: A new job is published system webhook event", "Condition: None", "Actions: Generate complete onboarding sub-checklist nodes mapped from global configuration directory templates automatically."] },
        { id: "auto-5", title: "Stage Transition Task Creation", isActive: true, when: "Candidate moves to Interview stage", ifCondition: null, thenAction: "Create task: \"Collect scorecard from [Interviewer Name]\"", lastTriggered: "Mar 27, 2:00 PM", weeklyCount: 12, fullConfigDump: ["Trigger: Candidate moves to Interview pipeline step status location node", "Condition: None", "Actions: Map structural scorecard validation collection targets tracking owner parameters."] }
    ]
};

let DOM_CACHE = {};
let currentOpenedRulePopoverId = null;

function captureDomReferences() {
    DOM_CACHE.tabButtons = document.querySelectorAll('.ts-tab-btn');
    DOM_CACHE.paneAllTasks = document.getElementById('ts-pane-all-tasks');
    DOM_CACHE.paneMyTasks = document.getElementById('ts-pane-my-tasks');
    DOM_CACHE.paneByJob = document.getElementById('ts-pane-by-job');
    DOM_CACHE.workspaceTasks = document.getElementById('ts-main-tasks-container');
    DOM_CACHE.workspaceAutomation = document.getElementById('ts-main-automation-container');
    DOM_CACHE.automationToggleBtn = document.getElementById('ts-automation-rules-toggle');
    DOM_CACHE.overdueContainer = document.getElementById('ts-overdue-cards-wrapper');
    DOM_CACHE.noDueDateContainer = document.getElementById('ts-no-due-cards-wrapper');
    DOM_CACHE.jobsGroupedWrapper = document.getElementById('ts-jobs-grouped-stack-wrapper');
    DOM_CACHE.automationCardsContainer = document.getElementById('ts-automation-cards-container');
    DOM_CACHE.detailDrawer = document.getElementById('ts-detail-context-drawer');
    DOM_CACHE.closeDrawerBtn = document.getElementById('ts-close-drawer-action');
    DOM_CACHE.drawerSlot = document.getElementById('ts-drawer-content-slot');
    DOM_CACHE.newTaskTriggerBtn = document.getElementById('ts-new-task-trigger');
    DOM_CACHE.sidebarFilterItems = document.querySelectorAll('.ts-filter-item');
    DOM_CACHE.popoverMenu = document.getElementById('ts-global-popover-menu');
}

function initApp() {
    captureDomReferences();
    bindInterfaceEventHandlers();
    renderTasksCoreEngineViews();
    if (window.renderAutomationRulesLayoutStack) renderAutomationRulesLayoutStack();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

function bindInterfaceEventHandlers() {
    DOM_CACHE.tabButtons.forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            var chosenTarget = e.currentTarget.getAttribute('data-view-target');
            executeViewTabTransition(chosenTarget);
        });
    });

    DOM_CACHE.automationToggleBtn.addEventListener('click', function() {
        TS_APPLICATION_STATE.isAutomationViewActive = !TS_APPLICATION_STATE.isAutomationViewActive;
        closeTaskContextDrawerPane();

        if (TS_APPLICATION_STATE.isAutomationViewActive) {
            DOM_CACHE.workspaceTasks.classList.add('ts-hidden-view');
            DOM_CACHE.workspaceAutomation.classList.remove('ts-hidden-view');
            DOM_CACHE.automationToggleBtn.classList.add('ts-active');
            DOM_CACHE.tabButtons.forEach(function(b) { b.setAttribute('disabled', 'true'); });
        } else {
            DOM_CACHE.workspaceAutomation.classList.add('ts-hidden-view');
            DOM_CACHE.workspaceTasks.classList.remove('ts-hidden-view');
            DOM_CACHE.automationToggleBtn.classList.remove('ts-active');
            DOM_CACHE.tabButtons.forEach(function(b) { b.removeAttribute('disabled'); });
            executeViewTabTransition(TS_APPLICATION_STATE.currentActiveTab);
        }
    });

    DOM_CACHE.closeDrawerBtn.addEventListener('click', closeTaskContextDrawerPane);

    DOM_CACHE.newTaskTriggerBtn.addEventListener('click', function() {
        if (window.openTaskModal) window.openTaskModal();
    });

    document.addEventListener('click', function(e) {
        if (!e.target.closest('.ts-icon-button-more-popover-trigger') && !e.target.closest('#ts-global-popover-menu')) {
            DOM_CACHE.popoverMenu.style.display = 'none';
            currentOpenedRulePopoverId = null;
        }
    });

    DOM_CACHE.sidebarFilterItems.forEach(function(item) {
        item.addEventListener('click', function(e) {
            DOM_CACHE.sidebarFilterItems.forEach(function(i) { i.classList.remove('ts-active'); });
            e.currentTarget.classList.add('ts-active');

            if (TS_APPLICATION_STATE.isAutomationViewActive) {
                DOM_CACHE.automationToggleBtn.click();
            }

            var filterType = e.currentTarget.getAttribute('data-filter-type');
            var filterVal = e.currentTarget.getAttribute('data-filter-value');
            executeTargetedSidebarDataFiltering(filterType, filterVal);
        });
    });
}

function executeViewTabTransition(targetTabId) {
    if (TS_APPLICATION_STATE.isAutomationViewActive) return;

    TS_APPLICATION_STATE.currentActiveTab = targetTabId;

    DOM_CACHE.tabButtons.forEach(function(btn) {
        if (btn.getAttribute('data-view-target') === targetTabId) {
            btn.classList.add('ts-active');
        } else {
            btn.classList.remove('ts-active');
        }
    });

    DOM_CACHE.paneAllTasks.classList.remove('ts-view-active');
    DOM_CACHE.paneMyTasks.classList.remove('ts-view-active');
    DOM_CACHE.paneByJob.classList.remove('ts-view-active');

    closeTaskContextDrawerPane();

    if (targetTabId === 'all-tasks') {
        DOM_CACHE.paneAllTasks.classList.add('ts-view-active');
        renderTasksCoreEngineViews();
    } else if (targetTabId === 'my-tasks') {
        DOM_CACHE.paneMyTasks.classList.add('ts-view-active');
    } else if (targetTabId === 'by-job') {
        DOM_CACHE.paneByJob.classList.add('ts-view-active');
        renderGroupedJobsViewHierarchyGrid();
    }
}

function renderTasksCoreEngineViews(datasourceOverride) {
    var datasetToRender = datasourceOverride || TS_APPLICATION_STATE.tasksCollection;

    DOM_CACHE.overdueContainer.innerHTML = '';
    DOM_CACHE.noDueDateContainer.innerHTML = '';

    var overdueSubset = datasetToRender.filter(function(t) { return t.urgencyGroup === 'overdue'; });
    var noDueDateSubset = datasetToRender.filter(function(t) { return t.urgencyGroup === 'no-due-date' || t.urgencyGroup === 'completed'; });

    var overdueCountEl = document.querySelector('#ts-group-overdue .ts-group-count-pill');
    var noDueCountEl = document.querySelector('#ts-group-no-due-date .ts-group-count-pill');
    if (overdueCountEl) overdueCountEl.textContent = overdueSubset.length;
    if (noDueCountEl) noDueCountEl.textContent = noDueDateSubset.length;

    if (overdueSubset.length === 0) {
        DOM_CACHE.overdueContainer.innerHTML = '<div style="padding: 16px; font-size:13px; color:#6e6861; text-align:center;">No overdue tasks present.</div>';
    } else {
        overdueSubset.forEach(function(task) {
            DOM_CACHE.overdueContainer.appendChild(createDynamicTaskItemCardHTML(task));
        });
    }

    if (noDueDateSubset.length === 0) {
        DOM_CACHE.noDueDateContainer.innerHTML = '<div style="padding: 16px; font-size:13px; color:#6e6861; text-align:center;">No reference records found here.</div>';
    } else {
        noDueDateSubset.forEach(function(task) {
            DOM_CACHE.noDueDateContainer.appendChild(createDynamicTaskItemCardHTML(task));
        });
    }
}

function createDynamicTaskItemCardHTML(taskObj) {
    var cardEl = document.createElement('div');
    cardEl.className = 'ts-task-item-card' + (taskObj.isCompleted ? ' ts-task-state-completed' : '');
    cardEl.setAttribute('data-task-id', taskObj.id);

    if (TS_APPLICATION_STATE.selectedTaskCardId === taskObj.id) {
        cardEl.classList.add('ts-selected-active');
    }

    var secondaryBadgesHtmlStr = '';
    if (taskObj.jobLink) {
        secondaryBadgesHtmlStr += '<span class="ts-functional-pill-tag ts-pill-style-job"><i class="fa-solid fa-briefcase"></i> ' + taskObj.jobLink + '</span>';
    }
    if (taskObj.isAutoTriggered) {
        secondaryBadgesHtmlStr += '<span class="ts-functional-pill-tag ts-pill-style-auto"><i class="fa-solid fa-bolt"></i> Auto</span>';
    }

    var dynamicDeadlineSegment = '';
    if (taskObj.dueDate) {
        if (taskObj.urgencyGroup === 'overdue' && !taskObj.isCompleted) {
            dynamicDeadlineSegment = '<span class="ts-deadline-tag ts-tag-is-overdue"><i class="fa-solid fa-triangle-exclamation"></i> ' + (taskObj.daysOverdue ? taskObj.daysOverdue + ' days overdue' : 'Overdue') + '</span>';
        } else {
            dynamicDeadlineSegment = '<span><i class="fa-solid fa-calendar"></i> Due ' + taskObj.dueDate + '</span>';
        }
    } else {
        dynamicDeadlineSegment = '<span>No due date</span>';
    }

    var structuralAlarmCell = taskObj.hasAlarmNotification ? '<i class="fa-solid fa-bell ts-alarm-bell-notification-icon"></i>' : '';
    var dotColorMarkerClass = taskObj.dotStatusColor === 'red' ? 'ts-dot-color-red' : 'ts-dot-color-amber';

    cardEl.innerHTML =
        '<div class="ts-task-card-left-block">' +
            '<div class="ts-checkbox-mimic" data-stop-propagation="true"></div>' +
            '<div class="ts-task-card-core-details">' +
                '<h4 class="ts-task-card-title-text">' + escapeHtml(taskObj.title) + '</h4>' +
                '<div class="ts-task-card-meta-line">' +
                    '<span class="ts-meta-actor-node"><i class="fa-solid fa-user"></i> ' + escapeHtml(taskObj.assignee) + '</span>' +
                    dynamicDeadlineSegment +
                    secondaryBadgesHtmlStr +
                '</div>' +
            '</div>' +
        '</div>' +
        '<div class="ts-task-card-right-block">' +
            structuralAlarmCell +
            '<div class="ts-status-dot-marker ' + dotColorMarkerClass + '"></div>' +
        '</div>';

    cardEl.addEventListener('click', function(e) {
        if (e.target.closest('[data-stop-propagation="true"]')) {
            e.stopPropagation();
            toggleTaskCompletionStateDataModel(taskObj.id);
            return;
        }
        openTaskContextDrawerPane(taskObj);
    });

    return cardEl;
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

function renderGroupedJobsViewHierarchyGrid() {
    DOM_CACHE.jobsGroupedWrapper.innerHTML = '';
    var distinctJobsBuckets = {};

    TS_APPLICATION_STATE.tasksCollection.forEach(function(task) {
        var structuralKey = task.jobLink || "Unassigned General Tasks";
        if (!distinctJobsBuckets[structuralKey]) {
            distinctJobsBuckets[structuralKey] = [];
        }
        distinctJobsBuckets[structuralKey].push(task);
    });

    for (var jobNameTitle in distinctJobsBuckets) {
        var tasksStack = distinctJobsBuckets[jobNameTitle];
        var bucketWrapperBox = document.createElement('div');
        bucketWrapperBox.className = 'ts-job-bucket-card-wrapper';

        var bucketId = 'ts-bucket-list-' + jobNameTitle.replace(/[^a-zA-Z0-9]/g, '-');

        bucketWrapperBox.innerHTML =
            '<div class="ts-job-bucket-header">' +
                '<i class="fa-solid fa-folder-tree ts-job-bucket-title-icon"></i>' +
                '<span class="ts-job-bucket-name">' + escapeHtml(jobNameTitle) + '</span>' +
                '<span class="ts-job-bucket-count-pill">' + tasksStack.length + ' tasks</span>' +
            '</div>' +
            '<div class="ts-job-bucket-inner-cards-vertical-list" id="' + bucketId + '"></div>';

        DOM_CACHE.jobsGroupedWrapper.appendChild(bucketWrapperBox);
        var internalListViewContainer = document.getElementById(bucketId);

        tasksStack.forEach(function(taskItem) {
            internalListViewContainer.appendChild(createDynamicTaskItemCardHTML(taskItem));
        });
    }
}

function openTaskContextDrawerPane(taskObj) {
    TS_APPLICATION_STATE.selectedTaskCardId = taskObj.id;

    document.querySelectorAll('.ts-task-item-card').forEach(function(card) {
        if (card.getAttribute('data-task-id') === taskObj.id) {
            card.classList.add('ts-selected-active');
        } else {
            card.classList.remove('ts-selected-active');
        }
    });

    var automatedBlockEmbedHtml = '';
    if (taskObj.isAutoTriggered) {
        automatedBlockEmbedHtml =
            '<div class="ts-drawer-automation-embed-infobox">' +
                '<div class="ts-drawer-auto-info-title-line"><i class="fa-solid fa-bolt"></i> Automation Settings</div>' +
                '<p style="font-size:12px; margin-bottom:8px; color:#6e6861;">This task is automatically managed by the system workflow engine.</p>' +
                '<div class="ts-drawer-auto-rule-criteria-box"><strong>TRIGGER:</strong> When candidate moves to Interview stage context rule checklist matrix.</div>' +
                '<button class="ts-btn-edit-automation-inline" id="ts-edit-auto-inline-action"><i class="fa-solid fa-sliders"></i> Edit Automation</button>' +
            '</div>';
    }

    var linkedJobTemplateString = taskObj.jobLink
        ? '<span class="ts-functional-pill-tag ts-pill-style-job" style="font-size:13px; padding:6px 12px;"><i class="fa-solid fa-briefcase"></i> ' + escapeHtml(taskObj.jobLink) + '</span>'
        : '<span style="color:#a39c94; font-size:13px; font-weight:600;">None</span>';

    DOM_CACHE.drawerSlot.innerHTML =
        '<div style="padding-top: 12px;">' +
            '<h3 class="ts-drawer-task-heading-title">' + escapeHtml(taskObj.title) + '</h3>' +
            '<div style="margin-bottom:16px;">' +
                '<span class="ts-functional-pill-tag ' + (taskObj.urgencyGroup === 'overdue' ? 'ts-pill-style-auto' : 'ts-pill-style-job') + '">' + taskObj.urgencyGroup.toUpperCase() + '</span>' +
            '</div>' +
            '<div class="ts-drawer-properties-vertical-grid">' +
                '<div class="ts-drawer-prop-row">' +
                    '<span class="ts-drawer-prop-label">Assigned to</span>' +
                    '<div class="ts-drawer-prop-value">' +
                        '<span class="ts-avatar-circle-icon">' + taskObj.assignee.charAt(0) + '</span>' +
                        '<span>' + escapeHtml(taskObj.assignee) + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="ts-drawer-prop-row">' +
                    '<span class="ts-drawer-prop-label">Due Date</span>' +
                    '<div class="ts-drawer-prop-value">' +
                        '<i class="fa-regular fa-calendar-days" style="color:#a39c94;"></i>' +
                        '<span>' + (taskObj.dueDate || 'No due date defined') + '</span>' +
                    '</div>' +
                '</div>' +
                '<div class="ts-drawer-prop-row">' +
                    '<span class="ts-drawer-prop-label">Linked to</span>' +
                    '<div class="ts-drawer-prop-value">' + linkedJobTemplateString + '</div>' +
                '</div>' +
            '</div>' +
            automatedBlockEmbedHtml +
            '<div class="ts-drawer-description-block-title">Description</div>' +
            '<p class="ts-drawer-description-text-body">' + escapeHtml(taskObj.description) + '</p>' +
            '<div class="ts-drawer-description-block-title">Activity</div>' +
            '<div style="font-size:12px; color:#6e6861; padding-left:4px; margin-bottom:32px; position:relative;">' +
                '<div style="position:absolute; left:0; top:4px; bottom:4px; width:1px; background-color:#f1eeeb;"></div>' +
                '<div style="position:relative; padding-left:14px; margin-bottom:8px;">' +
                    '<span style="position:absolute; left:-3px; top:4px; width:7px; height:7px; border-radius:50%; background-color:#d51c70;"></span>' +
                    '<strong>Created by System</strong><br><span style="color:#a39c94; font-size:11px;">Mar 13</span>' +
                '</div>' +
            '</div>' +
            '<div class="ts-drawer-footer-actions-pin-bottom">' +
                '<button class="ts-btn-full-width-complete" id="ts-drawer-complete-task-action-btn"' + (taskObj.isCompleted ? ' style="background-color:#edebe8; color:#a39c94; cursor:not-allowed;" disabled' : '') + '>' +
                    (taskObj.isCompleted ? '<i class="fa-solid fa-check"></i> Completed' : 'Mark Complete') +
                '</button>' +
            '</div>' +
        '</div>';

    DOM_CACHE.detailDrawer.classList.add('ts-drawer-expanded');

    if (taskObj.isAutoTriggered) {
        var editAutoBtn = document.getElementById('ts-edit-auto-inline-action');
        if (editAutoBtn) {
            editAutoBtn.addEventListener('click', function() {
                DOM_CACHE.automationToggleBtn.click();
            });
        }
    }

    if (!taskObj.isCompleted) {
        var completeBtn = document.getElementById('ts-drawer-complete-task-action-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', function() {
                toggleTaskCompletionStateDataModel(taskObj.id);
                closeTaskContextDrawerPane();
            });
        }
    }
}

function closeTaskContextDrawerPane() {
    TS_APPLICATION_STATE.selectedTaskCardId = null;
    DOM_CACHE.detailDrawer.classList.remove('ts-drawer-expanded');
    document.querySelectorAll('.ts-task-item-card').forEach(function(c) { c.classList.remove('ts-selected-active'); });
}

function toggleTaskCompletionStateDataModel(taskId) {
    TS_APPLICATION_STATE.tasksCollection = TS_APPLICATION_STATE.tasksCollection.map(function(task) {
        if (task.id === taskId) {
            var toggledState = !task.isCompleted;
            return {
                id: task.id,
                title: task.title,
                assignee: task.assignee,
                dueDate: task.dueDate,
                daysOverdue: task.daysOverdue,
                jobLink: task.jobLink,
                isAutoTriggered: task.isAutoTriggered,
                hasAlarmNotification: task.hasAlarmNotification,
                urgencyGroup: toggledState ? "completed" : (task.dueDate ? "overdue" : "no-due-date"),
                dotStatusColor: task.dotStatusColor,
                description: task.description,
                isCompleted: toggledState
            };
        }
        return task;
    });

    if (TS_APPLICATION_STATE.currentActiveTab === 'by-job') {
        renderGroupedJobsViewHierarchyGrid();
    } else {
        renderTasksCoreEngineViews();
    }

    updateSystemHeaderMetricsPanelSummary();
}

function updateSystemHeaderMetricsPanelSummary() {
    var totalPendingCount = TS_APPLICATION_STATE.tasksCollection.filter(function(t) { return !t.isCompleted; }).length;
    var totalOverdueCount = TS_APPLICATION_STATE.tasksCollection.filter(function(t) { return t.urgencyGroup === 'overdue' && !t.isCompleted; }).length;
    var summaryEl = document.getElementById('ts-tasks-summary');
    if (summaryEl) summaryEl.textContent = totalPendingCount + ' pending \u00B7 ' + totalOverdueCount + ' overdue \u00B7 1 completed this week';
}

function executeTargetedSidebarDataFiltering(type, criterion) {
    if (type === 'urgency') {
        var localFilteredSet = TS_APPLICATION_STATE.tasksCollection.filter(function(t) { return t.urgencyGroup === criterion; });
        renderTasksCoreEngineViews(localFilteredSet);
    } else if (type === 'job') {
        var localFilteredSet = TS_APPLICATION_STATE.tasksCollection.filter(function(t) { return t.jobLink === criterion; });
        renderTasksCoreEngineViews(localFilteredSet);
    }
}

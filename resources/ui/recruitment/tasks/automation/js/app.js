function renderAutomationRulesLayoutStack() {
    var container = document.getElementById('ts-automation-cards-container');
    if (!container) return;

    if (typeof TS_APPLICATION_STATE === 'undefined') return;

    container.innerHTML = '';

    TS_APPLICATION_STATE.automationRulesCollection.forEach(function(rule) {
        var ruleCardRootNode = document.createElement('div');
        ruleCardRootNode.className = 'ts-automation-rule-card-item';
        ruleCardRootNode.setAttribute('data-rule-id', rule.id);

        var validationIfElementBlock = '';
        if (rule.ifCondition) {
            validationIfElementBlock =
                '<i class="fa-solid fa-arrow-right ts-flow-arrow-separator-icon"></i>' +
                '<div class="ts-flow-block-node ts-flow-node-style-if">' +
                    '<span>IF</span>' +
                    '<span>' + escapeHtml(rule.ifCondition) + '</span>' +
                '</div>';
        }

        ruleCardRootNode.innerHTML =
            '<div class="ts-automation-card-main-row-header">' +
                '<div class="ts-automation-card-left-meta-info">' +
                    '<div class="ts-automation-rule-title-line-row">' +
                        '<h3>' + escapeHtml(rule.title) + '</h3>' +
                        '<span class="ts-status-pill-badge-active">' +
                            '<span style="display:inline-block; width:6px; height:6px; background-color:#2da160; border-radius:50%;"></span> Active' +
                        '</span>' +
                    '</div>' +
                    '<div class="ts-automation-flow-chain-visual-row">' +
                        '<div class="ts-flow-block-node ts-flow-node-style-when">' +
                            '<span>WHEN</span>' +
                            '<span>' + escapeHtml(rule.when) + '</span>' +
                        '</div>' +
                        validationIfElementBlock +
                        '<i class="fa-solid fa-arrow-right ts-flow-arrow-separator-icon"></i>' +
                        '<div class="ts-flow-block-node ts-flow-node-style-then">' +
                            '<span>THEN</span>' +
                            '<span>' + escapeHtml(rule.thenAction) + '</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="ts-automation-trigger-frequency-meta-footer">' +
                        '<span>Last triggered: ' + escapeHtml(rule.lastTriggered) + '</span>' +
                        '<span>Triggered ' + rule.weeklyCount + ' times this week</span>' +
                    '</div>' +
                '</div>' +
                '<div class="ts-automation-card-right-controls-cell">' +
                    '<button class="ts-btn-text-expand-trigger" data-action="slide-toggle">View details <i class="fa-solid fa-chevron-down"></i></button>' +
                    '<button class="ts-icon-button-more-popover-trigger" data-action="popover-open"><i class="fa-solid fa-ellipsis-vertical"></i></button>' +
                '</div>' +
            '</div>' +
            '<div class="ts-automation-expandable-details-drawer-panel">' +
                '<div class="ts-automation-drawer-inner-padding-box">' +
                    '<div class="ts-automation-detailed-configuration-dump-box">' +
                        '<h4>Full Configuration</h4>' +
                        '<ul>' +
                            rule.fullConfigDump.map(function(strLine) { return '<li>' + escapeHtml(strLine) + '</li>'; }).join('') +
                        '</ul>' +
                    '</div>' +
                '</div>' +
            '</div>';

        var toggleButtonTextAction = ruleCardRootNode.querySelector('[data-action="slide-toggle"]');
        var internalHiddenTargetSlidePanel = ruleCardRootNode.querySelector('.ts-automation-expandable-details-drawer-panel');

        toggleButtonTextAction.addEventListener('click', function() {
            var isCurrentlyOpened = internalHiddenTargetSlidePanel.classList.contains('ts-slide-down-expanded');
            if (isCurrentlyOpened) {
                internalHiddenTargetSlidePanel.classList.remove('ts-slide-down-expanded');
                internalHiddenTargetSlidePanel.style.maxHeight = '0px';
                toggleButtonTextAction.innerHTML = 'View details <i class="fa-solid fa-chevron-down"></i>';
            } else {
                internalHiddenTargetSlidePanel.classList.add('ts-slide-down-expanded');
                internalHiddenTargetSlidePanel.style.maxHeight = internalHiddenTargetSlidePanel.scrollHeight + 'px';
                toggleButtonTextAction.innerHTML = 'Hide details <i class="fa-solid fa-chevron-up"></i>';
            }
        });

        var individualPopoverTriggerBtn = ruleCardRootNode.querySelector('[data-action="popover-open"]');
        individualPopoverTriggerBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var popoverMenu = document.getElementById('ts-global-popover-menu');
            if (!popoverMenu) return;

            var clientCoordinatesRect = individualPopoverTriggerBtn.getBoundingClientRect();
            popoverMenu.style.top = (clientCoordinatesRect.bottom + window.scrollY + 6) + 'px';
            popoverMenu.style.left = (clientCoordinatesRect.left + window.scrollX - 150) + 'px';
            popoverMenu.style.display = 'block';
        });

        container.appendChild(ruleCardRootNode);
    });
}

function escapeHtml(text) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

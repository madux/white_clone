document.addEventListener('DOMContentLoaded', () => {

    // --- State Machine Scope Variables ---
    let chosenBranchMode = null; // "quick" or "full" - null until selected
    let currentWizardStep = 1;
    const totalWizardSteps = 8;

    // --- DOM Elements Root Layer Cache ---
    const rootModalOverlay = document.getElementById('cleon-job-modal-root');
    const openModalBtn = document.getElementById('cleon-open-modal-btn');
    
    // View Panels
    const viewGateway = document.getElementById('cleon-view-gateway');
    const viewQuickForm = document.getElementById('cleon-view-quick-form');
    const viewGateway2 = document.getElementById('cleon-view-gateway-2');
    const viewTemplateGateway = document.getElementById('cleon-view-template-gateway');
    const viewAIInput = document.getElementById('cleon-view-ai-input');
    const viewAILoading = document.getElementById('cleon-view-ai-loading');
    const viewAIOutput = document.getElementById('cleon-view-ai-output');
    const viewFullWizard = document.getElementById('cleon-view-full-wizard');
    
    // Navigation Triggers
    const backToGatewayFromQuickBtn = document.getElementById('cleon-back-to-gateway-from-quick');
    const backToGatewayFromWizardBtn = document.getElementById('cleon-back-to-gateway-from-wizard');
    const backToGateway2FromTemplateBtn = document.getElementById('cleon-back-to-gateway-2-from-template');
    const backToGateway2FromAIInputBtn = document.getElementById('cleon-back-to-gateway-2-from-ai-input');
    const wizardPrevBtn = document.getElementById('cleon-prev-btn');
    const wizardNextBtn = document.getElementById('cleon-next-btn');
    const stepSubheading = document.getElementById('cleon-step-subheading');

    // Field Handles for State Sync
    const inputJobTitle = document.getElementById('input-job-title');
    const inputJobDept = document.getElementById('input-job-dept');

    // --- Global View Toggle ---
    function activatePanel(targetPanel) {
        document.querySelectorAll('.cleon-modal-view-panel').forEach(p => p.classList.remove('cleon-panel-visible'));
        targetPanel.classList.add('cleon-panel-visible');
    }

    // --- Open / Dismiss Modal ---
    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            chosenBranchMode = null;
            currentWizardStep = 1;
            
            activatePanel(viewGateway);
            rootModalOverlay.classList.add('cleon-modal-visible');
        });
    }

    document.querySelectorAll('.modal-close-trigger').forEach(trigger => {
        trigger.addEventListener('click', () => {
            rootModalOverlay.classList.remove('cleon-modal-visible');
        });
    });

    if (rootModalOverlay) {
        rootModalOverlay.addEventListener('click', (e) => {
            if (e.target === rootModalOverlay) {
                rootModalOverlay.classList.remove('cleon-modal-visible');
            }
        });
    }

    // --- Gateway 1: Card Click Handlers ---
    const gatewayCards = document.querySelectorAll('.cleon-gateway-card');
    gatewayCards.forEach(card => {
        card.addEventListener('click', () => {
            const mode = card.getAttribute('data-mode');
            if (mode === 'quick') {
                activatePanel(viewQuickForm);
            } else if (mode === 'full') {
                activatePanel(viewGateway2);
            }
        });
    });

    // --- Gateway 1: Card Link Click Handlers (stop propagation) ---
    const gatewayLinks = document.querySelectorAll('.cleon-gateway-card-link');
    gatewayLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.stopPropagation();
            const action = link.getAttribute('data-action');
            if (action === 'quick') {
                activatePanel(viewQuickForm);
            } else if (action === 'full') {
                activatePanel(viewGateway2);
            }
        });
    });

    // --- Back Navigation ---
    if (backToGatewayFromQuickBtn) {
        backToGatewayFromQuickBtn.addEventListener('click', () => {
            activatePanel(viewGateway);
        });
    }

    if (backToGatewayFromWizardBtn) {
        backToGatewayFromWizardBtn.addEventListener('click', () => {
            activatePanel(viewGateway);
        });
    }

    if (backToGateway2FromTemplateBtn) {
        backToGateway2FromTemplateBtn.addEventListener('click', () => {
            activatePanel(viewGateway2);
        });
    }

    if (backToGateway2FromAIInputBtn) {
        backToGateway2FromAIInputBtn.addEventListener('click', () => {
            activatePanel(viewGateway2);
        });
    }

    // --- Gateway 2: Card Click Handlers ---
    const gateway2Cards = document.querySelectorAll('.cleon-gateway-card[data-action]');
    gateway2Cards.forEach(card => {
        card.addEventListener('click', () => {
            const action = card.getAttribute('data-action');
            if (action === 'build') {
                currentWizardStep = 1;
                renderWizardStepState();
                activatePanel(viewFullWizard);
            } else if (action === 'template') {
                activatePanel(viewTemplateGateway);
            } else if (action === 'ai') {
                activatePanel(viewAIInput);
            }
        });
    });

    // --- Template Gateway: Filter Chips ---
    const templateFilterChips = document.querySelectorAll('.cleon-filter-chip');
    templateFilterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            templateFilterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            // Filter logic can be added here
        });
    });

    // --- Template Gateway: Template Card Click ---
    const templateCards = document.querySelectorAll('.cleon-template-card');
    templateCards.forEach(card => {
        card.addEventListener('click', () => {
            currentWizardStep = 1;
            renderWizardStepState();
            activatePanel(viewFullWizard);
        });
    });

    // --- AI-Assisted: Generate Button ---
    const aiGenerateBtn = document.getElementById('cleon-ai-generate-btn');
    if (aiGenerateBtn) {
        aiGenerateBtn.addEventListener('click', () => {
            activatePanel(viewAILoading);
            // Simulate loading
            setTimeout(() => {
                activatePanel(viewAIOutput);
            }, 3000);
        });
    }

    // --- AI-Assisted: Start Over Button ---
    const aiStartOverBtn = document.getElementById('cleon-ai-start-over');
    if (aiStartOverBtn) {
        aiStartOverBtn.addEventListener('click', () => {
            activatePanel(viewAIInput);
        });
    }

    // --- AI-Assisted: Cancel Button ---
    const aiCancelBtn = document.getElementById('cleon-ai-cancel-btn');
    if (aiCancelBtn) {
        aiCancelBtn.addEventListener('click', () => {
            activatePanel(viewGateway2);
        });
    }

    // --- AI-Assisted: Use This Content Button ---
    const aiUseContentBtn = document.getElementById('cleon-ai-use-content');
    if (aiUseContentBtn) {
        aiUseContentBtn.addEventListener('click', () => {
            currentWizardStep = 1;
            renderWizardStepState();
            activatePanel(viewFullWizard);
        });
    }

    // --- Pill Button Groups ---
    document.querySelectorAll('.cleon-pill-buttons-group').forEach(group => {
        group.querySelectorAll('.cleon-pill-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                group.querySelectorAll('.cleon-pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    });

    // --- Wizard Step Navigation ---
    if (wizardNextBtn) {
        wizardNextBtn.addEventListener('click', () => {
            if (currentWizardStep < totalWizardSteps) {
                currentWizardStep++;
                renderWizardStepState();
            } else {
                alert('Job posting created successfully!');
                rootModalOverlay.classList.remove('cleon-modal-visible');
            }
        });
    }

    if (wizardPrevBtn) {
        wizardPrevBtn.addEventListener('click', () => {
            if (currentWizardStep > 1) {
                currentWizardStep--;
                renderWizardStepState();
            } else {
                activatePanel(viewGateway);
            }
        });
    }

    function renderWizardStepState() {
        // Hide all panes, show current
        document.querySelectorAll('.cleon-step-content-pane').forEach(p => p.classList.remove('cleon-visible'));
        const currentPane = document.getElementById(`cleon-pane-${currentWizardStep}`);
        if (currentPane) currentPane.classList.add('cleon-visible');

        // Update subheading
        const stepTitles = [
            "Basic Details", "Job Description", "Pipeline Setup", 
            "AI Interview", "Job Checklist", "Application Form", 
            "Posting & Visibility", "Review & Publish"
        ];
        if (stepSubheading) stepSubheading.textContent = `Step ${currentWizardStep} of ${totalWizardSteps}: ${stepTitles[currentWizardStep - 1]}`;

        // Update Next button text
        if (wizardNextBtn) {
            if (currentWizardStep === totalWizardSteps) {
                wizardNextBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Publish`;
            } else {
                wizardNextBtn.innerHTML = `Next <i class="fa-solid fa-chevron-right"></i>`;
            }
        }

        // Update stepper nodes
        document.querySelectorAll('.cleon-step-node').forEach((node, idx) => {
            const stepNum = idx + 1;
            node.classList.remove('cleon-active', 'cleon-completed');
            if (stepNum === currentWizardStep) {
                node.classList.add('cleon-active');
            } else if (stepNum < currentWizardStep) {
                node.classList.add('cleon-completed');
            }
        });

        // Step 8: Run review sync
        if (currentWizardStep === 8) {
            runFinalReviewSync();
        }
    }

    // --- Step 2: Character Counter ---
    const jobDescTextarea = document.getElementById('cleon-job-desc-textarea');
    if (jobDescTextarea) {
        jobDescTextarea.addEventListener('input', (e) => {
            const len = e.target.value.length;
            const counter = document.querySelector('.cleon-char-counter');
            if (counter) {
                const warning = counter.querySelector('.cleon-char-warning');
                const total = counter.querySelector('span:last-child');
                if (len < 50) {
                    warning.textContent = `${50 - len} more characters needed`;
                    warning.style.color = '#f97316';
                } else {
                    warning.textContent = 'Ready to go!';
                    warning.style.color = '#22c55e';
                }
                total.textContent = `${len} characters`;
            }
        });
    }

    // --- Step 2: Dynamic Items (Responsibilities, Requirements, Preferred) ---
    document.querySelectorAll('.cleon-btn-add-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const list = btn.closest('.cleon-form-group').querySelector('.cleon-dynamic-items-list');
            if (list) {
                const item = document.createElement('div');
                item.className = 'cleon-dynamic-item-row';
                item.innerHTML = `
                    <input type="text" placeholder="Enter item...">
                    <button class="cleon-btn-delete-item"><i class="fa-solid fa-trash"></i></button>
                `;
                list.appendChild(item);
                item.querySelector('.cleon-btn-delete-item').addEventListener('click', () => item.remove());
            }
        });
    });

    document.querySelectorAll('.cleon-btn-delete-item').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.cleon-dynamic-item-row').remove());
    });

    // --- Step 3: Pipeline Stages ---
    const pipelineContainer = document.getElementById('cleon-pipeline-sortable-container');
    const addStageBtn = document.getElementById('cleon-add-stage-btn');
    
    if (addStageBtn && pipelineContainer) {
        addStageBtn.addEventListener('click', () => {
            const item = document.createElement('div');
            item.className = 'cleon-pipeline-item-row';
            item.innerHTML = `
                <div class="cleon-drag-handle"><i class="fa-solid fa-grip-vertical"></i></div>
                <input type="text" value="Custom Stage">
                <button class="cleon-row-delete-btn"><i class="fa-solid fa-trash"></i></button>
            `;
            pipelineContainer.appendChild(item);
            item.querySelector('.cleon-row-delete-btn').addEventListener('click', () => item.remove());
        });
    }

    document.querySelectorAll('.cleon-row-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => btn.closest('.cleon-pipeline-item-row').remove());
    });

    // --- Step 4: AI Interview Toggle ---
    const aiMasterToggle = document.getElementById('cleon-ai-master-toggle');
    const aiFallbackPlaceholder = document.getElementById('cleon-ai-disabled-placeholder');
    const aiConfigArea = document.getElementById('cleon-ai-config-flow-area');

    if (aiMasterToggle) {
        aiMasterToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                aiFallbackPlaceholder.classList.add('cleon-hidden-element');
                aiConfigArea.classList.remove('cleon-hidden-element');
            } else {
                aiFallbackPlaceholder.classList.remove('cleon-hidden-element');
                aiConfigArea.classList.add('cleon-hidden-element');
            }
        });
    }

    // --- Step 4: AI Accordion Cards ---
    const aiAccordions = document.querySelectorAll('.cleon-accordion-card');
    aiAccordions.forEach(card => {
        const headerBar = card.querySelector('.cleon-accordion-summary-bar');
        if (headerBar) {
            headerBar.addEventListener('click', (e) => {
                if (e.target.closest('.cleon-card-trash-trigger')) return;

                const isOpen = card.classList.contains('cleon-expanded');
                aiAccordions.forEach(c => c.classList.remove('cleon-expanded'));

                if (!isOpen) {
                    card.classList.add('cleon-expanded');
                }
            });
        }

        const trashBtn = card.querySelector('.cleon-card-trash-trigger');
        if (trashBtn) {
            trashBtn.addEventListener('click', () => card.remove());
        }
    });

    // --- Step 4: Format Selection ---
    document.querySelectorAll('.cleon-format-option-row').forEach(row => {
        row.addEventListener('click', () => {
            document.querySelectorAll('.cleon-format-option-row').forEach(r => r.classList.remove('cleon-format-active'));
            row.classList.add('cleon-format-active');
            row.querySelector('input[type="radio"]').checked = true;
        });
    });

    // --- Step 4: Visibility Radio Cards ---
    document.querySelectorAll('.cleon-radio-card').forEach(card => {
        card.addEventListener('click', () => {
            const group = card.closest('.cleon-visibility-options');
            if (group) {
                group.querySelectorAll('.cleon-radio-card').forEach(c => c.classList.remove('cleon-radio-active'));
            }
            card.classList.add('cleon-radio-active');
            card.querySelector('input[type="radio"]').checked = true;
        });
    });

    // --- Step 6: Custom Questions ---
    const addCustomQBtn = document.getElementById('cleon-add-custom-q-btn');
    const customQFallback = document.getElementById('cleon-custom-q-empty-fallback');
    const customQBuilder = document.getElementById('cleon-custom-q-builder-container');

    if (addCustomQBtn) {
        addCustomQBtn.addEventListener('click', () => {
            customQFallback.classList.add('cleon-hidden-element');
            customQBuilder.classList.remove('cleon-hidden-element');
        });
    }

    if (customQBuilder) {
        const deleteQBtn = customQBuilder.querySelector('.cleon-delete-q-btn');
        if (deleteQBtn) {
            deleteQBtn.addEventListener('click', () => {
                customQBuilder.classList.add('cleon-hidden-element');
                customQFallback.classList.remove('cleon-hidden-element');
            });
        }
    }

    // --- Step 6: Pipeline Impact Rules ---
    const addRuleBtn = document.getElementById('cleon-add-rule-btn');
    const ruleTarget = document.getElementById('cleon-rule-row-injection-target');
    const ruleEmptyText = document.getElementById('cleon-rule-empty-text-lbl');

    if (addRuleBtn) {
        addRuleBtn.addEventListener('click', () => {
            ruleEmptyText.classList.add('cleon-hidden-element');
            ruleTarget.classList.remove('cleon-hidden-element');
        });
    }

    if (ruleTarget) {
        const deleteRuleBtn = ruleTarget.querySelector('.cleon-delete-rule-btn');
        if (deleteRuleBtn) {
            deleteRuleBtn.addEventListener('click', () => {
                ruleTarget.classList.add('cleon-hidden-element');
                ruleEmptyText.classList.remove('cleon-hidden-element');
            });
        }
    }

    // --- Step 7: Days Quick Buttons ---
    document.querySelectorAll('.cleon-days-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cleon-days-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const daysInput = document.querySelector('.cleon-days-input');
            if (daysInput) {
                daysInput.value = parseInt(btn.textContent);
            }
        });
    });

    // --- Step 8: Review Sync ---
    function runFinalReviewSync() {
        const titleEl = document.getElementById('review-txt-title');
        const deptEl = document.getElementById('review-txt-dept');
        const locationEl = document.getElementById('review-txt-location');

        if (titleEl) titleEl.textContent = inputJobTitle?.value?.trim() || "Not set";
        if (deptEl) deptEl.textContent = inputJobDept?.value?.trim() || "Not set";
        
        const locationInput = document.getElementById('input-job-location');
        if (locationEl) locationEl.textContent = locationInput?.value?.trim() || "Not set";

        // Sync pipeline pills
        const pipelineRow = document.getElementById('review-pipeline-target-row');
        if (pipelineRow) {
            pipelineRow.innerHTML = "";
            const stageInputs = document.querySelectorAll('#cleon-pipeline-sortable-container input[type="text"]');
            stageInputs.forEach((input, idx) => {
                const pill = document.createElement('span');
                pill.className = 'cleon-review-stage-pill';
                pill.textContent = input.value;
                pipelineRow.appendChild(pill);

                if (idx < stageInputs.length - 1) {
                    const arrow = document.createElement('i');
                    arrow.className = 'fa-solid fa-chevron-right';
                    arrow.style.color = '#cbd5e1';
                    arrow.style.fontSize = '10px';
                    pipelineRow.appendChild(arrow);
                }
            });
        }
    }
});

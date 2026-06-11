function initAddCandidateModal() {
    const backdrop = document.getElementById("candidateModalBackdrop");
    const parentModal = document.getElementById("add-candidate-parent-modal");
    const subModals = document.querySelectorAll(".modal-card:not(#add-candidate-parent-modal)");
    const selectionCards = document.querySelectorAll(".selection-card");
    const backButtons = document.querySelectorAll(".back-to-parent");
    const closeButtons = document.querySelectorAll("[data-action='close']");
    const downloadTemplateBtn = document.getElementById("downloadTemplateBtn");

    function routeToView(targetId) {
        parentModal.classList.remove("active");
        subModals.forEach(modal => modal.classList.remove("active"));
        const targetView = document.getElementById(targetId);
        if (targetView) {
            targetView.classList.add("active");
            const scrollContainer = targetView.querySelector(".modal-scroll-content");
            if (scrollContainer) scrollContainer.scrollTop = 0;
        }
    }

    function routeToParentDashboard() {
        subModals.forEach(modal => modal.classList.remove("active"));
        parentModal.classList.add("active");
    }

    function terminateModalWorkflow() {
        backdrop.style.display = "none";
        routeToParentDashboard();
    }

    selectionCards.forEach(card => {
        card.addEventListener("click", () => {
            const destinationView = card.getAttribute("data-target");
            if (destinationView) {
                routeToView(destinationView);
            }
        });
    });

    backButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            routeToParentDashboard();
        });
    });

    closeButtons.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.stopPropagation();
            terminateModalWorkflow();
        });
    });

    backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
            terminateModalWorkflow();
        }
    });

    if (downloadTemplateBtn) {
        downloadTemplateBtn.addEventListener("click", () => {
            const optimalHeaderString = "firstName,lastName,email,phone,location,position,experience\n";
            const blobContent = new Blob([optimalHeaderString], { type: 'text/csv;charset=utf-8;' });
            const anchorElement = document.createElement("a");
            const objectUrl = URL.createObjectURL(blobContent);

            anchorElement.setAttribute("href", objectUrl);
            anchorElement.setAttribute("download", "candidate_bulk_import_template.csv");
            anchorElement.style.visibility = 'hidden';

            document.body.appendChild(anchorElement);
            anchorElement.click();
            document.body.removeChild(anchorElement);
        });
    }

    const resumeDropzone = document.getElementById("resumeDropzone");
    if (resumeDropzone) {
        resumeDropzone.addEventListener("click", () => {
            document.getElementById("resumeFileInput").click();
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            resumeDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                resumeDropzone.style.borderColor = "var(--green-primary)";
                resumeDropzone.style.backgroundColor = "var(--green-light)";
            }, false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            resumeDropzone.addEventListener(eventName, (e) => {
                e.preventDefault();
                resumeDropzone.style.borderColor = "#cbd5e1";
                resumeDropzone.style.backgroundColor = "#ffffff";
            }, false);
        });
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initOHInnerTabs();
    initOHPlacementSubTabs();
});

function initOHInnerTabs() {
    const placementsBtn = document.querySelector(".oh-inner-tab-placements");
    const offersBtn = document.querySelector(".oh-inner-tab-offers");
    const placementsView = document.getElementById("ohPlacementsView");
    const offersView = document.getElementById("ohOffersView");

    placementsBtn.addEventListener("click", () => {
        placementsBtn.classList.add("active");
        offersBtn.classList.remove("active");
        placementsView.style.display = "block";
        offersView.style.display = "none";
    });

    offersBtn.addEventListener("click", () => {
        offersBtn.classList.add("active");
        placementsBtn.classList.remove("active");
        offersView.style.display = "block";
        placementsView.style.display = "none";
    });
}

function initOHPlacementSubTabs() {
    const subTabs = document.querySelectorAll(".oh-sub-tab-item");
    subTabs.forEach(tab => {
        tab.addEventListener("click", () => {
            subTabs.forEach(t => t.classList.remove("active"));
            tab.classList.add("active");
        });
    });

    document.getElementById("ohRecordPlacementBtn").addEventListener("click", () => {
        const modal = document.getElementById("ohRecordPlacementModal");
        if (modal) modal.classList.add("open");
    });
}

function initRecordPlacementModal() {
    const overlay = document.getElementById("ohRecordPlacementModal");
    const closeBtn = document.getElementById("ohRecordModalCloseBtn");
    const cancelBtn = document.getElementById("ohRecordModalCancelBtn");
    const submitBtn = document.getElementById("ohRecordModalSubmitBtn");

    const close = () => overlay.classList.remove("open");

    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });

    submitBtn.addEventListener("click", () => {
        const candidate = document.getElementById("ohRecordCandidate").value;
        if (!candidate) {
            alert("Please select a candidate.");
            return;
        }
        alert("Placement recorded for " + candidate + "!");
        close();
        document.getElementById("ohRecordCandidate").value = "";
        document.getElementById("ohRecordJob").value = "";
        document.getElementById("ohRecordSalary").value = "";
        document.getElementById("ohRecordStartDate").value = "";
    });
}
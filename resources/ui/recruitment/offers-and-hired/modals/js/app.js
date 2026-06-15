function initCreateOfferModal() {
    const overlay = document.getElementById("ohCreateOfferModal");
    const closeBtn = document.getElementById("ohModalCloseBtn");
    const cancelBtn = document.getElementById("ohModalCancelBtn");
    const submitBtn = document.getElementById("ohModalSubmitBtn");

    const close = () => overlay.classList.remove("open");

    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
        if (e.target === overlay) close();
    });

    submitBtn.addEventListener("click", () => {
        const candidate = document.getElementById("ohOfferCandidate").value;
        const job = document.getElementById("ohOfferJob").value;
        const dept = document.getElementById("ohOfferDept").value;
        const salary = document.getElementById("ohOfferSalary").value;
        const contract = document.getElementById("ohOfferContract").value;

        if (!candidate || !job || !salary) {
            alert("Please fill in candidate, job role, and salary fields.");
            return;
        }

        if (typeof addOHNewOffer === "function") {
            addOHNewOffer({
                candidate: candidate,
                email: candidate.toLowerCase().replace(/\s+/g, '.') + "@gmail.com",
                job: job,
                dept: dept,
                salary: "₦" + salary.replace(/[^0-9,]/g, ''),
                contract: contract,
                status: "draft"
            });
        }

        close();
        document.getElementById("ohOfferCandidate").value = "";
        document.getElementById("ohOfferJob").value = "";
        document.getElementById("ohOfferSalary").value = "";
        document.getElementById("ohOfferStartDate").value = "";
        document.getElementById("ohOfferNotes").value = "";
    });
};
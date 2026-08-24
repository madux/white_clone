const claimsPendingPopup = document.querySelector("#claims-pending-popup");
const claimsPendingDialog = claimsPendingPopup?.querySelector(".cpp-modal");
let claimsPendingPreviousFocus = null;

function openClaimsPendingPopup() {
  if (!claimsPendingPopup) return;
  claimsPendingPreviousFocus = document.activeElement;
  claimsPendingPopup.classList.add("cpp-open");
  claimsPendingPopup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  claimsPendingPopup.querySelector(".cpp-close")?.focus();
}

function closeClaimsPendingPopup() {
  if (!claimsPendingPopup) return;
  claimsPendingPopup.classList.remove("cpp-open");
  claimsPendingPopup.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  claimsPendingPreviousFocus?.focus();
}

document.querySelectorAll("[data-claims-popup-open]").forEach((trigger) => {
  trigger.addEventListener("click", openClaimsPendingPopup);
});

claimsPendingPopup?.querySelectorAll("[data-claims-popup-close]").forEach((button) => {
  button.addEventListener("click", closeClaimsPendingPopup);
});

claimsPendingPopup?.addEventListener("click", (event) => {
  if (!claimsPendingDialog?.contains(event.target)) closeClaimsPendingPopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && claimsPendingPopup?.classList.contains("cpp-open")) {
    closeClaimsPendingPopup();
  }
});

window.ClaimsPendingPopup = {
  open: openClaimsPendingPopup,
  close: closeClaimsPendingPopup,
};

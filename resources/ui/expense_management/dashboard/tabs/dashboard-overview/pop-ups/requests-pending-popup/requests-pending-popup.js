const requestsPendingPopup = document.querySelector("#requests-pending-popup");
const requestsPendingDialog = requestsPendingPopup?.querySelector(".rpp-modal");
let requestsPendingPreviousFocus = null;

function openRequestsPendingPopup() {
  if (!requestsPendingPopup) return;
  requestsPendingPreviousFocus = document.activeElement;
  requestsPendingPopup.classList.add("rpp-open");
  requestsPendingPopup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  requestsPendingPopup.querySelector(".rpp-close")?.focus();
}

function closeRequestsPendingPopup() {
  if (!requestsPendingPopup) return;
  requestsPendingPopup.classList.remove("rpp-open");
  requestsPendingPopup.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  requestsPendingPreviousFocus?.focus();
}

document.querySelectorAll("[data-requests-popup-open]").forEach((trigger) => {
  trigger.addEventListener("click", openRequestsPendingPopup);
});

requestsPendingPopup?.querySelectorAll("[data-requests-popup-close]").forEach((button) => {
  button.addEventListener("click", closeRequestsPendingPopup);
});

requestsPendingPopup?.addEventListener("click", (event) => {
  if (!requestsPendingDialog?.contains(event.target)) closeRequestsPendingPopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && requestsPendingPopup?.classList.contains("rpp-open")) {
    closeRequestsPendingPopup();
  }
});

window.RequestsPendingPopup = {
  open: openRequestsPendingPopup,
  close: closeRequestsPendingPopup,
};

const paymentsQueuePopup = document.querySelector("#payments-queue-popup");
const paymentsQueueDialog = paymentsQueuePopup?.querySelector(".pqp-modal");
let paymentsQueuePreviousFocus = null;

function openPaymentsQueuePopup() {
  if (!paymentsQueuePopup) return;
  paymentsQueuePreviousFocus = document.activeElement;
  paymentsQueuePopup.classList.add("pqp-open");
  paymentsQueuePopup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  paymentsQueuePopup.querySelector(".pqp-close")?.focus();
}

function closePaymentsQueuePopup() {
  if (!paymentsQueuePopup) return;
  paymentsQueuePopup.classList.remove("pqp-open");
  paymentsQueuePopup.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  paymentsQueuePreviousFocus?.focus();
}

document.querySelectorAll("[data-payments-popup-open]").forEach((trigger) => {
  trigger.addEventListener("click", openPaymentsQueuePopup);
});

paymentsQueuePopup?.querySelectorAll("[data-payments-popup-close]").forEach((button) => {
  button.addEventListener("click", closePaymentsQueuePopup);
});

paymentsQueuePopup?.addEventListener("click", (event) => {
  if (!paymentsQueueDialog?.contains(event.target)) closePaymentsQueuePopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && paymentsQueuePopup?.classList.contains("pqp-open")) {
    closePaymentsQueuePopup();
  }
});

window.PaymentsQueuePopup = {
  open: openPaymentsQueuePopup,
  close: closePaymentsQueuePopup,
};

const openTasksPopup = document.querySelector("#open-tasks-popup");
const openTasksDialog = openTasksPopup?.querySelector(".otp-modal");
let openTasksPreviousFocus = null;

function openOpenTasksPopup() {
  if (!openTasksPopup) return;
  openTasksPreviousFocus = document.activeElement;
  openTasksPopup.classList.add("otp-open");
  openTasksPopup.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  openTasksPopup.querySelector(".otp-close")?.focus();
}

function closeOpenTasksPopup() {
  if (!openTasksPopup) return;
  openTasksPopup.classList.remove("otp-open");
  openTasksPopup.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  openTasksPreviousFocus?.focus();
}

document.querySelectorAll("[data-open-tasks-popup-open]").forEach((trigger) => {
  trigger.addEventListener("click", openOpenTasksPopup);
});

openTasksPopup?.querySelectorAll("[data-open-tasks-popup-close]").forEach((button) => {
  button.addEventListener("click", closeOpenTasksPopup);
});

openTasksPopup?.addEventListener("click", (event) => {
  if (!openTasksDialog?.contains(event.target)) closeOpenTasksPopup();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && openTasksPopup?.classList.contains("otp-open")) {
    closeOpenTasksPopup();
  }
});

window.OpenTasksPopup = {
  open: openOpenTasksPopup,
  close: closeOpenTasksPopup,
};

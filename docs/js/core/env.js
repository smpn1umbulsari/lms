// Environment & Dev Detection
export const SCHOOL_EMAIL_DOMAIN = "smpn1umbulsari.sch.id";

export const isDev =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1" ||
  new URLSearchParams(window.location.search).has("demo");

export function initDemoChips(containerId = "auth-chips-box") {
  const box = document.getElementById(containerId);
  if (!box) return;
  if (isDev) {
    box.classList.remove("hidden");
  } else {
    box.classList.add("hidden");
    box.innerHTML = "";
  }
}

document.addEventListener("click", (e) => {
  const chip = e.target.closest("[data-action='fill-demo']");
  if (chip) {
    const emailInput = document.getElementById("l-email");
    const passInput = document.getElementById("l-pass");
    if (emailInput && chip.dataset.email) emailInput.value = chip.dataset.email;
    if (passInput && chip.dataset.pass) passInput.value = chip.dataset.pass;
  }
});

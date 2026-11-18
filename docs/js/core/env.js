// Environment & Dev Detection
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

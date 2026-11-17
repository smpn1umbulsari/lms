// Floating Toast Helper
let toastTimer = null;

export function showToast(msg) {
  const pill = document.getElementById("toast-pill");
  const txt = document.getElementById("toast-text");
  if (!pill || !txt) return;
  txt.textContent = msg;
  pill.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => pill.classList.add("hidden"), 3000);
}

export function initToast() {
  window._showToast = showToast;
}

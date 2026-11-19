// PWA Registration & Safe Deferred Update Prompt
const ACTIVE_QUIZ_KEY = "lms_active_quiz";

function showUpdateBanner(waitingWorker) {
  if (!waitingWorker || sessionStorage.getItem(ACTIVE_QUIZ_KEY)) return;
  if (document.getElementById("sw-update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "sw-update-banner";
  banner.setAttribute("role", "status");
  banner.setAttribute("aria-live", "polite");

  const label = document.createElement("span");
  label.textContent = "Versi baru LMS tersedia";

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "sw-update-btn";
  btn.textContent = "Muat Ulang";
  btn.addEventListener("click", () => {
    btn.disabled = true;
    btn.textContent = "Memuat...";
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  });

  banner.append(label, btn);
  document.body.appendChild(banner);
}

function promptOrDeferUpdate(waitingWorker) {
  if (!waitingWorker) return;
  if (!sessionStorage.getItem(ACTIVE_QUIZ_KEY)) {
    showUpdateBanner(waitingWorker);
    return;
  }
  const timer = setInterval(() => {
    if (!sessionStorage.getItem(ACTIVE_QUIZ_KEY)) {
      clearInterval(timer);
      showUpdateBanner(waitingWorker);
    }
  }, 15000);
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !window.location.protocol.startsWith("http")) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing || sessionStorage.getItem(ACTIVE_QUIZ_KEY)) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => {
        if (reg.waiting && navigator.serviceWorker.controller) {
          promptOrDeferUpdate(reg.waiting);
        }
        reg.addEventListener("updatefound", () => {
          const newWorker = reg.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              promptOrDeferUpdate(newWorker);
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[PWA] Service Worker gagal didaftarkan:", err);
      });
  });
}

// PWA Registration & Install Prompt Helper
export function registerServiceWorker() {
  if ("serviceWorker" in navigator && window.location.protocol.startsWith("http")) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./sw.js")
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener("statechange", () => {
                if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                  console.info("[PWA] Versi baru aplikasi telah dimuat.");
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker gagal didaftarkan:", err);
        });
    });
  }
}

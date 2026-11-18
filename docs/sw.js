// SITURI LMS Lightweight Service Worker
const CACHE_NAME = "situri-shell-v1";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon.svg",
  "./css/base/tokens.css",
  "./css/base/reset.css",
  "./css/base/utilities.css",
  "./css/components/button.css",
  "./css/components/card.css",
  "./css/components/form.css",
  "./css/components/table.css",
  "./css/components/modal.css",
  "./css/components/toast.css",
  "./css/components/auth.css",
  "./css/components/media.css",
  "./css/components/quiz-item.css",
  "./css/layout/grid.css",
  "./css/layout/topbar.css",
  "./css/layout/sidebar.css",
  "./css/layout/bottom-nav.css",
  "./css/pages/siswa.css",
  "./css/pages/admin.css",
  "./css/pages/admin-asesmen.css"
];

// Install: Precache App Shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch((err) => console.warn("[SW] Precache failed:", err))
  );
});

// Activate: Clean up stale caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// Fetch: Network-First for HTML, Stale-While-Revalidate for Static Assets
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Never intercept Firestore, Firebase Auth, or external third-party API calls
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("/__/") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("firebase") ||
    url.hostname.includes("gstatic.com")
  ) {
    return;
  }

  // HTML Page Navigation: Network-First with Offline Fallback
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          return caches.match("./index.html");
        })
    );
    return;
  }

  // Static Assets (CSS, JS, Icons): Stale-While-Revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req)
        .then((networkRes) => {
          if (networkRes.ok) {
            const clone = networkRes.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          }
          return networkRes;
        })
        .catch(() => null);

      return cached || fetchPromise;
    })
  );
});

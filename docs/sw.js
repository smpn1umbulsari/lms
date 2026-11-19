// SITURI LMS Lightweight Service Worker
const CACHE_NAME = "situri-shell-v4";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./admin.html",
  "./panduan-guru.html",
  "./manifest.json",
  "./partials/admin/ringkasan.html",
  "./partials/admin/materi.html",
  "./partials/admin/tugas.html",
  "./partials/admin/asesmen.html",
  "./partials/admin/grading.html",
  "./partials/admin/import.html",
  "./partials/admin/modals.html",
  "./partials/siswa/dashboard.html",
  "./partials/siswa/exam.html",
  "./js/core/partials.js",
  "./js/guide-print.js",
  "./vendor/xlsx.full.min.js",
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

// Install: Precache App Shell (aktivasi menunggu konfirmasi pengguna atau tutup semua tab)
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .catch((err) => console.warn("[SW] Precache failed:", err))
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
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

  const isDynamicShell =
    req.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname.endsWith(".html") ||
    (url.pathname.endsWith(".js") && !url.pathname.includes("/vendor/"));

  // HTML, Partials & JS Modules: Network-First (cegah campuran versi saat CBT)
  if (isDynamicShell) {
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
          if (req.mode === "navigate") return caches.match("./index.html");
          return new Response("Offline", { status: 503, statusText: "Offline" });
        })
    );
    return;
  }

  // Static Assets (CSS, Vendor, Icons): Stale-While-Revalidate
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

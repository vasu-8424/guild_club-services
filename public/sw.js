// Guild Club Services Service Worker
// STRICT COMPLIANCE: Cache ONLY static app shell & icons.
// NEVER cache patient data, photos, signatures, reports, or authenticated API routes.

const CACHE_NAME = "guild-club-shell-v2";
const SHELL_ASSETS = [
  "/offline",
  "/logo.png",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // NEVER cache API requests, sensitive endpoints, or non-GET requests
  if (
    event.request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/cases/") ||
    url.pathname.includes("/photos/") ||
    url.pathname.includes("/signatures/") ||
    url.pathname.includes("/reports") ||
    url.pathname.includes("/therapist/") ||
    url.pathname.includes("/admin/") ||
    url.pathname.includes("/super-admin/")
  ) {
    // Direct network pass-through with no cache storage
    return;
  }

  // Handle static assets or offline fallback
  event.respondWith(
    fetch(event.request).catch(async () => {
      // If it is a navigation request, return offline fallback page
      if (event.request.mode === "navigate") {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match("/offline");
        if (cachedOffline) return cachedOffline;
      }
      // Check cache for icons/shell
      const cache = await caches.open(CACHE_NAME);
      return cache.match(event.request);
    })
  );
});


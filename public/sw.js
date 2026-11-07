// Guild Club Services Service Worker
// Version: guild-club-v4-live
// STRICT COMPLIANCE:
// - Network-first for all HTML and navigation requests
// - NEVER cache authenticated pages, API responses, photos, signatures, reports, or patient data
// - Cache-first ONLY for immutable content-hashed assets under /_next/static/

const CACHE_VERSION = "guild-club-v4-live";
const STATIC_CACHE = `${CACHE_VERSION}-static`;

const IMMUTABLE_ASSETS = [
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
  "/logo.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(IMMUTABLE_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Direct pass-through for non-GET or sensitive endpoints
  if (
    request.method !== "GET" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.includes("/cases/") ||
    url.pathname.includes("/photos/") ||
    url.pathname.includes("/signatures/") ||
    url.pathname.includes("/reports") ||
    url.pathname.includes("/therapist/") ||
    url.pathname.includes("/admin/") ||
    url.pathname.includes("/super-admin/")
  ) {
    return;
  }

  // 2. Cache-first ONLY for content-hashed Next.js static assets
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // 3. Network-first for navigations and HTML documents
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const fallback = await cache.match("/offline");
        if (fallback) return fallback;
        return new Response("Offline - Please check your connection", {
          status: 503,
          headers: { "Content-Type": "text/plain" },
        });
      })
    );
    return;
  }

  // 4. Default network fetch for all other requests
  event.respondWith(fetch(request));
});

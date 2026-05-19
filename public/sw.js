const CACHE_NAME = "english-lms-v2";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/classes",
  "/materials",
  "/grades",
  "/attendance",
  "/offline",
  "/manifest.json",
];

// Install — cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some pages may fail, that's ok
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip Supabase API calls — these need live data
  if (url.hostname.includes("supabase.co")) return;

  // Next.js static files — cache first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Pages — network first, fallback to cache, then offline page
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful page responses
        if (response.ok && request.headers.get("accept")?.includes("text/html")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => {
          if (cached) return cached;
          // Return offline page for navigation requests
          if (request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/offline");
          }
          return new Response("Offline", { status: 503 });
        })
      )
  );
});

// Background sync for when connection is restored
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-data") {
    // Notify clients to refresh data
    self.clients.matchAll().then((clients) => {
      clients.forEach((client) => {
        client.postMessage({ type: "SYNC_DATA" });
      });
    });
  }
});

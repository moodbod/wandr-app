const CACHE_NAME = "wandr-pwa-v7";
const APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.webmanifest",
  "/wandr-favicon.png",
  "/icons/wandr-icon.png",
  "/api/catalog",
];

const MAPBOX_ORIGINS = [
  "https://api.mapbox.com",
  "https://events.mapbox.com",
  "https://a.tiles.mapbox.com",
  "https://b.tiles.mapbox.com",
];

// Strategies
function cacheFirst(request, cacheName = CACHE_NAME) {
  return caches.match(request).then((cached) => {
    if (cached) {
      return cached;
    }

    return fetch(request).then((response) => {
      if (response.ok) {
        const responseClone = response.clone();
        caches.open(cacheName).then((cache) => cache.put(request, responseClone));
      }

      return response;
    });
  });
}

function staleWhileRevalidate(request, cacheName = CACHE_NAME) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((response) => {
          if (response.ok) {
            cache.put(request, response.clone());
          }

          return response;
        })
        .catch(() => cached);

      return cached || fresh;
    }),
  );
}

// Mapbox specific caching (Tiles, Glyphs, Sprites)
function cacheMapbox(request) {
  return cacheFirst(request, "wandr-mapbox");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME &&
                cacheName !== "wandr-mapbox" &&
                cacheName !== "wandr-directions" &&
                cacheName !== "wandr-offline-images",
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  // Mapbox Assets (Tiles, Styles, Fonts, Sprites)
  if (MAPBOX_ORIGINS.includes(url.origin) || url.hostname.endsWith(".tiles.mapbox.com")) {
    // Only cache static assets, avoid caching telemetry/events
    if (
      url.pathname.includes("/v4/") ||
      url.pathname.includes("/styles/v1/") ||
      url.pathname.includes("/fonts/v1/") ||
      url.pathname.includes("/sprites/")
    ) {
      event.respondWith(cacheMapbox(request));
      return;
    }
    // Directions API: cached road geometry powers offline routing.
    if (url.pathname.includes("/directions/v5/")) {
      event.respondWith(cacheFirst(request, "wandr-directions"));
      return;
    }
  }

  // Local Assets
  if (url.origin === self.location.origin) {
    if (request.mode === "navigate") {
      event.respondWith(
        fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            return response;
          })
          .catch(() => caches.match(request).then((cached) => cached || caches.match("/offline.html"))),
      );
      return;
    }

    if (
      url.pathname.startsWith("/_next/static/") ||
      url.pathname.startsWith("/icons/") ||
      url.pathname.endsWith(".png") ||
      url.pathname.endsWith(".jpg") ||
      url.pathname.endsWith(".svg")
    ) {
      event.respondWith(cacheFirst(request));
      return;
    }

    if (url.pathname === "/api/catalog" || url.pathname === "/_next/image") {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }
  }
});


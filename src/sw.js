/**
 * Service Worker — Phonics Parrot v1
 * Cache-first for static assets, network-first for HTML pages.
 * Auto-cleans old cache versions on activation.
 */
const CACHE_NAME = "phonics-parrot-v23";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/teacher_guide.html",
  "/manifest.json",
  "/assets/css/shared.css",
  "/assets/js/utils.js",
  "/assets/js/audio.js",
  "/assets/js/stt.js",
  "/assets/js/layout.js",
  "/assets/icons/icon.svg",
  "/assets/img/flashcard.svg",
  "/assets/img/line_reader.svg",
  "/assets/img/mascot.png",
  "/assets/img/pingpong.svg",
  "/assets/img/plant_decor.svg",
  "/assets/img/poem_builder.svg",
  "/assets/img/poster.svg",
  "/assets/audio/click.mp3",
  "/assets/audio/fail.mp3",
  "/assets/audio/hover.mp3",
  "/assets/audio/hover.wav",
  "/assets/audio/start.mp3",
  "/assets/audio/success.wav",
  "/assets/audio/theme.mp3",
  "/activities/builder.html",
  "/activities/reader.html",
  "/activities/speak.html",
  "/activities/pingpong.html",
  "/activities/teacher.html",
  "/assets/fonts/Fredoka-400.ttf",
  "/assets/fonts/Fredoka-600.ttf",
  "/assets/fonts/Fredoka-700.ttf",
  "/assets/fonts/JetBrainsMono-400.ttf",
  "/assets/fonts/JetBrainsMono-500.ttf",
  "/assets/fonts/Outfit-300.ttf",
  "/assets/fonts/Outfit-400.ttf",
  "/assets/fonts/Outfit-500.ttf",
  "/assets/fonts/Outfit-600.ttf",
  "/assets/fonts/Outfit-700.ttf",
  "/assets/fonts/Outfit-800.ttf",
  "/assets/fonts/PlusJakartaSans-300.ttf",
  "/assets/fonts/PlusJakartaSans-400.ttf",
  "/assets/fonts/PlusJakartaSans-500.ttf",
  "/assets/fonts/PlusJakartaSans-600.ttf",
  "/assets/fonts/PlusJakartaSans-700.ttf",
  "/assets/fonts/PlusJakartaSans-800.ttf"
];

// Install: pre-cache static assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: purge old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: network-first for HTML, cache-first for everything else
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Completely bypass Service Worker for non-GET requests and API calls
  if (request.method !== "GET" || request.url.includes("/api/")) {
    return; // Let the browser handle it naturally from network/localhost
  }

  const isHtml = request.headers.get("accept")?.includes("text/html") ||
                 request.destination === "document";

  if (isHtml) {
    // Network-first: try network, fall back to cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Cache-first: try cache, fall back to network
    event.respondWith(
      caches.match(request).then((cached) =>
        cached || fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
      )
    );
  }
});

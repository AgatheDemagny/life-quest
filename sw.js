const CACHE_NAME = "joue-ma-vie-v2"; // ⬅️ incrémente quand tu veux forcer une MAJ
const FILES_TO_CACHE = [
  "/",
  "/index.html",
  "/css/style.css",
  "/js/main.js",
  "/js/worlds.js",
  "/js/xp.js",
  "/manifest.json"
];

// Installation : mise en cache + activation immédiate
self.addEventListener("install", event => {
  self.skipWaiting(); // ⬅️ prend la main tout de suite
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// Activation : nettoyage des anciens caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim(); // ⬅️ contrôle les pages ouvertes
});

// Fetch : cache d'abord, réseau sinon
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(
      response => response || fetch(event.request)
    )
  );
});

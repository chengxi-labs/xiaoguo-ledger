const CACHE_NAME = "xiaoguo-ledger-v14";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./imports/shark-ledger.json",
  "./assets/icons/app-icon.png",
  "./assets/icons/app-icon-512.png",
  "./assets/icons/app-icon-192.png",
  "./assets/categories/food.png",
  "./assets/categories/daily.png",
  "./assets/categories/snack.png",
  "./assets/categories/sport.png",
  "./assets/categories/entertainment.png",
  "./assets/categories/date.png",
  "./assets/categories/study.png",
  "./assets/categories/gift.png",
  "./assets/categories/home.png",
  "./assets/categories/taxi.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request).then((response) => {
          if (response.ok && new URL(event.request.url).origin === self.location.origin) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        }),
    ),
  );
});

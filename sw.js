const CACHE_NAME = "lumen-pass-shell-v17";
const SHELL = [
  "./",
  "./index.html",
  "./styles.css?v=20260805image-upload2",
  "./app.js?v=20260805image-upload2",
  "./manifest.webmanifest",
  "./assets/locked-preview.png",
  "./assets/unlocked-preview.png",
  "./assets/qr-public.png",
];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});

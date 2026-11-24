// TimeAura offline support. The app itself is fetched fresh when there is a connection
// (so a new version arrives on the next start) and served from the cache when there is none.
// Bump CACHE when the list of files changes.
const CACHE = "timeaura-v2";
// Only the app's own files and its fonts are kept offline. Google sign-in and Drive always go
// straight to the network, so synced hours are never served from an old copy.
const CACHEABLE = url => url.origin === location.origin || url.host === "fonts.googleapis.com" || url.host === "fonts.gstatic.com";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png", "icon-180.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (!CACHEABLE(url)) return;
  const isPage = req.mode === "navigate" || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname));
  if (isPage) {
    // Network first for the app, so updates come through; cache when offline.
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put("index.html", copy));
      return res;
    }).catch(() => caches.match("index.html")));
    return;
  }
  // Everything else (icons, fonts): cache first, then network, and keep a copy.
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && (res.ok || res.type === "opaque")) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});

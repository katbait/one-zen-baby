/* ============================================================
   sw.js - the service worker: makes the app work offline.
   ------------------------------------------------------------
   A service worker is a small script the browser runs in the
   background, separate from the page. Every time the page asks for a
   file (a .js, .css, an icon...), the request passes through the
   "fetch" handler below first.

   Strategy: "network first".
   1. Try to get the file from the internet (and save a fresh copy).
   2. If that fails or takes more than 3 seconds, use the saved copy.
   That means changes you make show up straight away whenever you're
   online, and the app still opens with no connection.

   On first install, every file in APP_FILES is saved up front, so the
   app works offline even before every screen has been opened.

   !! When you ADD a new file to the app, add it to APP_FILES too.
      (If any file in this list is missing, offline install fails.)
   Changing CACHE_NAME (e.g. v1 -> v2) throws away the old saved copies.

   Photos and recordings are not handled here: they are already stored
   on the device in IndexedDB (see storage.js).
   ============================================================ */

const CACHE_NAME = "one-zen-baby-v1";
const NETWORK_TIMEOUT_MS = 3000;

const APP_FILES = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./js/app.js",
  "./js/arrange.js",
  "./js/child.js",
  "./js/install.js",
  "./js/media.js",
  "./js/model.js",
  "./js/pages.js",
  "./js/parent.js",
  "./js/recorder.js",
  "./js/speech.js",
  "./js/starter.js",
  "./js/storage.js",
  "./js/views.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/apple-touch-icon.png",
];

// Install: save all the app's files.
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_FILES))
      .then(() => self.skipWaiting())          // start working right away, don't wait for old tabs to close
  );
});

// Activate: delete saved copies from older versions (other CACHE_NAMEs).
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(names => Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n))))
      .then(() => self.clients.claim())        // take control of pages that are already open
  );
});

// Fetch: network first, saved copy as backup.
self.addEventListener("fetch", event => {
  const request = event.request;
  // Only handle simple downloads from our own site; let the browser do everything else.
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(networkFirst(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);

  // "no-cache" = always ask the server whether the file changed (cheap if it didn't).
  const network = fetch(request.url, { cache: "no-cache" }).then(response => {
    if (response.ok) cache.put(request, response.clone());   // keep the fresh copy for offline
    return response;
  });
  network.catch(() => {});   // a failure is handled below; this just avoids an error message in the console

  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    // Offline or too slow: use the saved copy. Any page address falls back to index.html.
    const saved = (await cache.match(request, { ignoreSearch: true })) ||
                  (request.mode === "navigate" ? await cache.match("./index.html") : undefined);
    return saved || network;  // nothing saved: keep waiting for the network after all
  }
}

/** Fail if the promise takes longer than ms milliseconds. */
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      value => { clearTimeout(timer); resolve(value); },
      error => { clearTimeout(timer); reject(error); }
    );
  });
}

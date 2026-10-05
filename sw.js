/* Wolke der Zeugen — Service Worker.
   Strategie "Netz zuerst": Online gibt es immer die aktuelle Version (Updates
   kommen sofort an). Nur wenn das Netz fehlt oder länger als 4 Sekunden braucht
   (schlechter Empfang am Waldhaus, im Kirchenraum …), kommt die App aus dem Cache.
   Es werden nur eigene Dateien zwischengespeichert — keine Daten der Nutzer:innen. */
const CACHE = "wdz-v3";
const KERN = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/storage.js",
  "js/rotation.js",
  "js/geo.js",
  "js/gestalt.js",
  "js/karte.js",
  "js/wolke.js",
  "js/encounter.js",
  "js/gesten.js",
  "js/ar.js",
  "js/installieren.js",
  "js/app.js",
  "data/config.json",
  "data/orte.json",
  "data/figuren.json",
  "data/karte-hintergrund.json",
  "assets/icon.svg",
  "assets/icon-180.png",
  "assets/icon-192.png",
  "assets/icon-512.png",
  "assets/icon-maskable-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(KERN)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function mitTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(r => { clearTimeout(t); resolve(r); }, err => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const netz = fetch(req).then(res => {
      if (res.ok) cache.put(req, res.clone());
      return res;
    });
    netz.catch(() => { /* offline — wird unten behandelt */ });
    try {
      return await mitTimeout(netz, 4000);
    } catch (err) {
      const treffer = await cache.match(req, { ignoreSearch: req.mode === "navigate" })
        || (req.mode === "navigate" ? await cache.match("index.html") : undefined);
      if (treffer) return treffer;
      return netz; // kein Cache-Treffer: doch auf das Netz warten
    }
  })());
});

// Service worker. Served by src/app/sw.js/route.ts, which fills in the build id,
// so every deploy is a new worker with its own cache.
const VERSION = "__BUILD_ID__";
const CACHE = `calc3d-${VERSION}`;
const PAGES = ["/", "/guardados"];
const STATIC = /^\/(_next\/static\/|icons\/|icon\.svg|apple-icon\.png|logo\.svg|manifest\.webmanifest)/;
// On a bad connection, show the cached page instead of waiting.
const NAV_TIMEOUT_MS = 3000;

self.addEventListener("install", (event) => {
  event.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith("calc3d-") && k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
      // Pages from an older deploy offer a reload.
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of windows) w.postMessage({ type: "sw-activated", version: VERSION });
    })(),
  );
});

// Only the app's own pages and build assets. Supabase, /api, RSC payloads and
// analytics always go to the network.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === "navigate" && PAGES.includes(url.pathname)) {
    event.respondWith(page(event, url.pathname));
  } else if (STATIC.test(url.pathname)) {
    event.respondWith(asset(event));
  }
});

/** The pages and every build asset their HTML references. */
async function precache() {
  const cache = await caches.open(CACHE);
  const assets = new Set();
  for (const path of PAGES) {
    const res = await fetch(path, { cache: "reload" });
    if (!res.ok) throw new Error(`${path}: ${res.status}`);
    for (const m of (await res.clone().text()).matchAll(/\/_next\/static\/[^"'\\\s)]+/g)) assets.add(m[0]);
    await cache.put(path, res);
  }
  // A missing asset should not block the install; it gets cached on first use.
  await Promise.all([...assets].map((url) => cache.add(url).catch(() => {})));
}

/** Network first, keyed by path so /?n=… share links open offline too. */
function page(event, key) {
  const network = fetch(event.request).then((res) => {
    if (res.ok) {
      const copy = res.clone();
      event.waitUntil(caches.open(CACHE).then((c) => c.put(key, copy)));
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  return (async () => {
    const cached = await caches.match(key, { cacheName: CACHE });
    if (!cached) return network;
    try {
      const timeout = new Promise((resolve) => setTimeout(resolve, NAV_TIMEOUT_MS));
      return (await Promise.race([network, timeout])) ?? cached;
    } catch {
      return cached;
    }
  })();
}

/** Cache first: build assets have hashed names. */
async function asset(event) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()));
  return res;
}

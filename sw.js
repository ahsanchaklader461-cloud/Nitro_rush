// Nitro Rush offline support.
// Open the game once while online: this saves the game page and the 3D engine.
// After that the game opens and plays with no internet.
const CACHE = 'nitro-rush-v1';
const ENGINE = [
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll([new Request('./', {cache: 'reload'})]);
    let ok = false;
    for (const u of ENGINE) {
      try { const r = await fetch(u); if (r.ok) { await c.put(u, r); ok = true; break; } } catch (_) {}
    }
    if (!ok) throw new Error('engine not saved');
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    for (const c of await self.clients.matchAll({includeUncontrolled: true})) c.postMessage('offline-ready');
  })());
});

const timeout = ms => new Promise((_, no) => setTimeout(() => no(new Error('slow')), ms));
const pageKey = url => { const u = new URL(url); u.search = ''; u.hash = ''; return u.href; };

// The game page: always try the network first so updates show up, fall back to the saved copy.
async function pageFirst(req) {
  const c = await caches.open(CACHE), key = pageKey(req.url);
  try {
    const res = await Promise.race([fetch(new Request(req.url, {cache: 'no-cache'})), timeout(4000)]);
    if (res.ok) c.put(key, res.clone());
    return res;
  } catch (_) {
    return (await c.match(key)) || (await c.match('./')) || Response.error();
  }
}

// The 3D engine: saved copy first, network only if it is missing.
async function engineFirst(req) {
  const c = await caches.open(CACHE);
  const hit = await c.match(req.url);
  if (hit) return hit;
  const res = await fetch(req);
  if (res && res.ok) c.put(req.url, res.clone());
  return res;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (ENGINE.includes(req.url)) { e.respondWith(engineFirst(req)); return; }
  if (new URL(req.url).origin === location.origin) e.respondWith(pageFirst(req));
});

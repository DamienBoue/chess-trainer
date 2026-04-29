// Minimal service worker for offline support.
// Strategy: cache GETs from same-origin and the chess.com avatar host with
// stale-while-revalidate. Never cache API calls to chess.com (those need to
// be fresh).

const CACHE = 'chess-trainer-v2'
const PRECACHE = ['./', './stockfish.js', './stockfish.wasm', './manifest.webmanifest', './icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    // Don't fail the install if any pre-cache target 404s — just log it.
    await Promise.allSettled(PRECACHE.map(u => cache.add(u)))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // Skip cross-origin API calls.
  if (url.host === 'api.chess.com') return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const networkPromise = fetch(req).then(resp => {
      if (resp && resp.ok && (url.origin === self.location.origin)) {
        cache.put(req, resp.clone()).catch(() => {})
      }
      return resp
    }).catch(() => cached)
    return cached || networkPromise
  })())
})

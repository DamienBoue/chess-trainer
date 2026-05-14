// Minimal service worker for offline support.
// Strategy: same-origin GETs are cached with stale-while-revalidate.
// External APIs (chess.com, Lichess explorer/tablebase, LLM providers) are
// passed straight through so the user never sees a stale auth-gated
// response or a cached LLM answer.

const CACHE = 'chess-trainer-v3'
const PRECACHE = ['./', './stockfish.js', './stockfish.wasm', './manifest.webmanifest', './icon.svg']
const SKIP_HOSTS = [
  'api.chess.com',
  'explorer.lichess.ovh',
  'tablebase.lichess.ovh',
  'lichess.org',
  'api.anthropic.com',
  'api.openai.com',
]

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
  // Skip third-party APIs — they need fresh, auth-correct responses.
  if (SKIP_HOSTS.includes(url.host)) return
  // Cross-origin GETs we don't recognise: also pass through. Avoids
  // caching whatever random asset some embed pulls in.
  if (url.origin !== self.location.origin) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const cached = await cache.match(req)
    const networkPromise = fetch(req).then(resp => {
      if (resp && resp.ok) {
        cache.put(req, resp.clone()).catch(() => {})
      }
      return resp
    }).catch(() => cached)
    return cached || networkPromise
  })())
})

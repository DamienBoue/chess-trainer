// The website used to be a Vite app with an offline service worker that
// cached it. The app is now the Expo web build, without a service worker:
// this one replaces the old one, clears its caches, unregisters itself and
// reloads the open pages on the new app.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
  })())
})

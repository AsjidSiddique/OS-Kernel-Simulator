// Viro PWA Service Worker — v31
const CACHE = 'viro-v31'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // Skip ALL external domains — OneSignal, fonts, Supabase, etc.
  if (url.origin !== self.location.origin) return

  // Skip manifest.json — browser handles it
  if (url.pathname === '/manifest.json') return

  // Skip OneSignal worker files
  if (url.pathname.toLowerCase().includes('onesignal')) return

  // JS/CSS — network first so deploys update immediately
  if (url.pathname.match(/\.(js|css)(\?|$)/)) {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        })
        .catch(() => caches.match(e.request).then(hit => hit || new Response('', { status: 503 })))
    )
    return
  }

  // Images — cache first
  if (url.pathname.match(/\.(png|jpg|jpeg|webp|svg|gif|ico)(\?|$)/)) {
    e.respondWith(
      caches.match(e.request).then(hit => {
        if (hit) return hit
        return fetch(e.request).then(res => {
          if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
          return res
        }).catch(() => new Response('', { status: 503 }))
      })
    )
    return
  }

  // HTML navigation — network first, safe fallback to cached /index.html
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      })
      .catch(() =>
        caches.match(e.request)
          .then(hit => hit || caches.match('/'))
          .then(hit => hit || new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } }))
      )
  )
})

self.addEventListener('message', e => {
  if (e.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

const CACHE_NAME = 'vault-v2';

const SHELL_FILES = [
  '/finance-app.html',
  '/login.html',
  '/auth-callback.html',
  '/styles.css',
  '/supabase.js',
  '/page-dashboard.html',
  '/page-transactions.html',
  '/page-budgets.html',
  '/page-accounts.html',
  '/page-investments.html',
  '/page-security.html',
  '/modal-add-transaction.html',
  '/modal-loans.html',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      Promise.allSettled(
        SHELL_FILES.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache:', url, err.message)
          )
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase API calls
  if (url.hostname.includes('supabase.co')) return;

  // Never intercept non-GET requests
  if (event.request.method !== 'GET') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isCachedCDN  = url.hostname === 'fonts.googleapis.com' ||
                       url.hostname === 'fonts.gstatic.com' ||
                       url.hostname === 'cdn.jsdelivr.net';

  if (!isSameOrigin && !isCachedCDN) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then(cached => {
          if (cached) return cached;
          if (event.request.headers.get('accept')?.includes('text/html')) {
            return new Response(
              `<!DOCTYPE html><html><head><meta charset="UTF-8">
              <title>Vault — Offline</title>
              <style>
                body{font-family:sans-serif;background:#0D1B2A;color:#F0F4F8;
                display:flex;align-items:center;justify-content:center;
                min-height:100vh;text-align:center;padding:20px;}
                h2{color:#C9A84C;margin-bottom:12px;}
                p{color:#8BA3B8;font-size:14px;}
              </style></head><body>
              <div><h2>You're offline</h2>
              <p>Vault needs a connection to load your data.<br>
              Check your connection and try again.</p></div>
              </body></html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

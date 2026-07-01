// ════════════════════════════════════════════════════════════
// VAULT — Service Worker
// Strategy: Network-first with cache fallback.
//   - Always tries to fetch fresh from network
//   - Falls back to cached version when offline
//   - Writes always require a live connection (no offline queue yet)
//   - Cache is updated on every successful network response
// ════════════════════════════════════════════════════════════

const CACHE_NAME = 'vault-v1';

// App shell files — everything needed to load the UI.
// Supabase API calls are NOT cached here (handled separately below).
const SHELL_FILES = [
  '/PFA/finance-app.html',
  '/PFA/login.html',
  '/PFA/auth-callback.html',
  '/PFA/styles.css',
  '/PFA/supabase.js',
  '/PFA/page-dashboard.html',
  '/PFA/page-transactions.html',
  '/PFA/page-budgets.html',
  '/PFA/page-accounts.html',
  '/PFA/page-investments.html',
  '/PFA/page-security.html',
  '/PFA/modal-add-transaction.html',
  '/PFA/modal-loans.html',
];

// ── Install: pre-cache the app shell ──────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache what we can — don't fail install if a file is missing
      return Promise.allSettled(
        SHELL_FILES.map(url =>
          cache.add(url).catch(err =>
            console.warn('[SW] Failed to cache:', url, err.message)
          )
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// ── Activate: clean up old caches ─────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: network-first, cache fallback ──────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never intercept Supabase API calls — these must go to the network.
  // If offline, Supabase calls will fail naturally and the page handles
  // the error (shows offline state, blocks write attempts).
  if (url.hostname.includes('supabase.co')) return;

  // Never intercept non-GET requests (POST, PUT, DELETE) —
  // writes always need a live connection.
  if (event.request.method !== 'GET') return;

  // Never intercept cross-origin requests we don't control
  // (Google Fonts, jsDelivr CDN for exchange rates, etc.)
  // except we DO cache the font and CDN files for offline use.
  const isSameOrigin = url.origin === self.location.origin;
  const isCachedCDN = url.hostname === 'fonts.googleapis.com' ||
                      url.hostname === 'fonts.gstatic.com' ||
                      url.hostname === 'cdn.jsdelivr.net';

  if (!isSameOrigin && !isCachedCDN) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Network succeeded — update the cache and return response
        if (response.ok) {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      })
      .catch(() => {
        // Network failed — serve from cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Nothing cached — return a minimal offline page for HTML requests
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
              <p>Vault needs a connection to load.<br>
              Your data is safe — check your connection and try again.</p></div>
              </body></html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// ── Message: force update from app ────────────────────────
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

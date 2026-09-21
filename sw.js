const SHELL_CACHE = 'bf-shell-r40-3-pwa4';
const RUNTIME_CACHE = 'bf-runtime-r40-3-pwa4';

const CORE = [
  './',
  './index.html',
  './app.css?v=20260917-r10',
  './mobile-compat.css?v=20260918-r2',
  './recipes.css?v=20260918-r40',
  './learning.css?v=20260918-r23',
  './ui.css?v=20260918-r24-2',
  './admin-console.css?v=20260918-r40',
  './admin-delete.css?v=20260918-r40',
  './attestation-r29.css?v=20260918-r40',
  './handover.css?v=20260918-r40',
  './shift-workflow.css?v=20260918-r40',
  './dashboard.css?v=20260918-r40',
  './runtime-hardening.css?v=20260918-r40',
  './accessibility.css?v=20260918-r40',
  './branding.css?v=20260921-r40-3-safe3',
  './app.js?v=20260921-r40-3-login-route',
  './recipes.js?v=20260919-r40-2',
  './learning.js?v=20260918-r40',
  './handover.js?v=20260918-r40',
  './shift-workflow.js?v=20260918-r40',
  './dashboard.js?v=20260919-r40-2',
  './ui.js?v=20260918-r24-2',
  './admin-console.js?v=20260918-r40',
  './admin-delete.js?v=20260918-r40',
  './runtime-hardening.js?v=20260921-r40-3-final',
  './accessibility.js?v=20260918-r40',
  './manifest.json',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/icon-maskable-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/training-data.txt',
  './assets/training-data.json',
  './assets/question-banks.json',
  './assets/service-images/steps-overview.png',
  './assets/service-images/steps-2-1.jpg',
  './assets/service-images/steps-6-1.jpg',
  './assets/service-images/sales-3-2.jpg',
  './assets/service-images/sales-5-1.jpg',
  './assets/service-images/sales-8-1.jpg',
  './assets/service-images/phrases-1-1.jpg',
  './assets/service-images/guests-3-1.jpg',
  './assets/service-images/guests-6-1.jpg',
  './assets/service-images/guests-8-1.jpg',
  './assets/service-images/guests-11-1.jpg',
  './assets/service-images/hall-1-1.jpg',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.all(CORE.map(url => cache.add(url).catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = new Set([SHELL_CACHE, RUNTIME_CACHE]);
    const names = await caches.keys();

    await Promise.all(
      names
        .filter(name => name.startsWith('bf-') && !keep.has(name))
        .map(name => caches.delete(name))
    );

    await self.clients.claim();
  })());
});

async function cachedNavigationShell() {
  const runtime = await caches.open(RUNTIME_CACHE);
  const runtimeIndex = await runtime.match('./index.html');
  if (runtimeIndex) return runtimeIndex;

  const shell = await caches.open(SHELL_CACHE);
  return (await shell.match('./index.html')) || (await shell.match('./')) || null;
}

async function navigationResponse(request) {
  const cached = await cachedNavigationShell();

  if (self.navigator && self.navigator.onLine === false && cached) {
    return cached;
  }

  try {
    const fresh = await fetch(request, { cache: 'no-store' });

    if (fresh && fresh.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put('./index.html', fresh.clone()).catch(() => {});
    }

    return fresh;
  } catch (_) {
    return cached || Response.error();
  }
}

async function cacheFirst(request) {
  const exact = await caches.match(request);
  if (exact) return exact;

  const queryAgnostic = await caches.match(request, { ignoreSearch: true });

  if (self.navigator && self.navigator.onLine === false) {
    return queryAgnostic || Response.error();
  }

  try {
    const response = await fetch(request);

    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }

    return response;
  } catch (_) {
    return queryAgnostic || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname.endsWith('.supabase.co')) return;
  if (url.hostname === 'beerfactory-menu-api.ivan-capral-grimm.workers.dev') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const jsDelivrSupabase =
    url.hostname === 'cdn.jsdelivr.net' &&
    url.pathname.includes('@supabase/supabase-js');

  if (sameOrigin || jsDelivrSupabase) {
    event.respondWith(cacheFirst(request));
  }
});

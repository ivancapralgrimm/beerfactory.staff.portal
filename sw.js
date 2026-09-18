const SHELL_CACHE = 'bf-shell-r19';
const RUNTIME_CACHE = 'bf-runtime-r19';

const CORE = [
  './',
  './index.html',
  './app.css?v=20260917-r10',
  './mobile-compat.css?v=20260918-r1',
  './learning.css?v=20260917-r19',
  './app.js?v=20260917-r11',
  './recipes.js?v=20260918-r19',
  './learning.js?v=20260917-r19',
  './manifest.json',
  './assets/training-data.json',
  './assets/question-banks.json',
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
    await Promise.all(names.filter(name => name.startsWith('bf-') && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function navigationResponse(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put('./index.html', fresh.clone()).catch(() => {});
    return fresh;
  } catch (_) {
    return (await caches.match('./index.html')) || (await caches.match('./')) || Response.error();
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && (response.ok || response.type === 'opaque')) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone()).catch(() => {});
  }
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Recipe API freshness is controlled in recipes.js. Do not add a second stale layer here.
  if (url.hostname === 'beerfactory-menu-api.ivan-capral-grimm.workers.dev') return;

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const jsDelivrSupabase = url.hostname === 'cdn.jsdelivr.net' && url.pathname.includes('@supabase/supabase-js');

  if (sameOrigin || jsDelivrSupabase) {
    event.respondWith(cacheFirst(request));
  }
});

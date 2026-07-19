import { NextResponse } from 'next/server';

// Evaluate BUILD_ID once at build time (not per request) so the worker body is
// stable within a deploy but changes between deploys.
export const dynamic = 'force-static';

// WHY a route handler instead of a static public/sw.js: a static file is byte-identical
// across deploys, so the browser's spec-mandated byte-comparison update check never fires
// and old workers (and the stale JS they serve) persist forever. Vercel bakes a fresh
// commit SHA into every deployment's environment, so reading it here at build/cold-start
// time gives every deploy a different sw.js body "for free" — no manual version bump,
// no separate build script to maintain.
// Use || not ?? — in this GitHub-Action + `vercel build` flow VERCEL_GIT_COMMIT_SHA
// is an EMPTY STRING (not undefined), which ?? would keep, freezing the version and
// defeating update detection. || falls through empty strings to a build-time stamp.
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.VERCEL_DEPLOYMENT_ID ||
  process.env.GITHUB_SHA ||
  String(Date.now());

const SW_SOURCE = `
const CACHE_VERSION = ${JSON.stringify(BUILD_ID)};
const SHELL_CACHE = 'imbewufield-shell-' + CACHE_VERSION;
const RUNTIME_CACHE = 'imbewufield-runtime-' + CACHE_VERSION;
const PRECACHE_URLS = ['/manifest.json', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    }).catch(function () {})
  );
  // Activate this worker immediately instead of waiting for every other open
  // tab to close — otherwise a deploy never "reaches" an already-open device.
  self.skipWaiting();
});

self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== SHELL_CACHE && key !== RUNTIME_CACHE; })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(function () {
      // Take control of already-open tabs so this version's fetch handler
      // (and therefore network-first HTML) runs without needing a reload first.
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (event) {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // leave Firebase/Mapbox/etc alone
  if (url.pathname.indexOf('/api/') === 0) return; // never cache dynamic API responses

  if (request.mode === 'navigate') {
    // Network-first for HTML: a fresh deploy's shell (and therefore its new,
    // content-hashed JS/CSS chunk URLs) always wins while online. Cache is only
    // a fallback for offline use, not a way to skip the network.
    event.respondWith(
      fetch(request)
        .then(function (response) {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Stale-while-revalidate for static assets (JS/CSS chunks, fonts, images):
  // instant response from cache when present, refreshed in the background so
  // the NEXT request already has the new asset — this is what keeps offline
  // usage working without pinning the app to old chunks forever.
  event.respondWith(
    caches.match(request).then(function (cached) {
      const network = fetch(request)
        .then(function (response) {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then(function (cache) { cache.put(request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});
`;

export async function GET() {
  return new NextResponse(SW_SOURCE, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      // Never let the SW *script itself* be served stale from an HTTP cache —
      // that would defeat the whole update-detection mechanism above.
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
}

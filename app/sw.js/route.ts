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
// THE APP SHELL MUST BE IN HERE OR THE APP CANNOT OPEN OFFLINE. This list held a manifest and two
// icons — no HTML, no JS — so nothing a farmer could actually open was ever precached. Combined
// with RUNTIME_CACHE being version-named (the activate sweep below drops the previous build's), a
// farmer who loaded a new build on the last bar of signal and then went home had NOTHING: the
// navigate fallback reached for '/', which was never precached either.
// These are the routes a farmer opens on a phone with no signal.
const PRECACHE_URLS = [
  '/manifest.json', '/icon-192.png', '/icon-512.png',
  '/', '/home', '/farmer', '/student',
];

// COURSE DOWNLOADS — deliberately NOT versioned by CACHE_VERSION, and deliberately spared by the
// activate sweep below.
//
// Everything else here is per-deploy and disposable: a new build should drop the old shell. This
// one is the opposite. It holds a module a farmer chose to download in town, with their own
// airtime, to use for weeks at a homestead with no signal. Naming it with CACHE_VERSION would have
// deleted it on the next deploy — the farmer would open the app, see it had updated, and find the
// lessons they paid for gone, with no way to get them back until the next trip.
//
// Written only by lib/offline-cache.ts, on an explicit tap. This worker never adds to it.
const COURSE_CACHE = 'imbewu-course-v1';
const COURSE_PATH = /^\\/course-(decks|audio|animations|images)\\//;

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      // ONE URL AT A TIME, NOT addAll. addAll is atomic: a single 404 or redirect rejects the whole
      // precache, and the .catch below would swallow it — leaving the farmer with no shell at all
      // and no signal that anything went wrong. Per-URL means a bad entry costs only that entry.
      return Promise.all(PRECACHE_URLS.map(function (url) {
        return cache.add(url).catch(function () {});
      }));
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
          .filter(function (key) {
            // COURSE_CACHE survives every deploy on purpose — see the comment on its declaration.
            return key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== COURSE_CACHE;
          })
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

  // A DOWNLOADED course asset is answered from the download, before anything else.
  //
  // It has to come first because the generic handler below is stale-while-revalidate: it would
  // return the cached copy and then fire a background fetch to refresh it. That is right for a JS
  // chunk and wrong here — these files never change, and the background request would spend a
  // farmer's data re-downloading a 700 KB clip they already own, every time they open the slide.
  //
  // A course asset that was NOT downloaded falls through untouched, so streaming one stays the
  // learner's choice, made on the page with the size in front of them.
  if (COURSE_PATH.test(url.pathname)) {
    event.respondWith(
      caches.open(COURSE_CACHE).then(function (cache) {
        return cache.match(request, { ignoreSearch: true }).then(function (hit) {
          return hit || fetch(request);
        });
      })
    );
    return;
  }

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
          // Fall back through what a farmer can actually use: this exact page, then the app's
          // real entry point, then the root. '/' alone was the old behaviour and it was never
          // precached, so offline navigation simply failed.
          // Chained, NOT a single 'hit || caches.match(next)' expression: caches.match returns a
          // PROMISE, which is always truthy, so such a chain stops at the first match call whether
          // or not it resolved to anything. (Backticks are banned in here — this file is one big
          // template literal and a stray backtick silently ends it.)
          return caches.match(request)
            .then(function (hit) { return hit || caches.match('/home'); })
            .then(function (hit) { return hit || caches.match('/'); });
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

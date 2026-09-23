import { NextResponse } from 'next/server';
import { APP_GUIDES } from '@/lib/course-app-guides';
import { STUDIES_PATHWAY_PAGES } from '@/lib/studies-pathway-pack';

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
  '/', '/home', '/farmer', '/student', '/prices', '/offline',
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
const COURSE_PATH = /^(?:\\/course-(decks|audio|animations|images)|\\/finance-course)\\//;

// PLANT & ELEMENT ART — the same idea as COURSE_CACHE, with one honest difference.
//
// This art lived in RUNTIME_CACHE, which is named with CACHE_VERSION and swept on every
// activate. Tens of MB of map canopies and picker sprites, identical bytes deploy after
// deploy, re-downloaded on a farmer's airtime every time we shipped anything at all —
// a copy fix on the login page cost her the whole art set again.
//
// The difference from course files: art DOES occasionally change in place. A regenerated
// canopy keeps its filename, so a cache that never expires would pin the old drawing
// forever. Hence the hand-bumped version in the name: bump it in the SAME commit that
// ships a visual refresh of existing files, and the activate sweep below (which spares
// only the exact current name) deletes the old cache in the field. New files under a new
// filename do NOT need a bump — a miss falls through to the network and is cached on
// first sight. Ordinary deploys leave the constant alone and the art survives.
const ART_CACHE = 'imbewu-art-v1';
const ART_PATH = /^\\/(element-art|element-art-2|render-assets|report-art)\\//;

// A first visit loads its scripts BEFORE the worker controls the page. Saving HTML alone
// therefore cannot boot that page after closing the browser. Publish each cached document
// only after all its same-origin build assets (including CSS fonts) are safely stored.
const pendingAssets = new Map();
function buildAssets(text, base) {
  const matches = text.match(/(?:\\/|\\.\\.\\/)[^\\s"'<>\\\\()]+/g) || [];
  return Array.from(new Set(matches.map(function (value) {
    try { const url = new URL(value.replace(/&amp;/g, '&'), base);
      return url.origin === self.location.origin && url.pathname.indexOf('/_next/static/') === 0 ? url.href : null;
    } catch (_) { return null; }
  }).filter(Boolean)));
}
function cacheAsset(cache, url) {
  if (pendingAssets.has(url)) return pendingAssets.get(url);
  const work = (async function () {
    let response = await cache.match(url);
    if (!response) {
      response = await fetch(url);
      if (!response.ok) throw new Error('Startup asset unavailable: ' + url);
      await cache.put(url, response.clone());
    }
    if (new URL(url).pathname.endsWith('.css')) {
      await Promise.all(buildAssets(await response.text(), url).map(function (child) {
        return cacheAsset(cache, child);
      }));
    }
  })();
  pendingAssets.set(url, work);
  return work.finally(function () { pendingAssets.delete(url); });
}
async function cachePage(cache, url, suppliedResponse) {
  const response = suppliedResponse || await fetch(url, { cache: 'reload' });
  if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
    throw new Error('Startup page unavailable: ' + url);
  }
  const assets = buildAssets(await response.clone().text(), new URL(url, self.location.origin));
  if (!assets.some(function (asset) { return new URL(asset).pathname.endsWith('.js'); })) {
    throw new Error('Startup page has no application scripts');
  }
  await Promise.all(assets.map(function (asset) { return cacheAsset(cache, asset); }));
  await cache.put(url, response);
}
self.addEventListener('install', function (event) {
  event.waitUntil((async function () {
    const cache = await caches.open(SHELL_CACHE);
    // The installed app launches /home. If preparing it fails, reject this update and
    // leave the previous working worker and its caches in control.
    await cachePage(cache, '/home');
    await Promise.all(PRECACHE_URLS.map(function (url) {
      if (url === '/home') return;
      return (url.endsWith('.json') || url.endsWith('.png')
        ? cache.add(url) : cachePage(cache, url)).catch(function () {});
    }));
    await self.skipWaiting();
  })());
});

const FIELD_PAGES = ['/home','/offline','/farmer','/student','/records','/invoice','/journal','/facilitator/crops','/cropplan','/reports','/design','/calendar','/assessments','/mentor','/ngo','/funder','/network'];
const GUIDE_PAGES = ${JSON.stringify(APP_GUIDES.map(guide => guide.href))};
const STUDIES_PATHWAY_PAGES = ${JSON.stringify(STUDIES_PATHWAY_PAGES)};
async function assetReady(cache, url, seen) {
  if (seen.has(url)) return true;
  seen.add(url);
  const response = await cache.match(url);
  if (!response) return false;
  if (!new URL(url).pathname.endsWith('.css')) return true;
  const children = buildAssets(await response.text(), url);
  return (await Promise.all(children.map(function (child) { return assetReady(cache, child, seen); }))).every(Boolean);
}
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
  if (!event.ports[0] || !event.data || !['PREPARE_FIELD_PAGES','FIELD_PAGE_STATUS'].includes(event.data.type)) return;
  const port = event.ports[0];
  event.waitUntil((async function () {
    const cache = await caches.open(SHELL_CACHE);
    const requested = Array.isArray(event.data.paths) ? event.data.paths.filter(function (path) { return FIELD_PAGES.includes(path) || GUIDE_PAGES.includes(path) || STUDIES_PATHWAY_PAGES.includes(path); }) : FIELD_PAGES;
    for (const path of requested) {
      let error = '';
      if (event.data.type === 'PREPARE_FIELD_PAGES') {
        try { await cachePage(cache, path); } catch (_) { error = 'Could not finish downloading this page.'; }
      }
      const response = await cache.match(path);
      let ready = false;
      if (response) {
        const assets = buildAssets(await response.text(), new URL(path, self.location.origin));
        ready = assets.length > 0 && (await Promise.all(assets.map(function (url) { return assetReady(cache, url, new Set()); }))).every(Boolean);
      }
      port.postMessage({ path, ready, error });
    }
    port.postMessage({ done: true });
  })().catch(function () { port.postMessage({ done: true, error: 'Device storage is unavailable.' }); }));
});

// The guild lesson changed from 20 recordings to 51. Keep other downloaded lessons,
// but do not pair their old guild speech with the new slide order. This marker survives
// ordinary deploys so the replacement is invalidated once, not on every app update.
async function migrateGuildNarration() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/plant-guilds/.revision-20260909';
  if (await cache.match(marker)) return;
  const keys = await cache.keys();
  for (const request of keys) {
    if (new URL(request.url).pathname.indexOf('/course-audio/plant-guilds/en/') === 0) {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('51-slide guild narration'));
}

// Corrected teaching reused existing URLs. Without this one-time migration, a farmer's
// deliberate download would keep the old speech forever beside the new lesson text.
// Remove only replaced files; never clear the whole course or silently spend data refetching.
async function migrateStudiesMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.studies-corrections-20260920';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    "/course-audio/food-forest/en/full.mp3",
    "/course-audio/food-forest/en/slide-01.mp3",
    "/course-audio/food-forest/en/slide-02.mp3",
    "/course-audio/food-forest/en/slide-03.mp3",
    "/course-audio/food-forest/en/slide-04.mp3",
    "/course-audio/food-forest/en/slide-05.mp3",
    "/course-audio/food-forest/en/slide-06.mp3",
    "/course-audio/food-forest/en/slide-07.mp3",
    "/course-audio/food-forest/en/slide-08.mp3",
    "/course-audio/food-forest/en/slide-09.mp3",
    "/course-audio/food-forest/en/slide-10.mp3",
    "/course-audio/food-forest/en/slide-11.mp3",
    "/course-audio/food-forest/en/slide-12.mp3",
    "/course-audio/food-forest/en/slide-13.mp3",
    "/course-audio/food-forest/en/slide-14.mp3",
    "/course-audio/food-forest/en/slide-15.mp3",
    "/course-audio/food-forest/en/slide-16.mp3",
    "/course-audio/food-forest/en/slide-17.mp3",
    "/course-audio/food-forest/en/slide-18.mp3",
    "/course-audio/food-forest/en/slide-19.mp3",
    "/course-audio/food-forest/en/slide-20.mp3",
    "/course-audio/market-community/en/full.mp3",
    "/course-audio/market-community/en/slide-01.mp3",
    "/course-audio/market-community/en/slide-02.mp3",
    "/course-audio/market-community/en/slide-03.mp3",
    "/course-audio/market-community/en/slide-04.mp3",
    "/course-audio/market-community/en/slide-05.mp3",
    "/course-audio/market-community/en/slide-06.mp3",
    "/course-audio/market-community/en/slide-07.mp3",
    "/course-audio/market-community/en/slide-08.mp3",
    "/course-audio/market-community/en/slide-09.mp3",
    "/course-audio/market-community/en/slide-10.mp3",
    "/course-audio/market-community/en/slide-11.mp3",
    "/course-audio/market-community/en/slide-12.mp3",
    "/course-audio/market-community/en/slide-13.mp3",
    "/course-audio/market-community/en/slide-14.mp3",
    "/course-audio/market-community/en/slide-15.mp3",
    "/course-audio/market-community/en/slide-16.mp3",
    "/course-audio/market-community/en/slide-17.mp3",
    "/course-audio/market-community/en/slide-18.mp3",
    "/course-audio/market-community/en/slide-19.mp3",
    "/course-audio/market-community/en/slide-20.mp3",
    "/course-audio/reading-landscape/en/full.mp3",
    "/course-audio/reading-landscape/en/slide-14.mp3",
    "/course-audio/small-livestock/en/full.mp3",
    "/course-audio/small-livestock/en/slide-01.mp3",
    "/course-audio/small-livestock/en/slide-02.mp3",
    "/course-audio/small-livestock/en/slide-03.mp3",
    "/course-audio/small-livestock/en/slide-04.mp3",
    "/course-audio/small-livestock/en/slide-05.mp3",
    "/course-audio/small-livestock/en/slide-06.mp3",
    "/course-audio/small-livestock/en/slide-07.mp3",
    "/course-audio/small-livestock/en/slide-08.mp3",
    "/course-audio/small-livestock/en/slide-09.mp3",
    "/course-audio/small-livestock/en/slide-10.mp3",
    "/course-audio/small-livestock/en/slide-11.mp3",
    "/course-audio/small-livestock/en/slide-12.mp3",
    "/course-audio/small-livestock/en/slide-13.mp3",
    "/course-audio/small-livestock/en/slide-14.mp3",
    "/course-audio/small-livestock/en/slide-15.mp3",
    "/course-audio/small-livestock/en/slide-16.mp3",
    "/course-audio/small-livestock/en/slide-17.mp3",
    "/course-audio/small-livestock/en/slide-18.mp3",
    "/course-audio/small-livestock/en/slide-19.mp3",
    "/course-audio/small-livestock/en/slide-20.mp3",
    "/course-audio/soil-health/en/full.mp3",
    "/course-audio/soil-health/en/slide-01.mp3",
    "/course-audio/soil-health/en/slide-02.mp3",
    "/course-audio/soil-health/en/slide-03.mp3",
    "/course-audio/soil-health/en/slide-04.mp3",
    "/course-audio/soil-health/en/slide-05.mp3",
    "/course-audio/soil-health/en/slide-06.mp3",
    "/course-audio/soil-health/en/slide-07.mp3",
    "/course-audio/soil-health/en/slide-08.mp3",
    "/course-audio/soil-health/en/slide-09.mp3",
    "/course-audio/soil-health/en/slide-10.mp3",
    "/course-audio/soil-health/en/slide-11.mp3",
    "/course-audio/soil-health/en/slide-12.mp3",
    "/course-audio/soil-health/en/slide-13.mp3",
    "/course-audio/soil-health/en/slide-14.mp3",
    "/course-audio/soil-health/en/slide-15.mp3",
    "/course-audio/soil-health/en/slide-16.mp3",
    "/course-audio/soil-health/en/slide-17.mp3",
    "/course-audio/soil-health/en/slide-18.mp3",
    "/course-audio/soil-health/en/slide-19.mp3",
    "/course-audio/soil-health/en/slide-20.mp3",
    "/course-audio/vegetables-staples/en/full.mp3",
    "/course-audio/vegetables-staples/en/slide-01.mp3",
    "/course-audio/vegetables-staples/en/slide-02.mp3",
    "/course-audio/vegetables-staples/en/slide-03.mp3",
    "/course-audio/vegetables-staples/en/slide-04.mp3",
    "/course-audio/vegetables-staples/en/slide-05.mp3",
    "/course-audio/vegetables-staples/en/slide-06.mp3",
    "/course-audio/vegetables-staples/en/slide-07.mp3",
    "/course-audio/vegetables-staples/en/slide-08.mp3",
    "/course-audio/vegetables-staples/en/slide-09.mp3",
    "/course-audio/vegetables-staples/en/slide-10.mp3",
    "/course-audio/vegetables-staples/en/slide-11.mp3",
    "/course-audio/vegetables-staples/en/slide-12.mp3",
    "/course-audio/vegetables-staples/en/slide-13.mp3",
    "/course-audio/vegetables-staples/en/slide-14.mp3",
    "/course-audio/vegetables-staples/en/slide-15.mp3",
    "/course-audio/vegetables-staples/en/slide-16.mp3",
    "/course-audio/vegetables-staples/en/slide-17.mp3",
    "/course-audio/vegetables-staples/en/slide-18.mp3",
    "/course-audio/water-harvesting/en/full.mp3",
    "/course-audio/water-harvesting/en/slide-01.mp3",
    "/course-audio/water-harvesting/en/slide-02.mp3",
    "/course-audio/water-harvesting/en/slide-03.mp3",
    "/course-audio/water-harvesting/en/slide-04.mp3",
    "/course-audio/water-harvesting/en/slide-05.mp3",
    "/course-audio/water-harvesting/en/slide-06.mp3",
    "/course-audio/water-harvesting/en/slide-07.mp3",
    "/course-audio/water-harvesting/en/slide-08.mp3",
    "/course-audio/water-harvesting/en/slide-09.mp3",
    "/course-audio/water-harvesting/en/slide-10.mp3",
    "/course-audio/water-harvesting/en/slide-11.mp3",
    "/course-audio/water-harvesting/en/slide-12.mp3",
    "/course-audio/water-harvesting/en/slide-13.mp3",
    "/course-audio/water-harvesting/en/slide-14.mp3",
    "/course-audio/water-harvesting/en/slide-15.mp3",
    "/course-audio/water-harvesting/en/slide-16.mp3",
    "/course-audio/water-harvesting/en/slide-17.mp3",
    "/course-audio/water-harvesting/en/slide-18.mp3",
    "/course-audio/water-harvesting/en/slide-19.mp3",
    "/course-audio/water-harvesting/en/slide-20.mp3",
    "/course-audio/water-harvesting/en/slide-21.mp3",
    "/course-audio/water-harvesting/en/slide-22.mp3",
    "/course-audio/water-harvesting/en/slide-23.mp3",
    "/course-audio/water-harvesting/en/slide-24.mp3",
    "/course-images/market-community/market-community-l1.jpg",
    "/course-images/reading-landscape/reading-landscape-l2.jpg",
    "/course-images/reading-landscape/reading-landscape-l3.jpg",
    "/course-images/soil-health/soil-health-l1.jpg",
    "/course-images/vegetables-staples/vegetables-staples-l3.jpg",
    "/course-images/water-harvesting/water-harvesting-l3.jpg"
]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected Studies media; unaffected downloads preserved'));
}

// The chicken Watch scene now shows foraging, not a moving pen. Invalidate only its
// old speech and slide; otherwise a saved lesson would describe an action no longer shown.
async function migrateChickenForagingMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.chicken-foraging-20260920';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/small-livestock/en/slide-04.mp3',
    '/course-audio/small-livestock/en/full.mp3',
    '/course-decks/small-livestock/en/slide-04.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Foraging scene and matching narration'));
}

// This tour names each layer as it is highlighted. Old speech would label the wrong
// plant, so replace just this scene's saved speech and still, once.
async function migrateForestLayerMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.forest-layers-20260920';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/food-forest/en/slide-05.mp3',
    '/course-audio/food-forest/en/full.mp3',
    '/course-decks/food-forest/en/slide-05.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Forest layer tour and matching narration'));
}

// The soil close-ups now follow three spoken observations. Remove only the old
// scene's speech and still so saved lessons cannot mix the two versions.
async function migrateSoilObservationMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.soil-observation-20260920';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/soil-health/en/slide-05.mp3',
    '/course-audio/soil-health/en/full.mp3',
    '/course-decks/soil-health/en/slide-05.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Soil observation tour and matching narration'));
}

// The young-forest close-ups replace a planting sequence. Old saved speech would
// describe different pictures; preserve all other downloads and let learners choose data use.
async function migrateForestEstablishmentMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.forest-establishment-20260921';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/food-forest/en/slide-15.mp3',
    '/course-audio/food-forest/en/full.mp3',
    '/course-decks/food-forest/en/slide-15.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Young forest tour and matching narration'));
}

// The site-map lesson no longer calls an unmeasured sketch "to scale" or treats
// weeds as proof of compaction. Retire the old speech only; keep every other saved
// slide so a learner can choose when to fetch the corrected recordings.
async function migrateLandscapeSiteMapNarration() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.landscape-site-map-source-correction-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/reading-landscape/en/slide-16.mp3',
    '/course-audio/reading-landscape/en/slide-18.mp3',
    '/course-audio/reading-landscape/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected site-map and soil-observation narration'));
}

// The L3 still now shows the mulch layer in the teaching sequence. Remove only the
// superseded saved still once; keep every other downloaded course asset intact.
async function migrateForestMulchInfographic() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-images/food-forest/.mulch-layer-correction-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-images/food-forest/food-forest-l3.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected food forest mulch layer still'));
}

// The older wide movie ends with bare cardboard, and the authored composite is awaiting Rory's
// approval. Retire only those saved pairs; the learner chooses whether to download the Flow close-up.
async function migrateForestSheetMulchingMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/food-forest/.flow-sheet-mulching-closeup-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/food-forest/flow-sheet-mulching.mp4',
    '/course-animations/food-forest/posters/flow-sheet-mulching.jpg',
    '/course-animations/food-forest/sheet-mulching-layer-order.mp4',
    '/course-animations/food-forest/posters/sheet-mulching-layer-order.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Food forest Flow sheet mulch close-up'));
}

// Slide 6's older film stops before the seedling plug is seated. Retire that saved pair only;
// the reviewed lesson still remains available without downloading a replacement film.
async function migrateVegetableChoiceMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/vegetables-staples/.seed-or-seedling-choice-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-animations/vegetables-staples/posters/flow-seed-or-seedling.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Seed or seedling lesson still'));
}

// Rory requires explicit visual clearance before code-drawn lesson animations are shown. Remove
// only the three preview candidates from saved packs; their lesson stills and all other media stay.
async function migrateUnapprovedStudyAnimations() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/.unapproved-code-drawn-retired-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/plant-guilds/thin-selected-support.mp4',
    '/course-animations/plant-guilds/posters/thin-selected-support.jpg',
    '/course-animations/vegetables-staples/seed-or-seedling-choice.mp4',
    '/course-animations/vegetables-staples/posters/seed-or-seedling-choice.jpg',
    '/course-animations/vegetables-staples/pest-decision-path.mp4',
    '/course-animations/vegetables-staples/posters/pest-decision-path.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Unapproved lesson animations retired'));
}

// Rory has not cleared the locally rendered diagrams and tours. Remove every public copy from a
// saved pack so a learner sees the lesson still while one-at-a-time Flow replacements are reviewed.
// This is a new marker because earlier clients may already have run the narrower retirement above.
async function migrateHeldAuthoredStudyAnimations() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/.held-authored-media-retired-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/water-harvesting/watch-09-vetiver-contour.mp4',
    '/course-animations/water-harvesting/posters/watch-09-vetiver-contour.jpg',
    '/course-animations/water-harvesting/watch-12-dam-spillway.mp4',
    '/course-animations/water-harvesting/posters/watch-12-dam-spillway.jpg',
    '/course-animations/water-harvesting/watch-16-first-flush-tank.mp4',
    '/course-animations/water-harvesting/posters/watch-16-first-flush-tank.jpg',
    '/course-animations/water-harvesting/watch-21-greywater-mulch.mp4',
    '/course-animations/water-harvesting/posters/watch-21-greywater-mulch.jpg',
    '/course-animations/intro-permaculture/watch-07-three-ethics.mp4',
    '/course-animations/intro-permaculture/posters/watch-07-three-ethics.jpg',
    '/course-animations/intro-permaculture/watch-13-diversity.mp4',
    '/course-animations/intro-permaculture/posters/watch-13-diversity.jpg',
    '/course-animations/intro-permaculture/motion-windbreak.mp4',
    '/course-animations/intro-permaculture/posters/motion-windbreak.jpg',
    '/course-animations/intro-permaculture/watch-19-windbreak.mp4',
    '/course-animations/intro-permaculture/posters/watch-19-windbreak.jpg',
    '/course-animations/reading-landscape/watch-05-water-movement.mp4',
    '/course-animations/reading-landscape/posters/watch-05-water-movement.jpg',
    '/course-animations/reading-landscape/watch-09-sun-shadows.mp4',
    '/course-animations/reading-landscape/posters/watch-09-sun-shadows.jpg',
    '/course-animations/reading-landscape/watch-13-wind-cold-air.mp4',
    '/course-animations/reading-landscape/posters/watch-13-wind-cold-air.jpg',
    '/course-animations/reading-landscape/watch-17-site-map.mp4',
    '/course-animations/reading-landscape/posters/watch-17-site-map.jpg',
    '/course-animations/soil-health/tour-soil-observation.mp4',
    '/course-animations/soil-health/posters/tour-soil-observation.jpg',
    '/course-animations/soil-health/watch-05-living-soil.mp4',
    '/course-animations/soil-health/posters/watch-05-living-soil.jpg',
    '/course-animations/soil-health/watch-10-compost-heap.mp4',
    '/course-animations/soil-health/posters/watch-10-compost-heap.jpg',
    '/course-animations/soil-health/watch-14-mulch-protection.mp4',
    '/course-animations/soil-health/posters/watch-14-mulch-protection.jpg',
    '/course-animations/food-forest/tour-seven-layers.mp4',
    '/course-animations/food-forest/posters/tour-seven-layers.jpg',
    '/course-animations/food-forest/watch-05-seven-layers.mp4',
    '/course-animations/food-forest/posters/watch-05-seven-layers.jpg',
    '/course-animations/food-forest/watch-10-climate-match.mp4',
    '/course-animations/food-forest/posters/watch-10-climate-match.jpg',
    '/course-animations/food-forest/tour-young-forest.mp4',
    '/course-animations/food-forest/posters/tour-young-forest.jpg',
    '/course-animations/food-forest/watch-15-forest-sequence.mp4',
    '/course-animations/food-forest/posters/watch-15-forest-sequence.jpg',
    '/course-animations/small-livestock/bee-hive-and-blossom.mp4',
    '/course-animations/small-livestock/posters/bee-hive-and-blossom.jpg',
    '/course-animations/small-livestock/watch-04-chicken-tractor.mp4',
    '/course-animations/small-livestock/posters/watch-04-chicken-tractor.jpg',
    '/course-animations/small-livestock/watch-09-bee-pollination.mp4',
    '/course-animations/small-livestock/posters/watch-09-bee-pollination.jpg',
    '/course-animations/small-livestock/watch-14-nutrient-loop.mp4',
    '/course-animations/small-livestock/posters/watch-14-nutrient-loop.jpg',
    '/course-animations/market-community/watch-04-farm-record.mp4',
    '/course-animations/market-community/posters/watch-04-farm-record.jpg',
    '/course-animations/market-community/watch-09-surplus-routes.mp4',
    '/course-animations/market-community/posters/watch-09-surplus-routes.jpg',
    '/course-animations/market-community/watch-14-community-network.mp4',
    '/course-animations/market-community/posters/watch-14-community-network.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Held authored study media retired'));
}

// The two water swale clips are held pending safety and visual review. Remove only their
// saved movies and posters, including URL variants, so unrelated course media remains offline.
async function migrateHeldWaterSwaleMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/water-harvesting/.swale-clips-held-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/water-harvesting/watch-04-swale-infiltration.mp4',
    '/course-animations/water-harvesting/posters/watch-04-swale-infiltration.jpg',
    '/course-animations/water-harvesting/watch-07-swale-overflow-pond.mp4',
    '/course-animations/water-harvesting/posters/watch-07-swale-overflow-pond.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Water swale clips held for review'));
}

// Slide 9's route choices were too small at phone fit; replace only its saved still.
async function migrateMarketL2RouteStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/market-community/.l2-route-still-20260923';
  if (await cache.match(marker)) return;
  const obsolete = '/course-decks/market-community/en/slide-09.jpg';
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === obsolete) await cache.delete(request);
  }
  await cache.put(marker, new Response('Market L2 route still replaced'));
}

// Historical migration from the original drawn bee route to the now-withdrawn composite. Keep its
// marker for clients crossing that release; the broader migration above retires both generations.
async function migrateBeeHiveAndBlossomMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/small-livestock/.bee-hive-and-blossom-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/small-livestock/watch-09-bee-pollination.mp4',
    '/course-animations/small-livestock/posters/watch-09-bee-pollination.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Bee hive and blossom teaching clip'));
}

// The greywater diagram now names the permitted planting and excluded source water.
// Remove only its old saved movie and poster once; a fresh download stays the learner's choice.
async function migrateGreywaterTeachingMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-animations/water-harvesting/.greywater-labels-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-animations/water-harvesting/watch-21-greywater-mulch.mp4',
    '/course-animations/water-harvesting/posters/watch-21-greywater-mulch.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Greywater source and planting labels'));
}

// The windbreak now explains through-flow, with matching speech. Keep other
// saved lessons and never fetch a replacement without the learner choosing it.
async function migrateWindbreakMedia() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/.windbreak-motion-20260921';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/intro-permaculture/en/slide-19.mp3',
    '/course-audio/intro-permaculture/en/full.mp3',
    '/course-decks/intro-permaculture/en/slide-19.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Windbreak motion and matching narration'));
}

// These soil-cover stills were improved in place while their narration stayed correct. Clear
// only the two saved pictures, then let the learner choose whether to download replacements.
async function migrateSoilCoverStills() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/soil-health/en/.soil-cover-stills-20260922';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/soil-health/en/slide-16.jpg',
    '/course-decks/soil-health/en/slide-18.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Improved soil-cover stills'));
}

// Slide 14 now labels the bare-versus-mulch impact comparison at phone size. Retire only
// the old saved English still once; downloading the new still remains the learner's choice.
async function migrateSoilL3ComparisonStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/soil-health/en/.l3-slide14-comparison-20260923';
  if (await cache.match(marker)) return;
  const obsolete = '/course-decks/soil-health/en/slide-14.jpg';
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === obsolete) await cache.delete(request);
  }
  await cache.put(marker, new Response('Phone-readable Soil Health L3 comparison still'));
}

// Slides 9 and 11 now retain their existing sentences at phone-readable type sizes.
// Retire only those saved stills; each learner chooses when to fetch the replacements.
async function migrateVegetablesL2ReadableStills() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/vegetables-staples/en/.l2-readable-stills-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/vegetables-staples/en/slide-09.jpg',
    '/course-decks/vegetables-staples/en/slide-11.jpg',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Readable Vegetables L2 English stills'));
}

// Slide 16 now presents the existing pest-response order and conditional safeguards at phone width.
// Retire only that saved English still; the learner chooses when to download the replacement.
async function migrateVegetablesL4DecisionStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/vegetables-staples/en/.l4-slide16-decision-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/vegetables-staples/en/slide-16.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable Vegetables L4 decision still'));
}

// The Market record still now uses phone-size destination labels. A saved pack keeps
// old bytes at this URL until explicitly cleared; invalidate only this picture so
// the learner chooses when to download the replacement with their own airtime.
async function migrateMarketRecordStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/market-community/en/.record-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/market-community/en/slide-04.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable harvest destinations'));
}

// Slide 5's English layer key changed while its narration stayed the same. Invalidate
// only that still so a saved pack keeps every other chosen lesson asset and the learner
// decides when to download the clearer image.
async function migrateFoodForestLayerKeyStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/food-forest/en/.layer-key-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/food-forest/en/slide-05.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable seven-layer key'));
}

// Slide 10 now presents the existing climate comparison in large panels. Clear
// only that saved picture; learners choose when to download its replacement.
async function migrateFoodForestClimateMatchStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/food-forest/en/.climate-match-still-20260923-v2';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/food-forest/en/slide-10.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable climate comparison'));
}

// Slide 17's three existing statements are now laid out for phone-width reading.
// Clear only that saved still; learners choose when to download its replacement.
async function migrateFoodForestL3AdjustStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/food-forest/en/.adjust-trees-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/food-forest/en/slide-17.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable tree adjustment statements'));
}

// Slide 14's four sharing labels are now readable at phone fit. Invalidate only
// that saved picture; the learner chooses when to download its replacement.
async function migrateMarketCommunityNetworkStill() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/market-community/en/.community-network-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/market-community/en/slide-14.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Phone-readable community sharing labels'));
}

// Market Community L3's English seed-rights narration changed on slides 15 and
// 20. Retire only the changed recordings and combined lesson audio.
async function migrateMarketCommunityL3SeedRightsTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/market-community/en/.l3-seed-rights-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/market-community/en/slide-15.mp3',
    '/course-audio/market-community/en/slide-20.mp3',
    '/course-audio/market-community/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected seed rights lesson'));
}

// Slide 20's replacement card adds the seed permission caution after the audio
// migration above may already have run for existing learners.
async function migrateMarketCommunityL3SeedRightsCard() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/market-community/en/.l3-seed-rights-card-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/market-community/en/slide-20.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Updated seed rights slide 20 card'));
}

// Small Livestock slide 8's replacement keeps the existing teaching and URL. Retire
// only the saved English still once so learners can choose when to download it.
async function migrateSmallLivestockSlide8Still() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/small-livestock/en/.slide08-still-20260923';
  if (await cache.match(marker)) return;
  for (const request of await cache.keys()) {
    if (new URL(request.url).pathname === '/course-decks/small-livestock/en/slide-08.jpg') {
      await cache.delete(request);
    }
  }
  await cache.put(marker, new Response('Updated Small Livestock slide 8 still'));
}

// The borehole example now asks learners to check permitted use and supply before sharing.
// Retire only its old English pictures and speech; a saved course must not pair those
// bytes with the corrected quiz, and replacement downloads remain the learner's choice.
async function migrateIntroL1WaterUseTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/intro-permaculture/en/.l1-water-use-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/intro-permaculture/en/slide-07.jpg',
    '/course-decks/intro-permaculture/en/slide-08.jpg',
    '/course-audio/intro-permaculture/en/slide-07.mp3',
    '/course-audio/intro-permaculture/en/slide-08.mp3',
    '/course-audio/intro-permaculture/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected English borehole example'));
}

// The old closed-circle art suggested that all nutrients come back to crops.
// Remove only the corrected English pictures and speech from saved packs;
// learners choose when to download the replacements using their own airtime.
async function migrateSmallLivestockL3NutrientFlow() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/small-livestock/en/.l3-nutrient-flow-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/small-livestock/en/slide-14.jpg',
    '/course-decks/small-livestock/en/slide-15.jpg',
    '/course-images/small-livestock/small-livestock-l3.jpg',
    '/course-audio/small-livestock/en/slide-14.mp3',
    '/course-audio/small-livestock/en/slide-15.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected livestock nutrient flow'));
}

// These four stills and six recordings now explain the principles without
// promising hail protection or treating observation as permission to dig.
// A saved pack must not pair its old media with the corrected lesson and quiz.
async function migrateIntroL2PrinciplesTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/intro-permaculture/en/.l2-principles-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    ...[11, 12, 13, 14].map(n => '/course-decks/intro-permaculture/en/slide-' + String(n).padStart(2, '0') + '.jpg'),
    ...[9, 10, 11, 12, 13, 14].map(n => '/course-audio/intro-permaculture/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/intro-permaculture/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected Introduction principles lesson'));
}

// The regional wind direction in the old sectors still was unsupported, and
// the spoken zone example has changed. Remove only this English lesson's old
// pictures and speech so a saved pack cannot pair them with the new quiz.
async function migrateIntroL3ZonesAndSectorsTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/intro-permaculture/en/.l3-zones-sectors-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    ...[17, 18, 19].map(n => '/course-decks/intro-permaculture/en/slide-' + String(n).padStart(2, '0') + '.jpg'),
    ...[15, 16, 17, 18].map(n => '/course-audio/intro-permaculture/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/intro-permaculture/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected Introduction zones and sectors lesson'));
}

// A saved landscape lesson may still say every water exit is a loss and urge
// earthworks from an A-frame sketch. Retire only the corrected English assets;
// the learner chooses when to download their replacements.
async function migrateLandscapeL1WaterObservationTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/reading-landscape/en/.l1-water-observation-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/reading-landscape/en/slide-04.jpg',
    '/course-decks/reading-landscape/en/slide-07.jpg',
    ...[4, 6, 7, 20, 21].map(n => '/course-audio/reading-landscape/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/reading-landscape/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected landscape water-observation lesson'));
}

// The old frost card and speech direct tender plants toward a wall without
// checking cold-air pooling. Retire only L2 English media; downloads stay the
// learner's choice and the other lessons keep their saved files.
async function migrateLandscapeL2SunAndFrostTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/reading-landscape/en/.l2-sun-frost-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/reading-landscape/en/slide-11.jpg',
    ...[8, 10, 11].map(n => '/course-audio/reading-landscape/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/reading-landscape/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected landscape sun and frost lesson'));
}

// The old wind and frost cards turn regional examples into siting rules and
// suggest moving a tomato bed alone controls late blight. Retire only the
// coordinated English L3 media so a saved lesson cannot mix old and new advice.
async function migrateLandscapeL3WindAndFrostTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/reading-landscape/en/.l3-wind-frost-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    ...[13, 14, 15].map(n => '/course-decks/reading-landscape/en/slide-' + String(n).padStart(2, '0') + '.jpg'),
    ...[12, 13, 14, 15].map(n => '/course-audio/reading-landscape/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/reading-landscape/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected landscape wind and frost lesson'));
}

// The old swale cards and speech promise level-only earthworks, deep root
// moisture and a safe receiver that the concept pictures cannot establish.
// Retire only this English teaching so saved packs refresh without losing
// unrelated water lessons or spending airtime until the learner requests it.
async function migrateWaterL1SwaleTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/water-harvesting/en/.l1-swale-20260923';
  if (await cache.match(marker)) return;
  const changed = [2, 3, 4, 5, 7];
  const obsolete = new Set([
    ...changed.map(n => '/course-decks/water-harvesting/en/slide-' + String(n).padStart(2, '0') + '.jpg'),
    ...changed.map(n => '/course-audio/water-harvesting/en/slide-' + String(n).padStart(2, '0') + '.mp3'),
    '/course-audio/water-harvesting/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected water swale lesson'));
}

// The earlier dam still and speech made catchment area sound sufficient for
// sizing. Retire only the changed English slide and combined recording.
async function migrateWaterL2DamSizingTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/water-harvesting/en/.l2-dam-sizing-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/water-harvesting/en/slide-12.jpg',
    '/course-audio/water-harvesting/en/slide-12.mp3',
    '/course-audio/water-harvesting/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected dam sizing lesson'));
}

// The roof-catchment lesson now asks learners to check the collecting surface.
// Refresh only the changed English speech; the still and other lessons stay saved.
async function migrateWaterL3RoofSuitabilityTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-audio/water-harvesting/en/.l3-roof-suitability-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-audio/water-harvesting/en/slide-14.mp3',
    '/course-audio/water-harvesting/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected roof suitability lesson'));
}

// The bee film does not show a hive departure or prove pollen transfer, and
// the former range card drew a sharp regional split. Retire only matched
// English speech and the revised range still from saved lesson packs.
async function migrateSmallLivestockL2BeeTeaching() {
  const cache = await caches.open(COURSE_CACHE);
  const marker = '/course-decks/small-livestock/en/.l2-bee-teaching-20260923';
  if (await cache.match(marker)) return;
  const obsolete = new Set([
    '/course-decks/small-livestock/en/slide-11.jpg',
    '/course-audio/small-livestock/en/slide-09.mp3',
    '/course-audio/small-livestock/en/slide-11.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ]);
  for (const request of await cache.keys()) {
    if (obsolete.has(new URL(request.url).pathname)) await cache.delete(request);
  }
  await cache.put(marker, new Response('Corrected bee lesson'));
}

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      const previousShell = keys.filter(function (key) { return key.indexOf('imbewufield-shell-') === 0 && key !== SHELL_CACHE; }).pop();
      const previousRuntime = keys.filter(function (key) { return key.indexOf('imbewufield-runtime-') === 0 && key !== RUNTIME_CACHE; }).pop();
      return Promise.all(
        keys
          .filter(function (key) {
            // COURSE_CACHE and ART_CACHE survive every deploy on purpose — see the comments on
            // their declarations. A superseded art cache (imbewu-art-v1 after the constant moves
            // to v2) no longer matches and is swept here like any other stale cache.
            return key !== SHELL_CACHE && key !== RUNTIME_CACHE && key !== COURSE_CACHE && key !== ART_CACHE && key !== previousShell && key !== previousRuntime;
          })
          .map(function (key) { return caches.delete(key); })
      );
    }).then(migrateGuildNarration).then(migrateStudiesMedia).then(migrateChickenForagingMedia).then(migrateForestLayerMedia).then(migrateSoilObservationMedia).then(migrateForestEstablishmentMedia).then(migrateLandscapeSiteMapNarration).then(migrateForestMulchInfographic).then(migrateForestSheetMulchingMedia).then(migrateVegetableChoiceMedia).then(migrateUnapprovedStudyAnimations).then(migrateBeeHiveAndBlossomMedia).then(migrateGreywaterTeachingMedia).then(migrateWindbreakMedia).then(migrateSoilCoverStills).then(migrateSoilL3ComparisonStill).then(migrateVegetablesL2ReadableStills).then(migrateVegetablesL4DecisionStill).then(migrateMarketRecordStill).then(migrateFoodForestLayerKeyStill).then(migrateFoodForestClimateMatchStill).then(migrateFoodForestL3AdjustStill).then(migrateHeldAuthoredStudyAnimations).then(migrateHeldWaterSwaleMedia).then(migrateMarketL2RouteStill).then(migrateMarketCommunityNetworkStill).then(migrateMarketCommunityL3SeedRightsTeaching).then(migrateMarketCommunityL3SeedRightsCard).then(migrateSmallLivestockSlide8Still).then(migrateIntroL1WaterUseTeaching).then(migrateSmallLivestockL3NutrientFlow).then(migrateIntroL2PrinciplesTeaching).then(migrateIntroL3ZonesAndSectorsTeaching).then(migrateLandscapeL1WaterObservationTeaching).then(migrateLandscapeL2SunAndFrostTeaching).then(migrateLandscapeL3WindAndFrostTeaching).then(migrateWaterL1SwaleTeaching).then(migrateWaterL2DamSizingTeaching).then(migrateWaterL3RoofSuitabilityTeaching).then(migrateSmallLivestockL2BeeTeaching).then(function () {
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

  // A guide revision is part of its cache key. Stream only on a miss; never refresh a
  // saved recording in the background and spend the learner's airtime twice.
  if (url.pathname.indexOf('/app-guide-audio/') === 0) {
    event.respondWith(caches.open(COURSE_CACHE).then(function (cache) {
      return cache.match(request).then(function (hit) { return hit || fetch(request); });
    }));
    return;
  }

  // A DOWNLOADED course asset is answered from the download, before anything else.
  //
  // It has to come first because the generic handler below is stale-while-revalidate: it would
  // return the cached copy and then fire a background fetch to refresh it. That is right for a JS
  // chunk and wrong here — replaced files are migrated explicitly above, and a background request would spend a
  // farmer's data re-downloading a 700 KB clip they already own, every time they open the slide.
  //
  // A course asset that was NOT downloaded falls through untouched, so streaming one stays the
  // learner's choice, made on the page with the size in front of them.
  if (COURSE_PATH.test(url.pathname) || url.pathname.indexOf('/studies-guides/') === 0) {
    event.respondWith(
      caches.open(COURSE_CACHE).then(function (cache) {
        return cache.match(request, { ignoreSearch: true }).then(function (hit) {
          return hit || fetch(request);
        });
      })
    );
    return;
  }

  // Art is cache-first with a network fill, and NO background revalidation. The generic
  // stale-while-revalidate below would serve the cached sprite and then re-fetch the full
  // body anyway — right for a JS chunk, wasted airtime for a canopy that changes once a
  // season. Freshness is handled by the ART_CACHE version bump, not by re-downloading.
  if (ART_PATH.test(url.pathname)) {
    event.respondWith(
      caches.open(ART_CACHE).then(function (cache) {
        return cache.match(request).then(function (hit) {
          if (hit) return hit;
          return fetch(request).then(function (response) {
            if (response && response.status === 200) {
              event.waitUntil(cache.put(request, response.clone()).catch(function () {}));
            }
            return response;
          });
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
          event.waitUntil(caches.open(RUNTIME_CACHE).then(function (cache) {
            return cachePage(cache, request.url, copy);
          }).catch(function () {}));
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
          return caches.open(RUNTIME_CACHE).then(function (cache) { return cache.match(request); })
            .then(function (hit) { return hit || caches.open(SHELL_CACHE).then(function (cache) { return cache.match(request); }); })
            .then(function (hit) { return hit || caches.open(SHELL_CACHE).then(function (cache) { return cache.match('/home'); }); })
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
    caches.open(RUNTIME_CACHE).then(function (cache) { return cache.match(request); })
      .then(function (hit) { return hit || caches.open(SHELL_CACHE).then(function (cache) { return cache.match(request); }); })
      .then(function (hit) { return hit || caches.match(request); })
      .then(function (cached) {
      const network = fetch(request)
        .then(function (response) {
          if (response && response.status === 200) {
            const copy = response.clone();
            event.waitUntil(caches.open(RUNTIME_CACHE).then(function (cache) { return cache.put(request, copy); }).catch(function () {}));
          }
          return response;
        })
        .catch(function () { return cached; });
      // A cached response can finish before the refresh. Keep that refresh and its
      // cache write alive even if the user immediately closes the app.
      event.waitUntil(network.then(function () {}).catch(function () {}));
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

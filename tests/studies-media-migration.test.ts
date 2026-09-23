import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('a saved Market record gets its clearer still without discarding other downloaded lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketRecordStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateMarketRecordStill\)\.then/);

  const origin = 'https://field.test';
  const oldStill = new Request(origin + '/course-decks/market-community/en/slide-04.jpg?cached=1');
  const otherSlide = new Request(origin + '/course-decks/market-community/en/slide-05.jpg');
  const otherModule = new Request(origin + '/course-decks/food-forest/en/slide-04.jpg');
  const rows = new Map<string, Response>([
    [oldStill.url, new Response('small labels')],
    [otherSlide.url, new Response('saved')],
    [otherModule.url, new Response('saved')],
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(oldStill.url), false);
  assert.equal(rows.has(otherSlide.url), true);
  assert.equal(rows.has(otherModule.url), true);
  assert.equal(rows.has(origin + '/course-decks/market-community/en/.record-still-20260923'), true);
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(otherSlide.url), true);
});

test('a saved Food Forest layer key replaces only its old still and preserves narration', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateFoodForestLayerKeyStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateFoodForestLayerKeyStill\)\.then/);

  const origin = 'https://field.test';
  const oldStill = new Request(origin + '/course-decks/food-forest/en/slide-05.jpg?cached=1');
  const narration = new Request(origin + '/course-audio/food-forest/en/slide-05.mp3');
  const nextSlide = new Request(origin + '/course-decks/food-forest/en/slide-06.jpg');
  const otherModule = new Request(origin + '/course-decks/soil-health/en/slide-05.jpg');
  const rows = new Map<string, Response>([
    [oldStill.url, new Response('old key')],
    [narration.url, new Response('saved speech')],
    [nextSlide.url, new Response('saved')],
    [otherModule.url, new Response('saved')],
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(oldStill.url), false);
  for (const request of [narration, nextSlide, otherModule]) assert.equal(rows.has(request.url), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not silently spend a learner’s airtime');

  const replacement = new Request(origin + '/course-decks/food-forest/en/slide-05.jpg');
  rows.set(replacement.url, new Response('new key'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement.url)!.text(), 'new key');
});

test('updated Studies cannot pair old downloaded speech with corrected teaching; unrelated files survive', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateStudiesMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateStudiesMedia\)\.then/);
  const changed = [
    '/course-audio/water-harvesting/en/slide-14.mp3',
    '/course-audio/soil-health/en/slide-19.mp3',
    '/course-audio/food-forest/en/slide-15.mp3',
    '/course-audio/vegetables-staples/en/slide-13.mp3',
    '/course-audio/small-livestock/en/slide-07.mp3',
    '/course-audio/market-community/en/slide-09.mp3',
    '/course-audio/reading-landscape/en/slide-14.mp3',
    '/course-images/water-harvesting/water-harvesting-l3.jpg',
  ];
  const keep = [
    '/course-audio/seeds-sovereignty/en/slide-01.mp3',
    '/course-audio/plant-guilds/en/slide-01.mp3',
    '/course-audio/reading-landscape/en/slide-01.mp3',
    '/course-decks/plant-guilds/en/slide-01.jpg',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?cached=1', new Response('saved')]));
  const fakeCache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => fakeCache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?cached=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?cached=1'), true, path);
  rows.set(changed[0], new Response('new recording'));
  await run({ open: async () => fakeCache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'new recording', 'migration must not erase a new download on later activation');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating the app must not silently redownload lessons');
});

test('the chicken replacement updates saved speech once without discarding the rest of the livestock lesson', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateChickenForagingMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateChickenForagingMedia\)/);
  const changed = [
    '/course-audio/small-livestock/en/slide-04.mp3',
    '/course-audio/small-livestock/en/full.mp3',
    '/course-decks/small-livestock/en/slide-04.jpg',
  ];
  const keep = [
    '/course-audio/small-livestock/en/slide-05.mp3',
    '/course-decks/small-livestock/en/slide-05.jpg',
    '/course-animations/small-livestock/flow-ducks-understorey.mp4',
    '/course-audio/plant-guilds/en/slide-04.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  rows.set(changed[0], new Response('corrected narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'corrected narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'a migration must not silently spend a learner’s airtime');
});

test('the forest tour replaces old timed speech once and preserves other downloaded scenes', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateForestLayerMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateForestLayerMedia\)/);
  const changed = [
    '/course-audio/food-forest/en/slide-05.mp3',
    '/course-audio/food-forest/en/full.mp3',
    '/course-decks/food-forest/en/slide-05.jpg',
  ];
  const keep = [
    '/course-audio/food-forest/en/slide-06.mp3',
    '/course-decks/food-forest/en/slide-06.jpg',
    '/course-animations/food-forest/tour-seven-layers.mp4',
    '/course-animations/small-livestock/flow-hens-foraging.mp4',
    '/course-audio/plant-guilds/en/slide-05.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  rows.set(changed[0], new Response('timed layer narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'timed layer narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating a lesson must not silently spend a learner’s airtime');
});

test('the soil tour replaces old timed speech once and preserves other downloaded scenes', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilObservationMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSoilObservationMedia\)/);
  const changed = [
    '/course-audio/soil-health/en/slide-05.mp3',
    '/course-audio/soil-health/en/full.mp3',
    '/course-decks/soil-health/en/slide-05.jpg',
  ];
  const keep = [
    '/course-audio/soil-health/en/slide-06.mp3',
    '/course-decks/soil-health/en/slide-06.jpg',
    '/course-animations/soil-health/tour-soil-observation.mp4',
    '/course-animations/small-livestock/flow-hens-foraging.mp4',
    '/course-audio/plant-guilds/en/slide-05.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  rows.set(changed[0], new Response('timed layer narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'timed layer narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating a lesson must not silently spend a learner’s airtime');
});

test('the young-forest tour refreshes its speech and still once without erasing other downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateForestEstablishmentMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateForestEstablishmentMedia\)/);
  const changed = [
    '/course-audio/food-forest/en/slide-15.mp3',
    '/course-audio/food-forest/en/full.mp3',
    '/course-decks/food-forest/en/slide-15.jpg',
  ];
  const keep = [
    '/course-audio/food-forest/en/slide-05.mp3',
    '/course-decks/food-forest/en/slide-05.jpg',
    '/course-animations/food-forest/tour-young-forest.mp4',
    '/course-animations/soil-health/tour-soil-observation.mp4',
    '/course-animations/small-livestock/flow-hens-foraging.mp4',
    '/course-audio/plant-guilds/en/slide-05.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  rows.set(changed[0], new Response('matching young-forest narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'matching young-forest narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating a lesson must not silently spend a learner’s airtime');
});

test('the windbreak refreshes its speech and still once without erasing other downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWindbreakMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWindbreakMedia\)/);
  const changed = [
    '/course-audio/intro-permaculture/en/slide-19.mp3',
    '/course-audio/intro-permaculture/en/full.mp3',
    '/course-decks/intro-permaculture/en/slide-19.jpg',
  ];
  const keep = [
    '/course-audio/food-forest/en/slide-05.mp3',
    '/course-decks/food-forest/en/slide-05.jpg',
    '/course-audio/intro-permaculture/en/slide-18.mp3',
    '/course-animations/intro-permaculture/motion-windbreak.mp4',
    '/course-animations/soil-health/tour-soil-observation.mp4',
    '/course-animations/small-livestock/flow-hens-foraging.mp4',
    '/course-audio/plant-guilds/en/slide-05.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  rows.set(changed[0], new Response('matching windbreak narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0])!.text(), 'matching windbreak narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'updating a lesson must not silently spend a learner’s airtime');
});

test('the food forest mulch still replaces only the superseded infographic once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateForestMulchInfographic\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateForestMulchInfographic\)/);
  const changed = '/course-images/food-forest/food-forest-l3.jpg';
  const replacement = '/course-images/food-forest/food-forest-l3-mulch-layer-corrected.jpg';
  const keep = '/course-images/food-forest/food-forest-l2.jpg';
  const rows = new Map([changed, replacement, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(changed + '?saved=1'), false);
  assert.equal(rows.has(replacement + '?saved=1'), true);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-images/food-forest/.mulch-layer-correction-20260922'), true);
  rows.set(changed + '?saved=1', new Response('new old-path download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed + '?saved=1')!.text(), 'new old-path download');
});

test('the food forest Flow close-up retires the incomplete movie and unapproved composite without disturbing other downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateForestSheetMulchingMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateForestSheetMulchingMedia\)/);
  const changed = [
    '/course-animations/food-forest/flow-sheet-mulching.mp4',
    '/course-animations/food-forest/posters/flow-sheet-mulching.jpg',
    '/course-animations/food-forest/sheet-mulching-layer-order.mp4',
    '/course-animations/food-forest/posters/sheet-mulching-layer-order.jpg',
  ];
  const replacement = [
    '/course-animations/food-forest/flow-sheet-mulching-closeup.mp4',
    '/course-animations/food-forest/posters/flow-sheet-mulching-closeup.jpg',
  ];
  const keep = '/course-animations/food-forest/tour-young-forest.mp4';
  const rows = new Map([...changed, ...replacement, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of replacement) assert.equal(rows.has(path + '?saved=1'), true, path);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-animations/food-forest/.flow-sheet-mulching-closeup-20260922'), true);
  rows.set(changed[0] + '?saved=1', new Response('new old-path download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=1')!.text(), 'new old-path download');
  assert.doesNotMatch(body, /\bfetch\(/, 'a migration must not silently spend a learner’s airtime');
});

test('vegetable lesson 1 retires only the unfinished planting movie while preserving other saved media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetableChoiceMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetableChoiceMedia\)/);
  const old = [
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-animations/vegetables-staples/posters/flow-seed-or-seedling.jpg',
  ];
  const replacement = [
    '/course-animations/vegetables-staples/seed-or-seedling-choice.mp4',
    '/course-animations/vegetables-staples/posters/seed-or-seedling-choice.jpg',
  ];
  const keep = '/course-audio/vegetables-staples/en/slide-06.mp3';
  const rows = new Map([...old, ...replacement, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of old) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of replacement) assert.equal(rows.has(path + '?saved=1'), true, path);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-animations/vegetables-staples/.seed-or-seedling-choice-20260922'), true);
  rows.set(old[0] + '?saved=1', new Response('new old-path download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(old[0] + '?saved=1')!.text(), 'new old-path download');
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not use a learner’s airtime');
});

test('unapproved code-drawn lesson animations leave saved packs without disturbing reviewed media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateUnapprovedStudyAnimations\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateUnapprovedStudyAnimations\)/);
  const changed = [
    '/course-animations/plant-guilds/thin-selected-support.mp4',
    '/course-animations/plant-guilds/posters/thin-selected-support.jpg',
    '/course-animations/vegetables-staples/seed-or-seedling-choice.mp4',
    '/course-animations/vegetables-staples/posters/seed-or-seedling-choice.jpg',
    '/course-animations/vegetables-staples/pest-decision-path.mp4',
    '/course-animations/vegetables-staples/posters/pest-decision-path.jpg',
  ];
  const keep = '/course-animations/food-forest/flow-sheet-mulching-closeup.mp4';
  const rows = new Map([...changed, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-animations/.unapproved-code-drawn-retired-20260922'), true);
  rows.set(changed[0] + '?saved=1', new Response('new unapproved preview asset'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=1')!.text(), 'new unapproved preview asset');
  assert.doesNotMatch(body, /\bfetch\(/, 'retirement must not spend a learner’s airtime');
});

test('every held authored study clip and poster leaves saved packs while reviewed footage stays', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateHeldAuthoredStudyAnimations\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateHeldAuthoredStudyAnimations\)/);
  const changed = [...body.matchAll(/'(\/course-animations\/[^']+\.(?:mp4|jpg))'/g)]
    .map(match => match[1]);
  assert.equal(changed.length, 56, 'all 28 held movies and posters must be retired');
  const keep = [
    '/course-animations/food-forest/flow-sheet-mulching-closeup.mp4',
    '/course-animations/small-livestock/hens-pecking-pexels-5563939.mp4',
    '/course-animations/small-livestock/flow-ducks-understorey.mp4',
    '/course-animations/small-livestock/flow-bee-between-blossoms.mp4',
    '/course-animations/soil-health/flow-build-compost-heap.mp4',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  assert.equal(rows.has('/course-animations/.held-authored-media-retired-20260922'), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'retirement must not spend a learner’s airtime');
});

test('water swale clips held for review remove every cached URL variant and preserve other downloads', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateHeldWaterSwaleMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateHeldWaterSwaleMedia\)/);
  const changed = [
    '/course-animations/water-harvesting/watch-04-swale-infiltration.mp4',
    '/course-animations/water-harvesting/posters/watch-04-swale-infiltration.jpg',
    '/course-animations/water-harvesting/watch-07-swale-overflow-pond.mp4',
    '/course-animations/water-harvesting/posters/watch-07-swale-overflow-pond.jpg',
  ];
  const keep = [
    '/course-animations/water-harvesting/flow-roof-rain.mp4',
    '/course-audio/water-harvesting/en/slide-04.mp3',
  ];
  const rows = new Map([
    ...changed.flatMap(path => [`${path}?saved=1`, `${path}?v=2`]),
    ...keep.map(path => `${path}?saved=1`),
  ].map(path => [path, new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) {
    assert.equal(rows.has(`${path}?saved=1`), false, `${path} saved variant`);
    assert.equal(rows.has(`${path}?v=2`), false, `${path} version variant`);
  }
  for (const path of keep) assert.equal(rows.has(`${path}?saved=1`), true, path);
  assert.equal(rows.has('/course-animations/water-harvesting/.swale-clips-held-20260923'), true);
  rows.set(`${changed[0]}?fresh=1`, new Response('new download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(`${changed[0]}?fresh=1`)!.text(), 'new download');
  assert.doesNotMatch(body, /\bfetch\(/, 'retirement must not spend a learner’s airtime');
});

test('the bee hive and blossom clip retires only the old slide 9 movie and poster once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateBeeHiveAndBlossomMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateBeeHiveAndBlossomMedia\)/);
  const changed = [
    '/course-animations/small-livestock/watch-09-bee-pollination.mp4',
    '/course-animations/small-livestock/posters/watch-09-bee-pollination.jpg',
  ];
  const replacement = [
    '/course-animations/small-livestock/bee-hive-and-blossom.mp4',
    '/course-animations/small-livestock/posters/bee-hive-and-blossom.jpg',
  ];
  const keep = '/course-animations/small-livestock/watch-14-nutrient-loop.mp4';
  const rows = new Map([...changed, ...replacement, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  for (const path of replacement) assert.equal(rows.has(path + '?saved=1'), true, path);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-animations/small-livestock/.bee-hive-and-blossom-20260922'), true);
  rows.set(changed[0] + '?saved=1', new Response('new old-path download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=1')!.text(), 'new old-path download');
});

test('a saved greywater diagram with older source labels is retired without clearing other water lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateGreywaterTeachingMedia\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateGreywaterTeachingMedia\)/);
  const changed = [
    '/course-animations/water-harvesting/watch-21-greywater-mulch.mp4',
    '/course-animations/water-harvesting/posters/watch-21-greywater-mulch.jpg',
  ];
  const keep = '/course-animations/water-harvesting/watch-16-first-flush-tank.mp4';
  const rows = new Map([...changed, keep].map(path => [path + '?saved=1', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=1'), false, path);
  assert.equal(rows.has(keep + '?saved=1'), true);
  assert.equal(rows.has('/course-animations/water-harvesting/.greywater-labels-20260922'), true);
  rows.set(changed[0] + '?saved=1', new Response('new lesson download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=1')!.text(), 'new lesson download');
});

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

test('a saved Food Forest L3 still is replaced only when the learner downloads the clearer layout', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateFoodForestL3AdjustStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateFoodForestL3AdjustStill\)\.then/);

  const oldStill = '/course-decks/food-forest/en/slide-17.jpg';
  const otherStill = '/course-decks/food-forest/en/slide-16.jpg';
  const audio = '/course-audio/food-forest/en/slide-17.mp3';
  const rows = new Map([
    [`${oldStill}?saved=1`, new Response('small text')],
    [`${oldStill}?v=old`, new Response('small text variant')],
    [`${otherStill}?saved=1`, new Response('saved still')],
    [`${audio}?saved=1`, new Response('saved narration')],
  ]);
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request(`https://example.com${path}`)),
    delete: async (request: Request) => {
      const url = new URL(request.url);
      return rows.delete(url.pathname + url.search);
    },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(`${oldStill}?saved=1`), false);
  assert.equal(rows.has(`${oldStill}?v=old`), false);
  assert.equal(rows.has(`${otherStill}?saved=1`), true);
  assert.equal(rows.has(`${audio}?saved=1`), true);
  assert.equal(rows.has('/course-decks/food-forest/en/.adjust-trees-still-20260923'), true);
  rows.set(`${oldStill}?saved=1`, new Response('replacement downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(`${oldStill}?saved=1`)!.text(), 'replacement downloaded later');
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not spend a learner’s airtime');
});

test('a saved Food Forest climate comparison clears only slide 10 and leaves its lesson pack intact', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateFoodForestClimateMatchStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateFoodForestClimateMatchStill\)\.then/);

  const origin = 'https://field.test';
  const oldStill = new Request(origin + '/course-decks/food-forest/en/slide-10.jpg?cached=1');
  const firstPreviewMarker = new Request(origin + '/course-decks/food-forest/en/.climate-match-still-20260923');
  const narration = new Request(origin + '/course-audio/food-forest/en/slide-10.mp3');
  const anotherStill = new Request(origin + '/course-decks/food-forest/en/slide-11.jpg');
  const otherModule = new Request(origin + '/course-decks/market-community/en/slide-10.jpg');
  const rows = new Map<string, Response>([
    [oldStill.url, new Response('old climate diagram')],
    [firstPreviewMarker.url, new Response('first preview candidate already migrated')],
    [narration.url, new Response('saved narration')],
    [anotherStill.url, new Response('saved next slide')],
    [otherModule.url, new Response('saved other module')],
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
  for (const request of [narration, anotherStill, otherModule]) assert.equal(rows.has(request.url), true);
  assert.equal(rows.has(origin + '/course-decks/food-forest/en/.climate-match-still-20260923-v2'), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'the migration must not silently spend learner airtime');

  const replacement = new Request(origin + '/course-decks/food-forest/en/slide-10.jpg');
  rows.set(replacement.url, new Response('new comparison'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement.url)!.text(), 'new comparison');
});

test('a saved Market community network gets the phone-readable still without clearing seed-sharing media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketCommunityNetworkStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateMarketCommunityNetworkStill\)\.then/);

  const origin = 'https://field.test';
  const oldStill = new Request(origin + '/course-decks/market-community/en/slide-14.jpg?cached=1');
  const narration = new Request(origin + '/course-audio/market-community/en/slide-14.mp3');
  const seedFilm = new Request(origin + '/course-animations/market-community/flow-seed-sharing.mp4');
  const nextSlide = new Request(origin + '/course-decks/market-community/en/slide-15.jpg');
  const rows = new Map<string, Response>([
    [oldStill.url, new Response('small network labels')],
    [narration.url, new Response('saved speech')],
    [seedFilm.url, new Response('saved seed handover')],
    [nextSlide.url, new Response('saved next still')],
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
  for (const request of [narration, seedFilm, nextSlide]) assert.equal(rows.has(request.url), true);
  assert.equal(rows.has(origin + '/course-decks/market-community/en/.community-network-still-20260923'), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not silently redownload the still');

  const replacement = new Request(origin + '/course-decks/market-community/en/slide-14.jpg');
  rows.set(replacement.url, new Response('new network still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement.url)!.text(), 'new network still');
});

test('a saved Small Livestock slide 8 clears only its English still once and preserves the downloaded lesson', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSmallLivestockSlide8Still\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSmallLivestockSlide8Still\)\.then/);

  const changed = '/course-decks/small-livestock/en/slide-08.jpg';
  const audio = '/course-audio/small-livestock/en/slide-08.mp3';
  const otherSlide = '/course-decks/small-livestock/en/slide-09.jpg';
  const otherLanguage = '/course-decks/small-livestock/zu/slide-08.jpg';
  const otherLesson = '/course-decks/food-forest/en/slide-08.jpg';
  const rows = new Map([
    [changed, new Response('old still')],
    [changed + '?saved=1', new Response('old still query variant')],
    [audio, new Response('saved English narration')],
    [otherSlide, new Response('saved neighboring still')],
    [otherLanguage, new Response('saved isiZulu still')],
    [otherLesson, new Response('saved other lesson still')],
  ]);
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => {
      const url = new URL(request.url);
      return rows.delete(url.pathname + url.search);
    },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(changed), false);
  assert.equal(rows.has(changed + '?saved=1'), false);
  for (const path of [audio, otherSlide, otherLanguage, otherLesson]) assert.equal(rows.has(path), true, path);
  assert.equal(rows.has('/course-decks/small-livestock/en/.slide08-still-20260923'), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'the migration must not silently spend learner airtime');

  rows.set(changed, new Response('replacement downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed)!.text(), 'replacement downloaded later');
});

test('a saved Market route diagram replaces only slide 9 and preserves the rest of the lesson', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketL2RouteStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateMarketL2RouteStill\)\.then/);

  const origin = 'https://field.test';
  const oldStill = new Request(origin + '/course-decks/market-community/en/slide-09.jpg?cached=1');
  const narration = new Request(origin + '/course-audio/market-community/en/slide-09.mp3');
  const nextSlide = new Request(origin + '/course-decks/market-community/en/slide-10.jpg');
  const otherLesson = new Request(origin + '/course-decks/market-community/en/slide-04.jpg');
  const rows = new Map<string, Response>([
    [oldStill.url, new Response('tiny route labels')],
    [narration.url, new Response('saved speech')],
    [nextSlide.url, new Response('saved')],
    [otherLesson.url, new Response('saved')],
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
  for (const request of [narration, nextSlide, otherLesson]) assert.equal(rows.has(request.url), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not silently redownload the still');

  const replacement = new Request(origin + '/course-decks/market-community/en/slide-09.jpg');
  rows.set(replacement.url, new Response('readable route diagram'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement.url)!.text(), 'readable route diagram');
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

test('a saved Introduction L1 pack retires only the five superseded English water-use assets once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateIntroL1WaterUseTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateIntroL1WaterUseTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/intro-permaculture/en/slide-07.jpg',
    '/course-decks/intro-permaculture/en/slide-08.jpg',
    '/course-audio/intro-permaculture/en/slide-07.mp3',
    '/course-audio/intro-permaculture/en/slide-08.mp3',
    '/course-audio/intro-permaculture/en/full.mp3',
  ];
  const preserved = [
    '/course-decks/intro-permaculture/en/slide-06.jpg',
    '/course-decks/intro-permaculture/en/slide-09.jpg',
    '/course-decks/intro-permaculture/zu/slide-07.jpg',
    '/course-audio/intro-permaculture/zu/slide-07.mp3',
    '/course-decks/food-forest/en/slide-07.jpg',
    '/course-audio/food-forest/en/slide-07.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=1', origin).href,
    new URL(path + '?v=2', origin).href,
  ]);
  const preservedUrls = preserved.map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded English teaching media')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved media')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/intro-permaculture/en/.l1-water-use-20260923';
  assert.equal(rows.has(marker), true);

  // A later download is left alone after the one-time migration marker is present.
  const laterDownload = new URL(changed[0] + '?saved=again', origin).href;
  rows.set(laterDownload, new Response('new learner-selected download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'new learner-selected download');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'cache migration must not download replacement media or spend airtime');
});

test('a saved Small Livestock L3 pack drops the closed-circle pictures and old speech without clearing other lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSmallLivestockL3NutrientFlow\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSmallLivestockL3NutrientFlow\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/small-livestock/en/slide-14.jpg',
    '/course-decks/small-livestock/en/slide-15.jpg',
    '/course-images/small-livestock/small-livestock-l3.jpg',
    '/course-audio/small-livestock/en/slide-14.mp3',
    '/course-audio/small-livestock/en/slide-15.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ];
  const keep = [
    '/course-decks/small-livestock/en/slide-13.jpg',
    '/course-decks/small-livestock/en/slide-16.jpg',
    '/course-audio/small-livestock/en/slide-13.mp3',
    '/course-decks/small-livestock/zu/slide-14.jpg',
    '/course-audio/small-livestock/zu/slide-14.mp3',
    '/course-audio/intro-permaculture/en/full.mp3',
  ];
  const oldUrls = changed.map(path => new URL(path + '?saved=old', origin).href);
  const keepUrls = keep.map(path => new URL(path + '?saved=old', origin).href);
  const rows = new Map<string, Response>([
    ...oldUrls.map(url => [url, new Response('old loop')] as const),
    ...keepUrls.map(url => [url, new Response('saved lesson')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of oldUrls) assert.equal(rows.has(url), false, url);
  for (const url of keepUrls) assert.equal(rows.has(url), true, url);
  assert.equal(rows.has(origin + '/course-decks/small-livestock/en/.l3-nutrient-flow-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend the learner’s airtime');
});

test('a saved Introduction L2 pack retires old teaching media while keeping other lessons and isiZulu', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateIntroL2PrinciplesTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateIntroL2PrinciplesTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    ...[11, 12, 13, 14].map(n => `/course-decks/intro-permaculture/en/slide-${String(n).padStart(2, '0')}.jpg`),
    ...[9, 10, 11, 12, 13, 14].map(n => `/course-audio/intro-permaculture/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/intro-permaculture/en/full.mp3',
  ];
  const keep = [
    '/course-decks/intro-permaculture/en/slide-10.jpg',
    '/course-decks/intro-permaculture/en/slide-15.jpg',
    '/course-audio/intro-permaculture/en/slide-08.mp3',
    '/course-decks/intro-permaculture/zu/slide-13.jpg',
    '/course-audio/intro-permaculture/zu/slide-13.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/intro-permaculture/en/.l2-principles-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected media'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected media');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved Introduction L3 pack retires unsupported wind teaching without clearing other lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateIntroL3ZonesAndSectorsTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateIntroL3ZonesAndSectorsTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    ...[17, 18, 19].map(n => `/course-decks/intro-permaculture/en/slide-${String(n).padStart(2, '0')}.jpg`),
    ...[15, 16, 17, 18].map(n => `/course-audio/intro-permaculture/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/intro-permaculture/en/full.mp3',
  ];
  const keep = [
    '/course-decks/intro-permaculture/en/slide-15.jpg',
    '/course-decks/intro-permaculture/en/slide-16.jpg',
    '/course-audio/intro-permaculture/en/slide-19.mp3',
    '/course-decks/intro-permaculture/zu/slide-18.jpg',
    '/course-audio/intro-permaculture/zu/slide-18.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/intro-permaculture/en/.l3-zones-sectors-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected media'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected media');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved landscape L1 pack retires unsafe water teaching without removing its A-frame film or other lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateLandscapeL1WaterObservationTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateLandscapeL1WaterObservationTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/reading-landscape/en/slide-04.jpg',
    '/course-decks/reading-landscape/en/slide-07.jpg',
    ...[4, 6, 7, 20, 21].map(n => `/course-audio/reading-landscape/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/reading-landscape/en/full.mp3',
  ];
  const keep = [
    '/course-decks/reading-landscape/en/slide-05.jpg',
    '/course-decks/reading-landscape/en/slide-06.jpg',
    '/course-audio/reading-landscape/en/slide-05.mp3',
    '/course-decks/reading-landscape/zu/slide-04.jpg',
    '/course-audio/reading-landscape/zu/slide-04.mp3',
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-audio/intro-permaculture/en/full.mp3',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/reading-landscape/en/.l1-water-observation-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved landscape L2 pack retires old frost advice without clearing its other lessons or isiZulu media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateLandscapeL2SunAndFrostTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateLandscapeL2SunAndFrostTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/reading-landscape/en/slide-11.jpg',
    ...[8, 10, 11].map(n => `/course-audio/reading-landscape/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/reading-landscape/en/full.mp3',
  ];
  const keep = [
    '/course-decks/reading-landscape/en/slide-08.jpg',
    '/course-decks/reading-landscape/en/slide-09.jpg',
    '/course-decks/reading-landscape/en/slide-10.jpg',
    '/course-audio/reading-landscape/en/slide-09.mp3',
    '/course-decks/reading-landscape/en/slide-04.jpg',
    '/course-decks/reading-landscape/zu/slide-11.jpg',
    '/course-audio/reading-landscape/zu/slide-11.mp3',
    '/course-animations/reading-landscape/flow-a-frame.mp4',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/reading-landscape/en/.l2-sun-frost-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved landscape L3 pack retires wind and blight advice without clearing nearby English and isiZulu lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateLandscapeL3WindAndFrostTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateLandscapeL3WindAndFrostTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [
    ...[13, 14, 15].map(n => `/course-decks/reading-landscape/en/slide-${String(n).padStart(2, '0')}.jpg`),
    ...[12, 13, 14, 15].map(n => `/course-audio/reading-landscape/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/reading-landscape/en/full.mp3',
  ];
  const keep = [
    '/course-decks/reading-landscape/en/slide-12.jpg',
    '/course-decks/reading-landscape/en/slide-11.jpg',
    '/course-audio/reading-landscape/en/slide-11.mp3',
    '/course-decks/reading-landscape/en/slide-16.jpg',
    '/course-decks/reading-landscape/zu/slide-15.jpg',
    '/course-audio/reading-landscape/zu/slide-15.mp3',
    '/course-animations/reading-landscape/flow-a-frame.mp4',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/reading-landscape/en/.l3-wind-frost-20260923'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved water L1 pack retires old swale advice while keeping neighboring English and isiZulu lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterL1SwaleTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterL1SwaleTeaching\)\.then/);

  const origin = 'https://field.test';
  const changed = [2, 3, 4, 5, 7];
  const obsolete = [
    ...changed.map(n => `/course-decks/water-harvesting/en/slide-${String(n).padStart(2, '0')}.jpg`),
    ...changed.map(n => `/course-audio/water-harvesting/en/slide-${String(n).padStart(2, '0')}.mp3`),
    '/course-audio/water-harvesting/en/full.mp3',
  ];
  const keep = [
    '/course-decks/water-harvesting/en/slide-06.jpg',
    '/course-audio/water-harvesting/en/slide-06.mp3',
    '/course-decks/water-harvesting/en/slide-08.jpg',
    '/course-decks/water-harvesting/zu/slide-07.jpg',
    '/course-audio/water-harvesting/zu/slide-07.mp3',
    '/course-decks/reading-landscape/en/slide-13.jpg',
  ];
  const rows = new Map<string, Response>([
    ...obsolete.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/water-harvesting/en/.l1-swale-20260923'), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved water L2 pack drops catchment-only dam sizing media without clearing other water lessons', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterL2DamSizingTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterL2DamSizingTeaching\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-decks/water-harvesting/en/slide-12.jpg',
    '/course-audio/water-harvesting/en/slide-12.mp3',
    '/course-audio/water-harvesting/en/full.mp3',
  ];
  const keep = [
    '/course-decks/water-harvesting/en/slide-11.jpg',
    '/course-audio/water-harvesting/en/slide-11.mp3',
    '/course-decks/water-harvesting/en/slide-03.jpg',
    '/course-audio/water-harvesting/en/slide-03.mp3',
    '/course-decks/water-harvesting/zu/slide-12.jpg',
    '/course-audio/water-harvesting/zu/slide-12.mp3',
  ];
  const rows = new Map<string, Response>([
    ...obsolete.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/water-harvesting/en/.l2-dam-sizing-20260923'), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved water L3 pack refreshes roof-suitability speech without deleting stills or isiZulu', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterL3RoofSuitabilityTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterL3RoofSuitabilityTeaching\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-audio/water-harvesting/en/slide-14.mp3',
    '/course-audio/water-harvesting/en/full.mp3',
  ];
  const keep = [
    '/course-decks/water-harvesting/en/slide-14.jpg',
    '/course-audio/water-harvesting/en/slide-15.mp3',
    '/course-audio/water-harvesting/zu/slide-14.mp3',
    '/course-audio/soil-health/en/slide-14.mp3',
  ];
  const rows = new Map<string, Response>([
    ...obsolete.map(path => [new URL(path + '?saved=old', origin).href, new Response('old speech')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  const marker = origin + '/course-audio/water-harvesting/en/.l3-roof-suitability-20260923';
  assert.equal(rows.has(marker), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected speech'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected speech');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved bee lesson replaces misleading English speech and range still without losing neighboring media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSmallLivestockL2BeeTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSmallLivestockL2BeeTeaching\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-decks/small-livestock/en/slide-11.jpg',
    '/course-audio/small-livestock/en/slide-09.mp3',
    '/course-audio/small-livestock/en/slide-11.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ];
  const keep = [
    '/course-animations/small-livestock/flow-bee-between-blossoms.mp4',
    '/course-decks/small-livestock/en/slide-10.jpg',
    '/course-audio/small-livestock/en/slide-10.mp3',
    '/course-decks/small-livestock/zu/slide-11.jpg',
    '/course-audio/small-livestock/zu/slide-11.mp3',
  ];
  const rows = new Map<string, Response>([
    ...obsolete.map(path => [new URL(path + '?saved=old', origin).href, new Response('old teaching')] as const),
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), false, path);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  const marker = origin + '/course-decks/small-livestock/en/.l2-bee-teaching-20260923';
  assert.equal(rows.has(marker), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved Vegetables L4 still is replaced once without clearing audio or neighboring lesson media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL4DecisionStill\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetablesL4DecisionStill\)/);

  const changed = '/course-decks/vegetables-staples/en/slide-16.jpg';
  const keep = [
    '/course-audio/vegetables-staples/en/slide-16.mp3',
    '/course-decks/vegetables-staples/en/slide-15.jpg',
    '/course-decks/vegetables-staples/en/slide-17.jpg',
    '/course-decks/vegetables-staples/zu/slide-16.jpg',
    '/course-decks/soil-health/en/slide-16.jpg',
  ];
  const rows = new Map<string, Response>([
    [changed, new Response('old english still without query')],
    [changed + '?saved=1', new Response('old english still')],
    [changed + '?width=269', new Response('old thumbnail variant')],
    ...keep.map(path => [path + '?saved=1', new Response('preserved')] as const),
  ]);
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(path => new Request('https://example.com' + path)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(changed), false);
  assert.equal(rows.has(changed + '?saved=1'), false);
  assert.equal(rows.has(changed + '?width=269'), false);
  for (const path of keep) assert.equal(rows.has(path + '?saved=1'), true, path);
  assert.equal(rows.has('/course-decks/vegetables-staples/en/.l4-slide16-decision-still-20260923'), true);
  assert.doesNotMatch(body, /\bfetch\(/, 'the migration must let the learner choose when to download the replacement');

  rows.set(changed + '?saved=1', new Response('replacement still downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed + '?saved=1')!.text(), 'replacement still downloaded later');
});

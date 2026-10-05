import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

function assertActivationOrder(source: string, previous: string, migration: string, reason: string) {
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const previousIndex = migrations.indexOf(previous);
  const migrationIndex = migrations.indexOf(migration);
  assert.equal(migrations.filter(name => name === previous).length, 1, `${previous} runs once`);
  assert.equal(migrations.filter(name => name === migration).length, 1, `${migration} runs once`);
  // 5 October 2026: later course migrations may be inserted between these steps;
  // their required relative order and single execution matter, not adjacency.
  assert.ok(previousIndex >= 0 && migrationIndex > previousIndex, reason);
}

test('the nine updated Study stills refresh once without evicting other slides or narration', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateStudyOutcomesResidualStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateReadingLandscapeFrostBodySyncStills\)\.then\(migrateReadingLandscapeFirstObservationStills\)\.then\(migrateStudyOutcomesResidualStills\)\.then/,
    'the newer Reading observation migration stays ahead of the existing Study cleanup');

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/intro-permaculture/ve/slide-22.webp',
    '/course-decks/intro-permaculture/ts/slide-22.webp',
    '/course-decks/vegetables-staples/st/slide-03.webp',
    '/course-decks/vegetables-staples/ve/slide-03.webp',
    '/course-decks/vegetables-staples/ts/slide-03.webp',
    '/course-decks/market-community/st/slide-15.webp',
    '/course-decks/market-community/ts/slide-15.webp',
    '/course-decks/reading-landscape/ve/slide-14.webp',
    '/course-decks/reading-landscape/ts/slide-14.webp',
  ];
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserve = [
    '/course-decks/intro-permaculture/st/slide-22.webp',
    '/course-decks/intro-permaculture/en/slide-22.jpg',
    '/course-decks/intro-permaculture/zu/slide-22.jpg',
    '/course-audio/intro-permaculture/st/slide-22.mp3',
    '/course-audio/intro-permaculture/en/slide-22.mp3',
    '/course-animations/market-community/market-morning.mp4',
    '/course-decks/reading-landscape/ts/slide-13.webp',
    '/course-decks/vegetables-staples/en/slide-03.jpg',
  ];
  const rows = new Map<string, Response>([
    ...stale.map(path => [new URL(path, origin).href, new Response(`stale:${path}`)] as const),
    ...preserve.map(path => [new URL(`${path}?saved=1`, origin).href, new Response(`preserve:${path}`)] as const),
  ]);
  let deleteCount = 0;
  let writeCount = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deleteCount++; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { writeCount++; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of stale) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserve) {
    assert.equal(await rows.get(new URL(`${path}?saved=1`, origin).href)!.text(), `preserve:${path}`, path);
  }
  assert.equal(deleteCount, stale.length, 'only variants of the nine changed stills are retired');
  const marker = '/course-decks/.study-outcomes-residual-stills-20261005';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.equal(writeCount, 1, 'one marker records the once-only refresh');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'the refresh does not fetch media or spend learner airtime');

  const replacement = new URL(`${changed[0]}?saved=new`, origin).href;
  rows.set(replacement, new Response('learner-selected replacement'));
  const deletesAfterFirstRun = deleteCount;
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'learner-selected replacement');
  assert.equal(deleteCount, deletesAfterFirstRun, 'later activations preserve the learner-selected replacement');
  assert.equal(writeCount, 1);
});

test('updated Vegetables lesson frames retire stale saved wording without deleting narration or other decks', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesOrdinaryLessonStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateIntroRegionalSubstantiveStills\)\.then\(migrateVegetablesOrdinaryLessonStills\)\.then/);
  const origin = 'https://field.test';
  const changed = ['st/16', 've/16', 'ts/04', 'ts/06', 'ts/10', 'ts/11', 'ts/15', 'ts/16']
    .map(part => { const [language, slide] = part.split('/'); return `/course-decks/vegetables-staples/${language}/slide-${slide}.webp`; });
  const old = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]).map(path => origin + path);
  const keep = [
    '/course-decks/vegetables-staples/ts/slide-05.webp?cached=1',
    '/course-decks/vegetables-staples/ve/slide-04.webp',
    '/course-decks/vegetables-staples/en/slide-16.jpg',
    '/course-decks/vegetables-staples/zu/slide-16.jpg',
    '/course-audio/vegetables-staples/en/slide-16.mp3',
    '/course-audio/intro-permaculture/st/slide-16.mp3',
    '/course-decks/market-community/ts/slide-16.webp',
  ].map(path => origin + path);
  const rows = new Map([...old, ...keep].map(url => [url, new Response(url)]));
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { writes++; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const url of old) assert.equal(rows.has(url), false, url);
  for (const url of keep) assert.equal(await rows.get(url)!.text(), url, url);
  const replacement = origin + changed[0];
  rows.set(replacement, new Response('learner-selected replacement'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'learner-selected replacement');
  assert.equal(writes, 1, 'later activation keeps replacement downloads');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'refresh does not spend learner data on media');
});

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

test('Market Community L3 narration migration refreshes only corrected English audio', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketCommunityL3SeedRightsTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateMarketCommunityL3SeedRightsTeaching\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-audio/market-community/en/slide-15.mp3',
    '/course-audio/market-community/en/slide-20.mp3',
    '/course-audio/market-community/en/full.mp3',
  ];
  const keep = [
    '/course-animations/market-community/flow-seed-sharing.mp4',
    '/course-decks/market-community/en/slide-15.jpg',
    '/course-decks/market-community/en/slide-20.jpg',
    '/course-decks/market-community/en/slide-14.jpg',
    '/course-decks/market-community/zu/slide-15.jpg',
    '/course-audio/market-community/zu/full.mp3',
    '/course-decks/food-forest/en/slide-15.jpg',
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
  assert.equal(rows.has(origin + '/course-decks/market-community/en/.l3-seed-rights-20260923'), true);

  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected audio'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected audio');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('Market Community L3 slide 20 card migration runs after the earlier audio marker', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketCommunityL3SeedRightsCard\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateMarketCommunityL3SeedRightsCard\)\.then/);

  const origin = 'https://field.test';
  const obsolete = '/course-decks/market-community/en/slide-20.jpg';
  const keep = [
    '/course-audio/market-community/en/slide-15.mp3',
    '/course-audio/market-community/en/slide-20.mp3',
    '/course-audio/market-community/en/full.mp3',
    '/course-decks/market-community/en/slide-15.jpg',
    '/course-animations/market-community/flow-seed-sharing.mp4',
    '/course-decks/market-community/zu/slide-20.jpg',
    '/course-decks/food-forest/en/slide-20.jpg',
  ];
  const rows = new Map<string, Response>([
    [new URL(obsolete + '?saved=old', origin).href, new Response('old card')],
    ...keep.map(path => [new URL(path + '?saved=old', origin).href, new Response('keep')] as const),
    [origin + '/course-decks/market-community/en/.l3-seed-rights-20260923', new Response('Earlier audio migration already ran')],
  ]);
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(rows.has(new URL(obsolete + '?saved=old', origin).href), false);
  for (const path of keep) assert.equal(rows.has(new URL(path + '?saved=old', origin).href), true, path);
  assert.equal(rows.has(origin + '/course-decks/market-community/en/.l3-seed-rights-20260923'), true);
  assert.equal(rows.has(origin + '/course-decks/market-community/en/.l3-seed-rights-card-20260923'), true);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
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

test('corrected Soil Health L3 narration clears only the superseded English clips', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilHealthL3CorrectedNarration\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSoilHealthL3CorrectedNarration\)/);
  const changed = [
    '/course-audio/soil-health/en/full.mp3',
    '/course-audio/soil-health/en/slide-14.mp3',
    '/course-audio/soil-health/en/slide-17.mp3',
    '/course-audio/soil-health/en/slide-18.mp3',
  ];
  const keep = [
    '/course-audio/soil-health/en/slide-13.mp3',
    '/course-audio/soil-health/en/slide-16.mp3',
    '/course-audio/soil-health/zu/slide-17.mp3',
    '/course-decks/soil-health/zu/slide-11.jpg',
    '/course-animations/soil-health/flow-compost-materials.mp4',
    '/course-audio/food-forest/en/slide-17.mp3',
  ];
  const rows = new Map([...changed, ...keep].map(path => [path + '?saved=old', new Response('saved')]));
  const cache = {
    match: async (key: string) => rows.get(key),
    keys: async () => [...rows.keys()].map(key => new Request('https://example.com' + key)),
    delete: async (request: Request) => { const url = new URL(request.url); return rows.delete(url.pathname + url.search); },
    put: async (key: string, response: Response) => { rows.set(key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of changed) assert.equal(rows.has(path + '?saved=old'), false, path);
  for (const path of keep) assert.equal(rows.has(path + '?saved=old'), true, path);
  rows.set(changed[0] + '?saved=new', new Response('new corrected narration'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=new')!.text(), 'new corrected narration');
  assert.doesNotMatch(body, /\bfetch\(/, 'migration must not spend learner airtime');
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

test('saved Water L4 English lesson retires obsolete safety cards and narration once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterL4DecisionOnly\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterL4DecisionOnly\)/);
  const changed = [19, 20, 21, 22].flatMap(slide => [
    `/course-decks/water-harvesting/en/slide-${slide}.jpg`,
    `/course-audio/water-harvesting/en/slide-${slide}.mp3`,
  ]).concat('/course-audio/water-harvesting/en/full.mp3');
  const keep = [
    '/course-decks/water-harvesting/en/slide-18.jpg',
    '/course-decks/water-harvesting/zu/slide-19.jpg',
    '/course-audio/water-harvesting/en/slide-18.mp3',
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
  assert.equal(rows.has('/course-decks/water-harvesting/en/.l4-greywater-safety-20260924'), true);
  rows.set(changed[0] + '?saved=1', new Response('new lesson download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(changed[0] + '?saved=1')!.text(), 'new lesson download');
});

test('a saved Water Harvesting isiZulu pack drops superseded draft slides and speech once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterHarvestingZuluDraft\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterHarvestingZuluDraft\)/);
  const origin = 'https://field.test';
  const changed = Array.from({ length: 24 }, (_, i) => String(i + 1).padStart(2, '0'))
    .flatMap(slide => [
      `/course-decks/water-harvesting/zu/slide-${slide}.jpg`,
      `/course-audio/water-harvesting/zu/slide-${slide}.mp3`,
    ]).concat('/course-audio/water-harvesting/zu/full.mp3');
  changed.push('/course-images/water-harvesting/water-harvesting-l4.jpg');
  const keep = [
    '/course-decks/water-harvesting/en/slide-18.jpg',
    '/course-audio/water-harvesting/en/full.mp3',
    '/course-audio/reading-landscape/zu/slide-15.mp3',
  ];
  const rows = new Map<string, Response>([
    ...changed.map(path => [new URL(path + '?saved=old', origin).href, new Response('old draft')] as const),
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
  assert.equal(rows.has(origin + '/course-decks/water-harvesting/.zulu-review-draft-20260924'), true);
  const replacement = new URL(changed[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected draft slide'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected draft slide');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
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

test('a saved Vegetables L3 pack retires only the old sweet-potato card and English speech', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL3SweetPotatoTeaching\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetablesL3SweetPotatoTeaching\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-decks/vegetables-staples/en/slide-13.jpg',
    '/course-audio/vegetables-staples/en/slide-13.mp3',
    '/course-audio/vegetables-staples/en/full.mp3',
  ];
  const keep = [
    '/course-decks/vegetables-staples/en/slide-12.jpg',
    '/course-audio/vegetables-staples/en/slide-12.mp3',
    '/course-decks/vegetables-staples/zu/slide-13.jpg',
    '/course-audio/vegetables-staples/zu/slide-13.mp3',
    '/course-decks/food-forest/en/slide-13.jpg',
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
  assert.equal(rows.has(origin + '/course-decks/vegetables-staples/en/.l3-sweet-potato-20260923'), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected card'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected card');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});

test('a saved livestock module refreshes its loop-framing stills and speech after the earlier L3 migration', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSmallLivestockModuleFlows\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSmallLivestockL3NutrientFlow\)\.then\(migrateSmallLivestockModuleFlows\)\.then/);

  const origin = 'https://field.test';
  const obsolete = [
    '/course-decks/small-livestock/en/slide-03.jpg',
    '/course-decks/small-livestock/en/slide-19.jpg',
    '/course-audio/small-livestock/en/slide-03.mp3',
    '/course-audio/small-livestock/en/slide-19.mp3',
    '/course-audio/small-livestock/en/full.mp3',
  ];
  const keep = [
    '/course-decks/small-livestock/en/slide-14.jpg',
    '/course-audio/small-livestock/en/slide-14.mp3',
    '/course-decks/small-livestock/zu/slide-19.jpg',
    '/course-audio/small-livestock/zu/slide-19.mp3',
    '/course-decks/food-forest/en/slide-19.jpg',
  ];
  const rows = new Map<string, Response>([
    [origin + '/course-decks/small-livestock/en/.l3-nutrient-flow-20260923', new Response('previous migration')],
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
  assert.equal(rows.has(origin + '/course-decks/small-livestock/en/.module-flows-20260923'), true);
  const replacement = new URL(obsolete[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner-selected still'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner-selected still');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must not spend learner airtime');
});


test('a saved regional Soil Health pack retires only the twelve refreshed stills without spending airtime', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilHealthRegionalStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateSoilHealthRegionalStills\)\.then\(migrateSoilL3ComparisonStill\)/);

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => [1, 2, 5, 19].map(slide =>
    `/course-decks/soil-health/${language}/slide-${String(slide).padStart(2, '0')}.webp`
  ));
  const regionalStills = ['st', 've', 'ts'].flatMap(language => Array.from({ length: 20 }, (_, index) =>
    `/course-decks/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
  ));
  const preserved = [
    ...regionalStills.filter(path => !changed.includes(path)),
    ...['en', 'zu'].flatMap(language => Array.from({ length: 20 }, (_, index) =>
      `/course-decks/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...['en', 'zu'].flatMap(language => [
      ...Array.from({ length: 20 }, (_, index) => `/course-audio/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/soil-health/${language}/full.mp3`,
    ]),
    ...Array.from({ length: 22 }, (_, index) => `/course-audio/intro-permaculture/st/slide-${String(index + 1).padStart(2, '0')}.mp3`),
    '/course-audio/intro-permaculture/st/full.mp3',
    '/course-decks/soil-health/zu/slide-01.jpg',
    '/course-decks/intro-permaculture/st/slide-01.jpg',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded regional still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep downloaded media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the migration marker is added');
  const marker = origin + '/course-decks/soil-health/.regional-stills-20261003';
  assert.equal(rows.has(marker), true);
  assert.equal(puts, 1);

  const learnerSelectedDownload = new URL(changed[0], origin).href;
  rows.set(learnerSelectedDownload, new Response('replacement selected and downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(learnerSelectedDownload)!.text(), 'replacement selected and downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'the dated marker makes the migration one-time');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must leave replacement downloads to the learner');
});

test('a saved Vegetables pack retires only the refreshed opening regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesOpeningRegionalStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateReadingLandscapeRegionalStills\)\.then\(migrateVegetablesOpeningRegionalStills\)/,
    'the saved-pack cleanup must run during worker activation');

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => Array.from({ length: 6 }, (_, index) =>
    `/course-decks/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
  ));
  const preserved = [
    ...['st', 've', 'ts'].flatMap(language => Array.from({ length: 12 }, (_, index) =>
      `/course-decks/vegetables-staples/${language}/slide-${String(index + 7).padStart(2, '0')}.webp`
    )),
    ...['en', 'zu'].flatMap(language => Array.from({ length: 18 }, (_, index) =>
      `/course-decks/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...['en', 'zu', 'st', 've', 'ts'].flatMap(language => [
      ...Array.from({ length: 18 }, (_, index) => `/course-audio/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/vegetables-staples/${language}/full.mp3`,
    ]),
    '/course-decks/market-community/st/slide-01.webp',
    '/course-audio/soil-health/en/slide-01.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded opening still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/vegetables-staples/.opening-regional-stills-20261003';
  assert.equal(rows.has(marker), true);
  assert.equal(puts, 1, 'the first activation records one migration marker');

  const replacement = new URL(changed[0], origin).href;
  rows.set(replacement, new Response('new opening still downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new opening still downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave replacements alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation must not spend learner airtime downloading replacement stills');
});

test('a saved Vegetables pack retires only slides 7–18 regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesRemainingRegionalStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetablesOpeningRegionalStills\)\.then\(migrateVegetablesRemainingRegionalStills\)/,
    'the later-slide cleanup runs after the opening-slide migration during activation');

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => Array.from({ length: 12 }, (_, index) =>
    `/course-decks/vegetables-staples/${language}/slide-${String(index + 7).padStart(2, '0')}.webp`
  ));
  const preserved = [
    ...['st', 've', 'ts'].flatMap(language => Array.from({ length: 6 }, (_, index) =>
      `/course-decks/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    )),
    ...['en', 'zu'].flatMap(language => Array.from({ length: 18 }, (_, index) =>
      `/course-decks/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...['en', 'zu', 'st', 've', 'ts'].flatMap(language => [
      ...Array.from({ length: 18 }, (_, index) => `/course-audio/vegetables-staples/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/vegetables-staples/${language}/full.mp3`,
    ]),
    '/course-decks/market-community/st/slide-01.webp',
    '/course-audio/soil-health/en/slide-01.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded remaining regional still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/vegetables-staples/.remaining-regional-stills-20261003';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the migration marker is added');
  assert.equal(puts, 1, 'the first activation records exactly one marker');

  const learnerSelectedDownload = new URL(changed[0], origin).href;
  rows.set(learnerSelectedDownload, new Response('replacement chosen and downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(learnerSelectedDownload)!.text(), 'replacement chosen and downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave downloaded replacements alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must leave replacement downloads to the learner');
});

test('a saved Water pack refreshes changed regional frames without deleting untouched slides or narration', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterRegionalDraftStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateVegetablesRemainingRegionalStills\)\.then\(migrateWaterRegionalDraftStills\)/,
    'the Water cleanup runs during activation after the Vegetables migration');

  const origin = 'https://field.test';
  const slideNumbers = {
    st: [1, 3, 6, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 22, 23, 24],
    ve: [1, 3, 6, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 23, 24],
    ts: [1, 6, 8, 9, 10, 11, 13, 14, 15, 17, 18, 19, 23, 24],
  };
  const changed = Object.entries(slideNumbers).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/water-harvesting/${language}/slide-${String(slide).padStart(2, '0')}.webp`
  ));
  const preserved = [
    ...['st', 've', 'ts'].flatMap(language => Array.from({ length: 24 }, (_, index) =>
      `/course-decks/water-harvesting/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...['en', 'zu'].flatMap(language => Array.from({ length: 24 }, (_, index) =>
      `/course-decks/water-harvesting/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...['en', 'zu', 'st', 've', 'ts'].flatMap(language => [
      ...Array.from({ length: 24 }, (_, index) => `/course-audio/water-harvesting/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/water-harvesting/${language}/full.mp3`,
    ]),
    '/course-decks/vegetables-staples/st/slide-07.webp',
    '/course-decks/market-community/st/slide-01.webp',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded regional Water still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/water-harvesting/.regional-draft-stills-20261003';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the migration marker is added');
  assert.equal(puts, 1, 'the first activation records exactly one marker');

  const learnerSelectedDownload = new URL(changed[0], origin).href;
  rows.set(learnerSelectedDownload, new Response('replacement chosen and downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(learnerSelectedDownload)!.text(), 'replacement chosen and downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave downloaded replacements alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must leave replacement downloads to the learner');
});

test('a saved Soil pack refreshes source-paired regional frames and preserves untouched media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilRegionalDraftStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.match(source, /then\(migrateWaterRegionalDraftStills\)\.then\(migrateSoilRegionalDraftStills\)/,
    'the Soil cleanup runs during activation after the Water migration');

  const origin = 'https://field.test';
  const slideNumbers = {
    st: [4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20],
    ve: [4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 18, 19, 20],
    ts: [4, 6, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20],
  };
  const changed = Object.entries(slideNumbers).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/soil-health/${language}/slide-${String(slide).padStart(2, '0')}.webp`
  ));
  const preserved = [
    ...['st', 've', 'ts'].flatMap(language => Array.from({ length: 20 }, (_, index) =>
      `/course-decks/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...['en', 'zu'].flatMap(language => Array.from({ length: 20 }, (_, index) =>
      `/course-decks/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...['en', 'zu', 'st', 've', 'ts'].flatMap(language => [
      ...Array.from({ length: 20 }, (_, index) => `/course-audio/soil-health/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/soil-health/${language}/full.mp3`,
    ]),
    '/course-decks/vegetables-staples/st/slide-07.webp',
    '/course-decks/market-community/st/slide-01.webp',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded regional Soil still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/soil-health/.regional-draft-stills-20261003';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the migration marker is added');
  assert.equal(puts, 1, 'the first activation records exactly one marker');

  const learnerSelectedDownload = new URL(changed[0], origin).href;
  rows.set(learnerSelectedDownload, new Response('replacement chosen and downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(learnerSelectedDownload)!.text(), 'replacement chosen and downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave downloaded replacements alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'migration must leave replacement downloads to the learner');
});

test('a saved Reading Landscape pack retires only the seventeen changed regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeDraftStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateSoilRegionalDraftStills', 'migrateReadingLandscapeDraftStills',
    'the saved-pack invalidation remains wired after the Soil still migration');

  const origin = 'https://field.test';
  const slideNumbers = {
    st: [4, 7, 8, 12, 14],
    ve: [3, 4, 7, 8, 12, 14],
    ts: [3, 4, 7, 8, 12, 14],
  };
  const changed = Object.entries(slideNumbers).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`
  ));
  assert.equal(changed.length, 17, 'only the exact localized still frames changed by this batch are retired');
  const preserved = [
    ...(['st', 've', 'ts'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...(['en', 'zu'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...(['en', 'zu', 'st', 've', 'ts'] as const).flatMap(language => [
      ...Array.from({ length: 21 }, (_, index) =>
        `/course-audio/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/reading-landscape/${language}/full.mp3`,
    ]),
    '/course-decks/vegetables-staples/st/slide-07.webp',
    '/course-decks/market-community/st/slide-01.webp',
    '/course-audio/soil-health/st/slide-04.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Reading regional still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved lesson media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-draft-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the once-only marker is added');
  assert.equal(puts, 1, 'first activation stores exactly one marker');

  const replacement = new URL(changed[0], origin).href;
  rows.set(replacement, new Response('replacement deliberately downloaded later'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'replacement deliberately downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activation leaves a learner-selected replacement intact');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation invalidates old bytes without downloading replacements');
});

test('a saved Reading Landscape pack retires only the next twelve regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeOrdinaryStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateReadingLandscapeDraftStills', 'migrateReadingLandscapeOrdinaryStills',
    'the ordinary Reading still invalidation follows the earlier Reading draft migration');

  const origin = 'https://field.test';
  const changed = (['st', 've', 'ts'] as const).flatMap(language => [8, 10, 15, 21].map(slide =>
    `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  assert.equal(changed.length, 12);
  const preserved = [
    ...(['st', 've', 'ts'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...(['en', 'zu'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`)),
    ...(['en', 'zu', 'st', 've', 'ts'] as const).flatMap(language => [
      ...Array.from({ length: 21 }, (_, index) =>
        `/course-audio/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/reading-landscape/${language}/full.mp3`,
    ]),
    '/course-decks/vegetables-staples/st/slide-07.webp',
    '/course-decks/market-community/st/slide-01.webp',
    '/course-audio/soil-health/st/slide-04.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Reading ordinary still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep saved course media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-ordinary-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the once-only migration marker is added');
  assert.equal(puts, 1, 'the first activation records one marker');

  const replacement = new URL(changed[0], origin).href;
  rows.set(replacement, new Response('replacement downloaded later by the learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'replacement downloaded later by the learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activation leaves replacement downloads alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation retires old bytes without spending airtime on replacement downloads');
});

test('Intro cache migration retires only the 42 revised VE and TS stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateIntroRegionalSubstantiveStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateReadingLandscapeOrdinaryStills', 'migrateIntroRegionalSubstantiveStills',
    'Intro invalidation runs after the earlier Reading still migrations during worker activation');

  const origin = 'https://field.test';
  const changedByLanguage = {
    ve: [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
    ts: [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22],
  };
  const changed = Object.entries(changedByLanguage).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/intro-permaculture/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  assert.equal(changed.length, 42, 'only the 21 changed VE and 21 changed TS frames are retired');
  const preserved = [
    ...(['st', 've', 'ts'] as const).flatMap(language => Array.from({ length: 22 }, (_, index) =>
      `/course-decks/intro-permaculture/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...(['en', 'zu'] as const).flatMap(language => Array.from({ length: 22 }, (_, index) =>
      `/course-decks/intro-permaculture/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`)),
    ...(['en', 'zu', 'st', 've', 'ts'] as const).flatMap(language => [
      ...Array.from({ length: 22 }, (_, index) =>
        `/course-audio/intro-permaculture/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/intro-permaculture/${language}/full.mp3`,
    ]),
    '/course-decks/reading-landscape/st/slide-21.webp',
    '/course-decks/vegetables-staples/ve/slide-08.webp',
    '/course-audio/market-community/st/slide-04.mp3',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Intro VE/TS still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep unrelated course media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/intro-permaculture/.regional-substantive-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the once-only migration marker is added');
  assert.equal(puts, 1, 'the first activation writes one marker');

  const replacement = new URL(changed[0], origin).href;
  rows.set(replacement, new Response('replacement chosen and downloaded later by the learner'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'replacement chosen and downloaded later by the learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations preserve learner-selected replacement bytes');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation removes stale bytes without spending learner airtime');
});

test('Reading paired-draft refresh retires only six revised regional frames once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapePairedReuseStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateMarketLearnerReuseStills', 'migrateReadingLandscapePairedReuseStills',
    'the paired Reading still cleanup participates in service-worker activation after the Market migration');

  const origin = 'https://field.test';
  const changedByLanguage = { st: [1, 3, 16, 17], ve: [16], ts: [16] };
  const changed = Object.entries(changedByLanguage).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  assert.equal(changed.length, 6);
  const preserved = [
    '/course-decks/reading-landscape/st/slide-02.webp',
    '/course-decks/reading-landscape/ve/slide-21.webp',
    '/course-decks/reading-landscape/ts/slide-21.webp',
    '/course-audio/reading-landscape/zu/full.mp3',
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-animations/reading-landscape/posters/flow-a-frame.jpg',
    '/course-decks/market-community/st/slide-15.webp',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preservedUrls = preserved.map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Reading paired still')] as const),
    ...preservedUrls.map(url => [url, new Response('retain unrelated or shared media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-paired-reuse-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time marker remains beside preserved cache entries');
  assert.equal(puts, 1, 'the first activation writes one marker');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement selected and fetched later by the learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement selected and fetched later by the learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'the marker makes later activations leave replacement bytes alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'cache activation does not download replacement frames');
});

test('Reading observation release retires only slides 18–20 in three regional languages once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeObservationStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateReadingLandscapePairedReuseStills', 'migrateReadingLandscapeObservationStills',
    'the observation refresh runs after the paired Reading cleanup during activation');
  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => [18, 19, 20].map(slide =>
    `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  assert.equal(changed.length, 9);
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    ...['st', 've', 'ts'].flatMap(language => [1, 17, 21].map(slide =>
      `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`)),
    ...['en', 'zu'].flatMap(language => [18, 19, 20].map(slide =>
      `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.jpg`)),
    ...['st', 've', 'ts', 'en', 'zu'].map(language => `/course-audio/reading-landscape/${language}/full.mp3`),
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-decks/vegetables-staples/st/slide-18.webp',
  ];
  const preservedUrls = preserved.map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Reading observation frame')] as const),
    ...preservedUrls.map(url => [url, new Response('keep unrelated course media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-observation-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time migration marker remains');
  assert.equal(puts, 1);
  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement downloaded later by the learner'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement downloaded later by the learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave replacement bytes intact');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation removes stale bytes without fetching replacements');
});

test('record, Intro, and map refresh retires only eight changed regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateRegionalRecordIntroReadingStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateReadingLandscapeObservationStills', 'migrateRegionalRecordIntroReadingStills',
    'the regional record/Intro/map cleanup remains in the activation chain after Reading observation cleanup');

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/vegetables-staples/st/slide-18.webp',
    '/course-decks/vegetables-staples/ve/slide-18.webp',
    '/course-decks/vegetables-staples/ts/slide-18.webp',
    '/course-decks/intro-permaculture/ve/slide-14.webp',
    '/course-decks/intro-permaculture/ts/slide-14.webp',
    '/course-decks/reading-landscape/ts/slide-18.webp',
    '/course-decks/reading-landscape/ve/slide-19.webp',
    '/course-decks/reading-landscape/ts/slide-19.webp',
  ];
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    '/course-decks/vegetables-staples/st/slide-17.webp',
    '/course-decks/vegetables-staples/en/slide-18.jpg',
    '/course-decks/vegetables-staples/zu/slide-18.jpg',
    '/course-decks/intro-permaculture/st/slide-14.webp',
    '/course-decks/intro-permaculture/en/slide-14.jpg',
    '/course-decks/intro-permaculture/zu/slide-14.jpg',
    '/course-decks/reading-landscape/st/slide-18.webp',
    '/course-decks/reading-landscape/en/slide-18.jpg',
    '/course-decks/reading-landscape/zu/slide-19.jpg',
    ...['st', 've', 'ts', 'en', 'zu'].flatMap(language => [
      `/course-audio/intro-permaculture/${language}/full.mp3`,
      `/course-audio/reading-landscape/${language}/full.mp3`,
    ]),
    '/course-animations/intro-permaculture/water-use.mp4',
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-decks/market-community/ve/slide-18.webp',
  ];
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded source-paired still')] as const),
    ...preservedUrls.map(url => [url, new Response('keep unchanged course media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);

  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-record-intro-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time migration marker remains beside preserved entries');
  assert.equal(puts, 1, 'the first activation records the migration once');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement selected and downloaded later by the learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement selected and downloaded later by the learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations preserve learner-selected replacement bytes');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation removes stale bytes without downloading replacements');
});

test('Vegetables Field Action refresh retires only three slide 18 regional stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesFieldActionStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateRegionalRecordIntroReadingStills', 'migrateVegetablesFieldActionStills',
    'the Field Action refresh participates in the activation chain after its earlier related cleanup');

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].map(language =>
    `/course-decks/vegetables-staples/${language}/slide-18.webp`);
  const staleUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    '/course-decks/vegetables-staples/st/slide-17.webp',
    '/course-decks/vegetables-staples/ve/slide-19.webp',
    '/course-decks/vegetables-staples/ts/slide-16.webp',
    '/course-decks/vegetables-staples/en/slide-18.jpg',
    '/course-decks/vegetables-staples/zu/slide-18.jpg',
    ...['st', 've', 'ts', 'en', 'zu'].map(language =>
      `/course-audio/vegetables-staples/${language}/full.mp3`),
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-decks/reading-landscape/ts/slide-18.webp',
  ];
  const preservedUrls = preserved.map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response('previous slide 18 still')] as const),
    ...preservedUrls.map(url => [url, new Response('unrelated saved course asset')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/vegetables-staples/.field-action-slide18-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time marker remains beside preserved media');
  assert.equal(puts, 1, 'first activation records one migration marker');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('new still selected and downloaded later by learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'new still selected and downloaded later by learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'marker makes later activations leave replacement bytes intact');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not fetch replacement images or spend learner data');
});

test('regional assignment exercise refresh retires only seven changed stills once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateRegionalAssignmentExerciseStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateVegetablesFieldActionStills', 'migrateRegionalAssignmentExerciseStills',
    'the assignment refresh runs after the prior Field Action migration in worker activation');

  const origin = 'https://field.test';
  const changed = [
    ...['st', 've', 'ts'].map(language => `/course-decks/vegetables-staples/${language}/slide-17.webp`),
    '/course-decks/intro-permaculture/ve/slide-20.webp',
    '/course-decks/intro-permaculture/ve/slide-21.webp',
    '/course-decks/intro-permaculture/ts/slide-20.webp',
    '/course-decks/intro-permaculture/ts/slide-22.webp',
  ];
  const staleUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    '/course-decks/vegetables-staples/st/slide-16.webp',
    '/course-decks/vegetables-staples/ve/slide-18.webp',
    '/course-decks/vegetables-staples/ts/slide-18.webp',
    '/course-decks/vegetables-staples/en/slide-17.jpg',
    '/course-decks/vegetables-staples/zu/slide-17.jpg',
    ...['st', 've', 'ts', 'en', 'zu'].map(language =>
      `/course-audio/vegetables-staples/${language}/full.mp3`),
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-decks/reading-landscape/ts/slide-17.webp',
    '/course-decks/intro-permaculture/st/slide-20.webp',
    '/course-decks/intro-permaculture/st/slide-21.webp',
    '/course-decks/intro-permaculture/st/slide-22.webp',
    '/course-decks/intro-permaculture/ve/slide-19.webp',
    '/course-decks/intro-permaculture/ve/slide-22.webp',
    '/course-decks/intro-permaculture/ts/slide-19.webp',
    '/course-decks/intro-permaculture/ts/slide-21.webp',
    '/course-decks/intro-permaculture/en/slide-20.jpg',
    '/course-decks/vegetables-staples/.field-action-slide18-20261004',
    ...['st', 've', 'ts', 'en', 'zu'].map(language =>
      `/course-audio/intro-permaculture/${language}/full.mp3`),
  ];
  const preservedUrls = preserved.map(path => new URL(path + '?saved=1', origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response('previous slide 17 still')] as const),
    ...preservedUrls.map(url => [url, new Response('unrelated saved course asset')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/.regional-assignment-exercise-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time marker remains beside preserved media');
  assert.equal(puts, 1, 'first activation records one migration marker');
  assert.equal(changed.length, 7, 'one marker covers exactly the seven changed assignment-exercise frames');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('new still selected and downloaded later by learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'new still selected and downloaded later by learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'marker makes later activations leave replacement bytes intact');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not fetch replacement images or spend learner data');
});

test('Vegetables L2 pairing refresh retires only eight VE and TS frames once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL2OrdinaryPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateRegionalAssignmentExerciseStills', 'migrateVegetablesL2OrdinaryPairedStills',
    'the L2 still refresh runs after the earlier assignment media migration');

  const origin = 'https://field.test';
  const changed = ['ve', 'ts'].flatMap(language => [8, 9, 10, 11].map(slide =>
    `/course-decks/vegetables-staples/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  const staleUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    '/course-decks/vegetables-staples/st/slide-08.webp',
    '/course-decks/vegetables-staples/st/slide-11.webp',
    '/course-decks/vegetables-staples/en/slide-08.jpg',
    '/course-decks/vegetables-staples/zu/slide-08.jpg',
    '/course-decks/vegetables-staples/ve/slide-07.webp',
    '/course-decks/vegetables-staples/ts/slide-12.webp',
    ...['st', 've', 'ts', 'en', 'zu'].map(language =>
      `/course-audio/vegetables-staples/${language}/full.mp3`),
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-decks/reading-landscape/ts/slide-08.webp',
    '/course-decks/vegetables-staples/.field-action-slide18-20261004',
  ];
  const preservedUrls = preserved.map(path => new URL(path + '?keep=1', origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response('previous L2 regional still')] as const),
    ...preservedUrls.map(url => [url, new Response('unrelated saved course media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/vegetables-staples/.l2-ordinary-paired-stills-20261004';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the once-only marker remains with unrelated media');
  assert.equal(puts, 1, 'first activation records the migration marker');
  assert.equal(changed.length, 8, 'the migration covers exactly slides 8–11 in VE and TS');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement selected and downloaded later by learner'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement selected and downloaded later by learner');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activation leaves learner-selected replacement bytes intact');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'cache activation never downloads replacement stills');
});

test('Reading frost wording refresh retires only the four changed regional frames once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeFrostBodySyncStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  // 5 October 2026 inserted a bounded L1 still migration between these existing migrations.
  // Keep their relative order while allowing later migrations to be added between them.
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const l2Index = activation.indexOf('.then(migrateVegetablesL2OrdinaryPairedStills)');
  const frostIndex = activation.indexOf('.then(migrateReadingLandscapeFrostBodySyncStills)');
  assert.ok(l2Index >= 0, 'the Vegetables L2 still migration remains in activation');
  assert.ok(frostIndex >= 0, 'the frost wording migration remains in activation');
  assert.ok(l2Index < frostIndex,
  'the frost-wording refresh remains after the earlier Vegetables L2 still migration');
  assert.ok(activation.includes('.then(migrateVegetablesL1FullerOrdinaryPairedStills)'),
    'the new Vegetables L1 still migration is present in the activation chain');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not download replacement frames');

  const origin = 'https://field.test';
  const changed = [
    '/course-decks/reading-landscape/st/slide-11.webp',
    '/course-decks/reading-landscape/ts/slide-14.webp',
    '/course-decks/reading-landscape/ve/slide-14.webp',
    '/course-decks/reading-landscape/ve/slide-18.webp',
  ];
  assert.equal(changed.length, 4);
  const staleUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    '/course-decks/reading-landscape/st/slide-10.webp',
    '/course-decks/reading-landscape/st/slide-14.webp',
    '/course-decks/reading-landscape/ve/slide-13.webp',
    '/course-decks/reading-landscape/ve/slide-19.webp',
    '/course-decks/reading-landscape/ts/slide-13.webp',
    '/course-decks/reading-landscape/ts/slide-18.webp',
    '/course-decks/reading-landscape/en/slide-14.jpg',
    '/course-decks/reading-landscape/zu/slide-14.jpg',
    ...['st', 've', 'ts', 'en', 'zu'].map(language => `/course-audio/reading-landscape/${language}/full.mp3`),
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-decks/vegetables-staples/ve/slide-14.webp',
  ];
  const preservedUrls = preserved.map(path => new URL(path + '?keep=1', origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response('previous Reading frost still')] as const),
    ...preservedUrls.map(url => [url, new Response('preserve unrelated deck, audio, and animation')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.frost-body-sync-stills-20261005';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the one-time marker remains beside preserved media');
  assert.equal(puts, 1, 'first activation records the migration marker');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement chosen by the learner after activation'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement chosen by the learner after activation');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activations leave the selected replacement untouched');
});

test('Vegetables L4 ordinary pairing retires only slides 15 and 16 across three languages once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL4OrdinaryPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateVegetablesL1FullerOrdinaryPairedStills', 'migrateVegetablesL4OrdinaryPairedStills',
    'the L4 refresh follows the prior paired-deck migration');
  assertActivationOrder(source, 'migrateVegetablesL4OrdinaryPairedStills', 'migrateReadingLandscapeFrostBodySyncStills',
    'the L4 refresh remains ahead of the existing Reading refresh');

  const origin = 'https://field.test';
  const changed = ['st', 've', 'ts'].flatMap(language => [15, 16].map(slide =>
    `/course-decks/vegetables-staples/${language}/slide-${String(slide).padStart(2, '0')}.webp`));
  const staleUrls = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`])
    .map(path => new URL(path, origin).href);
  const preservedPaths = [
    '/course-decks/vegetables-staples/st/slide-14.webp',
    '/course-decks/vegetables-staples/ve/slide-14.webp',
    '/course-decks/vegetables-staples/ts/slide-14.webp',
    '/course-decks/vegetables-staples/ts/slide-17.webp',
    '/course-decks/vegetables-staples/en/slide-15.jpg',
    '/course-decks/vegetables-staples/zu/slide-15.jpg',
    ...['st', 've', 'ts', 'en', 'zu'].map(language => `/course-audio/vegetables-staples/${language}/full.mp3`),
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4',
    '/course-decks/market-community/ts/slide-15.webp',
  ];
  const preservedUrls = preservedPaths.map(path => new URL(`${path}?keep=1`, origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response(`stale:${url}`)] as const),
    ...preservedUrls.map(url => [url, new Response(`preserved:${url}`)] as const),
  ]);
  let puts = 0;
  let deletes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes += 1; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { puts += 1; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = new URL('/course-decks/vegetables-staples/.l4-ordinary-paired-stills-20261005', origin).href;
  assert.equal(rows.has(marker), true, 'the marker records the completed once-only refresh');
  assert.equal(deletes, staleUrls.length, 'only the six changed stills and their URL variants are retired');
  assert.equal(puts, 1);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not download replacement images');

  const laterDownload = new URL(changed[0], origin).href;
  rows.set(laterDownload, new Response('replacement chosen and saved by the learner later'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(laterDownload)!.text(), 'replacement chosen and saved by the learner later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(deletes, staleUrls.length, 'later activations leave learner-selected replacement bytes intact');
  assert.equal(puts, 1);
});

test('Reading first observations retire only the eight refreshed frames and all cached URL variants once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateReadingLandscapeFirstObservationStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateReadingLandscapeFrostBodySyncStills', 'migrateReadingLandscapeFirstObservationStills',
    'the first-observation refresh runs after the previous Reading frame migrations');

  const origin = 'https://field.test';
  const changedSlides = { st: [2, 5, 6], ve: [5, 6], ts: [2, 5, 6] };
  const changed = Object.entries(changedSlides).flatMap(([language, slides]) => slides.map(slide =>
    `/course-decks/reading-landscape/${language}/slide-${String(slide).padStart(2, '0')}.webp`
  ));
  assert.equal(changed.length, 8, 'only the approved source-paired stills are retired');
  const obsoleteUrls = changed.flatMap(path => [
    new URL(path, origin).href,
    new URL(path + '?saved=old', origin).href,
    new URL(path + '?width=small', origin).href,
  ]);
  const preserved = [
    ...(['st', 've', 'ts'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`
    ).filter(path => !changed.includes(path))),
    ...(['en', 'zu'] as const).flatMap(language => Array.from({ length: 21 }, (_, index) =>
      `/course-decks/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.jpg`
    )),
    ...(['st', 've', 'ts', 'en', 'zu'] as const).flatMap(language => [
      ...Array.from({ length: 21 }, (_, index) =>
        `/course-audio/reading-landscape/${language}/slide-${String(index + 1).padStart(2, '0')}.mp3`),
      `/course-audio/reading-landscape/${language}/full.mp3`,
    ]),
    '/course-animations/reading-landscape/flow-a-frame.mp4',
    '/course-decks/vegetables-staples/ve/slide-14.webp',
  ];
  const preservedUrls = [...new Set(preserved)].map(path => new URL(path + '?keep=1', origin).href);
  const rows = new Map<string, Response>([
    ...obsoleteUrls.map(url => [url, new Response('superseded Reading first-observation frame')] as const),
    ...preservedUrls.map(url => [url, new Response('preserve other Reading frames and media')] as const),
  ]);
  let puts = 0;
  const cache = {
    match: async (key: string) => rows.get(origin + key),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => rows.delete(request.url),
    put: async (key: string, response: Response) => { puts += 1; rows.set(origin + key, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of obsoleteUrls) assert.equal(rows.has(url), false, url);
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  const marker = origin + '/course-decks/reading-landscape/.regional-first-observation-stills-20261005';
  assert.equal(rows.has(marker), true);
  assert.equal(rows.size - preservedUrls.length, 1, 'only the migration marker remains with preserved cache entries');
  assert.equal(puts, 1);

  const learnerDownload = new URL(changed[0], origin).href;
  rows.set(learnerDownload, new Response('replacement still selected and downloaded later'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(learnerDownload)!.text(), 'replacement still selected and downloaded later');
  for (const url of preservedUrls) assert.equal(rows.has(url), true, url);
  assert.equal(puts, 1, 'later activation leaves replacement bytes alone');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'the worker retires stale URLs but leaves replacement downloads to the learner');
});

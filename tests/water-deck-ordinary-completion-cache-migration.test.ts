import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('ordinary Water card refresh retires only its 27 saved stills once and keeps other offline media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateWaterOrdinaryCompletionStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const precision = migrations.indexOf('migrateWaterReviewedPrecisionStills');
  const ordinary = migrations.indexOf('migrateWaterOrdinaryCompletionStills');
  assert.equal(migrations.filter(name => name === 'migrateWaterOrdinaryCompletionStills').length, 1);
  assert.ok(precision >= 0 && ordinary > precision && activation.indexOf('self.clients.claim()') > activation.indexOf('migrateWaterOrdinaryCompletionStills'),
    'the once-only ordinary refresh follows prior Water precision invalidation and completes before clients are claimed');

  const origin = 'https://field.test';
  const changed = [
    ...[6, 8, 13, 14, 15, 17, 18, 22].map(slide => `/course-decks/water-harvesting/st/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[6, 8, 10, 11, 13, 14, 15, 17, 18].map(slide => `/course-decks/water-harvesting/ve/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[6, 8, 10, 11, 13, 14, 15, 17, 18, 22].map(slide => `/course-decks/water-harvesting/ts/slide-${String(slide).padStart(2, '0')}.webp`),
  ];
  assert.equal(changed.length, 27);
  assert.equal(new Set(changed).size, 27);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const changedSet = new Set(changed);
  const preservedWaterStills = ['st', 've', 'ts'].flatMap(language =>
    Array.from({ length: 24 }, (_, index) => index + 1)
      .map(slide => `/course-decks/water-harvesting/${language}/slide-${String(slide).padStart(2, '0')}.webp`)
      .filter(path => !changedSet.has(path))
      .map(path => `${path}?cached=1`)
  );
  const preserved = [
    ...preservedWaterStills,
    '/course-decks/water-harvesting/en/slide-06.webp?cached=1',
    '/course-decks/water-harvesting/zu/slide-13.webp?cached=1',
    '/course-decks/water-harvesting/st/slide-06.webp.bak?cached=1',
    '/course-decks/water-harvesting/ve/slide-08.webp.bak',
    '/course-decks/water-harvesting/ts/slide-10.jpg?cached=1',
    '/course-decks/water-harvesting/ts/slide-09.webp?cached=1',
    '/course-decks/soil-health/st/slide-13.webp?cached=1',
    '/course-decks/vegetables-staples/ve/slide-14.webp?cached=1',
    '/course-audio/water-harvesting/en/slide-13.mp3?cached=1',
    '/course-audio/water-harvesting/ts/full.mp3?cached=1',
    '/course-animations/water-harvesting/shared-film.mp4?cached=1',
    '/course-animations/shared/water-film.mp4?cached=1',
  ];
  const rows = new Map([...stale, ...preserved].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0;
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');

  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const path of stale) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserved) assert.equal(rows.has(new URL(path, origin).href), true, path);
  assert.equal(deletes, stale.length, 'only the exact still paths and their query variants are retired');
  const marker = '/course-decks/water-harvesting/.ordinary-completion-stills-20261006';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.equal(writes, 1, 'the migration records one dated completion marker');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation never downloads learner-selected images');

  const laterDownloads = changed.flatMap((path, index) => [
    [new URL(path, origin).href, `new still ${index}`] as const,
    [new URL(`${path}?saved=new`, origin).href, `new variant ${index}`] as const,
  ]);
  for (const [url, bodyText] of laterDownloads) rows.set(url, new Response(bodyText));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const [url, bodyText] of laterDownloads) assert.equal(await rows.get(url)!.text(), bodyText, url);
  assert.equal(deletes, stale.length, 'a later activation preserves the learner’s replacement downloads');
  assert.equal(writes, 1, 'a later activation leaves the migration marker untouched');
});

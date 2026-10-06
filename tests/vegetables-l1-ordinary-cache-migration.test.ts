import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { expectedVegetablesL1Paths, validateCurrentVegetablesL1OrdinaryMedia, vegetablesL1AssetSizesBeforeOrdinary } from './vegetables-l1-ordinary-media-history-checks.ts';

test('Vegetables L1 refresh retires only five approved saved still paths once and preserves other offline media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesL1OrdinaryResidualStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const precision = migrations.indexOf('migrateVegetablesL3OrdinaryResidualStills');
  const ordinary = migrations.indexOf('migrateVegetablesL1OrdinaryResidualStills');
  const market = migrations.indexOf('migrateMarketOrdinaryResidualStills');
  assert.equal(migrations.filter(name => name === 'migrateVegetablesL1OrdinaryResidualStills').length, 1);
  assert.ok(precision >= 0 && ordinary > precision && market >= 0 && ordinary > market && activation.indexOf('self.clients.claim()') > activation.indexOf('migrateVegetablesL1OrdinaryResidualStills'),
    'the once-only Vegetables refresh follows prior L3 and Market invalidations and completes before clients are claimed');

  const origin = 'https://field.test';
  const changed = expectedVegetablesL1Paths;
  assert.equal(changed.length, 5);
  assert.equal(new Set(changed).size, 5);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const changedSet = new Set(changed);
  const preservedVegetablesStills = ['st', 've', 'ts'].flatMap(language =>
    Array.from({ length: 18 }, (_, index) => index + 1)
      .map(slide => `/course-decks/vegetables-staples/${language}/slide-${String(slide).padStart(2, '0')}.webp`)
      .filter(path => !changedSet.has(path))
      .map(path => `${path}?cached=1`)
  );
  assert.equal(preservedVegetablesStills.length, 49, 'all other regional Vegetables frames stay cached');
  const preserved = [
    ...preservedVegetablesStills,
    '/course-decks/vegetables-staples/en/slide-06.webp?cached=1',
    '/course-decks/vegetables-staples/zu/slide-13.webp?cached=1',
    '/course-decks/vegetables-staples/st/slide-12.webp.bak?cached=1',
    '/course-decks/vegetables-staples/ve/slide-07.webp.bak',
    '/course-decks/vegetables-staples/ts/slide-13.jpg?cached=1',
    '/course-decks/vegetables-staples/ts/slide-09.webp?cached=1',
    '/course-decks/water-harvesting/st/slide-13.webp?cached=1',
    '/course-decks/vegetables-staples/ve/slide-14.webp?cached=1',
    '/course-audio/soil-health/en/slide-13.mp3?cached=1',
    '/course-audio/intro-permaculture/st/slide-22.mp3?cached=1',
    '/course-animations/soil-health/flow-build-compost-heap.mp4?cached=1',
    '/course-animations/soil-health/flow-compost-materials.mp4?cached=1',
    '/course-animations/soil-health/posters/flow-build-compost-heap.jpg?cached=1',
    '/course-animations/soil-health/posters/flow-compost-materials.jpg?cached=1',
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
  const marker = '/course-decks/vegetables-staples/.l1-ordinary-residual-stills-20261006';
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


test('five compressed L1 cards preserve all accepted sources, full download manifest and 87 unlisted Vegetable assets', () => {
  const proof = validateCurrentVegetablesL1OrdinaryMedia();
  assert.equal(proof.frames.length, 5);
  assert.equal(proof.manifestActualTotalBytes, 744366586);
  assert.equal(proof.aggregateDeltaBytes, 8996);
  assert.equal(vegetablesL1AssetSizesBeforeOrdinary(), readFileSync('docs/media/vegetables-l1-ordinary-2026-10-06/asset-sizes-before.ts.txt', 'utf8'));
});

test('L1 historical descriptors reject aggregate and unlisted size drift before exposing the earlier assets', () => {
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  assert.throws(() => validateCurrentVegetablesL1OrdinaryMedia(actual.replace('744.4 MB total.', '744.5 MB total.')), /only five Vegetables sizes/);
  const path = '/course-decks/vegetables-staples/st/slide-01.webp';
  const slot = `  '${path}': ${COURSE_ASSET_SIZES[path]},`;
  assert.ok(actual.includes(slot));
  assert.throws(() => validateCurrentVegetablesL1OrdinaryMedia(actual.replace(slot, `  '${path}': 1,`)), /only five Vegetables sizes/);
  assert.throws(() => vegetablesL1AssetSizesBeforeOrdinary(actual.replace(slot, `  '${path}': 1,`)), /exact guarded Vegetables L1 manifest baseline/);
});

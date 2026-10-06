import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { expectedIntroFullPaths, validateCurrentIntroFullMedia, introFullAssetSizesBeforeOrdinary, introFullMediaProof, verifyIntroFullFrameBytes } from './intro-full-ordinary-media-history-checks.ts';
const soilWaterResidualMediaProof = JSON.parse(readFileSync('docs/media/soil-water-residual-2026-10-06/frames.json', 'utf8'));

test('Intro full ordinary refresh retires only 36 approved saved still paths once and preserves other offline media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateIntroFullOrdinaryCompletionStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const precision = migrations.indexOf('migrateVegetablesL1OrdinaryResidualStills');
  const ordinary = migrations.indexOf('migrateIntroFullOrdinaryCompletionStills');
  const market = migrations.indexOf('migrateMarketOrdinaryResidualStills');
  assert.equal(migrations.filter(name => name === 'migrateIntroFullOrdinaryCompletionStills').length, 1);
  assert.ok(precision >= 0 && ordinary > precision && market >= 0 && ordinary > market && activation.indexOf('self.clients.claim()') > activation.indexOf('migrateIntroFullOrdinaryCompletionStills'),
    'the once-only Intro refresh follows prior Vegetables L1 and Market invalidations and completes before clients are claimed');

  const origin = 'https://field.test';
  const changed = expectedIntroFullPaths;
  assert.equal(changed.length, 36);
  assert.equal(new Set(changed).size, 36);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const changedSet = new Set(changed);
  const preservedIntroStills = ['st', 've', 'ts'].flatMap(language =>
    Array.from({ length: 22 }, (_, index) => index + 1)
      .map(slide => `/course-decks/intro-permaculture/${language}/slide-${String(slide).padStart(2, '0')}.webp`)
      .filter(path => !changedSet.has(path))
      .map(path => `${path}?cached=1`)
  );
  assert.equal(preservedIntroStills.length, 30, 'all other regional Intro frames stay cached');
  const preserved = [
    ...preservedIntroStills,
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
  const marker = '/course-decks/intro-permaculture/.full-ordinary-completion-stills-20261006';
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


test('36 compressed Intro cards bind full source/target and measured manifest while all1869 unlisted assets stay exact', () => {
  const proof = validateCurrentIntroFullMedia();
  assert.equal(proof.frames.length, 36);
  assert.equal(proof.unlistedAssetCount, 1869);
  assert.equal(introFullAssetSizesBeforeOrdinary(), readFileSync('docs/media/intro-full-ordinary-completion-2026-10-06/asset-sizes-before.ts.txt', 'utf8'));
});

test('new Intro history rejects manifest drift and same-size corrupted or wrong-height compressed media', () => {
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const currentSummary = soilWaterResidualMediaProof.courseAssetSizesAggregate.generatedSummaryLine;
  assert.equal(actual.split(currentSummary).length - 1, 1, 'the residual proof identifies exactly one current generated summary');
  const wrongSummary = actual.replace(currentSummary, '// Incorrect aggregate');
  assert.notEqual(wrongSummary, actual, 'the mutation changes the current manifest');
  assert.throws(() => validateCurrentIntroFullMedia(wrongSummary));
  const path = '/course-decks/intro-permaculture/st/slide-22.webp';
  const slot = `  '${path}': ${COURSE_ASSET_SIZES[path]},`;
  assert.ok(actual.includes(slot));
  assert.throws(() => validateCurrentIntroFullMedia(actual.replace(slot, `  '${path}': 1,`)));
  assert.throws(() => introFullAssetSizesBeforeOrdinary(actual.replace(slot, `  '${path}': 1,`)));
  const frame = introFullMediaProof.frames[0];
  const bytes = readFileSync(frame.asset);
  const corrupted = Buffer.from(bytes); corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => verifyIntroFullFrameBytes(frame, corrupted));
  assert.throws(() => verifyIntroFullFrameBytes({ ...frame, new: { ...frame.new, height: frame.new.height - 1 } }, bytes));
});

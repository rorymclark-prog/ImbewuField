import { vegetablesL3AssetSizesBeforeOrdinary } from './vegetables-l3-ordinary-media-history-checks.ts';
import { marketAssetSizesBeforeOrdinary, validateCurrentMarketOrdinaryMedia, marketFrameBeforeNativeResidual } from './market-ordinary-media-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { marketDeckBeforeOrdinary, marketDeckBeforeNativeResidual, readCurrentMarketDecks } from './market-ordinary-deck-checks.ts';

test('ordinary Market refresh retires only its eleven approved saved stills once and keeps other offline media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateMarketOrdinaryResidualStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const precision = migrations.indexOf('migrateMarketL1OrdinaryStills');
  const ordinary = migrations.indexOf('migrateMarketOrdinaryResidualStills');
  assert.equal(migrations.filter(name => name === 'migrateMarketOrdinaryResidualStills').length, 1);
  assert.ok(precision >= 0 && ordinary > precision && activation.indexOf('self.clients.claim()') > activation.indexOf('migrateMarketOrdinaryResidualStills'),
    'the once-only ordinary refresh follows prior Market invalidation and completes before clients are claimed');

  const origin = 'https://field.test';
  const changed = [
    ...[12, 15].map(slide => `/course-decks/market-community/st/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[7, 8, 10, 11, 15, 17].map(slide => `/course-decks/market-community/ve/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[7, 10, 17].map(slide => `/course-decks/market-community/ts/slide-${String(slide).padStart(2, '0')}.webp`),
  ];
  assert.equal(changed.length, 11);
  assert.equal(new Set(changed).size, 11);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const changedSet = new Set(changed);
  const preservedMarketStills = ['st', 've', 'ts'].flatMap(language =>
    Array.from({ length: 20 }, (_, index) => index + 1)
      .map(slide => `/course-decks/market-community/${language}/slide-${String(slide).padStart(2, '0')}.webp`)
      .filter(path => !changedSet.has(path))
      .map(path => `${path}?cached=1`)
  );
  assert.equal(preservedMarketStills.length, 49, 'all other regional Market frames stay cached');
  const preserved = [
    ...preservedMarketStills,
    '/course-decks/market-community/en/slide-06.webp?cached=1',
    '/course-decks/market-community/zu/slide-13.webp?cached=1',
    '/course-decks/market-community/st/slide-12.webp.bak?cached=1',
    '/course-decks/market-community/ve/slide-07.webp.bak',
    '/course-decks/market-community/ts/slide-13.jpg?cached=1',
    '/course-decks/market-community/ts/slide-09.webp?cached=1',
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
  const marker = '/course-decks/market-community/.ordinary-residual-stills-20261006';
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


const folder = 'docs/media/market-ordinary-2026-10-06/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const proofBytes = readFileSync(folder + 'frames.json');
const expectedPaths = [
  ...[12, 15].map(n => `/course-decks/market-community/st/slide-${String(n).padStart(2, '0')}.webp`),
  ...[7, 8, 10, 11, 15, 17].map(n => `/course-decks/market-community/ve/slide-${String(n).padStart(2, '0')}.webp`),
  ...[7, 10, 17].map(n => `/course-decks/market-community/ts/slide-${String(n).padStart(2, '0')}.webp`),
];

// 6 October: the immutable real pre-render assets protect every unlisted image,
// film and narration clip. The proof binds current bytes to accepted source pairs.
test('eleven Market WebPs and download promises match accepted paired sources while every other asset stays exact', () => {
  assert.equal(sha(proofBytes), '0efa24cb294beaa3203576fec99b497b0f6aa872d89320454369edc8421cac41');
  const proof = JSON.parse(proofBytes.toString());
  assert.equal(proof.frames.length, 11);
  assert.deepEqual(proof.frames.map((frame: { path: string }) => frame.path).sort(), expectedPaths.slice().sort());
  const currentDecks = readCurrentMarketDecks();
  marketDeckBeforeOrdinary(currentDecks);
  const decks = marketDeckBeforeNativeResidual(currentDecks);
  const before = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  assert.equal(sha(before), proof.manifestBeforeSHA256);
  let expectedManifest = before;
  for (const frame of proof.frames) {
    assert.deepEqual(frame.pairedSource, decks[frame.language].slides[frame.slide - 1], frame.path);
    // The final thirteen-frame layer supersedes one of these eleven images.
    // Its complete real-byte guard precedes this exact predecessor/canvas claim.
    const later = marketFrameBeforeNativeResidual(frame.path);
    if (later) {
      assert.deepEqual(later, {bytes:frame.new.bytes,sha256:frame.new.sha256,width:frame.new.width,height:frame.new.height});
      assert.ok(vegetablesL3AssetSizesBeforeOrdinary().includes(`  '${frame.path}': ${frame.new.bytes},`));
    } else {
      const bytes = readFileSync('public' + frame.path);
      assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
      assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
      assert.equal(bytes.length, frame.new.bytes, frame.path);
      assert.equal(sha(bytes), frame.new.sha256, frame.path);
      assert.equal(bytes.subarray(12, 16).toString(), 'VP8 ');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, frame.new.width);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, frame.new.height);
      assert.equal(COURSE_ASSET_SIZES[frame.path], bytes.length);
    }
    assert.notEqual(frame.new.sha256, frame.old.sha256, frame.path);
    assert.equal(frame.new.width, 1440);
    assert.ok(frame.new.height >= 5400, 'natural-height panels must not be cropped');
    const oldEntry = `  '${frame.path}': ${frame.old.bytes},`;
    assert.equal(expectedManifest.split(oldEntry).length, 2, 'one exact old manifest slot');
    expectedManifest = expectedManifest.replace(oldEntry, `  '${frame.path}': ${frame.new.bytes},`);
  }
  const entries = [...expectedManifest.matchAll(/^  '[^']+': (\d+),$/gm)];
  const total = entries.reduce((sum, entry) => sum + Number(entry[1]), 0);
  expectedManifest = expectedManifest.replace(/\/\/ \d+ files, [\d.]+ MB total\./,
    `// ${entries.length} files, ${(total / 1e6).toFixed(1)} MB total.`);
  // Dated L3 supersession is fully guarded before the original Market manifest rule.
  const actualManifest = vegetablesL3AssetSizesBeforeOrdinary();
  assert.equal(actualManifest, expectedManifest, 'only eleven sizes and the actual aggregate comment change');
  assert.equal(sha(actualManifest), proof.manifestAfterSHA256);
  const changed = new Set(expectedPaths);
  assert.equal(sha(readFileSync(folder + 'market-assets-before.json')), '33d160d0eb73fcf3c76fba9115efc091ff0e9f25bb05e98878f0d9a869392ef0');
  const oldAssets = JSON.parse(readFileSync(folder + 'market-assets-before.json', 'utf8'));
  assert.equal(oldAssets.filter((row: { path: string }) => !changed.has(row.path)).length, 90);
  for (const row of oldAssets) {
    if (changed.has(row.path)) {
      assert.deepEqual(proof.frames.find((frame: { path: string }) => frame.path === row.path).old, row);
      continue;
    }
    const later = marketFrameBeforeNativeResidual(row.path);
    if (later) assert.deepEqual({bytes:later.bytes,sha256:later.sha256}, {bytes:row.bytes,sha256:row.sha256}, row.path);
    else {
      const bytes = readFileSync('public' + row.path);
      assert.equal(bytes.length, row.bytes, row.path);
      assert.equal(sha(bytes), row.sha256, row.path);
    }
  }
  assert.equal(sha(readFileSync(folder + 'protected-audio-films-before.json')), 'b51a853f7f1d05f13f48c2cfef20429641ecc667a5f93b3c9e9294ac02aa3bf5');
  const protectedMedia = JSON.parse(readFileSync(folder + 'protected-audio-films-before.json', 'utf8'));
  assert.equal(protectedMedia.length, 604);
  for (const row of protectedMedia) {
    const bytes = readFileSync('public' + row.path);
    assert.equal(bytes.length, row.bytes, row.path);
    assert.equal(sha(bytes), row.sha256, row.path);
  }
});


// 6 October 2026: the silent25-asset release may reject corrupt current input before
// older guards; retain every mutation and each earlier precise rejection route.
test('Market historical media reconstruction rejects arbitrary headers and unlisted size mutations before exposing old descriptors', () => {
  const actual = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  const prior = readFileSync(folder + 'asset-sizes-before.ts.txt', 'utf8');
  assert.equal(marketAssetSizesBeforeOrdinary(actual), prior, 'exact full accepted layer restores the frozen historical text');
  assert.throws(() => validateCurrentMarketOrdinaryMedia(actual.replace(/MB total\./, 'MB total. corrupted')),
    /only (eleven sizes and the actual aggregate|eight Vegetables sizes and the measured aggregate) comment change|exact guarded Vegetables L3 manifest baseline|only the complete accepted silent Intro manifest is current|the caller must supply the exact live complete manifest/);
  assert.throws(() => marketAssetSizesBeforeOrdinary(prior.replace('709.4 MB total.', '709.5 MB total.')),
    /exact guarded Market baseline/);
  const unlisted = '/course-decks/market-community/st/slide-01.webp';
  const slot = `  '${unlisted}': ${COURSE_ASSET_SIZES[unlisted]},`;
  assert.ok(actual.includes(slot));
  assert.throws(() => validateCurrentMarketOrdinaryMedia(actual.replace(slot, `  '${unlisted}': 1,`)),
    /only (eleven sizes and the actual aggregate|eight Vegetables sizes and the measured aggregate) comment change|exact guarded Vegetables L3 manifest baseline|only the complete accepted silent Intro manifest is current|the caller must supply the exact live complete manifest/);
});

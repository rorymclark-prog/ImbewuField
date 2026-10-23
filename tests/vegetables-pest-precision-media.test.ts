import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { nativePairedResidualFrames, nativePairedResidualMediaBefore, nativePairedResidualManifestBefore968 } from './native-paired-residual-media-history-checks.ts';
import { coreHeldOrdinaryAssets } from './core-held-ordinary-history-checks.ts';

const expectedFrames = [
  ['/course-decks/vegetables-staples/st/slide-15.webp', 573684, 1440, 5400, 'c6e362ef53e745a398e43cb2eb5bcee15d67881d4bbbcc3c00520f28304336c2'],
  ['/course-decks/vegetables-staples/st/slide-16.webp', 571682, 1440, 5576, '47b7d410aca5a2f8a6959400f3213e01c0343d16192e226f0982cb0900c34f31'],
  ['/course-decks/vegetables-staples/ve/slide-15.webp', 575078, 1440, 5400, '5cf7c3592a00404a553df7f11914e511a71fd953e36e0d41582b6f50d7109c1e'],
  ['/course-decks/vegetables-staples/ve/slide-16.webp', 568224, 1440, 5734, 'aec14eeca9001a9ff0b3cb830796d3413181b6866c89f6522dc4da7640df2b7c'],
  ['/course-decks/vegetables-staples/ts/slide-15.webp', 577910, 1440, 5400, '73b347d2b33a78a6e3444a13f44ab1e91403e1cb61028cdd6bbbf17228e45ca3'],
  ['/course-decks/vegetables-staples/ts/slide-16.webp', 564290, 1440, 5642, 'd8b7172f2f8fca16c3e8e5bf66f5d6d1b9dee72955aead8035c9c8933a428496'],
] as const;

test('Vegetables L4 compressed precision frames retain the reviewed full canvas and exact offline sizes', () => {
  // The latest 13-frame release reuses three of these URLs. Validate that full
  // current layer, then inspect its exact before descriptors for those frames.
  const beforeNativeResidual = nativePairedResidualManifestBefore968();
  assert.equal(createHash('sha256').update(beforeNativeResidual).digest('hex'), '230860f4fcf0fe5772d3c9ec5c8310896030b7b8323a5ad8d94cb94c95d4ec52');
  for (const [url, bytes, width, height, sha256] of expectedFrames) {
    const later = nativePairedResidualMediaBefore(`public${url}`);
    if (later) {
      assert.deepEqual(later, { bytes, sha256 }, `${url} is preserved as the exact input to the newer approved redraw`);
      // This dated frame can now be superseded by either checked redraw layer.
      const currentLaterFrame = nativePairedResidualFrames.find(frame => frame.url === url) ?? coreHeldOrdinaryAssets.find(frame=>frame.url===url);
      assert.ok(currentLaterFrame, `${url} newer frame remains in the approved source-bound render set`);
      assert.deepEqual(currentLaterFrame.beforeDimensions ?? [currentLaterFrame.width,currentLaterFrame.height], [width, height], `${url} preserves the reviewed prior full canvas before the later content expansion`);
      assert.equal(beforeNativeResidual.split(`  '${url}': ${bytes},`).length, 2, `${url} prior manifest retains the exact six-frame size`);
      continue;
    }
    const contents = readFileSync(new URL(`../public${url}`, import.meta.url));
    assert.equal(contents.byteLength, bytes, `${url} byte count`);
    assert.equal(COURSE_ASSET_SIZES[url], bytes, `${url} offline manifest size`);
    assert.equal(createHash('sha256').update(contents).digest('hex'), sha256, `${url} reviewed output hash`);
    assert.equal(contents.toString('ascii', 0, 4), 'RIFF', `${url} RIFF header`);
    assert.equal(contents.toString('ascii', 8, 12), 'WEBP', `${url} WebP container`);
    assert.equal(contents.toString('ascii', 12, 16), 'VP8 ', `${url} expected lossy WebP frame`);
    assert.equal(contents[23], 0x9d, `${url} WebP frame start code`);
    assert.equal(contents[24], 0x01, `${url} WebP frame start code`);
    assert.equal(contents[25], 0x2a, `${url} WebP frame start code`);
    assert.equal(contents.readUInt16LE(26) & 0x3fff, width, `${url} natural width`);
    assert.equal(contents.readUInt16LE(28) & 0x3fff, height, `${url} natural height`);
  }
});

test('Vegetables L4 precision refresh retires only six still URLs and all their query variants once', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateVegetablesPestPrecisionPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const previous = migrations.indexOf('migrateVegetablesL2FullerOrdinaryPairedStills');
  const current = migrations.indexOf('migrateVegetablesPestPrecisionPairedStills');
  const following = migrations.indexOf('migrateReadingLandscapeFrostBodySyncStills');
  assert.equal(migrations.filter(name => name === 'migrateVegetablesPestPrecisionPairedStills').length, 1);
  assert.ok(previous >= 0 && current > previous && following > current,
    'the six precision frames refresh after prior Vegetables cards and before later Reading migrations');

  const origin = 'https://field.test';
  const changed = expectedFrames.map(([path]) => path);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const preserve = [
    '/course-decks/vegetables-staples/st/slide-14.webp?saved=1',
    '/course-decks/vegetables-staples/ve/slide-17.webp?saved=1',
    '/course-decks/vegetables-staples/ts/slide-14.webp?saved=1',
    '/course-decks/vegetables-staples/en/slide-15.jpg?saved=1',
    '/course-audio/vegetables-staples/en/full.mp3?saved=1',
    '/course-animations/vegetables-staples/flow-seed-or-seedling.mp4?saved=1',
  ];
  const rows = new Map([...stale, ...preserve].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0;
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes += 1; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { writes += 1; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  for (const path of stale) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserve) assert.equal(rows.has(new URL(path, origin).href), true, path);
  assert.equal(deletes, stale.length, 'only query variants for the six changed frames are deleted');
  assert.equal(writes, 1, 'one marker records completion');
  const marker = '/course-decks/vegetables-staples/.pest-precision-paired-stills-20261006';
  assert.equal(rows.has(new URL(marker, origin).href), true);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation never downloads replacement media');

  const replacement = new URL(`${changed[0]}?saved=new`, origin).href;
  rows.set(replacement, new Response('learner-selected replacement'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'learner-selected replacement');
  assert.equal(deletes, stale.length, 'later activations preserve newly downloaded slides');
  assert.equal(writes, 1);
});

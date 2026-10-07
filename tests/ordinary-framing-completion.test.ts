import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import {
  ensureOrdinaryFramingText,
  ordinaryFramingAssets,
  ordinaryFramingAssetBefore,
  ordinaryFramingBefore,
  ordinaryFramingExpected,
  ordinaryFramingGroups,
  ordinaryFramingManifestBefore,
  ordinaryFramingPairBefore,
  ordinaryFramingPairBeforeHistory,
  ordinaryFramingPairBytesBefore,
} from './ordinary-framing-history-checks.ts';
import { veReadingFrostPairBefore, veReadingFrostAssetBefore } from './ve-reading-frost-history-checks.ts';

const folder = 'docs/study-translation-reviews/regional-ordinary-framing-2026-10-07/';
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const source = (path: string) => readFileSync(path, 'utf8');

test('13 reviewed framing fields change only their paired targets and preserve complete source layers', () => {
  assert.equal(ordinaryFramingGroups.length, 13);
  assert.equal(new Set(ordinaryFramingGroups.map(row => `${row.file}:${row.slide}:${row.field}:${row.index ?? ''}`)).size, 13);
  ensureOrdinaryFramingText();

  for (const [file, expected] of Object.entries(ordinaryFramingExpected)) {
    const current = veReadingFrostPairBefore(file, JSON.parse(source(file)));
    const frozen = ordinaryFramingBefore[file];
    assert.deepEqual(current.slides.map((slide: any) => slide.english), frozen.slides.map((slide: any) => slide.english), `${file}: no English source field changed`);
    assert.deepEqual(current.slides.map((slide: any) => slide.target), expected.slides.map((slide: any) => slide.target), `${file}: only the thirteen proof-backed target fields changed`);
    assert.deepEqual(ordinaryFramingPairBefore(file, current), frozen, `${file}: complete checked predecessor`);
    assert.deepEqual(ordinaryFramingPairBeforeHistory(file, current), frozen, `${file}: exact proof-backed historical reconstruction`);

    const currentBytes = readFileSync(file);
    assert.deepEqual(ordinaryFramingPairBytesBefore(file, currentBytes), readFileSync(`${folder}before/${file.split('/').pop()}`));

    const sourceCorruption = structuredClone(current);
    sourceCorruption.slides[0].english.heading += ' fabricated source';
    assert.throws(() => ordinaryFramingPairBefore(file, sourceCorruption), `${file}: source corruption must fail`);

    const targetCorruption = structuredClone(current);
    const untouched = targetCorruption.slides.find((slide: any) => !ordinaryFramingGroups.some(row => row.file === file && row.slide === slide.n));
    assert.ok(untouched, `${file}: proof leaves at least one complete slide unlisted`);
    const original = untouched.target.body[0];
    if (typeof original === 'string') untouched.target.body[0] += ' fabricated target';
    else if (typeof original?.text === 'string') original.text += ' fabricated target';
    else if (Array.isArray(original?.segments) && typeof original.segments[0]?.text === 'string') original.segments[0].text += ' fabricated target';
    else assert.fail(`${file}: no ordinary unlisted target text available to corrupt`);
    assert.throws(() => ordinaryFramingPairBefore(file, targetCorruption), `${file}: unlisted target corruption must fail`);
  }

  for (const row of ordinaryFramingGroups) {
    const current = veReadingFrostPairBefore(row.file, JSON.parse(source(row.file)));
    const slide = current.slides.find((item: any) => item.n === row.slide);
    const before = ordinaryFramingBefore[row.file].slides.find((item: any) => item.n === row.slide);
    const cell = row.field === 'heading' ? slide.target.heading : slide.target.body[row.index];
    const oldCell = row.field === 'heading' ? before.target.heading : before.target.body[row.index];
    const expectedCell = row.field === 'heading'
      ? ordinaryFramingExpected[row.file].slides.find((item: any) => item.n === row.slide).target.heading
      : ordinaryFramingExpected[row.file].slides.find((item: any) => item.n === row.slide).target.body[row.index];
    assert.equal(row.field === 'heading' ? slide.english.heading : slide.english.body[row.index], row.source, `${row.id}: exact source remains bound`);
    assert.deepEqual(oldCell, row.before, `${row.id}: complete before field matches proof`);
    assert.deepEqual(cell, row.after, `${row.id}: complete after field matches proof`);
    assert.deepEqual(cell, expectedCell, `${row.id}: expected document contains this exact after field`);
  }
});

test('10 intended cards match proof-derived frames, exact natural canvas, bytes, hashes and complete manifest', () => {
  assert.equal(ordinaryFramingAssets.length, 10);
  const frameFromProof = new Set<string>();
  for (const row of ordinaryFramingGroups) {
    const match = row.file.match(/\/([^/]+)\.(st|ve|ts)\.paired-draft\.json$/);
    assert.ok(match, `${row.file}: recognized paired regional file`);
    frameFromProof.add(`/course-decks/${match[1]}/${match[2]}/slide-${String(row.slide).padStart(2, '0')}.webp`);
  }
  const provedAssets = new Set(ordinaryFramingAssets.map(row => row.url));
  assert.equal(frameFromProof.size, 10, 'thirteen field changes compress to exactly ten distinct cards');
  assert.deepEqual([...provedAssets].sort(), [...frameFromProof].sort(), 'the measured files are exactly the proof-derived intended frames');
  assert.ok(frameFromProof.has('/course-decks/reading-landscape/ve/slide-20.webp'));
  assert.ok(!frameFromProof.has('/course-decks/reading-landscape/ve/slide-21.webp'), 'the rejected Reading 21 selection is not present');

  const visualBytes = readFileSync(folder + 'root-visual-review.json');
  assert.equal(sha(visualBytes), '2a6d67169da8ebaa3047346b42c112315530bbb95531f4772c7586d24bf205d8', 'root visual review is immutable');
  const visual = JSON.parse(visualBytes.toString());
  assert.equal(visual.frames, 10);
  assert.equal(visual.noClippingObserved, true);
  assert.equal(visual.naturalCanvasPreserved, true);
  assert.equal(visual.sourceFieldsUnchanged, true);
  assert.equal(visual.fluentApproval, false);
  assert.match(visual.rejectedInitialSelection, /Reading21.*Reading20/);

  const exactDimensions: Record<string, [number, number]> = {
    '/course-decks/market-community/ve/slide-11.webp': [1440, 5400],
    '/course-decks/market-community/ve/slide-17.webp': [1440, 5400],
    '/course-decks/reading-landscape/ve/slide-14.webp': [1440, 5424],
    '/course-decks/reading-landscape/ve/slide-20.webp': [1440, 5400],
    '/course-decks/vegetables-staples/ts/slide-04.webp': [1440, 5400],
    '/course-decks/vegetables-staples/ts/slide-05.webp': [1440, 5400],
    '/course-decks/vegetables-staples/ts/slide-16.webp': [1440, 5642],
    '/course-decks/vegetables-staples/ve/slide-03.webp': [1440, 5400],
    '/course-decks/vegetables-staples/ve/slide-04.webp': [1440, 5400],
    '/course-decks/vegetables-staples/ve/slide-05.webp': [1440, 5400],
  };
  for (const row of ordinaryFramingAssets) {
    assert.deepEqual(row.dimensions, exactDimensions[row.url], `${row.url}: exact reviewed unscaled canvas`);
    assert.equal(row.language, row.url.split('/')[3]);
    const bytes = readFileSync('public' + row.url);
    const rootProjection = veReadingFrostAssetBefore('public' + row.url, bytes);
    assert.equal(COURSE_ASSET_SIZES[row.url], bytes.length, `${row.url}: live offline manifest advertises actual current bytes`);
    if (rootProjection) {
      const currentDimensions = [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
      assert.deepEqual(currentDimensions, row.url.endsWith('slide-14.webp') ? [1440, 5436] : [1440, 5400], `${row.url}: actual latest card canvas is measured separately from its historical framing descriptor`);
    }
    assert.equal(rootProjection?.bytes ?? bytes.length, row.bytes, `${row.url}: latest checked projection reaches the measured framing byte count`);
    assert.equal(rootProjection?.sha256 ?? sha(bytes), row.sha256, `${row.url}: latest checked projection reaches the measured framing hash`);
    assert.notEqual(row.beforeSHA256, row.sha256, `${row.url}: current card differs from its frozen before card`);
    assert.deepEqual(ordinaryFramingAssetBefore('public' + row.url, bytes), {
      bytes: row.beforeBytes,
      sha256: row.beforeSHA256,
      width: row.beforeDimensions[0],
      height: row.beforeDimensions[1],
    }, `${row.url}: historical descriptor is proof-backed`);
  }

  const manifest = source('lib/course-asset-sizes.ts');
  ordinaryFramingManifestBefore(manifest);
  assert.throws(() => ordinaryFramingManifestBefore(manifest + '\n// unlisted corruption'), 'unlisted manifest changes must fail');
});

test('regional ordinary framing migration removes only old still variants once without fetching or evicting other media', async () => {
  const worker = source('app/sw.js/route.ts');
  const body = worker.match(/async function migrateRegionalOrdinaryFramingStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body, 'the selective migration is present');
  assert.equal([...worker.matchAll(/\.then\(migrateRegionalOrdinaryFramingStills\)/g)].length, 1, 'activation runs migration exactly once');
  assert.ok(worker.indexOf('.then(migrateRegionalOrdinaryFramingStills)') < worker.indexOf('self.clients.claim()'), 'cache refresh completes before the worker claims clients');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'refresh must not spend learner airtime');

  const changed = ordinaryFramingAssets.map(row => row.url);
  const oldVariants = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const preserve = [
    '/course-audio/market-community/ve/slide-11.mp3',
    '/course-audio/vegetables-staples/ts/slide-16.mp3',
    '/course-animations/market-community/ve/market-flow.mp4',
    '/course-decks/market-community/ve/slide-12.webp',
    '/course-decks/reading-landscape/ve/slide-21.webp',
    '/course-decks/vegetables-staples/ts/slide-15.webp',
    '/course-decks/vegetables-staples/st/slide-04.webp',
    '/course-decks/intro-permaculture/ve/slide-03.webp',
  ];
  const origin = 'https://field.test';
  const entries = new Map<string, Response>([...oldVariants, ...preserve].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0;
  let writes = 0;
  let fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(new URL(key, origin).href),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return entries.delete(request.url); },
    put: async (key: string, value: Response) => { writes++; entries.set(new URL(key, origin).href, value); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'URL', 'Response', 'fetch', 'return (async () => {' + body + '})()') as (...args: any[]) => Promise<void>;
  const args = [
    { open: async () => cache },
    'imbewu-course-v1',
    URL,
    Response,
    () => { fetches++; throw new Error('ordinary framing refresh must not fetch'); },
  ];

  await run(...args);
  for (const path of oldVariants) assert.equal(entries.has(new URL(path, origin).href), false, `${path}: stale path or query variant removed`);
  for (const path of preserve) assert.ok(entries.has(new URL(path, origin).href), `${path}: unrelated media retained`);
  assert.equal(deletes, oldVariants.length, 'only exact changed-card paths, including old query variants, were deleted');
  assert.equal(writes, 1, 'one completion marker is written');
  assert.equal(fetches, 0);

  const laterDownload = `${changed[0]}?saved=downloaded-after-refresh`;
  entries.set(new URL(laterDownload, origin).href, new Response('later learner download'));
  await run(...args);
  assert.equal(await entries.get(new URL(laterDownload, origin).href)?.text(), 'later learner download', 'later query downloads survive the marker-protected second activation');
  assert.equal(deletes, oldVariants.length, 'second activation does not delete a later download');
  assert.equal(writes, 1, 'second activation is inert');
  assert.equal(fetches, 0);
});

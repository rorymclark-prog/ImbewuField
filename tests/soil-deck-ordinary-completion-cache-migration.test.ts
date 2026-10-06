import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_TRANSCRIPTS } from '../lib/course-transcripts.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

test('ordinary Soil card refresh retires only its six approved saved stills once and keeps other offline media', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = source.match(/async function migrateSoilOrdinaryCompletionStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrations = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  const precision = migrations.indexOf('migrateSoilFullerLearnerStills');
  const ordinary = migrations.indexOf('migrateSoilOrdinaryCompletionStills');
  assert.equal(migrations.filter(name => name === 'migrateSoilOrdinaryCompletionStills').length, 1);
  assert.ok(precision >= 0 && ordinary > precision && activation.indexOf('self.clients.claim()') > activation.indexOf('migrateSoilOrdinaryCompletionStills'),
    'the once-only ordinary refresh follows prior Soil fuller-learner invalidation and completes before clients are claimed');

  const origin = 'https://field.test';
  const changed = [
    ...[18].map(slide => `/course-decks/soil-health/st/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[4, 8].map(slide => `/course-decks/soil-health/ve/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[8, 13, 18].map(slide => `/course-decks/soil-health/ts/slide-${String(slide).padStart(2, '0')}.webp`),
  ];
  assert.equal(changed.length, 6);
  assert.equal(new Set(changed).size, 6);
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const changedSet = new Set(changed);
  const preservedSoilStills = ['st', 've', 'ts'].flatMap(language =>
    Array.from({ length: 20 }, (_, index) => index + 1)
      .map(slide => `/course-decks/soil-health/${language}/slide-${String(slide).padStart(2, '0')}.webp`)
      .filter(path => !changedSet.has(path))
      .map(path => `${path}?cached=1`)
  );
  assert.equal(preservedSoilStills.length, 54, 'all other regional Soil frames stay cached');
  const preserved = [
    ...preservedSoilStills,
    '/course-decks/soil-health/en/slide-06.webp?cached=1',
    '/course-decks/soil-health/zu/slide-13.webp?cached=1',
    '/course-decks/soil-health/st/slide-18.webp.bak?cached=1',
    '/course-decks/soil-health/ve/slide-08.webp.bak',
    '/course-decks/soil-health/ts/slide-13.jpg?cached=1',
    '/course-decks/soil-health/ts/slide-09.webp?cached=1',
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
  const marker = '/course-decks/soil-health/.ordinary-completion-stills-20261006';
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

// 6 October 2026: the new layer supersedes seven ordinary deck fields. The
// historical whole-deck baseline still protects every source and unlisted pair.
test('seven approved Soil deck fields remain paired to exact English and preserve every other field', () => {
  const bytes = readFileSync('docs/study-translation-reviews/soil-ordinary-deck-2026-10-06/applied-proof.json');
  assert.equal(createHash('sha256').update(bytes).digest('hex'), '4dc2e043be4fd833db4130311ff8d318dced5b7ae9cd872646904faf49ab8c91');
  const proof = JSON.parse(bytes.toString());
  assert.equal(proof.fieldCount, 7);
  const expectedSlots = ['st:18:3', 've:4:0', 've:8:0', 've:8:2', 'ts:8:2', 'ts:13:1', 'ts:18:3'];
  const seen: string[] = [];
  for (const lane of proof.languages) {
    const current = JSON.parse(readFileSync(lane.path, 'utf8'));
    const expected = structuredClone(lane.fullBefore);
    const narration = englishSlideRecords(readFileSync('docs/narration/soil-health.en.md', 'utf8'));
    validatePairedDraft(current, narration, lane.language);
    const drift = structuredClone(narration);
    drift[17].body[3] += ' changed source';
    assert.throws(() => validatePairedDraft(current, drift, lane.language), /English body differs from narration/);
    assert.equal(current.language, lane.language);
    assert.equal(current.reviewStatus, 'unreviewed');
    for (const row of lane.rows) {
      const index = Number(row.fieldPath.match(/^body\[(\d+)\]$/)?.[1]);
      assert.ok(Number.isInteger(index), row.fieldPath);
      seen.push(`${lane.language}:${row.slide}:${index}`);
      const before = expected.slides.find((slide: { n: number }) => slide.n === row.slide);
      const after = lane.fullAfter.slides.find((slide: { n: number }) => slide.n === row.slide);
      assert.equal(before.english.body[index], row.sourceEnglish);
      assert.equal(COURSE_TRANSCRIPTS['soil-health'].en[row.slide][index], row.sourceEnglish);
      assert.equal(before.target.body[index].text, row.currentDeckTarget);
      assert.equal(after.target.body[index].text, row.acceptedTarget);
      assert.equal(after.target.body[index].status, 'draft');
      assert.match(after.target.body[index].provenance, /[Uu]nreviewed/);
      if (row.mode === 'prefix-only') {
        assert.equal(row.currentDeckTarget.startsWith('Cover crops,'), true);
        assert.equal(row.acceptedTarget,
          'Swibyariwa swo sirhelela misava (cover crops),' + row.currentDeckTarget.slice('Cover crops,'.length),
          'the independently accepted prefix cannot change the existing can-help remainder');
      }
      before.target.body[index] = structuredClone(after.target.body[index]);
    }
    assert.deepEqual(lane.fullAfter, expected, `${lane.language}: only accepted target pairs may change`);
    assert.deepEqual(current, expected, `${lane.language}: actual full deck includes all unlisted fields and exact sources`);
    assert.deepEqual(current.slides.map((slide: { english: unknown }) => slide.english),
      lane.fullBefore.slides.map((slide: { english: unknown }) => slide.english));
  }
  assert.deepEqual(seen.sort(), expectedSlots.sort());
});

test('the six refreshed Soil stills have actual proof-bound WebP bytes and exact offline sizes', () => {
  const assets = JSON.parse(readFileSync('docs/study-translation-reviews/soil-ordinary-deck-2026-10-06/asset-proof.json', 'utf8'));
  const expected = [
    '/course-decks/soil-health/st/slide-18.webp',
    '/course-decks/soil-health/ve/slide-04.webp',
    '/course-decks/soil-health/ve/slide-08.webp',
    '/course-decks/soil-health/ts/slide-08.webp',
    '/course-decks/soil-health/ts/slide-13.webp',
    '/course-decks/soil-health/ts/slide-18.webp',
  ];
  assert.deepEqual(assets.map((row: { url: string }) => row.url).sort(), expected.sort());
  for (const row of assets) {
    const bytes = readFileSync('public' + row.url);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', row.url);
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', row.url);
    assert.equal(bytes.length, row.bytes, row.url);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, row.url);
    assert.notEqual(row.sha256, row.beforeSHA256, row.url);
    assert.equal(COURSE_ASSET_SIZES[row.url], bytes.length, `${row.url}: download promises actual bytes`);
  }
});

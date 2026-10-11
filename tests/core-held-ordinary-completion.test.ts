import { ordinaryFramingAssetBefore } from './ordinary-framing-history-checks.ts';
import { veOrdinaryPairBefore } from './ve-ordinary-reviewed-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { stIntroRuntimeResidualPairBefore, stIntroRuntimeResidualAssetBytesBefore } from './st-intro-runtime-residual-history-checks.ts';
import { studyVegetablesTwoResidualAssetBefore } from './study-vegetables-two-ordinary-residual-history-checks.ts';

const folder = 'docs/study-translation-reviews/core-held-ordinary-completion-2026-10-07/';
const read = (path: string) => JSON.parse(readFileSync(path, 'utf8'));
const plan = read(folder + 'applied-plan.json');
const assets = read(folder + 'converted-assets.json').assets;
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

// Frozen complete inputs make an unlisted source, neighbour or status change fail.
test('109 reviewed fields preserve every exact English source and unlisted paired object', () => {
  assert.equal(plan.groups.length, 109);
  for (const file of new Set<string>(plan.groups.map((row: any) => row.file))) {
    const beforeBytes = readFileSync(folder + 'before/' + file.replaceAll('/', '__') + '.json');
    const expected = JSON.parse(beforeBytes.toString());
    for (const row of plan.groups.filter((item: any) => item.file === file)) {
      assert.equal(sha(beforeBytes), row.fileSHA256);
      const slide = expected.slides.find((item: any) => item.n === row.slide);
      const index = row.field.match(/^body\[(\d+)\]$/)?.[1];
      const source = index === undefined ? slide.english.heading : slide.english.body[Number(index)];
      assert.equal(source, row.sourceEnglish);
      const target = index === undefined ? slide.target.heading : slide.target.body[Number(index)];
      assert.deepEqual(target, row.before);
      if (index === undefined) slide.target.heading = row.after;
      else slide.target.body[Number(index)] = row.after;
    }
    // The later 18-fragment reviewed layer is checked completely before restoring this predecessor.
    assert.deepEqual(veOrdinaryPairBefore(file, stIntroRuntimeResidualPairBefore(file, read(file))), expected, file);
  }
});

test('69 active compressed cards have their actual manifest bytes and reviewed image hashes', () => {
  assert.equal(assets.length, 69);
  assert.equal(new Set(assets.map((row: any) => row.url)).size, 69);
  for (const row of assets) {
    const path = 'public' + row.url;
    const bytes = readFileSync(path);
    // The exact B residual proof is newest for its two stills; older dated layers
    // receive its recorded predecessor only after it validates the live bytes.
    const vegetablesPrevious = studyVegetablesTwoResidualAssetBefore(path, bytes);
    let historicalCurrent = bytes;
    let latest: { bytes: number; sha256: string } | null = null;
    if (!vegetablesPrevious) {
      const runtimePrevious = stIntroRuntimeResidualAssetBytesBefore(path, bytes);
      historicalCurrent = runtimePrevious ?? bytes;
      // New framing bytes must pass their own full measurement before this dated layer is exposed.
      latest = ordinaryFramingAssetBefore(path, historicalCurrent);
    }
    assert.equal(vegetablesPrevious?.sha256 ?? latest?.sha256 ?? sha(historicalCurrent), row.afterSHA256, row.url);
    assert.equal(vegetablesPrevious?.bytes ?? latest?.bytes ?? historicalCurrent.length, row.afterBytes, row.url);
    assert.equal(COURSE_ASSET_SIZES[row.url], bytes.length);
    assert.notEqual(row.beforeSHA256, row.afterSHA256);
  }
  const st = assets.filter((row: any) => row.module === 'intro-permaculture' && row.language === 'st');
  assert.equal(st.length, 5);
  for (const row of st) assert.ok(row.url.includes('/st-silent/'), 'recorded archive paths must never be replaced');
});

test('69-card refresh removes old query variants once and preserves recordings, other cards and later downloads', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const body = source.match(/async function migrateCoreHeldOrdinaryStills\(\) \{([\s\S]*?)\n\}/)![1];
  assert.equal([...source.matchAll(/\.then\(migrateCoreHeldOrdinaryStills\)/g)].length, 1);
  const changed = assets.map((row: any) => row.url);
  const preserve = Object.keys(COURSE_ASSET_SIZES).filter(url => !changed.includes(url));
  const origin = 'https://field.test';
  const entries = new Map([...changed.flatMap((url: string) => [url, url + '?old=1']), ...preserve].map(url => [new URL(url, origin).href, new Response(url)]));
  let fetches = 0;
  const cache = { match: async (key: string) => entries.get(new URL(key, origin).href), keys: async () => [...entries.keys()].map(url => new Request(url)), delete: async (request: Request) => entries.delete(request.url), put: async (key: string, value: Response) => entries.set(new URL(key, origin).href, value) };
  const run = new (Object.getPrototypeOf(async function () {}).constructor)('caches', 'COURSE_CACHE', 'URL', 'Response', 'fetch', body);
  const args = [{ open: async () => cache }, 'course', URL, Response, () => { fetches++; throw new Error('no fetching during refresh'); }];
  await run(...args);
  for (const url of changed) for (const suffix of ['', '?old=1']) assert.equal(entries.has(new URL(url + suffix, origin).href), false, url);
  for (const url of preserve) assert.equal(entries.has(new URL(url, origin).href), true, url);
  entries.set(new URL(changed[0] + '?new=1', origin).href, new Response('new'));
  await run(...args);
  assert.equal(entries.has(new URL(changed[0] + '?new=1', origin).href), true);
  assert.equal(fetches, 0);
});

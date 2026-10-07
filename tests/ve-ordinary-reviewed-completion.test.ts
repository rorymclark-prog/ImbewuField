import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { ensureVeOrdinaryReviewedText, veOrdinaryPairBefore, veOrdinaryAssets as assets, veOrdinaryManifestBefore } from './ve-ordinary-reviewed-history-checks.ts';
const folder='docs/study-translation-reviews/ve-remaining-ordinary-review-2026-10-07/';
const sha=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
test('18 checked ordinary fragments preserve every source, neighbour and draft status',()=>{
  ensureVeOrdinaryReviewedText();
  const plan=JSON.parse(readFileSync(folder+'applied-plan.json','utf8'));
  assert.equal(plan.changes.length,18); assert.equal(plan.frames.length,15);
  for(const row of plan.changes){
    const current=JSON.parse(readFileSync(row.file,'utf8'));
    const before=veOrdinaryPairBefore(row.file,current);
    const index=Number(row.field.slice(5,-1));
    const old=before.slides.find((s:any)=>s.n===row.slide).target.body[index].segments[row.segmentIndex];
    const now=current.slides.find((s:any)=>s.n===row.slide).target.body[index].segments[row.segmentIndex];
    assert.equal(old.sourceEnglish,row.sourceFragment);
    // English holds may omit text: the renderer then uses their exact source fragment.
    assert.equal(old.text ?? old.sourceEnglish,row.sourceFragment);
    assert.equal(now.sourceEnglish,old.sourceEnglish);assert.equal(now.status,'draft');
    assert.equal(now.text,row.text);assert.notEqual(now.text,now.sourceEnglish,'English identity cannot claim translation');
    const corrupted=structuredClone(current);corrupted.slides[0].english.heading+=' invented';
    assert.throws(()=>veOrdinaryPairBefore(row.file,corrupted),'unlisted source damage must fail');
  }
});
test('15 compressed Tshivenda cards match measured bytes, reviewed hashes and the complete manifest',()=>{
  assert.equal(assets.length,15);assert.equal(new Set(assets.map((a:any)=>a.url)).size,15);
  for(const row of assets){const bytes=readFileSync('public'+row.url);assert.equal(sha(bytes),row.afterSHA256);assert.equal(bytes.length,row.afterBytes);assert.equal(COURSE_ASSET_SIZES[row.url],row.afterBytes);assert.notEqual(row.beforeSHA256,row.afterSHA256);assert.equal(row.dimensions[0],1440);assert.ok(row.dimensions[1]>=5400);assert.deepEqual(row.dimensions,row.renderedDimensions,'compression preserves the renderer canvas without squashing');assert.ok(row.url.includes('/ve/'));}
  veOrdinaryManifestBefore(readFileSync('lib/course-asset-sizes.ts','utf8'));
});
test('15-card Tshivenda refresh removes old query variants once and preserves recordings, other cards and later downloads', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const body = source.match(/async function migrateTshivendaOrdinaryReviewedStills\(\) \{([\s\S]*?)\n\}/)![1];
  assert.equal([...source.matchAll(/\.then\(migrateTshivendaOrdinaryReviewedStills\)/g)].length, 1);
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

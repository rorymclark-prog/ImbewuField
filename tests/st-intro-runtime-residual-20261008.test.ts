import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { COURSE_DECK_RELEASE_ROWS } from '../lib/course-deck-release-bindings-data.ts';
import { stIntroRuntimeResidualPairBefore, stIntroRuntimeResidualManifestBefore,
  stIntroRuntimeResidualAssets, stIntroRuntimeResidualAssetBefore } from './st-intro-runtime-residual-history-checks.ts';

const pairPath = 'docs/narration/intro-permaculture.st.silent-draft.json';
const pair = JSON.parse(readFileSync(pairPath, 'utf8'));
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');

test('the runtime silent release binds all 22 current target slots and exactly ten refreshed stills', () => {
  const release = COURSE_DECK_RELEASE_ROWS.find(row => row.moduleId === 'intro-permaculture' && row.language === 'st')!;
  assert.equal(release.pairPath, pairPath);
  assert.equal(release.audioBinding, 'none');
  assert.equal(release.reviewStatus, 'unreviewed');
  assert.equal(release.pairSha256, sha(readFileSync(pairPath)));
  assert.equal(release.slides.length, 22);
  for (const row of release.slides) {
    const live = pair.slides[row.slide - 1];
    assert.equal(live.n, row.slide);
    assert.deepEqual(live.english, { heading: row.sourceHeading, body: row.sourceEnglish });
    assert.equal(row.targetHeading, live.target.heading.status === 'draft' ? live.target.heading.text : live.english.heading);
    assert.deepEqual(row.targetText, live.target.body.map((field: any, i: number) => field.status === 'draft' ? field.text : live.english.body[i]));
    assert.equal(row.targetHash, sha(JSON.stringify([row.targetHeading, ...row.targetText])));
  }
  assert.equal(stIntroRuntimeResidualAssets.length, 10);
  for (const row of stIntroRuntimeResidualAssets) {
    const bytes = readFileSync('public' + row.url);
    assert.equal(COURSE_ASSET_SIZES[row.url], bytes.length);
    assert.deepEqual(stIntroRuntimeResidualAssetBefore('public' + row.url, bytes), {
      bytes: row.before.bytes, sha256: row.before.sha256, width: row.before.width, height: row.before.height,
    });
    assert.equal(sha(bytes), row.after.sha256);
  }
});

test('the newest source-bound guard rejects source, target, status, ordering, unlisted, and manifest mutations', () => {
  for (const mutate of [
    (p: any) => { p.slides[9].english.body[0] += '!'; },
    (p: any) => { p.slides[9].target.body[0].text += '!'; },
    (p: any) => { p.slides[9].target.body[0].status = 'english-hold'; },
    (p: any) => { p.slides[9].unlistedTestField = true; },
    (p: any) => { p.slides.reverse(); },
  ]) {
    const changed = structuredClone(pair); mutate(changed);
    assert.throws(() => stIntroRuntimeResidualPairBefore(pairPath, changed));
  }
  const manifest = readFileSync('lib/course-asset-sizes.ts', 'utf8');
  assert.throws(() => stIntroRuntimeResidualManifestBefore(manifest.replace("'/course-decks/intro-permaculture/st-silent/slide-10.webp'", "'/renamed/st-silent/slide-10.webp'")));
  const corrupted = Buffer.from(readFileSync('public' + stIntroRuntimeResidualAssets[0].url));
  corrupted[corrupted.length - 1] ^= 1;
  assert.throws(() => stIntroRuntimeResidualAssetBefore('public' + stIntroRuntimeResidualAssets[0].url, corrupted));
  const recorded = readFileSync('docs/narration/intro-permaculture.st.paired-draft.json');
  const audio = readFileSync('lib/course-audio.ts');
  assert.equal(sha(recorded), '50ac554323e41921cdfc83dd4b6d6abf18f240d8c416b38dc95e01630d4b3df9', 'recorded ST pair remains byte exact');
  assert.equal(sha(audio), '36baa7b8e6ffb452a1fee06f3358d4b2050c80101200da8f1dda77cb5f356d64', 'recorded ST audio binding remains byte exact');
});

test('the one-time migration retires only ten ST silent URLs and their query variants without fetching', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const body = source.match(/async function migrateStIntroRuntimeResidualStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  assert.equal([...activation.matchAll(/\.then\(migrateStIntroRuntimeResidualStills\)/g)].length, 1);
  assert.ok(activation.indexOf('migrateStIntroRuntimeResidualStills') < activation.indexOf('self.clients.claim()'));
  assert.doesNotMatch(body, /fetch\s*\(/);
  const changed = stIntroRuntimeResidualAssets.map((row: any) => row.url);
  assert.equal(changed.length, 10);
  const stPrefix = '/course-decks/intro-permaculture/st-silent/slide-';
  const unchanged = Array.from({ length: 22 }, (_, i) => `${stPrefix}${String(i + 1).padStart(2, '0')}.webp`).filter(path => !changed.includes(path));
  assert.equal(unchanged.length, 12);
  const protectedPaths = [...unchanged,
    '/course-decks/intro-permaculture/st/slide-10.webp',
    '/course-audio/intro-permaculture/st/slide-10.mp3',
    '/course-audio/intro-permaculture/st/full.mp3',
    '/course-animations/intro-permaculture/example.mp4',
    '/course-decks/soil-health/st/slide-10.webp'];
  const origin = 'https://field.test'; const href = (path: string) => new URL(path, origin).href;
  const entries = new Map([...changed.flatMap((path: string) => [path, `${path}?saved=old`]), ...protectedPaths]
    .map(path => [href(path), new Response(path)]));
  let deletes = 0, fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(href(key)),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletes++; return entries.delete(request.url); },
    put: async (key: string, response: Response) => { entries.set(href(key), response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'URL', 'Response', 'Request', 'fetch', `return (async () => { ${body} })()`);
  const args = [{ open: async () => cache }, 'course', URL, Response, Request, () => { fetches++; throw Error('migration must not fetch'); }];
  await run(...args);
  assert.equal(deletes, 20);
  for (const path of changed) for (const suffix of ['', '?saved=old']) assert.equal(entries.has(href(path + suffix)), false);
  for (const path of protectedPaths) assert.ok(entries.has(href(path)), path + ': archived, shared or unmodified media preserved');
  entries.set(href(changed[0] + '?new=1'), new Response('new current download'));
  await run(...args);
  assert.equal(entries.has(href(changed[0] + '?new=1')), true, 'once-only marker preserves downloads saved after migration');
  assert.equal(deletes, 20);
  assert.equal(fetches, 0);
});

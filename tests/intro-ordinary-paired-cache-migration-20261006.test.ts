import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const packet = JSON.parse(read('docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/root-accepted-final-packet.json'));
const ids = new Set(packet.actualRecommendationDelta.changedRowIds);
const changed = [...new Set<string>(packet.verdicts.filter((row: { id: string }) => ids.has(row.id))
  .map((row: { language: string; slide: number }) => `/course-decks/intro-permaculture/${row.language}/slide-${String(row.slide).padStart(2, '0')}.webp`))];

test('Intro retires only the 30 reviewed VE/TS still paths and stale queries once, keeping replacement downloads', async () => {
  const source = read('app/sw.js/route.ts');
  const body = source.match(/async function migrateIntroOrdinaryNextStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation cannot spend learner data');
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  assert.equal(activation.match(/\.then\(migrateIntroOrdinaryNextStills\)/g)?.length, 1);
  assert.ok(activation.indexOf('migrateIntroOrdinaryNextStills') < activation.indexOf('self.clients.claim()'));
  assert.equal(changed.length, 30);
  assert.ok(changed.every(path => /\/(ve|ts)\//.test(path)), 'ST is never part of the changed set');
  const origin = 'https://imbewufield.test';
  const stale = changed.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const otherIntro = ['st', 've', 'ts'].flatMap(language => Array.from({ length: 22 }, (_, index) =>
    `/course-decks/intro-permaculture/${language}/slide-${String(index + 1).padStart(2, '0')}.webp`)).filter(path => !changed.includes(path));
  assert.equal(otherIntro.length, 36, 'all 66 regional Intro frames minus the 30 changed frames stay');
  const preserved = [...otherIntro,
    '/course-decks/intro-permaculture/en/slide-19.jpg?cached=1',
    '/course-decks/intro-permaculture/zu/slide-14.webp?cached=1',
    '/course-decks/intro-permaculture/ve/slide-01.webp.bak',
    '/course-decks/water-harvesting/ve/slide-01.webp?cached=1',
    '/course-audio/intro-permaculture/st/slide-22.mp3?cached=1',
    '/course-audio/intro-permaculture/en/slide-01.mp3',
    '/course-animations/intro-permaculture/flow-zones.mp4',
    '/course-animations/intro-permaculture/posters/flow-zones.jpg'];
  const rows = new Map([...stale, ...preserved].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletes = 0; let writes = 0;
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
  assert.equal(deletes, 90); assert.equal(writes, 1);
  for (const path of changed) rows.set(new URL(path, origin).href, new Response('new learner-chosen frame'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(deletes, 90); assert.equal(writes, 1);
  for (const path of changed) assert.equal(await rows.get(new URL(path, origin).href)!.text(), 'new learner-chosen frame');
});

test('Intro compressed frames and manifest differ only at the approved 30 URLs with literal paired-source proof', () => {
  const proofText = read('docs/media/intro-ordinary-paired-2026-10-06/frames.json');
  assert.equal(createHash('sha256').update(proofText).digest('hex'), '27ada886605e17d8b32190417a54fce6aa108a171b0aa58bfc789481f646c28b',
    'frozen source/frame proof cannot silently adapt to a different implementation');
  const proof = JSON.parse(proofText);
  const baseline = JSON.parse(read('docs/study-translation-reviews/intro-ordinary-paired-2026-10-06/asset-manifest-before.json'));
  assert.equal(proof.acceptedPacketSHA256, '3297c1b24dba1a37de6976a0b66933a9796efffdb2be5bd8be7e9b027b8ee8e9');
  assert.equal(proof.frames.length, 30);
  assert.deepEqual(Object.keys(COURSE_ASSET_SIZES).sort(), Object.keys(baseline).sort(), 'no payload keys are added or removed');
  const changedSizes = Object.keys(baseline).filter(path => baseline[path] !== COURSE_ASSET_SIZES[path]).sort();
  assert.deepEqual(changedSizes, [...changed].sort(), 'only those rendered frames affect learner download estimates');
  assert.deepEqual(proof.frames.map((f: { asset: string }) => '/' + f.asset.replace(/^public\//, '')).sort(), [...changed].sort());
  for (const frame of proof.frames) {
    const bytes = readFileSync(new URL(`../${frame.asset}`, import.meta.url));
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
    assert.equal(bytes.length, frame.new.bytes);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), frame.new.sha256);
    assert.notEqual(frame.new.sha256, frame.old.sha256, 'rewritten targets must actually change the saved frame');
    assert.equal(frame.new.width, 1440); assert.equal(frame.new.height, 5400);
    const chunk = bytes.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      assert.equal(bytes.readUIntLE(24, 3) + 1, 1440);
      assert.equal(bytes.readUIntLE(27, 3) + 1, 5400);
    } else {
      assert.equal(chunk, 'VP8 ', 'the reviewed RGB frames have standard lossy WebP headers');
      assert.equal(bytes.subarray(23, 26).toString('hex'), '9d012a');
      assert.equal(bytes.readUInt16LE(26) & 0x3fff, 1440);
      assert.equal(bytes.readUInt16LE(28) & 0x3fff, 5400);
    }
    const deck = JSON.parse(read(`docs/narration/intro-permaculture.${frame.language}.paired-draft.json`));
    assert.deepEqual(frame.sourceAndAcceptedTargets, deck.slides.find((slide: { n: number }) => slide.n === frame.slide));
    assert.equal(COURSE_ASSET_SIZES['/' + frame.asset.replace(/^public\//, '')], bytes.length);
  }
});

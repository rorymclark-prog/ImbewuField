import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { veReadingFrostNativeBefore, veReadingFrostSourceBefore, veReadingFrostPairBefore, frostFiles, frostNative, ensureVeReadingFrostCurrent } from './ve-reading-frost-history-checks.ts';

const folder = 'docs/study-translation-reviews/ve-reading-frost-placement-2026-10-07/';
const planBytes = readFileSync(folder + 'root-accepted-plan.json');
assert.equal(createHash('sha256').update(planBytes).digest('hex'), '419b0d8229599492f81c5b8b9f37bdacfdcab7ebfd76fca88ae8de59c17e738c');
const plan = JSON.parse(planBytes.toString());
const ve = COURSE_MODULES.flatMap(module => module.lessons).filter(lesson => lesson.id.startsWith('reading-landscape-l'));
const learner = resolveLearnerLessonPresentation(ve[1], 've');
const deckPath = 'docs/narration/reading-landscape.ve.paired-draft.json';
const deck = JSON.parse(readFileSync(deckPath, 'utf8'));
const sourceL2 = ve[1];
const rootEnglish = 'Pawpaw and young citrus are sensitive to frost. Keep tender plants out of known low frost pockets. Observe local frost before planting.';
const l2Paragraph = learner.content.body.split('\n\n')[2];

test('VE Reading frost placements stay bound to the accepted English source and complete current registry', () => {
  assert.equal(sourceL2.body.split('\n\n')[2], rootEnglish);
  assert.match(l2Paragraph, /Ni songo vhea zwimela zwi sa konḓeleliho kha known low frost pockets\./);
  assert.doesNotMatch(l2Paragraph, /Ni songo vhea zwimela[^.]*kule na known low frost pockets/);
  assert.match(l2Paragraph, /Pawpaw na young citrus/);
  assert.match(l2Paragraph, /Sedzani frost ya henefho musi ni sa athu ṱavha\.$/);

  const slide14 = deck.slides.find((slide: any) => slide.n === 14).target.body[2];
  const observed = slide14.segments.filter((segment: any) => segment.sourceEnglish === 'you observe.');
  assert.equal(observed.length, 1);
  assert.equal(observed[0].text, 'dzine na dzi vhona.');
  const held = slide14.segments.find((segment: any) => segment.sourceEnglish === ' Keep sensitive plants away from the cold pockets ');
  assert.equal(held.text, ' Vhetshelani zwimela zwi sa konḓeleliho kule na cold pockets ');
  assert.equal(slide14.segments.at(-1).sourceEnglish, 'you observe.');

  const slide15 = deck.slides.find((slide: any) => slide.n === 15).target.body[0];
  const guarantee = slide15.segments.filter((segment: any) => segment.sourceEnglish === 'No hillside position guarantees freedom from frost.');
  assert.equal(guarantee.length, 1);
  assert.equal(guarantee[0].text, 'A hu na hillside position ine ya khwaṱhisedza uri a hu nga vhi na frost.');
  assert.doesNotMatch(guarantee[0].text, /thavha/);
  assert.equal(guarantee[0].sourceEnglish, 'No hillside position guarantees freedom from frost.');
  assert.equal(plan.summary.fluentApproval, false);
  assert.equal(plan.items.find((item: any) => item.id === 'VE-CG01').checkedMixedOption, guarantee[0].text);
});

test('changed English frost guidance withdraws the learner draft instead of showing stale placement advice', () => {
  const changed = structuredClone(sourceL2);
  changed.body = changed.body.replace('known low frost pockets', 'a different frost site');
  const fallback = resolveLearnerLessonPresentation(changed, 've');
  assert.equal(fallback.status, 'english-fallback');
  assert.equal(fallback.content.body, changed.body);
});

test('dated Reading snapshots reconstruct only the complete accepted frost batch', () => {
  ensureVeReadingFrostCurrent();
  assert.deepEqual(veReadingFrostNativeBefore('ve', TSHIVENDA_READING_LANDSCAPE_DRAFT), frostNative.before);
  const changedNative = structuredClone(TSHIVENDA_READING_LANDSCAPE_DRAFT);
  changedNative.lessons[1].body.tshivendaDraft += '!';
  assert.throws(() => veReadingFrostNativeBefore('ve', changedNative));
  const file = 'lib/course-translation-drafts-ve-reading-landscape.ts';
  assert.equal(veReadingFrostSourceBefore(file, readFileSync(file, 'utf8')), frostFiles[file].before);
  assert.throws(() => veReadingFrostSourceBefore(file, readFileSync(file, 'utf8') + '\n'));
  const pairedFile = 'docs/narration/reading-landscape.ve.paired-draft.json';
  const paired = JSON.parse(readFileSync(pairedFile, 'utf8'));
  assert.deepEqual(veReadingFrostPairBefore(pairedFile, paired), JSON.parse(frostFiles[pairedFile].before));
  const alteredPair = structuredClone(paired);
  alteredPair.reviewNotes += ' altered';
  assert.throws(() => veReadingFrostPairBefore(pairedFile, alteredPair));
});

test('only the two revised VE Reading stills lose stale cached copies once', async () => {
  const worker = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const body = worker.match(/async function migrateVeReadingFrostPlacementStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = worker.slice(worker.indexOf("self.addEventListener('activate'"));
  assert.equal([...activation.matchAll(/\.then\(migrateVeReadingFrostPlacementStills\)/g)].length, 1);
  assert.ok(activation.indexOf('migrateVeReadingFrostPlacementStills') < activation.indexOf('self.clients.claim()'));
  assert.doesNotMatch(body, /\bfetch\s*\(/);
  const paths = [
    '/course-decks/reading-landscape/ve/slide-14.webp',
    '/course-decks/reading-landscape/ve/slide-15.webp',
  ];
  assert.equal([...body.matchAll(/\/course-decks\/reading-landscape\/ve\/slide-\d+\.webp/g)].length, 2);
  const obsolete = paths.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const preserved = [
    '/course-decks/reading-landscape/ve/slide-13.webp?cached=1',
    '/course-decks/reading-landscape/ve/slide-16.webp?cached=1',
    '/course-decks/reading-landscape/st/slide-14.webp?cached=1',
    '/course-decks/reading-landscape/en/slide-14.jpg?cached=1',
    '/course-audio/reading-landscape/ve/slide-14.mp3?cached=1',
    '/course-audio/reading-landscape/en/slide-14.mp3?cached=1',
    '/course-animations/reading-landscape/shared-frost-film.mp4?cached=1',
    '/course-decks/reading-landscape/ve/slide-14.webp.bak?cached=1',
  ];
  const origin = 'https://field.test';
  const rows = new Map([...obsolete, ...preserved].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletions = 0;
  let writes = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletions++; return rows.delete(request.url); },
    put: async (key: string, value: Response) => { writes++; rows.set(new URL(key, origin).href, value); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'return (async () => {' + body + '})()');
  await run({ open: async (name: string) => { assert.equal(name, 'imbewu-course-v1'); return cache; } }, 'imbewu-course-v1', Response);
  for (const path of obsolete) assert.equal(rows.has(new URL(path, origin).href), false, path);
  for (const path of preserved) assert.equal(await rows.get(new URL(path, origin).href)!.text(), path, path);
  assert.equal(deletions, obsolete.length);
  assert.equal(writes, 1);
  const replacement = new URL(paths[0] + '?saved=new', origin).href;
  rows.set(replacement, new Response('new learner download'));
  await run({ open: async () => cache }, 'imbewu-course-v1', Response);
  assert.equal(await rows.get(replacement)!.text(), 'new learner download');
  assert.equal(deletions, obsolete.length);
  assert.equal(writes, 1);
});

test('asset size manifest matches the two compressed cards and proof preserves every other VE Reading still', () => {
  const assetProof = JSON.parse(readFileSync(folder + 'all-asset-sha-proof.json', 'utf8'));
  const changed = Object.entries(assetProof.assets).filter(([, row]: any) => row.changed).map(([path]) => path).sort();
  assert.deepEqual(changed, [
    '/course-decks/reading-landscape/ve/slide-14.webp',
    '/course-decks/reading-landscape/ve/slide-15.webp',
  ]);
  for (const [path, row] of Object.entries(assetProof.assets) as [string, any][]) {
    const file = 'public' + path;
    const bytes = readFileSync(file);
    assert.equal(COURSE_ASSET_SIZES[path], bytes.byteLength, path + ': manifest matches actual size');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.afterSha256, path + ': actual file matches full after digest');
    if (!row.changed) assert.equal(row.beforeSha256, row.afterSha256, path + ': unlisted still retains its exact before digest');
    else assert.notEqual(row.beforeSha256, row.afterSha256, path + ': revised still differs from the prior file');
  }
});

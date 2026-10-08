import { expandedAssets } from './core-ordinary-expanded-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { lightestAssetBefore } from './reading-title-lightest-media-history-checks.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT as stReading } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT as veMarket } from '../lib/course-translation-drafts-ve-market-community.ts';
import { currentBatchProof, ensureCurrentBatch, ensureFollowupCurrent, followupFiles, followupNative as followupRegistryProof, followupNativeBefore, followupPairBefore, followupSourceBefore } from './core-reading-vegetables-followup-history-checks.ts';
import { assertStudyRemainingControlsNative, studyRemainingControlsNativeBefore } from './study-remaining-controls-next-history-checks.ts';

const folder = 'docs/study-translation-reviews/core-reading-vegetables-followup-2026-10-07/';
const sha = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const planBytes = readFileSync(folder + 'accepted-plan.json');
assert.equal(sha(planBytes), '087f41d8006b3a6c58076b3fdbbd5c5f944deb7b563621e993b2ade2f9d698da', 'accepted field plan stays immutable');
const plan = JSON.parse(planBytes.toString());
const assetProofBytes = readFileSync(folder + 'asset-proof.json');
assert.equal(sha(assetProofBytes), 'afe4637d76e602c89d5bf2e4995026de6a8fb0611627687c7af4bd8310d66ce8', 'real-byte before/after proof stays immutable');
const assetProof = JSON.parse(assetProofBytes.toString());
const renderProofBytes = readFileSync(folder + 'render-proof.json');
assert.equal(sha(renderProofBytes), 'aa986d9cfc067ee3904d3b2cec3491656eed109c17cf9aa27166bf34d1f4608d', 'render dimensions and outputs stay tied to the accepted source');
const renderProof = JSON.parse(renderProofBytes.toString());

const changedPaths = [
  '/course-decks/reading-landscape/st/slide-15.webp',
  '/course-decks/reading-landscape/ts/slide-07.webp',
  '/course-decks/reading-landscape/ts/slide-12.webp',
  '/course-decks/reading-landscape/ts/slide-15.webp',
  '/course-decks/vegetables-staples/ve/slide-06.webp',
].sort();
const findCanonicalLesson = (id: string) => COURSE_MODULES.flatMap(module => module.lessons).find(lesson => lesson.id === id)!;

test('complete immutable snapshots reject edits outside the reviewed fields', () => {
  ensureFollowupCurrent();
  for (const [file, proof] of Object.entries(followupFiles)) {
    const bytes = readFileSync(file);
    assert.equal(Buffer.from(followupSourceBefore(file, bytes)).toString(), proof.before,
      `${file}: full-file predecessor is available only for the exact current bytes`);
    assert.throws(() => followupSourceBefore(file, Buffer.concat([bytes, Buffer.from('\ncorruption')])),
      `${file}: a change outside the accepted review must invalidate historical reconstruction`);
  }

  for (const file of plan.pairedFields.map((row: any) => row.file).filter((value: string, index: number, all: string[]) => all.indexOf(value) === index)) {
    const actual = JSON.parse(readFileSync(file, 'utf8'));
    const reconstructed = followupPairBefore(file, actual);
    assert.deepEqual(reconstructed, JSON.parse(followupFiles[file].before), `${file}: complete paired source and target return to their exact predecessor`);
    const corrupted = structuredClone(actual);
    const untouchedSlide = corrupted.slides.find((slide: any) => !plan.pairedFields.some((row: any) => row.file === file && row.slide === slide.n));
    assert.ok(untouchedSlide);
    untouchedSlide.english.body[0] += ' altered';
    assert.throws(() => followupPairBefore(file, corrupted), `${file}: unlisted source changes cannot be hidden by the five reviewed projections`);
  }

  // 8 October validates/projects its single exact observation hold before this older full-module claim.
  const stBeforeNextLayer = studyRemainingControlsNativeBefore(stReading);
  assert.deepEqual(followupNativeBefore(stBeforeNextLayer), followupRegistryProof.before.st,
    'the full Sesotho module is checked before its two current learner fields are projected');
  assert.deepEqual(followupNativeBefore(veMarket), followupRegistryProof.before.ve,
    'the full Tshivenda module is checked before its two current learner fields are projected');
  const corruptedNative = structuredClone(stReading);
  corruptedNative.description.sesothoDraft += ' altered';
  assert.throws(() => assertStudyRemainingControlsNative(corruptedNative), 'the complete newest layer rejects unlisted native edits');
  assert.throws(() => followupNativeBefore(studyRemainingControlsNativeBefore(corruptedNative)), 'unlisted native registry changes invalidate historical reconstruction');
});

test('five paired clauses preserve exact source, order, neighbouring segments and safety meaning', () => {
  assert.equal(plan.pairedFields.length, 5);
  for (const row of plan.pairedFields) {
    const paired = JSON.parse(readFileSync(row.file, 'utf8'));
    const slide = paired.slides.find((candidate: any) => candidate.n === row.slide);
    const source = slide.english.body[row.bodyIndex];
    const current = slide.target.body[row.bodyIndex];
    assert.equal(source, row.english, `${row.file} slide ${row.slide}: exact paired English remains unchanged`);
    assert.equal(current.status, row.before.status);
    const expected = structuredClone(row.before);
    assert.deepEqual(current, { ...expected, segments: expected.segments.map((segment: any, index: number) => index === row.segmentIndex ? row.newSegment : segment) },
      `${row.file} slide ${row.slide}: only the accepted segment changed; every neighboring segment and provenance remain exact`);
    assert.equal(current.segments.map((segment: any) => segment.sourceEnglish).join(''), source, 'source spans remain in original order');
    for (const segment of current.segments) {
      if (segment.status === 'english-hold') assert.equal('text' in segment, false, 'held English stays source-only');
      else if (segment.status === 'draft') assert.notEqual(segment.text, segment.sourceEnglish, 'a source copy cannot pose as translated prose');
    }
  }

  const sesothoNoGuarantee = plan.pairedFields[0].newSegment.text;
  const xitsongaNoGuarantee = plan.pairedFields[1].newSegment.text;
  assert.equal(sesothoNoGuarantee, 'Ha ho hillside position e ka tiisang hore ha ho frost.');
  assert.match(sesothoNoGuarantee, /Ha ho hillside position/);
  assert.match(sesothoNoGuarantee, /ha ho frost/);
  assert.equal(xitsongaNoGuarantee, 'A ku na hillside position leyi tiyisisaka leswaku ku nga vi na frost.');
  assert.match(xitsongaNoGuarantee, /A ku na hillside position/);
  assert.match(xitsongaNoGuarantee, /ku nga vi na frost/);

  const wind = plan.pairedFields[2];
  assert.ok(wind.newSegment.text.endsWith(' '), 'the wind sentence keeps its original separator');
  const windAfter = wind.before.segments.map((segment: any, index: number) => index === wind.segmentIndex ? wind.newSegment.text : segment.text ?? segment.sourceEnglish).join('');
  assert.match(windAfter, /ndhawu ya wena\. Famba-famba eka misava hi masiku lama nga ni moya\./, 'the next sentence remains separate and appears once');
  assert.match(wind.newSegment.text, /muganga, nguva na ti-ridges and gaps ta ndhawu ya wena/);

  const water = plan.pairedFields[3];
  const waterAfter = water.before.segments.map((segment: any, index: number) => index === water.segmentIndex ? water.newSegment.text : segment.text ?? segment.sourceEnglish).join('');
  assert.match(waterAfter, /Hlawula water works yin'wana ni yin'wana leyi faneleke ndhawu yoleyo, kutani u pulana/);
  assert.equal(water.before.segments[0].text.endsWith('Hlawula '), true);
  assert.equal(water.before.segments[2].text.startsWith(', kutani u pulana'), true);
  assert.match(water.newSegment.text, /yin'wana ni yin'wana/);
  assert.match(water.newSegment.text, /ndhawu yoleyo/);

  const comparison = plan.pairedFields[4];
  const comparisonAfter = comparison.before.segments.map((segment: any, index: number) => index === comparison.segmentIndex ? comparison.newSegment.text : segment.text ?? segment.sourceEnglish).join('');
  assert.match(comparisonAfter, /Zwi ita khwine musi zwi tshi zwaliwa nga ho livhaho hune zwa ḓo aluwa hone\./);
  assert.match(comparisonAfter, /Zwimela zwiṅwe a zwi takaleli/);
  assert.doesNotMatch(comparisonAfter, /grow better/i, 'the general comparative is not narrowed to crop growth');
  assert.match(comparisonAfter, /Beans, carrots na maize zwi wela kha tshigwada itsho\./, 'named crops and the group relation stay in order');
});

test('the two learner edits stay on their exact lesson and rationale clauses with source and answer bindings intact', () => {
  assert.equal(plan.learnerCandidates.length, 2);
  const stPlan = plan.learnerCandidates.find((row: any) => row.file.endsWith('course-translation-drafts-st-reading-landscape.ts'));
  const stCanonical = findCanonicalLesson('reading-landscape-l3');
  const stLesson = stReading.lessons.find(lesson => lesson.id === 'reading-landscape-l3')!;
  assert.equal(stLesson.body.sourceEnglish, stCanonical.body);
  const stSourceParagraphs = stCanonical.body.split('\n\n');
  const stDraftParagraphs = stLesson.body.sesothoDraft.split('\n\n');
  assert.equal(stSourceParagraphs[2], 'Frost is ice that forms on a cold surface. Mist alone does not show that ice has formed, and frost damage can happen without visible ice. Look for ice and plant damage, compare low ground with slopes, and check minimum temperatures where you can. Mark places where cold or damage lasts longest. Keep sensitive plants away from the cold pockets you observe.');
  assert.equal(stDraftParagraphs.length, stSourceParagraphs.length, 'all neighboring Sesotho paragraphs remain present');
  assert.ok(stDraftParagraphs[2].startsWith(stPlan.newSpan), 'only the frost-definition sentence is the accepted new span');
  assert.equal(stDraftParagraphs[2].split(stPlan.newSpan).length - 1, 1);
  assert.match(stDraftParagraphs[2], /Mohodi o le mong ha o bontshe hore leqhwa le entswe/);
  assert.match(stDraftParagraphs[2], /tshenyo ya serame e ka etsahala ntle le leqhwa le bonwang/);
  assert.match(stDraftParagraphs[2], /Boloka dimela tse kotsing habonolo hole le dipokotho tse batang \(cold pockets\) tseo o di hlokomelang\./);
  assert.doesNotMatch(stDraftParagraphs[2], /iphelang/);
  assert.deepEqual(stLesson.quiz.map(question => question.sourceCorrectIndex), stCanonical.quiz.map(question => question.correct), 'answer indices stay source-bound');

  const vePlan = plan.learnerCandidates.find((row: any) => row.file.endsWith('course-translation-drafts-ve-market-community.ts'));
  const veCanonical = findCanonicalLesson('market-community-l3');
  const veLesson = veMarket.lessons.find(lesson => lesson.id === 'market-community-l3')!;
  const veRationale = veLesson.quiz[1].rationale;
  assert.equal(veRationale.sourceEnglish, veCanonical.quiz[1].rationale);
  assert.equal(veRationale.sourceEnglish, 'Distance affects costs, but it is not the only factor. Use actual returns and losses to compare the options.');
  assert.equal(veRationale.tshivendaDraft, vePlan.newSpan + ' Shumisani actual returns na losses u vhambedza options.');
  assert.equal(veRationale.tshivendaDraft.split(vePlan.newSpan).length - 1, 1);
  assert.deepEqual(veLesson.quiz.map(question => question.sourceCorrectIndex), veCanonical.quiz.map(question => question.correct), 'Tshivenda rationale edit does not move quiz answers');
  assert.equal(veLesson.quiz[1].sourceCorrectIndex, 2);
});

test('the five approved WebPs match their exact byte proof, manifest sizes, and natural canvas', () => {
  ensureCurrentBatch();
  const latestAssets = new Map(currentBatchProof.assets.map(row => [row.url, row]));
  const proof = assetProof as Record<string, { beforeBytes: number; beforeSha256: string; afterBytes: number; afterSha256: string; changed: boolean }>;
  const changed = Object.entries(proof).filter(([, row]) => row.changed).map(([path]) => path).sort();
  assert.deepEqual(changed, changedPaths);
  assert.equal(Object.keys(proof).length, 60, 'proof covers the full Reading ST/TS and Vegetables VE still inventories');
  const rendered = new Map(renderProof.map((row: any) => [`/course-decks/${row.module}/${row.language}/slide-${String(row.slide).padStart(2, '0')}.webp`, row]));
  assert.equal(rendered.size, 5);
  for (const [path, row] of Object.entries(proof)) {
    const currentBytes = readFileSync('public' + path);
    // 8 October: this dated five-card inventory now receives the exact
    // predecessor after the independently guarded four-card still layer.
    const bytes = Buffer.from(lightestAssetBefore('public' + path, currentBytes));
    const latest = expandedAssets.find((row: any) => row.url === path) ?? latestAssets.get(path);
    if (latest) {
      assert.equal(latest.beforeBytes, row.afterBytes, `${path}: newest proof begins at the exact predecessor described by this proof`);
      assert.equal(latest.beforeSha256, row.afterSha256, `${path}: newest proof predecessor digest joins this proof`);
    }
    assert.equal(bytes.length, latest?.afterBytes ?? row.afterBytes, `${path}: actual file byte length at newest accepted layer`);
    assert.equal(sha(bytes), latest?.afterSha256 ?? row.afterSha256, `${path}: full current SHA-256 at newest accepted layer`);
    assert.equal(COURSE_ASSET_SIZES[path], currentBytes.length, `${path}: live published size manifest matches actual bytes`);
    if (!row.changed) assert.equal(row.beforeSha256, row.afterSha256, `${path}: every unlisted asset retains its prior digest`);
  }
  for (const path of changedPaths) {
    const row = proof[path];
    const render = rendered.get(path) as any;
    const bytes = Buffer.from(lightestAssetBefore('public' + path, readFileSync('public' + path)));
    assert.notEqual(row.beforeSha256, row.afterSha256, `${path}: changed card differs from saved version`);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.equal(bytes.subarray(12, 16).toString(), 'VP8 ');
    const dimensions = [bytes.readUInt16LE(26) & 0x3fff, bytes.readUInt16LE(28) & 0x3fff];
    assert.deepEqual(dimensions, [1440, 5400], `${path}: natural rendered canvas`);
    assert.deepEqual(render.dimensions, dimensions, `${path}: render proof matches actual image dimensions`);
    assert.equal(render.bytes, bytes.length);
    assert.equal(render.sha256, sha(bytes));
  }
});

test('the selective cache migration retires only five stills once and preserves other media and later packs', async () => {
  const source = readFileSync(new URL('../app/sw.js/route.ts', import.meta.url), 'utf8');
  const name = 'migrateCoreReadingVegetablesFollowupStills';
  const body = source.match(/async function migrateCoreReadingVegetablesFollowupStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const migrationChain = [...activation.matchAll(/\.then\((migrate\w+)\)/g)].map(match => match[1]);
  assert.equal(migrationChain.filter(migration => migration === name).length, 1);
  assert.ok(migrationChain.indexOf(name) > migrationChain.indexOf('migrateVeReadingFrostPlacementStills'));
  assert.ok(activation.indexOf('self.clients.claim()') > activation.indexOf(name), 'refresh finishes before clients are claimed');
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation never downloads stills');
  const listed = [...body.matchAll(/\/course-decks\/[\w/-]+\.webp/g)].map(match => match[0]).sort();
  assert.deepEqual(listed, changedPaths, 'the worker names exactly the five accepted stills');

  const origin = 'https://field.test';
  const stale = changedPaths.flatMap(path => [path, `${path}?saved=old`, `${path}?width=390`]);
  const changedSet = new Set(changedPaths);
  const otherCards = Object.keys(assetProof).filter(path => !changedSet.has(path)).flatMap(path => [path, `${path}?cached=old`]);
  const preservedMedia = [
    '/course-audio/reading-landscape/st/slide-15.mp3?saved=1',
    '/course-audio/reading-landscape/ts/slide-12.mp3?saved=1',
    '/course-audio/vegetables-staples/ve/slide-06.mp3?saved=1',
    '/course-animations/reading-landscape/frost-flow.mp4?saved=1',
    '/course-animations/vegetables-staples/ve/bed-seasons.mp4?saved=1',
    '/course-decks/reading-landscape/en/slide-15.jpg?saved=1',
    '/course-decks/reading-landscape/st/slide-15.webp.bak?saved=1',
  ];
  const entries = new Map([...stale, ...otherCards, ...preservedMedia].map(path => [new URL(path, origin).href, new Response(path)]));
  let deletions = 0;
  let writes = 0;
  let fetches = 0;
  const cache = {
    match: async (key: string) => entries.get(new URL(key, origin).href),
    keys: async () => [...entries.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deletions++; return entries.delete(request.url); },
    put: async (key: string, response: Response) => { writes++; entries.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', 'fetch', `return (async () => {${body}})()`);
  const invoke = () => run({ open: async (key: string) => { assert.equal(key, 'imbewufield-course-v1'); return cache; } }, 'imbewufield-course-v1', Response, () => { fetches++; throw new Error('migration must never fetch'); });
  await invoke();
  for (const path of stale) assert.equal(entries.has(new URL(path, origin).href), false, `${path}: stale still/query variant removed`);
  for (const path of otherCards) assert.equal(entries.has(new URL(path, origin).href), true, `${path}: unlisted course card remains`);
  for (const path of preservedMedia) assert.equal(entries.has(new URL(path, origin).href), true, `${path}: audio/film/nonstill remains`);
  const marker = '/course-decks/.core-reading-vegetables-followup-20261007';
  assert.equal(await entries.get(new URL(marker, origin).href)?.text(), 'Refreshed five source-paired ordinary clause stills');
  assert.equal(deletions, stale.length, 'only five exact paths and their query variants were deleted');
  assert.equal(writes, 1, 'the migration writes one marker');
  assert.equal(fetches, 0);

  const laterPack = changedPaths.flatMap((path, index) => [
    [new URL(path, origin).href, `later pack still ${index}`] as const,
    [new URL(`${path}?saved=new`, origin).href, `later pack variant ${index}`] as const,
  ]);
  for (const [url, value] of laterPack) entries.set(url, new Response(value));
  await invoke();
  for (const [url, value] of laterPack) assert.equal(await entries.get(url)!.text(), value, `${url}: later saved pack is preserved`);
  assert.equal(deletions, stale.length, 'once marked, later activation performs no more deletions');
  assert.equal(writes, 1, 'once marked, later activation does not rewrite the marker');
  assert.equal(fetches, 0);
});

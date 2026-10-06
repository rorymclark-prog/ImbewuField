import { silentIntroAssetSizesBefore } from './intro-silent-media-history-checks.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_ASSET_SIZES } from '../lib/course-asset-sizes.ts';
import { SESOTHO_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-st-soil-health.ts';
import { TSHIVENDA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ve-soil-health.ts';
import { XITSONGA_SOIL_HEALTH_DRAFT } from '../lib/course-translation-drafts-ts-soil-health.ts';
import { SESOTHO_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-st-water-harvesting.ts';
import { TSHIVENDA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ve-water-harvesting.ts';
import { XITSONGA_WATER_HARVESTING_DRAFT } from '../lib/course-translation-drafts-ts-water-harvesting.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';

type Data = Record<string, any>;
const reviewDir = 'docs/study-translation-reviews/soil-water-residual-2026-10-06/';
const baselineBytes = readFileSync(reviewDir + 'baseline-before.json');
const baseline = JSON.parse(baselineBytes.toString()) as Data;
const proofBytes = readFileSync('docs/study-translation-reviews/soil-water-residual-implementation-2026-10-06.json');
const proof = JSON.parse(proofBytes.toString()) as Data;
const mediaBytes = readFileSync('docs/media/soil-water-residual-2026-10-06/frames.json');
const media = JSON.parse(mediaBytes.toString()) as Data;
const digest = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const targetProp = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const nativeByPath: Record<string, Data> = {
  'lib/course-translation-drafts-st-soil-health.ts': SESOTHO_SOIL_HEALTH_DRAFT,
  'lib/course-translation-drafts-ve-soil-health.ts': TSHIVENDA_SOIL_HEALTH_DRAFT,
  'lib/course-translation-drafts-ts-soil-health.ts': XITSONGA_SOIL_HEALTH_DRAFT,
  'lib/course-translation-drafts-st-water-harvesting.ts': SESOTHO_WATER_HARVESTING_DRAFT,
  'lib/course-translation-drafts-ve-water-harvesting.ts': TSHIVENDA_WATER_HARVESTING_DRAFT,
  'lib/course-translation-drafts-ts-water-harvesting.ts': XITSONGA_WATER_HARVESTING_DRAFT,
};

function nativePair(module: Data, row: Data): Data {
  const lesson = module.lessons.find((item: Data) => item.id === row.lessonId);
  assert.ok(lesson, row.fieldId);
  const key = targetProp[row.language as keyof typeof targetProp];
  if (row.field.startsWith('body.paragraph[') || row.field.startsWith('body[')) {
    const index = Number(row.field.match(/\[(\d+)\]/)?.[1]);
    const source = lesson.body.sourceEnglish.split('\n\n')[index];
    const target = lesson.body[key].split('\n\n')[index];
    return { sourceEnglish: source, target, status: lesson.body.reviewStatus,
      set(value: string) {
        const body = lesson.body[key].split('\n\n');
        body[index] = value;
        lesson.body[key] = body.join('\n\n');
      } };
  }
  if (row.field === 'title' || row.field === 'infographicAlt') {
    const pair = lesson[row.field];
    return { sourceEnglish: pair.sourceEnglish, target: pair[key], status: pair.reviewStatus,
      set(value: string) { pair[key] = value; } };
  }
  let match = row.field.match(/^keyPoints\[(\d+)\]$/);
  if (match) {
    const pair = lesson.keyPoints[Number(match[1])];
    return { sourceEnglish: pair.sourceEnglish, target: pair[key], status: pair.reviewStatus,
      set(value: string) { pair[key] = value; } };
  }
  match = row.field.match(/^quiz\[(\d+)\]\.(question|rationale)$/);
  if (match) {
    const pair = lesson.quiz[Number(match[1])][match[2]];
    return { sourceEnglish: pair.sourceEnglish, target: pair[key], status: pair.reviewStatus,
      set(value: string) { pair[key] = value; } };
  }
  match = row.field.match(/^quiz\[(\d+)\]\.options?\[(\d+)\]$/);
  if (match) {
    const pair = lesson.quiz[Number(match[1])].options[Number(match[2])];
    return { sourceEnglish: pair.sourceEnglish, target: pair[key], status: pair.reviewStatus,
      set(value: string) { pair[key] = value; } };
  }
  throw new Error(`Unmapped accepted native field: ${row.fieldId}`);
}

function expectedNativeDrafts(): Record<string, Data> {
  const expected = structuredClone(baseline.nativeBefore) as Record<string, Data>;
  for (const body of proof.actualFullBodyParagraphDiffs as Data[]) {
    const path = `lib/course-translation-drafts-${body.language}-${body.domain === 'soil' ? 'soil-health' : 'water-harvesting'}.ts`;
    const lesson = expected[path].lessons.find((item: Data) => item.id === body.lessonId);
    const key = targetProp[body.language as keyof typeof targetProp];
    assert.deepEqual(lesson.body.sourceEnglish.split('\n\n'), body.paragraphs.map((p: Data) => p.sourceEnglish));
    assert.deepEqual(lesson.body[key].split('\n\n'), body.paragraphs.map((p: Data) => p.before));
    lesson.body[key] = body.paragraphs.map((p: Data) => p.after).join('\n\n');
  }
  for (const row of proof.actualNativeLeafDeltas as Data[]) {
    if (row.field.startsWith('body.paragraph[') || row.field.startsWith('body[')) continue;
    const actual = nativePair(expected[row.path], row);
    assert.equal(actual.sourceEnglish, row.sourceEnglish, row.fieldId);
    assert.equal(actual.target, row.before, row.fieldId);
    assert.equal(actual.status, row.statusBefore, row.fieldId);
    if (!row.field.startsWith('body.paragraph[') && !row.field.startsWith('body[')) actual.set(row.after);
  }
  return expected;
}

function actualPairedDeck(path: string): Data {
  return JSON.parse(readFileSync(path, 'utf8').toString());
}

test('the accepted residual layer reconstructs all six native drafts and preserves unlisted fields', () => {
  assert.equal(digest(baselineBytes), '691fa5d8108366d09df19875bc77e01575ca30979fc67cae21ed3dcc39c1cbe7');
  assert.equal(digest(proofBytes), 'eec8f0206784f039323d9eb5ce84be6b409b25e632ec6f7d9470f8f32acd398b');
  assert.equal(baseline.baseHead, 'ca7eca1f1f94d76ca2e0343abdd24dd46db821b8');
  assert.equal(proof.scope.nativeFields, 46);
  assert.equal(proof.scope.acceptedFields, 47);
  assert.equal(proof.actualNativeLeafDeltas.length, 46);
  assert.equal(proof.actualFullBodyParagraphDiffs.length, 12);
  assert.equal(proof.invariantsFromActualBaseVersusCurrent.nativeAllEqualAcceptedProposal, true);
  assert.equal(proof.checks.allNativeFilesReconstructFromBaselineWithAcceptedLiteralReplacementsOnly, true);

  const expected = expectedNativeDrafts();
  for (const [path, draft] of Object.entries(nativeByPath)) {
    assert.deepEqual(draft, expected[path], `${path}: every unlisted leaf, source, and status remains exact`);
  }

  for (const row of proof.actualNativeLeafDeltas as Data[]) {
    const pair = nativePair(nativeByPath[row.path], row);
    assert.equal(pair.sourceEnglish, row.sourceEnglish, row.fieldId);
    assert.equal(pair.target, row.acceptedProposedTarget, row.fieldId);
    assert.equal(pair.target, row.after, row.fieldId);
    assert.equal(pair.status, row.statusAfter, row.fieldId);
    assert.equal(row.equalsAcceptedProposal, true, row.fieldId);
  }

  for (const body of proof.actualFullBodyParagraphDiffs as Data[]) {
    const path = `lib/course-translation-drafts-${body.language}-${body.domain === 'soil' ? 'soil-health' : 'water-harvesting'}.ts`;
    const lesson = nativeByPath[path].lessons.find((item: Data) => item.id === body.lessonId);
    const key = targetProp[body.language as keyof typeof targetProp];
    assert.deepEqual(lesson.body.sourceEnglish.split('\n\n'), body.paragraphs.map((p: Data) => p.sourceEnglish));
    assert.deepEqual(lesson.body[key].split('\n\n'), body.paragraphs.map((p: Data) => p.after));
    assert.equal(lesson.body.reviewStatus, body.bodyStatusBefore);
    assert.equal(lesson.body.reviewStatus, body.bodyStatusAfter);
    for (const paragraph of body.paragraphs.filter((p: Data) => !p.changed)) {
      assert.equal(paragraph.before, paragraph.after, `${body.language}/${body.lessonId}/${paragraph.index}`);
    }
  }
});

test('paired cells reconstruct from the immutable before decks with only accepted target text and provenance changes', () => {
  assert.equal(proof.scope.pairedBoundTextCells, 19);
  assert.equal(proof.scope.distinctPairedFrames, 18);
  assert.equal(proof.actualPairedCellDeltas.length, 19);
  assert.equal(proof.pairedCellCountCorrection.actualUniqueBoundCellLocators, 19);
  const expected = structuredClone(baseline.pairedBefore) as Record<string, Data>;
  const seen: string[] = [];
  for (const row of proof.actualPairedCellDeltas as Data[]) {
    const deck = expected[row.path];
    const slide = deck.slides.find((item: Data) => item.n === row.slide);
    assert.ok(slide, row.fieldId);
    const cell = row.bodyIndex === undefined ? slide.target.heading : slide.target.body[row.bodyIndex];
    const source = row.bodyIndex === undefined ? slide.english.heading : slide.english.body[row.bodyIndex];
    assert.equal(source, row.sourceEnglish, row.fieldId);
    assert.equal(cell.text, row.before, row.fieldId);
    assert.equal(cell.status, row.statusBefore, row.fieldId);
    cell.text = row.after;
    cell.provenance = row.provenanceAfter;
    seen.push(`${row.path}#${row.slide}/${row.bodyIndex ?? 'heading'}`);
  }
  assert.equal(new Set(seen).size, 19);
  for (const [path, deck] of Object.entries(expected)) {
    assert.deepEqual(actualPairedDeck(path), deck, `${path}: slide order, sources, statuses, and unlisted cells remain exact`);
  }
  for (const row of proof.actualPairedCellDeltas as Data[]) {
    const deck = actualPairedDeck(row.path);
    const slide = deck.slides.find((item: Data) => item.n === row.slide);
    const cell = row.bodyIndex === undefined ? slide.target.heading : slide.target.body[row.bodyIndex];
    const source = row.bodyIndex === undefined ? slide.english.heading : slide.english.body[row.bodyIndex];
    assert.equal(source, row.sourceEnglish, row.fieldId);
    assert.equal(cell.text, row.acceptedProposedTarget, row.fieldId);
    assert.equal(cell.status, row.statusBefore, row.fieldId);
    assert.equal(cell.provenance, row.provenanceAfter, row.fieldId);
  }
});

test('ordinary Soil and Water predicates retain source scope, conditions, and safety boundaries', () => {
  const tsSoil = XITSONGA_SOIL_HEALTH_DRAFT.lessons[0].body.xitsongaDraft.split('\n\n')[0];
  assert.match(tsSoil, /Bacteria na fungi/);
  assert.match(tsSoil, /organic matter yi bola/);
  assert.match(tsSoil, /nutrients ti famba hi xirhendzevutana/);

  const stCompost = SESOTHO_SOIL_HEALTH_DRAFT.lessons[1].body.sesothoDraft.split('\n\n');
  const veCompost = TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[1].body.tshivendaDraft.split('\n\n');
  for (const [target, orderedInputs] of [
    [stCompost[7], ['nama', 'dihlahiswa tsa maswi', 'dimela tse kulang', 'pet waste', 'contaminated materials']],
    [veCompost[7], ['nyama', 'zwibveledzwa zwa mafhi', 'zwimela zwi re na malwadze', 'pet waste', 'contaminated materials']],
  ] as const) {
    let previous = -1;
    for (const input of orderedInputs) {
      const at = target.indexOf(input);
      assert.ok(at > previous, `${input} remains a distinct excluded input in source order`);
      previous = at;
    }
    assert.doesNotMatch(target, /livestock/);
  }
  assert.match(stCompost[10], /clean, untreated materials feela/);
  assert.match(stCompost[10], /Bark e bola butle/);
  assert.match(stCompost[10], /lebitso la yona feela ha le pake/);
  assert.match(veCompost[10], /clean, untreated materials/);
  assert.match(veCompost[10], /dzina layo fhedzi a si vhuṱanzi/);

  const leachateSources = [
    SESOTHO_SOIL_HEALTH_DRAFT.lessons[2].body.sourceEnglish.split('\n\n')[8],
    TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[2].body.sourceEnglish.split('\n\n')[8],
    XITSONGA_SOIL_HEALTH_DRAFT.lessons[2].body.sourceEnglish.split('\n\n')[8],
  ];
  assert.ok(leachateSources.every(source => source.includes('edible plants') && source.includes('dilution makes it safe')));
  const leachateTargets = [
    SESOTHO_SOIL_HEALTH_DRAFT.lessons[2].body.sesothoDraft.split('\n\n')[8],
    TSHIVENDA_SOIL_HEALTH_DRAFT.lessons[2].body.tshivendaDraft.split('\n\n')[8],
    XITSONGA_SOIL_HEALTH_DRAFT.lessons[2].body.xitsongaDraft.split('\n\n')[8],
  ];
  assert.match(leachateTargets[0], /harmful organisms.*dintho tse kotsi/);
  assert.match(leachateTargets[0], /O se ke wa e sebedisa dimeleng tse ka jewang.*ho e hlapolla/);
  assert.match(leachateTargets[1], /Ni songo i shumisa kha zwimela zwine zwa nga ḽiwa.*dilution/);
  assert.match(leachateTargets[2], /U nga yi tirhisi eka swimilani leswi dyiwaka/);
  assert.match(leachateTargets[2], /dilution yi endla leswaku yi hlayiseka/);
  assert.ok(leachateTargets.every(target => !target.includes('food crops')),
    'the accepted target keeps the wider edible-plants scope instead of narrowing it to food crops');

  const vegSwale = TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[0].body.tshivendaDraft.split('\n\n')[0];
  assert.match(vegSwale, /Lushaka luthihi.*level trench on contour/);
  assert.match(vegSwale, /slight, controlled grade.*maḓi o engedzeaho.*safe outlet/);
  assert.match(vegSwale, /land yaṋu.*mavu, slope, drainage na storm flow/);
  assert.match(vegSwale, /Musi ni sa athu u bwa.*trained local adviser.*line, overflow/);
  const receiving = TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[0].body.tshivendaDraft.split('\n\n')[4];
  assert.match(receiving, /a i tei u erode slope.*kana.*muhura/);
  assert.match(receiving, /Swale ya downstream kana damu.*ṱanganedza maḓi ayo safely/);

  const tsReuse = XITSONGA_WATER_HARVESTING_DRAFT.lessons[3];
  assert.match(tsReuse.body.xitsongaDraft.split('\n\n')[4], /system.*se ri karhi yi tirha naswona.*ma nunha.*kumbe.*ma onha.*tshika ku ma tirhisa kutani.*ndzayo/);
  assert.match(tsReuse.keyPoints[1].xitsongaDraft, /^Before any reuse,/);
  assert.match(tsReuse.keyPoints[1].xitsongaDraft, /xihlovo.*xiyimo xa vukorhokeri.*ku tirhisiwa.*ndhawu.*nkambelo wa laha kaya/);
  const veReuse = TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[3].body.tshivendaDraft.split('\n\n')[4];
  assert.match(veReuse, /system.*yo no thoma u shuma.*nahone tshiṅwe tsha izwi tsha itea: maḓi a tshi nukha.*a tshi kuvhangana.*kana a tshi tshinya zwimela.*litshani.*qualified local advice/);
  assert.match(TSHIVENDA_WATER_HARVESTING_DRAFT.lessons[0].body.sourceEnglish.split('\n\n')[4], /downstream swale or dam must be able to receive it safely/);
});

test('a source edit makes the changed regional lesson fall back to exact English', () => {
  for (const [moduleId, language] of [
    ['soil-health', 'st'], ['soil-health', 'ts'], ['soil-health', 've'],
    ['water-harvesting', 'st'], ['water-harvesting', 'ts'], ['water-harvesting', 've'],
  ] as const) {
    const canonical = COURSE_MODULES.find(module => module.id === moduleId)!;
    const lesson = canonical.lessons[0];
    const changed = { ...lesson, body: lesson.body + ' Source predicate changed.' };
    const shown = resolveLearnerLessonPresentation(changed, language);
    assert.equal(shown.status, 'english-fallback', `${moduleId}/${language}`);
    assert.equal(shown.content.body, changed.body);
  }
});

test('the 18 approved frames and every protected media inventory match the durable byte proof', () => {
  assert.equal(digest(mediaBytes), 'abfc32697890076025c169f4efa854ef433e30107a23776e7a76c4e353afb9d3');
  assert.equal(proof.scope.pairedBoundTextCells, 19);
  assert.equal(media.scope.copiedFrames, 18);
  assert.equal(media.renderedFrames.length, 18);
  const expectedPaths = [
    ...[4, 9, 12, 13, 17].map(slide => `/course-decks/soil-health/st/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[4, 8, 9, 17].map(slide => `/course-decks/soil-health/ts/slide-${String(slide).padStart(2, '0')}.webp`),
    ...[12, 13, 17].map(slide => `/course-decks/soil-health/ve/slide-${String(slide).padStart(2, '0')}.webp`),
    '/course-decks/water-harvesting/ts/slide-22.webp',
    ...[6, 15, 17, 18, 22].map(slide => `/course-decks/water-harvesting/ve/slide-${String(slide).padStart(2, '0')}.webp`),
  ].sort();
  assert.deepEqual(media.renderedFrames.map((row: Data) => `/${row.path.replace(/^public\//, '')}`).sort(), expectedPaths);
  for (const row of media.renderedFrames as Data[]) {
    const bytes = readFileSync(row.path);
    assert.equal(digest(bytes), row.sha256After, row.path);
    assert.notEqual(row.sha256Before, row.sha256After, row.path);
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF', row.path);
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP', row.path);
    assert.equal(bytes.toString('ascii', 12, 16), 'VP8 ', row.path);
    assert.equal((bytes.readUInt16LE(26) & 0x3fff), 1440, `${row.path}: width`);
    assert.equal((bytes.readUInt16LE(28) & 0x3fff), 5400, `${row.path}: height`);
    assert.equal(bytes.length, row.bytes, row.path);
    assert.equal(COURSE_ASSET_SIZES[`/${row.path.replace(/^public\//, '')}`], bytes.length, `${row.path}: offline size`);
  }
  assert.equal(media.soilAndWaterDeckAssets.length, 222);
  assert.equal(media.soilAndWaterDeckAssets.filter((row: Data) => row.changed).length, 18);
  for (const row of media.soilAndWaterDeckAssets.filter((item: Data) => !item.changed)) {
    assert.equal(row.sha256Before, row.sha256After, row.path);
    assert.equal(digest(readFileSync(row.path)), row.sha256After, row.path);
  }
  for (const rows of [media.unlistedCourseAudio, media.unlistedCourseAnimations, media.introSesothoStills] as Data[][]) {
    for (const row of rows) {
      assert.equal(row.sha256Before, row.sha256After, row.path);
      assert.equal(digest(readFileSync(row.path)), row.sha256After, row.path);
    }
  }
  assert.equal(media.unlistedCourseAudio.length, 523);
  assert.equal(media.unlistedCourseAnimations.length, 81);
  assert.equal(media.introSesothoStills.length, 22);
  // 6 October 2026: the later22 new silent URLs are validated before the dated1905-entry claim.
  const predecessor = silentIntroAssetSizesBefore();
  assert.equal([...predecessor.matchAll(/^  '[^']+': (\d+),$/gm)].length, 1905);
});

test('the residual cache migration removes only exact frame paths and query variants once', async () => {
  const source = readFileSync('app/sw.js/route.ts', 'utf8');
  const body = source.match(/async function migrateSoilWaterResidualOrdinaryPairedStills\(\) \{([\s\S]*?)\n\}/)?.[1];
  assert.ok(body);
  assertActivationOrder(source, 'migrateSoilOrdinaryCompletionStills', 'migrateSoilWaterResidualOrdinaryPairedStills',
    'the residual still refresh follows prior Soil and Water migrations');
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  assert.ok(activation.indexOf('migrateSoilWaterResidualOrdinaryPairedStills') < activation.indexOf('self.clients.claim()'));
  assert.equal([...activation.matchAll(/\.then\(migrateSoilWaterResidualOrdinaryPairedStills\)/g)].length, 1);

  const paths = expectedPathsForMigration();
  assert.equal(paths.length, 18);
  const stale = paths.flatMap(path => [path, `${path}?saved=old`, `${path}?width=small`]);
  const protectedUrls = [
    ...media.soilAndWaterDeckAssets.filter((row: Data) => !row.changed).map((row: Data) => `/${row.path.replace(/^public\//, '')}?keep=1`),
    '/course-decks/soil-health/st/slide-04.webp.bak?keep=1',
    '/course-decks/water-harvesting/ve/slide-18.webp.extra?keep=1',
    '/course-decks/water-harvesting/ve/slide-18.jpg?keep=1',
    '/course-decks/intro-permaculture/st/slide-22.webp?keep=1',
    '/course-audio/soil-health/en/slide-13.mp3?keep=1',
    '/course-audio/intro-permaculture/st/slide-22.mp3?keep=1',
    '/course-animations/soil-health/flow-build-compost-heap.mp4?keep=1',
    '/course-decks/vegetables-staples/ve/slide-14.webp?keep=1',
  ];
  const origin = 'https://field.test';
  const staleUrls = stale.map(path => new URL(path, origin).href);
  const preserveUrls = [...new Set(protectedUrls)].map(path => new URL(path, origin).href);
  const rows = new Map<string, Response>([
    ...staleUrls.map(url => [url, new Response('stale residual frame')] as const),
    ...preserveUrls.map(url => [url, new Response('protected offline media')] as const),
  ]);
  let deleted = 0;
  let written = 0;
  const cache = {
    match: async (key: string) => rows.get(new URL(key, origin).href),
    keys: async () => [...rows.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { deleted += 1; return rows.delete(request.url); },
    put: async (key: string, response: Response) => { written += 1; rows.set(new URL(key, origin).href, response); },
  };
  const run = new Function('caches', 'COURSE_CACHE', 'Response', `return (async () => { ${body} })()`);
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  for (const url of staleUrls) assert.equal(rows.has(url), false, url);
  for (const url of preserveUrls) assert.equal(rows.has(url), true, url);
  assert.equal(deleted, staleUrls.length, 'all variants of only 18 current still paths are deleted');
  const marker = new URL('/course-decks/.soil-water-residual-ordinary-stills-20261006', origin).href;
  assert.equal(rows.has(marker), true);
  assert.equal(written, 1);
  assert.doesNotMatch(body, /\bfetch\s*\(/, 'activation does not download or replace learner-selected media');

  const later = new URL(paths[0] + '?saved=new', origin).href;
  rows.set(later, new Response('learner downloaded the new image'));
  await run({ open: async () => cache }, 'imbewufield-course-v1', Response);
  assert.equal(await rows.get(later)!.text(), 'learner downloaded the new image');
  assert.equal(deleted, staleUrls.length, 'the marker prevents deletion on later activation');
  assert.equal(written, 1, 'later activation does not rewrite the marker');

  const markerOnly = new Map<string, Response>([[marker, new Response('already migrated')], ...staleUrls.map(url => [url, new Response('must remain when marker exists')] as const)]);
  let markerRunDeletes = 0;
  const markerCache = {
    match: async (key: string) => markerOnly.get(new URL(key, origin).href),
    keys: async () => [...markerOnly.keys()].map(url => new Request(url)),
    delete: async (request: Request) => { markerRunDeletes += 1; return markerOnly.delete(request.url); },
    put: async (key: string, response: Response) => { markerOnly.set(new URL(key, origin).href, response); },
  };
  await run({ open: async () => markerCache }, 'imbewufield-course-v1', Response);
  assert.equal(markerRunDeletes, 0, 'an existing marker short-circuits before enumerating/deleting cached entries');
  for (const url of staleUrls) assert.equal(markerOnly.has(url), true, url);
});

function expectedPathsForMigration(): string[] {
  return media.renderedFrames.map((row: Data) => `/${row.path.replace(/^public\//, '')}`);
}

function assertActivationOrder(source: string, beforeName: string, currentName: string, message: string): void {
  const activation = source.slice(source.indexOf("self.addEventListener('activate'"));
  const before = activation.indexOf(`.then(${beforeName})`);
  const current = activation.indexOf(`.then(${currentName})`);
  const claim = activation.indexOf('self.clients.claim()');
  assert.ok(before >= 0 && current > before && claim > current, message);
}

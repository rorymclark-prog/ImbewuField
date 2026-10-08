import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT as st } from '../lib/course-translation-drafts-st-reading-landscape.ts';

const folder = 'docs/study-translation-reviews/study-remaining-controls-next-2026-10-08/';
const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
const repositoryPath = (file: string) => resolve(repositoryRoot, file);
const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const packetBytes = readFileSync(repositoryPath(folder + 'applied-packet.json'));
assert.equal(sha(packetBytes), '374b035a328352a818dd5be85c1fb69e19fd864ffa4d203e8d2f68c9e4ccf33a', 'immutable 8 October source-bound layer packet');
const packet = JSON.parse(packetBytes.toString());
assert.equal(packet.baseHead, '81174107268ec951ac3b1deb8dd57a3b36268d43');
const readProof = (path: string, expectedSha256: string) => {
  const bytes = readFileSync(repositoryPath(folder + path));
  assert.equal(sha(bytes), expectedSha256, path + ': exact saved review evidence');
  return bytes;
};
const rootBytes = readProof(packet.rootReviewedPacket.path, packet.rootReviewedPacket.sha256);
const rootReviewed = JSON.parse(rootBytes.toString());
assert.equal(rootReviewed.status, 'ROOT_REVIEWED_DATA_ONLY_UNWIRED');
assert.equal(rootReviewed.acceptedRows.length, 6);
assert.equal(rootReviewed.heldRows.length, 2);
readProof(packet.independentSemanticCheck.path, packet.independentSemanticCheck.sha256);
const stPlanBytes = readProof(packet.stReviewPlan.path, packet.stReviewPlan.sha256);
const stPlan = JSON.parse(stPlanBytes.toString());
const anchorsBytes = readProof(packet.sourceAnchors.path, packet.sourceAnchors.sha256);
const anchors = JSON.parse(anchorsBytes.toString());
const beforeLocaleBytes = readProof(packet.locale.beforeSnapshot, packet.locale.beforeSnapshotSha256);
const afterLocaleBytes = readProof(packet.locale.afterSnapshot, packet.locale.afterSnapshotSha256);
const beforeStBytes = readProof(packet.sesotho.beforeSnapshot, packet.sesotho.beforeSnapshotSha256);
const afterStBytes = readProof(packet.sesotho.afterSnapshot, packet.sesotho.afterSnapshotSha256);
const beforeLocale = JSON.parse(beforeLocaleBytes.toString());
const afterLocale = JSON.parse(afterLocaleBytes.toString());
const beforeSt = JSON.parse(beforeStBytes.toString());
const afterSt = JSON.parse(afterStBytes.toString());
assert.equal(sha(readFileSync(repositoryPath(folder + packet.locale.beforeSourceSnapshot))), packet.locale.beforeSourceSnapshotSha256, 'exact prior Tshivenda source bytes');
assert.equal(sha(readFileSync(repositoryPath(folder + packet.sesotho.beforeSourceSnapshot))), packet.sesotho.beforeSourceSnapshotSha256, 'exact prior Sesotho source bytes');

const expectedLocale = structuredClone(beforeLocale);
assert.deepEqual(packet.locale.addedKeys, rootReviewed.acceptedRows.map((row: any) => row.key));
assert.deepEqual(packet.locale.heldKeys, rootReviewed.heldRows.map((row: any) => row.key));
for (const row of rootReviewed.acceptedRows) {
  assert.equal(row.currentTargetAbsent, true, `${row.key}: target was absent before this layer`);
  assert.equal(row.status, 'unreviewed-machine-draft');
  assert.equal(Object.hasOwn(beforeLocale, row.key), false, `${row.key}: exact predecessor locale has no target`);
  assert.equal(packet.locale.rows.find((item: any) => item.key === row.key)?.target, row.target, `${row.key}: exact root-reviewed string`);
  expectedLocale[row.key] = row.target;
}
for (const row of rootReviewed.heldRows) {
  assert.equal(Object.hasOwn(beforeLocale, row.key), false, `${row.key}: held source remains English in predecessor`);
  assert.equal(Object.hasOwn(afterLocale, row.key), false, `${row.key}: held source remains English after this layer`);
}
assert.deepEqual(afterLocale, expectedLocale, 'only the six approved VE entries are added; all other locale entries stay exact');
const sourceFiles: Record<string, string> = {
  readiness: readFileSync(repositoryPath('lib/i18n.tsx'), 'utf8'),
  learner: readFileSync(repositoryPath('lib/learner-ui-english.ts'), 'utf8'),
};
for (const row of rootReviewed.acceptedRows) {
  const source = row.key.startsWith('studentReadiness') ? sourceFiles.readiness : sourceFiles.learner;
  assert.ok(source.includes(`${row.key}: '${row.sourceEnglish}'`), `${row.key}: exact current English dictionary source`);
  const placeholders = (text: string) => [...text.matchAll(/\{[^}]+\}/g)].map(match => match[0]).sort();
  assert.deepEqual(placeholders(row.target), placeholders(row.sourceEnglish), `${row.key}: every placeholder remains exact`);
}
for (const row of rootReviewed.heldRows) {
  const source = row.key.startsWith('studentReadiness') ? sourceFiles.readiness : sourceFiles.learner;
  assert.ok(source.includes(`${row.key}: '${row.sourceEnglish}'`), `${row.key}: held exact English fallback source`);
}

const studentPage = readFileSync(repositoryPath('app/student/page.tsx'), 'utf8');
assert.ok(studentPage.includes('const readinessFacts = moduleReadinessDetail(mod.id);'), 'readiness counts remain module-global');
assert.ok(studentPage.includes(".replace('{languages}', String(readinessFacts.narrationLanguages.length))"), 'language count remains a global readiness fact');
assert.ok(studentPage.includes('{!simple && isStaff && ('), 'readiness badge remains staff-only');
assert.ok(studentPage.includes("t('studentReadinessCompleteDetail')") && studentPage.includes("t('studentReadinessNarratedDetail')") && studentPage.includes("t('studentReadinessLessonsDetail')"), 'all detail strings retain their existing readiness branches');
const deckPlayer = readFileSync(repositoryPath('components/course/DeckPlayer.tsx'), 'utf8');
assert.ok(deckPlayer.includes("{animationFailed && (") && deckPlayer.includes("t('courseDeckAnimationFailed')"), 'animation fallback remains attached to the animation failure state');
const offlineCaller = readFileSync(repositoryPath('components/course/OfflineDownload.tsx'), 'utf8');
assert.ok(offlineCaller.includes("{regionalSlidePack && variant === 'slides' ? t('offlineGetSlidesWhileSignal') : t('offlineGetWhileSignal')}"), 'shared full-pack text stays distinct from regional slides-only instructions');
assert.ok(offlineCaller.includes('{!compact && ('), 'explanation remains in the non-compact offline panel');

const expectedST = structuredClone(beforeSt);
const stLayer = packet.sesotho;
assert.equal(stLayer.path, 'lib/course-translation-drafts-st-reading-landscape.ts');
assert.equal(stLayer.registryExport, 'SESOTHO_READING_LANDSCAPE_DRAFT');
assert.equal(stLayer.lessonId, 'reading-landscape-l1');
assert.equal(stLayer.field, 'body.sesothoDraft.paragraph[1]');
const sourceModule = COURSE_MODULES.find(module => module.id === 'reading-landscape');
const sourceLesson = sourceModule?.lessons.find(lesson => lesson.id === stLayer.lessonId);
assert.ok(sourceLesson, 'canonical Reading Landscape L1 source exists');
assert.equal(sourceLesson.body, stLayer.sourceEnglishBody, 'the whole canonical English body remains exact');
assert.equal(sourceLesson.body.split('\n\n')[stLayer.paragraphIndex], stLayer.sourceEnglishParagraph, 'the changed learner field remains bound to the exact canonical paragraph');
assert.equal(sha(stPlanBytes), packet.stReviewPlan.sha256);
assert.equal(stPlan.evidence.exactCurrentSource, stLayer.sourceEnglishParagraph);
assert.equal(stPlan.evidence.exactCurrentLearnerParagraph, stLayer.beforeParagraph);
assert.equal(stPlan.evidence.exactProposedLearnerParagraph, stLayer.afterParagraph);
assert.equal(stPlan.evidence.registryReviewStatus, stLayer.beforeStatus);
const stLesson = expectedST.lessons.find((lesson: any) => lesson.id === stLayer.lessonId);
assert.ok(stLesson);
assert.equal(stLesson.body.sourceEnglish, stLayer.sourceEnglishBody);
assert.equal(stLesson.body.reviewStatus, stLayer.beforeStatus);
const paragraphs = stLesson.body.sesothoDraft.split('\n\n');
assert.equal(paragraphs.length, packet.preservation.stBodyParagraphCount);
assert.equal(paragraphs[stLayer.paragraphIndex], stLayer.beforeParagraph, 'complete original learner paragraph is preserved as the predecessor');
assert.equal(stLayer.beforeParagraph.split(stLayer.targetFragment).length, 2, 'the target fragment occurs exactly once');
assert.equal(stLayer.beforeParagraph, stLayer.prefix + stLayer.targetFragment + stLayer.suffix, 'exact before prefix and safety suffix compose the prior paragraph');
assert.equal(stLayer.afterParagraph, stLayer.prefix + stLayer.heldSourceFragment + stLayer.suffix, 'the after paragraph changes only the exact held source fragment');
assert.ok(stLayer.suffix.includes('eseng moralo kapa tumello ya ho tjheka mobu (earthworks)'), 'the observation remains neither design nor permission');
assert.ok(stLayer.suffix.includes('Pele o tjheka mokero (swale), letamo, kapa sebopeho se seng, etsa hore sebaka se hlahlojwe.'), 'before-digging condition and structures remain');
for (const protectedText of ['Mofuta wa mobu, letswapo, tsamaiso ya metsi, phallo ya sefefo', 'tsela e sireletsehileng ya ho phalla ha metsi a tletse (overflow route)', 'Botsa moeletsi wa lehae ya kwetlisitsweng (trained local adviser).']) {
  assert.ok(stLayer.suffix.includes(protectedText), `all assessment and adviser conditions survive: ${protectedText}`);
}
paragraphs[stLayer.paragraphIndex] = stLayer.afterParagraph;
stLesson.body.sesothoDraft = paragraphs.join('\n\n');
assert.deepEqual(afterSt, expectedST, 'complete after snapshot changes only the approved ST learner fragment');
assert.deepEqual(st, afterSt, 'complete live Sesotho registry equals the exact one-fragment layer');
assert.deepEqual(anchors.pairedSlide6.segment, { sourceEnglish: stLayer.heldSourceFragment, status: packet.protectedPaired.status });
assert.equal(anchors.pairedSlide6.path, packet.protectedPaired.path);
assert.equal(anchors.pairedSlide6.segment.status, 'english-hold');
const pairedBytes = readFileSync(repositoryPath(packet.protectedPaired.path));
assert.equal(sha(pairedBytes), packet.protectedPaired.sha256, 'recorded Reading paired deck remains exact and untouched');
assert.equal(sha(pairedBytes), packet.protectedPaired.beforeSnapshotSha256, 'the complete paired deck matches its saved predecessor bytes');
const paired = JSON.parse(pairedBytes.toString());
const slide = paired.slides.find((item: any) => item.n === packet.protectedPaired.slide);
assert.equal(slide.english.body[2], anchors.pairedSlide6.source, 'the distinct paired slide source stays exact');
assert.deepEqual(slide.target.body[2].segments[4], { sourceEnglish: stLayer.heldSourceFragment, status: 'english-hold' }, 'paired slide 6 keeps the existing exact English observation hold');

/** Validate this complete newest layer before any historical snapshot projects it back. */
export function ensureStudyRemainingControlsCurrent() {
  assert.equal(sha(readFileSync(repositoryPath('lib/locales/ve.ts'))), packet.locale.afterSourceSha256, 'complete live VE locale source bytes');
  assert.equal(sha(readFileSync(repositoryPath(stLayer.path))), stLayer.afterSourceSha256, 'complete live Sesotho registry source bytes');
  assert.equal(sha(pairedBytes), packet.protectedPaired.sha256, 'paired Reading bytes remain unchanged');
}

export function assertStudyRemainingControlsLocale(actual: unknown) {
  ensureStudyRemainingControlsCurrent();
  assert.deepEqual(actual, afterLocale, 'VE dictionary rejects any unlisted or altered locale value');
}

/** The exact predecessor is returned only after the full new ST object and source layer validate. */
export function studyRemainingControlsNativeBefore<T>(actual: T): T {
  const module = actual as any;
  if (module?.id !== 'reading-landscape' || module?.language !== 'st') return actual;
  ensureStudyRemainingControlsCurrent();
  if (JSON.stringify(module) === JSON.stringify(beforeSt)) return structuredClone(actual);
  if (JSON.stringify(module) === JSON.stringify(afterSt)) return structuredClone(beforeSt);
  // An older history helper can call again with a dated ancestor. Its own complete
  // equality must judge that object; the live current layer was already verified above.
  return actual;
}

export function assertStudyRemainingControlsNative(actual: unknown) {
  ensureStudyRemainingControlsCurrent();
  assert.deepEqual(actual, afterSt, 'complete current ST Reading object equals the accepted one-fragment layer, including status and unlisted fields');
}

/** Project exact source bytes only after the complete current file and native layer validate. */
export function studyRemainingControlsSourceBefore(file: string, bytes: string | Uint8Array): string | Uint8Array {
  if (file !== stLayer.path) return bytes;
  ensureStudyRemainingControlsCurrent();
  const supplied = Buffer.from(bytes);
  const live = readFileSync(repositoryPath(file));
  const prior = readFileSync(repositoryPath(folder + packet.sesotho.beforeSourceSnapshot));
  assert.equal(sha(prior), packet.sesotho.beforeSourceSnapshotSha256, 'complete exact Sesotho source predecessor bytes');
  if (supplied.equals(prior)) return bytes;
  if (supplied.equals(live)) return typeof bytes === 'string' ? prior.toString() : prior;
  // A caller may already hold a dated ancestor. Leave it for that history owner to check.
  return bytes;
}

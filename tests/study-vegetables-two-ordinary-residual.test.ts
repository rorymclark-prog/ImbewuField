import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { ensureStudyVegetablesTwoResidualCurrent } from './study-vegetables-two-ordinary-residual-history-checks.ts';
import { followupSourceBefore } from './core-reading-vegetables-followup-history-checks.ts';
import { nativeOrdinaryBeforeResidualLayer } from './native-ordinary-final-history-checks.ts';
import { vegetablesDeckBeforeNativePairedResidual } from './native-paired-residual-history-checks.ts';

const veSource = 'Beans climb the maize, and store as protein.';
const veBefore = 'Beans dzi gonya maize, and store as protein.';
const veAfter = 'Beans dzi gonya maize, na store as protein.';
const tsSource = 'A staple earns its place because it feeds the household beyond the day of harvest.';
const tsBefore = 'A staple earns its place hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.';
const tsAfter = 'Staple yi ni nkoka hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.';

const sourceModule = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;

test('The VE intercropping connector and TS staple opening stay source-bound, paired, minimal and visibly unreviewed', () => {
  ensureStudyVegetablesTwoResidualCurrent();
  const veLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l2')!;
  const veTarget = ve.lessons.find(lesson => lesson.id === veLesson.id)!;
  const veParagraphs = veTarget.body.tshivendaDraft.split('\n\n');
  assert.equal(veLesson.body.split('\n\n')[14], veSource);
  assert.equal(veTarget.body.sourceEnglish, veLesson.body, 'the complete VE learner body remains bound to canonical source');
  assert.equal(veTarget.body.reviewStatus, 'machine-draft');
  assert.equal(veParagraphs.length, 23);
  assert.equal(veParagraphs[14], veAfter);
  assert.equal(veParagraphs[14].replace('na store as protein.', 'and store as protein.'), veBefore);
  assert.ok(veParagraphs[14].endsWith('store as protein.'), 'technical protein wording remains an explicit English loan');
  const vePresentation = resolveLearnerLessonPresentation(veLesson, 've');
  assert.equal(vePresentation.status, 'draft');
  assert.equal(vePresentation.content.body.split('\n\n')[14], veAfter);
  const veDrift = resolveLearnerLessonPresentation({ ...veLesson, body: veLesson.body + ' Source changed.' }, 've');
  assert.equal(veDrift.status, 'english-fallback', 'changed canonical source withdraws the source-bound draft');
  assert.equal(veDrift.content.body, veLesson.body + ' Source changed.');

  const tsLesson = sourceModule.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;
  const tsTarget = ts.lessons.find(lesson => lesson.id === tsLesson.id)!;
  const tsParagraphs = tsTarget.body.xitsongaDraft.split('\n\n');
  assert.equal(tsLesson.body.split('\n\n')[0], tsSource);
  assert.equal(tsTarget.body.sourceEnglish, tsLesson.body, 'the complete TS learner body remains bound to canonical source');
  assert.equal(tsTarget.body.reviewStatus, 'machine-draft');
  assert.equal(tsParagraphs.length, 16);
  assert.equal(tsParagraphs[0], tsAfter);
  assert.equal(tsAfter.replace(/^Staple yi ni nkoka/, 'A staple earns its place'), tsBefore,
    'only the opening idiom changed; the household reason remains byte-exact');
  assert.ok(tsParagraphs[0].endsWith('hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.'));
  const tsPresentation = resolveLearnerLessonPresentation(tsLesson, 'ts');
  assert.equal(tsPresentation.status, 'draft');
  assert.equal(tsPresentation.content.body.split('\n\n')[0], tsAfter);
  const tsDrift = resolveLearnerLessonPresentation({ ...tsLesson, body: tsLesson.body + ' Source changed.' }, 'ts');
  assert.equal(tsDrift.status, 'english-fallback', 'changed canonical source withdraws the source-bound draft');
  assert.equal(tsDrift.content.body, tsLesson.body + ' Source changed.');

  const veDeck = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const veSlide = veDeck.slides.find((slide: any) => slide.n === 10);
  assert.equal(veSlide.english.body[3], veSource);
  assert.deepEqual(veSlide.target.body[3], { status: 'draft', text: veAfter });
  assert.equal(veSlide.target.body[3].text.replace('na store as protein.', 'and store as protein.'), veBefore);
  const tsDeck = JSON.parse(readFileSync('docs/narration/vegetables-staples.ts.paired-draft.json', 'utf8'));
  const tsSlide = tsDeck.slides.find((slide: any) => slide.n === 12);
  assert.equal(tsSlide.english.body[0], tsSource);
  assert.deepEqual(tsSlide.target.body[0], { status: 'draft', text: tsAfter });
  assert.ok(tsSlide.target.body[0].text.endsWith('hikuva yi phamela ndyangu ni le ndzhaku ka siku ra ntshovelo.'));
});

test('the older full owners reject unlisted registry, paired-cell, and same-size source corruption after this leaf is projected', () => {
  ensureStudyVegetablesTwoResidualCurrent();

  const corruptedNative = structuredClone(ve);
  corruptedNative.description.tshivendaDraft += ' unlisted change';
  assert.throws(() => nativeOrdinaryBeforeResidualLayer(corruptedNative), /complete current registry|full caller module/,
    'the exact newest target projection does not hide a changed unlisted native field from the complete-object owner');

  const veDeck = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const corruptedPair = structuredClone(veDeck);
  corruptedPair.slides.find((slide: any) => slide.n === 10).target.body[4].text += ' unlisted change';
  assert.throws(() => vegetablesDeckBeforeNativePairedResidual(corruptedPair), /caller supplied the verified current deck|complete accepted latest paired layer/,
    'the exact newest paired leaf projection leaves unrelated target cells visible to the complete-deck owner');

  const learnerPath = 'lib/course-translation-drafts-ts-vegetables-staples.ts';
  const currentBytes = readFileSync(learnerPath);
  const original = currentBytes.toString();
  const corrupted = original.replace('A staple earns its place because it feeds', 'A staple earns its place Because it feeds');
  assert.notEqual(corrupted, original);
  assert.equal(Buffer.byteLength(corrupted), currentBytes.byteLength, 'the unlisted source corruption keeps the file size unchanged');
  assert.throws(() => followupSourceBefore(learnerPath, Buffer.from(corrupted)), /complete current source, draft and unlisted bytes|full current|complete source/,
    'the dated owner full-file proof rejects same-size unlisted source corruption after the exact newest leaf is projected');
});

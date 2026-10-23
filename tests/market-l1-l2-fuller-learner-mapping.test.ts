import { marketCompletionRows, checkMarketTeachingExample } from './market-l1-completion-checks.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { SESOTHO_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-st-market-community.ts';
import { TSHIVENDA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ve-market-community.ts';
import { XITSONGA_MARKET_COMMUNITY_DRAFT } from '../lib/course-translation-drafts-ts-market-community.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { validateAndRewindMarketOrdinary } from './market-ordinary-completion-history-checks.ts';

type Language = 'st' | 've' | 'ts';
type AppliedRow = {
  language: Language;
  lessonId: string;
  bodyIndexZeroBased: number;
  canonicalSource: string;
  previousLearnerText: string;
  approvedFinalLearnerText: string;
};
type AppliedMapping = {
  rows: AppliedRow[];
  beforeLearnerBodies: Array<{ language: Language; lessonId: string; paragraphs: string[] }>;
  scope: { changedBodyParagraphs: number };
};

const mapping = JSON.parse(readFileSync(
  new URL('../docs/study-translation-reviews/REGIONAL-MARKET-L1-L2-FULLER-APPLIED-MAPPING-2026-10-03.json', import.meta.url),
  'utf8',
)) as AppliedMapping;

const marketL2L3 = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/MARKET-COMMUNITY-L2-L3-ORDINARY-COMPLETION-APPLIED-2026-10-05.json', import.meta.url), 'utf8'));

// The 2026-10-03 mapping is historical. Its full-before check now validates and
// rewinds the later 2026-10-06 Market residual batch before checking these same rows.
const drafts = {
  st: validateAndRewindMarketOrdinary(SESOTHO_MARKET_COMMUNITY_DRAFT, 'st'),
  ve: validateAndRewindMarketOrdinary(TSHIVENDA_MARKET_COMMUNITY_DRAFT, 've'),
  ts: validateAndRewindMarketOrdinary(XITSONGA_MARKET_COMMUNITY_DRAFT, 'ts'),
};
const learnerField = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;

const draftBody = (language: Language, lessonId: string): string => {
  const lesson = drafts[language].lessons.find(item => item.id === lessonId);
  assert.ok(lesson, `${language}/${lessonId}: regional lesson exists`);
  return (lesson.body as unknown as Record<string, string>)[learnerField[language]];
};

test('Market L1/L2 regional wording changes only approved source-paired paragraphs and remains fail-closed', () => {
  const sourceModule = COURSE_MODULES.find(module => module.id === 'market-community');
  assert.ok(sourceModule, 'canonical Market Community module exists');
  assert.equal(mapping.rows.length, 18);
  assert.equal(mapping.scope.changedBodyParagraphs, 18);

  for (const language of ['st', 've', 'ts'] as const) {
    for (const lessonId of ['market-community-l1', 'market-community-l2']) {
      const sourceLesson: Lesson | undefined = sourceModule.lessons.find(lesson => lesson.id === lessonId);
      const draftLesson = drafts[language].lessons.find(lesson => lesson.id === lessonId);
      const baseline = mapping.beforeLearnerBodies.find(item => item.language === language && item.lessonId === lessonId);
      assert.ok(sourceLesson && draftLesson && baseline, `${language}/${lessonId}: source, draft and preservation baseline exist`);
      assert.equal(draftLesson.body.reviewStatus, 'machine-draft', `${language}/${lessonId}: wording stays visibly unreviewed`);
      assert.equal(draftLesson.body.sourceEnglish, sourceLesson.body, `${language}/${lessonId}: canonical source stays byte-exact`);

      const sourceParagraphs: string[] = sourceLesson.body.split('\n\n');
      const beforeParagraphs: string[] = baseline.paragraphs;
      const actualParagraphs: string[] = draftBody(language, lessonId).split('\n\n');
      assert.equal(beforeParagraphs.length, sourceParagraphs.length, `${language}/${lessonId}: baseline follows full source order`);
      assert.equal(actualParagraphs.length, sourceParagraphs.length, `${language}/${lessonId}: learner paragraphs remain aligned to source`);

      const expectedParagraphs = [...beforeParagraphs];
      for (const row of mapping.rows.filter(item => item.language === language && item.lessonId === lessonId)) {
        assert.equal(sourceParagraphs[row.bodyIndexZeroBased], row.canonicalSource,
          `${language}/${lessonId}/${row.bodyIndexZeroBased}: mapping points to the exact canonical paragraph`);
        assert.equal(beforeParagraphs[row.bodyIndexZeroBased], row.previousLearnerText,
          `${language}/${lessonId}/${row.bodyIndexZeroBased}: baseline is the reviewed prior learner wording`);
        expectedParagraphs[row.bodyIndexZeroBased] = row.approvedFinalLearnerText;
      }
      // Later authorized L1 completion follows the historical18-row batch. Check each
      // applied before/source/after edge before composing it; untouched L1/L2 paragraphs stay exact.
      if (lessonId === 'market-community-l1') {
        for (const row of marketCompletionRows.filter(row => row.language === language && row.field.startsWith('body.paragraphs['))) {
          const index = Number(row.field.match(/\[(\d+)\]/)![1]);
          assert.equal(expectedParagraphs[index], row.currentTarget, 'Completion starts from the historical reconstructed target');
          assert.equal(sourceParagraphs[index], row.sourceEnglish, 'Completion is bound to the same ordered canonical paragraph');
          expectedParagraphs[index] = row.repairedTarget;
        }
      }
      // 2026-10-05: L2 completion supersedes the former partial body. Reconstruct
      // the old batch first, then require the exact prior/source edge before applying it.
      if (lessonId === 'market-community-l2') {
        const completion = marketL2L3.fields.find((row: any) => row.language === language && row.lessonId === lessonId && row.fieldPath === 'body');
        assert.ok(completion, `${language}: accepted L2 completion exists`);
        assert.equal(expectedParagraphs.join('\n\n'), completion.currentTarget, 'L2 completion starts from the historical reconstruction');
        assert.equal(sourceLesson.body, completion.sourceEnglish, 'L2 completion retains the complete canonical source');
        expectedParagraphs.splice(0, expectedParagraphs.length, ...completion.appliedTarget.split('\n\n'));
      }
      assert.deepEqual(actualParagraphs, expectedParagraphs,
        `${language}/${lessonId}: only approved replacements change; all unselected paragraphs remain exact`);

      const changedSource: Lesson = { ...sourceLesson, body: `${sourceLesson.body} ` };
      const stalePresentation = resolveLearnerLessonPresentation(changedSource, language);
      assert.equal(stalePresentation.status, 'english-fallback',
        `${language}/${lessonId}: a changed canonical body withdraws the entire paired draft`);
      assert.equal(stalePresentation.content.body, changedSource.body,
        `${language}/${lessonId}: stale localized wording cannot mask the changed English source`);
    }
  }
});

test('Market learner wording keeps quantities, sale risks, crop meaning and planting conditions distinct', () => {
  for (const language of ['st', 've', 'ts'] as const) {
    const l1 = draftBody(language, 'market-community-l1').split('\n\n');
    checkMarketTeachingExample(language, l1[12], COURSE_MODULES.find(module => module.id === 'market-community')!.lessons[0].body.split('\n\n')[12]);
  }

  const sesotho = draftBody('st', 'market-community-l1').split('\n\n');
  assert.match(sesotho[11], /ditjeo tsa tlhahiso, ho paka le ho rekisa, ho kenyeletsa mosebetsi le dipalangoang/,
    'Sesotho retains each production, packing, sale, labour and transport cost');
  assert.match(sesotho[13], /theko e hodimo.*ha e tiise thekiso/,
    'Sesotho preserves that a higher asking price does not guarantee a sale');
  assert.match(sesotho[15], /dijalo tse loketseng.*rale o kgutlela morao.*kotulong/,
    'Sesotho says to plan backwards from the harvest using locally suitable crops');
  assert.match(sesotho[16], /ka nna la se sebetse.*haeba pula, metsi kapa dijalo di hloleha/,
    'Sesotho preserves possibility and the rain, water and crop failure triggers');

  const tshivendaL1 = draftBody('ve', 'market-community-l1').split('\n\n');
  assert.match(tshivendaL1[11], /mutengo.*masheleni a u bveledza, u paka na u rengisa.*mushumo na transport/,
    'Tshivenda keeps price distinct from its enumerated costs');
  assert.match(tshivendaL1[13], /mutengo wa nṱha.*a u khwaṱhisedzi uri zwi ḓo rengiswa/,
    'Tshivenda preserves the no-guaranteed-sale qualification');
  const tshivendaL2 = draftBody('ve', 'market-community-l2').split('\n\n');
  assert.match(tshivendaL2[2], /milayo ya market.*a hu na milayo kana costs/,
    'Tshivenda retains local rules and the warning that informal stalls may still have costs');

  const xitsongaL1 = draftBody('ts', 'market-community-l1').split('\n\n');
  assert.match(xitsongaL1[7], /^Nguva yin’we ya tirhekhodo yi hlamula/,
    'one season of records remains an affirmative source claim, without adding “can”');
  assert.match(xitsongaL1[11], /nxavo.*production, packing and selling costs.*labour ni transport/,
    'itsonga keeps price-setting distinct from production and selling costs');
  assert.match(xitsongaL1[13], /nxavo wa le henhla.*a wu tiyisisi ku xavisiwa/,
    'itsonga preserves that a higher asking price does not guarantee a sale');
  assert.match(xitsongaL1[15], /swibyariwa leswi faneleke.*tlhelela endzhaku.*ntshovelo.*swiyimo swa ku byala/,
    'itsonga retains the crop category and planning, planting-condition and harvest anchors');
  assert.match(xitsongaL1[16], /nga ha ka ri nga tirhi.*loko mpfula, mati kumbe swibyariwa swi tsandzeka/,
    'itsonga keeps possibility and all three failure triggers');
  const xitsongaL2 = draftBody('ts', 'market-community-l2').split('\n\n');
  assert.match(xitsongaL2[1], /ku paka.*nxavo wo xavisa/,
    'itsonga distinguishes packing from the selling price');
  assert.match(xitsongaL2[2], /milawu ya makete.*swilaveko swa ndhawu swa ku xavisa ni swakudya.*a ku na milawu kumbe costs/,
    'itsonga retains market rules and the no-rules/no-costs warning');
});

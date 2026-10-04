import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';

const packet = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-REMAINING-ORDINARY-CANDIDATES-2026-10-04.json', import.meta.url), 'utf8'));
const candidates = packet.candidateFields as Array<{
  language: 've' | 'ts';
  lessonId: string;
  canonicalSourceBody: string;
  canonicalSourceParagraph: string;
  currentTargetBody: string;
  paragraphIndex: number;
  targetedSourceSentence: string;
  proposedSentence: string;
  proposedTargetBody: string;
  segments: Array<{ sourceEnglish: string; targetText: string }>;
}>;
const module = COURSE_MODULES.find(item => item.id === 'reading-landscape')!;
const drafts = { ve: TSHIVENDA_READING_LANDSCAPE_DRAFT, ts: XITSONGA_READING_LANDSCAPE_DRAFT };
const fullerPacket = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-BODY-FULLER-ROOT-READY-2026-10-04.json', import.meta.url), 'utf8')) as {
  changedFieldCount: number;
  excludedUnchangedRows: Array<{ language: string; lessonId: string; fieldPath: string }>;
  fields: Array<{
    language: 'st' | 've' | 'ts';
    lessonId: string;
    paragraphIndex: number;
    sourceEnglishParagraph: string;
    previousTargetParagraph: string;
    currentTargetParagraph: string;
  }>;
};
const secondPassPacket = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-BODY-FULLER-SECOND-PASS-INDEPENDENT-CHECK-2026-10-04.json', import.meta.url), 'utf8')) as {
  reviewedHead: string;
  summary: { acceptedUnreviewed: number; localizedWithPreciseEnglishAnchor: number; heldUnchanged: number };
  paragraphs: Array<{
    language: 've' | 'ts';
    lessonId: string;
    bodyParagraphIndexZeroBased: number;
    canonicalSourceParagraph: string;
    actualCurrentTargetParagraph: string;
    correctedRecommendedTargetParagraph: string;
  }>;
};
const combinedPacket = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-BODY-FULLER-COMBINED-IMPLEMENTATION-2026-10-04.json', import.meta.url), 'utf8')) as {
  uniqueChangedParagraphCount: number;
  fields: Array<{
    language: 'st' | 've' | 'ts';
    lessonId: string;
    paragraphIndex: number;
    sourceEnglishParagraph: string;
    previousTargetParagraph: string;
    finalTargetParagraph: string;
    appliedSecondPass: boolean;
  }>;
};
const bodyText = (body: { sesothoDraft?: string; tshivendaDraft?: string; xitsongaDraft?: string }): string =>
  body.sesothoDraft ?? body.tshivendaDraft ?? body.xitsongaDraft ?? '';

test('Reading L1 localizes only the approved before-digging clause and falls back on source drift', () => {
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    const source = module.lessons.find(lesson => lesson.id === candidate.lessonId)!;
    const draft = drafts[candidate.language].lessons.find(lesson => lesson.id === candidate.lessonId)!;
    const pair = draft.body;
    const target = 'tshivendaDraft' in pair ? pair.tshivendaDraft : pair.xitsongaDraft;
    const sourceParagraphs = source.body.split('\n\n');
    const currentTargetParagraphs = candidate.currentTargetBody.split('\n\n');
    const targetParagraphs = target.split('\n\n');
    const proposedTargetParagraphs = candidate.proposedTargetBody.split('\n\n');

    assert.equal(source.body, candidate.canonicalSourceBody, `${candidate.language}: source body remains canonical`);
    assert.equal(pair.sourceEnglish, source.body, `${candidate.language}: full body source pair remains exact`);
    assert.equal(pair.reviewStatus, 'machine-draft', `${candidate.language}: body remains visibly unreviewed`);
    assert.equal(sourceParagraphs[candidate.paragraphIndex], candidate.canonicalSourceParagraph);
    assert.equal(sourceParagraphs.length, targetParagraphs.length);
    assert.equal(targetParagraphs.length, proposedTargetParagraphs.length);
    const authorizedWaterParagraph = fullerPacket.fields.find(row => row.language === 'ts' &&
      row.lessonId === 'reading-landscape-l1' && row.paragraphIndex === 2);
    for (let index = 0; index < targetParagraphs.length; index += 1) {
      const expectedParagraph = index === candidate.paragraphIndex
        ? proposedTargetParagraphs[index]
        : candidate.language === 'ts' && candidate.lessonId === 'reading-landscape-l1' && index === 2
          ? authorizedWaterParagraph!.currentTargetParagraph
          : currentTargetParagraphs[index];
      assert.equal(targetParagraphs[index], expectedParagraph,
        `${candidate.language}: preserve prior paragraphs except this candidate and the separately checked L1 water-safety refinement`);
    }
    assert.equal(sourceParagraphs[candidate.paragraphIndex].split(candidate.targetedSourceSentence).length, 2,
      `${candidate.language}: the canonical sentence occurs exactly once`);
    assert.equal(candidate.segments.map((segment: { sourceEnglish: string }) => segment.sourceEnglish).join(''), candidate.targetedSourceSentence);
    assert.equal(candidate.segments.map((segment: { targetText: string }) => segment.targetText).join(''), candidate.proposedSentence);
    assert.equal(targetParagraphs[candidate.paragraphIndex], proposedTargetParagraphs[candidate.paragraphIndex]);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('a swale, dam'), `${candidate.language}: named structures remain exact English`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('Its marks are an observation, not a design or approval for earthworks.'),
      `${candidate.language}: A-frame is not presented as earthworks design or approval`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('Soil, slope, drainage, storm flow'),
      `${candidate.language}: all site assessment factors remain present`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('safe overflow route'),
      `${candidate.language}: safe overflow route remains present`);
    assert.ok(targetParagraphs[candidate.paragraphIndex].includes('trained local adviser'),
      `${candidate.language}: trained local adviser remains specified`);

    const shown = resolveLearnerLessonPresentation(source, candidate.language);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, target);
    const changedSource = { ...source, body: `${source.body}\nChanged site instruction.` };
    const fallback = resolveLearnerLessonPresentation(changedSource, candidate.language);
    assert.equal(fallback.status, 'english-fallback', `${candidate.language}: changed source withdraws the stale translation`);
    assert.equal(fallback.content.body, changedSource.body);
  }
});

test('Reading body refinements preserve source conditions and fall back when the canonical paragraph changes', () => {
  const allDrafts = {
    st: SESOTHO_READING_LANDSCAPE_DRAFT,
    ve: TSHIVENDA_READING_LANDSCAPE_DRAFT,
    ts: XITSONGA_READING_LANDSCAPE_DRAFT,
  };
  assert.equal(fullerPacket.changedFieldCount, 8);
  assert.equal(fullerPacket.fields.length, 8);
  assert.equal(combinedPacket.uniqueChangedParagraphCount, 9,
    'the accepted second pass adds one unique paragraph and revises three initial targets');
  assert.equal(fullerPacket.excludedUnchangedRows.length, 2,
    'the two unchanged frost-sensitivity candidates must not appear as new work');

  for (const field of fullerPacket.fields) {
    const sourceLesson = module.lessons.find(item => item.id === field.lessonId)!;
    const registryLesson = allDrafts[field.language].lessons.find(item => item.id === field.lessonId)!;
    const shown = resolveLearnerLessonPresentation(sourceLesson, field.language);
    const paragraphs = bodyText(registryLesson.body).split('\n\n');
    const sourceParagraphs = sourceLesson.body.split('\n\n');
    const combined = combinedPacket.fields.find(row => row.language === field.language && row.lessonId === field.lessonId && row.paragraphIndex === field.paragraphIndex)!;
    const secondPass = secondPassPacket.paragraphs.find(row => row.language === field.language && row.lessonId === field.lessonId && row.bodyParagraphIndexZeroBased === field.paragraphIndex);

    assert.equal(registryLesson.body.sourceEnglish, sourceLesson.body,
      `${field.language}/${field.lessonId}: retain the exact full English body source`);
    assert.equal(registryLesson.body.reviewStatus, 'machine-draft',
      `${field.language}/${field.lessonId}: keep mixed prose visibly unreviewed`);
    assert.equal(shown.status, 'draft', `${field.language}/${field.lessonId}: resolver should expose the paired draft`);
    assert.equal(shown.content.body, bodyText(registryLesson.body),
      `${field.language}/${field.lessonId}: learner resolver must return the current registry body`);
    assert.equal(paragraphs.length, sourceParagraphs.length,
      `${field.language}/${field.lessonId}: keep every source paragraph in order`);
    assert.equal(sourceParagraphs[field.paragraphIndex], field.sourceEnglishParagraph,
      `${field.language}/${field.lessonId}: row is bound to the exact canonical paragraph`);
    assert.equal(paragraphs[field.paragraphIndex], combined.finalTargetParagraph,
      `${field.language}/${field.lessonId}: learner output contains the final reviewed target paragraph`);
    if (secondPass) {
      assert.equal(secondPass.actualCurrentTargetParagraph, field.currentTargetParagraph,
        `${field.language}/${field.lessonId}: preserve the first-pass target as the second-pass starting point`);
      assert.equal(secondPass.correctedRecommendedTargetParagraph, combined.finalTargetParagraph,
        `${field.language}/${field.lessonId}: corrected independent recommendation is the only superseding target`);
    }
    assert.ok(field.previousTargetParagraph !== field.currentTargetParagraph,
      `${field.language}/${field.lessonId}: do not report an unchanged paragraph as a refinement`);

    const changedSource = {
      ...sourceLesson,
      body: sourceLesson.body.replace(field.sourceEnglishParagraph, `${field.sourceEnglishParagraph} Changed.`),
    };
    const fallback = resolveLearnerLessonPresentation(changedSource, field.language);
    assert.equal(fallback.status, 'english-fallback',
      `${field.language}/${field.lessonId}: changed source must withdraw the stale translation`);
    assert.equal(fallback.content.body, changedSource.body,
      `${field.language}/${field.lessonId}: show the updated English source after drift`);
  }

  const target = (language: 'st' | 've' | 'ts', lessonId: string, paragraphIndex: number) =>
    combinedPacket.fields.find(row => row.language === language && row.lessonId === lessonId && row.paragraphIndex === paragraphIndex)!.finalTargetParagraph;

  const stFrost = target('st', 'reading-landscape-l2', 2);
  assert.ok(stFrost.startsWith('Pawpaw and young citrus di ameha habonolo ke serame'),
    'ST retains both exact crop names while localizing the frost-sensitivity statement');
  assert.ok(stFrost.includes('known low frost pockets.') && stFrost.endsWith('Hlokomela serame sa lehae pele o jala.'),
    'ST keeps the low-pocket exclusion and local-frost observation before planting');

  const veWind = target('ve', 'reading-landscape-l3', 0);
  assert.ok(veWind.includes('your site\'s ridges and gaps') && veWind.includes('Sedzani local weather records'));
  assert.ok(veWind.endsWith('musi ni sa athu dzhia tsheo ya hune tsireledzo ya ṱoḓea hone.'),
    'VE retains checking records before deciding where shelter is needed');

  const veCold = target('ve', 'reading-landscape-l3', 1);
  assert.ok(veCold.includes('Arali records dzi sa wanali, bvelani phanḓa ni tshi sedza nga vhusiku vhu rotholaho'));
  assert.ok(veCold.includes('a local agriculture adviser ni sa athu nanga a permanent home for tender seedlings.'),
    'VE retains the no-record fallback and adviser-before-permanent-placement condition');
  const tsCold = target('ts', 'reading-landscape-l3', 1);
  assert.ok(tsCold.startsWith('On a clear, still night, cold air can flow downhill and collect in low places.'));
  assert.ok(tsCold.includes('eka vusiku byo titimelaka') && tsCold.includes('local agriculture adviser'));
  assert.ok(tsCold.endsWith('u nga si hlawula permanent home for tender seedlings.'),
    'TS retains cold-night observation and the adviser-before-placement condition');

  const veFrost = target('ve', 'reading-landscape-l3', 2);
  assert.ok(veFrost.startsWith('Frost ndi ice that forms on a cold surface. Mist fhedzi a i sumbedzi uri ice has formed, nahone frost damage can happen without visible ice.'));
  assert.ok(veFrost.endsWith('Keep sensitive plants away from the cold pockets dzine na dzi vhona.'),
    'VE retains the keep-away instruction and localizes only which observed pockets');

  const veMap = target('ve', 'reading-landscape-l4', 1);
  assert.ok(veMap.includes('khakibos') && veMap.includes('blackjack') && veMap.includes('(disturbed places)'));
  assert.ok(veMap.includes('a zwi sumbedzi arali mavu o tsitsikana (compacted).'));
  assert.ok(veMap.endsWith('Ṱolani mavu ni sa athu dzhia tsheo ya zwine patch ya amba kha design yaṋu.'),
    'VE keeps the plants as observations rather than a compaction diagnosis and checks soil before interpreting the patch');
  const tsMap = target('ts', 'reading-landscape-l4', 1);
  assert.ok(tsMap.includes('khakibos') && tsMap.includes('blackjack') && tsMap.includes('disturbed places'));
  assert.ok(tsMap.includes('but their presence alone does not show whether soil is compacted.'));

  const tsWater = target('ts', 'reading-landscape-l1', 2);
  assert.ok(tsWater.includes('Poorly laid contours can increase erosion, and soil that takes in water slowly can hold too much.'));
  assert.ok(tsWater.includes('Hlawula any water works for the site, u pulana a safe route for excess water.'));
  assert.ok(!tsWater.includes('suitable water works'),
    'TS keeps the source’s “any” scope and safe-excess-water requirement without adding suitability');
});

test('Reading frost second pass keeps exact weather, comparison, availability and damage limits', () => {
  assert.equal(secondPassPacket.reviewedHead, '68719a788e0041da32eccfbbf36ca821eadfd321');
  assert.deepEqual(secondPassPacket.summary, {
    paragraphsChecked: 4,
    candidateClauses: 11,
    acceptedUnreviewed: 8,
    localizedWithPreciseEnglishAnchor: 2,
    heldUnchanged: 1,
    packetFullCurrentTargetsMatchingLiveResolver: 1,
    packetFullProposalsMatchingLiveCurrentComposition: 1,
    individualCandidateSpansMatchingCurrentResolver: 11,
    individualSourceAndSegmentConcatenationChecksPassed: true,
  });

  for (const row of secondPassPacket.paragraphs) {
    const sourceLesson = module.lessons.find(lesson => lesson.id === row.lessonId)!;
    const registryLesson = drafts[row.language].lessons.find(lesson => lesson.id === row.lessonId)!;
    const currentBody = bodyText(registryLesson.body);
    const sourceParagraphs = sourceLesson.body.split('\n\n');
    const currentParagraphs = currentBody.split('\n\n');
    const sourceParagraph = sourceParagraphs[row.bodyParagraphIndexZeroBased];
    const finalParagraph = currentParagraphs[row.bodyParagraphIndexZeroBased];

    assert.equal(sourceParagraph, row.canonicalSourceParagraph,
      `${row.language}: second-pass row remains attached to the exact canonical paragraph`);
    assert.equal(finalParagraph, row.correctedRecommendedTargetParagraph,
      `${row.language}: only the corrected independent recommendation replaces the first-pass composition`);
    assert.equal(registryLesson.body.sourceEnglish, sourceLesson.body);
    assert.equal(registryLesson.body.reviewStatus, 'machine-draft');

    const changedSource = {
      ...sourceLesson,
      body: sourceLesson.body.replace(sourceParagraph, `${sourceParagraph} Changed.`),
    };
    const fallback = resolveLearnerLessonPresentation(changedSource, row.language);
    assert.equal(fallback.status, 'english-fallback', `${row.language}: changed frost source withdraws the draft`);
    assert.equal(fallback.content.body, changedSource.body);
  }

  const tsCold = combinedPacket.fields.find(row => row.language === 'ts' && row.lessonId === 'reading-landscape-l3' && row.paragraphIndex === 1)!.finalTargetParagraph;
  assert.ok(tsCold.startsWith('On a clear, still night, cold air can flow downhill and collect in low places.'),
    'the precise clear, still weather condition and downhill cold-air mechanism remain exact English');
  assert.ok(tsCold.includes('Tindhawu leti ti nga va colder than nearby slopes.'),
    'can remains a possibility and the nearby-slope comparison remains exact');
  assert.ok(tsCold.includes('candidate places through the local frost season.'),
    'the complete local frost-season comparison period remains exact');
  assert.ok(tsCold.includes('local minimum-temperature records loko ti kumeka.'),
    'the evidence type stays exact while the where-available condition remains present');
  assert.ok(tsCold.includes('local agriculture adviser') && tsCold.endsWith('u nga si hlawula permanent home for tender seedlings.'),
    'the adviser check still comes before choosing a permanent home for tender seedlings');

  const tsFrost = combinedPacket.fields.find(row => row.language === 'ts' && row.lessonId === 'reading-landscape-l3' && row.paragraphIndex === 2)!.finalTargetParagraph;
  assert.ok(tsFrost.startsWith('Frost i ice that forms on a cold surface. Mist ntsena a yi kombisi leswaku ice has formed, naswona frost damage can happen without visible ice.'),
    'frost remains ice, mist alone is not proof, and damage can occur without visible ice');
  assert.ok(tsFrost.includes('laha cold or damage swi tshamaka kona nkarhi wo leha ngopfu'),
    'the longest-lasting cold-or-damage location remains the marking criterion');

  const veCold = combinedPacket.fields.find(row => row.language === 've' && row.lessonId === 'reading-landscape-l3' && row.paragraphIndex === 1)!.finalTargetParagraph;
  assert.ok(veCold.includes('candidate places through the local frost season.'));
  assert.ok(veCold.includes('local minimum-temperature records hune dzi wanala hone.'),
    'VE retains the exact record type and only asks to check where records exist');
  const veFrost = combinedPacket.fields.find(row => row.language === 've' && row.lessonId === 'reading-landscape-l3' && row.paragraphIndex === 2)!.finalTargetParagraph;
  assert.ok(veFrost.startsWith('Frost ndi ice that forms on a cold surface. Mist fhedzi a i sumbedzi uri ice has formed, nahone frost damage can happen without visible ice.'),
    'VE retains the exact frost definition and both damage qualifications');
});

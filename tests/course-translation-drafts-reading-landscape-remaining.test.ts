import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { SESOTHO_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-st-reading-landscape.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { englishSlideRecords, validatePairedDraft } from '../scripts/paired-draft-slides.mjs';

const firstObservationsProof = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-FIRST-OBSERVATIONS-IMPLEMENTATION-2026-10-05.json', import.meta.url), 'utf8')) as {
  pairedFieldsApplied: Array<{
    language: 'st' | 've' | 'ts';
    slide: number;
    field: 'body';
    index: number;
    sourceEnglish: string;
    segments: Array<{ sourceEnglish: string; status: 'draft' | 'english-hold'; text?: string }>;
    target: string;
  }>;
};

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

type Language = 'st' | 've' | 'ts';
type Segment = { sourceEnglish: string; status: 'draft' | 'english-hold'; text?: string };
type TargetRecord = { status: 'draft' | 'mixed' | 'english-hold'; text?: string; segments?: Segment[] };
const allDrafts = { st: SESOTHO_READING_LANDSCAPE_DRAFT, ...drafts };
const learnerApplied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-FULL-LEARNER-APPLIED-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8')) as {
  entries: Array<{ languageCode: Language; lessonId: string; field: string; exactSource: string; currentTarget: string; appliedTarget: string }>;
};
const deckApplied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/READING-FULL-DECK-APPLIED-CANDIDATES-2026-10-05.json', import.meta.url), 'utf8')) as {
  records: Array<{ identity: { language: Language; slide: number; field: 'heading' | 'body'; index: number | null }; sourceEnglish: string; before: TargetRecord; after: TargetRecord; target: string }>;
};
const render = (record: TargetRecord, source: string): string => record.status === 'english-hold' ? source :
  record.status === 'mixed' ? record.segments!.map(segment => segment.text ?? segment.sourceEnglish).join('') : record.text!;
const lesson = (language: Language, lessonId: string) => allDrafts[language].lessons.find(item => item.id === lessonId)!;
const currentParagraph = (language: Language, lessonId: string, index: number) => bodyText(lesson(language, lessonId).body).split('\n\n')[index];

// The full-module review superseded exact-English freezes. Its before/after evidence,
// rather than the current registry, authorizes each change to a historical paragraph.
const expectedParagraph = (language: Language, lessonId: string, index: number, historical: string): string => {
  const row = learnerApplied.entries.find(item => item.languageCode === language && item.lessonId === lessonId && item.field === 'body');
  if (!row) return historical;
  const source = module.lessons.find(item => item.id === lessonId)!;
  assert.equal(row.exactSource, source.body, 'a superseding review must bind to the exact current source');
  assert.equal(row.currentTarget.split('\n\n').length, source.body.split('\n\n').length);
  assert.equal(row.currentTarget.split('\n\n')[index], historical,
    'superseding authorization starts from the preserved historical paragraph');
  assert.equal(row.appliedTarget.split('\n\n').length, source.body.split('\n\n').length);
  return row.appliedTarget.split('\n\n')[index];
};
const assertFallback = (language: Language, lessonId: string, sourceParagraph: string) => {
  const source = module.lessons.find(item => item.id === lessonId)!;
  const changed = { ...source, body: source.body.replace(sourceParagraph, `${sourceParagraph} Changed.`) };
  assert.notEqual(changed.body, source.body, 'the drift probe must actually change the source');
  const fallback = resolveLearnerLessonPresentation(changed, language);
  assert.equal(fallback.status, 'english-fallback', 'changed source withdraws the stale translation');
  assert.equal(fallback.content.body, changed.body, 'fallback displays the updated English instruction');
};

test('Reading observation drafts retain their exact source and geometry through reviewed ordinary-prose extensions', () => {
  const source = englishSlideRecords(readFileSync(new URL('../docs/narration/reading-landscape.en.md', import.meta.url), 'utf8'));
  const selected = new Set(['st:2:1', 'st:5:0', 'st:6:0', 'st:6:1', 've:5:0', 've:6:0', 've:6:1', 'ts:2:1', 'ts:5:0', 'ts:6:0', 'ts:6:1']);
  assert.equal(firstObservationsProof.pairedFieldsApplied.length, selected.size);
  assert.deepEqual(new Set(firstObservationsProof.pairedFieldsApplied.map(row => `${row.language}:${row.slide}:${row.index}`)), selected,
    'the original observation release remains identifiable independently of later authorized fields');
  for (const language of ['st', 've', 'ts'] as const) {
    const paired = JSON.parse(readFileSync(new URL(`../docs/narration/reading-landscape.${language}.paired-draft.json`, import.meta.url), 'utf8'));
    const checked = validatePairedDraft(paired, source, language);
    for (const row of firstObservationsProof.pairedFieldsApplied.filter(item => item.language === language)) {
      const slide = checked[row.slide - 1];
      const field = slide.target.body[row.index];
      const later = deckApplied.records.find(item => item.identity.language === language && item.identity.slide === row.slide && item.identity.field === row.field && item.identity.index === row.index);
      assert.equal(slide.english.body[row.index], row.sourceEnglish, 'English source binding never changes with localization');
      assert.equal(field.status, 'mixed', 'technical holds remain distinguishable from unreviewed ordinary prose');
      if (later) {
        assert.equal(render(later.before, row.sourceEnglish), row.target, 'superseding proof starts with the historical observation text');
        assert.deepEqual(field, later.after);
      } else assert.deepEqual(field.segments, row.segments);
      assert.equal(field.segments.map((segment: Segment) => segment.sourceEnglish).join(''), row.sourceEnglish);
      assert.equal(field.segments.map((segment: Segment) => segment.text ?? segment.sourceEnglish).join(''), later?.target ?? row.target);
    }
    const water = firstObservationsProof.pairedFieldsApplied.find(row => row.language === language && row.slide === 5)!;
    assert.equal(water.sourceEnglish, 'The picture shows rain moving downhill. Follow where it speeds up, spreads, sinks, gathers, and leaves the land.');
    assert.equal(water.segments.find(segment => segment.sourceEnglish === 'sinks')?.status, 'english-hold', 'infiltration is not guessed');
    assert.doesNotMatch(water.target, /valley|phuleng|decreases|decrease/i, 'water motion gains no invented valley or decreasing-water claim');
    const parts = render(checked[5].target.body[0], checked[5].english.body[0]);
    assert.match(parts, /A-frame level from three poles and a weighted string/, 'parts and count remain exact');
    const trace = render(checked[5].target.body[1], checked[5].english.body[1]);
    assert.match(trace, /points at the same height/);
    assert.match(trace, /these points|points idzi|tipoyinti leti/, 'join refers to the same marked points');
    assert.match(trace, /contour line/, 'the joined points trace a contour, not a new earthworks design');
    if (language === 've') {
      const already = render(checked[1].target.body[1], checked[1].english.body[1]);
      assert.equal((already.match(/(?:yo|ḽo|wo) no/g) ?? []).length, 4, 'rain, sun, wind and cold air all retain already');
      assert.match(already, /gaps and ridges/);
      assert.match(already, /hollows/);
    }
    const safety = checked[5].target.body[2];
    const row = deckApplied.records.find(item => item.identity.language === language && item.identity.slide === 6 && item.identity.index === 2)!;
    assert.equal(row.sourceEnglish, checked[5].english.body[2]);
    assert.deepEqual(safety, row.after, 'independently reviewed assessment prose replaces the obsolete whole-English hold');
    const text = render(safety, row.sourceEnglish);
    assert.match(text, language === 'ts' ? /Mimfungho ya xona i leswi xiyiwaka/ : /Its marks are an observation/);
    assert.match(text, language === 'st' ? /ha se moralo kapa tumello ya earthworks/ : language === 've' ? /a si pulane kana thendelo ya earthworks/ : /a hi pulani kumbe mpfumelelo wa earthworks/,
      'mark observations confer neither earthworks design nor approval');
    assert.match(text, /earthworks/);
    assert.match(text, /slope.*drainage.*storm flow.*safe overflow route/, 'all assessment factors remain ordered');
    assert.match(text, language === 'st' ? /Pele u cheka.*hlahlojoe.*koetlisitsoeng.*sebakeng seo/ :
      language === 've' ? /sa athu bwa.*ṱolwe.*henefho o gudiswaho/ : /nga si cela.*kamberiwa.*ndhawini.*leteriweke/,
    'before digging still requires site assessment and a trained local adviser');
  }
});

test('Reading before-digging refinements preserve every paragraph through authorized changes and reject source drift', () => {
  assert.equal(candidates.length, 2);
  for (const candidate of candidates) {
    const source = module.lessons.find(item => item.id === candidate.lessonId)!;
    const registry = lesson(candidate.language, candidate.lessonId);
    const target = bodyText(registry.body);
    const sourceParagraphs = source.body.split('\n\n');
    const current = candidate.currentTargetBody.split('\n\n');
    const proposed = candidate.proposedTargetBody.split('\n\n');
    const actual = target.split('\n\n');
    assert.equal(source.body, candidate.canonicalSourceBody);
    assert.equal(registry.body.sourceEnglish, source.body);
    assert.equal(registry.body.reviewStatus, 'machine-draft');
    assert.equal(sourceParagraphs[candidate.paragraphIndex], candidate.canonicalSourceParagraph);
    assert.equal(sourceParagraphs.length, actual.length);
    assert.equal(actual.length, proposed.length);
    const water = fullerPacket.fields.find(item => item.language === 'ts' && item.lessonId === 'reading-landscape-l1' && item.paragraphIndex === 2)!;
    for (let index = 0; index < actual.length; index += 1) {
      const historical = index === candidate.paragraphIndex ? proposed[index] : candidate.language === 'ts' && index === 2 ? water.currentTargetParagraph : current[index];
      assert.equal(actual[index], expectedParagraph(candidate.language, candidate.lessonId, index, historical),
        'both scoped and nonscoped paragraphs follow the historical draft plus independently authorized before/after changes');
    }
    assert.equal(candidate.canonicalSourceParagraph.split(candidate.targetedSourceSentence).length, 2);
    assert.equal(candidate.segments.map(segment => segment.sourceEnglish).join(''), candidate.targetedSourceSentence);
    assert.equal(candidate.segments.map(segment => segment.targetText).join(''), candidate.proposedSentence);
    const assessment = actual[candidate.paragraphIndex];
    assert.match(assessment, /swale, dam/, 'named structures remain source-bound');
    assert.match(assessment, /Its marks are an observation/);
    assert.match(assessment, candidate.language === 've' ? /a si pulane kana thendelo ya earthworks/ : /a hi design kumbe mpfumelelo wa earthworks/,
      'an observation does not become earthworks design or approval');
    assert.match(assessment, candidate.language === 've' ? /Mavu.*sendama.*maḓi a bva.*mvula khulu.*tsireledzeaho.*maḓi manzhisa/ : /Soil, slope, drainage, storm flow.*hlayisekeke.*mati lama taleke/,
      'soil, slope, drainage, storm flow and safe overflow remain in the checked order');
    assert.match(assessment, candidate.language === 've' ? /henefho o gudiswaho/ : /trained local adviser/);
    const shown = resolveLearnerLessonPresentation(source, candidate.language);
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, target);
    assertFallback(candidate.language, candidate.lessonId, candidate.canonicalSourceParagraph);
  }
});

test('Reading body extensions preserve checked field ancestry, crop age and site safeguards while source drift falls back', () => {
  assert.equal(fullerPacket.changedFieldCount, fullerPacket.fields.length);
  assert.equal(combinedPacket.uniqueChangedParagraphCount, combinedPacket.fields.length);
  assert.equal(fullerPacket.excludedUnchangedRows.length, 2, 'unchanged historical frost-sensitivity candidates were not reported as new work');
  for (const field of fullerPacket.fields) {
    const source = module.lessons.find(item => item.id === field.lessonId)!;
    const registry = lesson(field.language, field.lessonId);
    const shown = resolveLearnerLessonPresentation(source, field.language);
    const combined = combinedPacket.fields.find(item => item.language === field.language && item.lessonId === field.lessonId && item.paragraphIndex === field.paragraphIndex)!;
    const second = secondPassPacket.paragraphs.find(item => item.language === field.language && item.lessonId === field.lessonId && item.bodyParagraphIndexZeroBased === field.paragraphIndex);
    assert.equal(registry.body.sourceEnglish, source.body);
    assert.equal(registry.body.reviewStatus, 'machine-draft');
    assert.equal(shown.status, 'draft');
    assert.equal(shown.content.body, bodyText(registry.body));
    assert.equal(bodyText(registry.body).split('\n\n').length, source.body.split('\n\n').length);
    assert.equal(source.body.split('\n\n')[field.paragraphIndex], field.sourceEnglishParagraph);
    assert.equal(currentParagraph(field.language, field.lessonId, field.paragraphIndex), expectedParagraph(field.language, field.lessonId, field.paragraphIndex, combined.finalTargetParagraph));
    if (second) {
      assert.equal(second.actualCurrentTargetParagraph, field.currentTargetParagraph);
      assert.equal(second.correctedRecommendedTargetParagraph, combined.finalTargetParagraph, 'historical second-pass evidence remains intact');
    }
    assert.notEqual(field.previousTargetParagraph, field.currentTargetParagraph, 'historical refinements were actual changes');
    assertFallback(field.language, field.lessonId, field.sourceEnglishParagraph);
  }
  for (const language of ['st', 've', 'ts'] as const) {
    const observation = currentParagraph(language, 'reading-landscape-l1', 0);
    assert.match(observation, language === 'st' ? /sebakeng se sireletsehileng.*pula e matla.*Ha ho se ho sireletsehile kamora moo/ :
      language === 've' ? /mvula khulu.*fhethu ho tsireledzeaho.*Musi zwo no tsireledzea nga murahu/ :
        /endhawini leyi hlayisekeke.*mpfula ya matimba.*Loko swi hlayisekile endzhaku/,
    'heavy-rain observation requires a safe place and walking waits until safe afterward');
    const young = currentParagraph(language, 'reading-landscape-l2', 2);
    assert.match(young, /Pawpaw.*young citrus/, 'age is young, not size or green fruit');
    assert.match(young, language === 'st' ? /dipokotho tse tlase tse tsejwang.*pele o jala/ : language === 've' ? /known low frost pockets.*sa athu ṱavha/ : /tindhawu ta le hansi leti tiviwaka.*nga se byala/);
  }
  const veWind = currentParagraph('ve', 'reading-landscape-l3', 0);
  assert.match(veWind, /your site's ridges and gaps/);
  assert.match(veWind, /rekhodo dza mutsho wa henefho.*sa athu dzhia tsheo/, 'local records precede choosing shelter');
  const veMap = currentParagraph('ve', 'reading-landscape-l4', 1);
  assert.match(veMap, /khakibos.*blackjack.*disturbed places/);
  assert.match(veMap, /a zwi sumbedzi arali mavu o tsitsikana \(compacted\)/);
  assert.match(veMap, /ṱolani mavu.*sa athu dzhia tsheo.*patch.*design/i);
  const tsMap = currentParagraph('ts', 'reading-landscape-l4', 1);
  assert.match(tsMap, /khakibos.*blackjack/);
  assert.match(tsMap, /kavanyetiweke.*swona ntsena a ku kombisi.*tsindziyerile/, 'presence alone still cannot diagnose compaction');
  const tsWater = currentParagraph('ts', 'reading-landscape-l1', 2);
  assert.match(tsWater, /ti nga engetela erosion.*tswongaka mati hi ku nonoka.*nga khoma mati yo tala ngopfu/);
  assert.match(tsWater, /Hlawula any water works for the site.*kunguhata ndlela leyi hlayisekeke yo humesa mati lama taleke/);
  assert.doesNotMatch(tsWater, /suitable water works/, 'source any scope remains without an added placement rule');
});

test('Reading frost observations keep full-season comparisons, weather conditions and damage limits after localization', () => {
  assert.equal(secondPassPacket.reviewedHead, '68719a788e0041da32eccfbbf36ca821eadfd321');
  assert.deepEqual(secondPassPacket.summary, {
    paragraphsChecked: 4, candidateClauses: 11, acceptedUnreviewed: 8, localizedWithPreciseEnglishAnchor: 2, heldUnchanged: 1,
    packetFullCurrentTargetsMatchingLiveResolver: 1, packetFullProposalsMatchingLiveCurrentComposition: 1,
    individualCandidateSpansMatchingCurrentResolver: 11, individualSourceAndSegmentConcatenationChecksPassed: true,
  }, 'historical independent review is retained as evidence, rather than being mistaken for the current target');
  for (const row of secondPassPacket.paragraphs) {
    const source = module.lessons.find(item => item.id === row.lessonId)!;
    const registry = lesson(row.language, row.lessonId);
    assert.equal(source.body.split('\n\n')[row.bodyParagraphIndexZeroBased], row.canonicalSourceParagraph);
    assert.equal(currentParagraph(row.language, row.lessonId, row.bodyParagraphIndexZeroBased), expectedParagraph(row.language, row.lessonId, row.bodyParagraphIndexZeroBased, row.correctedRecommendedTargetParagraph));
    assert.equal(registry.body.sourceEnglish, source.body);
    assert.equal(registry.body.reviewStatus, 'machine-draft');
    assertFallback(row.language, row.lessonId, row.canonicalSourceParagraph);
  }
  const tsCold = currentParagraph('ts', 'reading-landscape-l3', 1);
  assert.match(tsCold, /vusiku byo tenga ni byo rhula.*moya wo titimela wu nga khulukela ehansi.*hlengeletana/);
  assert.match(tsCold, /ti nga titimela ku tlurisa tindhawu to rhelela leti nga ekusuhi/, 'can-be-colder and nearby slopes remain explicit');
  assert.match(tsCold, /through the local frost season/);
  assert.match(tsCold, /matsalwa ya mahiselo ya le hansi swinene ya laha kaya loko ma kumeka/, 'minimum-temperature records retain local/availability conditions');
  assert.match(tsCold, /Loko ma nga ri kona.*vusiku byo titimela.*mutsundzuxi wa swa vurimi wa laha kaya.*nga si hlawula.*tender seedlings/, 'no-record fallback retains continued cold-night observations and adviser before placement');
  const veCold = currentParagraph('ve', 'reading-landscape-l3', 1);
  assert.match(veCold, /vhu sa na makole, hu si na muya.*u nga elela u tshi ya fhasi/i);
  assert.match(veCold, /hu nga rothola u fhira u sendama ha mavu ha tsini/);
  assert.match(veCold, /candidate places through the local frost season/);
  assert.match(veCold, /minimum temperatures.*henefho hune dza wanala hone/);
  assert.match(veCold, /Arali dzi sa wanali.*vhusiku vhu rotholaho.*mueletshedzi wa zwa vhulimi wa henefho.*sa athu nanga.*tender seedlings/);
  for (const language of ['st', 've', 'ts'] as const) {
    const frost = currentParagraph(language, 'reading-landscape-l3', 2);
    assert.match(frost, language === 'st' ? /Serame \(frost\) ke leqhwa.*Mohodi.*ha o bontshe.*tshenyo.*ka etsahala ntle le leqhwa le bonwang/ :
      language === 've' ? /Frost ndi ice.*surface yo rotholaho.*Mist fhedzi a i sumbedzi.*frost damage i nga itea hu si na ice ine ya vhonala/ :
        /Frost i ice.*surface leyi titimelaka.*Mist ntsena a yi kombisi.*frost damage yi nga endleka handle ka ice leyi vonakaka/,
    'mist alone is not proof and damage can occur without visible ice');
    assert.match(frost, language === 'st' ? /ho bata kapa tshenyo.*nako e telele ka ho fetisisa/ : language === 've' ? /u rothola kana tshinyalo.*tshifhinga tshilapfusesa/ : /cold or damage.*nkarhi wo leha ngopfu/,
      'longest-lasting cold or damage determines where to mark');
    assert.match(frost, language === 'st' ? /Boloka.*hole le.*cold pockets/ : language === 've' ? /Keep sensitive plants away from the cold pockets/ : /Hlayisa.*ekule ni cold pockets/);
    const rationalePair = lesson(language, 'reading-landscape-l3').quiz[0].rationale;
    const rationale = bodyText(rationalePair);
    assert.equal(rationalePair.sourceEnglish, module.lessons[2].quiz[0].rationale);
    assert.match(rationale, /through the local frost season/);
    assert.match(rationale, language === 'st' ? /hase sesupo se le seng feela.*ha ho na.*tiisang/ : language === 've' ? /a si yone fhedzi.*a hu na.*fulufhedzisa/ : /a hi yona ntsena.*a ku na.*tiyisekisaka/,
      'visible frost is not the only sign and no hillside placement guarantees freedom from frost');
    const blight = currentParagraph(language, 'reading-landscape-l3', 3);
    assert.match(blight, language === 'st' ? /ntse e ka ata.*phodileng.*mongobo.*nako e telele.*feela ho ke ke ha e laola/ :
      language === 've' ? /i nga bvela phanḓa u phaḓalala.*rothola.*vhunyisi.*tshifhinga tshilapfu.*bed fhedzi a zwi nga i langi/ :
        /yi nga ya mahlweni yi hangalaka.*titimela.*tsakama.*nkarhi wo leha.*mubhedhi ntsena a swi nge yi lawuli/,
    'prolonged cool damp spread and moving-bed-alone limitation survive ordinary prose localization');
  }
});

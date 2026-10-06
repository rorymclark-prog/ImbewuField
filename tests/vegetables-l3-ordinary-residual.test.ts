import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { ordinaryBefore, ordinaryDeckBefore, ordinaryDrafts, ordinaryRows, ordinarySpanRows, originalSevenRows, vegetablesBeforeL3Ordinary, vegetablesDeckBeforeL3Ordinary } from './vegetables-l3-ordinary-residual-checks.ts';
const languages = ['st', 've', 'ts'] as const;
const keys = { st: 'sesothoDraft', ve: 'tshivendaDraft', ts: 'xitsongaDraft' } as const;
const source = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!.lessons.find(lesson => lesson.id === 'vegetables-staples-l3')!;

test('accepted residual clauses stay source-bound and preserve every other native/deck field, status and answer index', () => {
  assert.equal(ordinaryRows.length, 11);
  assert.equal(ordinarySpanRows.length, 12);
  assert.equal(originalSevenRows.length, 7, 'original accepted seven authority remains immutable');
  for (const original of originalSevenRows) assert.equal(ordinaryRows.find(row => row.candidateId === original.candidateId)!.proposedTarget, original.proposedTarget, 'the five later spans cannot overwrite an earlier accepted paragraph');
  for (const language of languages) {
    assert.deepEqual(vegetablesBeforeL3Ordinary(language, ordinaryDrafts[language]), ordinaryBefore.drafts[language]);
    const deck = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${language}.paired-draft.json`, 'utf8'));
    assert.deepEqual(vegetablesDeckBeforeL3Ordinary(language, deck), ordinaryDeckBefore[language]);
    const shown = resolveLearnerLessonPresentation(source, language);
    assert.equal(shown.status, 'draft');
    assert.deepEqual(shown.content.quiz.map(q => q.correct), [1, 1]);
    for (const row of ordinaryRows.filter(row => row.language === language)) assert.equal(shown.content.body.split('\n\n')[row.paragraphIndex], row.proposedTarget);
  }
});

test('failure consequence, young leaf age and storage OR until needed retain their exact accepted scope', () => {
  for (const language of languages) {
    const paragraphs = resolveLearnerLessonPresentation(source, language).content.body.split('\n\n');
    assert.match(paragraphs[4], /failure.*companion/);
    assert.match(paragraphs[4], language === 'st' ? /e neng e tla.*ho feta tsohle.*ka hoo.*e hlokang/ : language === 've' ? /ya vha i tshi ḓo.*u fhira zwiṅwe.*ngauralo.*ṱoḓa/ : /a yi ta.*ku hundza swin’wana.*hikokwalaho.*lavaka/);
    assert.match(paragraphs[8], /young leaves/);
    assert.doesNotMatch(paragraphs[8], /small leaves|new leaves|all leaves/);
    assert.match(paragraphs[8], language === 'st' ? /tsa yona le tsona di a jeha/ : language === 've' ? /ayo na one a a ḽiwa/ : /ya yona na yona ya dyiwa/);
  }
  const ts = resolveLearnerLessonPresentation(source, 'ts').content.body.split('\n\n')[1];
  assert.match(ts, /Yi hlayiseka, kumbe.*emavuni ku fikela loko u yi lava/);
  assert.doesNotMatch(ts, /Yi a hlayiseka/);
});

test('source, comparator, age, OR, answer-index and unlisted edits are noticed before any history rewind', () => {
  for (const language of languages) {
    for (const mutation of ['unlisted', 'source', 'comparison', 'age', 'index'] as const) {
      const changed: any = structuredClone(ordinaryDrafts[language]);
      const lesson = changed.lessons.find((lesson: any) => lesson.id === source.id);
      if (mutation === 'unlisted') changed.description[keys[language]] += ' Drift.';
      else if (mutation === 'source') lesson.body.sourceEnglish += ' Drift.';
      else if (mutation === 'index') lesson.quiz[0].sourceCorrectIndex = 0;
      else lesson.body[keys[language]] = lesson.body[keys[language]].replace(mutation === 'age' ? 'young leaves' : 'failure', mutation === 'age' ? 'small leaves' : 'success');
      assert.throws(() => vegetablesBeforeL3Ordinary(language, changed), `${language}/${mutation}: whole-current guard must reject mutation`);
    }
    const changedSource = { ...source, body: source.body.replace('Its young leaves are edible too.', 'All leaves are edible.') };
    const shown = resolveLearnerLessonPresentation(changedSource, language);
    assert.equal(shown.status, 'english-fallback');
    assert.equal(shown.content.body, changedSource.body);
    const changedIndex = structuredClone(source); changedIndex.quiz[0].correct = 0;
    assert.equal(resolveLearnerLessonPresentation(changedIndex, language).status, 'english-fallback');
    const changedDeck = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${language}.paired-draft.json`, 'utf8'));
    changedDeck.slides[0].target.heading.text += ' Drift.';
    assert.throws(() => vegetablesDeckBeforeL3Ordinary(language, changedDeck), `${language}: unrelated deck field remains protected`);
  }
  const changed: any = structuredClone(ordinaryDrafts.ts);
  changed.lessons.find((lesson: any) => lesson.id === source.id).body.xitsongaDraft = changed.lessons.find((lesson: any) => lesson.id === source.id).body.xitsongaDraft.replace('hlayiseka, kumbe', 'hlayiseka, naswona');
  assert.throws(() => vegetablesBeforeL3Ordinary('ts', changed), 'OR cannot become AND');
});

// The five additional spans retain the source condition, resource relation, quantity and crop class.
test('weather OR pests, resource differences and two-or-more staples preserve exact scope and reject regressions', () => {
  const st = resolveLearnerLessonPresentation(source, 'st').content.body.split('\n\n');
  assert.match(st[2], /Tse pedi kapa ho feta.*ha maemo a leholimo kapa pests di otla/);
  assert.doesNotMatch(st[2], /disenyi/);
  assert.equal(st[15], 'Dijalo tse fapaneng di sebedisa metsi, mobu le dinako tsa selemo ka ditsela tse fapaneng. Phapang eo ke yona tshireletso.');
  const ts = resolveLearnerLessonPresentation(source, 'ts').content.body.split('\n\n');
  assert.match(ts[14], /^Staples swimbirhi kumbe ku fhira.*tindlela to tala.*ku ya mahlweni u dya/);
  assert.equal(ts[9], 'Amadumbe yi kota ku tiyisela eka wetter ground, laha other staples swi tikeriwaka.');
  for (const [language, index, from, to] of [['st', 2, 'kapa pests', 'le pests'], ['st', 15, 'mobu', 'pula'], ['ts', 14, 'kumbe ku fhira', 'ntsena'], ['ts', 9, 'other staples', 'other crops']] as const) {
    const changed: any = structuredClone(ordinaryDrafts[language]);
    const lesson = changed.lessons.find((lesson: any) => lesson.id === source.id);
    const paragraphs = lesson.body[keys[language]].split('\n\n');
    assert.ok(paragraphs[index].includes(from));
    paragraphs[index] = paragraphs[index].replace(from, to);
    lesson.body[keys[language]] = paragraphs.join('\n\n');
    assert.throws(() => vegetablesBeforeL3Ordinary(language, changed), `${language}/${index}: accepted relation/class cannot silently drift`);
  }
});

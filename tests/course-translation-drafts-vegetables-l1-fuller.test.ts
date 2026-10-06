import { vegetablesBeforePestPrecision } from './vegetables-pest-precision-checks.ts';
import { vegetablesWithL3Completion } from './vegetables-l3-completion-checks.ts';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';
import { vegetablesBeforeL1Ordinary, vegetablesDeckBeforeL1Ordinary, vegetablesL1Before, vegetablesL1Rows } from './vegetables-l1-ordinary-checks.ts';

const evidence = (suffix: string) => JSON.parse(readFileSync(new URL(`../docs/study-translation-reviews/VEGETABLES-L1-FULLER-ORDINARY-2026-10-05-${suffix}.json`, import.meta.url), 'utf8'));
const baseline = evidence('BASELINE');
const applied = evidence('APPLIED');
const l4Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L4-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
const l2Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L2-FULLER-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
const drafts = { st, ts, ve };
type Language = keyof typeof drafts;
const keys = { st: 'sesothoDraft', ts: 'xitsongaDraft', ve: 'tshivendaDraft' } as const;
const canonical = COURSE_MODULES.find(module => module.id === 'vegetables-staples')!;
const lesson = canonical.lessons.find(lesson => lesson.id === 'vegetables-staples-l1')!;
function pairAt(draft: any, field: string, lessonId = 'vegetables-staples-l1'): any {
  const parts = field.split('.');
  const target = draft.lessons.find((lesson: any) => lesson.id === lessonId);
  if (parts[0] === 'module') return draft[parts[1]];
  if (parts[0] === 'body') return target.body;
  if (parts[0] === 'keyPoints') return target.keyPoints[Number(parts[1])];
  const question = target.quiz[Number(parts[1])];
  return parts[2] === 'options' ? question.options[Number(parts[3])] : question[parts[2] === 'q' ? 'question' : parts[2]];
}
function fieldText(language: Language, field: string): string {
  // 6 October: historical leaf expectations follow full current18-quiz and12-pest validation/rewind.
  const text = pairAt(vegetablesBeforePestPrecision(language, drafts[language]), field)[keys[language]];
  return field.startsWith('body.') ? text.split('\n\n')[Number(field.split('.')[2])] : text;
}
const digits = (text: string) => text.match(/\d+(?:[.-]\d+)?/g) ?? [];

// The frozen pre-change module is the preservation authority; a new translation must
// not silently rewrite canonical teaching, a neighbouring paragraph or another lesson.
test('Vegetables ordinary drafts retain every canonical instruction and all unrelated regional fields', () => {
  assert.deepEqual(canonical, baseline.canonical);
  for (const language of Object.keys(drafts) as Language[]) {
    const expected = structuredClone(baseline.drafts[language]);
    for (const row of applied.fields.filter((row: any) => row.language === language)) {
      const pair = pairAt(expected, row.fieldPath, row.lessonId);
      if (row.fieldPath.startsWith('body.')) {
        const paragraphs = pair[keys[language]].split('\n\n');
        assert.equal(paragraphs[Number(row.fieldPath.split('.')[2])], row.currentTarget);
        assert.equal(pair.sourceEnglish.split('\n\n')[Number(row.fieldPath.split('.')[2])], row.sourceEnglish);
        paragraphs[Number(row.fieldPath.split('.')[2])] = row.appliedTarget;
        pair[keys[language]] = paragraphs.join('\n\n');
      } else {
        assert.equal(pair[keys[language]], row.currentTarget);
        assert.equal(pair.sourceEnglish, row.sourceEnglish);
        pair[keys[language]] = row.appliedTarget;
      }
      pair.reviewStatus = 'machine-draft';
    }
    // 5 October 2026: the earlier full-module L1 snapshot predates this later source-bound L4 batch.
    // Layer its exact approved changes onto the reconstructed module so the historical test keeps
    // checking every unlisted field against one coherent current result.
    for (const row of l4Applied.fields.filter((row: any) => row.language === language && row.changedFromCurrent)) {
      const pair = pairAt(expected, row.fieldPath, row.lessonId);
      if (row.fieldPath.startsWith('body.')) {
        const paragraphs = pair[keys[language]].split('\n\n');
        const index = Number(row.fieldPath.split('.')[2]);
        assert.equal(paragraphs[index], row.currentTarget, `${language}/${row.fieldPath}: historical L4 value is current before applying the accepted target`);
        assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish);
        paragraphs[index] = row.appliedTarget;
        pair[keys[language]] = paragraphs.join('\n\n');
      } else {
        assert.equal(pair[keys[language]], row.currentTarget, `${language}/${row.fieldPath}: historical L4 value is current before applying the accepted target`);
        assert.equal(pair.sourceEnglish, row.sourceEnglish);
        pair[keys[language]] = row.appliedTarget;
      }
      pair.reviewStatus = row.appliedReviewStatus;
    }
    // 5 October 2026: the final L2 prose batch followed the older L1 and L4 snapshots.
    // Layer its exact approved source-bound targets so this historical comparison still
    // checks every unlisted field against the actual current registry.
    for (const row of l2Applied.fields.filter((row: any) => row.language === language && row.language !== 'ts')) {
      const pair = pairAt(expected, row.fieldPath, row.lessonId);
      if (row.fieldPath.startsWith('body.')) {
        const paragraphs = pair[keys[language]].split('\n\n');
        const index = Number(row.fieldPath.split('.')[2]);
        assert.equal(paragraphs[index], row.currentTarget,
          `${language}/${row.fieldPath}: frozen L2 before-state remains exact`);
        assert.equal(pair.sourceEnglish.split('\n\n')[index], row.sourceEnglish);
        paragraphs[index] = row.appliedTarget;
        pair[keys[language]] = paragraphs.join('\n\n');
      } else {
        assert.equal(pair[keys[language]], row.currentTarget,
          `${language}/${row.fieldPath}: frozen L2 before-state remains exact`);
        assert.equal(pair.sourceEnglish, row.sourceEnglish);
        pair[keys[language]] = row.appliedTarget;
      }
      pair.reviewStatus = row.appliedReviewStatus;
    }
    // 6 October: preserve whole-module coverage while adding the exact reviewed L3 leaf/status layer.
    assert.deepEqual(vegetablesBeforePestPrecision(language, drafts[language]), vegetablesWithL3Completion(language, expected), `${language}: only reviewed source-bound fields may change, including the separately checked 6 October L3 layer`);
  }
});

test('Vegetables source and draft retain all twenty ordered paragraphs, numbered dimensions and quiz assignments', () => {
  for (const language of Object.keys(drafts) as Language[]) {
    const draft = vegetablesBeforePestPrecision(language, drafts[language]).lessons.find(lesson => lesson.id === 'vegetables-staples-l1')! as any;
    assert.equal(draft.body.sourceEnglish, lesson.body);
    const paragraphs = draft.body[keys[language]].split('\n\n');
    assert.equal(paragraphs.length, lesson.body.split('\n\n').length);
    assert.equal(paragraphs.length, 20);
    assert.match(paragraphs[2], /^One metre to one point two metres/);
    assert.match(paragraphs[15], /One point two metres.*Three metres/);
    assert.deepEqual(draft.quiz.map((q: any) => q.sourceCorrectIndex), lesson.quiz.map(q => q.correct));
    assert.deepEqual(draft.quiz.map((q: any) => q.sourceCorrectIndex), [1, 2]);
    for (const row of applied.fields.filter((row: any) => row.language === language)) {
      const actual = fieldText(language, row.fieldPath);
      assert.equal(actual, row.appliedTarget);
      assert.deepEqual(digits(actual), digits(row.sourceEnglish), `${language}/${row.fieldPath}: no invented or missing figures`);
    }
  }
});

test('Reachability retains either of two paths and never stepping on the growing area', () => {
  const reach = {
    st: /bohareng.*tseleng efe kapa efe.*maoto.*ha a ame.*le ka mohla/,
    ts: /exikarhini.*ndlela yin'wana ni yin'wana ya letimbirhi.*milenge.*a yi khumbi growing area nikatsongo/,
    ve: /vhukati.*iṅwe na iṅwe ya paths mbili.*milenzhe.*a i kwami growing area na luthihi/,
  };
  for (const language of Object.keys(drafts) as Language[]) assert.match(fieldText(language, 'body.paragraphs.2'), reach[language]);
});

test('Wet clay prohibition and local advice precede deeper cultivation; deeper work is only genuinely necessary', () => {
  const soil = {
    st: /U se ke ua cheka wet clay.*compaction kapa poor drainage.*matla haholo.*fumana sesosa.*keletso ya sebaka sa heno pele.*deeper cultivation/,
    ts: /U nga keli wet clay.*compaction kumbe poor drainage.*severe.*kuma xivangelo.*switsundzuxo swa le ndhawini u nga si.*deeper cultivation/,
    ve: /Ni songo bwa wet clay.*compaction kana poor drainage.*severe.*wanani tshiitisi.*nyeletshedzo ya henefho ni sa athu.*deeper cultivation/,
  };
  const only = { st: /qala ka no-dig.*feela ha.*hlile.*hloka/, ts: /sungula hi no-dig.*ntsena loko.*hakunene.*lava/, ve: /thomani nga no-dig.*fhedzi arali.*vhukuma/ };
  for (const language of Object.keys(drafts) as Language[]) {
    assert.match(fieldText(language, 'body.paragraphs.7'), soil[language]);
    assert.match(fieldText(language, 'body.paragraphs.17'), only[language]);
  }
  assert.match(fieldText('st', 'body.paragraphs.8'), /wet ground.*metsi a hlokang somewhere to drain away to\.$/);
});

test('Historical pre-residual snapshot keeps its source holds after the newer L1 layer is checked and rewound', () => {
  const veParagraph = fieldText('ve', 'body.paragraphs.12');
  assert.equal(veParagraph.split('. ')[0] + '.', 'Others do better with a protected start in a nursery, then transplanting.');
  assert.ok(veParagraph.endsWith('Tomatoes na brassicas zwi wela henefho.'));
  assert.equal(applied.fields.find((row: any) => row.language === 've' && row.fieldPath === 'body.paragraphs.12').progressKind, 'exact-English-semantic-hold-repair');
  assert.match(fieldText('ts', 'quiz.0.options.2'), /^Narrow beds drain better eka swiyimo hinkwato$/);
  assert.match(fieldText('ve', 'quiz.0.options.2'), /^Narrow beds drain better kha nyimele dzoṱhe$/);
  assert.match(fieldText('ve', 'quiz.1.q'), /best suited to direct-seeding rather than transplanting/);
});

test('Vegetables L1 residual wording preserves increasing difficulty, majority scope, broad performance comparison and crop sequence', () => {
  assert.equal(vegetablesL1Rows.length, 5, 'only three Tshivenda, one Sesotho and one Xitsonga paragraph enter this dated layer');
  for (const language of Object.keys(drafts) as Language[]) {
    const restored = vegetablesBeforeL1Ordinary(language, drafts[language]);
    assert.deepEqual(restored, vegetablesL1Before.drafts[language], `${language}: only the five reviewed L1 rows rewind to the exact prior registry`);
    const deck = JSON.parse(readFileSync(`docs/narration/vegetables-staples.${language}.paired-draft.json`, 'utf8'));
    vegetablesDeckBeforeL1Ordinary(language, deck);
    const live = resolveLearnerLessonPresentation(lesson, language);
    assert.equal(live.status, 'draft');
    assert.deepEqual(live.content.quiz.map(question => question.correct), [1, 2], `${language}: original answer choices stay B/C`);
    for (const row of vegetablesL1Rows.filter((item: any) => item.language === language)) {
      assert.equal(live.content.body.split('\n\n')[row.bodyIndex], row.afterTarget, `${row.id}: live learner exposes the exact checked target`);
    }
  }
  const veBody = resolveLearnerLessonPresentation(lesson, 've').content.body.split('\n\n');
  assert.match(veBody[0], /^Mavu o petetsanaho a xedza zwikhala zwa muya\./,
    'physical soil compression and lost air spaces are retained without introducing a new soil category');
  assert.match(veBody[0], /Bed gets harder to work kha khalaṅwaha iṅwe na iṅwe\.$/,
    'the increasing comparative is held exactly while the surrounding season phrase remains localized');
  assert.match(veBody[6], /^No-dig i tea kha vhunzhi ha mavu a ngade\./,
    'the no-dig method name stays precise and the translated scope remains most garden soils');
  const expectedNursery = {
    st: /di sebetsa hantle ho feta.*nursery.*transplanting.*Tomatoes le brassicas ke tsa sehlopha seo\.$/,
    ts: /swi tirha ku antswa.*nursery.*transplanting.*Tomatoes na brassicas swi wela eka ntlawa wolowo\.$/,
    ve: /zwi ita khwine.*nursery.*nga murahu transplanting.*Tomatoes na brassicas zwi wela henefho\.$/,
  };
  for (const language of Object.keys(drafts) as Language[]) {
    const paragraph = resolveLearnerLessonPresentation(lesson, language).content.body.split('\n\n')[12];
    assert.match(paragraph, expectedNursery[language], `${language}: broad “do better” comparison, protected start and crop grouping remain`);
    assert.ok(paragraph.includes('nursery') && paragraph.includes('transplanting'), `${language}: technical start and transplanting terms remain exact`);
  }
});

test('Vegetables L1 source, comparison, sequence, crop names and unrelated rows fail closed before history rewind', () => {
  const replaceParagraphOnce = (draft: any, language: Language, index: number, from: string, to: string) => {
    const target = draft.lessons.find((item: any) => item.id === 'vegetables-staples-l1');
    assert.ok(target, `${language}: mutation fixture must locate the actual L1 lesson`);
    const body = target.body[keys[language]].split('\n\n');
    assert.ok(body[index].includes(from), `${language}/body[${index}]: mutation premise exists`);
    body[index] = body[index].replace(from, to);
    assert.notEqual(body[index], target.body[keys[language]].split('\n\n')[index], `${language}/body[${index}]: mutation must change the guarded field`);
    target.body[keys[language]] = body.join('\n\n');
  };
  const veMutations: Array<[string, (draft: any) => void]> = [
    ['progressive comparison', draft => replaceParagraphOnce(draft, 've', 0, 'gets harder to work', 'is hard to work')],
    ['majority scope', draft => replaceParagraphOnce(draft, 've', 6, 'vhunzhi ha', 'manzhi a')],
    ['protected-start sequence', draft => replaceParagraphOnce(draft, 've', 12, 'nga murahu', ' ')],
    ['unlisted paragraph', draft => replaceParagraphOnce(draft, 've', 1, 'Permanent paths', 'Temporary paths')],
  ];
  for (const [label, mutate] of veMutations) {
    const changed: any = structuredClone(ve); mutate(changed);
    assert.throws(() => vegetablesBeforeL1Ordinary('ve', changed), `VE ${label}: validate actual accepted layer before rewind`);
  }
  const changedSt: any = structuredClone(st);
  replaceParagraphOnce(changedSt, 'st', 12, 'Tomatoes le brassicas', 'Tomatoes le other crops');
  assert.throws(() => vegetablesBeforeL1Ordinary('st', changedSt), 'the source crop group cannot drift during historical reconstruction');
  const changedTs: any = structuredClone(ts);
  replaceParagraphOnce(changedTs, 'ts', 12, 'ku antswa', 'swinene');
  assert.throws(() => vegetablesBeforeL1Ordinary('ts', changedTs), 'the broad comparative cannot become a non-comparative intensifier');

  const deck = JSON.parse(readFileSync('docs/narration/vegetables-staples.ve.paired-draft.json', 'utf8'));
  const cropSpan = deck.slides[5].target.body[1].segments.find((segment: any) => segment.sourceEnglish === ' Tomatoes');
  assert.ok(cropSpan, 'the exact spaced source segment is present in the composition');
  cropSpan.sourceEnglish = ' Tomato';
  assert.throws(() => vegetablesDeckBeforeL1Ordinary('ve', deck), 'source segment coverage and crop names are checked before any historical deck rewind');
});

test('Learner and module cards expose unreviewed targets alongside exact English, without implying fluent approval', () => {
  for (const language of Object.keys(drafts) as Language[]) {
    const presented = resolveLearnerLessonPresentation(lesson, language);
    assert.equal(presented.status, 'draft');
    assert.equal(presented.content.body, pairAt(drafts[language], 'body.paragraphs.0')[keys[language]]);
    assert.equal(resolveCourseModulePresentation(canonical, language).status, 'draft');
    assert.equal(drafts[language].reviewStatus, 'machine-draft');
  }
});

// A saved regional target is safe to show only while its entire source remains the
// reviewed source. Changing even an answer index or alt text must withdraw the draft.
test('Vegetables stale regional wording is withdrawn after any source instruction or answer changes', () => {
  const mutateQuiz = (change: (q: Lesson['quiz'][number]) => Lesson['quiz'][number]) => lesson.quiz.map((question, index) => index === 0 ? change(question) : question);
  const changes: Array<[string, Lesson]> = [
    ['title', { ...lesson, title: `${lesson.title} changed` }],
    ['body', { ...lesson, body: lesson.body.replace('Do not dig wet clay.', 'Dig wet clay.') }],
    ['keyPoint', { ...lesson, keyPoints: [lesson.keyPoints[0].replace('never', 'sometimes'), ...lesson.keyPoints.slice(1)] }],
    ['question', { ...lesson, quiz: mutateQuiz(q => ({ ...q, q: `${q.q} changed` })) }],
    ['option', { ...lesson, quiz: mutateQuiz(q => ({ ...q, options: q.options.map((option, index) => index === 1 ? `${option} changed` : option) })) }],
    ['rationale', { ...lesson, quiz: mutateQuiz(q => ({ ...q, rationale: `${q.rationale} changed` })) }],
    ['correctIndex', { ...lesson, quiz: mutateQuiz(q => ({ ...q, correct: 0 })) }],
    ['infographicAlt', { ...lesson, infographicAlt: `${lesson.infographicAlt} changed` }],
  ];
  for (const language of Object.keys(drafts) as Language[]) {
    for (const [field, changed] of changes) {
      assert.notDeepEqual(changed, lesson, `${field}: the source mutation must actually change teaching`);
      const shown = resolveLearnerLessonPresentation(changed, language);
      assert.equal(shown.status, 'english-fallback', `${language}/${field}: withdraw the complete stale draft`);
      assert.deepEqual(shown.content, {
        title: changed.title, body: changed.body, keyPoints: changed.keyPoints,
        quiz: changed.quiz, infographicAlt: changed.infographicAlt,
      }, `${language}/${field}: show the changed exact English, not unrelated regional fragments`);
    }
    const changedModule = { ...canonical, description: `${canonical.description} changed` };
    assert.deepEqual(resolveCourseModulePresentation(changedModule, language), {
      title: changedModule.title, description: changedModule.description, status: 'english-fallback',
    });
  }
});

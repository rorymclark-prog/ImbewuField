import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { COURSE_MODULES, type Lesson } from '../lib/course-modules.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { resolveCourseModulePresentation } from '../lib/course-module-translation-drafts.ts';
import { SESOTHO_VEGETABLES_STAPLES_DRAFT as st } from '../lib/course-translation-drafts-st-vegetables-staples.ts';
import { XITSONGA_VEGETABLES_STAPLES_DRAFT as ts } from '../lib/course-translation-drafts-ts-vegetables-staples.ts';
import { TSHIVENDA_VEGETABLES_STAPLES_L3_DRAFT as ve } from '../lib/course-translation-drafts-ve-vegetables-staples.ts';

const evidence = (suffix: string) => JSON.parse(readFileSync(new URL(`../docs/study-translation-reviews/VEGETABLES-L1-FULLER-ORDINARY-2026-10-05-${suffix}.json`, import.meta.url), 'utf8'));
const baseline = evidence('BASELINE');
const applied = evidence('APPLIED');
const l4Applied = JSON.parse(readFileSync(new URL('../docs/study-translation-reviews/VEGETABLES-L4-ORDINARY-2026-10-05-APPLIED.json', import.meta.url), 'utf8'));
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
  const text = pairAt(drafts[language], field)[keys[language]];
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
      const pair = pairAt(expected, row.fieldPath);
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
    assert.deepEqual(drafts[language], expected, `${language}: only reviewed source-bound fields may change`);
  }
});

test('Vegetables source and draft retain all twenty ordered paragraphs, numbered dimensions and quiz assignments', () => {
  for (const language of Object.keys(drafts) as Language[]) {
    const draft = drafts[language].lessons.find(lesson => lesson.id === 'vegetables-staples-l1')! as any;
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

test('Technical fallbacks keep the better nursery start and deliberately false all-conditions drainage distractor', () => {
  const veParagraph = fieldText('ve', 'body.paragraphs.12');
  assert.equal(veParagraph.split('. ')[0] + '.', 'Others do better with a protected start in a nursery, then transplanting.');
  assert.ok(veParagraph.endsWith('Tomatoes na brassicas zwi wela henefho.'));
  assert.equal(applied.fields.find((row: any) => row.language === 've' && row.fieldPath === 'body.paragraphs.12').progressKind, 'exact-English-semantic-hold-repair');
  assert.match(fieldText('ts', 'quiz.0.options.2'), /^Narrow beds drain better eka swiyimo hinkwato$/);
  assert.match(fieldText('ve', 'quiz.0.options.2'), /^Narrow beds drain better kha nyimele dzoṱhe$/);
  assert.match(fieldText('ve', 'quiz.1.q'), /best suited to direct-seeding rather than transplanting/);
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

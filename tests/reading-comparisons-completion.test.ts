import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import { COURSE_TRANSLATION_DRAFTS } from '../lib/course-translation-drafts.ts';
import { TSHIVENDA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ve-reading-landscape.ts';
import { XITSONGA_READING_LANDSCAPE_DRAFT } from '../lib/course-translation-drafts-ts.ts';
import { resolveLearnerLessonPresentation } from '../lib/course-localization.ts';
import { comparisonsNative, comparisonsNativeBefore, comparisonsSourceBefore, comparisonsPlan } from './reading-comparisons-history-checks.ts';

const source = COURSE_MODULES.flatMap(m => m.lessons).find(l => l.id === 'reading-landscape-l3')!;
const registries = { zu: COURSE_TRANSLATION_DRAFTS, ve: TSHIVENDA_READING_LANDSCAPE_DRAFT, ts: XITSONGA_READING_LANDSCAPE_DRAFT };

test('Reading ordinary wording preserves all unlisted source, draft, answer and status fields', () => {
  for (const language of ['zu', 've', 'ts'] as const) {
    assert.deepEqual(comparisonsNativeBefore(language, registries[language]), comparisonsNative.before[language]);
    const shown = resolveLearnerLessonPresentation(source, language);
    assert.equal(shown.status, 'draft');
    assert.deepEqual(shown.content.quiz.map(q => q.correct), [2, 1]);
    for (const row of comparisonsPlan.candidates.filter((r: any) => r.language === language)) {
      const parts = row.field.split('.');
      const actual = parts[0] === 'body' ? shown.content.body.split('\n\n')[Number(parts[1].replace('paragraph', ''))]
        : parts[0] === 'infographicAlt' ? shown.content.infographicAlt
        : parts[2] === 'options' ? shown.content.quiz[Number(parts[1])].options[Number(parts[3])]
        : shown.content.quiz[Number(parts[1])].rationale;
      assert.equal(actual, row.candidate);
    }
  }
});

test('changed frost-season source withdraws stale wording in both regional lessons', () => {
  const changed = structuredClone(source);
  changed.body += '\n\nNew source instruction.';
  for (const language of ['ve', 'ts'] as const) {
    const shown = resolveLearnerLessonPresentation(changed, language);
    assert.equal(shown.status, 'english-fallback');
    assert.equal(shown.content.body, changed.body);
  }
});

test('duration, quantity and disease qualifiers remain distinct', () => {
  const zu = resolveLearnerLessonPresentation(source, 'zu').content;
  assert.match(zu.body, /isikhathi eside kunazo zonke/);
  assert.match(zu.quiz[0].options[3], /omningi kunazo zonke/);
  assert.doesNotMatch(zu.quiz[1].rationale, /kakhulu/);
  assert.match(zu.quiz[1].rationale, /akusona isu eliphelele/);
  const ts = resolveLearnerLessonPresentation(source, 'ts').content;
  assert.ok(ts.body.includes('eka nguva hinkwayo ya xirhami ya laha kaya'));
  assert.match(ts.quiz[0].rationale, /kumbe u vutisa.*u nga se teka xiboho/);
  const ve = resolveLearnerLessonPresentation(source, 've').content;
  assert.match(ve.body, /Vhetshelani/);
  assert.doesNotMatch(ve.body, /Ṱutshelisani/);
  assert.match(ve.quiz[0].rationale, /kha khalaṅwaha yoṱhe ya tshando ya henefho/);
});

test('historical projection rejects any unlisted wording and arbitrary source bytes', () => {
  const changed = structuredClone(XITSONGA_READING_LANDSCAPE_DRAFT);
  changed.lessons[0].body.xitsongaDraft += '!';
  assert.throws(() => comparisonsNativeBefore('ts', changed));
  const path = 'lib/course-translation-drafts.ts';
  assert.throws(() => comparisonsSourceBefore(path, readFileSync(path, 'utf8') + '\n'));
});

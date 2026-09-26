import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

// isiZulu draft for the Farm Finance course (swarm/w6-finance-zu, learning-06).
//
// lib/course-finance-content.json is a generated file (scripts/build-finance-course.py, checked
// by tests/course-finance.test.ts against its manuscript's sha256) — isiZulu drafts live in the
// separate lib/course-finance-i18n.ts instead of being hand-added to the generated JSON.

const root = new URL('../', import.meta.url);
const content = JSON.parse(readFileSync(new URL('lib/course-finance-content.json', root), 'utf8'));
const units: Array<{ id: string; title: string; summary: string; lessons: Array<{ id: string; title: string; outcome: string | null; reading: string }> }> = content.units;

import {
  financeZu,
  FINANCE_ZU_UNIT_TITLE, FINANCE_ZU_UNIT_SUMMARY,
  FINANCE_ZU_LESSON_TITLE, FINANCE_ZU_LESSON_OUTCOME, FINANCE_ZU_LESSON_READING,
  FINANCE_ZU_PROJECT_NUMBER_LABEL, FINANCE_ZU_PROJECT_REASONING_LABEL, FINANCE_ZU_PROJECT_REASONING_PROMPT,
} from '../lib/course-finance-i18n.ts';
import { PROJECT_NUMBER_QUESTIONS, PROJECT_REASONING } from '../lib/finance-project.ts';

test('every unit has a source-paired isiZulu title and summary', () => {
  for (const unit of units) {
    assert.equal(financeZu(FINANCE_ZU_UNIT_TITLE, unit.id, unit.title) === null, false, `${unit.id}: missing isiZulu title`);
    assert.equal(financeZu(FINANCE_ZU_UNIT_SUMMARY, unit.id, unit.summary) === null, false, `${unit.id}: missing isiZulu summary`);
  }
});

test('every lesson has a source-paired isiZulu title, outcome (where the English has one) and reading', () => {
  for (const unit of units) {
    for (const lesson of unit.lessons) {
      assert.equal(financeZu(FINANCE_ZU_LESSON_TITLE, lesson.id, lesson.title) === null, false, `${lesson.id}: missing isiZulu title`);
      assert.equal(financeZu(FINANCE_ZU_LESSON_READING, lesson.id, lesson.reading) === null, false, `${lesson.id}: missing isiZulu reading`);
      if (lesson.outcome) {
        assert.equal(financeZu(FINANCE_ZU_LESSON_OUTCOME, lesson.id, lesson.outcome) === null, false, `${lesson.id}: missing isiZulu outcome`);
      }
    }
  }
});

test('a changed English source silently falls back to English instead of showing stale isiZulu', () => {
  assert.equal(financeZu(FINANCE_ZU_UNIT_TITLE, 'f1', 'A title that was edited after the draft was written'), null);
  assert.equal(financeZu(FINANCE_ZU_LESSON_READING, 'f1-1', 'Edited reading text'), null);
  assert.equal(financeZu(FINANCE_ZU_UNIT_TITLE, 'no-such-unit', 'anything'), null);
});

test('the practical project questions and reasoning prompts have source-paired isiZulu labels', () => {
  for (const question of PROJECT_NUMBER_QUESTIONS) {
    assert.equal(financeZu(FINANCE_ZU_PROJECT_NUMBER_LABEL, question.id, question.label) === null, false, `${question.id}: missing isiZulu label`);
  }
  for (const question of PROJECT_REASONING) {
    assert.equal(financeZu(FINANCE_ZU_PROJECT_REASONING_LABEL, question.id, question.label) === null, false, `${question.id}: missing isiZulu label`);
    assert.equal(financeZu(FINANCE_ZU_PROJECT_REASONING_PROMPT, question.id, question.prompt) === null, false, `${question.id}: missing isiZulu prompt`);
  }
});

test('the course pages and syllabus actually render the isiZulu drafts, not just hold the data', () => {
  const financePage = readFileSync(new URL('../app/student/finance/page.tsx', import.meta.url), 'utf8');
  assert.match(financePage, /FinanceZuText en=\{unit\.title\} zu=\{financeZu\(FINANCE_ZU_UNIT_TITLE/);
  assert.match(financePage, /FinanceZuText en=\{unit\.summary\} zu=\{financeZu\(FINANCE_ZU_UNIT_SUMMARY/);
  assert.match(financePage, /FinanceZuText en=\{lesson\.title\} zu=\{financeZu\(FINANCE_ZU_LESSON_TITLE/);

  const lessonPage = readFileSync(new URL('../app/student/finance/[lesson]/page.tsx', import.meta.url), 'utf8');
  assert.match(lessonPage, /FinanceZuText en=\{lesson\.title\}/);
  assert.match(lessonPage, /FinanceZuText en=\{lesson\.outcome\}/);
  assert.match(lessonPage, /FinanceZuLessonReading en=\{lesson\.reading\}/);
  assert.match(lessonPage, /FinanceZuBadge hasDraft=/);

  const worksheet = readFileSync(new URL('../components/studies/FinanceProjectWorksheet.tsx', import.meta.url), 'utf8');
  assert.match(worksheet, /FinanceZuText en=\{question\.label\} zu=\{financeZu\(FINANCE_ZU_PROJECT_NUMBER_LABEL/);
  assert.match(worksheet, /FinanceZuText en=\{question\.prompt\} zu=\{financeZu\(FINANCE_ZU_PROJECT_REASONING_PROMPT/);

  const syllabus = readFileSync(new URL('../components/studies/CourseSyllabus.tsx', import.meta.url), 'utf8');
  assert.match(syllabus, /title: ReactNode/, 'CourseSyllabus must accept localised title/blurb nodes, not just plain strings');
});

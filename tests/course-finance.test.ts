import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFinanceChecklist } from '../lib/finance-reading-checklist.ts';
import type { FinanceUnit } from '../lib/course-finance.ts';

const root = new URL('../', import.meta.url);
const units: FinanceUnit[] = JSON.parse(readFileSync(new URL('lib/course-finance-content.json', root), 'utf8')).units;
const ids = units.flatMap(unit => unit.lessons.map(lesson => lesson.id));

test('all authored finance lessons and workbooks reach the course without silent extraction loss or stale source edits', () => {
  // The reproducible builder compares every extracted section, not just a lesson count.
  execFileSync('python3', ['scripts/build-finance-course.py', '--check'], { cwd: root });
  assert.deepEqual(ids, Array.from({ length: 8 }, (_, u) => Array.from({ length: 3 }, (_, l) => `f${u + 1}-${l + 1}`)).flat());
  for (const unit of units) {
    const manuscript = readFileSync(new URL(unit.sourceFile, root));
    assert.equal(createHash('sha256').update(manuscript).digest('hex'), unit.sourceSha256);
    assert.ok(unit.shared.length, `${unit.id} needs its own case boundaries`);
    assert.ok(unit.sources.length, `${unit.id} needs source references`);
    assert.ok(existsSync(new URL(`public${unit.image}`, root)), unit.image);
    if (unit.workbook) assert.equal(readFileSync(new URL(`public${unit.workbook}`, root)).subarray(0, 5).toString(), '%PDF-');
    for (const lesson of unit.lessons) {
      assert.ok(manuscript.toString().includes(lesson.reading), `${lesson.id}: explanation must come from its manuscript`);
      assert.ok(lesson.practice.some(section => /Independent/.test(section.title)), `${lesson.id}: preserve independent practice`);
      for (const section of lesson.practice) assert.ok(section.text.trim(), `${lesson.id}: empty ${section.title}`);
    }
  }
});

test('reading ticks discard other courses and unknown values without awarding assessment credit', () => {
  assert.deepEqual(readFinanceChecklist(null, ids), []);
  assert.deepEqual(readFinanceChecklist(JSON.stringify(['f1-1', 'f1-1', 'm1', 'f9-1', 1, null, {}, 'f8-3']), ids), ['f1-1', 'f8-3']);
  for (const invalid of ['{', 'null', '{}', 'true']) assert.throws(() => readFinanceChecklist(invalid, ids));
  assert.deepEqual(readFinanceChecklist('["f1-1"]', []), []);
});

test('finance preview is reachable and cannot become a permaculture completion requirement', () => {
  const course = readFileSync(new URL('lib/course-modules.ts', root), 'utf8');
  assert.ok(!course.includes('course-finance'), 'keep the new course out of the permaculture authority');
  const student = readFileSync(new URL('app/student/page.tsx', root), 'utf8');
  assert.ok(student.includes('href="/student/finance"'));
  const checklist = readFileSync(new URL('components/studies/FinanceReadingChecklist.tsx', root), 'utf8');
  assert.ok(!/setDoc|addDoc|updateDoc|course_progress/.test(checklist));
  assert.ok(checklist.includes('not an assessment result'));
});

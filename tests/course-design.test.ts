import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const content = JSON.parse(readFileSync(new URL('lib/course-design-content.json', root), 'utf8'));

test('design reading preserves each authored explanation, task, answer and limitation without stale extraction', () => {
  execFileSync('python3', ['scripts/build-design-course.py', '--check'], { cwd: root });
  const ids: string[] = [];
  for (const unit of content.units) {
    const manuscript = readFileSync(new URL(unit.sourceFile, root));
    assert.equal(createHash('sha256').update(manuscript).digest('hex'), unit.sourceSha256);
    for (const lesson of unit.lessons) {
      ids.push(lesson.id);
      for (const section of lesson.sections) assert.ok(manuscript.toString().includes(section.text), `${lesson.id}: ${section.title} changed in transit`);
      assert.ok(lesson.sections.some((section: {title: string}) => section.title === 'Evidence for feedback'));
    }
  }
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(ids, Array.from({length:6},(_,unit)=>Array.from({length:3},(_,lesson)=>`d${unit+1}-${lesson+1}`)).flat());
  assert.equal(content.case.text, readFileSync(new URL(content.case.sourceFile, root), 'utf8'));
});

test('design preview practice stays separate from assessed course progress and actual farm records', () => {
  const course = readFileSync(new URL('lib/course-modules.ts', root), 'utf8');
  assert.ok(!course.includes('course-design-content'));
  const practice = readFileSync(new URL('components/studies/DesignCasePractice.tsx', root), 'utf8');
  assert.ok(!/setDoc|addDoc|updateDoc|localStorage|course_progress/.test(practice));
  assert.ok(practice.includes('no result is saved or submitted'));
  assert.ok(readFileSync(new URL('app/student/page.tsx', root), 'utf8').includes('href="/student/design"'));
  const items = JSON.parse(readFileSync(new URL('lib/course-design-practice.json', root), 'utf8'));
  for (const item of items) {
    assert.equal(item.choices.filter((c: {correct: boolean})=>c.correct).length, 1);
    assert.ok(item.choices.every((c: {feedback: string})=>c.feedback.trim().length));
  }
});

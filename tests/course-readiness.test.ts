import assert from 'node:assert/strict';
import test from 'node:test';

import { COURSE_MODULES } from '@/lib/course-modules';
import { completeModuleIds, moduleReadiness, moduleReadinessDetail, readinessLabel } from '@/lib/course-readiness';

// Rory needs to show the app before the course is finished. One module is genuinely complete and
// nine are lesson text and pictures only; a viewer cannot tell those apart, so either the whole
// course looks half-built or the finished one is mistaken for the standard.
//
// The badge is a PROMISE MADE TO SOMEBODY BEING SHOWN THE PRODUCT, which is why readiness is
// derived from files on disk rather than declared in a field. A hand-set `ready: true` is a promise
// nobody remembers to withdraw.

test('readiness is derived — deleting an artefact must retract the claim by itself', () => {
  // There is no settable flag. This asserts the inputs are the real ones, so a future refactor
  // that adds a shortcut field has to break this test to do it.
  const d = moduleReadinessDetail('seeds-sovereignty');
  assert.equal(d.readiness, 'complete');
  assert.equal(d.hasDeck, true);
  assert.equal(d.illustratedLessons, d.totalLessons);
  assert.ok(d.narrationLanguages.length >= 2);
});

test('narration in ONE language is not complete — the audience is isiZulu-first', () => {
  // A module narrated only in English is not finished for the person it was written for. Calling
  // it complete would be a comfortable lie told in the direction of the people with the least say,
  // so the rule needs at least two languages and this test names why.
  for (const mod of COURSE_MODULES) {
    const d = moduleReadinessDetail(mod.id);
    if (d.readiness === 'complete') {
      assert.ok(d.narrationLanguages.length >= 2, `${mod.id} claims complete on ${d.narrationLanguages.length} language(s)`);
    }
  }
});

test('exactly the modules that are really finished say so', () => {
  // Today that is one. This is deliberately not pinned to the number: as modules are produced they
  // should start passing without anyone editing a list, which is the whole point of deriving it.
  const complete = completeModuleIds();
  assert.ok(complete.includes('seeds-sovereignty'));
  for (const id of complete) assert.equal(moduleReadiness(id), 'complete');
  for (const mod of COURSE_MODULES) {
    if (!complete.includes(mod.id)) assert.equal(moduleReadiness(mod.id), 'in-progress');
  }
});

test('the in-progress label says what IS there, not what is missing', () => {
  // Every one of these modules has real, reviewed lesson content a farmer can use today. "Coming
  // soon" would be false and would hide finished teaching behind an apology.
  const inProgress = readinessLabel('water-harvesting');
  assert.ok(inProgress);
  assert.match(inProgress!.text, /Lessons only/);
  assert.match(inProgress!.detail, /ready/i);
  assert.doesNotMatch(inProgress!.detail, /coming soon|not available|unavailable/i);

  const complete = readinessLabel('seeds-sovereignty');
  assert.match(complete!.text, /Fully built/);
  assert.match(complete!.detail, /narrated in 2 languages/);
});

test('an unknown module is in-progress rather than throwing', () => {
  assert.equal(moduleReadiness('no-such-module'), 'in-progress');
  assert.equal(moduleReadinessDetail('no-such-module').totalLessons, 0);
});

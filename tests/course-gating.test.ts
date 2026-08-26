import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isModuleUnlocked,
  isModuleComplete,
  currentModuleId,
  isCapstoneUnlocked,
  unlockReason,
  courseSubmissionDocId,
  submittedModuleIds,
  assignmentFor,
  MODULE_ASSIGNMENTS,
  minimumCourseDays,
  type GatingContext,
  type CourseSubmission,
  type ModuleAssignment,
} from '../lib/course-gating.ts';
import { COURSE_MODULES } from '../lib/course-modules.ts';
import type { CourseAssignment } from '../lib/course-assignments.ts';

const MODULES = ['m1', 'm2', 'm3', 'm4', 'm5'];

function ctx(overrides: Partial<GatingContext> = {}): GatingContext {
  return {
    moduleIds: MODULES,
    doneIds: new Set(),
    submittedIds: new Set(),
    assignments: [],
    ...overrides,
  };
}

function assignment(profileId: string, module: string): CourseAssignment {
  return {
    id: `${profileId}_${module}`,
    profile_id: profileId,
    module,
    assigned_by: 'mentor-1',
    org_id: 'org-1',
    due_at: null,
    note: null,
    assigned_at: '2026-07-01T00:00:00.000Z',
  };
}

/** Temporarily injects real assignment content for one module so a test can exercise the
 *  "submission required" path, then always removes it — MODULE_ASSIGNMENTS ships empty and
 *  every other test in this file (and the rest of the suite) must see it that way. */
function withAssignmentContent<T>(entry: ModuleAssignment, fn: () => T): T {
  MODULE_ASSIGNMENTS.push(entry);
  try {
    return fn();
  } finally {
    const i = MODULE_ASSIGNMENTS.indexOf(entry);
    if (i !== -1) MODULE_ASSIGNMENTS.splice(i, 1);
  }
}

// ── doc id / submitted-ids helpers ────────────────────────────────────────────

test('courseSubmissionDocId is one row per learner per module, so resubmitting is an upsert', () => {
  assert.equal(courseSubmissionDocId('p1', 'm1'), 'p1_m1');
  assert.notEqual(courseSubmissionDocId('p1', 'm1'), courseSubmissionDocId('p2', 'm1'));
});

test('submittedModuleIds reads the module off each submission row', () => {
  const subs: CourseSubmission[] = [
    { id: 'p1_m1', profile_id: 'p1', org_id: 'org-1', module: 'm1', submitted_at: '2026-07-01T00:00:00.000Z', self_check: [], photo_path: 'course_submissions/p1/m1/photo.jpg', voice_path: null },
    { id: 'p1_m2', profile_id: 'p1', org_id: 'org-1', module: 'm2', submitted_at: '2026-07-02T00:00:00.000Z', self_check: ['watered beds'], photo_path: null, voice_path: null },
  ];
  assert.deepEqual(submittedModuleIds(subs), new Set(['m1', 'm2']));
});

// Was "ships empty" until 2026-07-27, when Rory supplied the authored content
// (lib/course-assignment-content.ts). Now asserts the shape of the REAL table instead: one entry
// per curriculum module, no orphans, and real pacing on each.
test('MODULE_ASSIGNMENTS covers exactly the shipped curriculum, with usable content', () => {
  const curriculum = COURSE_MODULES.map((m) => m.id);
  assert.equal(MODULE_ASSIGNMENTS.length, curriculum.length);
  for (const id of curriculum) {
    const a = assignmentFor(id);
    assert.ok(a, `${id} must have an authored assignment`);
    assert.ok(a!.prompt.trim().length > 0, `${id} prompt must not be empty`);
    assert.ok(a!.selfCheckItems.length > 0, `${id} must have at least one self-check item`);
    assert.ok(a!.minGateDays > 0, `${id} must carry realistic pacing`);
  }
  // An assignment whose moduleId does not exist would silently never reach a farmer.
  for (const a of MODULE_ASSIGNMENTS) {
    assert.ok(curriculum.includes(a.moduleId), `${a.moduleId} is not a curriculum module`);
  }
  assert.equal(assignmentFor('not-a-real-module'), undefined);
});

test("the owner's authored pacing is preserved: 70 module days + 10 capstone", () => {
  assert.equal(minimumCourseDays(), 80);
});

// ── module 1 / unknown ids ────────────────────────────────────────────────────

test('module 1 is always unlocked, with no reason to show', () => {
  assert.equal(isModuleUnlocked('m1', ctx()), true);
  assert.equal(unlockReason('m1', ctx()), null);
});

test('an id outside the curriculum is never gated', () => {
  assert.equal(isModuleUnlocked('not-a-real-module', ctx()), true);
});

// ── sequential unlock ─────────────────────────────────────────────────────────

test('sequential unlock, safety valve active (no assignment content anywhere): the done-tick alone opens the next module', () => {
  assert.equal(isModuleUnlocked('m2', ctx()), false);
  assert.equal(isModuleUnlocked('m2', ctx({ doneIds: new Set(['m1']) })), true);
  // m3 stays locked until m2 is also done, even though m1 is done+"complete"
  assert.equal(isModuleUnlocked('m3', ctx({ doneIds: new Set(['m1']) })), false);
  assert.equal(isModuleUnlocked('m3', ctx({ doneIds: new Set(['m1', 'm2']) })), true);
});

test('sequential unlock, WITH real assignment content for the previous module: done alone is not enough, submission is required', () => {
  withAssignmentContent({ moduleId: 'm1', prompt: 'Show your bed.', selfCheckItems: ['Bed is prepared'], minGateDays: 1 }, () => {
    // done but not submitted -> still locked
    assert.equal(isModuleUnlocked('m2', ctx({ doneIds: new Set(['m1']) })), false);
    // done AND submitted -> unlocked
    assert.equal(isModuleUnlocked('m2', ctx({ doneIds: new Set(['m1']), submittedIds: new Set(['m1']) })), true);
    // submitted but not done -> still locked (done is the learner's own tick, still required)
    assert.equal(isModuleUnlocked('m2', ctx({ submittedIds: new Set(['m1']) })), false);
  });
  // content removed again afterwards — confirm the valve is back off
  assert.equal(assignmentFor('m1'), undefined);
  assert.equal(isModuleUnlocked('m2', ctx({ doneIds: new Set(['m1']) })), true);
});

test('isModuleComplete mirrors the same done/submitted/safety-valve rule isModuleUnlocked reads from the previous module', () => {
  assert.equal(isModuleComplete('m1', ctx()), false);
  assert.equal(isModuleComplete('m1', ctx({ doneIds: new Set(['m1']) })), true); // no content -> safety valve
  withAssignmentContent({ moduleId: 'm1', prompt: 'p', selfCheckItems: [], minGateDays: 1 }, () => {
    assert.equal(isModuleComplete('m1', ctx({ doneIds: new Set(['m1']) })), false); // content exists, not submitted
    assert.equal(isModuleComplete('m1', ctx({ doneIds: new Set(['m1']), submittedIds: new Set(['m1']) })), true);
  });
});

// ── mentor override ───────────────────────────────────────────────────────────

test('an explicit mentor assignment unlocks a module out of order, with nothing else done', () => {
  const learnerCtx = ctx({ assignments: [assignment('p1', 'm4')] });
  assert.equal(isModuleUnlocked('m4', learnerCtx), true);
  // Sibling modules with no assignment stay gated normally
  assert.equal(isModuleUnlocked('m2', learnerCtx), false);
  assert.equal(isModuleUnlocked('m3', learnerCtx), false);
});

test('unlockReason reports the mentor override distinctly from the sequential-lock message', () => {
  const learnerCtx = ctx({ assignments: [assignment('p1', 'm3')] });
  assert.equal(unlockReason('m3', learnerCtx), 'Opened by your mentor');
  // 'm1' isn't a real curriculum id, so the title lookup falls back — exercises that branch.
  assert.equal(unlockReason('m2', learnerCtx), 'Finish the previous module to open this');
});

test('unlockReason uses the real module title and distinguishes "finish" vs "submit"', () => {
  const moduleIds = ['intro-permaculture', 'reading-landscape', 'water-harvesting'];
  assert.equal(
    unlockReason('reading-landscape', ctx({ moduleIds })),
    'Finish Introduction to Permaculture to open this',
  );
  withAssignmentContent({ moduleId: 'intro-permaculture', prompt: 'p', selfCheckItems: [], minGateDays: 1 }, () => {
    assert.equal(
      unlockReason('reading-landscape', ctx({ moduleIds, doneIds: new Set(['intro-permaculture']) })),
      'Submit the Introduction to Permaculture assignment to open this',
    );
  });
});

// ── currentModuleId ────────────────────────────────────────────────────────────

test('currentModuleId points at the first incomplete module, in curriculum order', () => {
  assert.equal(currentModuleId(ctx()), 'm1');
  assert.equal(currentModuleId(ctx({ doneIds: new Set(['m1']) })), 'm2');
  assert.equal(currentModuleId(ctx({ doneIds: new Set(['m1', 'm2', 'm3', 'm4', 'm5']) })), null);
});

// ── capstone ────────────────────────────────────────────────────────────────────

test('capstone stays locked until every module is complete, then unlocks', () => {
  assert.equal(isCapstoneUnlocked(ctx()), false);
  assert.equal(isCapstoneUnlocked(ctx({ doneIds: new Set(['m1', 'm2', 'm3', 'm4']) })), false);
  assert.equal(isCapstoneUnlocked(ctx({ doneIds: new Set(MODULES) })), true);
});

test('capstone respects the per-module submission requirement once content exists for that module', () => {
  withAssignmentContent({ moduleId: 'm5', prompt: 'p', selfCheckItems: [], minGateDays: 1 }, () => {
    assert.equal(isCapstoneUnlocked(ctx({ doneIds: new Set(MODULES) })), false); // m5 done but not submitted
    assert.equal(
      isCapstoneUnlocked(ctx({ doneIds: new Set(MODULES), submittedIds: new Set(['m5']) })),
      true,
    );
  });
});

test('capstone on an empty curriculum is never unlocked (defensive: no vacuous truth)', () => {
  assert.equal(isCapstoneUnlocked(ctx({ moduleIds: [] })), false);
});

// ── the non-negotiable: a solo learner is never degraded ─────────────────────────

// THE NON-NEGOTIABLE. An unattached learner — no mentor, no project, nobody to approve anything —
// must reach every module and the capstone under their own steam. Updated 2026-07-27 when the real
// assignment content arrived: a solo learner now also submits each module (photo + self-check),
// which is exactly the product behaviour — submission unlocks immediately, with no human gate, so
// nobody is ever stuck waiting on an offline mentor. If this ever fails, the solo path has been
// degraded to differentiate the mentored one, which is forbidden.
test('a solo learner — no mentor, no project, nobody to approve — can reach EVERY real module and the capstone', () => {
  const moduleIds = COURSE_MODULES.map((m) => m.id);
  assert.equal(moduleIds.length, 10, 'sanity check: the shipped curriculum is 10 modules');

  const done = new Set<string>();
  const submitted = new Set<string>();
  for (const id of moduleIds) {
    const solo: GatingContext = { moduleIds, doneIds: done, submittedIds: submitted, assignments: [] };
    assert.equal(isModuleUnlocked(id, solo), true, `${id} must be reachable by a solo learner`);
    // The learner does the work, ticks it done, and submits their own evidence — no approval step.
    done.add(id);
    submitted.add(id);
  }

  const finished: GatingContext = { moduleIds, doneIds: done, submittedIds: submitted, assignments: [] };
  assert.equal(isCapstoneUnlocked(finished), true, 'capstone must be reachable by a solo learner');
});

// The safety valve still has to work, because a module can lose its content in a future revision.
test('safety valve: a module with no authored assignment still opens on the done-tick alone', () => {
  const moduleIds = COURSE_MODULES.map((m) => m.id);
  const withoutContent = moduleIds.find((id) => !assignmentFor(id));
  assert.equal(withoutContent, undefined, 'every module currently has content — valve is dormant');
  // Prove the valve itself on a synthetic curriculum no authored content covers.
  const synthetic: GatingContext = {
    moduleIds: ['x1', 'x2'],
    doneIds: new Set(['x1']),
    submittedIds: new Set(),
    assignments: [],
  };
  assert.equal(isModuleUnlocked('x2', synthetic), true, 'no content ⇒ done alone must open the next module');
});

test('a mentored learner with a real due assignment still keeps the sequential path open behind it', () => {
  const moduleIds = COURSE_MODULES.map((m) => m.id);
  const mentored: GatingContext = {
    moduleIds,
    doneIds: new Set(),
    submittedIds: new Set(),
    assignments: [assignment('p1', moduleIds[4])],
  };
  // The assigned module (out of order) is open...
  assert.equal(isModuleUnlocked(moduleIds[4], mentored), true);
  // ...but the ordinary sequential module 2 is not magically opened by an unrelated assignment.
  assert.equal(isModuleUnlocked(moduleIds[1], mentored), false);
  // Module 1 is unaffected either way.
  assert.equal(isModuleUnlocked(moduleIds[0], mentored), true);
});

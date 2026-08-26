import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TRACK,
  enrollmentDocId,
  isEnrolled,
  newEnrollment,
  completedModuleIds,
  enrollmentProgress,
  effectiveStatus,
  summariseCohort,
  type CourseEnrollment,
} from '../lib/course-enrollment.ts';
import type { CourseProgress } from '../lib/db/types.ts';

const MODULES = ['m1', 'm2', 'm3', 'm4'];

function progress(rows: Array<[string, boolean]>, profileId = 'p1'): CourseProgress[] {
  return rows.map(([module, done]) => ({
    id: `${profileId}_${module}`,
    profile_id: profileId,
    org_id: 'org-1',
    module,
    done,
    updated_at: '2026-07-01T00:00:00.000Z',
  }));
}

test('doc id is deterministic so enrolling twice upserts instead of duplicating', () => {
  assert.equal(enrollmentDocId('p1'), `p1_${DEFAULT_TRACK}`);
  assert.equal(enrollmentDocId('p1'), enrollmentDocId('p1', DEFAULT_TRACK));
  assert.notEqual(enrollmentDocId('p1'), enrollmentDocId('p1', 'ai-literacy'));
});

test('a new enrollment starts as invited and carries who enrolled them', () => {
  const e = newEnrollment({
    profile_id: 'p1',
    enrolled_by: 'mentor-1',
    org_id: 'org-1',
    enrolled_at: '2026-07-26T08:00:00.000Z',
  });
  assert.equal(e.status, 'invited');
  assert.equal(e.enrolled_by, 'mentor-1');
  assert.equal(e.track, DEFAULT_TRACK);
  assert.equal(e.cohort, null);
});

test('un-ticking a module actually reduces the count', () => {
  const done = completedModuleIds(progress([['m1', true], ['m2', false], ['m3', true]]));
  assert.deepEqual([...done].sort(), ['m1', 'm3']);
});

test('progress counts against the curriculum, not against stale rows', () => {
  // 'retired-module' is no longer in the syllabus — it must not inflate done or total.
  const p = progress([['m1', true], ['retired-module', true]]);
  const r = enrollmentProgress(p, MODULES);
  assert.equal(r.done, 1);
  assert.equal(r.total, 4);
  assert.equal(r.pct, 25);
  assert.equal(r.complete, false);
  assert.equal(r.nextModuleId, 'm2');
});

test('an empty curriculum reports 0% rather than dividing by zero', () => {
  const r = enrollmentProgress([], []);
  assert.equal(r.pct, 0);
  assert.equal(r.complete, false);
  assert.equal(r.nextModuleId, null);
});

test('finishing every module completes the enrollment and clears next', () => {
  const p = progress(MODULES.map((m) => [m, true] as [string, boolean]));
  const r = enrollmentProgress(p, MODULES);
  assert.equal(r.complete, true);
  assert.equal(r.pct, 100);
  assert.equal(r.nextModuleId, null);
});

test('status follows the work: none -> invited, some -> active, all -> completed', () => {
  const stored = { status: 'invited' as const };
  assert.equal(effectiveStatus(stored, [], MODULES), 'invited');
  assert.equal(effectiveStatus(stored, progress([['m1', true]]), MODULES), 'active');
  assert.equal(
    effectiveStatus(stored, progress(MODULES.map((m) => [m, true] as [string, boolean])), MODULES),
    'completed',
  );
});

test("a mentor's paused or withdrawn decision is never overruled by progress", () => {
  const all = progress(MODULES.map((m) => [m, true] as [string, boolean]));
  assert.equal(effectiveStatus({ status: 'paused' }, all, MODULES), 'paused');
  assert.equal(effectiveStatus({ status: 'withdrawn' }, all, MODULES), 'withdrawn');
});

test('paused and withdrawn learners are excluded from the enrolled count', () => {
  assert.equal(isEnrolled('invited'), true);
  assert.equal(isEnrolled('active'), true);
  assert.equal(isEnrolled('completed'), true);
  assert.equal(isEnrolled('paused'), false);
  assert.equal(isEnrolled('withdrawn'), false);
});

test('cohort roll-up buckets every learner exactly once', () => {
  const mk = (profile_id: string, status: CourseEnrollment['status']): CourseEnrollment => ({
    id: enrollmentDocId(profile_id),
    profile_id,
    track: DEFAULT_TRACK,
    cohort: null,
    status,
    enrolled_by: 'mentor-1',
    org_id: 'org-1',
    enrolled_at: '2026-07-01T00:00:00.000Z',
  });

  const enrollments = [
    mk('a', 'invited'),   // no rows -> not started
    mk('b', 'invited'),   // one done -> in progress
    mk('c', 'invited'),   // all done -> completed
    mk('d', 'paused'),
    mk('e', 'withdrawn'),
  ];
  const progressBy = {
    b: progress([['m1', true]], 'b'),
    c: progress(MODULES.map((m) => [m, true] as [string, boolean]), 'c'),
    // 'a' deliberately absent — a learner with no rows yet must not throw.
  };

  const s = summariseCohort(enrollments, progressBy, MODULES);
  assert.equal(s.notStarted, 1);
  assert.equal(s.inProgress, 1);
  assert.equal(s.completed, 1);
  assert.equal(s.paused, 1);
  assert.equal(s.withdrawn, 1);
  assert.equal(s.enrolled, 3);
  assert.equal(s.notStarted + s.inProgress + s.completed + s.paused + s.withdrawn, enrollments.length);
});

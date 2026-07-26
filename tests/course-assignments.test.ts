import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DUE_SOON_DAYS,
  assignmentDocId,
  assignmentState,
  daysBetween,
  formatDue,
  orderModulesForLearner,
  sortAssignments,
  summariseAssignments,
  toDateKey,
  type CourseAssignment,
} from '../lib/course-assignments.ts';

const TODAY = '2026-07-26';
const MODULES = ['m1', 'm2', 'm3', 'm4', 'm5'];

function assign(module: string, due_at: string | null): CourseAssignment {
  return {
    id: assignmentDocId('p1', module),
    profile_id: 'p1',
    module,
    assigned_by: 'mentor-1',
    org_id: 'org-1',
    due_at,
    note: null,
    assigned_at: '2026-07-01T00:00:00.000Z',
  };
}

test('doc id is one row per learner per module, so re-assigning moves the date', () => {
  assert.equal(assignmentDocId('p1', 'm1'), 'p1_m1');
  assert.notEqual(assignmentDocId('p1', 'm1'), assignmentDocId('p2', 'm1'));
});

test('toDateKey uses the local calendar, not UTC', () => {
  // Constructed with local-time components, so the key must match them exactly.
  assert.equal(toDateKey(new Date(2026, 6, 26, 1, 30)), '2026-07-26');
  assert.equal(toDateKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
});

test('daysBetween is DST-proof and rejects malformed dates', () => {
  assert.equal(daysBetween('2026-07-26', '2026-07-26'), 0);
  assert.equal(daysBetween('2026-07-26', '2026-08-02'), 7);
  assert.equal(daysBetween('2026-07-26', '2026-07-19'), -7);
  // Southern-hemisphere DST change in the northern spring window — still whole days.
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('not-a-date', '2026-07-26'), null);
  assert.equal(daysBetween('2026-07-26', '26/07/2026'), null);
});

test('a finished module reads as done even when it was finished late', () => {
  const done = new Set(['m1']);
  assert.equal(assignmentState(assign('m1', '2026-07-01'), done, TODAY), 'done');
});

test('an assignment with no due date is never overdue', () => {
  assert.equal(assignmentState(assign('m2', null), new Set(), TODAY), 'open');
});

test('overdue, due-soon and open split on the due-soon window', () => {
  const none = new Set<string>();
  assert.equal(assignmentState(assign('m2', '2026-07-25'), none, TODAY), 'overdue');
  assert.equal(assignmentState(assign('m2', TODAY), none, TODAY), 'due-soon');
  assert.equal(assignmentState(assign('m2', '2026-08-02'), none, TODAY), 'due-soon'); // exactly 7 days
  assert.equal(assignmentState(assign('m2', '2026-08-03'), none, TODAY), 'open');     // 8 days
  assert.equal(DUE_SOON_DAYS, 7);
});

test('due dates read as plain language', () => {
  assert.equal(formatDue(null, TODAY), null);
  assert.equal(formatDue(TODAY, TODAY), 'Due today');
  assert.equal(formatDue('2026-07-27', TODAY), 'Due tomorrow');
  assert.equal(formatDue('2026-07-25', TODAY), '1 day overdue');
  assert.equal(formatDue('2026-07-20', TODAY), '6 days overdue');
  assert.equal(formatDue('2026-07-30', TODAY), 'Due in 4 days');
  assert.equal(formatDue('2026-09-12', TODAY), 'Due 12 Sep');
});

test('sorting puts the most urgent first and sinks finished work', () => {
  const done = new Set(['m5']);
  const list = [
    assign('m4', null),          // open, undated
    assign('m5', '2026-07-01'),  // done
    assign('m1', '2026-07-20'),  // overdue
    assign('m3', '2026-08-20'),  // open, dated
    assign('m2', '2026-07-28'),  // due soon
  ];
  const order = sortAssignments(list, done, TODAY).map((a) => a.module);
  assert.deepEqual(order, ['m1', 'm2', 'm3', 'm4', 'm5']);
});

test('sorting is stable for identical state and due date', () => {
  const list = [assign('m3', '2026-08-20'), assign('m1', '2026-08-20'), assign('m2', '2026-08-20')];
  const order = sortAssignments(list, new Set(), TODAY).map((a) => a.module);
  assert.deepEqual(order, ['m1', 'm2', 'm3']);
});

test('summary buckets every assignment exactly once', () => {
  const done = new Set(['m5']);
  const list = [
    assign('m5', '2026-07-01'),
    assign('m1', '2026-07-20'),
    assign('m2', '2026-07-28'),
    assign('m3', '2026-08-20'),
    assign('m4', null),
  ];
  const s = summariseAssignments(list, done, TODAY);
  assert.equal(s.total, 5);
  assert.equal(s.done, 1);
  assert.equal(s.overdue, 1);
  assert.equal(s.dueSoon, 1);
  assert.equal(s.open, 2);
  assert.equal(s.done + s.overdue + s.dueSoon + s.open, s.total);
});

test('ordering lifts outstanding assignments without ever dropping a module', () => {
  const done = new Set(['m2']);
  const list = [
    assign('m4', '2026-07-20'), // overdue
    assign('m2', '2026-07-20'), // already done — must not be lifted
    assign('m3', '2026-07-28'), // due soon
  ];
  const order = orderModulesForLearner(MODULES, list, done, TODAY);
  assert.deepEqual(order, ['m4', 'm3', 'm1', 'm2', 'm5']);
  assert.equal(order.length, MODULES.length);
  assert.deepEqual([...order].sort(), [...MODULES].sort());
});

test('an assignment for a retired module is ignored, not injected', () => {
  const list = [assign('retired-module', '2026-07-20'), assign('m3', '2026-07-20')];
  const order = orderModulesForLearner(MODULES, list, new Set(), TODAY);
  assert.deepEqual(order, ['m3', 'm1', 'm2', 'm4', 'm5']);
  assert.equal(order.includes('retired-module'), false);
});

test('duplicate rows for one module cannot duplicate it in the list', () => {
  const list = [assign('m3', '2026-07-20'), { ...assign('m3', '2026-07-21'), id: 'legacy' }];
  const order = orderModulesForLearner(MODULES, list, new Set(), TODAY);
  assert.deepEqual([...order].sort(), [...MODULES].sort());
  assert.equal(order.filter((m) => m === 'm3').length, 1);
});

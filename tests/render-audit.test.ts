import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_AUDIT_ENTRIES,
  appendAuditEntry,
  auditFromReport,
  entriesForSheet,
  explainSheet,
  paidAttemptCount,
  summariseAudit,
  type RenderAuditEntry,
} from '../lib/render-audit.ts';
import type { DifferenceReport } from '../lib/render-difference.ts';

// The question this module has to answer is the owner's, verbatim: "this is a badly produced step 2
// even though I selected 3 steps". Every assertion below is really asking whether the record can
// answer that WITHOUT anyone reading the state machine — because reading the state machine is what
// has failed repeatedly, and reading it confidently is worse than reading it not at all.

const base = (over: Partial<RenderAuditEntry> = {}): RenderAuditEntry => ({
  at: '2026-07-29T18:00:00.000Z',
  sheetKey: 'planting',
  stage: 'hybrid',
  outputMode: 'full',
  style: 'photo_plan',
  outcome: 'kept',
  ...over,
});

const report = (over: Partial<DifferenceReport> = {}): DifferenceReport => ({
  touchedFraction: 0.8,
  redrawnFraction: 0.42,
  meanDelta: 51,
  comparedPixels: 1_500_000,
  protectedMismatches: 0,
  verdict: 'redrawn',
  ...over,
});

test('the log is bounded, so an audit trail can never be why a write fails', () => {
  let log: RenderAuditEntry[] = [];
  for (let i = 0; i < MAX_AUDIT_ENTRIES + 25; i++) {
    log = appendAuditEntry(log, base({ at: `entry-${i}` }));
  }
  assert.equal(log.length, MAX_AUDIT_ENTRIES);
  // Newest kept, oldest dropped — the recent session is what anyone debugging actually needs.
  assert.equal(log[log.length - 1].at, `entry-${MAX_AUDIT_ENTRIES + 24}`);
});

test('an entry built from a difference report carries the numbers the verdict was based on', () => {
  const entry = auditFromReport(
    { at: 'now', sheetKey: 'planting', stage: 'polish', outputMode: 'full', style: 'photo_plan' },
    report({ redrawnFraction: 0.31, verdict: 'redrawn' }),
    true,
  );
  assert.equal(entry.outcome, 'kept');
  assert.equal(entry.verdict, 'redrawn');
  assert.equal(entry.redrawnFraction, 0.31);
  // comparedPixels matters: a gate that compared almost nothing is not evidence of anything, and
  // without this field a 'rejected' verdict cannot be told apart from a degenerate mask.
  assert.equal(entry.comparedPixels, 1_500_000);
});

test('a rejected report never records as kept', () => {
  const entry = auditFromReport(
    { at: 'now', sheetKey: 'water', stage: 'polish', outputMode: 'full', style: 'photo_plan' },
    report({ verdict: 'unchanged', redrawnFraction: 0.001 }),
    false,
  );
  assert.equal(entry.outcome, 'rejected');
});

test('THE QUESTION: asked for three layers, got two, and the record says which', () => {
  // Hybrid succeeded; no polish entry exists at all. This is the exact shape of the complaint.
  const log = [base({ stage: 'hybrid', outcome: 'kept' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /NO POLISH PASS WAS EVER RECORDED/);
  assert.match(answer, /layer 2/);
  // It must name it as a bug rather than as an opinion about the artwork — the two have been
  // confused every time this came up.
  assert.match(answer, /bug, not a judgement about quality/);
});

test('a polish pass that ran and was rejected reads differently from one that never ran', () => {
  const neverRan = explainSheet([base({ stage: 'hybrid', outcome: 'kept' })], 'planting');
  const ranAndRejected = explainSheet(
    [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'rejected' })],
    'planting',
  );
  assert.notEqual(neverRan, ranAndRejected);
  assert.match(ranAndRejected, /returned the Hybrid it was given/);
  // Both leave the farmer looking at layer 2, and telling them apart is the entire diagnostic
  // value: one is a broken flow, the other is a weak prompt. They need opposite fixes.
  assert.match(ranAndRejected, /layer 2/);
  assert.match(neverRan, /layer 2/);
});

test('a rejected Hybrid explains why the polish never started, instead of looking like a stall', () => {
  const log = [base({ stage: 'hybrid', outcome: 'rejected', verdict: 'unchanged' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /rejected/);
  assert.match(answer, /nothing new to polish/);
});

test('both layers redrawn is reported as the success it is', () => {
  const log = [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'kept' })];
  assert.match(explainSheet(log, 'planting'), /you are looking at layer 3/);
});

test('an unmeasurable pass is never reported as a success', () => {
  const log = [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'unscored' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /could not measure/);
  assert.doesNotMatch(answer, /you are looking at layer 3/);
});

test('no attempts at all says so plainly rather than guessing', () => {
  assert.match(explainSheet([], 'planting'), /No paid render has been attempted/);
});

test('one sheet cannot answer for another', () => {
  const log = [
    base({ sheetKey: 'water', stage: 'hybrid', outcome: 'kept' }),
    base({ sheetKey: 'water', stage: 'polish', outcome: 'kept' }),
  ];
  assert.equal(entriesForSheet(log, 'planting').length, 0);
  assert.match(explainSheet(log, 'planting'), /No paid render has been attempted/);
  assert.match(explainSheet(log, 'water'), /layer 3/);
});

test('blocked stages are not counted as paid attempts, because nothing was spent', () => {
  const log = [
    base({ stage: 'hybrid', outcome: 'kept' }),
    base({ stage: 'polish', outcome: 'blocked', note: 'hybrid produced no result to polish' }),
  ];
  assert.equal(paidAttemptCount(log), 1);
  assert.match(explainSheet(log, 'planting'), /hybrid produced no result to polish/);
});

test('the summary line carries the redrawn percentage a human can argue with', () => {
  const lines = summariseAudit([
    auditFromReport(
      { at: '2026-07-29T18:00:00.000Z', sheetKey: 'planting', stage: 'polish', outputMode: 'full', style: 'photo_plan' },
      report({ redrawnFraction: 0.4237 }),
      true,
    ),
  ]);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /42\.4% redrawn/);
  assert.match(lines[0], /full\/polish/);
  assert.match(lines[0], /kept/);
});

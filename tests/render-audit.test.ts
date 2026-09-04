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
  siteId: 'farm-1',
  attemptId: 'attempt-1',
  designRevision: 'design-1',
  ...over,
});

const report = (over: Partial<DifferenceReport> = {}): DifferenceReport => ({
  touchedFraction: 0.8,
  redrawnFraction: 0.42,
  meanDelta: 51,
  comparedPixels: 1_500_000,
  protectedMismatches: 0,
  blankedFraction: 0,
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
  assert.equal(entry.blankedFraction, 0);
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

test('THE QUESTION: asked for three layers, got two, and the record says which without inventing a cause', () => {
  // Hybrid succeeded; no polish entry exists at all. This is the exact shape of the complaint.
  const log = [base({ stage: 'hybrid', outcome: 'kept' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /no matching polish pass is recorded/);
  assert.match(answer, /layer 2/);
  // A bounded local log can be incomplete after navigation or eviction. Missing evidence must
  // not become the old absolute claim that a pass never ran or that this proves a flow bug.
  assert.match(answer, /history does not establish why/);
});

test('a polish pass that ran and was rejected reads differently from one that never ran', () => {
  const neverRan = explainSheet([base({ stage: 'hybrid', outcome: 'kept' })], 'planting');
  const ranAndRejected = explainSheet(
    [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'rejected' })],
    'planting',
  );
  assert.notEqual(neverRan, ranAndRejected);
  assert.match(ranAndRejected, /did not pass the image-change check/);
  // Both leave the farmer looking at layer 2, and telling them apart is the entire diagnostic
  // value: one is a broken flow, the other is a weak prompt. They need opposite fixes.
  assert.match(ranAndRejected, /layer 2/);
  assert.match(neverRan, /layer 2/);
});

test('a rejected Hybrid explains why the polish never started, instead of looking like a stall', () => {
  const log = [base({ stage: 'hybrid', outcome: 'rejected', verdict: 'unchanged' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /rejected/);
  assert.match(answer, /no approved Hybrid for the polish pass/);
});

test('an erased-content rejection is described as destructive output, not as an unchanged copy', () => {
  const hybrid = explainSheet([
    base({ stage: 'hybrid', outcome: 'rejected', verdict: 'content-erased' }),
  ], 'planting');
  assert.match(hybrid, /erased a large part of the map into blank paper/);
  assert.match(hybrid, /exact map still stands/);

  const polish = explainSheet([
    base({ stage: 'hybrid', outcome: 'kept' }),
    base({ stage: 'polish', outcome: 'rejected', verdict: 'content-erased' }),
  ], 'planting');
  assert.match(polish, /erased a large part of the map into blank paper/);
  assert.match(polish, /intact Hybrid/);
});

test('both layers redrawn is reported as image change without claiming geometry was verified', () => {
  const log = [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'kept' })];
  assert.match(explainSheet(log, 'planting'), /recorded result is layer 3/);
  assert.match(explainSheet(log, 'planting'), /does not verify feature positions, counts or geometry/);
});

test('an unmeasurable pass is never reported as a success', () => {
  const log = [base({ stage: 'hybrid', outcome: 'kept' }), base({ stage: 'polish', outcome: 'unscored' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /could not measure/);
  assert.doesNotMatch(answer, /recorded result is layer 3/);
});

test('an empty bounded history cannot prove that no render ran or that the displayed map is free', () => {
  const answer = explainSheet([], 'planting');
  assert.match(answer, /No paid-render record matches/);
  assert.match(answer, /cannot establish which map is displayed/);
});

test('one sheet cannot answer for another', () => {
  const log = [
    base({ sheetKey: 'water', stage: 'hybrid', outcome: 'kept' }),
    base({ sheetKey: 'water', stage: 'polish', outcome: 'kept' }),
  ];
  assert.equal(entriesForSheet(log, 'planting').length, 0);
  assert.match(explainSheet(log, 'planting'), /No paid-render record matches/);
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

test('yesterday\'s completed polish cannot complete a new Hybrid attempt', () => {
  const log = [
    base({ attemptId: 'yesterday', stage: 'hybrid' }),
    base({ attemptId: 'yesterday', stage: 'polish' }),
    base({ attemptId: 'today', stage: 'hybrid' }),
  ];
  assert.match(explainSheet(log, 'planting'), /no matching polish pass is recorded/);
  assert.doesNotMatch(explainSheet(log, 'planting'), /result is layer 3/);
  assert.match(explainSheet(log, 'planting', { attemptId: 'yesterday' }), /result is layer 3/);
});

test('late results from another attempt cannot change the explanation of the displayed attempt', () => {
  const log = [
    base({ attemptId: 'old', stage: 'hybrid' }),
    base({ attemptId: 'displayed', stage: 'hybrid' }),
    base({ attemptId: 'old', stage: 'polish' }),
  ];
  assert.match(explainSheet(log, 'planting', { siteId: 'farm-1', attemptId: 'displayed' }), /layer 2/);
});

test('the same sheet and attempt labels on another farm cannot supply a missing pass', () => {
  const log = [
    base({ siteId: 'farm-1', stage: 'hybrid' }),
    base({ siteId: 'farm-2', stage: 'polish' }),
  ];
  assert.equal(entriesForSheet(log, 'planting', { siteId: 'farm-1' }).length, 1);
  assert.match(explainSheet(log, 'planting', { siteId: 'farm-1' }), /layer 2/);
  assert.match(explainSheet(log, 'planting', { siteId: 'farm-2' }), /no matching Hybrid/);
});

test('a job selector finds both stages through the shared attempt, not through equal job IDs', () => {
  const log = [
    base({ stage: 'hybrid', jobId: 'hybrid-job' }),
    base({ stage: 'polish', jobId: 'polish-job' }),
    base({ attemptId: 'later-attempt', jobId: 'later-job', stage: 'hybrid' }),
  ];
  assert.deepEqual(entriesForSheet(log, 'planting', { jobId: 'polish-job' }), [log[1]]);
  assert.match(explainSheet(log, 'planting', { jobId: 'polish-job' }), /result is layer 3/);
  assert.match(explainSheet(log, 'planting', { jobId: 'later-job' }), /layer 2/);
});

test('a changed design revision cannot borrow an earlier polish even if an attempt ID was reused', () => {
  const log = [
    base({ designRevision: 'design-1', stage: 'hybrid' }),
    base({ designRevision: 'design-1', stage: 'polish' }),
    base({ designRevision: 'design-2', stage: 'hybrid' }),
  ];
  assert.match(explainSheet(log, 'planting'), /layer 2/);
  assert.match(explainSheet(log, 'planting', { designRevision: 'design-1' }), /result is layer 3/);
});

test('unlabelled legacy history cannot match a known site or attempt', () => {
  const log = [base({ siteId: undefined, attemptId: undefined, designRevision: undefined })];
  for (const context of [{ siteId: 'farm-1' }, { attemptId: 'attempt-1' }, { designRevision: 'design-1' }]) {
    assert.equal(entriesForSheet(log, 'planting', context).length, 0);
    assert.match(explainSheet(log, 'planting', context), /No paid-render record matches/);
  }
});

test('legacy logs remain readable but do not certify that two unlinked passes belong together', () => {
  const log = [base({ attemptId: undefined }), base({ attemptId: undefined, stage: 'polish' })];
  assert.match(explainSheet(log, 'planting'), /no shared attempt identifier/);
  assert.doesNotMatch(explainSheet(log, 'planting'), /result is layer 3/);
  log.push(base({ attemptId: undefined }));
  assert.match(explainSheet(log, 'planting'), /layer 2/);
});

test('a scored polish cannot retroactively turn an unscored Hybrid into a measured success', () => {
  const log = [base({ outcome: 'unscored' }), base({ stage: 'polish' })];
  const answer = explainSheet(log, 'planting');
  assert.match(answer, /Hybrid remains unscored/);
  assert.doesNotMatch(answer, /Both passes/);
});

test('history trimmed before the Hybrid cannot prove that the Hybrid never ran', () => {
  const answer = explainSheet([base({ stage: 'polish' })], 'planting');
  assert.match(answer, /no matching Hybrid is in the available history/);
  assert.doesNotMatch(answer, /never ran/);
});

test('a blocked Hybrid is never described as a successful second layer', () => {
  const answer = explainSheet([base({ outcome: 'blocked', note: 'input upload failed' })], 'planting');
  assert.match(answer, /Hybrid did not run: input upload failed/);
  assert.doesNotMatch(answer, /succeeded|layer 2/);
});

test('difference entries and exported summaries retain the artifact provenance needed to investigate a bill', () => {
  const context = { siteId: 'farm-1', attemptId: 'attempt-1', jobId: 'job-1', designRevision: 'revision-1' };
  const entry = auditFromReport({ ...base(), ...context }, report(), true);
  for (const [key, value] of Object.entries(context)) {
    assert.equal(entry[key as keyof typeof context], value);
  }
  const summary = summariseAudit([entry])[0];
  assert.match(summary, /site=farm-1/);
  assert.match(summary, /attempt=attempt-1/);
  assert.match(summary, /job=job-1/);
  assert.match(summary, /revision=revision-1/);
});

test('raw, composed and repeated checks of one paid output count as one paid pass', () => {
  const log = [
    base({ jobId: 'job-1', checkPhase: 'raw' }),
    base({ jobId: 'job-1', checkPhase: 'composed' }),
    base({ jobId: 'job-1', checkPhase: 'composed', outcome: 'unscored' }),
  ];
  assert.equal(paidAttemptCount(log), 1);
  assert.match(explainSheet(log, 'planting'), /kept without a measurement/);
});

test('different sheets, stages, jobs and sites still count as distinct paid passes', () => {
  const log = [
    base({ jobId: 'job-1' }),
    base({ jobId: 'job-1', sheetKey: 'water' }),
    base({ jobId: 'job-1', stage: 'polish' }),
    base({ jobId: 'job-2' }),
    base({ jobId: 'job-1', siteId: 'farm-2' }),
    base({ jobId: 'job-3', outcome: 'blocked' }),
  ];
  assert.equal(paidAttemptCount(log), 5);
});

test('legacy records without a site and job identity are not silently merged into one charge', () => {
  assert.equal(paidAttemptCount([base(), base()]), 2);
  assert.equal(paidAttemptCount([base({ siteId: undefined, jobId: 'old' }), base({ siteId: undefined, jobId: 'old' })]), 2);
});

test('an exported measurement identifies whether it describes raw artwork or the retained composition', () => {
  const entry = auditFromReport({ ...base(), checkPhase: 'composed' }, report(), true);
  assert.equal(entry.checkPhase, 'composed');
  assert.match(summariseAudit([entry])[0], /check=composed/);
});

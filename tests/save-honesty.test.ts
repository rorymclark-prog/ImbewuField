import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// THE APP MUST NOT SAY "SAVED" WHEN IT DID NOT SAVE.
//
// Found by a data-loss audit. Two screens caught a storage refusal and then showed a success
// confirmation anyway. A farmer on a full phone tapped Save, read "Saved", closed the page, and
// the work was gone — the generated report in one case, the whole garden questionnaire in the
// other. Neither is recoverable and nothing warned them.
//
// These are SOURCE tests because the failure lives in a React callback that no unit test mounts.
// They are deliberately narrow: they assert that the success path is CONDITIONAL, which is the
// one property that broke.

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

test('the report Save button branches on whether the write actually succeeded', () => {
  const src = read('components', 'ReportView.tsx');
  assert.ok(
    /const \{ saved \} = saveReport\(/.test(src),
    'ReportView ignores saveReport\'s result again — it returns { saved } for a reason',
  );
  assert.ok(src.includes('if (!saved && !isSampleMode())'), 'the failure branch is gone');
  assert.ok(src.includes('setSaveFailed(true)'), 'nothing records the failure');
  // Sample mode is a DELIBERATE no-op that returns saved:false; it must keep its own honest
  // label rather than being reported as a storage error.
  assert.ok(src.includes("'Demo — not saved'"), 'the sample-mode label was lost in the fix');
});

test('a failed report save cannot be reported as success', () => {
  const src = read('components', 'ReportView.tsx');
  const handler = src.slice(src.indexOf('const handleSaveReport'), src.indexOf('const handleSaveReport') + 1200);
  const failIdx = handler.indexOf('setSaveFailed(true)');
  const okIdx = handler.indexOf('setJustSaved(true)');
  assert.ok(failIdx > 0 && okIdx > 0, 'both outcomes must exist in the handler');
  assert.ok(failIdx < okIdx, 'the failure path must return before the success path');
  assert.ok(
    handler.slice(failIdx, okIdx).includes('return'),
    'the failure path falls through to setJustSaved — the button would still say Saved',
  );
});

test('the garden survey no longer swallows a storage refusal', () => {
  const src = read('app', 'survey', 'page.tsx');
  const save = src.slice(src.indexOf('function save()'), src.indexOf('const TOTAL'));
  assert.ok(!/catch \{ \/\* ignore \*\/ \}/.test(save), 'the survey save swallows its error again');
  assert.ok(save.includes('setSaveFailed(true)'), 'a failed survey save records nothing');
  const failIdx = save.indexOf('setSaveFailed(true)');
  const okIdx = save.indexOf('setSaved(true)');
  assert.ok(failIdx > 0 && okIdx > failIdx, 'the failure branch must precede the success branch');
  assert.ok(save.slice(failIdx, okIdx).includes('return'), 'a failed save still reaches setSaved(true)');
});

test('both failure states are sticky, not a toast that clears itself', () => {
  // A farmer who looked away for two seconds would never learn the work was lost, so neither
  // failure may be wrapped in the setTimeout that clears the success confirmations.
  for (const [label, src] of [
    ['ReportView', read('components', 'ReportView.tsx')],
    ['survey', read('app', 'survey', 'page.tsx')],
  ] as const) {
    assert.ok(
      !/setTimeout\(\(\) => setSaveFailed\(false\)/.test(src),
      `${label} clears its save-failure state on a timer — the warning must persist`,
    );
  }
});

// ── The crop planner: an AUTOSAVE, so silence is the only failure mode ──────────────────────

test('saveCropPlan reports whether the plan actually reached storage', async () => {
  // It used to return void with the comment "fail silently, plan just won't persist". That is the
  // worst available behaviour for an autosave: nothing ever claims success, so nothing can be
  // disbelieved, and the farmer discovers the loss only after a reload.
  const src = readFileSync(join(process.cwd(), 'lib', 'crop-plan.ts'), 'utf8');
  // Assert the SIGNATURE and the RUNTIME answer, not the wording. A first version of this test
  // grepped for the old "fail silently" phrase and failed on the comment that quotes it while
  // explaining the fix — a guard that fires on its own documentation guards nothing.
  assert.ok(/export function saveCropPlan\([^)]*\): boolean/.test(src), 'saveCropPlan returns void again');
  assert.ok(/return false;/.test(src), 'the failure path stopped returning false');

  const mod = await import('../lib/crop-plan.ts');
  // No window in this environment: not a save, and it must not claim to be one.
  assert.equal(mod.saveCropPlan({ plantings: [], pattern: 'summer' } as never), false);
});

test('the planner surfaces an autosave failure instead of swallowing it', () => {
  const src = readFileSync(join(process.cwd(), 'app', 'facilitator', 'crops', 'page.tsx'), 'utf8');
  assert.ok(
    src.includes('setPlanSaveFailed(!saveCropPlan(plan))'),
    'the debounced autosave discards saveCropPlan\'s result again',
  );
  assert.ok(src.includes('planSaveFailed && ('), 'nothing renders the autosave failure');
  assert.ok(src.includes("role=\"alert\""), 'the failure banner is not announced to assistive tech');
  assert.ok(
    !/setTimeout\(\(\) => setPlanSaveFailed\(false\)/.test(src),
    'the autosave warning clears itself on a timer — it must persist until a save succeeds',
  );
});

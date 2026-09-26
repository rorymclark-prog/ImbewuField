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
  // Match the PROPERTY, not the punctuation. The first version pinned `{ saved }` exactly and
  // then failed the moment the destructuring legitimately grew to `{ saved, reason }` — a guard
  // that breaks on a correct extension trains people to weaken it.
  assert.ok(
    /const \{ saved[^}]*\} = saveReport\(/.test(src),
    'ReportView ignores saveReport\'s result again — it returns { saved } for a reason',
  );
  assert.ok(src.includes('if (!saved)'), 'every rejected save must take the failure branch');
  assert.ok(src.includes('setSaveFailed(true)'), 'nothing records the failure');
  // Rory asked for the complete tour workflow: sample saves now succeed in its isolated
  // in-memory store. The old assertion required a dead Save button. The invariant is still
  // that a success label is reached only after a successful write, in either workspace.
  assert.ok(!src.includes("'Demo — not saved'"), 'the tour still advertises a non-functional save');
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

test('the save-failure state is sticky, not a toast that clears itself', () => {
  // A farmer who looked away for two seconds would never learn the work was lost, so the
  // failure may not be wrapped in the setTimeout that clears the success confirmation.
  // (The garden-survey half of this pair went with app/survey, deleted 2026-09-26.)
  for (const [label, src] of [
    ['ReportView', read('components', 'ReportView.tsx')],
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

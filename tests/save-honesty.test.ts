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

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Verified bug: the field-facing "remove" controls in app/mentor/page.tsx (unassign a module) and
// app/surveys/page.tsx (remove a builder question / choice option) were well under the 44px
// fingertip floor tests/tap-targets.test.ts and tests/settings-and-back-tap-targets.test.ts pin
// for other controls in this app. Each already had an aria-label; only the hit area was too small.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const MIN = 44;

test('mentor: the module-unassign control clears the 44px floor and keeps its aria-label', () => {
  const src = source('../app/mentor/page.tsx');
  const at = src.indexOf('onClick={() => onUnassign(trainee.id, mod.id)}');
  assert.ok(at > 0, 'the module-unassign button moved — recheck this guard by hand');
  const nearby = src.slice(at, at + 400);
  assert.match(nearby, /aria-label=\{tr\(lang, `Remove the \$\{mod\.title\} assignment`/, 'lost its aria-label');
  const width = nearby.match(/width:\s*(\d+)/);
  const height = nearby.match(/height:\s*(\d+)/);
  assert.ok(width && height, 'could not find the unassign button\'s width/height declaration');
  assert.ok(Number(width![1]) >= MIN, `unassign button is ${width![1]}px wide — a fingertip needs ${MIN}`);
  assert.ok(Number(height![1]) >= MIN, `unassign button is ${height![1]}px tall — a fingertip needs ${MIN}`);
});

test('surveys: the remove-question control clears the 44px floor and keeps its aria-label', () => {
  const src = source('../app/surveys/page.tsx');
  const at = src.indexOf('onClick={onRemove}');
  assert.ok(at > 0, 'the remove-question button moved — recheck this guard by hand');
  const nearby = src.slice(at, at + 400);
  assert.match(nearby, /aria-label=\{localUi\('Remove question', 'Susa umbuzo', lang\)\}/, 'lost its aria-label');
  const width = nearby.match(/width:\s*(\d+)/);
  const height = nearby.match(/height:\s*(\d+)/);
  assert.ok(width && height, 'could not find the remove-question button\'s width/height declaration');
  assert.ok(Number(width![1]) >= MIN, `remove-question button is ${width![1]}px wide — a fingertip needs ${MIN}`);
  assert.ok(Number(height![1]) >= MIN, `remove-question button is ${height![1]}px tall — a fingertip needs ${MIN}`);
});

test('surveys: the remove-option control clears the 44px floor and keeps its aria-label', () => {
  const src = source('../app/surveys/page.tsx');
  const at = src.indexOf('onClick={() => removeOption(i)}');
  assert.ok(at > 0, 'the remove-option button moved — recheck this guard by hand');
  const nearby = src.slice(at, at + 400);
  assert.match(nearby, /aria-label=\{localUi\(`Remove option \$\{i \+ 1\}`, `Susa impendulo \$\{i \+ 1\}`, lang\)\}/, 'lost its aria-label');
  const width = nearby.match(/width:\s*(\d+)/);
  const height = nearby.match(/height:\s*(\d+)/);
  assert.ok(width && height, 'could not find the remove-option button\'s width/height declaration');
  assert.ok(Number(width![1]) >= MIN, `remove-option button is ${width![1]}px wide — a fingertip needs ${MIN}`);
  assert.ok(Number(height![1]) >= MIN, `remove-option button is ${height![1]}px tall — a fingertip needs ${MIN}`);
});

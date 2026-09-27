import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Verified bug: the two evidence "remove" controls in components/EvidenceSheet.tsx (site
// evidence photo/document capture, used from the field data panel) were well under the 44px
// fingertip floor tests/tap-targets.test.ts and tests/mentor-survey-remove-tap-targets.test.ts
// pin for other controls in this app — a 20x20 dark overlay square on each photo thumbnail, and
// a 14px icon in 4px padding (~22x22) on each document row.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const MIN = 44;

/** Parse a `--tap-inset` shorthand into {top,right,bottom,left} px (mirrors tests/tap-targets.test.ts). */
function inset(decl: string): { top: number; right: number; bottom: number; left: number } {
  const parts = decl.trim().split(/\s+/).map((p) => Number(p.replace('px', '')));
  assert.ok(parts.every((n) => Number.isFinite(n)), `unparseable --tap-inset: ${decl}`);
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d };
}

test('the photo remove button keeps its 20px painted size but clears the 44px hit-area floor', () => {
  const src = source('../components/EvidenceSheet.tsx');
  const at = src.indexOf("aria-label={`Remove ${ev.name || 'photo'}`}");
  assert.ok(at > 0, 'the photo remove button moved — recheck this guard by hand');
  const nearby = src.slice(at, at + 900);

  assert.match(nearby, /className="u-tap-target"/, 'lost the invisible hit-area growth mechanism');
  assert.match(nearby, /width:\s*20,\s*height:\s*20/, 'the painted square changed size — recheck the hit-area math');

  const m = nearby.match(/'--tap-inset':\s*'([^']+)'/);
  assert.ok(m, 'the photo remove button no longer declares a --tap-inset — its hit area is back to the paint');
  const box = inset(m[1]);
  const PAINTED = 20;
  const h = PAINTED - box.top - box.bottom;
  const w = PAINTED - box.right - box.left;
  assert.ok(h >= MIN, `photo remove button offers ${h}px of vertical hit area; a fingertip needs ${MIN}`);
  assert.ok(w >= MIN, `photo remove button offers ${w}px of horizontal hit area; a fingertip needs ${MIN}`);
});

test('the document remove button clears the 44px floor and keeps its aria-label', () => {
  const src = source('../components/EvidenceSheet.tsx');
  const at = src.indexOf("aria-label={`Remove ${ev.name || 'document'}`}");
  assert.ok(at > 0, 'the document remove button moved — recheck this guard by hand');
  const nearby = src.slice(at, at + 300);
  const width = nearby.match(/minWidth:\s*(\d+)/);
  const height = nearby.match(/minHeight:\s*(\d+)/);
  assert.ok(width && height, "could not find the document remove button's minWidth/minHeight declaration");
  assert.ok(Number(width![1]) >= MIN, `document remove button is ${width![1]}px wide — a fingertip needs ${MIN}`);
  assert.ok(Number(height![1]) >= MIN, `document remove button is ${height![1]}px tall — a fingertip needs ${MIN}`);
});

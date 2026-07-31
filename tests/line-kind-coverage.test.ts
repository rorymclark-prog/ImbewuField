import test from 'node:test';
import assert from 'node:assert/strict';

import { lineInFilter } from '../lib/glossy-filters.ts';

// THE BUG CLASS THIS GUARDS: a line kind that no step OWNS renders permanently at
// LOCKED_OPACITY and can never be selected, dragged or deleted — created, saved, ghost.
// It has now happened twice in one day for the same kind ('bedpath'): first invisible
// because its LAYER was off on the step that creates it, then a permanent 0.42 ghost
// because lineInFilter didn't know it. The Record<LineShape['kind'], …> pattern names
// every map that needs a new kind — but lineInFilter takes a plain string, so tsc is
// blind to it. This test is the missing exhaustiveness check.
//
// The list below MUST match LineShape['kind'] in lib/design-canvas.ts. If you are here
// because you added a kind to that union: add it here AND decide which step owns it.

const ALL_LINE_KINDS = ['swale', 'fence', 'path', 'bedpath', 'pipe', 'drip', 'windbreak', 'greywater'] as const;
// Earthworks (05) owns the swale since the land-shaping split out of Water.
const OWNING_FILTERS = ['water', 'earthworks', 'planting', 'structures'] as const;

test('every line kind is OWNED by at least one step — no kind may be a permanent ghost', () => {
  for (const kind of ALL_LINE_KINDS) {
    const owners = OWNING_FILTERS.filter((f) => lineInFilter(kind, f));
    assert.ok(
      owners.length >= 1,
      `'${kind}' is owned by NO step: it will render at LOCKED_OPACITY forever and can never be selected`,
    );
  }
});

test('no line kind is owned by two steps — double ownership makes focus dimming meaningless', () => {
  for (const kind of ALL_LINE_KINDS) {
    const owners = OWNING_FILTERS.filter((f) => lineInFilter(kind, f));
    assert.ok(owners.length <= 1, `'${kind}' is owned by ${owners.join(' and ')}`);
  }
});

test("the 'all' filter accepts every kind and the fallback rejects unknowns", () => {
  for (const kind of ALL_LINE_KINDS) assert.ok(lineInFilter(kind, 'all'));
  // An unknown kind must fail loudly-ish (excluded everywhere) rather than leak onto a sheet.
  assert.equal(lineInFilter('not-a-kind', 'water'), false);
  assert.equal(lineInFilter('not-a-kind', 'planting'), false);
});

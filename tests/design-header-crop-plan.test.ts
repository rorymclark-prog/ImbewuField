// Design Studio header ergonomics, asserted at the source level because
// app/design/page.tsx cannot be rendered under node:test (same constraint as
// tests/design-ground-layer-guard.test.ts).
//
// Two contracts:
//
// 1. The header carries a "Crop plan" quick link to THIS farm's plan — the
//    ?canvasSite deep link built from canvasState.siteId, exactly the format
//    the crop planner and the site picker already share. Without it the only
//    route from the Studio to the plan was the step-08 guide CTA, which only
//    exists on the planting step.
//
// 2. Exactly one "Preview map" button per viewport. The header button is
//    desktop-only (display: isPhone ? 'none' : ...); the steps-strip button
//    must therefore be phone-only, or a desktop user sees the same button
//    twice — and the strip copy sits right after "09 Glossy", where it reads
//    like a tenth step ("dont both these things do the same?").

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGE = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');

test('the header links to this farm\'s crop plan via the shared canvasSite deep link', () => {
  assert.match(
    PAGE,
    /href=\{`\/facilitator\/crops\?canvasSite=\$\{encodeURIComponent\(canvasState\.siteId\)\}`\}/,
    'header Crop plan link must use the same ?canvasSite format as the picker and the step guide',
  );
  assert.match(PAGE, /aria-label="Open this farm's crop plan"/);
});

test('the steps-strip Preview map is phone-only — the header owns it on wider screens', () => {
  assert.match(
    PAGE,
    /\{isPhone && canvasState\.step !== 'glossy' &&/,
    'steps-strip Preview map must be gated to phones',
  );
});

test('exactly two Preview map buttons exist in source — one per viewport, never both at once', () => {
  const buttons = PAGE.match(/<ImageIcon size=\{15\} \/> Preview map/g) ?? [];
  assert.equal(buttons.length, 2, 'a third copy means a viewport shows duplicates again');
  // The header copy hides on phones; with the strip copy phone-gated above,
  // no viewport can render both.
  assert.match(PAGE, /display: isPhone \? 'none' : 'inline-flex', alignItems: 'center', gap: 6,/);
});

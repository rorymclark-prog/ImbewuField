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
// 2. Design views outrank routes away from the Studio on a phone. The phone
//    picker must include Preview & Export so someone on that screen can return
//    to an earlier design step. Map, Crop plan, Print and Preview map sit under
//    More; Preview map still appears only once per viewport.

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
  assert.match(
    PAGE,
    /aria-label=\{tr\("Open this farm's crop plan", 'Vula uhlelo lwezitshalo zaleli pulazi'\)\}/,
    'the farm-specific crop-plan link must stay named in both interface languages',
  );
});

test('the phone Preview map lives under More while the header owns it on wider screens', () => {
  assert.match(
    PAGE,
    /\{isPhone && canvasState && \(\s*<div id="design-studio-more-actions"/,
    'phone-only More panel must contain the secondary destinations',
  );
  assert.match(PAGE, /\{canvasState\.step !== 'glossy' && \(\s*<button[\s\S]*?Preview map and choose a plan sheet/);
});

test('a phone can leave Preview & Export through the persistent design-view picker', () => {
  assert.match(PAGE, /<select\s+aria-label=\{tr\('Choose a design view'/);
  assert.match(PAGE, /value=\{canvasState\.step\}/);
  assert.match(PAGE, /onChange=\{\(event\) => \{ setPhoneActionsOpen\(false\); setStep\(event\.target\.value as WizardStep\); \}\}/);
  assert.match(PAGE, /STEP_ORDER\.map\(\(step, index\) => <option/);
  assert.match(PAGE, /step === 'glossy' \? 'Preview & Export'/);
});

test('moving secondary routes out of the phone header does not strand the map or crop plan', () => {
  const morePanel = PAGE.split('id="design-studio-more-actions"')[1]?.split('{/* SAFE MODE')[0] ?? '';
  assert.match(morePanel, /href="\/farmer"/);
  assert.match(morePanel, /href=\{`\/facilitator\/crops\?canvasSite=\$\{encodeURIComponent\(canvasState\.siteId\)\}`\}/);
  assert.match(morePanel, /setPrintOpen\(true\)/);
});

test('exactly two bilingual Preview map buttons exist in source — one per viewport, never both at once', () => {
  const buttons = PAGE.match(/<ImageIcon size=\{15\} \/> \{tr\('Preview map', 'Buka imephu'\)\}/g) ?? [];
  assert.equal(buttons.length, 2, 'a third copy means a viewport shows duplicates again');
  // The header copy hides on phones; the other copy is inside the phone More panel.
  assert.match(PAGE, /display: isPhone \? 'none' : 'inline-flex', alignItems: 'center', gap: 6,/);
});

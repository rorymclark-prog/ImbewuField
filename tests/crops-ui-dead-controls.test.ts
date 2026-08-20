// Two dead/blocked controls Rory hit live on the crop plan page on 2026-08-20,
// asserted at source level (the page cannot render under node:test — same
// constraint as tests/design-ground-layer-guard.test.ts):
//
// 1. "Clear all" did nothing: window.confirm is SUPPRESSED in embedded
//    webviews (returns false instantly, no dialog), so the handler silently
//    aborted. The confirmation is now an in-app inline strip. window.confirm
//    must never come back to this page.
//
// 2. The global floating Back pill rendered on top of the crops header's own
//    Home / "Back to design" controls. The header registers itself via
//    useRegisterBackControl so the fallback stands down (the BackControl
//    contract: any page offering its own way back registers).
//
// (The same webview-confirm bug class at the app's 5 other window.confirm
// call sites is owned by the claude/webview-confirm-sweep branch, with the
// Layers-panel resize-handle fix — split per Rory's task division.)

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CROPS = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

test('the crops page never uses window.confirm — embedded webviews suppress it silently', () => {
  // Call sites only — the comment explaining WHY may (and does) name it.
  assert.equal(CROPS.includes('window.confirm('), false,
    'native confirm dialogs return false without rendering in embedded webviews; use an inline confirm');
  assert.match(CROPS, /confirmingClear/, 'the inline two-step confirm must exist in its place');
  assert.match(CROPS, /Yes, clear/, 'the confirm strip needs an explicit destructive action');
});

test('the crops header registers its in-flow back controls so the floating pill stands down', () => {
  assert.match(CROPS, /useRegisterBackControl/);
  // Rendered INSIDE the header element, so registration mirrors the header's
  // own presence exactly — a picker or empty state without the header keeps
  // the floating fallback.
  assert.match(CROPS, /<header[^>]*>\s*<RegisterInFlowBack \/>/);
});

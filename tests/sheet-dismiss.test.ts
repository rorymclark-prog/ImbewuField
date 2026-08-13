import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { DISMISS_DISTANCE_PX, DISMISS_VELOCITY } from '../lib/sheet-dismiss.ts';

// "I WANT TO BE ABLE TO DRAG ANY OF THOSE TOP CLOSING BUTTONS IN THE MODALS AND IT CLOSES."
//
// Rory, 13 August. Every bottom sheet already drew the little horizontal bar at its top — the
// `u-sheet-grabber` in globals.css — which on a phone means exactly one thing: pull me down.
// Ours was `aria-hidden` decoration. Some sheets closed on a TAP of it; none closed on a drag,
// which is the gesture the bar is actually promising.
//
// And in the same screenshot, Lima's launcher was sitting on top of the "Tree" row of the Add
// catalogue — a row a farmer is meant to press. The FAB is at z-60 and every sheet sits below it.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the dismiss thresholds are a deliberate gesture, not a twitch', () => {
  // Too small and a mis-touch while scrolling loses the farmer's place; too large and the bar
  // stops feeling like it is attached to anything.
  assert.ok(DISMISS_DISTANCE_PX >= 60 && DISMISS_DISTANCE_PX <= 140, `${DISMISS_DISTANCE_PX}px is not a thumb-drag`);
  assert.ok(DISMISS_VELOCITY > 0.2 && DISMISS_VELOCITY < 1.5, 'a flick should be quick, not violent');
});

test('the grabber hooks are called before any early return', () => {
  // THE BUG I SHIPPED INTO MY OWN BRANCH AND CAUGHT BY OPENING THE SHEET. useSheetDismiss was
  // placed AFTER `if (!mounted || !open) return null`, so React saw a different number of hooks
  // the instant the sheet opened and threw — the sheet never appeared at all. Typecheck was clean
  // and every unit test passed; only running it found this.
  const add = source('../components/AddSheet.tsx');
  const hookAt = add.indexOf('useSheetDismiss(onClose, open)');
  const returnAt = add.indexOf('if (!mounted || !open) return null;');
  assert.ok(hookAt > 0, 'AddSheet no longer uses the shared dismiss hook');
  assert.ok(returnAt > 0, 'the early return moved; recheck the hook ordering by hand');
  assert.ok(hookAt < returnAt, 'useSheetDismiss must be called BEFORE the early return, or React throws');
});

test('both sheets put the drag on a real, reachable control', () => {
  for (const rel of ['../components/AddSheet.tsx', '../app/farmer/page.tsx']) {
    const s = source(rel);
    assert.match(s, /data-sheet-grabber=""/, `${rel} has no draggable grabber`);
    assert.match(s, /\{\.\.\.(drag|sheetDrag)\.handlers\}/, `${rel} renders a grabber but never wires the drag`);
    // Without touch-action:none the browser claims the vertical gesture as a scroll and the drag
    // never reaches React at all.
    assert.match(s, /touchAction: 'none'/, `${rel} will lose the gesture to the browser's scroller`);
  }
  // The Add sheet's bar used to be aria-hidden decoration inside a plain div.
  const add = source('../components/AddSheet.tsx');
  assert.doesNotMatch(add, /<div className="u-sheet-grabber flex-shrink-0" aria-hidden="true" \/>/,
    'the grabber is decoration again');
  // Two controls must not share one label — the scrim already carries the plain close label.
  assert.match(add, /drag down or tap/);
});

test('the floating launcher gets out of the way of any sheet', () => {
  // Moving the FAB (as the /farmer default position does) only relocates the collision; a sheet
  // covers the whole screen, so the answer is to go away while one is up.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /listenForOverlay\(setOverlay\)/, 'the FAB no longer listens for open sheets');
  assert.match(widget, /\{!open && !drawing && !overlay && \(/, 'the FAB will float over sheets again');

  // And something has to actually raise the signal, or the listener is decoration.
  const farmer = source('../app/farmer/page.tsx');
  assert.match(farmer, /announceOverlay\(sheetOpen \|\| addOpen\)/, 'nothing tells the FAB a sheet is open');
  assert.match(farmer, /return \(\) => announceOverlay\(false\)/,
    'the signal must be cleared on unmount, or the FAB stays hidden after navigating away');

  // The event name lives in one module. `imbewu-drawing` is spelled out as a literal at both ends
  // and that is exactly how these drift.
  const signal = source('../lib/overlay-signal.ts');
  assert.match(signal, /export const OVERLAY_EVENT/);
  assert.doesNotMatch(widget, /'imbewu-overlay-open'/, 'the event name was retyped instead of imported');
  assert.doesNotMatch(farmer, /'imbewu-overlay-open'/, 'the event name was retyped instead of imported');
});

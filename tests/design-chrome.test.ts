import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  BOTTOM_STOPS,
  TOP_STOPS,
  DISMISSIBLE_BANDS,
  FOLLOW_SLACK_PX,
  bottomVisibility,
  topVisibility,
  followStop,
  nextStop,
  moreClosed,
  moreOpen,
  restoreStop,
  restoreDismissed,
  persistableChrome,
} from '../lib/design-chrome';
import {
  DEFAULT_DESIGN_WORKSPACE_MODE,
  DEFAULT_DESKTOP_PANEL_LAYOUT,
  clampDesktopPanelWidth,
  elementPanelColumns,
  reservedDesktopPanelSpace,
  restoreDesignWorkspaceMode,
  restoreDesktopPanelLayout,
} from '../lib/design-panel-layout';

// ── The shed order ────────────────────────────────────────────────────────────────────────────
//
// This is the part that has been wrong twice, in both directions, so it gets asserted rather than
// described. The rule: the bands you OPERATE (the photo-alignment strip, the tool row) outlive the
// bands you READ (advice, the skip-ahead offer, the step guide) and the band you PICK FROM (the
// element catalog). Getting that backwards is what produced "i cant work with the map adjustment
// tools without the huge tool section underneath".

test('the photo controls and the tool row survive every rung except the last', () => {
  for (const stop of ['full', 'compact', 'bar'] as const) {
    const v = bottomVisibility(stop);
    assert.equal(v.droneTools, true, `${stop} must keep the photo controls`);
    assert.equal(v.tools, true, `${stop} must keep the tool row`);
  }
  const hidden = bottomVisibility('hidden');
  assert.equal(hidden.droneTools, false);
  assert.equal(hidden.tools, false);
});

test('advice and the skip-ahead offer go before anything you operate', () => {
  const compact = bottomVisibility('compact');
  assert.equal(compact.advisor, false);
  assert.equal(compact.shortcuts, false);
  // Nothing you press has gone yet at this rung.
  assert.equal(compact.body, true);
  assert.equal(compact.stepBar, true);
});

test('the working rung is map + photo strip + tool row and nothing else', () => {
  const bar = bottomVisibility('bar');
  assert.deepEqual(bar, {
    droneTools: true,
    droneEntry: true,
    shortcuts: false,
    advisor: false,
    stepBar: false,
    body: false,
    tools: true,
  });
});

test('every rung is reachable and strictly sheds — no rung shows more than the one above', () => {
  const keys = Object.keys(bottomVisibility('full')) as (keyof ReturnType<typeof bottomVisibility>)[];
  for (let i = 1; i < BOTTOM_STOPS.length; i += 1) {
    const above = bottomVisibility(BOTTOM_STOPS[i - 1]);
    const here = bottomVisibility(BOTTOM_STOPS[i]);
    for (const k of keys) {
      if (here[k]) assert.equal(above[k], true, `${BOTTOM_STOPS[i]} shows ${k} but ${BOTTOM_STOPS[i - 1]} does not`);
    }
    assert.notDeepEqual(here, above, `${BOTTOM_STOPS[i]} is indistinguishable from ${BOTTOM_STOPS[i - 1]}`);
  }
});

test('the top ladder sheds monotonically too, ending at nothing', () => {
  assert.deepEqual(topVisibility('hidden'), { header: false, wizard: false, stepNav: false });
  assert.equal(topVisibility('slim').header, true);
  assert.equal(topVisibility('slim').wizard, false);
});

// ── The drag ──────────────────────────────────────────────────────────────────────────────────

test('a drag that asks for less chrome than is on screen sheds one band', () => {
  // 300px of chrome showing, finger has asked for 200 — shed.
  assert.equal(followStop('full', 300, 200, BOTTOM_STOPS), 'compact');
  assert.equal(followStop('compact', 300, 200, BOTTOM_STOPS), 'bar');
});

test('a drag that asks for more chrome than is on screen restores one band', () => {
  assert.equal(followStop('bar', 120, 300, BOTTOM_STOPS), 'compact');
  assert.equal(followStop('compact', 120, 300, BOTTOM_STOPS), 'full');
});

test('within the slack the ladder holds still, so a resting hand does not flap', () => {
  assert.equal(followStop('compact', 200, 200, BOTTOM_STOPS), 'compact');
  assert.equal(followStop('compact', 200, 200 + FOLLOW_SLACK_PX - 1, BOTTOM_STOPS), 'compact');
  assert.equal(followStop('compact', 200 + FOLLOW_SLACK_PX - 1, 200, BOTTOM_STOPS), 'compact');
});

test('the follow clamps at both ends — a long pull can never fall off the ladder', () => {
  assert.equal(followStop('hidden', 40, -4000, BOTTOM_STOPS), 'hidden');
  assert.equal(followStop('full', 400, 4000, BOTTOM_STOPS), 'full');
});

test('an unmeasurable handle changes nothing rather than guessing', () => {
  assert.equal(followStop('compact', Number.NaN, 200, BOTTOM_STOPS), 'compact');
  assert.equal(followStop('compact', 200, Number.NaN, BOTTOM_STOPS), 'compact');
});

test('a tap still wraps, so one control reaches every state and comes back', () => {
  let stop: (typeof BOTTOM_STOPS)[number] = 'full';
  const seen = new Set<string>();
  for (let i = 0; i < BOTTOM_STOPS.length; i += 1) {
    seen.add(stop);
    stop = nextStop(stop, BOTTOM_STOPS);
  }
  assert.equal(seen.size, BOTTOM_STOPS.length);
  assert.equal(stop, 'full');
});

test('moreClosed and moreOpen clamp instead of wrapping', () => {
  assert.equal(moreClosed('hidden', BOTTOM_STOPS), 'hidden');
  assert.equal(moreOpen('full', BOTTOM_STOPS), 'full');
});

// ── What is written down ──────────────────────────────────────────────────────────────────────

test('hidden is never restored from storage — the Studio cannot reopen with no controls', () => {
  assert.equal(restoreStop('hidden', BOTTOM_STOPS, 'full'), 'full');
  assert.equal(restoreStop('hidden', TOP_STOPS, 'full'), 'full');
  assert.equal(persistableChrome({ top: 'hidden', bottom: 'hidden' }).bottom, 'bar');
  assert.equal(persistableChrome({ top: 'hidden', bottom: 'hidden' }).top, 'slim');
});

test('dismissed sections survive a reload, but only ones that still exist', () => {
  assert.deepEqual(restoreDismissed(JSON.stringify(['droneTools', 'stepGuide'])), ['droneTools', 'stepGuide']);
  assert.deepEqual(restoreDismissed(JSON.stringify(['droneTools', 'a-band-we-deleted'])), ['droneTools']);
  assert.deepEqual(restoreDismissed('not json at all'), []);
  assert.deepEqual(restoreDismissed(null), []);
  assert.deepEqual(restoreDismissed(JSON.stringify({ droneTools: true })), []);
});

test('every dismissible band is a band the ladder also knows about', () => {
  const known = Object.keys(bottomVisibility('full'));
  for (const band of DISMISSIBLE_BANDS) {
    // stepGuide is the ladder's `stepBar`; the rest match by name.
    const ladderKey = band === 'stepGuide' ? 'stepBar' : band;
    assert.ok(known.includes(ladderKey), `${band} has no matching visibility field`);
  }
});

test('Layers stays usable on both the fixed desktop dock and measured phone popover', () => {
  const palette = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');

  // Desktop now owns a full-height Layers dock (rather than a menu that can disappear), while
  // phone still measures the popover against the viewport before choosing a side.
  assert.match(palette, /top: desktopAside && !isPhone \? \(effectiveLayersFloating \? layersFloatPos\.y : 116\)/);
  assert.match(palette, /bottom: desktopAside && !isPhone \? \(effectiveLayersFloating \? undefined : 12\)/);
  assert.match(palette, /layersAnchor\?\.openBelow \? layersAnchor\.bottom \+ 6 : undefined/);
  assert.match(palette, /maxHeight: desktopAside && !isPhone \? \(effectiveLayersFloating \? '65dvh' : undefined\) : layersAnchor\?\.maxHeight/);
  assert.match(palette, /overflowY: 'auto'/);
});

test('desktop panel width lives on the edge handles, not duplicate header sliders', () => {
  const palette = readFileSync(new URL('../components/design/DesignPalette.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(palette, /aria-label="(?:Elements|Layers) panel width"/,
    'range sliders consume both panel headers and duplicate the resize grips');
  assert.match(palette, /role="separator"[\s\S]*?Drag to resize the Layers panel/);
  assert.match(palette, /role="separator"[\s\S]*?Drag to resize the Elements panel/);
});

test('the nine-step rail fills and centres the available desktop width', () => {
  const stepper = readFileSync(new URL('../components/design/CardsStepper.tsx', import.meta.url), 'utf8');

  assert.match(stepper, /justifyContent: 'center'/);
  assert.match(stepper, /flex: '1 0 108px', maxWidth: 150/,
    'steps should grow into readable targets without becoming an off-centre text clump');
});

test('desktop panel widths stay within map-safe bounds', () => {
  assert.equal(clampDesktopPanelWidth('elements', 1), 124);
  assert.equal(clampDesktopPanelWidth('elements', 999), 440);
  assert.equal(clampDesktopPanelWidth('layers', 1), 248);
  assert.equal(clampDesktopPanelWidth('layers', 999), 420);
});

test('the Elements dock naturally reflows from three cards to one as its handle narrows', () => {
  assert.equal(elementPanelColumns(304), 3);
  assert.equal(elementPanelColumns(240), 2);
  assert.equal(elementPanelColumns(124), 1);
});

test('the balanced dock is the safe default and only docks reserve map gutters', () => {
  assert.equal(restoreDesignWorkspaceMode(null), DEFAULT_DESIGN_WORKSPACE_MODE);
  assert.equal(restoreDesignWorkspaceMode('floating'), 'floating');
  assert.equal(restoreDesignWorkspaceMode('tray'), 'tray');
  assert.equal(restoreDesignWorkspaceMode('unknown'), 'docked');
  assert.equal(reservedDesktopPanelSpace('docked', 304), 328);
  assert.equal(reservedDesktopPanelSpace('floating', 304), 0);
  assert.equal(reservedDesktopPanelSpace('tray', 304), 0);
});

test('desktop panel layout restores only valid persisted widths', () => {
  assert.deepEqual(restoreDesktopPanelLayout(JSON.stringify({ elements: 280, layers: 360 })), { elements: 280, layers: 360 });
  assert.deepEqual(restoreDesktopPanelLayout('bad json'), DEFAULT_DESKTOP_PANEL_LAYOUT);
  assert.deepEqual(restoreDesktopPanelLayout(JSON.stringify({ elements: 'wide', layers: 300 })), { elements: 304, layers: 300 });
});

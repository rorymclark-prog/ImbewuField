import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// "LOOK AT ALL THE BUTTONS THAT ARE COVERING EACH OTHER SORT THOSE OUT" — Rory, 12 August, with a
// screenshot of the farmer map: Lima's launcher sitting on top of the "+ Add" pill.
//
// Neither control is wrong on its own. The FAB (components/ChatWidget.tsx) is mounted globally by
// app/layout.tsx and parks bottom-left. The Add pill was added later to app/farmer/page.tsx under
// the comment "LimaBar is not mounted on /farmer, so bottom-left is free" — true of LimaBar, and
// false of the FAB, which is a different component in a different file that nobody looked at.
//
// That is the shape of this bug class: two files, each locally correct, colliding in a corner
// neither of them owns. A comment asserting a corner is free cannot see the other file; this test
// can. It reads both positions and does the arithmetic.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** The `bottom: calc(Npx + env(...) + Mpx)` a control sits at, in px above the safe area. */
function bottomOf(css: string): number {
  const m = css.match(/calc\((\d+)px \+ env\(safe-area-inset-bottom[^)]*\)(?: \+ (\d+)px)?\)/);
  assert.ok(m, `could not read a bottom offset from: ${css}`);
  return Number(m[1]) + Number(m[2] ?? 0);
}

test('Lima\'s launcher clears the farmer map\'s own bottom-left control', () => {
  const farmer = source('../app/farmer/page.tsx');
  const widget = source('../components/ChatWidget.tsx');

  // The "+ Add" pill — the thing that was being covered.
  const addAt = farmer.indexOf('floating "+ Add" pill');
  assert.ok(addAt > 0, 'the Add pill is gone; this test needs rewriting rather than deleting');
  const addStyle = farmer.slice(addAt, addAt + 900);
  assert.match(addStyle, /left-4/, 'the Add pill has moved out of the bottom-left corner');
  const addBottom = bottomOf(addStyle);

  // The FAB's default parking spot on /farmer.
  const farmerDefault = widget.match(/pathname\.startsWith\('\/farmer'\)\s*\?\s*'bottom-\[(\d+)px\] left-4/);
  assert.ok(farmerDefault, 'ChatWidget no longer gives /farmer its own default position');
  const fabBottom = Number(farmerDefault[1]);

  // The pill is ~41px tall (px-4 py-2.5, 14px text). Clear it, with room for a thumb.
  const PILL_HEIGHT = 41;
  assert.ok(
    fabBottom >= addBottom + PILL_HEIGHT + 8,
    `Lima's FAB parks at ${fabBottom}px and the Add pill reaches ${addBottom + PILL_HEIGHT}px — they overlap`,
  );
});

test('the pages that hand the corner to something else still opt out entirely', () => {
  // /home has LimaBar; /design's bottom-docked palette owned the corner and "the FAB covered
  // Select". Those two are exclusions rather than offsets, and must stay that way.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /pathname\.startsWith\('\/home'\)/);
  assert.match(widget, /pathname\.startsWith\('\/design'\)/);
  // /farmer must NOT be added to that list — the map is where Lima is most wanted.
  const skipAt = widget.indexOf("pathname.startsWith('/login')");
  const skipBlock = widget.slice(skipAt, skipAt + 260);
  assert.doesNotMatch(skipBlock, /\/farmer/, 'Lima should move on the map, not disappear from it');
});

test('Lima\'s launcher stays off the crop plan\'s content — by leaving the overlay, not moving in it', () => {
  // Same 12 August complaint, a different page. /facilitator/crops draws every section heading,
  // the Availability tab, the benchmark kg headline and every task line flush LEFT, so the shared
  // bottom-left default parked the FAB on top of them at 375px. The fix then was a route-specific
  // corner: dock right, where that page fixes nothing.
  //
  // THAT WAS NOT ENOUGH, and this test asserted it was. Measured against the rendered page on
  // 24 September at 390x844: the right-docked FAB covered a "Green beans (69%)" Gantt bar button
  // at (199,693)-(373,719). The plan scrolls SIDEWAYS, so bars travel under whichever corner the
  // FAB parks in — there is no resting position on this page that clears them, which is why a
  // third offset would have moved the problem rather than ended it.
  //
  // So the conclusion flips: Lima leaves the overlay here and mounts in the document flow, the
  // swap /student and /home already made. The fact this test protects is unchanged — Lima must
  // not sit on the crop plan's content — only the mechanism that satisfies it.
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/login')");
  assert.ok(skipAt > 0, 'the exclusion block moved; rewrite this test rather than deleting it');
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt));
  assert.match(
    skipBlock,
    /pathname\.startsWith\('\/facilitator\/crops'\)/,
    'the crop plan must be excluded from the floating FAB — a right-dock offset was measured to be not enough',
  );

  // Excluded is only half of it: leaving the page with no route to help would be worse than the
  // overlap. tests/chat-widget-fab-overlap.test.ts pairs every exclusion with a LimaBar; this is
  // the one for this page, asserted here too so neither file can drift alone.
  const crops = source('../app/facilitator/crops/page.tsx');
  assert.match(crops, /<LimaBar \/>/, 'the crop plan drops the FAB, so it owes the farmer an in-flow Lima');

  // And the dead offset branch must be gone, or the next person re-tunes a number that no longer
  // renders.
  const posAt = widget.indexOf('const FAB_DEFAULT_POS');
  assert.doesNotMatch(
    widget.slice(posAt, widget.indexOf(';', posAt)),
    /facilitator\/crops/,
    'an offset branch for an excluded route is dead code',
  );
});

test('the FAB still gets out of the way while a boundary is being drawn', () => {
  // The draw action bar takes the whole bottom strip, so the FAB hides rather than shifts. This
  // already worked; it is here so a positioning change cannot quietly cost it.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /window\.addEventListener\('imbewu-drawing'/);
  // Matches the drawing term specifically, not the whole condition — `!overlay` was added on
  // 13 Aug so the FAB also hides behind sheets, and this test is about the draw bar.
  assert.match(widget, /\{!open && !drawing &&/, 'the FAB no longer hides during a draw');
});

test('the LABELS strip does not sit on top of "Find your land"', () => {
  // TWO FIXES FOR ONE STRIP, EACH UNDOING THE OTHER.
  //
  // The strip used to clip off the right of a phone, so it was given
  // `maxWidth: calc(100vw - 28px)` and told to scroll its contents. That fixed the clipping by
  // letting the strip span the whole width — which ran it straight over the "Find your land"
  // button at top-left. Rory, with a zoomed screenshot: "Find your land is still covered".
  //
  // Both changes were right about the edge they were looking at. This test looks at both edges.
  const map = source('../components/Map.tsx');

  // The strip still may not clip off-screen — the earlier fix must survive this one.
  assert.match(map, /maxWidth: 'calc\(100vw - 28px\)'/, 'the strip can clip off a phone again');
  assert.match(map, /overflowX: 'auto'/);

  // And on a phone it drops to its own row whenever the tools button is on screen. (16 Aug: this
  // gained a desktop-only branch — desktop's map pane is its own column with hundreds of px of
  // horizontal clearance beside the compact "Find your land" island, so desktop sits flush at 14
  // unconditionally. isPhone gates the branch that still needs the 68px drop; assert both halves
  // so a future edit can't collapse the phone case back to always-14 without this test noticing.)
  assert.match(map, /top: isPhone \? \(toolsPillShowing \? 68 : 14\) : 14/, 'the strip is back on the top row on phone');

  // 68 must actually clear the button: top-3 (12px) + its 48px height = 60.
  // Anchor to the action rather than its displayed language: the clearance protects
  // the same button when the farmer switches the map controls to isiZulu.
  const toolsButton = map.indexOf('onClick={openPanel}');
  assert.ok(toolsButton > 0, 'the map tools button is missing; recheck the strip clearance');
  const btn = map.slice(toolsButton, toolsButton + 400);
  assert.match(btn, /top-3 left-3/, 'the tools button moved; the 68px clearance needs rechecking');
  assert.match(btn, /height: 48/, 'the tools button changed height; 68px may no longer clear it');

  // The flag is DERIVED from that button's own render condition rather than restated, so the two
  // cannot drift apart and start overlapping again.
  assert.match(map, /const toolsPillShowing = !activeDraw && !guided;/);
});

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
  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  const skipBlock = widget.slice(skipAt, skipAt + 260);
  assert.doesNotMatch(skipBlock, /\/farmer/, 'Lima should move on the map, not disappear from it');
});

test('the FAB still gets out of the way while a boundary is being drawn', () => {
  // The draw action bar takes the whole bottom strip, so the FAB hides rather than shifts. This
  // already worked; it is here so a positioning change cannot quietly cost it.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /window\.addEventListener\('imbewu-drawing'/);
  assert.match(widget, /\{!open && !drawing && \(/, 'the FAB no longer hides during a draw');
});

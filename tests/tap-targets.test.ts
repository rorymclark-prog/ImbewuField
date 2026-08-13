import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// "STILL IF I CLICK ON UBHEJANE LABEL IT DOESN'T DO ANYTHING… nothing, it just zooms in
// slightly, this is just for the phone, the laptop works." — Rory, 13 August.
//
// Three rounds were spent looking at the handler: the stopPropagation, the marker's drag
// listeners, the z-order of everything stacked over the map. The handler was never the problem.
// The click event never arrived.
//
// app/layout.tsx declares width=device-width, initial-scale=1 and deliberately leaves the page
// zoomable — pinching to read is not something to take away from someone squinting at a map in
// the sun. iOS Safari therefore has to wait ~350ms after every tap in case a second one turns it
// into a double-tap zoom, and if a second tap does come it zooms and never dispatches a click.
// Tap a small label, see nothing, tap again: a slight zoom and no panel. Exactly what he saw.
// A mouse has no double-tap gesture, which is the entire reason the laptop "works".
//
// `touch-action: manipulation` keeps pan and pinch and drops double-tap zoom, so the click is
// dispatched immediately. It belongs on controls, not on the page, and it lives in one CSS rule
// rather than being sprinkled inline at every tap target — because the next label somebody adds
// will not have the sprinkle.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/** The `touch-action: manipulation` block from globals.css, selectors and all. */
function tapRule(): { selectors: string[]; body: string } {
  const css = source('../app/globals.css');
  const at = css.indexOf('touch-action: manipulation;');
  assert.ok(at > 0, 'the tap-target rule is gone — taps on the map labels will be eaten again');
  const open = css.lastIndexOf('{', at);
  const start = css.lastIndexOf('*/', open) + 2;
  return {
    selectors: css.slice(start, open).split(',').map(s => s.trim()).filter(Boolean),
    body: css.slice(open, css.indexOf('}', at) + 1),
  };
}

test('every ordinary control opts out of double-tap zoom', () => {
  const { selectors } = tapRule();
  // Buttons and links are the two that matter — the map labels are buttons, the nav is links.
  assert.ok(selectors.includes('button'), 'buttons are back to waiting 350ms for a second tap');
  assert.ok(selectors.includes('a[href]'), 'links are back to waiting 350ms for a second tap');
  // Bare `a` would catch anchors used as scroll targets; only linked ones are tap targets.
  assert.ok(!selectors.includes('a'), 'use a[href] — a bare `a` also matches non-interactive anchors');
});

test('the rule is scoped to controls, never to the page', () => {
  const { selectors } = tapRule();
  for (const blanket of ['*', 'html', 'body', 'div']) {
    assert.ok(
      !selectors.includes(blanket),
      `\`${blanket}\` would take double-tap zoom away from text and imagery too — a farmer reading `
      + 'a report on a phone in the sun needs that gesture',
    );
  }
});

test('the drag handles still claim the vertical gesture for themselves', () => {
  // The sheet grabbers set `touch-action: none` inline (lib/sheet-dismiss.ts's contract) so the
  // browser hands them the drag instead of scrolling. Inline beats a stylesheet rule, so the two
  // coexist — but that is exactly the kind of thing that is true until someone moves the `none`
  // into a class, so it is asserted rather than assumed. Confirmed in a real browser at iPhone
  // viewport: the grabber computes `none`, all 37 other buttons on /farmer compute `manipulation`.
  for (const rel of ['../components/AddSheet.tsx', '../app/farmer/page.tsx']) {
    assert.match(source(rel), /touchAction: 'none'/, `${rel} no longer claims the drag gesture`);
  }
});

test('both place labels are real buttons, so the rule actually reaches them', () => {
  // The rule keys off the element. A label rebuilt as a styled <div onClick> would look identical,
  // pass every other test in this repo, and be un-tappable on a phone all over again.
  const map = source('../components/Map.tsx');

  // Path 1: the label inside the saved-place Marker.
  const marker = map.indexOf('{/* Saved-place pins — click to fly in */}');
  assert.ok(marker > 0, 'the saved-place markers moved; recheck both label paths by hand');
  assert.match(map.slice(marker, marker + 1200), /<button\s+onClick=\{\(e\) => \{[\s\S]*?flyTo/,
    'the marker place label is no longer a <button>');

  // Path 2: the overlay label, which is the VISIBLE one once a place has linked features — the
  // one Rory was tapping. Its own comment already warns this spot is a recurring regression.
  const overlay = map.indexOf('Place-name bubble — outside the site to the right');
  assert.ok(overlay > 0, 'the overlay place label is gone; this is the label a farmer taps');
  assert.match(map.slice(overlay, overlay + 1400), /<button key=\{`pname-\$\{p\.id\}`\}/,
    'the overlay place label is no longer a <button>');
});

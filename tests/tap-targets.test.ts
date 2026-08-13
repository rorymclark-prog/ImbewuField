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

// ── A finger is not a mouse pointer ──────────────────────────────────────────────────────────
//
// "It works but on the third tap. Can you make it more sensitive still?" — Rory, same day, after
// the double-tap fix above landed. Two different problems wearing the same clothes: that one was
// about whether the click was dispatched, this one is about whether the finger lands on the thing
// at all. The labels are 13px and 11px type in a couple of px of padding. A fingertip contact
// patch is ~10mm across and the browser reports its CENTROID, which is not where anyone thinks
// they are pressing — so a 26px target is missed roughly two taps in three.
//
// MEASURED in Chromium at iPhone 13 viewport with elementFromPoint, walking out from each centre
// until the hit test stops returning the element, against the app's own compiled CSS:
//
//     marker label   29px painted → 50 × 97 hit area
//     marker pin     22px painted → 45 × 53 hit area
//     overlay label  30px painted → 55 × 105 hit area
//     the 4px gap between the marker pair belongs to neither — they do not steal from each other
//
// The numbers below are the arithmetic behind those measurements, so a future inset edit that
// breaks them fails here rather than on someone's phone.

/** Parse a `--tap-inset` shorthand into {top,right,bottom,left} px. */
function inset(decl: string): { top: number; right: number; bottom: number; left: number } {
  const parts = decl.trim().split(/\s+/).map((p) => Number(p.replace('px', '')));
  assert.ok(parts.every((n) => Number.isFinite(n)), `unparseable --tap-inset: ${decl}`);
  const [a, b = a, c = a, d = b] = parts;
  return { top: a, right: b, bottom: c, left: d };
}

/** The `--tap-inset` declared on the element whose source contains `marker`. */
function insetNear(map: string, marker: string): ReturnType<typeof inset> {
  const at = map.indexOf(marker);
  assert.ok(at > 0, `could not find ${marker} in Map.tsx`);
  const m = map.slice(at, at + 2400).match(/'--tap-inset':\s*'([^']+)'/);
  assert.ok(m, `${marker} no longer declares a --tap-inset — its hit area is back to the paint`);
  return inset(m[1]);
}

test('the hit area grows without the paint growing', () => {
  const css = source('../app/globals.css');
  assert.match(css, /\.u-tap-target::before/, 'the expanded hit area is gone');
  assert.match(css, /inset: var\(--tap-inset/, 'the hit area is no longer sized per element');
  // No background, border or content: the moment this paints, it covers the imagery it labels.
  const at = css.indexOf('.u-tap-target::before');
  const rule = css.slice(at, css.indexOf('}', at)).replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(rule, /background|border|box-shadow/, 'the hit area has started painting itself');

  // ZERO SPECIFICITY, deliberately. This rule sits after @tailwind utilities, so a plain
  // `.u-tap-target { position: relative }` would out-order `.absolute` on the overlay label and
  // drop it into the document flow — it would render at the top-left of the map instead of beside
  // the site. Confirmed in the browser: that label still computes `position: absolute`.
  assert.match(css, /:where\(\.u-tap-target\)\s*\{\s*position: relative/,
    'the positioning rule needs :where(), or it will move the overlay place label');
});

test('every place target clears the 44px floor a fingertip needs', () => {
  const map = source('../components/Map.tsx');
  const MIN = 44;

  // Painted heights, from the source: text-xs (12px) in py-1 → ~22px, and 13px in 4px padding
  // → ~26px. The browser measured 29 and 30 with borders and line-height; the smaller numbers
  // here keep this test honest if the styling shrinks.
  const cases = [
    { name: 'marker place label', painted: 22, box: insetNear(map, 'Saved-place pins — click to fly in') },
    { name: 'overlay place label', painted: 26, box: insetNear(map, 'Place-name bubble — outside the site to the right') },
  ];
  for (const c of cases) {
    const h = c.painted - c.box.top - c.box.bottom;
    assert.ok(h >= MIN, `${c.name} offers ${h}px of vertical hit area; a fingertip needs ${MIN}`);
  }
});

test('the marker label and its pin do not steal each other\'s taps', () => {
  // They sit 4px apart (mb-1) and do DIFFERENT things — the label opens the place, the pin toggles
  // it active. Two greedy targets sharing a band would turn one miss into a different miss, which
  // is not progress. So the label grows upwards only and the pin downwards only, into empty map.
  const map = source('../components/Map.tsx');
  const label = insetNear(map, 'Saved-place pins — click to fly in');
  const pin = insetNear(map, 'and the pin grows DOWNWARDS only');
  const GAP = 4; // mb-1

  assert.equal(label.bottom, 0, 'the place label now grows downwards, into the pin');
  assert.equal(pin.top, 0, 'the pin now grows upwards, into the place label');
  assert.ok(
    -label.bottom + -pin.top < GAP,
    `the two targets overlap by ${-label.bottom + -pin.top - GAP}px and will fight over taps`,
  );
  // And the pin needs the floor too — it was 41px before the bottom inset was widened to 24.
  assert.ok(22 - pin.top - pin.bottom >= 44, 'the pin is back under the 44px floor');
});

test('a label faded out of sight cannot take a tap', () => {
  // opacity-0 is invisible, not absent. The marker label sits directly over the pin, so while it
  // is faded it was still swallowing taps aimed at something else — measured as fixed in the
  // browser. Hover hands it back on desktop, where the fade is a reveal rather than a hide.
  const map = source('../components/Map.tsx');
  const marker = map.slice(map.indexOf('Saved-place pins — click to fly in'), map.indexOf('People face-photo markers'));
  assert.match(marker, /opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto/,
    'the hidden place label is a live tap target again');
});

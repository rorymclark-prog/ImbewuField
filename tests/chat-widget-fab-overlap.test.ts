import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Follow-up to tests/map-control-overlap.test.ts's 12 August collisions. Flagged this time on the
// funder dashboard, and /partners was already excluded for a related reason (see ChatWidget.tsx's
// class comment). This file covers the three routes that investigation added: /funder and /ngo
// (excluded — no fixed position is safe on either), and /invoice (repositioned — one specific
// button row at the bottom of that page's form, not a whole-page problem).

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('Studies and task guides keep Lima available without covering the reading', () => {
  const widget = source('../components/ChatWidget.tsx');
  const studies = source('../app/student/page.tsx');
  assert.match(widget, /if \(\s*\/\/[^\n]*\n\s*pathname === '\/student' \|\|[\s\S]*?\) return null;/);
  assert.match(studies, /import LimaBar from '@\/components\/LimaBar';/);
  assert.match(studies, /<LimaBar \/>/, 'help remains in the document flow instead of vanishing');
  const guide = source('../components/studies/AppGuidePage.tsx');
  assert.match(widget, /pathname\.startsWith\('\/student\/guides\/'\)/);
  assert.match(guide, /<LimaBar \/>/, 'guide readers still need an in-flow route to help');
  assert.match(guide, /useRegisterBackControl\(\)/, 'the My Studies link must suppress the duplicate floating Back');
});

test('/funder and /ngo are excluded — same class as /partners, not a farmer route', () => {
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  assert.ok(skipAt > 0, 'the exclusion block moved; this test needs rewriting rather than deleting');
  // Sliced to the real end of the condition, not a fixed 400 characters: the exclusion list grew
  // past that window when the five measured-collision routes were added, and a length guess
  // failing as the list grows reads as "/ngo stopped being excluded", which was not true.
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);

  assert.match(skipBlock, /pathname\.startsWith\('\/funder'\)/, '/funder must be excluded');
  assert.match(skipBlock, /pathname\.startsWith\('\/ngo'\)/, '/ngo must be excluded');

  // Both must actually feed the same `return null`, not just appear somewhere nearby in a
  // sibling condition that never reaches it.
  assert.match(
    skipBlock,
    /pathname\.startsWith\('\/partners'\)\s*\|\|\s*pathname\.startsWith\('\/funder'\)\s*\|\|[\s\S]*?pathname\.startsWith\('\/ngo'\)[\s\S]*?\)\s*return null;/,
    '/funder and /ngo must be OR-ed into the same return-null condition as the other exclusions',
  );

  // /farmer solved the same class of complaint by moving, not vanishing, and still does: the map
  // is exactly where a farmer wants Lima, and its 188px offset clears the "+ Add" pill.
  assert.doesNotMatch(skipBlock, /'\/farmer'/, 'the map is exactly where a farmer wants Lima — it must not be excluded');

  // /facilitator/crops USED to be pinned here as "fixed by moving the FAB". It is not: measured on
  // 24 September the right-docked FAB still covered a Gantt bar button, because that plan scrolls
  // sideways underneath it. It is excluded now and mounts LimaBar instead, so this assertion is
  // inverted rather than deleted — the fact it protects is still a fact, just the opposite one.
  assert.match(skipBlock, /pathname\.startsWith\('\/facilitator\/crops'\)/, 'the crop plan must be excluded — moving the FAB was measured to be not enough');
});

test('/funder and /ngo do NOT get a FAB_DEFAULT_POS entry — an excluded route returns before reading it', () => {
  const widget = source('../components/ChatWidget.tsx');
  const posAt = widget.indexOf('const FAB_DEFAULT_POS');
  assert.ok(posAt > 0);
  const posBlock = widget.slice(posAt, posAt + 700);
  // If a route is excluded above, giving it a branch here is dead code that hides the real
  // shape of the ternary — and the next person to read it would reasonably assume it does
  // something.
  assert.doesNotMatch(posBlock, /\/funder/, '/funder is excluded above; it should not also appear in the position ternary');
  assert.doesNotMatch(posBlock, /\/ngo/, '/ngo is excluded above; it should not also appear in the position ternary');
});

test('/invoice raises the FAB clear of the Share PDF / Print row at the bottom of the form', () => {
  const widget = source('../components/ChatWidget.tsx');

  // Measured on the live site at 375px (sample mode, invoice with a buyer + item so the row
  // enables): the Share/Print row is the last thing in that page's scroll container, at rest
  // (scrolled to the bottom — which sending an invoice requires) it sits at viewport y:[644,689].
  // The unmodified default FAB band is y:[626,682] (bottom-130px, 56px tall) — 38 of the button's
  // 45px height, and the left third of its width, is exactly where "Share PDF" sits.
  const invoiceDefault = widget.match(/pathname\.startsWith\('\/invoice'\)\s*\n?\s*\?\s*'bottom-\[(\d+)px\] (left|right)-4/);
  assert.ok(invoiceDefault, 'ChatWidget no longer gives /invoice its own default position');
  const [, bottomPxStr, side] = invoiceDefault;
  const bottomPx = Number(bottomPxStr);

  // The button's top edge sits at viewport y:644, i.e. (812 - 644) = 168px above the bottom edge.
  // The FAB must clear that with the same kind of margin the /farmer fix used ("a thumb's width
  // to spare" — map-control-overlap.test.ts), not shave it to the exact pixel.
  const BUTTON_TOP_FROM_BOTTOM = 168;
  assert.ok(
    bottomPx >= BUTTON_TOP_FROM_BOTTOM + 4,
    `/invoice's FAB offset is ${bottomPx}px, which does not clear the Share/Print row (needs >= ${BUTTON_TOP_FROM_BOTTOM + 4}px)`,
  );
  // Horizontal position is not the fix here — the row is two flex-1 buttons spanning nearly the
  // full width (16 to 356 of 375), so moving right just trades Share PDF's collision for Print's.
  // Only a raised offset clears the row; pin that the branch did not instead (or also) flip sides.
  assert.equal(side, 'left', 'moving to the right does not clear this row — it is two buttons spanning nearly the full width');

  // /invoice must not be in the exclusion list — a single button row is a repositioning problem,
  // not a whole-page one, and invoicing is exactly the kind of thing Lima should be askable about.
  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  // Sliced to the real end of the condition, not a fixed 400 characters: the exclusion list grew
  // past that window when the five measured-collision routes were added, and a length guess
  // failing as the list grows reads as "/ngo stopped being excluded", which was not true.
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);
  assert.doesNotMatch(skipBlock, /\/invoice/, 'Lima should move on the invoice builder, not disappear from it');
});

// ── 24 September: the five routes where the FAB was measured on top of content ────────────────
//
// Boxes measured against the rendered pages at 390x844, sample mode on, not inferred from source.
// The FAB is fixed 56x56 at bottom:130px, z-60, and the per-page offset table above had grown one
// page at a time while these kept overlapping:
//
//   /cropplan            a task row's 20x20 "Mark done" checkbox at (33,705) — a TAP TARGET
//   /facilitator/crops   a "Green beans (69%)" Gantt bar button, even with the right-dock offset
//   /records             the "1169.6 kg" headline and its label
//   /journal             an entry's body text
//   /calendar            the Lima seasonal-advice card the FAB itself belongs to
//
// A sixth offset would have moved each problem rather than ended it: the content under the FAB is
// mid-scroll, so there is no resting position that clears it. All five (plus /finances, which
// redirects onto /records) are excluded and mount <LimaBar /> in the document flow instead — the
// swap /student and /home had already made.
//
// The pairing is the point, and it is what this test enforces: excluded WITHOUT a LimaBar is a
// page with no route to help at all, and a LimaBar WITHOUT the exclusion is both at once.
const FLOW_HELP_ROUTES: { route: string; page: string }[] = [
  { route: '/journal', page: '../app/journal/page.tsx' },
  { route: '/calendar', page: '../app/calendar/page.tsx' },
  { route: '/cropplan', page: '../app/cropplan/page.tsx' },
  { route: '/records', page: '../app/records/page.tsx' },
  { route: '/facilitator/crops', page: '../app/facilitator/crops/page.tsx' },
];

test('every route that drops the floating FAB mounts LimaBar in its place', () => {
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  assert.ok(skipAt > 0, 'the exclusion block moved; this test needs rewriting rather than deleting');
  const skipBlock = widget.slice(skipAt, widget.indexOf(') return null;', skipAt) + ') return null;'.length);

  for (const { route, page } of FLOW_HELP_ROUTES) {
    assert.match(
      skipBlock,
      new RegExp(`pathname\\.startsWith\\('${route}'\\)`),
      `${route} must stay excluded from the floating FAB — it was measured covering content there`,
    );
    const src = source(page);
    assert.match(src, /import LimaBar from '@\/components\/LimaBar';/, `${route} must import LimaBar`);
    assert.match(src, /<LimaBar \/>/, `${route} drops the FAB, so it owes the farmer an in-flow route to help`);
  }
});

test('/finances rides on /records rather than being forgotten', () => {
  // /finances is a server-side redirect onto /records, but it is still a route a farmer reaches
  // from an installed PWA's old tab. If the FAB ever rendered there it would render over the
  // redirect, so it is excluded with the rest.
  const widget = source('../components/ChatWidget.tsx');
  assert.match(widget, /pathname\.startsWith\('\/finances'\)/);
});

test('the /facilitator/crops right-dock offset is gone, not just overridden', () => {
  // Leaving a dead branch in the offset table is how the next person concludes the page still
  // takes a FAB and re-tunes the number instead of reading the exclusion list.
  const widget = source('../components/ChatWidget.tsx');
  const posAt = widget.indexOf('const FAB_DEFAULT_POS');
  assert.ok(posAt > 0, 'FAB_DEFAULT_POS moved');
  const table = widget.slice(posAt, widget.indexOf(';', posAt));
  assert.doesNotMatch(table, /facilitator\/crops/, 'the offset branch for an excluded route is dead code');
});

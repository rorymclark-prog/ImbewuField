import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// Follow-up to tests/map-control-overlap.test.ts's 12 August collisions. Flagged this time on the
// funder dashboard, and /partners was already excluded for a related reason (see ChatWidget.tsx's
// class comment). This file covers the three routes that investigation added: /funder and /ngo
// (excluded — no fixed position is safe on either), and /invoice (repositioned — one specific
// button row at the bottom of that page's form, not a whole-page problem).

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('/funder and /ngo are excluded — same class as /partners, not a farmer route', () => {
  const widget = source('../components/ChatWidget.tsx');

  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  assert.ok(skipAt > 0, 'the exclusion block moved; this test needs rewriting rather than deleting');
  const skipBlock = widget.slice(skipAt, skipAt + 400);

  assert.match(skipBlock, /pathname\.startsWith\('\/funder'\)/, '/funder must be excluded');
  assert.match(skipBlock, /pathname\.startsWith\('\/ngo'\)/, '/ngo must be excluded');

  // Both must actually feed the same `return null`, not just appear somewhere nearby in a
  // sibling condition that never reaches it.
  assert.match(
    skipBlock,
    /pathname\.startsWith\('\/partners'\)\s*\|\|\s*pathname\.startsWith\('\/funder'\)\s*\|\|[\s\S]*?pathname\.startsWith\('\/ngo'\)[\s\S]*?\)\s*return null;/,
    '/funder and /ngo must be OR-ed into the same return-null condition as the other exclusions',
  );

  // /farmer and /facilitator/crops solved the same class of complaint by moving, not vanishing —
  // that distinction is the point of this file, so pin it the other way too.
  assert.doesNotMatch(skipBlock, /\/farmer/, 'the map is exactly where a farmer wants Lima — it must not be excluded');
  assert.doesNotMatch(skipBlock, /facilitator/, 'the crop plan must not be excluded — it was fixed by moving the FAB');
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
  const skipBlock = widget.slice(skipAt, skipAt + 400);
  assert.doesNotMatch(skipBlock, /\/invoice/, 'Lima should move on the invoice builder, not disappear from it');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { limaInMenu } from '../lib/lima-launcher.ts';

// Follow-up to tests/map-control-overlap.test.ts's 12 August collisions. Flagged this time on the
// funder dashboard, and /partners was already excluded for a related reason (see ChatWidget.tsx's
// class comment). This file covers the three routes that investigation added: /funder and /ngo
// (excluded — no fixed position is safe on either), and /invoice (help now lives in the menu
// because raising it clear of Share PDF still covered the notes field).

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

test('/invoice keeps its fields and Share PDF clear while preserving Lima help', () => {
  // The old 176px offset cleared Share PDF but covered the optional note. The September
  // browser audit confirmed more content collisions. No fixed offset can protect a scrolling
  // form, so test the menu handoff instead of pinning another corner or pixel value.
  const widget = source('../components/ChatWidget.tsx');
  const menu = source('../components/NavDrawer.tsx');
  assert.equal(limaInMenu('/invoice'), true);
  assert.match(widget, /!limaInMenu\(pathname\)/);
  assert.match(menu, /limaInMenu\(pathname\) &&/);
  assert.match(menu, /aria-label="Open Lima, your field guide"/);
  assert.match(menu, /onClose\(\); openLima\(\);/);

  // Suppressing only the launcher must not remove the chat panel itself.
  const skipAt = widget.indexOf("pathname.startsWith('/gate')");
  const skipBlock = widget.slice(skipAt, skipAt + 400);
  assert.doesNotMatch(skipBlock, /\/invoice/, 'Lima must remain available on the invoice builder');
});

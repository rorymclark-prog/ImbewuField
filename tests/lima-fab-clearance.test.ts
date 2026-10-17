import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ux-01/desk-01/staff-03 (2026-10-16 visual/UX audit): on every page without a Lima bar or tab
// bar, the floating Lima launcher (56px, fixed bottom-left, z-60) sat on top of the last button
// or line of text, because those pages gave it 0-96px of bottom padding against a FAB that
// actually needs ~202px on phone (130px offset + 56px + 16px gap) or ~180px on desktop (100px +
// 56px + 24px). Fix: ChatWidget publishes --lima-fab-clearance; pages read it for their own
// bottom padding instead of guessing a number that drifts the moment the FAB's offset changes.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('ChatWidget publishes --lima-fab-clearance sized to its own FAB geometry', () => {
  const widget = source('../components/ChatWidget.tsx');
  assert.match(
    widget,
    /setProperty\(\s*['"]--lima-fab-clearance['"]\s*,\s*`\$\{offset \+ FAB_SIZE \+ gap\}px`\s*\)/,
    'the clearance variable must be derived from the same offset/size the FAB itself uses, not a separate literal',
  );
  // Zeroed when the launcher cannot collide with anything: hidden route, open, dragging, or
  // covered by a sheet.
  assert.match(
    widget,
    /isLimaFabHiddenRoute\(pathname\)\s*\|\|\s*open\s*\|\|\s*drawing\s*\|\|\s*overlay\s*\|\|\s*fabPos/,
    'the variable must zero out exactly when the FAB itself would not render at its default spot',
  );
});

test('isLimaFabHiddenRoute mirrors the exclusion check without disturbing its pinned text', () => {
  const widget = source('../components/ChatWidget.tsx');
  // The helper must exist and must sit after the component (hoisted), so its own copy of
  // "pathname.startsWith('/login')" is never the first match tests/chat-widget-fab-overlap.test.ts
  // searches for — that earlier draft of this fix broke that file's string-slicing assertions.
  const helperAt = widget.indexOf('function isLimaFabHiddenRoute');
  const realIfAt = widget.indexOf("pathname.startsWith('/login')");
  assert.ok(helperAt > 0 && realIfAt > 0 && helperAt > realIfAt, 'the helper must be declared after the real exclusion check, not before it');
});

test('ChatWidget computes a mobile offset that actually clears the FAB band (>= 202px default)', () => {
  const widget = source('../components/ChatWidget.tsx');
  const m = widget.match(/const offset = desktop \? (\d+) : pathname\.startsWith\('\/farmer'\) \? (\d+) : pathname\.startsWith\('\/invoice'\) \? (\d+) : (\d+);/);
  assert.ok(m, 'clearance offset ternary not found or changed shape');
  const [, desktop, farmerOffset, invoiceOffset, defaultOffset] = m.map(Number);
  const GAP_MOBILE = 16;
  assert.ok(defaultOffset + 56 + GAP_MOBILE >= 202, 'default mobile clearance must clear the 130+56px FAB band with margin');
  assert.ok(farmerOffset + 56 + GAP_MOBILE >= 260, '/farmer clearance must clear its own 188+56px FAB band with margin');
  assert.ok(invoiceOffset + 56 + GAP_MOBILE >= 248, '/invoice clearance must clear its own 176+56px FAB band with margin');
  assert.ok(desktop > 0, 'a desktop offset must exist');
});

for (const [label, rel] of [
  ['tour/tips shared chrome', '../components/ProductTour.module.css'],
] as const) {
  test(`${label} reads --lima-fab-clearance for its bottom padding`, () => {
    const css = source(rel);
    assert.match(css, /var\(--lima-fab-clearance/, `${rel} must read the published clearance variable`);
  });
}

for (const [label, rel] of [
  ['/offline', '../app/offline/page.tsx'],
  ['/manual/[lang]', '../app/manual/[lang]/page.tsx'],
  ['/samples', '../app/samples/page.tsx'],
  ['/samples/gardens', '../app/samples/gardens/page.tsx'],
  ['/samples/farm', '../app/samples/farm/page.tsx'],
] as const) {
  test(`${label} reads --lima-fab-clearance for its bottom padding`, () => {
    const page = source(rel);
    assert.match(page, /var\(--lima-fab-clearance/, `${rel} must read the published clearance variable`);
  });
}

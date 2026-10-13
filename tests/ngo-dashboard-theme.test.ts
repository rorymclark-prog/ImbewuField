// a11y-04 — the NGO role was "half dark" in dark mode: app/ngo/page.tsx's role-gate card, header
// title and view tabs, and almost every surface/text colour in components/NgoDashboard.tsx
// (stat tiles, the map legend/overlay chips, the detail/gardener panel, error and empty states)
// were hardcoded light-mode hex, so they stayed bright paper and dark-on-dark against a dark
// theme. Routed the surfaces and text through the existing var(--bg-1/2/3), var(--border),
// var(--text-primary/muted) and var(--color-forest-700/800) tokens, and the one forest-fill +
// white-text badge through the same var(--color-forest-800) + var(--color-canvas) pairing used
// elsewhere in this wave. Deliberately left alone: the STATUS/crop category swatches (fixed,
// non-themed accent colours by design, same precedent as the Exchange board's KIND_COLOR) and
// the white rings on map markers drawn over satellite imagery.
//
// This is a flat text scan, not a render test — it can't see contrast, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

// Deliberately-literal exceptions: fixed category/status swatches, crop colour swatches, the
// swatch tint constant, and the white rings on map markers (drawn over satellite imagery, not
// the app's own chrome).
const DASHBOARD_ALLOWED_HEX = new Set([
  '#1F4D2B', '#9E5C08', '#C0531E', // STATUS swatches
  '#3F7A3C', '#B83C2E', '#6BA84F', '#C97A2C', '#C2A05A', '#D9B23A',
  '#7A5230', '#CC7A28', '#A85E3C', '#3F8B3C', // crop swatches
  '#755942', // NEUTRAL_PRODUCE_TINT
  '#fff', // marker rings
  '#c6cfbf', // minor select-input border tint, outside this track's scope
]);

test('app/ngo/page.tsx role-gate card, header title and tabs follow the theme', () => {
  const src = read('app/ngo/page.tsx');
  for (const hex of ['#FFFEFA', '#E2D8C4', '#20190F', '#506158', '#5C5040', '#1F4D2B', '#F7F2E9']) {
    assert.ok(!src.includes(hex), `${hex} should be gone from app/ngo/page.tsx`);
  }
  assert.match(src, /color:\s*'var\(--color-forest-800\)'/);
  assert.match(src, /background:\s*'var\(--color-forest-800\)',\s*color:\s*'var\(--color-canvas\)'/);
});

test('components/NgoDashboard.tsx surfaces and text follow the theme outside the deliberate swatch exceptions', () => {
  const src = read('components/NgoDashboard.tsx');
  const found = [...src.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0]);
  const unexpected = found.filter((hex) => !DASHBOARD_ALLOWED_HEX.has(hex));
  assert.deepEqual(
    unexpected,
    [],
    unexpected.length
      ? `Found hard-coded hex colour(s) outside the allowlist: ${unexpected.join(', ')}`
      : undefined,
  );
});

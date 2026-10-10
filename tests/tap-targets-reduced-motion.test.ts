// a11y-08 (remainder) — report toolbar/sidebar/reading-controls buttons in components/ReportView.tsx
// already clear 44px via the existing `.toolbar button, .sidebar button, .readingControls button`
// rule in components/ReportView.module.css; the map's native-edit Undo/Rename/Delete/Finish
// buttons (components/Map.tsx ~3306-3327) and the Appearance panel's PillToggle switch
// (components/ThemePanel.tsx) and the ProfileSheet close button (components/ProfileSheet.tsx:288)
// did not, and are fixed here — the toggle via the existing `.u-tap-target` invisible-hit-area
// convention (growing the hit area without growing the painted pill), the rest via a plain
// minHeight: 44.
//
// a11y-13 — app/globals.css's prefers-reduced-motion block only ever covered three named
// animations. Added a global `*, *::before, *::after` safety net alongside it.
//
// This is a flat text scan, not a render test — it can't measure a live layout, only source.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (rel: string) => readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');

test('the map native-edit toolbar buttons (Undo/Rename/Delete/Finish) clear the 44px floor', () => {
  const src = read('components/Map.tsx');
  assert.equal((src.match(/minHeight: 32/g) ?? []).length, 3, 'only the three non-interactive status chips should stay at 32px');
  assert.ok((src.match(/minHeight: 44/g) ?? []).length >= 5, 'the Cancel, Undo, Rename, Delete and Finish buttons should all clear 44px');
  // Both native-edit "Finish" buttons (direct_select mode and the reticle-edit toolbar) used the
  // literal forest-fill/on-forest-text pairing this wave converted elsewhere to the themed
  // var(--color-forest-800) + var(--color-canvas) tokens — not a full-file sweep of every
  // '#1F4D2B' in this ~4000-line component, which is out of this track's scope.
  assert.match(src, /background: 'var\(--color-forest-800\)', border: '1px solid rgba\(31,77,43,0\.6\)', color: 'var\(--color-canvas\)'/);
  assert.doesNotMatch(src, /background: '#1F4D2B', border: '1px solid rgba\(31,77,43,0\.6\)', color: '#F7F2E9'/);
});

test('the Appearance panel toggle switch grows its hit area without growing the painted pill', () => {
  const src = read('components/ThemePanel.tsx');
  assert.match(src, /className="u-tap-target"[\s\S]{0,300}'--tap-inset':\s*'-8px'/);
});

test('the ProfileSheet close button clears the 44px touch-target floor', () => {
  const src = read('components/ProfileSheet.tsx');
  const closeButtonIndex = src.indexOf('aria-label="Close"');
  assert.ok(closeButtonIndex > -1);
  const nearby = src.slice(closeButtonIndex, closeButtonIndex + 200);
  assert.match(nearby, /width:\s*44,\s*\n\s*height:\s*44,/);
});

test('app/globals.css carries a global prefers-reduced-motion safety net alongside the named overrides', () => {
  const src = read('app/globals.css');
  assert.match(
    src,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\*, \*::before, \*::after \{\s*animation-duration: 0\.01ms !important;\s*animation-iteration-count: 1 !important;\s*transition-duration: 0\.01ms !important;\s*scroll-behavior: auto !important;\s*\}/,
  );
  // The pre-existing targeted overrides must still be present and still win (higher specificity
  // than the universal selector above) for the two cases that want a specific replacement
  // rather than an abrupt stop.
  assert.match(src, /\.u-anim-sheet, \.u-anim-sheet\.u-anim-dialog \{ animation: u-fadeIn var\(--dur-base\) linear !important; \}/);
});

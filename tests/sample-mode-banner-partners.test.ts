import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// sdesk-09/staff-14 (2026-10-16 visual/UX audit): /partners has no MenuButton (same showcase-page
// convention as /pitch — see the file's own top-of-file comment), so SampleModeBanner's fixed
// top-right "Tour" pill rendered on top of that page's own top-right "Get the app" button, in
// both the desktop and phone header, in light and dark. Fixed the same way /pitch already was:
// suppress the pill on that route rather than try to offset it under a header it cannot see.

const banner = readFileSync(new URL('../components/SampleModeBanner.tsx', import.meta.url), 'utf8');

test('SampleModeBanner skips /partners — same showcase-page class as /pitch', () => {
  const guardAt = banner.indexOf('if (!active');
  assert.ok(guardAt > 0, 'the render guard moved; this test needs rewriting rather than deleting');
  const guard = banner.slice(guardAt, banner.indexOf(') return null;', guardAt) + ') return null;'.length);
  assert.match(guard, /pathname\.startsWith\('\/pitch'\)/, '/pitch must stay excluded');
  assert.match(guard, /pathname\.startsWith\('\/partners'\)/, '/partners must be excluded — it has no MenuButton, so nothing offsets the pill from its own header CTA');
});

test('the pill is still suppressed by having a page-local MenuButton, not an unconditional hide', () => {
  // Regression guard: the fix must add to the exclusion, not replace the hasMenu check (which is
  // how every normal in-app page already avoids a duplicate "Tour" control next to MenuButton's
  // own indicator).
  assert.match(banner, /hasMenu\) return null;/);
});

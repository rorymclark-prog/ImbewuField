import assert from 'node:assert/strict';
import test from 'node:test';

import nextConfig from '../next.config.mjs';

// There were no baseline HTTP security headers on this app at all before this. Pin the four that
// were added, and pin that geolocation/camera — which the map and photo-capture features need —
// stay permitted for the app's own origin rather than getting swept up in "deny everything".

test('headers() applies the baseline security headers to every route', async () => {
  const headersFn = nextConfig.headers;
  assert.equal(typeof headersFn, 'function', 'next.config.mjs must export an async headers()');

  const rules = await headersFn!();
  assert.ok(Array.isArray(rules) && rules.length > 0, 'headers() must return at least one rule');

  const rule = rules.find((r) => r.source === '/:path*');
  assert.ok(rule, 'a rule must apply to every route');

  const byKey = Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));

  assert.equal(byKey['X-Frame-Options'], 'SAMEORIGIN');
  assert.equal(byKey['X-Content-Type-Options'], 'nosniff');
  assert.equal(byKey['Referrer-Policy'], 'strict-origin-when-cross-origin');

  assert.ok(byKey['Permissions-Policy'], 'Permissions-Policy must be set');
  assert.match(byKey['Permissions-Policy'], /geolocation=\(self\)/, 'the map needs geolocation on this origin');
  assert.match(byKey['Permissions-Policy'], /camera=\(self\)/, 'photo capture needs the camera on this origin');

  // No Content-Security-Policy in this PR — left as a documented follow-up rather than risking
  // Mapbox/fonts/images breakage from a guessed allowlist.
  assert.equal(byKey['Content-Security-Policy'], undefined);
});

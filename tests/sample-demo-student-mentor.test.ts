// The gap this closes: PR #372 exempted sample mode from the /funder and /ngo login
// bounce (tests/sample-demo-dashboards.test.ts), but the same "no user by design" shape
// exists on /student and /mentor and was never swept. Repro on production (never visible
// in local dev without Firebase env vars, where !fb makes everything demo already):
// enter sample mode from the landing page, tap the "Study — Permaculture course" tile on
// /home, land on /student, get bounced straight to /login with the sample banner still
// showing. Same for /mentor. This file pins both fixes as source shape, mirroring
// tests/sample-demo-dashboards.test.ts's own login-bounce test.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/sample-demo-student-mentor.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const student = readFileSync(new URL('../app/student/page.tsx', import.meta.url), 'utf8');
const mentor = readFileSync(new URL('../app/mentor/page.tsx', import.meta.url), 'utf8');

test('/student and /mentor stay reachable in sample mode instead of bouncing to /login', () => {
  for (const [name, src] of [['student', student], ['mentor', mentor]] as const) {
    assert.match(src, /import \{ isSampleMode \} from '@\/lib\/sample-mode';/,
      `${name}: must import isSampleMode to exempt it`);
    assert.match(src, /if \(!loading && !user && isLive && !isSampleMode\(\)\) router\.replace\('\/login'\);/,
      `${name}: the login bounce must exempt sample mode`);
  }
});

test('/student does not trade the login bounce for an infinite spinner in sample mode', () => {
  // /student has a second gate /funder and /ngo don't: a render-time "auth resolving or
  // user absent" block that renders a spinner instead of the page. Exempting only the
  // redirect above would swap one dead end (login) for another (a spinner that never
  // clears, because sample mode's user is null forever by design) — see the identical
  // shape already fixed at app/farmer/page.tsx's `isBackendConfigured() && (authLoading
  // || !user) && !isSampleMode()` gate.
  assert.match(student, /if \(isLive && \(loading \|\| !user\) && !isSampleMode\(\)\) \{/,
    'the render-time loading/user gate must also exempt sample mode');
});

test('mentor has no second loading/user gate to independently exempt', () => {
  // Documents the asymmetry so a future edit that adds one to mentor.tsx does not
  // silently reopen this bug class the way the redirect-only fix would have.
  assert.doesNotMatch(mentor, /\(loading \|\| !user\)/,
    'mentor.tsx grew a render-time loading/user gate — give it the same !isSampleMode() exemption as /student, then update this test');
});

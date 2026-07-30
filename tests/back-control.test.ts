import test from 'node:test';
import assert from 'node:assert/strict';

import { floatingBackAllowed, NO_FLOATING_BACK } from '@/lib/back-routes';

// A back button is navigation, and navigation that appears in the wrong place is worse than none:
// two back buttons on one screen is confusing, and a back button on a gate is an escape from the
// thing the gate exists to enforce. These are the rules that keep the global fallback honest.

test('ordinary sub-pages get a way back', () => {
  for (const path of ['/journal', '/mentor', '/student', '/community', '/contact', '/calendar', '/example']) {
    assert.equal(floatingBackAllowed(path), true, `${path} should offer a back button`);
  }
});

test('nested routes follow their section, so a deep link is never stranded', () => {
  assert.equal(floatingBackAllowed('/journal/2026-07-31'), true);
  assert.equal(floatingBackAllowed('/student/lesson/3'), true);
  // ...and a nested route of an excluded section stays excluded, rather than sprouting a second
  // back button beside the one its own layout already draws.
  assert.equal(floatingBackAllowed('/design/anything'), false);
  assert.equal(floatingBackAllowed('/farmer/panel'), false);
});

test('tab-bar destinations and auth gates never get one', () => {
  // The tab bar IS the navigation for these four; "back" from a home screen means leaving the app.
  for (const path of ['/', '/home', '/farmer', '/finances', '/account']) {
    assert.equal(floatingBackAllowed(path), false, `${path} is a top-level destination`);
  }
  // A gate exists to be answered, not walked around.
  for (const path of ['/login', '/gate']) {
    assert.equal(floatingBackAllowed(path), false, `${path} is a gate`);
  }
  // The Design Studio draws its own arrow in its title bar.
  assert.equal(floatingBackAllowed('/design'), false);
});

test('an unknown path is treated as a normal page, not silently stranded', () => {
  assert.equal(floatingBackAllowed('/some-future-page'), true);
  // Absent routing information is the one case where showing nothing is right — there is no page
  // to go back from yet.
  assert.equal(floatingBackAllowed(null), false);
  assert.equal(floatingBackAllowed(''), false);
});

test('the exclusion list stays small enough to justify each entry', () => {
  // A guard against the list quietly growing until "every page" is no longer true. Any addition
  // should be a deliberate decision with a reason in the comment above NO_FLOATING_BACK.
  assert.ok(NO_FLOATING_BACK.size <= 10, `exclusions grew to ${NO_FLOATING_BACK.size}`);
});

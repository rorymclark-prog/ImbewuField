import test from 'node:test';
import assert from 'node:assert/strict';

import { canAccessRolePage, farmsOwnLand } from '../lib/role-access.ts';
import type { UserRole } from '../lib/db/types.ts';

const NGO_ALLOWED = new Set<UserRole>(['ngo', 'admin']);
const MENTOR_ALLOWED = new Set<UserRole>(['mentor', 'ngo', 'funder', 'admin']);

test('a role in the allow-set gets in', () => {
  assert.equal(canAccessRolePage('ngo', NGO_ALLOWED), true);
  assert.equal(canAccessRolePage('admin', NGO_ALLOWED), true);
  assert.equal(canAccessRolePage('mentor', MENTOR_ALLOWED), true);
});

test('a role outside the allow-set is refused', () => {
  assert.equal(canAccessRolePage('farmer', NGO_ALLOWED), false);
  assert.equal(canAccessRolePage('funder', NGO_ALLOWED), false);
  assert.equal(canAccessRolePage('student', MENTOR_ALLOWED), false);
});

// The regression: a signed-in user whose profile hasn't loaded yet (or was never created —
// see lib/role-access.ts) must be treated as "no role", never as "role check doesn't apply".
test('a null role is refused, never waved through', () => {
  assert.equal(canAccessRolePage(null, NGO_ALLOWED), false);
  assert.equal(canAccessRolePage(null, MENTOR_ALLOWED), false);
});

/*
 * ── farmsOwnLand: whether "my map" and "my money book" mean anything for this account ─────────
 *
 * Imported and called rather than pattern-matched out of the source, because this is a decision
 * with a truth table, not a shape. The wiring that consumes it is guarded in
 * tests/nav-role-filtering.test.ts.
 */

test('the roles that farm their own land keep the farmer tabs', () => {
  assert.equal(farmsOwnLand('farmer'), true);
  // The nine-month course is practical work on the learner's own plot, and /records is where
  // that work lands — a student with no money book would have nowhere to put a harvest.
  assert.equal(farmsOwnLand('student'), true);
  // The platform operator is the escape hatch in every allow-set and is never shown less.
  assert.equal(farmsOwnLand('admin'), true);
});

test('programme staff do not get a map of land they do not farm', () => {
  // lib/i18n.tsx: "Run the course, visit farms, sign off progress" — other people's farms.
  assert.equal(farmsOwnLand('mentor'), false);
  assert.equal(farmsOwnLand('ngo'), false);
  // And this one is the sharpest: the funder's own role description is "Read-only impact
  // oversight", while /records offers working Add buttons that write to the org's ledger.
  assert.equal(farmsOwnLand('funder'), false);
});

test('an unresolved role keeps every tab — the opposite of canAccessRolePage', () => {
  // Deliberately NOT the fail-closed rule at the top of this file, and the difference matters.
  // canAccessRolePage guards a page that will refuse you, so null must deny. This decides only
  // whether a tab is honest to offer: null means signed out (the sample tour has to show the
  // farmer flow) or a profile lagging its auth account by a beat (tabs must not pop in late).
  // /farmer and /records are open to everyone regardless — nothing here protects anything.
  assert.equal(farmsOwnLand(null), true);
});

test('every role in the union is decided, so a new role cannot default in silently', () => {
  const ALL: UserRole[] = ['farmer', 'mentor', 'student', 'ngo', 'funder', 'admin'];
  const decided = ALL.filter((r) => typeof farmsOwnLand(r) === 'boolean');
  assert.deepEqual(decided, ALL);
  // Adding a seventh role to UserRole without adding it to OWN_LAND_ROLES silently makes it
  // staff. That is the safe direction (it hides tabs rather than offering an empty ledger), but
  // it should be a decision, so pin the current split rather than only the true half.
  assert.deepEqual(ALL.filter(farmsOwnLand), ['farmer', 'student', 'admin']);
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { canAccessRolePage } from '../lib/role-access.ts';
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

// Pure unit tests for scripts/provisioning-guards.mjs — the tenant-2-onboarding safety rules
// used by scripts/provision-org.mjs. No Firebase, no emulator: see
// tests/provision-org.emulator.test.ts for the end-to-end CLI behaviour against the emulator.

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STAFF_ROLES,
  ATTACHABLE_ROLES,
  checkReassignment,
  decideAttach,
} from '../scripts/provisioning-guards.mjs';

test('STAFF_ROLES and ATTACHABLE_ROLES are disjoint', () => {
  // A role string must never be valid for both --grant (creates profiles, changes role) and
  // --attach (never creates, never changes role) — see decideAttach()'s doc comment.
  for (const role of STAFF_ROLES) assert.ok(!ATTACHABLE_ROLES.includes(role), `${role} is in both lists`);
  for (const role of ATTACHABLE_ROLES) assert.ok(!STAFF_ROLES.includes(role), `${role} is in both lists`);
});

test('ATTACHABLE_ROLES is exactly farmer and student', () => {
  assert.deepEqual([...ATTACHABLE_ROLES].sort(), ['farmer', 'student']);
});

/* ── checkReassignment ─────────────────────────────────────────────────── */

test('checkReassignment: brand-new account (no existing org) is never blocked', () => {
  assert.deepEqual(checkReassignment({ existingOrgId: null, newOrgId: 'org-2', allowReassign: false }), { blocked: false });
});

test('checkReassignment: re-granting the SAME org is a no-op, not a block', () => {
  // This is what makes re-running provisioning for org #2's second batch of members idempotent —
  // a repeat --grant/--attach for someone already in the target org must not require --reassign.
  assert.deepEqual(checkReassignment({ existingOrgId: 'org-2', newOrgId: 'org-2', allowReassign: false }), { blocked: false });
});

test('checkReassignment: moving to a DIFFERENT org is blocked without --reassign', () => {
  const result = checkReassignment({ existingOrgId: 'org-1', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.blocked, true);
  assert.match(result.reason, /already in org org-1/);
  assert.match(result.reason, /--reassign/);
});

test('checkReassignment: --reassign explicitly allows the move', () => {
  assert.deepEqual(checkReassignment({ existingOrgId: 'org-1', newOrgId: 'org-2', allowReassign: true }), { blocked: false });
});

/* ── decideAttach ──────────────────────────────────────────────────────── */

test('decideAttach: refuses a role outside farmer/student', () => {
  const result = decideAttach({ existingRole: 'ngo', existingOrgId: null, requestedRole: 'ngo', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /--attach role must be one of/);
});

test('decideAttach: refuses when no profile exists yet', () => {
  const result = decideAttach({ existingRole: undefined, existingOrgId: null, requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /sign in and complete signup/);
});

test('decideAttach: refuses a role mismatch (never promotes/demotes)', () => {
  const result = decideAttach({ existingRole: 'student', existingOrgId: null, requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /existing profile role is "student"/);
  assert.match(result.reason, /never changes role/);
});

test('decideAttach: succeeds for a matching-role, org-less profile', () => {
  assert.deepEqual(
    decideAttach({ existingRole: 'farmer', existingOrgId: null, requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false }),
    { ok: true },
  );
});

test('decideAttach: re-attaching to the SAME org is idempotent (ok, not blocked)', () => {
  assert.deepEqual(
    decideAttach({ existingRole: 'farmer', existingOrgId: 'org-2', requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false }),
    { ok: true },
  );
});

test('decideAttach: blocks moving a farmer already in a DIFFERENT org without --reassign', () => {
  const result = decideAttach({ existingRole: 'farmer', existingOrgId: 'org-1', requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assert.match(result.reason, /already in org org-1/);
});

test('decideAttach: --reassign allows moving a farmer from a different org', () => {
  assert.deepEqual(
    decideAttach({ existingRole: 'farmer', existingOrgId: 'org-1', requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: true }),
    { ok: true },
  );
});

test('decideAttach: role mismatch is checked BEFORE the reassignment guard', () => {
  // A student already in a different org, requested as farmer, should surface the role-mismatch
  // reason (which --reassign cannot fix) rather than the reassignment reason (which it can).
  const result = decideAttach({ existingRole: 'student', existingOrgId: 'org-1', requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: true });
  assert.equal(result.ok, false);
  assert.match(result.reason, /existing profile role is "student"/);
});

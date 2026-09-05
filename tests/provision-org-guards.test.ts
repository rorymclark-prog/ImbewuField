// Pure unit tests for scripts/provisioning-guards.mjs — the tenant-2-onboarding safety rules
// used by scripts/provision-org.mjs. No Firebase, no emulator: see
// tests/provision-org.emulator.test.ts for the end-to-end CLI behaviour against the emulator.

import assert from 'node:assert/strict';
import test from 'node:test';
import { emailDigest, findOwnerAccount, verifyOwnerAccount } from '../scripts/provision-platform-owner.mjs';
import { configureProductionAuth, PRODUCTION_AUTH_DOMAINS } from '../scripts/configure-production-auth.mjs';
import {
  STAFF_ROLES,
  ATTACHABLE_ROLES,
  checkReassignment,
  decideAttach,
} from '../scripts/provisioning-guards.mjs';

test('production auth repair preserves existing domains and patches no other setting', async () => {
  const original = ['fieldproof-sa.firebaseapp.com', 'existing.example.test'];
  let domains = [...original];
  const writes: { path: string; body: unknown }[] = [];
  const request = async (method: string, path: string, body?: { authorizedDomains: string[] }) => {
    if (path.includes('google.com')) return { enabled: true, clientSecret: 'must-not-be-output' };
    if (method === 'PATCH') {
      writes.push({ path, body });
      domains = body!.authorizedDomains;
    }
    return { authorizedDomains: [...domains], signIn: { allowDuplicateEmails: false } };
  };
  const dry = await configureProductionAuth({ request });
  assert.deepEqual(dry.missingBefore, PRODUCTION_AUTH_DOMAINS);
  assert.equal(writes.length, 0, 'a dry run must not change production configuration');
  assert.equal(JSON.stringify(dry).includes('must-not-be-output'), false);
  const applied = await configureProductionAuth({ request, apply: true });
  assert.equal(applied.verified, true);
  assert.deepEqual(writes, [{ path: '/config?updateMask=authorizedDomains',
    body: { authorizedDomains: [...original, ...PRODUCTION_AUTH_DOMAINS] } }]);
  assert.equal((await configureProductionAuth({ request, apply: true })).status, 'already-configured');
  assert.equal(writes.length, 1, 'retry must be a no-op once production domains are authorised');
});

test('auth repair refuses a disabled provider and detects an unsuccessful config write', async () => {
  await assert.rejects(configureProductionAuth({ request: async () => ({ enabled: false }), apply: true }), /PROVIDER_NOT_ENABLED/);
  const request = async (_method: string, path: string) => path.includes('google.com')
    ? { enabled: true } : { authorizedDomains: ['fieldproof-sa.firebaseapp.com'] };
  await assert.rejects(configureProductionAuth({ request, apply: true }), /READBACK_FAILED/);
});

test('owner bootstrap requires the exact verified, enabled identity', () => {
  const digest = emailDigest('owner@example.test');
  const owner = { uid: 'owner', email: 'Owner@Example.Test', emailVerified: true, disabled: false };
  assert.doesNotThrow(() => verifyOwnerAccount(owner, digest));
  assert.throws(() => verifyOwnerAccount({ ...owner, email: 'another@example.test' }, digest), /IDENTITY_MISMATCH/);
  assert.throws(() => verifyOwnerAccount({ ...owner, disabled: true }, digest), /ACCOUNT_DISABLED/);
  assert.throws(() => verifyOwnerAccount({ ...owner, emailVerified: false }, digest), /EMAIL_NOT_VERIFIED/);
});

test('owner lookup follows pagination, retains only the match, and rechecks current identity', async () => {
  const owner = { uid: 'target', email: 'owner@example.test', emailVerified: true, disabled: false };
  const tokens: unknown[] = [];
  const auth = {
    listUsers: async (_size: number, token?: string) => {
      tokens.push(token);
      return token ? { users: [owner] } : { users: [{ uid: 'other', email: 'other@example.test' }], pageToken: 'next' };
    },
    getUser: async (uid: string) => { assert.equal(uid, 'target'); return owner; },
  };
  assert.deepEqual(await findOwnerAccount(auth, emailDigest(owner.email)), owner);
  assert.deepEqual(tokens, [undefined, 'next']);
  await assert.rejects(findOwnerAccount(auth, emailDigest('missing@example.test')), /ACCOUNT_NOT_FOUND/);
  await assert.rejects(findOwnerAccount({ ...auth, getUser: async () => ({ ...owner, disabled: true }) }, emailDigest(owner.email)), /ACCOUNT_DISABLED/);
});

// scripts/provisioning-guards.mjs is plain JS (allowJs, not checkJs — see tsconfig.json), so
// TS infers each guard's return type as a union where `reason` only exists on the blocked/
// not-ok branch. assert.equal(...) does not narrow that union, so every call site accessing
// `.reason` needs it already narrowed to `string` — this helper does that once, asserting the
// shape at runtime rather than casting past the type checker.
function assertReasonMatches(result: { reason?: string }, pattern: RegExp): void {
  assert.equal(typeof result.reason, 'string', 'expected a reason string');
  assert.match(result.reason as string, pattern);
}

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
  assertReasonMatches(result, /already in org org-1/);
  assertReasonMatches(result, /--reassign/);
});

test('checkReassignment: --reassign explicitly allows the move', () => {
  assert.deepEqual(checkReassignment({ existingOrgId: 'org-1', newOrgId: 'org-2', allowReassign: true }), { blocked: false });
});

/* ── decideAttach ──────────────────────────────────────────────────────── */

test('decideAttach: refuses a role outside farmer/student', () => {
  const result = decideAttach({ existingRole: 'ngo', existingOrgId: null, requestedRole: 'ngo', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assertReasonMatches(result, /--attach role must be one of/);
});

test('decideAttach: refuses when no profile exists yet', () => {
  const result = decideAttach({ existingRole: undefined, existingOrgId: null, requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assertReasonMatches(result, /sign in and complete signup/);
});

test('decideAttach: refuses a role mismatch (never promotes/demotes)', () => {
  const result = decideAttach({ existingRole: 'student', existingOrgId: null, requestedRole: 'farmer', newOrgId: 'org-2', allowReassign: false });
  assert.equal(result.ok, false);
  assertReasonMatches(result, /existing profile role is "student"/);
  assertReasonMatches(result, /never changes role/);
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
  assertReasonMatches(result, /already in org org-1/);
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
  assertReasonMatches(result, /existing profile role is "student"/);
});

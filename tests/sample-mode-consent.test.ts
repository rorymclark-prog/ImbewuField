// The demo-killer: ConsentPanel.tsx's toggle() does
// `setConsent(await setMyConsentScope(scope, next))`. In sample mode, getMyConsent /
// setMyConsentScope / revokeAllMyConsent (lib/db/queries.ts) each used to do a bare
// `if (isSampleMode()) return null;` — RESOLVING null, never rejecting. So the very first
// switch a person flipped on the anonymous "try the sample farm" demo (/account, reachable
// there via the demo profile in lib/demo-farm.ts) set React state to null, and every row
// rendered unchecked — hasConsent(null, scope) is false for all six scopes at once. The
// component's own error-recovery path (see its catch block) never fired, because nothing
// threw: this was a silent, "successful" wipe.
//
// The fix routes the three consent queries through the same typed sandbox pattern every
// other Firestore-backed view already uses in sample mode (lib/sample-mode.ts) instead of
// returning null. This file pins the query-layer contract that matters to ConsentPanel:
// sample mode never resolves null, and a toggle survives being read back — i.e. it holds
// exactly like the panel demonstrates on a re-open, not just in the one render that set it.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/sample-mode-consent.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';

// lib/sample-mode.ts patches Storage.prototype at module-evaluation time, so Storage and
// window must exist BEFORE that module (or anything importing it, like lib/db/queries.ts)
// is first loaded — hence globals set up here first and both modules dynamically imported
// afterwards. Mirrors tests/sample-mode.test.ts's own setup.
class MemoryStorage {
  readonly rows = new Map<string, string>();
  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(String(key)) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(String(key), String(value)); }
  removeItem(key: string): void { this.rows.delete(String(key)); }
  clear(): void { this.rows.clear(); }
}

Object.defineProperty(globalThis, 'Storage', { configurable: true, value: MemoryStorage });

const realLocal = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & {
  localStorage: MemoryStorage;
  sessionStorage: MemoryStorage;
};
browser.localStorage = realLocal;
browser.sessionStorage = session;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: realLocal });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const sample = await import('../lib/sample-mode.ts');
const queries = await import('../lib/db/queries.ts');
const { CONSENT_SCOPES, hasConsent } = await import('../lib/consent.ts');

function reset(): void {
  sample.exitSampleMode();
  realLocal.rows.clear();
  session.rows.clear();
  assert.equal(sample.enterSampleMode(), true, 'test setup: sample mode must enter cleanly');
}

test('getMyConsent never resolves null in sample mode', async () => {
  reset();
  const consent = await queries.getMyConsent();
  assert.notEqual(consent, null, 'a null consent renders every ConsentPanel row unchecked');
  assert.equal(typeof consent, 'object');
  // A real, coherent record — not a stub: matches the demo profile's own identity, and
  // starts with nothing granted (the same default a real farmer's first visit gets).
  assert.equal(consent!.uid, 'demo');
  assert.equal(consent!.org_id, 'demo-org-ubhejane');
  assert.equal(consent!.revoked_at, null);
  for (const { id } of CONSENT_SCOPES) assert.equal(hasConsent(consent, id), false);
});

test('setMyConsentScope never resolves null, and the grant round-trips on read-back', async () => {
  reset();
  const afterGrant = await queries.setMyConsentScope('sales', true);
  assert.notEqual(afterGrant, null);
  assert.equal(hasConsent(afterGrant, 'sales'), true);
  // The bug was specifically that the state did not survive being re-read — closing and
  // reopening the panel calls getMyConsent() again, which must see the SAME grant.
  const reread = await queries.getMyConsent();
  assert.notEqual(reread, null);
  assert.equal(hasConsent(reread, 'sales'), true, 'the grant must survive a re-open of the panel');
  // Other scopes are untouched by one toggle.
  assert.equal(hasConsent(reread, 'expenses'), false);
});

test('a scope can be granted then withdrawn, independently of the others', async () => {
  reset();
  await queries.setMyConsentScope('training', true);
  await queries.setMyConsentScope('surveys', true);
  const afterWithdraw = await queries.setMyConsentScope('training', false);
  assert.notEqual(afterWithdraw, null);
  assert.equal(hasConsent(afterWithdraw, 'training'), false);
  assert.equal(hasConsent(afterWithdraw, 'surveys'), true, 'withdrawing one scope must not touch another');
});

test('revokeAllMyConsent never resolves null and withdraws every scope at once', async () => {
  reset();
  await queries.setMyConsentScope('sales', true);
  await queries.setMyConsentScope('location', true);
  const revoked = await queries.revokeAllMyConsent();
  assert.notEqual(revoked, null);
  for (const { id } of CONSENT_SCOPES) assert.equal(hasConsent(revoked, id), false);
  const reread = await queries.getMyConsent();
  assert.notEqual(reread, null);
  for (const { id } of CONSENT_SCOPES) assert.equal(hasConsent(reread, id), false, 'revocation must survive a re-open too');
});

test('the sandbox consent is private to sample mode and resets on re-entry', async () => {
  reset();
  await queries.setMyConsentScope('production', true);
  sample.exitSampleMode();
  assert.equal(sample.enterSampleMode(), true);
  const fresh = await queries.getMyConsent();
  assert.notEqual(fresh, null);
  assert.equal(hasConsent(fresh, 'production'), false, 'a new sample session must not inherit a previous one\'s edits');
});

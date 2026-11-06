import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { bindSiteContext, createSiteCountryContext, type SiteContextPlace } from '../lib/international/site-context.ts';
import { resolvePlanningSupport } from '../lib/international/planning-policy.ts';
import { LOCAL_ADVICE_CODES, type LocalAdviceDecision, type LocalAdvicePolicyInput } from '../lib/local-advice-types.ts';

const owner = 'local-advice-owner';
const point = { lat: 0.123456, lon: 0.654321 };
const siteId = `site:${point.lat.toFixed(5)},${point.lon.toFixed(5)}`;
const probe = { reads: [] as string[], stores: new Map<string, unknown>(), failRead: false };
const db = {
  collection(name: string) {
    assert.equal(name, 'user_map_data');
    return {
      doc(uid: string) {
        return {
          collection(child: string) {
            assert.equal(child, 'data');
            return {
              doc(id: string) {
                assert.equal(id, 'places');
                return {
                  async get() {
                    probe.reads.push(uid);
                    if (probe.failRead) throw Error('Controlled unavailable saved places');
                    return { exists: probe.stores.has(uid), data: () => ({ places: probe.stores.get(uid) }) };
                  },
                };
              },
            };
          },
        };
      },
    };
  },
};
Object.assign(probe, { db });
Object.assign(globalThis, { __localAdvicePolicyProbe: probe });
const moduleUrl = (code: string) => 'data:text/javascript,' + encodeURIComponent(code);
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === 'firebase-admin/app') return { shortCircuit: true,
    url: moduleUrl('export const getApps=()=>[{}];export const getApp=()=>({});export const initializeApp=()=>({});') };
  if (specifier === 'firebase-admin/firestore' && context.parentURL?.endsWith('/lib/report-country-policy.ts')) {
    return { shortCircuit: true,
      url: moduleUrl('export const getFirestore=()=>globalThis.__localAdvicePolicyProbe.db;') };
  }
  return next(specifier, context);
} });
const { resolveLocalAdvicePolicy, localAdviceDecisionCurrent } = await import('../lib/local-advice-policy.ts');
test.after(() => { hooks.deregister(); Reflect.deleteProperty(globalThis, '__localAdvicePolicyProbe'); });
test.beforeEach(() => { probe.reads.length = 0; probe.stores.clear(); probe.failRead = false; });

function place(countryCode?: string, id = 'own-place') {
  const row = { id, ...point, updatedAt: 100, savedAt: '2026-11-01T12:00:00.000Z' };
  return { ...row, ...(countryCode ? { siteCountryContext: bindSiteContext(createSiteCountryContext({
    siteId, countryCode, confirmed: true,
  }, '2026-11-02T12:00:00.000Z')!, row)! } : {}) };
}
function personal(rows: readonly SiteContextPlace[] = [place('ZA')]): LocalAdvicePolicyInput {
  return { adviceContext: { mode: 'personal-site', siteId,
    countryFingerprint: resolvePlanningSupport({ siteId, places: rows }).fingerprint }, location: { ...point }, hasSiteInputs: true };
}
const request = (sample = false) => new Request('https://example.invalid/api/chat', {
  method: 'POST', headers: sample ? { 'x-imbewu-sample': '1' } : {},
});
function held(decision: LocalAdviceDecision, status: number, code: string) {
  assert.equal(decision.allowed, false);
  if (decision.allowed) throw Error('Expected held advice');
  assert.equal(decision.status, status); assert.equal(decision.code, code); assert.ok(decision.error);
}

test('general app help remains available without a saved country or account lookup', async () => {
  for (const auth of [{ uid: null }, { uid: null, guest: true as const }, { uid: owner }]) {
    for (const location of [undefined, null]) {
      const decision = await resolveLocalAdvicePolicy(request(), auth, {
        adviceContext: { mode: 'general-help' }, location, hasSiteInputs: false,
      });
      assert.equal(decision.allowed, true); if (decision.allowed) assert.equal(decision.mode, 'general-help');
    }
  }
  assert.deepEqual(probe.reads, []);
});

test('general help cannot admit personal fields, photos or approval metadata through an empty-looking payload', async () => {
  for (const input of [
    { adviceContext: { mode: 'general-help' }, location: null, hasSiteInputs: true },
    { adviceContext: { mode: 'general-help' }, location: {}, hasSiteInputs: false },
    { adviceContext: { mode: 'general-help' }, location: point, hasSiteInputs: false },
    { adviceContext: { mode: 'general-help' }, hasSiteInputs: undefined },
  ]) held(await resolveLocalAdvicePolicy(request(true), { uid: null, guest: true }, input as LocalAdvicePolicyInput),
    422, LOCAL_ADVICE_CODES.personalContextNotAllowed);
  held(await resolveLocalAdvicePolicy(request(), { uid: owner }, {
    adviceContext: { mode: 'general-help', countryCode: 'ZA' }, hasSiteInputs: false,
  }), 400, LOCAL_ADVICE_CODES.invalidContext);
  assert.deepEqual(probe.reads, []);
});

test('missing scope, malformed fingerprints and nonfinite or coerced coordinates cannot reach the country reader', async () => {
  for (const adviceContext of [undefined, null, [], {}, { mode: 'original-demo-reference' }]) {
    held(await resolveLocalAdvicePolicy(request(), { uid: owner }, { ...personal(), adviceContext }), 400, LOCAL_ADVICE_CODES.invalidContext);
  }
  for (const countryFingerprint of [undefined, null, 1, {}, [], '', ' ', ' padded ', 'line\nbreak']) {
    held(await resolveLocalAdvicePolicy(request(), { uid: owner }, {
      ...personal(), adviceContext: { mode: 'personal-site', siteId, countryFingerprint },
    }), 400, LOCAL_ADVICE_CODES.invalidContext);
  }
  for (const location of [null, {}, { lat: String(point.lat), lon: point.lon }, { ...point, lat: NaN },
    { ...point, lon: Infinity }, { ...point, lat: 91 }, { ...point, lon: -181 }, { ...point, lat: point.lat + 1 }]) {
    held(await resolveLocalAdvicePolicy(request(), { uid: owner }, { ...personal(), location }), 422, LOCAL_ADVICE_CODES.siteMismatch);
  }
  held(await resolveLocalAdvicePolicy(request(), { uid: owner }, {
    ...personal(), adviceContext: { mode: 'personal-site', siteId: 'site:0,0', countryFingerprint: 'not-current' },
  }), 400, LOCAL_ADVICE_CODES.invalidContext);
  assert.deepEqual(probe.reads, []);
});

test('unknown, foreign, conflicting and stale saved-country contexts retain the canonical hold', async () => {
  const valid = place('ZA');
  const transient = { ...valid, siteCountryContext: createSiteCountryContext({ siteId, countryCode: 'ZA', confirmed: true }) };
  for (const rows of [[], [place()], [place('KE')], [place('GB')], [valid, place('KE', 'alias')],
    [valid, place(undefined, 'unknown-alias')], [{ ...valid, updatedAt: 101 }], [transient]]) {
    probe.stores.set(owner, rows);
    held(await resolveLocalAdvicePolicy(request(), { uid: owner }, personal(rows)), 422, LOCAL_ADVICE_CODES.countryUnavailable);
  }
  assert.equal(probe.reads.length, 8); assert.ok(probe.reads.every(uid => uid === owner));
});

test('only the verified account is read, including staff and organisation callers with no own saved farm', async () => {
  probe.stores.set(owner, [place('ZA')]);
  for (const auth of [{ uid: 'staff-owner', role: 'staff' }, { uid: 'organisation-owner', role: 'organisation' }]) {
    held(await resolveLocalAdvicePolicy(request(true), auth, personal()), 422, LOCAL_ADVICE_CODES.countryUnavailable);
  }
  assert.deepEqual(probe.reads, ['staff-owner', 'organisation-owner']);
  for (const auth of [{ uid: null }, { uid: null, guest: true as const }, { uid: 'invalid/owner' }]) {
    held(await resolveLocalAdvicePolicy(request(true), auth, personal()), 422, LOCAL_ADVICE_CODES.countryUnavailable);
  }
  assert.deepEqual(probe.reads, ['staff-owner', 'organisation-owner']);
});

test('sample admission cannot substitute either public demo location for an account-owned country context', async () => {
  for (const location of [{ lat: -28.628, lon: 29.891 }, { lat: -27.726231, lon: 31.963044 }]) {
    const ownId = `site:${location.lat.toFixed(5)},${location.lon.toFixed(5)}`;
    held(await resolveLocalAdvicePolicy(request(true), { uid: null, guest: true }, {
      adviceContext: { mode: 'personal-site', siteId: ownId, countryFingerprint: 'not-a-country-credential' },
      location, hasSiteInputs: true,
    }), 422, LOCAL_ADVICE_CODES.countryUnavailable);
  }
  assert.deepEqual(probe.reads, []);
});

test('a supported saved site succeeds only with its current canonical country fingerprint', async () => {
  probe.stores.set(owner, [place('ZA')]);
  const input = personal();
  const decision = await resolveLocalAdvicePolicy(request(), { uid: owner }, input);
  assert.equal(decision.allowed, true);
  if (!decision.allowed || decision.mode !== 'personal-site') throw Error('Expected supported personal site');
  assert.equal(decision.siteId, siteId);
  assert.equal(decision.countryFingerprint, (input.adviceContext as { countryFingerprint: string }).countryFingerprint);
  assert.match(decision.fingerprint, /^[a-f0-9]{64}$/); assert.equal(decision.fingerprint.includes(owner), false);
  held(await resolveLocalAdvicePolicy(request(), { uid: owner }, {
    ...input, adviceContext: { mode: 'personal-site', siteId, countryFingerprint: 'old-country-fingerprint' },
  }), 409, LOCAL_ADVICE_CODES.contextChanged);
  assert.deepEqual(probe.reads, [owner, owner]);
});

test('unavailable or malformed country storage cannot become a supported fallback', async () => {
  probe.failRead = true;
  held(await resolveLocalAdvicePolicy(request(), { uid: owner }, personal()), 503, LOCAL_ADVICE_CODES.countrySourceUnavailable);
  probe.failRead = false; probe.stores.set(owner, { countryCode: 'ZA' });
  held(await resolveLocalAdvicePolicy(request(), { uid: owner }, personal()), 503, LOCAL_ADVICE_CODES.countrySourceUnavailable);
});

test('rechecks use fresh actual saved places and retire changed country or base receipts after a valid call', async () => {
  let rows = [place('ZA')]; const reads: string[] = [];
  const reader = async (uid: string) => { reads.push(uid); return rows; };
  const input = personal(rows);
  const admitted = await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader);
  assert.equal(admitted.allowed, true);
  assert.equal(localAdviceDecisionCurrent(admitted, await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader)), true);
  rows = [place('KE')];
  assert.equal(localAdviceDecisionCurrent(admitted, await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader)), false);
  rows = [{ ...place('ZA'), updatedAt: 101 }];
  assert.equal(localAdviceDecisionCurrent(admitted, await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader)), false);
  const reconfirmed = place('ZA');
  reconfirmed.siteCountryContext = { ...reconfirmed.siteCountryContext!, confirmedAt: '2026-11-03T12:00:00.000Z' };
  rows = [reconfirmed];
  const changedReceipt = await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader);
  held(changedReceipt, 409, LOCAL_ADVICE_CODES.contextChanged);
  assert.equal(localAdviceDecisionCurrent(admitted, changedReceipt), false);
  rows = [place('ZA')];
  assert.equal(localAdviceDecisionCurrent(admitted, await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader)), true);
  assert.equal(reads.length, 6); assert.ok(reads.every(uid => uid === owner));
});

test('decision fingerprints bind owner, exact request point and general-help admission without exposing an owner id', async () => {
  const input = personal();
  const reader = async () => [place('ZA')];
  const original = await resolveLocalAdvicePolicy(request(), { uid: owner }, input, reader);
  const otherOwner = await resolveLocalAdvicePolicy(request(), { uid: 'another-owner' }, input, reader);
  const slightlyDifferent = await resolveLocalAdvicePolicy(request(), { uid: owner }, {
    ...input, location: { ...point, lat: point.lat + 0.0000001 },
  }, reader);
  assert.equal(otherOwner.allowed, true); assert.equal(slightlyDifferent.allowed, true);
  assert.equal(localAdviceDecisionCurrent(original, otherOwner), false);
  assert.equal(localAdviceDecisionCurrent(original, slightlyDifferent), false);
  const general = { adviceContext: { mode: 'general-help' }, hasSiteInputs: false };
  const anonymous = await resolveLocalAdvicePolicy(request(), { uid: null }, general);
  const guest = await resolveLocalAdvicePolicy(request(), { uid: null, guest: true }, general);
  const signedIn = await resolveLocalAdvicePolicy(request(), { uid: owner }, general);
  assert.equal(localAdviceDecisionCurrent(anonymous, guest), false);
  assert.equal(localAdviceDecisionCurrent(anonymous, signedIn), false);
  assert.equal(localAdviceDecisionCurrent(original, signedIn), false);
  assert.equal(localAdviceDecisionCurrent(anonymous, anonymous), true);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import { canSeeOrg, decideNetworkAccess, scopeToVisible, type CallerProfile } from '../lib/network-access';

const p = (over: Partial<CallerProfile>): CallerProfile =>
  ({ id: 'u1', role: 'ngo', org_id: 'org-1', ...over });

test('only programme and funder accounts reach a portfolio', () => {
  for (const role of ['farmer', 'student', 'mentor'] as const) {
    const d = decideNetworkAccess(p({ role }));
    assert.equal(d.ok, false, `${role} was let through`);
  }
  for (const role of ['ngo', 'funder', 'admin'] as const) {
    assert.equal(decideNetworkAccess(p({ role })).ok, true, `${role} was refused`);
  }
});

test('an authenticated account with no profile is refused', () => {
  // A verified token is proof of identity, not of authorisation. This is the case that
  // matters most: the token check passing is exactly when it is tempting to stop.
  const d = decideNetworkAccess(null);
  assert.equal(d.ok, false);
  assert.equal(d.ok === false && d.status, 403);
});

test('an org-less staff account sees nothing rather than everything', () => {
  // Every staff account was in this state before a provisioning path existed. A null org
  // must resolve to an EMPTY visible set, never to a wildcard some comparison treats as
  // "matches anything" — the null == null trap firestore.rules guards against too.
  const d = decideNetworkAccess(p({ org_id: null }));
  assert.equal(d.ok, false);
  assert.equal(canSeeOrg(d, 'org-1'), false);
  assert.equal(canSeeOrg(d, null), false);
});

test('a funder sees the orgs it funds and no others', () => {
  const d = decideNetworkAccess(p({ role: 'funder', org_id: 'idc', funded_org_ids: ['org-1', 'org-2'] }));
  assert.equal(d.ok, true);
  assert.equal(canSeeOrg(d, 'org-1'), true);
  assert.equal(canSeeOrg(d, 'org-2'), true);
  assert.equal(canSeeOrg(d, 'org-3'), false);
});

test('funded_org_ids is ignored for any role other than funder', () => {
  // The field is admin-written, but an NGO account carrying one must not thereby read
  // another org — the grant is meaningful only in the funder relationship.
  const d = decideNetworkAccess(p({ role: 'ngo', org_id: 'org-1', funded_org_ids: ['org-9'] }));
  assert.equal(canSeeOrg(d, 'org-9'), false);
  assert.equal(canSeeOrg(d, 'org-1'), true);
});

test('an absent or empty funded list collapses to single-org, not to open', () => {
  for (const funded of [undefined, [], ['']]) {
    const d = decideNetworkAccess(p({ role: 'funder', org_id: 'idc', funded_org_ids: funded }));
    assert.equal(canSeeOrg(d, 'org-1'), false);
  }
});

test('a farmer with no org belongs to no portfolio', () => {
  const d = decideNetworkAccess(p({ org_id: 'org-1' }));
  assert.equal(canSeeOrg(d, null), false);
  assert.equal(canSeeOrg(d, undefined), false);
  assert.equal(canSeeOrg(d, ''), false);
});

test('scoping reports what it withheld instead of silently shrinking', () => {
  // A portfolio that quietly returns fewer farmers than the org has is indistinguishable
  // from farmers having left the programme.
  const d = decideNetworkAccess(p({ org_id: 'org-1' }));
  const rows = [{ orgId: 'org-1' }, { orgId: 'org-2' }, { orgId: null }];
  const { visible, withheld } = scopeToVisible(d, rows);
  assert.equal(visible.length, 1);
  assert.equal(withheld, 2);
  // a denied decision keeps nothing
  const denied = decideNetworkAccess(null);
  assert.deepEqual(scopeToVisible(denied, rows), { visible: [], withheld: 3 });
});

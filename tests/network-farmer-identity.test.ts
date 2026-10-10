import assert from 'node:assert/strict';
import test from 'node:test';
import { withServerIdentity } from '../lib/network.ts';

// sec-05: app/api/network/farmers/route.ts used to spread the farmer's own, self-editable
// `profiles/{uid}.network` map AFTER the server-derived id/name/orgId, so a farmer who put
// { id, name, orgId } keys into their own `network` map could overwrite what a mentor/NGO/funder
// dashboard displays for them — including spoofing another organisation's org_id entirely.
// withServerIdentity() is the fix: server identity always wins, regardless of what's in `network`.

test('server-derived id/name/orgId win even when the farmer\'s own network map tries to overwrite them', () => {
  const spoofedNetwork = {
    id: 'attacker-chosen-id',
    name: 'Fake Display Name',
    orgId: 'some-other-org',
    siteName: 'My plot', // a real display field network is allowed to supply
  };
  const farmer = withServerIdentity(spoofedNetwork, {
    id: 'real-uid',
    name: 'Real Full Name',
    orgId: 'real-org-id',
  });
  assert.equal(farmer.id, 'real-uid');
  assert.equal(farmer.name, 'Real Full Name');
  assert.equal(farmer.orgId, 'real-org-id');
  // Non-identity display fields from `network` are still carried through unchanged.
  assert.equal((farmer as unknown as { siteName: string }).siteName, 'My plot');
});

test('a missing or null network map does not crash and still gets the server identity', () => {
  assert.deepEqual(
    withServerIdentity(null, { id: 'u1', name: 'N', orgId: 'o1' }),
    { id: 'u1', name: 'N', orgId: 'o1' },
  );
  assert.deepEqual(
    withServerIdentity(undefined, { id: 'u1', name: 'N', orgId: 'o1' }),
    { id: 'u1', name: 'N', orgId: 'o1' },
  );
});

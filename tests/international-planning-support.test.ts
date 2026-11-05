import assert from 'node:assert/strict';
import test from 'node:test';
import { resolvePlanningSupport } from '../lib/international/planning-support.ts';
import { bindSiteContext, createSiteCountryContext } from '../lib/international/site-context.ts';
import { createWorkspacePlanningReference } from '../lib/international/workspace-context.ts';

const siteId = 'site:0.00000,0.00000';
const instant = '2026-11-02T12:00:00.000Z';
const context = (countryCode: string) => createSiteCountryContext({ siteId, countryCode, confirmed: true }, instant)!;
const place = (countryCode?: string, id = 'fictional-policy-site') => {
  const base = { id, lat: 0, lon: 0, savedAt: instant, updatedAt: 1 };
  return { ...base, ...(countryCode ? { siteCountryContext: bindSiteContext(context(countryCode), base)! } : {}) };
};
const workspaceReferences = [createWorkspacePlanningReference('virtual-bed', true, instant)!];

test('an unmapped workspace requires an explicit reference acknowledgement and never gains a country approval', () => {
  const missing = resolvePlanningSupport({ places: [], siteId: null, workspaceId: 'virtual-bed' });
  assert.equal(missing.allowCataloguePlanning, false);
  const selected = resolvePlanningSupport({ places: [], siteId: null, workspaceId: 'virtual-bed', workspaceReferences });
  assert.equal(selected.allowCataloguePlanning, true);
  assert.equal(selected.mode, 'south-african-reference');
  assert.equal(selected.siteCountry.context, null);
  assert.match(selected.reason, /not locally reviewed/);
  assert.notEqual(selected.fingerprint, missing.fingerprint);
  assert.equal(resolvePlanningSupport({ places: [], siteId: null, workspaceId: 'design:other', workspaceReferences }).allowCataloguePlanning, false);
});

test('a mapped foreign, unknown, missing or malformed site cannot borrow an unmapped reference choice', () => {
  for (const countryCode of [undefined, 'KE', 'GB', 'US', 'BR']) {
    const result = resolvePlanningSupport({ places: [place(countryCode)], siteId, workspaceId: 'virtual-bed', workspaceReferences });
    assert.equal(result.allowCataloguePlanning, false, countryCode ?? 'legacy unknown');
    assert.equal(result.mode, 'unavailable');
  }
  for (const mappedId of [siteId, '', 'site:0,0', 'not-a-site']) {
    assert.equal(resolvePlanningSupport({ places: [], siteId: mappedId, workspaceId: 'virtual-bed', workspaceReferences }).allowCataloguePlanning, false, mappedId);
  }
});

test('only an explicitly confirmed supported site retains the established South African references', () => {
  const supported = resolvePlanningSupport({ places: [place('ZA')], siteId });
  assert.equal(supported.allowCataloguePlanning, true);
  assert.equal(supported.mode, 'south-african-site');
  assert.match(supported.reason, /not local agronomy approval/);
  const changed = resolvePlanningSupport({ places: [place('KE')], siteId });
  assert.equal(changed.allowCataloguePlanning, false);
  assert.notEqual(changed.fingerprint, supported.fingerprint);
  const moved = resolvePlanningSupport({ places: [{ ...place('ZA'), lat: 1 }], siteId: 'site:1.00000,0.00000' });
  assert.equal(moved.allowCataloguePlanning, false);
});

test('conflicting aliases and forged review flags cannot turn reference discovery into planning support', () => {
  const result = resolvePlanningSupport({ places: [place('ZA'), place('KE', 'alias')], siteId, workspaceId: 'virtual-bed', workspaceReferences });
  assert.equal(result.allowCataloguePlanning, false);
  assert.equal(result.siteCountry.status, 'conflict');
  assert.equal(resolvePlanningSupport({ places: [{ ...place(), siteCountryContext: { countryCode: 'ZA', productionPlanSupported: true, localAgronomyApproved: true } }], siteId }).allowCataloguePlanning, false);
});

import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONSENT_SCOPES, applyConsent, consentState, emptyConsent, grantedScopes,
  hasConsent, revokeAll, setScope, type FarmerConsent,
} from '../lib/consent';
import type { NetworkFarmer, NetworkFarmerMetrics, NetworkFarmerSummary } from '../lib/network';

const NOW = '2026-08-26T00:00:00.000Z';

function consent(scopes: Record<string, boolean>, revoked: string | null = null): FarmerConsent {
  return { uid: 'f1', org_id: 'org-1', scopes, granted_at: NOW, revoked_at: revoked, updated_at: NOW };
}

function summary(isDemo = false): NetworkFarmerSummary {
  const farmer = {
    id: 'f1', name: 'Farmer One', orgId: 'org-1', cohortId: null, cohortName: null,
    siteName: 'Plot 4', district: 'Nquthu', municipality: 'Zululand',
    lat: -28.211, lon: 30.667, coordPrecision: 'exact', plotSizeM2: 900, plotLabel: null,
    joinedAt: '2026-01-01', status: 'thriving', photoUrl: null, consent: 'unknown', isDemo,
  } as unknown as NetworkFarmer;
  const metrics = {
    monthsActive: 7,
    producedKg: 400, soldKg: 250, keptKg: 150, soldPct: 62,
    incomeZar: 5000, expensesZar: 1200, netZar: 3800, estimatedValueZar: 6500,
    plannedKg: 500, harvestedKg: 400, harvestedVsPlannedPct: 80,
    progressPct: 50, stage: null, steps: null,
    surveyFilled: 3, surveyTotal: 5, surveyPct: 60,
    modulesDone: 8, modulesTotal: 10, trainingPct: 80, surveysAnswered: 2,
    lastActivityAt: NOW, daysSinceActivity: 1,
    coverage: { production: true, sales: true, expenses: true, courses: true, surveys: true, siteProgress: true, plan: true },
  } as unknown as NetworkFarmerMetrics;
  return { farmer, metrics };
}

const coarsen = (f: NetworkFarmer): NetworkFarmer =>
  ({ ...f, lat: -28.2, lon: 30.7, coordPrecision: 'coarse' }) as NetworkFarmer;

test('absence of a record grants nothing', () => {
  // The outcome of a farmer doing nothing must be the private one. Every one of these
  // is the path a bug takes: no doc, unreachable doc, doc with an empty scopes map.
  for (const c of [null, undefined, consent({})]) {
    for (const { id } of CONSENT_SCOPES) assert.equal(hasConsent(c, id), false, `${id} leaked`);
  }
  assert.equal(consentState(null), 'unknown');
  assert.equal(consentState(consent({})), 'withheld');
});

test('revocation withdraws every scope regardless of the flags left behind', () => {
  // A farmer revoking should not have to also untick six boxes for it to take effect.
  const revoked = consent({ sales: true, expenses: true, training: true }, NOW);
  for (const { id } of CONSENT_SCOPES) assert.equal(hasConsent(revoked, id), false);
  assert.equal(consentState(revoked), 'withheld');
  assert.deepEqual(grantedScopes(revoked), []);
});

test('granting a scope again un-revokes, so a re-grant is not silently swallowed', () => {
  const back = setScope(revokeAll(consent({ sales: true }), NOW), 'sales', true, NOW);
  assert.equal(back.revoked_at, null);
  assert.equal(hasConsent(back, 'sales'), true);
  // and turning the last scope off does not resurrect a revocation that was never made
  const off = setScope(consent({ sales: true }), 'sales', false, NOW);
  assert.equal(hasConsent(off, 'sales'), false);
});

test('emptyConsent starts closed and records the org it is aimed at', () => {
  const c = emptyConsent('f1', 'org-1', NOW);
  assert.deepEqual(grantedScopes(c), []);
  assert.equal(c.org_id, 'org-1');
  assert.equal(c.granted_at, null);
});

test('a withheld metric becomes null and loses coverage — never zero', () => {
  // This is the whole reason applyConsent exists rather than a filter. "R0 income,
  // 0% training" is read by a funder as evidence the farmer did nothing, which would
  // punish precisely the farmers who exercised a right.
  const { metrics } = applyConsent(summary(), consent({ training: true }), coarsen);
  assert.equal(metrics.incomeZar, null);
  assert.equal(metrics.expensesZar, null);
  assert.equal(metrics.producedKg, null);
  assert.equal(metrics.soldKg, null);
  assert.equal(metrics.surveysAnswered, null);
  assert.equal(metrics.coverage.sales, false);
  assert.equal(metrics.coverage.expenses, false);
  assert.equal(metrics.coverage.production, false);
  // the granted scope survives intact
  assert.equal(metrics.modulesDone, 8);
  assert.equal(metrics.trainingPct, 80);
  assert.equal(metrics.coverage.courses, true);
  // and a figure no scope governs is untouched
  assert.equal(metrics.monthsActive, 7);
});

test('net income cannot reconstruct a half the farmer withheld', () => {
  // netZar is income minus expenses. Publishing it while hiding expenses hands the
  // reader expenses = income − net. It survives only if BOTH money scopes are granted.
  assert.equal(applyConsent(summary(), consent({ sales: true }), coarsen).metrics.netZar, null);
  assert.equal(applyConsent(summary(), consent({ expenses: true }), coarsen).metrics.netZar, null);
  assert.equal(applyConsent(summary(), consent({ sales: true, expenses: true }), coarsen).metrics.netZar, 3800);
});

test('an exact homestead coordinate is coarsened unless location is granted', () => {
  const withheld = applyConsent(summary(), consent({ sales: true }), coarsen);
  assert.equal(withheld.farmer.coordPrecision, 'coarse');
  const granted = applyConsent(summary(), consent({ location: true }), coarsen);
  assert.equal(granted.farmer.coordPrecision, 'exact');
  assert.equal(granted.farmer.lat, -28.211);
});

test('the farmer consent summary reflects the record, and demo rows stay labelled demo', () => {
  assert.equal(applyConsent(summary(), consent({ sales: true }), coarsen).farmer.consent, 'granted');
  assert.equal(applyConsent(summary(), consent({}), coarsen).farmer.consent, 'withheld');
  assert.equal(applyConsent(summary(), null, coarsen).farmer.consent, 'unknown');
  // a sample row must never claim a real person granted anything
  assert.equal(applyConsent(summary(true), consent({ sales: true }), coarsen).farmer.consent, 'demo');
});

test('applyConsent does not mutate its input', () => {
  const s = summary();
  applyConsent(s, consent({}), coarsen);
  assert.equal(s.metrics.incomeZar, 5000, 'the caller\'s copy was mutated');
  assert.equal(s.metrics.coverage.sales, true);
});

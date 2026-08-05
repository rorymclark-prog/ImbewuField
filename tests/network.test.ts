import test from 'node:test';
import assert from 'node:assert/strict';

import { COURSE_MODULES } from '../lib/course-modules.ts';
import { CROPS, cropByKey } from '../lib/crop-catalog.ts';
import type {
  CourseProgress,
  ExpenseLog,
  ProductionLog,
  SalesLog,
} from '../lib/db/types.ts';
import type { ReconciliationResult } from '../lib/harvest-reconciliation.ts';
import {
  DEFAULT_COURSE_MODULE_COUNT,
  KEPT_KG_VALUE_ZAR,
  attentionFlags,
  buildFarmerMetrics,
  coarsenCoords,
  coarsenFarmerLocation,
  filterNetwork,
  findNetworkFarmer,
  formatDistanceKm,
  haversineKm,
  monthsBetween,
  nearestFarmers,
  networkBounds,
  portfolioTotals,
  rollupBy,
  sortNetwork,
  type NetworkFarmer,
  type NetworkFarmerSummary,
} from '../lib/network.ts';
import {
  DEMO_MAX_KG_PER_PLOT_M2_YEAR,
  DEMO_NETWORK,
  buildDemoNetwork,
  demoFarmerById,
} from '../lib/network-demo.ts';
import {
  DEMO_EXCHANGE,
  DEMO_LISTINGS,
  DEMO_LISTING_SEED_COUNT,
  filterListings,
  listingUnitPriceZar,
  matchOffersForWant,
  priceLabel,
  quantityLabel,
  searchListings,
  sortListings,
  summariseExchange,
  toBoardCategory,
  toBoardKind,
  toBoardPostFields,
  type Listing,
} from '../lib/exchange.ts';

const NOW = new Date('2026-08-05T09:00:00Z');

/* ────────────────────────────────────────────────────────────────────────────
 * Fixtures
 * ──────────────────────────────────────────────────────────────────────────*/

function farmer(overrides: Partial<NetworkFarmer> = {}): NetworkFarmer {
  return {
    id: 'f1',
    name: 'Test Farmer',
    orgId: 'org1',
    cohortId: 'c1',
    cohortName: 'Cohort 1',
    siteName: 'Test Site',
    district: 'Mkhuze',
    municipality: 'uMkhanyakude',
    lat: -27.72,
    lon: 31.96,
    coordPrecision: 'exact',
    plotSizeM2: 800,
    plotLabel: 'Plot 1',
    joinedAt: '2025-08-05T09:00:00.000Z',
    status: 'establishing',
    photoUrl: null,
    consent: 'demo',
    isDemo: true,
    ...overrides,
  };
}

function production(rows: Array<[string, number, string]>): ProductionLog[] {
  return rows.map(([crop, kg, at], i) => ({
    id: `p${i}`, profile_id: 'f1', garden_id: 'g1', crop, kg,
    photo_url: null, logged_at: at, created_at: at,
  }));
}

function sales(rows: Array<[string, number, number, string]>): SalesLog[] {
  return rows.map(([crop, kg, amount, at], i) => ({
    id: `s${i}`, profile_id: 'f1', garden_id: 'g1', crop, kg, amount,
    buyer: 'Market', sold_at: at, created_at: at,
  }));
}

function expenses(rows: Array<[string, number, string]>): ExpenseLog[] {
  return rows.map(([item, amount, at], i) => ({
    id: `e${i}`, profile_id: 'f1', garden_id: 'g1', item, amount,
    supplier: null, spent_at: at, created_at: at,
  }));
}

function courses(doneCount: number): CourseProgress[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: `c${i}`, profile_id: 'f1', module: `m${i}`, done: i < doneCount,
    updated_at: '2026-07-01T00:00:00.000Z',
  }));
}

function summary(overrides: Partial<NetworkFarmer>, opts: {
  produced?: number; sold?: number; income?: number; expense?: number; progress?: number;
} = {}): NetworkFarmerSummary {
  const f = farmer(overrides);
  return {
    farmer: f,
    metrics: buildFarmerMetrics(f, {
      production: opts.produced === undefined ? null : production([['Maize', opts.produced, '2026-07-01T00:00:00.000Z']]),
      sales: opts.sold === undefined ? null : sales([['Maize', opts.sold, opts.income ?? 0, '2026-07-02T00:00:00.000Z']]),
      expenses: opts.expense === undefined ? null : expenses([['Seed', opts.expense, '2026-07-03T00:00:00.000Z']]),
      courses: courses(5),
      completion: opts.progress === undefined ? null : {
        hasSite: true,
        boundaryPointCount: opts.progress >= 50 ? 5 : 0,
        surveyFilledFields: Math.round(opts.progress / 10),
        surveyTotalFields: 10,
        zoneCount: opts.progress >= 50 ? 3 : 0,
        elementCount: opts.progress >= 50 ? 5 : 0,
        hasCropPlan: opts.progress >= 80,
      },
      now: NOW,
    }),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Selectors: the null-vs-zero contract
 * ──────────────────────────────────────────────────────────────────────────*/

test('an unreadable source yields null, an empty-but-readable one yields zero', () => {
  const denied = buildFarmerMetrics(farmer(), {
    production: null, sales: null, expenses: null, courses: null, now: NOW,
  });
  assert.equal(denied.producedKg, null);
  assert.equal(denied.soldKg, null);
  assert.equal(denied.incomeZar, null);
  assert.equal(denied.netZar, null);
  assert.equal(denied.trainingPct, null);
  assert.equal(denied.coverage.production, false);
  assert.equal(denied.coverage.sales, false);

  const empty = buildFarmerMetrics(farmer(), {
    production: [], sales: [], expenses: [], courses: [], now: NOW,
  });
  assert.equal(empty.producedKg, 0);
  assert.equal(empty.soldKg, 0);
  assert.equal(empty.incomeZar, 0);
  assert.equal(empty.netZar, 0);
  assert.equal(empty.trainingPct, 0);
  assert.equal(empty.coverage.production, true);
});

test('one-sided readability never fabricates the other side', () => {
  // Production readable, sales denied: "kept" and "sold %" must stay unknown
  // rather than reporting the whole harvest as eaten at home.
  const m = buildFarmerMetrics(farmer(), {
    production: production([['Maize', 100, '2026-07-01T00:00:00.000Z']]),
    sales: null, expenses: null, courses: null, now: NOW,
  });
  assert.equal(m.producedKg, 100);
  assert.equal(m.keptKg, null);
  assert.equal(m.soldPct, null);
  assert.equal(m.estimatedValueZar, null);
});

test('money, kilograms and training add up the way the dashboards state them', () => {
  const m = buildFarmerMetrics(farmer(), {
    production: production([
      ['Swiss chard', 40, '2026-06-01T00:00:00.000Z'],
      ['Maize', 60.5, '2026-07-10T00:00:00.000Z'],
    ]),
    sales: sales([['Swiss chard', 30, 180, '2026-06-05T00:00:00.000Z']]),
    expenses: expenses([['Seed', 120, '2026-05-01T00:00:00.000Z'], ['Transport', 80, '2026-06-02T00:00:00.000Z']]),
    courses: courses(4),
    now: NOW,
  });
  assert.equal(m.producedKg, 100.5);
  assert.equal(m.soldKg, 30);
  assert.equal(m.keptKg, 70.5);
  assert.equal(m.incomeZar, 180);
  assert.equal(m.expensesZar, 200);
  assert.equal(m.netZar, -20);
  assert.equal(m.estimatedValueZar, 180 + 70.5 * KEPT_KG_VALUE_ZAR);
  assert.equal(m.soldPct, 30);
  assert.equal(m.modulesDone, 4);
  assert.equal(m.trainingPct, 40);
  assert.equal(m.lastActivityAt, '2026-07-10T00:00:00.000Z');
  assert.equal(m.daysSinceActivity, 26);
});

test('plan delivery comes from the reconciliation, and is null without a plan', () => {
  const reconciliation: ReconciliationResult = {
    matched: [{
      cropKey: 'maize', cropName: 'Maize (mielies)', icon: '🌽',
      intendedKg: 200, harvestedKg: 120, soldKg: 90, unaccountedKg: 30,
      yieldGap: true, unaccountedGap: false,
    }],
    notYetHarvested: [],
    unmatchedPlanned: [{
      cropKey: 'cabbage', cropName: 'Cabbage', icon: '🥬',
      intendedKg: 100, harvestedKg: 0, soldKg: 0, unaccountedKg: 0,
      yieldGap: true, unaccountedGap: false,
    }],
    unplannedActivity: [],
  };
  const withPlan = buildFarmerMetrics(farmer(), {
    production: production([['Maize', 120, '2026-07-01T00:00:00.000Z']]),
    sales: [], expenses: [], courses: [], reconciliation, now: NOW,
  });
  assert.equal(withPlan.plannedKg, 300);
  assert.equal(withPlan.harvestedKg, 120);
  assert.equal(withPlan.harvestedVsPlannedPct, 40);
  assert.equal(withPlan.coverage.plan, true);

  const noPlan = buildFarmerMetrics(farmer(), {
    production: production([['Maize', 120, '2026-07-01T00:00:00.000Z']]),
    sales: [], expenses: [], courses: [], now: NOW,
  });
  assert.equal(noPlan.plannedKg, null);
  assert.equal(noPlan.harvestedVsPlannedPct, null);
  assert.equal(noPlan.coverage.plan, false);
});

test('site progress is only reported when the site data was actually available', () => {
  const blind = buildFarmerMetrics(farmer(), {
    production: [], sales: [], expenses: [], courses: [], now: NOW,
  });
  assert.equal(blind.progressPct, null);
  assert.equal(blind.stage, null);
  assert.equal(blind.steps, null);
  assert.equal(blind.surveyPct, null);
  assert.equal(blind.coverage.siteProgress, false);

  const seen = buildFarmerMetrics(farmer(), {
    production: [], sales: [], expenses: [], courses: [],
    completion: {
      hasSite: true, boundaryPointCount: 6, surveyFilledFields: 8, surveyTotalFields: 10,
      zoneCount: 4, elementCount: 9, hasCropPlan: true,
    },
    now: NOW,
  });
  assert.equal(seen.stage, 'planned');
  assert.equal(seen.surveyPct, 80);
  assert.ok(seen.progressPct !== null && seen.progressPct > 90);
  assert.equal(seen.steps?.length, 5);
});

test('monthsBetween counts whole calendar months and never goes negative', () => {
  assert.equal(monthsBetween('2025-08-05T00:00:00.000Z', new Date('2026-08-05T12:00:00Z')), 12);
  assert.equal(monthsBetween('2026-07-20T00:00:00.000Z', new Date('2026-08-05T12:00:00Z')), 0);
  assert.equal(monthsBetween('2027-01-01T00:00:00.000Z', new Date('2026-08-05T12:00:00Z')), 0);
  assert.equal(monthsBetween('not-a-date', new Date('2026-08-05T12:00:00Z')), 0);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Distance
 * ──────────────────────────────────────────────────────────────────────────*/

test('haversineKm matches known South African distances', () => {
  const durban = { lat: -29.8587, lon: 31.0218 };
  const joburg = { lat: -26.2041, lon: 28.0473 };
  const d = haversineKm(durban, joburg);
  assert.ok(d > 480 && d < 510, `Durban→Joburg was ${d} km`);

  // Symmetric, zero for the same point, and small for two nearby KZN towns.
  assert.equal(haversineKm(durban, durban), 0);
  assert.ok(Math.abs(haversineKm(durban, joburg) - haversineKm(joburg, durban)) < 1e-9);

  const mkhuze = { lat: -27.726231, lon: 31.963044 };
  const jozini = { lat: -27.4297, lon: 32.0644 };
  const near = haversineKm(mkhuze, jozini);
  assert.ok(near > 25 && near < 45, `Mkhuze→Jozini was ${near} km`);
});

test('formatDistanceKm reads like a person wrote it', () => {
  assert.equal(formatDistanceKm(0.4), '< 1 km');
  assert.equal(formatDistanceKm(6.42), '6.4 km');
  assert.equal(formatDistanceKm(38.6), '39 km');
  assert.equal(formatDistanceKm(Number.NaN), '—');
});

test('coarsening rounds to ~1.1km and flips the precision flag', () => {
  assert.deepEqual(coarsenCoords(-27.726231, 31.963044), { lat: -27.73, lon: 31.96 });
  const coarse = coarsenFarmerLocation(farmer({ lat: -27.726231, lon: 31.963044 }));
  assert.equal(coarse.coordPrecision, 'coarse');
  assert.equal(coarse.lat, -27.73);
  // The precise original must be left untouched — coarsening returns a copy.
  assert.equal(farmer({ lat: -27.726231 }).lat, -27.726231);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Portfolio selectors
 * ──────────────────────────────────────────────────────────────────────────*/

test('attention flags never turn "we cannot see this farmer" into "this farmer failed"', () => {
  const blind = summary({ id: 'blind' });
  const flags = attentionFlags(blind);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].kind, 'no_data');

  const dormant = summary(
    { id: 'dormant', joinedAt: '2024-01-01T00:00:00.000Z' },
    { produced: 10, sold: 5, income: 50, expense: 20, progress: 90 },
  );
  assert.ok(attentionFlags(dormant).every((f) => f.kind !== 'no_data'));
});

test('a young loss-making site is not flagged, an established one is', () => {
  const young = summary(
    { id: 'young', joinedAt: '2026-06-05T00:00:00.000Z' },
    { produced: 5, sold: 1, income: 10, expense: 900, progress: 60 },
  );
  assert.ok(!attentionFlags(young).some((f) => f.kind === 'loss_making'));

  const old = summary(
    { id: 'old', joinedAt: '2024-06-05T00:00:00.000Z' },
    { produced: 5, sold: 1, income: 10, expense: 900, progress: 60 },
  );
  assert.ok(attentionFlags(old).some((f) => f.kind === 'loss_making'));
});

test('filters compose, and an unknown progress is never silently filtered out', () => {
  const rows = [
    summary({ id: 'a', name: 'Ayanda', municipality: 'Zululand' }, { produced: 10, sold: 5, income: 50, expense: 10, progress: 90 }),
    summary({ id: 'b', name: 'Bongi', municipality: 'uMkhanyakude' }, { produced: 20, sold: 10, income: 200, expense: 10, progress: 20 }),
    summary({ id: 'c', name: 'Cebo', municipality: 'Zululand' }),
  ];
  assert.deepEqual(filterNetwork(rows, { municipalities: ['Zululand'] }).map((r) => r.farmer.id), ['a', 'c']);
  assert.deepEqual(filterNetwork(rows, { query: 'bong' }).map((r) => r.farmer.id), ['b']);
  // 'c' has a null progress — unknown, so a >=50 filter keeps it rather than
  // treating "we could not read it" as "it is zero".
  assert.deepEqual(filterNetwork(rows, { minProgressPct: 50 }).map((r) => r.farmer.id), ['a', 'c']);
  assert.deepEqual(
    filterNetwork(rows, { within: { origin: { lat: -27.72, lon: 31.96 }, km: 5 } }).length,
    3,
  );
  assert.equal(filterNetwork(rows, { within: { origin: { lat: 0, lon: 0 }, km: 5 } }).length, 0);
});

test('sorting puts unreadable farmers last in both directions', () => {
  const rows = [
    summary({ id: 'a', name: 'Ayanda' }, { produced: 10, sold: 5, income: 50, expense: 10 }),
    summary({ id: 'b', name: 'Bongi' }, { produced: 20, sold: 10, income: 200, expense: 10 }),
    summary({ id: 'c', name: 'Cebo' }),
  ];
  assert.deepEqual(sortNetwork(rows, 'production').map((r) => r.farmer.id), ['b', 'a', 'c']);
  assert.deepEqual(
    sortNetwork(rows, 'production', { direction: 'asc' }).map((r) => r.farmer.id),
    ['a', 'b', 'c'],
  );
  assert.deepEqual(sortNetwork(rows, 'name').map((r) => r.farmer.id), ['a', 'b', 'c']);
});

test('portfolio totals report how many farmers they actually cover', () => {
  const rows = [
    summary({ id: 'a', plotSizeM2: 1000 }, { produced: 10, sold: 5, income: 50, expense: 10, progress: 80 }),
    summary({ id: 'b', plotSizeM2: 500 }, { produced: 20, sold: 10, income: 200, expense: 30, progress: 40 }),
    summary({ id: 'c', plotSizeM2: 500 }),
  ];
  const totals = portfolioTotals(rows);
  assert.equal(totals.farmerCount, 3);
  assert.equal(totals.reportingCount, 2);
  assert.equal(totals.totalPlotM2, 2000);
  assert.equal(totals.totalPlotHa, 0.2);
  assert.equal(totals.producedKg, 30);
  assert.equal(totals.incomeZar, 250);
  assert.equal(totals.netZar, 210);
  // Median over the two readable progress scores; 'c' has none and is excluded
  // rather than dragged in as a zero.
  const readable = rows
    .map((r) => r.metrics.progressPct)
    .filter((v): v is number => v !== null);
  assert.equal(readable.length, 2);
  assert.equal(totals.medianProgressPct, (readable[0] + readable[1]) / 2);
});

test('bounds, centroid, rollup and lookup behave on an empty and a full list', () => {
  assert.equal(networkBounds([]), null);
  assert.deepEqual(portfolioTotals([]).producedKg, null);

  const rows = DEMO_NETWORK.farmers;
  const bounds = networkBounds(rows);
  assert.ok(bounds !== null);
  assert.ok(bounds.minLat < bounds.maxLat && bounds.minLon < bounds.maxLon);

  const byMunicipality = rollupBy(rows, 'municipality');
  assert.ok(byMunicipality.length >= 4);
  assert.equal(byMunicipality.reduce((t, g) => t + g.farmerCount, 0), rows.length);
  assert.ok(byMunicipality.every((g) => g.centroid !== null));

  assert.equal(findNetworkFarmer(rows, 'demo-farmer-ubhejane')?.farmer.siteName, 'Ubhejane Crèche Garden');
  assert.equal(findNetworkFarmer(rows, 'nope'), null);

  const nearest = nearestFarmers(rows, { lat: -27.726231, lon: 31.963044 }, 3);
  assert.equal(nearest.length, 3);
  assert.equal(nearest[0].row.farmer.id, 'demo-farmer-ubhejane');
  assert.equal(nearest[0].km, 0);
  assert.ok(nearest[0].km <= nearest[1].km && nearest[1].km <= nearest[2].km);
});

/* ────────────────────────────────────────────────────────────────────────────
 * Exchange logic
 * ──────────────────────────────────────────────────────────────────────────*/

function listing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: 'l1', kind: 'offer', category: 'produce', cropKey: 'swiss-chard',
    title: 'Chard', description: 'Fresh chard', qty: 10, unit: 'kg',
    price: { type: 'zar', amount: 6, per: 'kg' },
    farmerId: 'f1', farmerName: 'Test Farmer', areaText: 'Mkhuze',
    lat: -27.73, lon: 31.96, postedAt: '2026-08-01T00:00:00.000Z',
    status: 'active', availableMonth: 8, photoUrl: null, source: 'demo', isDemo: true,
    ...overrides,
  };
}

test('price and quantity labels cover every price shape', () => {
  assert.equal(priceLabel(listing()), 'R6/kg');
  assert.equal(priceLabel(listing({ price: { type: 'zar', amount: 1300, per: 'lot' } })), 'R1300 for the lot');
  assert.equal(priceLabel(listing({ price: { type: 'free' } })), 'Free');
  assert.equal(priceLabel(listing({ price: { type: 'ask' } })), 'Make an offer');
  assert.equal(priceLabel(listing({ price: { type: 'swap', wants: 'maize seed' } })), 'Swap — maize seed');
  assert.equal(quantityLabel(listing()), '10 kg');
  assert.equal(quantityLabel(listing({ qty: null, unit: null })), '');
});

test('a lot price is comparable per unit, and non-cash prices never sort as cheapest', () => {
  assert.equal(listingUnitPriceZar(listing()), 6);
  assert.equal(listingUnitPriceZar(listing({ price: { type: 'zar', amount: 1300, per: 'lot' }, qty: 180 })), 1300 / 180);
  assert.equal(listingUnitPriceZar(listing({ price: { type: 'swap', wants: 'x' } })), null);

  const rows = [
    listing({ id: 'cheap', title: 'A', price: { type: 'zar', amount: 3, per: 'kg' } }),
    listing({ id: 'dear', title: 'B', price: { type: 'zar', amount: 30, per: 'kg' } }),
    listing({ id: 'swap', title: 'C', price: { type: 'swap', wants: 'x' } }),
  ];
  assert.deepEqual(sortListings(rows, 'price_low').map((l) => l.id), ['cheap', 'dear', 'swap']);
  assert.deepEqual(sortListings(rows, 'price_high').map((l) => l.id), ['dear', 'cheap', 'swap']);
});

test('closed listings are hidden by default and never lost when asked for', () => {
  const rows = [listing({ id: 'open' }), listing({ id: 'shut', status: 'closed' })];
  assert.deepEqual(filterListings(rows).map((l) => l.id), ['open']);
  assert.deepEqual(filterListings(rows, { includeClosed: true }).map((l) => l.id), ['open', 'shut']);
});

test('a listing with no coordinates survives a distance filter and sorts last', () => {
  const origin = { lat: -27.72, lon: 31.96 };
  const rows = [
    listing({ id: 'far', lat: -30.15, lon: 30.05 }),
    listing({ id: 'near', lat: -27.73, lon: 31.96 }),
    listing({ id: 'nowhere', lat: null, lon: null }),
  ];
  // Every post the shipped board has ever written lacks coordinates; hiding
  // them would empty the board on day one.
  assert.deepEqual(
    filterListings(rows, { within: { origin, km: 20 } }).map((l) => l.id).sort(),
    ['near', 'nowhere'],
  );
  assert.deepEqual(sortListings(rows, 'nearest', origin).map((l) => l.id), ['near', 'far', 'nowhere']);

  const searched = searchListings(rows, { sort: 'nearest', origin });
  assert.equal(searched[0].listing.id, 'near');
  assert.equal(searched[2].km, null);
  assert.equal(searched[2].distanceLabel, 'Area unknown');
});

test('a month filter keeps listings that name no month', () => {
  const rows = [
    listing({ id: 'aug', availableMonth: 8 }),
    listing({ id: 'sep', availableMonth: 9 }),
    listing({ id: 'nov', availableMonth: 11 }),
    listing({ id: 'anytime', availableMonth: null }),
  ];
  assert.deepEqual(filterListings(rows, { month: 8 }).map((l) => l.id), ['aug', 'sep', 'anytime']);
  // ±1 month wraps around the year boundary.
  assert.deepEqual(
    filterListings([listing({ id: 'dec', availableMonth: 12 })], { month: 1 }).map((l) => l.id),
    ['dec'],
  );
});

test('want-to-offer matching never returns your own listing or your own farm', () => {
  const want = listing({
    id: 'want', kind: 'want', cropKey: 'swiss-chard', farmerId: 'me', lat: -27.72, lon: 31.96,
  });
  const rows = [
    want,
    listing({ id: 'mine', farmerId: 'me', cropKey: 'swiss-chard' }),
    listing({ id: 'theirs-near', farmerId: 'them', cropKey: 'swiss-chard', lat: -27.73, lon: 31.96 }),
    listing({ id: 'theirs-far', farmerId: 'them2', cropKey: 'swiss-chard', lat: -30.15, lon: 30.05 }),
    listing({ id: 'wrong-crop', farmerId: 'them3', cropKey: 'maize' }),
    listing({ id: 'closed', farmerId: 'them4', cropKey: 'swiss-chard', status: 'closed' }),
  ];
  const matches = matchOffersForWant(want, rows, { maxKm: 50 });
  assert.deepEqual(matches.map((m) => m.listing.id), ['theirs-near']);
});

test('a structured listing maps back onto the shipped board_posts schema', () => {
  assert.equal(toBoardKind(listing()), 'have');
  assert.equal(toBoardKind(listing({ price: { type: 'free' } })), 'free');
  assert.equal(toBoardKind(listing({ kind: 'want' })), 'want');
  assert.equal(toBoardCategory('labour'), 'other');
  assert.equal(toBoardCategory('seed'), 'seed');

  // The write boundary re-coarsens even an already-coarse coordinate.
  const fields = toBoardPostFields(listing({ lat: -27.726231, lon: 31.963044 }));
  assert.equal(fields.coarse_lat, -27.73);
  assert.equal(fields.coarse_lon, 31.96);
  assert.equal(fields.crop_key, 'swiss-chard');
  assert.equal(fields.qty, 10);
  assert.equal(fields.price_zar, 6);
  assert.equal(fields.price_basis, 'kg');
});

/* ────────────────────────────────────────────────────────────────────────────
 * INTEGRITY — the demo data must not contradict itself
 * ──────────────────────────────────────────────────────────────────────────*/

test('the module-level constant matches the real course length', () => {
  assert.equal(DEFAULT_COURSE_MODULE_COUNT, COURSE_MODULES.length);
});

test('the demo network is 12-18 unmistakably-demo sites in KwaZulu-Natal', () => {
  const rows = DEMO_NETWORK.farmers;
  assert.ok(rows.length >= 12 && rows.length <= 18, `got ${rows.length}`);
  assert.equal(DEMO_NETWORK.isDemo, true);

  const ids = new Set<string>();
  const coords = new Set<string>();
  const names = new Set<string>();
  for (const { farmer: f } of rows) {
    assert.equal(f.isDemo, true, `${f.id} is not flagged demo`);
    assert.equal(f.consent, 'demo', `${f.id} carries a non-demo consent value`);
    // KwaZulu-Natal, roughly: 26.8S-31.1S, 28.9E-32.9E.
    assert.ok(f.lat < -26.8 && f.lat > -31.1, `${f.id} lat ${f.lat} is outside KZN`);
    assert.ok(f.lon > 28.9 && f.lon < 32.9, `${f.id} lon ${f.lon} is outside KZN`);
    assert.ok(f.plotSizeM2 > 0);
    assert.ok(Date.parse(f.joinedAt) < Date.now(), `${f.id} joined in the future`);
    ids.add(f.id);
    coords.add(`${f.lat},${f.lon}`);
    names.add(f.name);
  }
  assert.equal(ids.size, rows.length, 'duplicate farmer ids');
  assert.equal(coords.size, rows.length, 'two sites share a coordinate');
  assert.equal(names.size, rows.length, 'two farmers share a name');

  // No two cards may be copy-pasted: production totals must all differ.
  const produced = new Set(rows.map((r) => r.metrics.producedKg));
  assert.equal(produced.size, rows.length, 'two sites report identical production');

  assert.equal(demoFarmerById('demo-farmer-ubhejane')?.farmer.district, 'Mkhuze');
  assert.equal(demoFarmerById('nope'), null);
});

test('every demo farmer is internally coherent', () => {
  const net = buildDemoNetwork(NOW);
  for (const { farmer: f, sources, summary: s } of net.records) {
    const m = s.metrics;
    const where = `${f.id}`;

    assert.ok(m.producedKg !== null && m.soldKg !== null && m.incomeZar !== null, where);
    assert.ok(m.producedKg >= m.soldKg - 0.05, `${where}: sold more than it grew`);
    assert.ok(Math.abs((m.keptKg ?? 0) - (m.producedKg - m.soldKg)) < 0.2, `${where}: kept kg does not reconcile`);
    assert.ok(
      Math.abs((m.netZar ?? 0) - (m.incomeZar - (m.expensesZar ?? 0))) < 0.05,
      `${where}: net does not equal income minus expenses`,
    );
    // Cash only exists where kilograms were sold, and vice versa.
    assert.equal(m.incomeZar > 0, m.soldKg > 0, `${where}: income and sold kg disagree`);

    // A site cannot show more than a plausible year of production, and cannot
    // show a full season it has not lived through.
    const monthsCovered = Math.min(m.monthsActive, 12);
    assert.ok(monthsCovered > 0, `${where}: joined in the future`);
    const annualisedPerM2 = (m.producedKg / f.plotSizeM2) * (12 / monthsCovered);
    assert.ok(
      annualisedPerM2 <= DEMO_MAX_KG_PER_PLOT_M2_YEAR,
      `${where}: ${annualisedPerM2.toFixed(2)} kg/m²/yr is not a smallholder figure`,
    );
    assert.ok(annualisedPerM2 > 0.2, `${where}: implausibly low yield`);

    // No log may predate the farmer joining or postdate "now".
    const joined = Date.parse(f.joinedAt);
    const stamps = [
      ...(sources.production ?? []).map((r) => Date.parse(r.logged_at)),
      ...(sources.sales ?? []).map((r) => Date.parse(r.sold_at)),
      ...(sources.expenses ?? []).map((r) => Date.parse(r.spent_at)),
    ];
    for (const t of stamps) {
      assert.ok(t >= joined, `${where}: a log predates the join date`);
      assert.ok(t <= NOW.getTime(), `${where}: a log is in the future`);
    }

    // Training cannot exceed the course, and a recent joiner cannot have
    // finished more of it than months allow.
    assert.ok(m.modulesDone !== null && m.modulesDone <= m.modulesTotal, where);
    assert.ok((m.modulesDone ?? 0) <= m.monthsActive + 1, `${where}: finished modules faster than time passed`);

    // Survey answers are bounded by the questionnaire's own field count.
    assert.ok(m.surveyFilled !== null && m.surveyTotal !== null);
    assert.ok(m.surveyFilled <= m.surveyTotal, where);

    // No crop plan before month 5, so no plan-vs-actual figure either.
    if (m.monthsActive < 5) {
      assert.equal(m.plannedKg, null, `${where}: has a plan it should not`);
      assert.equal(m.harvestedVsPlannedPct, null, where);
    } else {
      assert.ok(m.plannedKg !== null && m.plannedKg > 0, where);
    }

    // Every logged crop name resolves to the real catalog.
    const catalogNames = new Set(CROPS.map((c) => c.name));
    for (const row of sources.production ?? []) {
      assert.ok(catalogNames.has(row.crop), `${where}: unknown crop "${row.crop}"`);
    }
  }
});

test('bigger demo plots generally produce more', () => {
  // Compared only among sites that have lived a full season, so plot size is
  // the variable rather than time in the programme.
  const established = buildDemoNetwork(NOW).farmers
    .filter((r) => r.metrics.monthsActive >= 12)
    .sort((a, b) => a.farmer.plotSizeM2 - b.farmer.plotSizeM2);
  assert.ok(established.length >= 8, `only ${established.length} established sites`);

  const half = Math.floor(established.length / 2);
  const mean = (rows: NetworkFarmerSummary[]) =>
    rows.reduce((t, r) => t + (r.metrics.producedKg ?? 0), 0) / rows.length;
  const small = mean(established.slice(0, half));
  const large = mean(established.slice(established.length - half));
  assert.ok(large > small * 1.5, `large sites averaged ${large} kg vs small ${small} kg`);
});

test('the demo portfolio contains both a success story and a problem case', () => {
  const rows = buildDemoNetwork(NOW).farmers;
  const flagged = rows.filter((r) => attentionFlags(r).length > 0);
  const clean = rows.filter((r) => attentionFlags(r).length === 0);
  assert.ok(flagged.length > 0, 'nothing needs attention — the demo has no story');
  assert.ok(clean.length > 0, 'everything needs attention — the demo looks broken');
  assert.ok(
    flagged.some((r) => attentionFlags(r).some((f) => f.kind === 'under_plan')),
    'no site is under-delivering against its plan',
  );
  // A portfolio where nobody ever goes quiet is not one a funder recognises,
  // and the dormancy flag would never be demonstrable on stage.
  assert.ok(
    flagged.some((r) => attentionFlags(r).some((f) => f.kind === 'dormant')),
    'no site has gone quiet — the dormancy flag cannot be demonstrated',
  );
  // Progress must be a real spread, not a column of near-identical numbers.
  const progresses = rows.map((r) => r.metrics.progressPct ?? 0);
  assert.ok(Math.min(...progresses) < 40, 'no site has visibly incomplete setup');
  assert.ok(Math.max(...progresses) > 90, 'no site has finished setting up');
});

test('every demo listing points at a real demo farmer and a real catalog crop', () => {
  assert.equal(DEMO_EXCHANGE.isDemo, true);
  assert.equal(
    DEMO_LISTINGS.length,
    DEMO_LISTING_SEED_COUNT,
    'a demo listing was dropped — its farmerId does not resolve',
  );

  const farmerIds = new Set(DEMO_NETWORK.farmers.map((r) => r.farmer.id));
  const cropKeys = new Set(CROPS.map((c) => c.key));
  const listingIds = new Set<string>();

  for (const l of DEMO_LISTINGS) {
    assert.ok(farmerIds.has(l.farmerId), `listing ${l.id} references unknown farmer ${l.farmerId}`);
    if (l.cropKey !== null) {
      assert.ok(cropKeys.has(l.cropKey), `listing ${l.id} references unknown crop ${l.cropKey}`);
      assert.ok(cropByKey(l.cropKey) !== undefined);
    }
    assert.equal(l.isDemo, true);
    assert.ok(Date.parse(l.postedAt) <= Date.now(), `listing ${l.id} was posted in the future`);
    assert.ok(l.qty === null || l.qty > 0, `listing ${l.id} has a non-positive quantity`);
    assert.equal(l.qty === null, l.unit === null, `listing ${l.id} has a quantity without a unit`);
    if (l.availableMonth !== null) {
      assert.ok(l.availableMonth >= 1 && l.availableMonth <= 12, `listing ${l.id} month`);
    }
    // COORDINATES ON A LISTING ARE COARSE, ALWAYS.
    assert.ok(l.lat !== null && l.lon !== null);
    assert.equal(l.lat, Math.round(l.lat * 100) / 100, `listing ${l.id} carries a precise latitude`);
    assert.equal(l.lon, Math.round(l.lon * 100) / 100, `listing ${l.id} carries a precise longitude`);

    // The denormalised name must match the network it came from.
    const source = demoFarmerById(l.farmerId);
    assert.equal(l.farmerName, source?.farmer.name, `listing ${l.id} name is out of sync`);

    listingIds.add(l.id);
  }
  assert.equal(listingIds.size, DEMO_LISTINGS.length, 'duplicate listing ids');
});

test('the demo board is walkable: offers, wants, several crops, several farmers', () => {
  const s = summariseExchange(DEMO_LISTINGS);
  assert.ok(s.offers >= 5, `only ${s.offers} offers`);
  assert.ok(s.wants >= 3, `only ${s.wants} wants`);
  assert.ok(s.cropCount >= 8, `only ${s.cropCount} crops represented`);
  assert.ok(s.farmerCount >= 8, `only ${s.farmerCount} farmers posting`);
  assert.ok(s.byCategory.seed > 0 && s.byCategory.seedlings > 0 && s.byCategory.produce > 0);
  assert.ok(s.byCategory.labour > 0, 'no labour-share listing to demo');

  // Sorting nearest from the owner's own demo farm produces a real spread.
  const results = searchListings(DEMO_LISTINGS, {
    sort: 'nearest',
    origin: { lat: -27.726231, lon: 31.963044 },
  });
  assert.ok(results.length > 0);
  assert.equal(results[0].km !== null && results[0].km < 2, true);
  const furthest = results[results.length - 1].km;
  assert.ok(furthest !== null && furthest > 100, `furthest listing was only ${furthest} km away`);
});

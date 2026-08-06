/*
 * ═══ DEMO DATA — NOT REAL FARMERS, NOT REAL FINANCES ═════════════════════════
 *
 * Every record in this file is invented. The PEOPLE do not exist, the money did
 * not change hands, and the harvests were never grown. Only the GEOGRAPHY is
 * real: each site sits on a genuine KwaZulu-Natal coordinate (Mkhuze, Jozini,
 * Nongoma, Msinga, Bergville, Ixopo …) so the funder map shows plausible rural
 * spacing and a real satellite basemap resolves underneath it.
 *
 * The anchor site, Ubhejane Crèche near Mkhuze, uses the same coordinate as
 * `DEMO_SITE` in lib/demo-farm.ts (-27.726231, 31.963044). That constant is NOT
 * imported here: lib/demo-farm.ts is owned by another workstream and pulls in
 * the whole design-canvas module graph, which this pure module must stay clear
 * of. If that coordinate ever moves, move this one with it.
 *
 * EVERYTHING IS REACHABLE FROM ONE EXPORTED CONSTANT — {@link DEMO_NETWORK} —
 * so no consumer can accidentally treat a demo row as a live one: every farmer
 * carries `isDemo: true` and `consent: 'demo'`, and {@link DEMO_NETWORK_NOTICE}
 * is the string the UI is expected to render next to any of it.
 *
 * WHY GENERATED RATHER THAN HAND-TYPED: the numbers are produced by running
 * hand-authored per-site inputs through the REAL selectors in lib/network.ts.
 * That makes the demo internally coherent by construction rather than by
 * proofreading — a site that joined three months ago cannot show a full season
 * of history, a bigger plot produces more, income tracks the kilograms sold,
 * and the plan-vs-actual gap follows the site's own vigour. A seeded PRNG
 * (deterministic, no Math.random) gives every site its own crop mix, prices,
 * log dates and training pace, so no two cards look copy-pasted.
 *
 * Pure module: no I/O, no localStorage, no Firestore, no React.
 */

import { cropByKey } from './crop-catalog';
import type {
  CourseProgress,
  ExpenseLog,
  GardenStatus,
  ProductionLog,
  SalesLog,
  SurveyResponse,
} from './db/types';
import type { CompletionScoreInputs } from './completion-score';
import type { CropRow, ReconciliationResult } from './harvest-reconciliation';
import {
  buildFarmerSummary,
  type FarmerDataSources,
  type NetworkCohort,
  type NetworkFarmer,
  type NetworkFarmerSummary,
  type NetworkOrg,
} from './network';

export const DEMO_NETWORK_NOTICE =
  'Sample portfolio — invented farmers and finances on real KwaZulu-Natal locations. No live farmer data is shown.';

/** Real course length (lib/course-modules.ts COURSE_MODULES). */
const COURSE_MODULE_IDS = [
  'intro-permaculture',
  'reading-landscape',
  'water-harvesting',
  'soil-health',
  'vegetables-staples',
  'seeds-sovereignty',
  'plant-guilds',
  'food-forest',
  'small-livestock',
  'market-community',
] as const;

/** Site-survey denominator used across the app's completion score. */
const SURVEY_TOTAL_FIELDS = 10;

/**
 * Farm-gate R/kg used to turn demo kilograms into demo Rands. Sits a little
 * above the wholesale column in lib/crop-prices.ts (`DEFAULT_CROP_PRICES`) and
 * well below retail — roughly what a KZN smallholder gets selling at the gate,
 * to hawkers or into a school feeding scheme. Not imported from crop-prices.ts
 * on purpose: that module reaches through account-local-storage into the
 * Firebase client, which this pure, test-runnable module must not drag in.
 */
const DEMO_FARM_GATE_ZAR_PER_KG: Record<string, number> = {
  maize: 7,
  'dry-beans': 32,
  'green-beans': 18,
  butternut: 8,
  pumpkin: 5,
  'swiss-chard': 6,
  kale: 14,
  cabbage: 5,
  carrots: 8,
  beetroot: 13,
  onions: 12,
  tomatoes: 17,
  peppers: 14,
  'sweet-potato': 10,
  potato: 9,
  lettuce: 10,
  amadumbe: 30,
  groundnuts: 26,
  peas: 24,
  oats: 4,
};

/* ────────────────────────────────────────────────────────────────────────────
 * Deterministic PRNG — no Math.random, so the demo renders identically on
 * every machine and every test run.
 * ──────────────────────────────────────────────────────────────────────────*/

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/* ────────────────────────────────────────────────────────────────────────────
 * The organisations
 * ──────────────────────────────────────────────────────────────────────────*/

export const DEMO_FUNDER: NetworkOrg = {
  id: 'demo-funder-thembalethu',
  name: 'Thembalethu Trust (sample funder)',
  kind: 'funder',
  region: 'KwaZulu-Natal',
};

export const DEMO_IMPLEMENTER: NetworkOrg = {
  id: 'demo-org-imbewu-kzn',
  name: 'Imbewu KZN (sample implementing partner)',
  kind: 'ngo',
  region: 'KwaZulu-Natal',
};

export const DEMO_COHORTS: NetworkCohort[] = [
  {
    id: 'demo-cohort-mkhuze-1',
    orgId: DEMO_IMPLEMENTER.id,
    name: 'Mkhuze Valley — Intake 1',
    startedAt: '',
    deployedZar: 640000,
  },
  {
    id: 'demo-cohort-zululand-2',
    orgId: DEMO_IMPLEMENTER.id,
    name: 'Zululand Uplands — Intake 2',
    startedAt: '',
    deployedZar: 415000,
  },
  {
    id: 'demo-cohort-midlands-3',
    orgId: DEMO_IMPLEMENTER.id,
    name: 'Midlands & Foothills — Intake 3',
    startedAt: '',
    deployedZar: 180000,
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * The 16 sites — hand-authored, one line of judgement each
 * ──────────────────────────────────────────────────────────────────────────*/

interface DemoSiteSeed {
  id: string;
  farmerName: string;
  siteName: string;
  /** Nearest real town. */
  district: string;
  /** Real KZN district municipality. */
  municipality: string;
  lat: number;
  lon: number;
  plotSizeM2: number;
  plotLabel: string;
  cohortId: string;
  /** Whole months before "now" that this farmer joined. */
  joinedMonthsAgo: number;
  status: GardenStatus;
  /** Catalog keys (lib/crop-catalog.ts) actually grown here. */
  crops: string[];
  /** 1.0 = the plan's assumed yield. Below 1 under-delivers, above 1 over-delivers. */
  vigour: number;
  /** Share of the harvest that gets sold rather than eaten or given away. */
  sellShare: number;
  /** Input costs as a share of cash income, once the site is earning. */
  costShare: number;
  /** Course modules completed per month of membership. */
  modulePace: number;
  /** NGO survey rounds this farmer has answered. */
  surveysAnswered: number;
  /**
   * Days of silence: every log — harvest, sale, expense, course — is pushed at
   * least this far into the past. A portfolio where nobody ever goes quiet is
   * not a portfolio a funder recognises, and the dormancy flag would never be
   * demonstrable. Leave unset for an active site.
   */
  dormantDays?: number;
}

const DEMO_SITE_SEEDS: DemoSiteSeed[] = [
  {
    id: 'demo-farmer-ubhejane',
    farmerName: 'Nomsa Mthembu',
    siteName: 'Ubhejane Crèche Garden',
    district: 'Mkhuze',
    municipality: 'uMkhanyakude',
    lat: -27.726231,
    lon: 31.963044, // same coordinate as DEMO_SITE in lib/demo-farm.ts
    plotSizeM2: 1400,
    plotLabel: 'Crèche block',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 31,
    status: 'thriving',
    crops: ['swiss-chard', 'amadumbe', 'maize', 'butternut', 'dry-beans'],
    vigour: 1.18,
    sellShare: 0.62,
    costShare: 0.28,
    modulePace: 0.5,
    surveysAnswered: 3,
  },
  {
    id: 'demo-farmer-kwajobe',
    farmerName: 'Sipho Ndlovu',
    siteName: 'KwaJobe Homestead Plot',
    district: 'Jozini',
    municipality: 'uMkhanyakude',
    lat: -27.4297,
    lon: 32.0644,
    plotSizeM2: 620,
    plotLabel: 'Plot 14',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 29,
    status: 'establishing',
    crops: ['sweet-potato', 'maize', 'pumpkin', 'swiss-chard'],
    vigour: 0.86,
    sellShare: 0.51,
    costShare: 0.38,
    modulePace: 0.28,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-mduku',
    farmerName: 'Thandeka Zulu',
    siteName: 'Mduku Community Garden',
    district: 'Hluhluwe',
    municipality: 'uMkhanyakude',
    lat: -28.0208,
    lon: 32.2686,
    plotSizeM2: 2100,
    plotLabel: 'Block A + B',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 30,
    status: 'thriving',
    crops: ['butternut', 'dry-beans', 'swiss-chard', 'tomatoes', 'maize'],
    vigour: 1.24,
    sellShare: 0.74,
    costShare: 0.31,
    modulePace: 0.44,
    surveysAnswered: 3,
  },
  {
    id: 'demo-farmer-nongoma',
    farmerName: 'Bongani Nkosi',
    siteName: 'Nkosi Family Plot',
    district: 'Nongoma',
    municipality: 'Zululand',
    lat: -27.9036,
    lon: 31.6408,
    plotSizeM2: 480,
    plotLabel: 'Homestead plot',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 16,
    status: 'establishing',
    crops: ['maize', 'dry-beans', 'swiss-chard'],
    vigour: 0.79,
    sellShare: 0.44,
    costShare: 0.46,
    modulePace: 0.31,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-mahlabathini',
    farmerName: 'Zanele Buthelezi',
    siteName: 'eMahlabathini Youth Garden',
    district: 'Ulundi',
    municipality: 'Zululand',
    lat: -28.25,
    lon: 31.4167,
    plotSizeM2: 1750,
    plotLabel: 'Youth block',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 17,
    status: 'thriving',
    crops: ['cabbage', 'swiss-chard', 'beetroot', 'tomatoes', 'maize'],
    vigour: 1.12,
    sellShare: 0.68,
    costShare: 0.33,
    modulePace: 0.52,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-pongola',
    farmerName: 'Musa Ncwane',
    siteName: 'Ncwane Riverside Plot',
    district: 'Pongola',
    municipality: 'Zululand',
    lat: -27.3711,
    lon: 31.6169,
    plotSizeM2: 900,
    plotLabel: 'Riverside strip',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 27,
    status: 'support',
    crops: ['groundnuts', 'maize', 'pumpkin'],
    // A deliberate problem case for the demo: dropped off after the second
    // season. Under-delivers against plan, spends more than it earns, and its
    // last log is old enough to trip the dormancy flag.
    vigour: 0.48,
    sellShare: 0.35,
    costShare: 1.35,
    modulePace: 0.09,
    surveysAnswered: 1,
    dormantDays: 165,
  },
  {
    id: 'demo-farmer-mtubatuba',
    farmerName: 'Lindiwe Gumede',
    siteName: 'Mtuba Station Garden',
    district: 'Mtubatuba',
    municipality: 'uMkhanyakude',
    lat: -28.4181,
    lon: 32.1836,
    plotSizeM2: 1150,
    plotLabel: 'Station plot',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 15,
    status: 'establishing',
    crops: ['swiss-chard', 'amadumbe', 'sweet-potato', 'green-beans'],
    vigour: 0.97,
    sellShare: 0.66,
    costShare: 0.35,
    modulePace: 0.39,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-hlabisa',
    farmerName: 'Ntombi Khumalo',
    siteName: 'Hlabisa Clinic Garden',
    district: 'Hlabisa',
    municipality: 'uMkhanyakude',
    lat: -28.14,
    lon: 31.868,
    plotSizeM2: 760,
    plotLabel: 'Clinic yard',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 14,
    status: 'thriving',
    crops: ['swiss-chard', 'kale', 'beetroot', 'onions'],
    vigour: 1.09,
    sellShare: 0.58,
    costShare: 0.27,
    modulePace: 0.47,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-nquthu',
    farmerName: 'Sanele Mabaso',
    siteName: 'Nquthu Ridge Plot',
    district: 'Nquthu',
    municipality: 'uMzinyathi',
    lat: -28.2119,
    lon: 30.68,
    plotSizeM2: 1320,
    plotLabel: 'Ridge plot',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 28,
    status: 'establishing',
    crops: ['maize', 'dry-beans', 'potato', 'cabbage'],
    vigour: 0.91,
    sellShare: 0.57,
    costShare: 0.42,
    modulePace: 0.33,
    surveysAnswered: 3,
  },
  {
    id: 'demo-farmer-vryheid',
    farmerName: 'Petrus Sithole',
    siteName: 'Vryheid Smallholding',
    district: 'Vryheid',
    municipality: 'Zululand',
    lat: -27.7692,
    lon: 30.7914,
    plotSizeM2: 2400,
    plotLabel: 'Erf 221',
    cohortId: 'demo-cohort-mkhuze-1',
    joinedMonthsAgo: 32,
    status: 'thriving',
    crops: ['potato', 'cabbage', 'maize', 'dry-beans', 'onions'],
    vigour: 1.31,
    sellShare: 0.81,
    costShare: 0.36,
    modulePace: 0.41,
    surveysAnswered: 3,
  },
  {
    id: 'demo-farmer-msinga',
    farmerName: 'Nokuthula Dlamini',
    siteName: 'Msinga Dryland Plot',
    district: 'Tugela Ferry',
    municipality: 'uMzinyathi',
    lat: -28.7461,
    lon: 30.4489,
    plotSizeM2: 540,
    plotLabel: 'Dryland plot',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 13,
    status: 'support',
    crops: ['maize', 'dry-beans', 'pumpkin'],
    vigour: 0.57,
    sellShare: 0.29,
    costShare: 0.88,
    modulePace: 0.19,
    surveysAnswered: 1,
  },
  {
    id: 'demo-farmer-greytown',
    farmerName: 'Andile Mkhize',
    siteName: 'Greytown Church Garden',
    district: 'Greytown',
    municipality: 'uMzinyathi',
    lat: -29.0592,
    lon: 30.5928,
    plotSizeM2: 1600,
    plotLabel: 'Church field',
    cohortId: 'demo-cohort-zululand-2',
    joinedMonthsAgo: 18,
    status: 'thriving',
    crops: ['cabbage', 'carrots', 'swiss-chard', 'beetroot', 'peas'],
    vigour: 1.15,
    sellShare: 0.72,
    costShare: 0.3,
    modulePace: 0.48,
    surveysAnswered: 2,
  },
  {
    id: 'demo-farmer-eshowe',
    farmerName: 'Philani Cele',
    siteName: 'Eshowe Hilltop Garden',
    district: 'Eshowe',
    municipality: 'King Cetshwayo',
    lat: -28.8917,
    lon: 31.4667,
    plotSizeM2: 880,
    plotLabel: 'Hilltop plot',
    cohortId: 'demo-cohort-midlands-3',
    joinedMonthsAgo: 5,
    status: 'establishing',
    crops: ['swiss-chard', 'kale', 'tomatoes'],
    vigour: 0.88,
    sellShare: 0.4,
    costShare: 0.95,
    modulePace: 0.5,
    surveysAnswered: 1,
  },
  {
    id: 'demo-farmer-melmoth',
    farmerName: 'Sindi Ngobese',
    siteName: 'Melmoth Roadside Plot',
    district: 'Melmoth',
    municipality: 'King Cetshwayo',
    lat: -28.5872,
    lon: 31.4008,
    plotSizeM2: 420,
    plotLabel: 'Roadside strip',
    cohortId: 'demo-cohort-midlands-3',
    joinedMonthsAgo: 3,
    // Newest joiner in the portfolio: first beds only, no crop plan yet, so no
    // plan-vs-actual figure exists for this card at all.
    status: 'establishing',
    crops: ['swiss-chard', 'green-beans'],
    vigour: 0.82,
    sellShare: 0.2,
    costShare: 1.6,
    modulePace: 0.55,
    surveysAnswered: 0,
  },
  {
    id: 'demo-farmer-bergville',
    farmerName: 'Jabulani Hadebe',
    siteName: 'Bergville Foothills Plot',
    district: 'Bergville',
    municipality: 'uThukela',
    lat: -28.7333,
    lon: 29.3583,
    plotSizeM2: 1900,
    plotLabel: 'Foothills block',
    cohortId: 'demo-cohort-midlands-3',
    joinedMonthsAgo: 6,
    status: 'establishing',
    crops: ['potato', 'cabbage', 'carrots', 'oats'],
    vigour: 1.02,
    sellShare: 0.55,
    costShare: 0.62,
    modulePace: 0.42,
    surveysAnswered: 1,
  },
  {
    id: 'demo-farmer-ixopo',
    farmerName: 'Nolwazi Shabalala',
    siteName: 'Ixopo Mission Garden',
    district: 'Ixopo',
    municipality: 'Harry Gwala',
    lat: -30.1544,
    lon: 30.0578,
    plotSizeM2: 1050,
    plotLabel: 'Mission plot',
    cohortId: 'demo-cohort-midlands-3',
    joinedMonthsAgo: 4,
    status: 'establishing',
    crops: ['cabbage', 'swiss-chard', 'beetroot'],
    vigour: 0.94,
    sellShare: 0.33,
    costShare: 1.1,
    modulePace: 0.6,
    surveysAnswered: 1,
  },
];

/* ────────────────────────────────────────────────────────────────────────────
 * The yield model — one place, so coherence is structural
 * ──────────────────────────────────────────────────────────────────────────*/

/** Share of a plot that is actually under beds rather than paths, water, tools. */
const BED_FRACTION = 0.45;
/** Kilograms per square metre of BED per year at vigour 1.0 — mixed KZN veg. */
const KG_PER_BED_M2_YEAR = 3.4;

/**
 * Upper bound on annualised kilograms per square metre of PLOT that any demo
 * site may show. Anything above this stops being a smallholder market garden
 * and starts being a number nobody in the sector would believe.
 * tests/network.test.ts enforces it.
 */
export const DEMO_MAX_KG_PER_PLOT_M2_YEAR = 2.6;

/** Intended (planned) kilograms for a site's covered period, at vigour 1.0. */
function intendedKgFor(seed: DemoSiteSeed, monthsCovered: number): number {
  return seed.plotSizeM2 * BED_FRACTION * KG_PER_BED_M2_YEAR * (monthsCovered / 12);
}

function isoAt(now: Date, daysAgo: number): string {
  return new Date(now.getTime() - daysAgo * 86400000).toISOString();
}

/** joinedAt such that `monthsBetween(joinedAt, now)` is EXACTLY joinedMonthsAgo. */
function joinedIso(now: Date, monthsAgo: number, dayHint: number): string {
  const day = Math.min(Math.max(1, dayHint), Math.min(28, now.getDate()));
  const d = new Date(now.getFullYear(), now.getMonth() - monthsAgo, day, 9, 0, 0);
  return d.toISOString();
}

export interface DemoFarmerRecord {
  farmer: NetworkFarmer;
  /** The raw ledgers, so a drill-down can show the same rows the metrics came from. */
  sources: FarmerDataSources;
  summary: NetworkFarmerSummary;
}

function buildRecord(seed: DemoSiteSeed, now: Date): DemoFarmerRecord {
  const rng = mulberry32(hashString(seed.id));
  const monthsActive = seed.joinedMonthsAgo;
  // A season of history is 12 months at most, and never more history than the
  // farmer has actually been in the programme. This single line is what stops a
  // three-month-old site showing a full year of harvests.
  const monthsCovered = Math.min(monthsActive, 12);
  const joinedAt = joinedIso(now, monthsActive, 1 + (hashString(seed.id) % 12));
  const joinedMs = Date.parse(joinedAt);

  const cohort = DEMO_COHORTS.find((c) => c.id === seed.cohortId) ?? null;
  // Days of silence pushed onto EVERY log stream, so a dormant site is dormant
  // across harvests, sales, expenses and training alike — not quiet in one
  // ledger and busy in another, which would read as a data bug on stage.
  const silence = seed.dormantDays ?? 0;

  const farmer: NetworkFarmer = {
    id: seed.id,
    name: seed.farmerName,
    orgId: DEMO_IMPLEMENTER.id,
    cohortId: seed.cohortId,
    cohortName: cohort ? cohort.name : null,
    siteName: seed.siteName,
    district: seed.district,
    municipality: seed.municipality,
    lat: seed.lat,
    lon: seed.lon,
    // Demo coordinates are "exact" in the sense the type means: they are the
    // site's own position, not a coarsened one. They are safe here only
    // because nobody lives at them.
    coordPrecision: 'exact',
    plotSizeM2: seed.plotSizeM2,
    plotLabel: seed.plotLabel,
    joinedAt,
    status: seed.status,
    photoUrl: null,
    consent: 'demo',
    isDemo: true,
  };

  // ── split the intended harvest across this site's crops ──
  const intendedTotal = intendedKgFor(seed, monthsCovered);
  const weights = seed.crops.map(() => 0.6 + rng() * 0.8);
  const weightTotal = weights.reduce((a, b) => a + b, 0);

  const production: ProductionLog[] = [];
  const sales: SalesLog[] = [];
  const cropRows: CropRow[] = [];

  const buyers = [
    'Local hawkers',
    'School feeding scheme',
    'Spar Mkhuze',
    'Neighbours',
    'Boxer Mtubatuba',
    'Roadside market',
  ];

  seed.crops.forEach((cropKey, i) => {
    const def = cropByKey(cropKey);
    const cropName = def ? def.name : cropKey;
    const icon = def ? def.icon : '🌱';

    const intendedKg = round((intendedTotal * weights[i]) / weightTotal, 1);
    // Per-crop noise on top of the site's vigour, so two crops on one site
    // never land on the same ratio.
    const cropVigour = seed.vigour * (0.85 + rng() * 0.3);
    const harvestedKg = round(Math.max(0, intendedKg * cropVigour), 1);

    // 1-3 harvest events, spread back through the covered period.
    const events = 1 + Math.floor(rng() * Math.min(3, Math.max(1, monthsCovered - 1)));
    let logged = 0;
    for (let e = 0; e < events; e += 1) {
      const share = e === events - 1 ? harvestedKg - logged : round(harvestedKg / events, 1);
      if (share <= 0) continue;
      logged += share;
      const daysAgo = Math.round(
        (monthsCovered - 1) * 30.44 * (e / Math.max(1, events)) + rng() * 18 + 4 + silence,
      );
      const stamp = Math.max(joinedMs + 3 * 86400000, now.getTime() - daysAgo * 86400000);
      production.push({
        id: `${seed.id}-prod-${cropKey}-${e}`,
        profile_id: seed.id,
        garden_id: seed.id,
        crop: cropName,
        kg: share,
        photo_url: null,
        logged_at: new Date(stamp).toISOString(),
        created_at: new Date(stamp).toISOString(),
      });
    }

    const soldKg = round(harvestedKg * seed.sellShare * (0.9 + rng() * 0.2), 1);
    if (soldKg > 0.5) {
      const basePrice = DEMO_FARM_GATE_ZAR_PER_KG[cropKey] ?? 9;
      const price = round(basePrice * (0.88 + rng() * 0.28), 2);
      const daysAgo = Math.round(rng() * Math.max(20, (monthsCovered - 1) * 26) + 6 + silence);
      const stamp = Math.max(joinedMs + 5 * 86400000, now.getTime() - daysAgo * 86400000);
      sales.push({
        id: `${seed.id}-sale-${cropKey}`,
        profile_id: seed.id,
        garden_id: seed.id,
        crop: cropName,
        kg: soldKg,
        amount: round(soldKg * price, 2),
        buyer: buyers[Math.floor(rng() * buyers.length)],
        sold_at: new Date(stamp).toISOString(),
        created_at: new Date(stamp).toISOString(),
      });
    }

    // Demo rows follow the same honesty rule as the real ones: when a crop shows more sold than
    // harvested, the kept figure is unknown rather than zero. It is generated data, so this should
    // never fire — but a demo that models the clamp would teach the wrong shape to anyone reading
    // it, and would drift from CropRow the moment the real rule changed again.
    const soldExceedsHarvested = soldKg > harvestedKg;
    const keptKg = soldExceedsHarvested ? null : round(harvestedKg - soldKg, 1);
    cropRows.push({
      cropKey,
      cropName,
      icon,
      intendedKg,
      harvestedKg,
      soldKg,
      keptKg,
      yieldGap: soldExceedsHarvested ? false : harvestedKg < intendedKg * 0.8,
      keptGap: keptKg !== null && keptKg > harvestedKg * 0.5,
      soldExceedsHarvested,
    });
  });

  const incomeZar = sales.reduce((t, s) => t + s.amount, 0);

  // ── expenses: a young site spends before it earns, so costs are floored on
  //    plot size rather than derived from income it has not made yet. ──
  const startupFloor = seed.plotSizeM2 * 0.9;
  const targetExpenses =
    monthsActive < 9 ? Math.max(startupFloor, incomeZar * seed.costShare) : incomeZar * seed.costShare;

  const expenseTemplate: Array<{
    item: string;
    supplier: string | null;
    category: ExpenseLog['category'];
    share: number;
  }> = [
    { item: 'Vegetable seed and seedlings', supplier: 'Mkhuze Farmers Co-op', category: 'seed', share: 0.34 },
    { item: 'Compost and kraal manure', supplier: 'Local supplier', category: 'other', share: 0.24 },
    { item: 'Transport to market', supplier: 'Bakkie hire', category: 'transport', share: 0.18 },
    { item: 'Shade cloth and irrigation pipe', supplier: 'Agri Depot Vryheid', category: 'equipment', share: 0.14 },
    { item: 'Casual labour — bed preparation', supplier: null, category: 'labour', share: 0.1 },
  ];

  const expenses: ExpenseLog[] = expenseTemplate
    .map((row, i) => {
      const amount = round(targetExpenses * row.share * (0.85 + rng() * 0.3), 2);
      const daysAgo = Math.round(rng() * Math.max(25, monthsCovered * 26) + 8 + silence);
      const stamp = Math.max(joinedMs + 86400000, now.getTime() - daysAgo * 86400000);
      return {
        id: `${seed.id}-exp-${i}`,
        profile_id: seed.id,
        garden_id: seed.id,
        item: row.item,
        amount,
        supplier: row.supplier,
        spent_at: new Date(stamp).toISOString(),
        created_at: new Date(stamp).toISOString(),
        category: row.category,
      } satisfies ExpenseLog;
    })
    .filter((e) => e.amount > 0);

  // ── training: modules accumulate with months in the programme ──
  const modulesDone = Math.max(
    0,
    Math.min(COURSE_MODULE_IDS.length, Math.round(monthsActive * seed.modulePace)),
  );
  const courses: CourseProgress[] = COURSE_MODULE_IDS.map((module, i) => {
    const done = i < modulesDone;
    const daysAgo = Math.round((done ? (modulesDone - i) * 14 + rng() * 10 : rng() * 40 + 5) + silence);
    const stamp = Math.max(joinedMs + 2 * 86400000, now.getTime() - daysAgo * 86400000);
    return {
      id: `${seed.id}-course-${module}`,
      profile_id: seed.id,
      module,
      done,
      updated_at: new Date(stamp).toISOString(),
    };
  }).filter((c, i) => c.done || i < modulesDone + 2); // only the next couple of modules are "touched"

  // ── NGO survey responses ──
  const surveys: SurveyResponse[] = Array.from({ length: seed.surveysAnswered }, (_, i) => ({
    id: `${seed.id}-survey-${i}`,
    survey_id: `demo-survey-round-${i + 1}`,
    profile_id: seed.id,
    answers: {
      water_access: i === 0 ? 'Municipal tap' : 'Rainwater tank + tap',
      selling_regularly: seed.sellShare > 0.5 ? 'Yes' : 'Sometimes',
      biggest_challenge: seed.status === 'support' ? 'Water in winter' : 'Transport to market',
    },
    created_at: isoAt(now, 40 + i * 150),
  }));

  // ── site progress (survey / boundary / design / crop plan) ──
  //     These four come from user_map_data + localStorage in the real app and
  //     are NOT readable cross-account — see the banner in lib/network.ts.
  const established = monthsActive >= 12;
  const settled = monthsActive >= 6;

  // Setup completeness tracks ENGAGEMENT, not tenure. Time in the programme
  // alone would put every established site at 95-100% and make the progress
  // column a constant — useless to a funder scanning for who needs a visit.
  // A farmer who stopped doing the course also stopped tracing beds and
  // filling in the survey, which is exactly what the real data looks like.
  const engagement = Math.min(1.2, Math.max(0.25, seed.modulePace / 0.45));
  // The design studio is a deliberate act, not a by-product of time: a
  // disengaged farmer simply never opened it.
  const designed = settled && engagement >= 0.5;

  const completion: CompletionScoreInputs = {
    hasSite: true,
    boundaryPointCount: Math.round(
      (established ? 5 + rng() * 7 : settled ? 3 + rng() * 3 : rng() * 3) * engagement,
    ),
    surveyFilledFields: Math.min(
      SURVEY_TOTAL_FIELDS,
      Math.round((established ? 8 : settled ? 6 : 3) * engagement + rng()),
    ),
    surveyTotalFields: SURVEY_TOTAL_FIELDS,
    zoneCount: designed ? Math.round(3 + rng() * 6 * engagement) : 0,
    elementCount: designed
      ? Math.round(5 + rng() * 14 * engagement)
      : settled
        ? Math.floor(rng() * 3)
        : 0,
    hasCropPlan: monthsActive >= 5,
  };

  // A site with no crop plan has nothing to reconcile against — the funder card
  // must show "no plan yet", not "0% of plan delivered".
  const reconciliation: ReconciliationResult | null = completion.hasCropPlan
    ? {
        matched: cropRows.filter((r) => r.harvestedKg > 0),
        notYetHarvested: cropRows.filter((r) => r.harvestedKg === 0),
        unmatchedPlanned: [],
        unplannedActivity: [],
      }
    : null;

  const sources: FarmerDataSources = {
    production,
    sales,
    expenses,
    courses,
    surveys,
    completion,
    reconciliation,
    courseModuleCount: COURSE_MODULE_IDS.length,
    now,
  };

  return { farmer, sources, summary: buildFarmerSummary(farmer, sources) };
}

export interface DemoNetwork {
  /** Always true. Anything reading this constant is reading sample data. */
  readonly isDemo: true;
  readonly notice: string;
  readonly funder: NetworkOrg;
  readonly implementer: NetworkOrg;
  readonly cohorts: NetworkCohort[];
  /** Full records — farmer, raw ledgers, derived metrics. */
  readonly records: DemoFarmerRecord[];
  /** Just the summaries, ready for every selector in lib/network.ts. */
  readonly farmers: NetworkFarmerSummary[];
  /** When this snapshot was generated — all relative dates hang off it. */
  readonly generatedAt: string;
}

/**
 * Build the demo portfolio relative to a given "now". Pass a fixed date in
 * tests; the exported {@link DEMO_NETWORK} uses the real clock so the demo
 * never drifts into showing farmers who joined in the future.
 */
export function buildDemoNetwork(now: Date = new Date()): DemoNetwork {
  const records = DEMO_SITE_SEEDS.map((seed) => buildRecord(seed, now));
  const cohorts = DEMO_COHORTS.map((c) => {
    const members = records.filter((r) => r.farmer.cohortId === c.id);
    const earliest = members
      .map((m) => m.farmer.joinedAt)
      .sort()[0];
    return { ...c, startedAt: earliest ?? now.toISOString() };
  });

  return {
    isDemo: true,
    notice: DEMO_NETWORK_NOTICE,
    funder: DEMO_FUNDER,
    implementer: DEMO_IMPLEMENTER,
    cohorts,
    records,
    farmers: records.map((r) => r.summary),
    generatedAt: now.toISOString(),
  };
}

/**
 * THE single entry point to the demo portfolio. Sixteen invented smallholders
 * on real KwaZulu-Natal coordinates. Import this and nothing else from here if
 * all you need is the data.
 */
export const DEMO_NETWORK: DemoNetwork = buildDemoNetwork();

/** Ids only — handy for wiring demo listings in lib/exchange.ts. */
export const DEMO_FARMER_IDS: string[] = DEMO_SITE_SEEDS.map((s) => s.id);

/** Look a demo farmer up by id. Returns null rather than throwing. */
export function demoFarmerById(id: string): DemoFarmerRecord | null {
  return DEMO_NETWORK.records.find((r) => r.farmer.id === id) ?? null;
}

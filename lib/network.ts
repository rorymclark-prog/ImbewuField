/*
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  ACCESS-CONTROL PRECONDITION — READ THIS BEFORE FEEDING REAL DATA IN     ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 *
 * THIS MODULE SHOWS ONE PERSON'S DATA TO ANOTHER PERSON. That is the whole
 * point of a funder portfolio: a funder or NGO staff member looks at a
 * farmer's site, money, surveys and progress. Every type and selector below
 * is therefore a cross-account read waiting to happen.
 *
 * AS SHIPPED, THIS MODULE IS FED **DEMO DATA ONLY** (see lib/network-demo.ts).
 * Wiring it to real farmers without the four preconditions below is a POPIA
 * data breach, not a feature. Do not "just try it and see if the rules allow
 * it" — some of these reads SUCCEED today and leak.
 *
 * ── STATUS 2026-08-26: (A)-(D) ARE NOW BUILT, AND NOT YET DEPLOYED ─────────
 *
 *  The four preconditions below were written as a to-do list and have been
 *  worked through. What each one became:
 *
 *    A → lib/network-access.ts (steps ii+iii, pure and unit-tested) and
 *        app/api/network/farmers/route.ts (steps i+iv, Admin-SDK projection).
 *    B → `Profile.funded_org_ids`, admin-SDK-write-only and pinned immutable
 *        in firestore.rules; written by `provision-org.mjs --fund <orgId>`.
 *    C → lib/consent.ts + /farmer_consents/{uid} + components/ConsentPanel.tsx.
 *        `NetworkFarmer.consent` is now a real per-scope, revocable record for
 *        any row this route produces; it stays 'demo' for lib/network-demo.ts.
 *    D → the three collections are org-scoped and covered by nine cases in
 *        tests/firestore-rules.test.ts, seven of which fail against the old rules.
 *
 *  WHAT IS STILL NOT TRUE, so read the paragraphs below as history plus these
 *  three live caveats:
 *    • THE RULES IN THIS REPO ARE NOT THE RULES IN PRODUCTION until someone
 *      deploys them. Until then every leak described in (3) is still open live.
 *    • scripts/backfill-org-id.mjs has NOT been run against a real database.
 *      Existing training/survey rows carry no org_id, so after the rules deploy
 *      they fail closed and vanish from mentor dashboards until it runs.
 *    • REQUIRE_API_AUTH is still unset, so lib/api-auth.ts remains log-only for
 *      every other route. The new route refuses a null uid on its own account.
 *
 * ── WHAT IS ACTUALLY TRUE OF THE DEPLOYED RULES (firestore.rules, read
 *    2026-08-05; agents in this checkout may not edit or deploy them) ───────
 *
 *  1. `isStaff()` (firestore.rules:13) = ngo | funder | admin. A FUNDER IS
 *     NOT DISTINGUISHED FROM AN NGO ANYWHERE IN THE RULES, and `gardens`
 *     allows `write: if isStaff()` (line ~64). A "read-only funder" is a UI
 *     convention right now, not a security property.
 *
 *  2. THE MONEY COLLECTIONS ARE CORRECTLY ORG-SCOPED — and only org-scoped.
 *     `production_logs`, `sales_logs`, `expense_logs` all read as
 *     `owns(d) || sameOrg(d) || (isMentor() && inMyOrg(d))`. `sameOrg()`
 *     compares ONE scalar, `Profile.org_id`. A real funder funds SEVERAL
 *     NGOs; that relationship cannot be expressed today. See (4).
 *
 *  3. THREE COLLECTIONS ARE UNSCOPED AND WILL LEAK ACROSS ORGS TODAY:
 *       • `survey_responses` read  = `profile_id == uid || isStaff()`  ← bare
 *       • `course_progress`  read  = `isStaff() || isMentor()`         ← bare
 *       • `course_submissions`     = same                              ← bare
 *       • `profiles` list          = any staff/mentor lists EVERY profile
 *     i.e. ANY funder/NGO/admin account, in ANY org, can read EVERY farmer's
 *     survey answers and training record in the entire database. Those docs
 *     carry no `org_id` at all, so the rule cannot be scoped until
 *     `addSurveyResponse` (lib/db/queries.ts) denormalises `org_id` FIRST.
 *     `NetworkFarmerMetrics.surveysAnswered` and `.trainingPct` are exactly
 *     the fields fed by those collections. Treat them as UNSAFE until fixed.
 *
 *  4. SURVEY / BOUNDARY / DESIGN / CROP PLAN ARE STRUCTURALLY UNREADABLE.
 *     `user_map_data/{uid}/data/{doc}` is `allow read, write: if uid ==
 *     request.auth.uid` — owner only, full stop. The SiteSurvey, the traced
 *     boundary, the design canvas and the crop plan all live there (or in
 *     localStorage, which is worse: it never leaves the farmer's browser).
 *     THEREFORE: `progressPct`, `stage`, `steps`, `surveyFilled`,
 *     `plannedKg` cannot be read for another user under the rules as deployed.
 *     Even with access, `harvestedVsPlannedPct` remains unavailable until the
 *     plan records a sowing year and completed crop cycle. There is no
 *     client-side fix; see below.
 *
 * ── WHAT MUST BE TRUE BEFORE ANY REAL FARMER APPEARS IN THIS VIEW ─────────
 *
 *  A. A SERVER-SIDE AUTHORISED READ PATH MUST EXIST. None does today: all 24
 *     routes under app/api/ are AI/compute and read no Firestore on a
 *     caller's behalf, and lib/api-auth.ts verifies a token but performs NO
 *     role or org check and is LOG-ONLY unless REQUIRE_API_AUTH=1. The only
 *     legitimate path is a route (or Cloud Function) that, in this order:
 *       (i)   verifies the caller's Firebase ID token (REQUIRE_API_AUTH=1);
 *       (ii)  loads /profiles/{callerUid} SERVER-SIDE and asserts
 *             role ∈ {funder, ngo, admin} — never trusting a client claim;
 *       (iii) asserts the target farmer's org is in the caller's funded set;
 *       (iv)  reads with the Admin SDK and returns a PROJECTION — the
 *             derived numbers in NetworkFarmerMetrics — never raw docs, never
 *             free-text survey answers, never exact coordinates.
 *     A client-side Firestore read CANNOT be the boundary here, because the
 *     rules cannot express "this funder funds this NGO" without (B).
 *
 *  B. MULTI-ORG TENANCY NEEDS A NEW KEY. Either `funded_org_ids: string[]`
 *     on the funder's profile (rule: `resource.data.org_id in
 *     prof().funded_org_ids`) or a `/grants/{id}` join collection. Either way
 *     the field must be ADMIN-SDK-WRITE-ONLY, exactly as `org_id` is today
 *     (firestore.rules pins role and org_id as immutable from the client).
 *     Note there is also no way to PROVISION a funder today: signup may only
 *     self-assign farmer|student, and no admin UI or script promotes an
 *     account. A real funder account can currently only be made by hand.
 *
 *  C. FARMER CONSENT MUST BE RECORDED AND REVOCABLE. Nothing in this schema
 *     asks the farmer whether their financials may be shown to a funder.
 *     `NetworkFarmer.consent` below is the placeholder for that record; it is
 *     `'demo'` for every row in this build. A real deployment needs a
 *     per-farmer, per-scope, revocable consent doc checked in step (iii).
 *
 *  D. THE THREE UNSCOPED RULES IN (3) MUST BE FIXED AND THE RULES TESTS RUN.
 *     `npm run test:rules` needs the emulator and has historically sat
 *     unexecuted; a rules change without a matching case in
 *     tests/firestore-rules.test.ts is not a fix.
 *     DONE — and the test that matters is the negative one: seven of the nine
 *     new cases were run against the PREVIOUS rules and fail there. A rules
 *     test that passes both before and after a fix proves nothing, which is
 *     exactly how the shared_sites assertion in that file sat green for weeks
 *     without ever having executed.
 *
 * ── COORDINATE PRECISION IS ITSELF A PRIVACY BOUNDARY ─────────────────────
 *
 *  `NetworkFarmer.lat/lon` at `coordPrecision: 'exact'` is a HOMESTEAD
 *  COORDINATE. It is org-internal. It must never be rendered on a
 *  farmer-facing map, never written to `board_posts`, and never leave a
 *  server projection. Call {@link coarsenFarmerLocation} before any
 *  coordinate crosses into farmer-to-farmer space (lib/exchange.ts), which
 *  rounds to ~1.1 km — the same contract as `jitterToNeighbourhood()` in
 *  lib/db/community-queries.ts.
 *
 * ── HOW THIS MODULE IS BUILT TO FAIL SAFE ─────────────────────────────────
 *
 *  Every metric is `number | null`. `null` means "NOT AVAILABLE TO THIS
 *  VIEWER" and MUST render as "no data", never as 0. This is deliberate: a
 *  denied Firestore read returns an empty array, and a farmer card reading
 *  "0 kg produced, 0% training" is read by a funder as evidence the farmer
 *  did nothing. An empty array `[]` passed into {@link buildFarmerMetrics}
 *  means "available and genuinely empty" (→ 0); `null` means "not available"
 *  (→ null). Callers MUST pass `null`, not `[]`, on a failed or skipped read.
 *
 * Pure module: no I/O, no localStorage, no Firestore, no React. Everything
 * here takes already-loaded structures and returns numbers, so it is
 * trivially testable (tests/network.test.ts) and shape-stable when real data
 * is eventually wired in behind (A)-(D).
 */

import {
  computeCompletionScore,
  deriveSiteStage,
  type CompletionScoreInputs,
  type CompletionStep,
  type SiteStage,
} from './completion-score';
import type {
  CourseProgress,
  ExpenseLog,
  GardenStatus,
  ProductionLog,
  SalesLog,
  SurveyResponse,
} from './db/types';
import type { ReconciliationResult } from './harvest-reconciliation';

/* ────────────────────────────────────────────────────────────────────────────
 * Geography
 * ──────────────────────────────────────────────────────────────────────────*/

export interface LatLon {
  lat: number;
  lon: number;
}

const EARTH_RADIUS_KM = 6371;

/**
 * Great-circle distance between two points, in kilometres. Same maths as
 * `distanceMeters()` in lib/saved-places.ts (kept separate so this module has
 * no dependency on the localStorage-backed saved-places layer); lib/exchange.ts
 * re-exports this one so the exchange and the portfolio agree to the metre.
 */
export function haversineKm(a: LatLon, b: LatLon): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** "< 1 km" / "6.4 km" / "38 km" — the label a funder or farmer reads on a card. */
export function formatDistanceKm(km: number): string {
  if (!Number.isFinite(km) || km < 0) return '—';
  if (km < 1) return '< 1 km';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

export interface NetworkBounds {
  minLat: number;
  minLon: number;
  maxLat: number;
  maxLon: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Identity
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * A funding organisation or implementing NGO. Mirrors the `Organization` type
 * in lib/db/types.ts, which EXISTS in the schema and in firestore.rules but is
 * read by no code anywhere in the app today — the live system leans entirely
 * on the single scalar `Profile.org_id`. See precondition (B).
 */
export interface NetworkOrg {
  id: string;
  name: string;
  kind: 'ngo' | 'funder';
  /** Human label for where this org works — display only, never a filter key. */
  region?: string;
}

/**
 * An intake/programme a farmer belongs to. Mirrors `Programme` in
 * lib/db/types.ts (also currently unread by any code). `deployedZar` maps to
 * `Programme.deployed_amount`.
 */
export interface NetworkCohort {
  id: string;
  orgId: string;
  name: string;
  /** ISO date the intake started. */
  startedAt: string;
  deployedZar: number | null;
}

/**
 * Whether a coordinate has been coarsened. `'exact'` is a homestead
 * coordinate and is ORG-INTERNAL ONLY (see the banner above). `'coarse'` is
 * rounded to ~1.1 km and is safe to show to another farmer.
 */
export type CoordPrecision = 'exact' | 'coarse';

/**
 * Consent state for showing this farmer's record to someone who is not the
 * farmer. `'demo'` means "this is sample data, no real person is involved" and
 * is the ONLY value this build ever produces. A real deployment must record
 * `'granted'` per farmer, per scope, revocably — see precondition (C).
 */
export type NetworkConsent = 'demo' | 'granted' | 'withheld' | 'unknown';

/**
 * One farmer's site in the portfolio — the click target on the funder map.
 *
 * Field-by-field mapping to the live schema, so nothing about this shape has
 * to change when a server projection replaces the demo source:
 *   id          ← Profile.id (=== Firebase Auth uid)
 *   name        ← Profile.full_name
 *   orgId       ← Profile.org_id            (the ONLY tenancy key today)
 *   cohortId    ← Garden.programme_id
 *   siteName    ← Garden.name
 *   district    ← Garden.town
 *   lat / lon   ← GardenMember.lat/lon, falling back to Garden.lat/lon
 *   plotSizeM2  ← GardenMember.size_m2
 *   plotLabel   ← GardenMember.plot
 *   status      ← Garden.status
 *
 * DELIBERATELY ABSENT: `id_number`. The existing funder drill-down prints a
 * South African ID number straight from Profile.id_number; that is a POPIA
 * problem and this contract will not carry it forward. Do not add it.
 */
export interface NetworkFarmer {
  id: string;
  name: string;
  orgId: string;
  cohortId: string | null;
  cohortName: string | null;
  siteName: string;
  district: string;
  /** District municipality (uMkhanyakude, Zululand, …) — the map's zoom-out grouping. */
  municipality: string;
  lat: number;
  lon: number;
  coordPrecision: CoordPrecision;
  plotSizeM2: number;
  plotLabel: string | null;
  /** ISO date the farmer joined the programme. */
  joinedAt: string;
  status: GardenStatus;
  photoUrl: string | null;
  consent: NetworkConsent;
  /** True for every record produced by lib/network-demo.ts. Render a sample badge. */
  isDemo: boolean;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Metrics
 * ──────────────────────────────────────────────────────────────────────────*/

/**
 * Which sources were actually readable for this farmer. Drives "no data"
 * states so a permission denial never renders as a zero. See the banner.
 */
export interface NetworkMetricCoverage {
  production: boolean;
  sales: boolean;
  expenses: boolean;
  courses: boolean;
  surveys: boolean;
  /** survey/boundary/design/crop-plan — cross-account unreadable today. */
  siteProgress: boolean;
  /** planned-vs-actual reconciliation — depends on the crop plan, so same limit. */
  plan: boolean;
}

/**
 * Everything a funder card shows for one farmer. Every derived figure is
 * nullable and `null` MUST render as "no data", never 0.
 */
export interface NetworkFarmerMetrics {
  /** Whole months between joinedAt and `now`. Always available (joinedAt is portfolio metadata). */
  monthsActive: number;

  // ── production & sales ──
  producedKg: number | null;
  soldKg: number | null;
  /** produced − sold: eaten at home, given away, or unrecorded. */
  keptKg: number | null;
  /** 0-100, share of what was harvested that was actually sold. */
  soldPct: number | null;

  // ── money ──
  incomeZar: number | null;
  expensesZar: number | null;
  netZar: number | null;
  /**
   * Cash income plus an imputed value for produce kept rather than sold, at
   * {@link KEPT_KG_VALUE_ZAR}/kg. Same formula the existing NGO dashboard
   * uses. It is an ESTIMATE of household value, not revenue — label it so.
   */
  estimatedValueZar: number | null;

  // ── plan context (crop plan is self-only today — see precondition 4) ──
  /** Benchmark for one complete crop-plan cycle, not a dated target. */
  plannedKg: number | null;
  harvestedKg: number | null;
  /** Withheld until the plan can identify a dated, completed crop cycle. */
  harvestedVsPlannedPct: number | null;

  // ── site progress (self-only today — see precondition 4) ──
  progressPct: number | null;
  stage: SiteStage | null;
  steps: CompletionStep[] | null;
  surveyFilled: number | null;
  surveyTotal: number | null;
  surveyPct: number | null;

  // ── training & NGO surveys ──
  modulesDone: number | null;
  modulesTotal: number;
  trainingPct: number | null;
  surveysAnswered: number | null;

  // ── recency ──
  /** ISO timestamp of the most recent log of any kind, or null. */
  lastActivityAt: string | null;
  daysSinceActivity: number | null;

  coverage: NetworkMetricCoverage;
}

export interface NetworkFarmerSummary {
  farmer: NetworkFarmer;
  metrics: NetworkFarmerMetrics;
}

/**
 * Imputed Rand value of a kilogram the farmer kept instead of selling. Lifted
 * verbatim from the existing NGO/funder dashboard so two screens never
 * disagree. A blunt single figure across all crops — for a per-crop value use
 * `priceFor()` in lib/crop-prices.ts instead.
 */
export const KEPT_KG_VALUE_ZAR = 15;

/**
 * Number of modules in the permaculture course. The real list is
 * `COURSE_MODULES` in lib/course-modules.ts (~1 400 lines of lesson content);
 * this module refuses to pull that into every bundle that wants a percentage,
 * so the count is a constant here and tests/network.test.ts asserts the two
 * stay equal. Callers that already hold COURSE_MODULES should pass its length.
 */
export const DEFAULT_COURSE_MODULE_COUNT = 10;

/**
 * Already-loaded per-farmer sources. `null` = NOT AVAILABLE TO THIS VIEWER
 * (denied, not fetched, or structurally unreadable). `[]` = available and
 * genuinely empty. Callers MUST honour that distinction — it is the whole
 * mechanism that stops a permission denial rendering as "this farmer did
 * nothing".
 *
 * Real-data provenance for each field, for whoever wires precondition (A):
 *   production  ← production_logs where profile_id == farmer (org-scoped read)
 *   sales       ← sales_logs      "        "
 *   expenses    ← expense_logs    "        "   ← NOT fetched by the app today
 *   courses     ← course_progress                ← rule is UNSCOPED, see (3)
 *   surveys     ← survey_responses               ← rule is UNSCOPED, see (3)
 *   completion  ← SiteSurvey + boundary + design + crop plan  ← UNREADABLE (4)
 *   reconciliation ← buildReconciliation(...)    ← needs the crop plan, so (4)
 */
export interface FarmerDataSources {
  production: ProductionLog[] | null;
  sales: SalesLog[] | null;
  expenses: ExpenseLog[] | null;
  courses: CourseProgress[] | null;
  surveys?: SurveyResponse[] | null;
  completion?: CompletionScoreInputs | null;
  reconciliation?: ReconciliationResult | null;
  /** Defaults to {@link DEFAULT_COURSE_MODULE_COUNT}. */
  courseModuleCount?: number;
  /** Defaults to `new Date()`. Pass a fixed date in tests. */
  now?: Date;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function sumBy<T>(rows: T[], pick: (row: T) => unknown): number {
  return rows.reduce((total, row) => total + num(pick(row)), 0);
}

function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function pct(part: number, whole: number): number | null {
  if (!Number.isFinite(part) || !Number.isFinite(whole) || whole <= 0) return null;
  return round((part / whole) * 100);
}

function parseIso(value: unknown): number | null {
  if (typeof value !== 'string' || value.length === 0) return null;
  const t = Date.parse(value);
  return Number.isFinite(t) ? t : null;
}

/** Whole months between two dates, floored at 0. */
export function monthsBetween(fromIso: string, now: Date): number {
  const from = parseIso(fromIso);
  if (from === null) return 0;
  const start = new Date(from);
  let months =
    (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

/**
 * Derive every funder-facing metric for one farmer from already-loaded app
 * structures. Pure. The reconciliation argument is the output of
 * `buildReconciliation()` in lib/harvest-reconciliation.ts — the strongest
 * "was the plan delivered?" signal in the repo — and stays optional because a
 * crop plan is not readable cross-account (precondition 4).
 */
export function buildFarmerMetrics(
  farmer: Pick<NetworkFarmer, 'joinedAt'>,
  sources: FarmerDataSources,
): NetworkFarmerMetrics {
  const now = sources.now ?? new Date();
  const modulesTotal = sources.courseModuleCount ?? DEFAULT_COURSE_MODULE_COUNT;

  const production = sources.production;
  const sales = sources.sales;
  const expenses = sources.expenses;
  const courses = sources.courses;
  const surveys = sources.surveys ?? null;
  const completion = sources.completion ?? null;
  const reconciliation = sources.reconciliation ?? null;

  const coverage: NetworkMetricCoverage = {
    production: production !== null,
    sales: sales !== null,
    expenses: expenses !== null,
    courses: courses !== null,
    surveys: surveys !== null,
    siteProgress: completion !== null,
    plan: reconciliation !== null,
  };

  const producedKg = production ? round(sumBy(production, (r) => r.kg), 1) : null;
  const soldKg = sales ? round(sumBy(sales, (r) => r.kg), 1) : null;
  const incomeZar = sales ? round(sumBy(sales, (r) => r.amount), 2) : null;
  const expensesZar = expenses ? round(sumBy(expenses, (r) => r.amount), 2) : null;

  const netZar =
    incomeZar !== null && expensesZar !== null ? round(incomeZar - expensesZar, 2) : null;

  // Kept produce can only be computed when BOTH halves are readable; one
  // without the other would silently report the whole harvest as "kept".
  const keptKg =
    producedKg !== null && soldKg !== null ? round(Math.max(0, producedKg - soldKg), 1) : null;

  const soldPct = producedKg !== null && soldKg !== null ? pct(soldKg, producedKg) : null;

  const estimatedValueZar =
    incomeZar !== null && keptKg !== null
      ? round(incomeZar + keptKg * KEPT_KG_VALUE_ZAR, 2)
      : null;

  // ── plan delivery ──
  let plannedKg: number | null = null;
  let reconciledHarvestKg: number | null = null;
  if (reconciliation) {
    const rows = [
      ...reconciliation.matched,
      ...reconciliation.notYetHarvested,
      ...reconciliation.unmatchedPlanned,
    ];
    const knownCycleBenchmarks = rows.flatMap((row) => row.intendedKg === null ? [] : [row.intendedKg]);
    plannedKg = knownCycleBenchmarks.length ? round(knownCycleBenchmarks.reduce((sum, kg) => sum + kg, 0), 1) : null;
    reconciledHarvestKg = round(sumBy(rows, (r) => r.harvestedKg), 1);
  }
  const harvestedKg = reconciledHarvestKg ?? producedKg;
  // A crop-cycle benchmark has no sowing year or completed-cycle marker. It
  // may be shown as context, but comparing calendar logs with it would accuse
  // a farmer of missing a target the data cannot date.
  const harvestedVsPlannedPct = null;

  // ── site progress ──
  const scored = completion ? computeCompletionScore(completion) : null;
  const progressPct = scored ? scored.overallPct : null;
  const stage = completion ? deriveSiteStage(completion) : null;
  const surveyFilled = completion ? Math.max(0, Math.trunc(completion.surveyFilledFields)) : null;
  const surveyTotal = completion ? Math.max(0, Math.trunc(completion.surveyTotalFields)) : null;
  const surveyPct =
    surveyFilled !== null && surveyTotal !== null ? pct(surveyFilled, surveyTotal) : null;

  // ── training ──
  const modulesDone = courses ? courses.filter((c) => c.done === true).length : null;
  const trainingPct = modulesDone !== null ? pct(modulesDone, modulesTotal) : null;

  // ── recency ──
  const stamps: number[] = [];
  if (production) for (const r of production) { const t = parseIso(r.logged_at); if (t !== null) stamps.push(t); }
  if (sales) for (const r of sales) { const t = parseIso(r.sold_at); if (t !== null) stamps.push(t); }
  if (expenses) for (const r of expenses) { const t = parseIso(r.spent_at); if (t !== null) stamps.push(t); }
  if (courses) for (const r of courses) { const t = parseIso(r.updated_at); if (t !== null) stamps.push(t); }
  const lastMs = stamps.length > 0 ? Math.max(...stamps) : null;
  const lastActivityAt = lastMs === null ? null : new Date(lastMs).toISOString();
  const daysSinceActivity =
    lastMs === null ? null : Math.max(0, Math.floor((now.getTime() - lastMs) / 86400000));

  return {
    monthsActive: monthsBetween(farmer.joinedAt, now),
    producedKg,
    soldKg,
    keptKg,
    soldPct,
    incomeZar,
    expensesZar,
    netZar,
    estimatedValueZar,
    plannedKg,
    harvestedKg,
    harvestedVsPlannedPct,
    progressPct,
    stage,
    steps: scored ? scored.steps : null,
    surveyFilled,
    surveyTotal,
    surveyPct,
    modulesDone,
    modulesTotal,
    trainingPct,
    surveysAnswered: surveys ? surveys.length : null,
    lastActivityAt,
    daysSinceActivity,
    coverage,
  };
}

/** Convenience: farmer + metrics in one call. */
export function buildFarmerSummary(
  farmer: NetworkFarmer,
  sources: FarmerDataSources,
): NetworkFarmerSummary {
  return { farmer, metrics: buildFarmerMetrics(farmer, sources) };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Attention flags — what a funder actually scans a list for
 * ──────────────────────────────────────────────────────────────────────────*/

export type NetworkAttentionKind =
  | 'dormant'
  | 'under_plan'
  | 'loss_making'
  | 'stalled_setup'
  | 'no_survey'
  | 'no_data';

export interface NetworkAttentionFlag {
  kind: NetworkAttentionKind;
  label: string;
  /** 'watch' = worth a look; 'urgent' = a mentor should visit. */
  severity: 'watch' | 'urgent';
}

/** Days of silence before a site is flagged dormant. */
export const DORMANT_DAYS = 90;

/**
 * Flags for one farmer. Deliberately conservative: a metric that is `null`
 * (not readable) NEVER produces a performance flag — it produces `no_data`,
 * because "we cannot see this farmer" and "this farmer is failing" must not
 * look the same on a funder's screen.
 */
export function attentionFlags(row: NetworkFarmerSummary): NetworkAttentionFlag[] {
  const m = row.metrics;
  const flags: NetworkAttentionFlag[] = [];

  if (!m.coverage.production && !m.coverage.sales) {
    flags.push({ kind: 'no_data', label: 'No records visible', severity: 'watch' });
    return flags;
  }

  if (m.daysSinceActivity !== null && m.daysSinceActivity > DORMANT_DAYS) {
    flags.push({
      kind: 'dormant',
      label: `No logs for ${m.daysSinceActivity} days`,
      severity: m.daysSinceActivity > DORMANT_DAYS * 2 ? 'urgent' : 'watch',
    });
  }

  // Only meaningful once a site has had time to earn — a two-month-old site
  // spending on seed before its first harvest is doing exactly the right thing.
  if (m.netZar !== null && m.netZar < 0 && m.monthsActive >= 6) {
    flags.push({ kind: 'loss_making', label: 'Costs above income', severity: 'watch' });
  }

  if (m.progressPct !== null && m.progressPct < 40 && m.monthsActive >= 6) {
    flags.push({ kind: 'stalled_setup', label: 'Setup incomplete', severity: 'watch' });
  }

  if (m.surveyPct !== null && m.surveyPct < 50 && m.monthsActive >= 3) {
    flags.push({ kind: 'no_survey', label: 'Site survey incomplete', severity: 'watch' });
  }

  return flags;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Portfolio selectors
 * ──────────────────────────────────────────────────────────────────────────*/

export interface NetworkFilter {
  /** Case-insensitive match against farmer name, site name, district, municipality. */
  query?: string;
  orgIds?: string[];
  cohortIds?: string[];
  municipalities?: string[];
  statuses?: GardenStatus[];
  minProgressPct?: number;
  maxProgressPct?: number;
  /** ISO date — keep farmers who joined on or after this. */
  joinedAfter?: string;
  joinedBefore?: string;
  /** Keep only sites within `km` of `origin`. */
  within?: { origin: LatLon; km: number };
  /** Keep only farmers carrying at least one attention flag. */
  needsAttentionOnly?: boolean;
}

function matchesQuery(row: NetworkFarmerSummary, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (needle.length === 0) return true;
  const f = row.farmer;
  return [f.name, f.siteName, f.district, f.municipality, f.cohortName ?? '']
    .some((field) => field.toLowerCase().includes(needle));
}

/** Pure filter. Returns a new array; never mutates the input. */
export function filterNetwork(
  rows: NetworkFarmerSummary[],
  filter: NetworkFilter = {},
): NetworkFarmerSummary[] {
  const joinedAfter = filter.joinedAfter ? parseIso(filter.joinedAfter) : null;
  const joinedBefore = filter.joinedBefore ? parseIso(filter.joinedBefore) : null;

  return rows.filter((row) => {
    const f = row.farmer;
    if (filter.query && !matchesQuery(row, filter.query)) return false;
    if (filter.orgIds && filter.orgIds.length > 0 && !filter.orgIds.includes(f.orgId)) return false;
    if (filter.cohortIds && filter.cohortIds.length > 0) {
      if (f.cohortId === null || !filter.cohortIds.includes(f.cohortId)) return false;
    }
    if (
      filter.municipalities &&
      filter.municipalities.length > 0 &&
      !filter.municipalities.includes(f.municipality)
    ) {
      return false;
    }
    if (filter.statuses && filter.statuses.length > 0 && !filter.statuses.includes(f.status)) {
      return false;
    }
    // A null progress is "unknown", not "zero" — a progress filter must not
    // silently drop every farmer whose site data we simply cannot read.
    if (filter.minProgressPct !== undefined && row.metrics.progressPct !== null) {
      if (row.metrics.progressPct < filter.minProgressPct) return false;
    }
    if (filter.maxProgressPct !== undefined && row.metrics.progressPct !== null) {
      if (row.metrics.progressPct > filter.maxProgressPct) return false;
    }
    const joined = parseIso(f.joinedAt);
    if (joinedAfter !== null && (joined === null || joined < joinedAfter)) return false;
    if (joinedBefore !== null && (joined === null || joined > joinedBefore)) return false;
    if (filter.within) {
      const km = haversineKm(filter.within.origin, { lat: f.lat, lon: f.lon });
      if (km > filter.within.km) return false;
    }
    if (filter.needsAttentionOnly === true && attentionFlags(row).length === 0) return false;
    return true;
  });
}

export type NetworkSortKey =
  | 'name'
  | 'joined'
  | 'progress'
  | 'production'
  | 'income'
  | 'size'
  | 'nearest'
  | 'attention';

export interface NetworkSortOptions {
  /** Required for `'nearest'`; ignored otherwise. */
  origin?: LatLon;
  direction?: 'asc' | 'desc';
}

/**
 * Pure sort. Returns a new array. Nullable metrics always sort LAST regardless
 * of direction — an unreadable farmer must never top a "best performers" list
 * or bottom a "worst performers" one.
 */
export function sortNetwork(
  rows: NetworkFarmerSummary[],
  key: NetworkSortKey,
  options: NetworkSortOptions = {},
): NetworkFarmerSummary[] {
  const dir = options.direction ?? defaultDirection(key);
  const sign = dir === 'asc' ? 1 : -1;
  const origin = options.origin;

  const value = (row: NetworkFarmerSummary): number | null => {
    switch (key) {
      case 'joined': return parseIso(row.farmer.joinedAt);
      case 'progress': return row.metrics.progressPct;
      case 'production': return row.metrics.producedKg;
      case 'income': return row.metrics.incomeZar;
      case 'size': return row.farmer.plotSizeM2;
      case 'attention': return attentionFlags(row).reduce(
        (score, flag) => score + (flag.severity === 'urgent' ? 2 : 1), 0);
      case 'nearest':
        return origin ? haversineKm(origin, { lat: row.farmer.lat, lon: row.farmer.lon }) : null;
      default: return null;
    }
  };

  return [...rows].sort((a, b) => {
    if (key === 'name') {
      return sign * a.farmer.name.localeCompare(b.farmer.name);
    }
    const av = value(a);
    const bv = value(b);
    if (av === null && bv === null) return a.farmer.name.localeCompare(b.farmer.name);
    if (av === null) return 1;
    if (bv === null) return -1;
    if (av === bv) return a.farmer.name.localeCompare(b.farmer.name);
    return sign * (av - bv);
  });
}

function defaultDirection(key: NetworkSortKey): 'asc' | 'desc' {
  // Nearest and name read naturally ascending; every performance metric reads
  // "best first".
  return key === 'nearest' || key === 'name' || key === 'joined' ? 'asc' : 'desc';
}

/** Distance from an origin to each farmer, nearest first. Convenience over {@link sortNetwork}. */
export function nearestFarmers(
  rows: NetworkFarmerSummary[],
  origin: LatLon,
  limit?: number,
): Array<{ row: NetworkFarmerSummary; km: number }> {
  const withDistance = rows.map((row) => ({
    row,
    km: haversineKm(origin, { lat: row.farmer.lat, lon: row.farmer.lon }),
  }));
  withDistance.sort((a, b) => a.km - b.km);
  return typeof limit === 'number' ? withDistance.slice(0, Math.max(0, limit)) : withDistance;
}

export interface NetworkPortfolioTotals {
  farmerCount: number;
  /** Farmers whose money/production is actually readable — the denominator for every total below. */
  reportingCount: number;
  municipalityCount: number;
  cohortCount: number;
  totalPlotM2: number;
  totalPlotHa: number;
  producedKg: number | null;
  soldKg: number | null;
  incomeZar: number | null;
  expensesZar: number | null;
  netZar: number | null;
  estimatedValueZar: number | null;
  /** Median so one large site does not flatter the whole portfolio. */
  medianProgressPct: number | null;
  averageTrainingPct: number | null;
  needsAttentionCount: number;
  activeLast90Days: number;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : round((sorted[mid - 1] + sorted[mid]) / 2, 1);
}

function sumNullable(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => v !== null);
  return present.length === 0 ? null : round(present.reduce((a, b) => a + b, 0), 2);
}

/**
 * Roll a portfolio up to the numbers on a funder's headline strip. Totals sum
 * only over farmers whose data is readable and report `reportingCount`
 * alongside `farmerCount`, so "R48 000 across 9 of 16 sites" can be stated
 * honestly rather than implying the other 7 earned nothing.
 */
export function portfolioTotals(rows: NetworkFarmerSummary[]): NetworkPortfolioTotals {
  const totalPlotM2 = rows.reduce((t, r) => t + num(r.farmer.plotSizeM2), 0);
  const progresses = rows
    .map((r) => r.metrics.progressPct)
    .filter((v): v is number => v !== null);
  const trainings = rows
    .map((r) => r.metrics.trainingPct)
    .filter((v): v is number => v !== null);

  return {
    farmerCount: rows.length,
    reportingCount: rows.filter((r) => r.metrics.coverage.production || r.metrics.coverage.sales).length,
    municipalityCount: new Set(rows.map((r) => r.farmer.municipality)).size,
    cohortCount: new Set(rows.map((r) => r.farmer.cohortId).filter((v) => v !== null)).size,
    totalPlotM2: round(totalPlotM2),
    totalPlotHa: round(totalPlotM2 / 10000, 2),
    producedKg: sumNullable(rows.map((r) => r.metrics.producedKg)),
    soldKg: sumNullable(rows.map((r) => r.metrics.soldKg)),
    incomeZar: sumNullable(rows.map((r) => r.metrics.incomeZar)),
    expensesZar: sumNullable(rows.map((r) => r.metrics.expensesZar)),
    netZar: sumNullable(rows.map((r) => r.metrics.netZar)),
    estimatedValueZar: sumNullable(rows.map((r) => r.metrics.estimatedValueZar)),
    medianProgressPct: median(progresses),
    averageTrainingPct:
      trainings.length === 0
        ? null
        : round(trainings.reduce((a, b) => a + b, 0) / trainings.length),
    needsAttentionCount: rows.filter((r) => attentionFlags(r).length > 0).length,
    activeLast90Days: rows.filter(
      (r) => r.metrics.daysSinceActivity !== null && r.metrics.daysSinceActivity <= DORMANT_DAYS,
    ).length,
  };
}

export interface NetworkGroupRollup {
  key: string;
  farmerCount: number;
  totalPlotM2: number;
  producedKg: number | null;
  incomeZar: number | null;
  medianProgressPct: number | null;
  /** Centre of the group's sites — the map's zoom target for this grouping. */
  centroid: LatLon | null;
  needsAttentionCount: number;
}

/** Group and roll up — pass `'municipality'`, `'cohortName'`, `'district'` or `'status'`. */
export function rollupBy(
  rows: NetworkFarmerSummary[],
  dimension: 'municipality' | 'district' | 'status' | 'cohortName' | 'orgId',
): NetworkGroupRollup[] {
  const groups = new Map<string, NetworkFarmerSummary[]>();
  for (const row of rows) {
    const raw = row.farmer[dimension];
    const key = typeof raw === 'string' && raw.length > 0 ? raw : 'Unassigned';
    const bucket = groups.get(key);
    if (bucket) bucket.push(row);
    else groups.set(key, [row]);
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const totals = portfolioTotals(group);
      return {
        key,
        farmerCount: group.length,
        totalPlotM2: totals.totalPlotM2,
        producedKg: totals.producedKg,
        incomeZar: totals.incomeZar,
        medianProgressPct: totals.medianProgressPct,
        centroid: centroidOf(group),
        needsAttentionCount: totals.needsAttentionCount,
      };
    })
    .sort((a, b) => b.farmerCount - a.farmerCount || a.key.localeCompare(b.key));
}

export function centroidOf(rows: NetworkFarmerSummary[]): LatLon | null {
  if (rows.length === 0) return null;
  const lat = rows.reduce((t, r) => t + r.farmer.lat, 0) / rows.length;
  const lon = rows.reduce((t, r) => t + r.farmer.lon, 0) / rows.length;
  return { lat: round(lat, 6), lon: round(lon, 6) };
}

/** Bounding box for `map.fitBounds`. Returns null for an empty portfolio. */
export function networkBounds(rows: NetworkFarmerSummary[]): NetworkBounds | null {
  if (rows.length === 0) return null;
  const lats = rows.map((r) => r.farmer.lat);
  const lons = rows.map((r) => r.farmer.lon);
  return {
    minLat: Math.min(...lats),
    minLon: Math.min(...lons),
    maxLat: Math.max(...lats),
    maxLon: Math.max(...lons),
  };
}

export function findNetworkFarmer(
  rows: NetworkFarmerSummary[],
  farmerId: string,
): NetworkFarmerSummary | null {
  return rows.find((r) => r.farmer.id === farmerId) ?? null;
}

/**
 * Round a site coordinate to ~1.1 km — the SAME contract as
 * `jitterToNeighbourhood()` in lib/db/community-queries.ts (2 decimal places,
 * deliberately stable rather than re-randomised per view).
 *
 * CALL THIS BEFORE ANY COORDINATE LEAVES ORG-INTERNAL SPACE. An exact
 * `NetworkFarmer.lat/lon` is a homestead location; publishing it to the farmer
 * exchange, a shared link or a public map would let a stranger navigate to
 * someone's house. Anything written to `board_posts` must go through this (or
 * through `jitterToNeighbourhood` at the Firestore write itself).
 */
export function coarsenCoords(lat: number, lon: number): LatLon {
  const r = (n: number) => Math.round(n * 100) / 100;
  return { lat: r(lat), lon: r(lon) };
}

/** {@link coarsenCoords} applied to a farmer, flipping `coordPrecision` to `'coarse'`. */
export function coarsenFarmerLocation(farmer: NetworkFarmer): NetworkFarmer {
  const { lat, lon } = coarsenCoords(farmer.lat, farmer.lon);
  return { ...farmer, lat, lon, coordPrecision: 'coarse' };
}

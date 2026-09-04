'use client';

/**
 * FarmerPanel — the panel a funder opens when they click one farmer on the
 * portfolio map.
 *
 * Identity and site, then the three things the product owner named:
 * FINANCIALS, SURVEYS, PROGRESS. Bottom sheet on mobile, right column on md+,
 * matching components/atlas/AtlasExplorer.tsx's panel idiom and the warm
 * almanac palette used across the app.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * ACCESS CONTROL — READ BEFORE WIRING THIS TO ANYTHING REAL
 * ════════════════════════════════════════════════════════════════════════════
 * This panel shows ONE PERSON'S financial and personal records TO SOMEBODY
 * ELSE. That is the entire feature, and it is also the entire risk.
 *
 * As shipped it renders whatever `summary` its parent hands it. The parent
 * must feed it DEMO_NETWORK (lib/network-demo.ts) and nothing else. There is
 * at present NO authorised path by which a funder may read a real farmer's
 * books, and this component must not be made to look like there is.
 *
 * WHAT WOULD HAVE TO BE TRUE BEFORE A REAL FARMER'S RECORD APPEARS HERE:
 *
 *  (A) A GRANT MODEL THAT EXISTS IN DATA. Tenancy today is a single scalar,
 *      Profile.org_id. A funder funding several implementing NGOs cannot be
 *      expressed. Something explicit is needed — `funded_org_ids: string[]` on
 *      the funder's profile, or a `/grants/{id}` join collection — and it must
 *      be writable ONLY by the Admin SDK, exactly as `org_id` already is
 *      (firestore.rules immutability guard).
 *
 *  (B) A SERVER-SIDE AUTHORISATION GATE. The read must happen in a route
 *      handler or Cloud Function using firebase-admin that: verifies the
 *      caller's Firebase ID token; loads /profiles/{callerUid} SERVER-SIDE;
 *      asserts role ∈ {funder, ngo, admin}; asserts the target farmer's org is
 *      in the caller's granted set; and returns a PROJECTION — the derived
 *      figures this panel renders, never raw documents. Note that
 *      lib/api-auth.ts is log-only unless REQUIRE_API_AUTH=1 and performs no
 *      role or org check whatsoever, so it is not sufficient on its own.
 *      Authorisation must not be a client-side Firestore query the caller can
 *      shop around.
 *
 *  (C) PER-FARMER, REVOCABLE CONSENT. These are named individuals. The
 *      contract already carries `NetworkFarmer.consent`; every record in this
 *      build is `'demo'`. A real deployment needs `'granted'` recorded per
 *      farmer, per scope, revocable, with a disclosure the farmer actually saw.
 *
 *  (D) TWO DEPLOYED-RULE DEFECTS FIXED FIRST. Both sit directly under this
 *      panel's Surveys section. `/survey_responses` is readable by a bare
 *      `isStaff()` with NO org scoping — any funder or NGO account in ANY
 *      organisation can currently read EVERY survey response in the database.
 *      `/course_progress` has the same shape. SurveyResponse carries no
 *      org_id, so the write path must denormalise one before the rule can be
 *      scoped. Rules are not deployed by agents; this is a finding for the
 *      owner, not a change to make here.
 *
 *  (E) COORDINATES STAY OUT. This panel deliberately prints no latitude or
 *      longitude. `NetworkFarmer.lat/lon` at coordPrecision 'exact' is a
 *      homestead coordinate and is org-internal; anything farmer-facing must
 *      pass through `coarsenFarmerLocation()` first. The "Show on map" button
 *      hands the whole farmer object back to the PARENT, which owns that
 *      decision — this panel never renders the numbers.
 *
 *  (F) NO ID NUMBERS. The `NetworkFarmer` contract deliberately omits
 *      `id_number` (the legacy NGO dashboard prints South African ID numbers
 *      straight onto the funder's screen — a POPIA problem). Do not add one.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * THE HONESTY RULE
 * ════════════════════════════════════════════════════════════════════════════
 * Every metric in lib/network.ts is nullable, and `null` means "this viewer
 * could not read it" — NOT "zero". A funder shown a confident 0 that actually
 * means "we never asked" has been misled, and will make a funding decision on
 * it. So no figure on this panel is rendered raw: each one goes through
 * FarmerPanel.format.ts, which returns a three-state Readout — a value, an
 * explicit "Not visible", or an explicit "Not recorded yet". There are no bare
 * dashes and no fallback zeros anywhere below.
 *
 * Each figure also carries a `data-selector` attribute naming the exact
 * library symbol it came from, so the next developer can right-click any
 * number in devtools and find the code that produced it.
 */

import { useMemo } from 'react';
import {
  AlertTriangle, CalendarDays, Check, ClipboardList, GraduationCap, Info,
  Leaf, ListChecks, MapPin, Minus, Ruler, ShieldAlert, Sprout, TrendingUp, Wallet, X,
  type LucideIcon,
} from 'lucide-react';
import {
  attentionFlags,
  type FarmerDataSources,
  type NetworkAttentionFlag,
  type NetworkFarmer,
  type NetworkFarmerSummary,
} from '@/lib/network';
import {
  financeRows, formatArea, formatDaysAgo, formatJoinedDate, formatKg, formatMonthsActive,
  formatPct, formatZar, initialsOf, monthlyLedgerSeries, produceRows, progressReadout,
  SAMPLE_DATA_NOTICE, statusLabel, surveyReadout,
  type LedgerSeries, type PanelRow, type Readout,
} from './FarmerPanel.format';

/* ── palette (app 2026 warm-almanac idiom; see AtlasPanel.tsx) ───────────── */
const PAPER = '#F4EFE4';
const CARD = '#FFFEFA';
const SUNK = '#EDE7DB';
const BORDER = '#E2D8C4';
const INK = '#20190F';
const BODY = '#5C5040';
const MUTED = '#8C7A62';
const FAINT = '#AC9E82';
const FOREST = '#1F4D2B';
const OCHRE = '#9E5C08';
const GOLD = '#B07A1E';
const BLUE = '#2F6F9E';
const RUST = '#C0531E';

/** Matches components/NgoDashboard.tsx's STATUS map so two screens agree. */
const STATUS_COLOR: Record<string, string> = {
  thriving: FOREST,
  establishing: OCHRE,
  support: RUST,
};

/**
 * NetworkFarmer.consent, badged next to the status pill — see header (C).
 * 'withheld' is a farmer's own choice, not a strike against them, so it reads
 * in the same calm grey as "not asked yet", never the rust/gold used
 * elsewhere on this panel for a denied read or a performance flag.
 */
const CONSENT_META: Record<NetworkFarmer['consent'], { label: string; color: string; icon: LucideIcon }> = {
  demo: { label: 'Sample data', color: GOLD, icon: Info },
  granted: { label: 'Consent granted', color: FOREST, icon: Check },
  withheld: { label: 'Not shared — farmer’s choice', color: MUTED, icon: Minus },
  unknown: { label: 'Consent not yet recorded', color: MUTED, icon: Minus },
};

export interface FarmerPanelProps {
  /** The clicked farmer. Identity and site details are read from here. */
  farmer: NetworkFarmer;
  /**
   * The same farmer plus derived metrics, from `buildFarmerSummary()`.
   * `summary.farmer` is expected to be the same record as `farmer`; where they
   * differ, `farmer` wins for identity and `summary.metrics` supplies numbers.
   */
  summary: NetworkFarmerSummary;
  onClose: () => void;

  /* ── optional; the panel is fully usable without any of these ──────────── */

  /**
   * Raw ledgers for this farmer (e.g. `demoFarmerById(id)?.sources`). Supplying
   * them enables the month-by-month strip, which cannot be derived from the
   * summary totals alone. Omit them and the strip simply does not render — no
   * invented trend line. PASS THIS to get the season chart in the demo.
   */
  sources?: FarmerDataSources | null;
  /**
   * Fly the map to this farmer. The parent owns the coordinate decision — see
   * note (E) in the header; this panel never renders lat/lon itself.
   */
  onViewOnMap?: (farmer: NetworkFarmer) => void;
  /** Overrides the sample-data badge text (e.g. `DEMO_NETWORK_NOTICE`). */
  demoNotice?: string;
  /**
   * `'sheet'` (default) renders the whole panel: bottom sheet on mobile, right
   * column on md+, with its own header, close button and scroll container.
   *
   * `'embedded'` renders ONLY the content sections, for a parent that already
   * supplies the sheet chrome and its own `overflow-y-auto` body — which
   * components/network/NetworkMap.tsx currently does. Use it there, or two
   * nested scroll containers will fight on a touch screen and the panel will
   * carry two close buttons.
   */
  variant?: 'sheet' | 'embedded';
  className?: string;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Small shared pieces
 * ──────────────────────────────────────────────────────────────────────────*/

function SectionLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      className="flex items-center gap-1.5 font-sans font-bold uppercase"
      style={{ color: GOLD, letterSpacing: '0.12em', fontSize: 11 }}
    >
      {icon}
      {children}
    </div>
  );
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 14,
        ...(accent ? { borderLeft: `3px solid ${accent}` } : {}),
      }}
    >
      {children}
    </div>
  );
}

/**
 * Renders a {@link Readout}. This is the single place a number becomes pixels,
 * which is what makes the "never a bare zero" rule enforceable: a `not_visible`
 * or `not_recorded` state is physically incapable of rendering as a figure.
 */
function ReadoutValue({
  readout, selector, size = 17, tone,
}: { readout: Readout; selector: string; size?: number | string; tone?: string }) {
  if (readout.state === 'value') {
    return (
      <span
        className="font-display font-semibold"
        data-selector={selector}
        style={{ fontSize: size, color: tone ?? INK, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}
      >
        {readout.text}
      </span>
    );
  }
  const isDenied = readout.state === 'not_visible';
  const numericSize = typeof size === 'number' ? size : 17;
  return (
    <span
      className="font-sans inline-flex items-center gap-1"
      data-selector={selector}
      data-state={readout.state}
      title={readout.note}
      style={{
        fontSize: Math.max(11, numericSize - 5.5),
        fontWeight: 600,
        color: isDenied ? MUTED : FAINT,
        fontStyle: 'italic',
        lineHeight: 1.2,
      }}
    >
      {isDenied ? <ShieldAlert size={11} aria-hidden /> : <Minus size={11} aria-hidden />}
      {readout.text}
    </span>
  );
}

/** Shared value colour: negative→rust, positive→forest, else ink. Non-value
 *  states get no colour override — ReadoutValue already mutes those itself. */
function statTone(row: PanelRow): string | undefined {
  if (row.readout.state !== 'value') return undefined;
  return row.tone === 'negative' ? RUST : row.tone === 'positive' ? FOREST : INK;
}

/** One labelled figure in a grid. Prints its own caveat (e.g. "estimate, not
 *  revenue") directly underneath when the row carries one, so a number's
 *  caveat never separates from the number it qualifies. */
function StatBlock({ row }: { row: PanelRow }) {
  const isValue = row.readout.state === 'value';
  return (
    <div
      className="rounded-xl px-2.5 py-2"
      style={{ background: SUNK, border: `1px solid ${BORDER}`, minWidth: 0 }}
    >
      <div className="font-sans" style={{ color: MUTED, fontSize: 10.5, marginBottom: 3 }}>
        {row.label}
      </div>
      <ReadoutValue readout={row.readout} selector={row.selector} tone={statTone(row)} />
      {!isValue && row.readout.note && (
        <div className="font-sans" style={{ color: FAINT, fontSize: 10.5, marginTop: 3, lineHeight: 1.3 }}>
          {row.readout.note}
        </div>
      )}
      {isValue && row.caveat && (
        <div className="font-sans" style={{ color: FAINT, fontSize: 10.5, marginTop: 3, lineHeight: 1.3 }}>
          {row.caveat}
        </div>
      )}
    </div>
  );
}

/**
 * The single figure a section leads with — bigger and unboxed, so the boxed
 * StatBlocks beneath it visibly recede into supporting detail. Same Readout
 * plumbing and honesty rules as StatBlock (a "not visible"/"not recorded"
 * row never inflates to hero size — only a real value does); only the type
 * scale and container change.
 */
function HeroStat({ row }: { row: PanelRow }) {
  const isValue = row.readout.state === 'value';
  return (
    <div>
      <div className="font-sans" style={{ fontSize: 10.5, color: MUTED, marginBottom: 3 }}>
        {row.label}
      </div>
      <ReadoutValue
        readout={row.readout}
        selector={row.selector}
        tone={statTone(row)}
        /* Matches the farmer-facing DataPanel hero clamp (clamp(24px,2.2vw,28px),
         * design/DESIGN.md) so a "hero" figure reads at the same ceiling for a
         * funder as it does for the farmer whose numbers these are. */
        size={isValue ? 'clamp(22px, 2.4vw, 28px)' : 15}
      />
      {!isValue && row.readout.note && (
        <div className="font-sans" style={{ fontSize: 10.5, color: FAINT, marginTop: 3, lineHeight: 1.3 }}>
          {row.readout.note}
        </div>
      )}
      {isValue && row.caveat && (
        <div className="font-sans" style={{ fontSize: 10.5, color: FAINT, marginTop: 4, lineHeight: 1.35 }}>
          {row.caveat}
        </div>
      )}
    </div>
  );
}

/** A proportion bar that always states its denominator alongside. */
function ProportionBar({ pct, color, track = 'rgba(32,25,15,0.07)' }: {
  pct: number; color: string; track?: string;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div style={{ height: 7, borderRadius: 4, background: track, overflow: 'hidden' }}>
      <div
        style={{
          width: `${clamped}%`, height: '100%', background: color, borderRadius: 4,
          transition: 'width 500ms var(--ease-spring, ease)',
        }}
      />
    </div>
  );
}

/** Answered / blank dots for the site survey. Blank reads as blank, not zero. */
function SurveyDots({ filled, total }: { filled: number; total: number }) {
  const capped = Math.min(total, 24);
  return (
    <div className="flex flex-wrap gap-1" aria-hidden>
      {Array.from({ length: capped }, (_, i) => {
        const answered = i < filled;
        return (
          <span
            key={i}
            style={{
              width: 12, height: 12, borderRadius: 4,
              background: answered ? FOREST : 'transparent',
              border: answered ? `1px solid ${FOREST}` : `1px dashed ${FAINT}`,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Monthly bars, in the Climate-tab idiom (bar, then month letter). Rendered
 * ONLY when `monthlyLedgerSeries()` says the data supports a trend — see
 * SERIES_MIN_MONTHS / SERIES_MIN_ACTIVE_MONTHS in FarmerPanel.format.ts.
 */
function MonthStrip({ series }: { series: LedgerSeries }) {
  const kgMax = Math.max(series.maxKg, 1);
  const zarMax = Math.max(series.maxZar, 1);
  const showKg = series.hasProduction && series.maxKg > 0;
  const showMoney = series.hasMoney && series.maxZar > 0;

  return (
    <div>
      {showKg && (
        <>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>
              Harvested per month
            </span>
            {/* ← LedgerSeries.maxKg (from ProductionLog.kg bucketed by logged_at) */}
            <span className="font-sans" style={{ fontSize: 10.5, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
              peak {formatKg(series.maxKg)}
            </span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 62 }}
            data-selector="monthlyLedgerSeries().months[].producedKg"
          >
            {series.months.map((m) => (
              <div key={m.key} className="flex-1 flex flex-col items-center justify-end" style={{ height: '100%' }}>
                <div
                  title={`${m.label} ${m.year}: ${m.producedKg === null ? 'not visible' : formatKg(m.producedKg)}`}
                  style={{
                    width: '72%', maxWidth: 18,
                    height: Math.max(2, ((m.producedKg ?? 0) / kgMax) * 54),
                    borderRadius: '3px 3px 1px 1px',
                    background: (m.producedKg ?? 0) > 0 ? FOREST : 'rgba(32,25,15,0.10)',
                    transition: 'height 400ms var(--ease-spring, ease)',
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {showMoney && (
        <>
          <div className="flex items-baseline justify-between" style={{ marginTop: 10, marginBottom: 4 }}>
            <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>
              Money in / out per month
            </span>
            <span className="font-sans inline-flex items-center gap-2" style={{ fontSize: 10.5, color: FAINT }}>
              <span style={{ color: FOREST }}>■ in</span>
              <span style={{ color: RUST }}>■ out</span>
            </span>
          </div>
          <div
            style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 44 }}
            data-selector="monthlyLedgerSeries().months[].incomeZar / .expensesZar"
          >
            {series.months.map((m) => (
              <div key={m.key} className="flex-1 flex items-end justify-center gap-[2px]" style={{ height: '100%' }}>
                <div
                  title={`${m.label} ${m.year} in: ${m.incomeZar === null ? 'not visible' : formatZar(m.incomeZar)}`}
                  style={{
                    width: 6, borderRadius: '2px 2px 0 0',
                    height: Math.max(2, ((m.incomeZar ?? 0) / zarMax) * 38),
                    background: (m.incomeZar ?? 0) > 0 ? FOREST : 'rgba(32,25,15,0.10)',
                    transition: 'height 400ms var(--ease-spring, ease)',
                  }}
                />
                <div
                  title={`${m.label} ${m.year} out: ${m.expensesZar === null ? 'not visible' : formatZar(m.expensesZar)}`}
                  style={{
                    width: 6, borderRadius: '2px 2px 0 0',
                    height: Math.max(2, ((m.expensesZar ?? 0) / zarMax) * 38),
                    background: (m.expensesZar ?? 0) > 0 ? RUST : 'rgba(32,25,15,0.10)',
                    transition: 'height 400ms var(--ease-spring, ease)',
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
        {series.months.map((m) => (
          <span
            key={m.key}
            className="flex-1 text-center font-sans"
            style={{ fontSize: 10.5, color: m.month === 1 ? MUTED : FAINT, fontWeight: m.month === 1 ? 700 : 500 }}
          >
            {m.label.slice(0, 1)}
          </span>
        ))}
      </div>
      <div
        className="font-sans"
        style={{ fontSize: 10.5, color: FAINT, marginTop: 6, lineHeight: 1.35, fontVariantNumeric: 'tabular-nums' }}
      >
        {series.months.length} months to {series.months[series.months.length - 1]?.label}{' '}
        {series.months[series.months.length - 1]?.year}. Bars are dated ledger entries only — a
        gap is a month with no entry, not a month of no work.
      </div>
    </div>
  );
}

function FlagChip({ flag }: { flag: NetworkAttentionFlag }) {
  const urgent = flag.severity === 'urgent';
  return (
    <span
      className="inline-flex items-center gap-1 font-sans font-semibold"
      style={{
        fontSize: 11, padding: '3px 9px', borderRadius: 999,
        background: urgent ? 'rgba(192,83,30,0.12)' : 'rgba(158,92,8,0.10)',
        border: `1px solid ${urgent ? 'rgba(192,83,30,0.35)' : 'rgba(158,92,8,0.28)'}`,
        color: urgent ? RUST : OCHRE,
      }}
    >
      <AlertTriangle size={11} aria-hidden />
      {flag.label}
    </span>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The panel
 * ──────────────────────────────────────────────────────────────────────────*/

export function FarmerPanel({
  farmer, summary, onClose, sources, onViewOnMap, demoNotice, variant = 'sheet', className,
}: FarmerPanelProps) {
  const m = summary.metrics;

  const flags = useMemo(() => attentionFlags(summary), [summary]);          // ← attentionFlags()
  const money = useMemo(() => financeRows(m), [m]);                          // ← financeRows()
  const produce = useMemo(() => produceRows(m), [m]);                        // ← produceRows()
  const survey = useMemo(() => surveyReadout(m), [m]);                       // ← surveyReadout()
  const progress = useMemo(() => progressReadout(m), [m]);                   // ← progressReadout()
  const series = useMemo(
    () => monthlyLedgerSeries(sources, { months: 12, joinedAt: farmer.joinedAt }),
    [sources, farmer.joinedAt],
  );

  const statusColor = STATUS_COLOR[farmer.status] ?? MUTED;
  const consentMeta = CONSENT_META[farmer.consent] ?? CONSENT_META.unknown;

  // Named lookups, not array indices — `money` order is a contract owned by
  // FarmerPanel.format.ts, and `.find` stays correct even if that changes.
  const netRow = money.find((r) => r.key === 'net');
  const incomeRow = money.find((r) => r.key === 'income');
  const expensesRow = money.find((r) => r.key === 'expenses');
  const valueRow = money.find((r) => r.key === 'value');

  const content = (
    <>
        {/* ── sample-data badge ──────────────────────────────────────────
            farmer.isDemo is set by lib/network-demo.ts. A funder must never be
            unsure whether they are looking at a real person. */}
        {farmer.isDemo && (
          <div
            className="flex items-start gap-2 px-3 py-2 rounded-xl"
            style={{ background: 'rgba(176,122,30,0.10)', border: '1px solid rgba(176,122,30,0.30)' }}
          >
            <Info size={13} style={{ color: GOLD, flexShrink: 0, marginTop: 2 }} />
            <span className="font-sans" style={{ fontSize: 10.5, color: OCHRE, lineHeight: 1.4 }}>
              {demoNotice ?? SAMPLE_DATA_NOTICE}
            </span>
          </div>
        )}

        {/* ── identity + site ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <div
            className="rounded-full flex items-center justify-center flex-shrink-0 font-display font-semibold"
            style={{
              width: 46, height: 46, background: 'rgba(31,77,43,0.14)',
              border: '1px solid rgba(31,77,43,0.35)', color: FOREST, fontSize: 16,
            }}
            aria-hidden
          >
            {initialsOf(farmer.name)}
          </div>
          <div className="min-w-0 flex-1">
            {/* ← NetworkFarmer.name (Profile.full_name). No ID number — see (F). */}
            <div
              className="font-display font-bold truncate"
              style={{ color: INK, fontSize: 18, lineHeight: 1.2, letterSpacing: '-0.01em' }}
            >
              {farmer.name}
            </div>
            {/* ← NetworkFarmer.siteName (Garden.name) */}
            <div className="font-sans truncate" style={{ color: BODY, fontSize: 12 }}>
              {farmer.siteName}
            </div>
            <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 4 }}>
              {/* ← NetworkFarmer.status (Garden.status) */}
              <span
                className="inline-flex items-center gap-1 font-sans font-semibold"
                style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999,
                  background: `${statusColor}1A`, border: `1px solid ${statusColor}55`, color: statusColor,
                }}
              >
                <Sprout size={10} aria-hidden />
                {statusLabel(farmer.status)}
              </span>
              {/* ← NetworkFarmer.consent — see header (C). Badged plainly, never
                  as a mark against the farmer: 'withheld' is their own choice. */}
              <span
                className="inline-flex items-center gap-1 font-sans font-semibold"
                data-selector="NetworkFarmer.consent"
                title="Whether this farmer has agreed to a funder seeing their books"
                style={{
                  fontSize: 12, padding: '2px 8px', borderRadius: 999,
                  background: `${consentMeta.color}1A`, border: `1px solid ${consentMeta.color}55`,
                  color: consentMeta.color,
                }}
              >
                <consentMeta.icon size={10} aria-hidden />
                {consentMeta.label}
              </span>
            </div>
          </div>
        </div>

        <Card>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5" style={{ margin: 0 }}>
            <Fact
              icon={<MapPin size={11} />}
              label="Where"
              /* ← NetworkFarmer.district (Garden.town) + .municipality */
              value={farmer.district}
              sub={farmer.municipality}
              selector="NetworkFarmer.district / .municipality"
            />
            <Fact
              icon={<Ruler size={11} />}
              label="Plot"
              /* ← NetworkFarmer.plotSizeM2 (GardenMember.size_m2) */
              value={formatArea(farmer.plotSizeM2)}
              sub={farmer.plotLabel ?? 'no plot label recorded'}
              selector="NetworkFarmer.plotSizeM2 / .plotLabel"
            />
            <Fact
              icon={<CalendarDays size={11} />}
              label="Joined"
              /* ← NetworkFarmer.joinedAt + NetworkFarmerMetrics.monthsActive */
              value={formatJoinedDate(farmer.joinedAt)}
              sub={`${formatMonthsActive(m.monthsActive)} in the programme`}
              selector="NetworkFarmer.joinedAt / NetworkFarmerMetrics.monthsActive"
            />
            <Fact
              icon={<Leaf size={11} />}
              label="Cohort"
              /* ← NetworkFarmer.cohortName (Garden.programme_id → Programme.name) */
              value={farmer.cohortName ?? 'Not assigned'}
              sub={farmer.cohortName ? undefined : 'no cohort recorded for this site'}
              selector="NetworkFarmer.cohortName"
            />
          </dl>

          <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 11, paddingTop: 9 }}>
            {/* ← NetworkFarmerMetrics.lastActivityAt / .daysSinceActivity */}
            <div className="flex items-center justify-between gap-2">
              <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>Last entry in any book</span>
              {m.daysSinceActivity === null ? (
                <span
                  className="font-sans"
                  data-selector="NetworkFarmerMetrics.daysSinceActivity"
                  data-state="not_recorded"
                  style={{ fontSize: 11, color: FAINT, fontStyle: 'italic', fontWeight: 600 }}
                >
                  No dated entries yet
                </span>
              ) : (
                <span
                  className="font-sans font-semibold"
                  data-selector="NetworkFarmerMetrics.daysSinceActivity"
                  style={{
                    fontSize: 11.5, color: m.daysSinceActivity > 90 ? RUST : BODY,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {formatDaysAgo(m.daysSinceActivity)}
                </span>
              )}
            </div>
          </div>

          {onViewOnMap && (
            <button
              type="button"
              onClick={() => onViewOnMap(farmer)}
              className="w-full flex items-center justify-center gap-1.5 font-display font-semibold transition hover:brightness-95 active:brightness-90"
              style={{
                marginTop: 10, padding: '9px 0', borderRadius: 10, minHeight: 40,
                background: 'rgba(47,111,158,0.12)', border: '1px solid rgba(47,111,158,0.35)',
                color: BLUE, fontSize: 12.5, cursor: 'pointer',
              }}
            >
              <MapPin size={13} /> Show this site on the map
            </button>
          )}
        </Card>

        {/* ── attention flags ───────────────────────────────────────────────
            ← attentionFlags(summary). Conservative by design: an unreadable
            metric produces 'no_data', never a performance flag — "we cannot
            see this farmer" and "this farmer is failing" must not look alike. */}
        {flags.length > 0 && (
          <div className="flex flex-wrap gap-1.5" data-selector="attentionFlags(summary)">
            {flags.map((f) => <FlagChip key={f.kind} flag={f} />)}
          </div>
        )}

        {/* ══ FINANCIALS ══════════════════════════════════════════════════ */}
        <section className="space-y-2">
          <SectionLabel icon={<Wallet size={12} />}>Financials — this season</SectionLabel>
          <Card accent={FOREST}>
            {/* Net margin leads — it is the one figure this card exists to
                answer. Income/expenses/value support it and visibly recede;
                see HeroStat / StatBlock above. */}
            {netRow && <HeroStat row={netRow} />}

            {(incomeRow || expensesRow) && (
              <div className="grid grid-cols-2 gap-2" style={{ marginTop: netRow ? 10 : 0 }}>
                {incomeRow && <StatBlock row={incomeRow} />}
                {expensesRow && <StatBlock row={expensesRow} />}
              </div>
            )}

            {valueRow && (
              <div style={{ marginTop: 8 }}>
                <StatBlock row={valueRow} />
              </div>
            )}

            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 11, paddingTop: 10 }}>
              <div className="grid grid-cols-3 gap-2">
                {produce.map((row) => <StatBlock key={row.key} row={row} />)}
              </div>

              {/* ← NetworkFarmerMetrics.soldPct — share of the harvest sold.
                  Explicitly names its denominator so 62% is not free-floating. */}
              {m.soldPct !== null && m.producedKg !== null && m.producedKg > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
                    <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>
                      Sold, as a share of the {formatKg(m.producedKg)} harvested
                    </span>
                    <span
                      className="font-display font-semibold"
                      data-selector="NetworkFarmerMetrics.soldPct"
                      style={{ fontSize: 12, color: FOREST, fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatPct(m.soldPct)}
                    </span>
                  </div>
                  <ProportionBar pct={m.soldPct} color={FOREST} />
                </div>
              )}
            </div>

            {/* Crop-cycle benchmarks have no sowing year or completion marker.
                Show them as context, never as a performance percentage. */}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 11, paddingTop: 10 }}>
              <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 4 }}>
                <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>
                  Crop-plan context
                </span>
                {m.plannedKg !== null && (
                  <span
                    className="font-display font-semibold"
                    data-selector="NetworkFarmerMetrics.plannedKg"
                    style={{ fontSize: 12, color: FOREST, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatKg(m.plannedKg)}
                  </span>
                )}
              </div>
              {m.coverage.plan && m.plannedKg !== null ? (
                <div className="font-sans" data-selector="NetworkFarmerMetrics.harvestedVsPlannedPct" data-state="not_comparable" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.4 }}>
                  Benchmark for one complete crop-plan cycle. It is not compared with calendar harvest logs because the saved plan has no sowing year or completed-cycle marker.
                </div>
              ) : (
                <div
                  className="font-sans"
                  data-selector="NetworkFarmerMetrics.harvestedVsPlannedPct"
                  data-state={
                    m.coverage.plan ? 'not_recorded' : m.coverage.siteProgress ? 'not_recorded' : 'not_visible'
                  }
                  style={{ fontSize: 11, color: FAINT, fontStyle: 'italic', lineHeight: 1.4 }}
                >
                  {m.coverage.plan
                    ? 'A plan is visible, but it has no verified crop-cycle kilogram benchmark. Missing evidence is not a 0 kg target.'
                    : m.coverage.siteProgress
                      ? 'No crop plan is recorded yet. This is a missing plan, not missed production.'
                      : 'The farmer’s crop plan is not readable here. Not visible is not the same as no plan.'}
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* ══ SEASON OVER TIME ════════════════════════════════════════════
            Rendered only when the ledgers were passed AND cover enough months
            to be a trend. Otherwise the panel says why, and draws nothing. */}
        <section className="space-y-2">
          <SectionLabel icon={<TrendingUp size={12} />}>Month by month</SectionLabel>
          <Card>
            {series.renderable ? (
              <MonthStrip series={series} />
            ) : (
              <div className="flex items-start gap-2">
                <Minus size={12} style={{ color: FAINT, flexShrink: 0, marginTop: 2 }} />
                <span className="font-sans" style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}>
                  {series.reason}
                  {!sources && ' No chart is drawn rather than an invented one.'}
                </span>
              </div>
            )}
          </Card>
        </section>

        {/* ══ SURVEYS ═════════════════════════════════════════════════════ */}
        <section className="space-y-2">
          <SectionLabel icon={<ClipboardList size={12} />}>Surveys</SectionLabel>
          <Card accent={survey.state === 'complete' ? FOREST : GOLD}>
            <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 6 }}>
              <span className="font-sans font-semibold" style={{ fontSize: 11.5, color: BODY }}>
                Site survey
              </span>
              {/* ← NetworkFarmerMetrics.surveyFilled / .surveyTotal */}
              <span
                className="font-display font-semibold"
                data-selector="NetworkFarmerMetrics.surveyFilled / .surveyTotal"
                data-state={survey.state}
                style={{
                  fontSize: 13,
                  color: survey.state === 'not_visible' ? MUTED : survey.state === 'complete' ? FOREST : OCHRE,
                  fontStyle: survey.state === 'not_visible' ? 'italic' : 'normal',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {survey.headline}
              </span>
            </div>

            {survey.filled !== null && survey.total !== null && (
              <SurveyDots filled={survey.filled} total={survey.total} />
            )}

            <div className="font-sans" style={{ fontSize: 10.5, color: MUTED, marginTop: 8, lineHeight: 1.45 }}>
              {survey.note}
            </div>

            {survey.state === 'partial' && survey.missing !== null && (
              <div
                className="flex items-center gap-1.5"
                style={{
                  marginTop: 8, padding: '6px 9px', borderRadius: 9,
                  background: 'rgba(176,122,30,0.09)', border: '1px solid rgba(176,122,30,0.25)',
                }}
              >
                <AlertTriangle size={11} style={{ color: GOLD, flexShrink: 0 }} />
                <span className="font-sans" style={{ fontSize: 10.5, color: OCHRE, lineHeight: 1.35 }}>
                  Treat the {survey.missing} blank {survey.missing === 1 ? 'answer' : 'answers'} as
                  unknown. Do not read them as a low score.
                </span>
              </div>
            )}

            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 11, paddingTop: 9 }}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans" style={{ fontSize: 10.5, color: MUTED }}>
                  Programme survey rounds
                </span>
                {/* ← NetworkFarmerMetrics.surveysAnswered (SurveyResponse rows) */}
                <ReadoutValue
                  readout={survey.ngoRounds}
                  selector="NetworkFarmerMetrics.surveysAnswered"
                  size={12.5}
                  tone={BODY}
                />
              </div>
            </div>
          </Card>
        </section>

        {/* ══ PROGRESS ════════════════════════════════════════════════════ */}
        <section className="space-y-2">
          <SectionLabel icon={<ListChecks size={12} />}>Progress</SectionLabel>
          <Card accent={BLUE}>
            {progress.visible && progress.pct !== null ? (
              <>
                <div className="flex items-baseline justify-between gap-2" style={{ marginBottom: 5 }}>
                  <span className="font-sans" style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.35 }}>
                    {/* the proportion AND what it is a proportion OF */}
                    {progress.headline}
                  </span>
                  <span
                    className="font-display font-bold"
                    data-selector="NetworkFarmerMetrics.progressPct"
                    style={{ fontSize: 18, color: BLUE, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {formatPct(progress.pct)}
                  </span>
                </div>
                <ProportionBar pct={progress.pct} color={BLUE} />
                {progress.stageText && (
                  <div className="font-sans" style={{ fontSize: 10.5, color: BODY, marginTop: 7 }}>
                    Furthest stage reached:{' '}
                    <strong data-selector="NetworkFarmerMetrics.stage" style={{ color: INK }}>
                      {progress.stageText}
                    </strong>
                  </div>
                )}

                {/* ← NetworkFarmerMetrics.steps (computeCompletionScore().steps) */}
                {progress.steps && (
                  <div className="space-y-1.5" style={{ marginTop: 10 }} data-selector="NetworkFarmerMetrics.steps">
                    {progress.steps.map((step) => (
                      <div key={step.key} className="flex items-center gap-2">
                        <span
                          className="flex items-center justify-center flex-shrink-0"
                          style={{
                            width: 15, height: 15, borderRadius: 5,
                            background: step.done ? FOREST : 'transparent',
                            border: step.done ? `1px solid ${FOREST}` : `1px dashed ${FAINT}`,
                            color: CARD,
                          }}
                        >
                          {step.done && <Check size={9} />}
                        </span>
                        <span
                          className="font-sans flex-1 truncate"
                          style={{ fontSize: 11, color: step.done ? BODY : MUTED }}
                        >
                          {step.label}
                        </span>
                        <span
                          className="font-sans font-semibold"
                          style={{ fontSize: 10.5, color: step.done ? FOREST : FAINT, fontVariantNumeric: 'tabular-nums' }}
                        >
                          {step.pct === 0 ? 'not started' : formatPct(step.pct)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="font-sans" style={{ fontSize: 10.5, color: FAINT, marginTop: 9, lineHeight: 1.35 }}>
                  {progress.note}
                </div>
              </>
            ) : (
              <div className="flex items-start gap-2">
                <ShieldAlert size={12} style={{ color: MUTED, flexShrink: 0, marginTop: 2 }} />
                <span
                  className="font-sans"
                  data-selector="NetworkFarmerMetrics.progressPct"
                  data-state="not_visible"
                  style={{ fontSize: 11, color: MUTED, lineHeight: 1.45 }}
                >
                  {progress.note}
                </span>
              </div>
            )}

            {/* ← NetworkFarmerMetrics.modulesDone / .modulesTotal / .trainingPct */}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: 11, paddingTop: 10 }}>
              <div className="flex items-center justify-between gap-2" style={{ marginBottom: 5 }}>
                <span className="font-sans inline-flex items-center gap-1.5" style={{ fontSize: 10.5, color: MUTED }}>
                  <GraduationCap size={12} /> Course modules completed
                </span>
                <ReadoutValue
                  readout={progress.training}
                  selector="NetworkFarmerMetrics.modulesDone"
                  size={12.5}
                  tone={BODY}
                />
              </div>
              {progress.trainingPct !== null ? (
                <ProportionBar pct={progress.trainingPct} color={GOLD} />
              ) : (
                <div className="font-sans" style={{ fontSize: 10.5, color: FAINT, fontStyle: 'italic' }}>
                  Training records are not readable for this farmer, so no proportion is shown.
                </div>
              )}
            </div>
          </Card>
        </section>

        {/* ── provenance / access-control footer ─────────────────────────── */}
        <div
          className="flex items-start gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'rgba(32,25,15,0.04)', border: `1px solid ${BORDER}` }}
        >
          <ShieldAlert size={12} style={{ color: MUTED, flexShrink: 0, marginTop: 2 }} />
          <span className="font-sans" style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.45 }}>
            Every figure here is derived by <code style={{ fontSize: 12 }}>lib/network.ts</code> from
            already-loaded records; hover any value for its source, or read its{' '}
            <code style={{ fontSize: 12 }}>data-selector</code> attribute.{' '}
            <strong style={{ color: BODY }}>Not visible</strong> means this account could not read
            that record — it never means zero.
            {farmer.consent === 'demo'
              ? ' These are invented records, so no consent question arises.'
              : ' Showing a real farmer’s books to another account requires a server-side authorisation gate and that farmer’s recorded consent — see the header of this file.'}
          </span>
        </div>
    </>
  );

  // The parent already owns the sheet and its scroll container — render the
  // sections only, so there is exactly one close button and one scroller.
  if (variant === 'embedded') {
    return (
      <div
        aria-label={`Farmer record — ${farmer.name}`}
        className={['space-y-4', className ?? ''].join(' ')}
      >
        {content}
      </div>
    );
  }

  return (
    <aside
      aria-label={`Farmer record — ${farmer.name}`}
      className={[
        // mobile: bottom sheet
        'absolute inset-x-0 bottom-0 z-20 rounded-t-3xl shadow-float max-h-[80dvh] u-anim-sheet',
        // md+: right column
        'md:static md:z-auto md:w-[400px] md:flex-shrink-0 md:rounded-none md:border-l md:max-h-none md:shadow-none',
        className ?? '',
      ].join(' ')}
      style={{ background: PAPER, borderColor: BORDER, display: 'flex', flexDirection: 'column' }}
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-3 pb-2 flex-shrink-0" style={{ position: 'relative' }}>
        <div
          className="md:hidden absolute left-1/2 -translate-x-1/2"
          style={{ top: 6, width: 40, height: 4, borderRadius: 2, background: '#D5C9AE' }}
        />
        <div className="min-w-0" style={{ marginTop: 4 }}>
          <span className="font-sans font-bold uppercase" style={{ fontSize: 11, letterSpacing: '0.12em', color: MUTED }}>
            Farmer record
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close farmer record"
          className="transition hover:brightness-95 active:brightness-90"
          style={{
            background: 'rgba(32,25,15,0.06)', border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: 8, cursor: 'pointer', color: BODY, display: 'flex',
            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            minWidth: 40, minHeight: 40,
          }}
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3.5 pb-6 space-y-4" style={{ minHeight: 0 }}>
        {content}
      </div>
    </aside>
  );
}

/** One label/value pair in the site card. */
function Fact({ icon, label, value, sub, selector }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; selector: string;
}) {
  return (
    <div className="min-w-0">
      <dt
        className="flex items-center gap-1 font-sans"
        style={{ color: MUTED, fontSize: 10.5, marginBottom: 2 }}
      >
        {icon}
        {label}
      </dt>
      {/* `title` because a long cohort or site name truncates in this grid and
          a funder must still be able to read the whole thing. */}
      <dd
        className="font-display font-semibold truncate"
        data-selector={selector}
        title={value}
        style={{ color: INK, fontSize: 13, margin: 0, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </dd>
      {sub && (
        <div
          className="font-sans truncate"
          title={sub}
          style={{ color: FAINT, fontSize: 10.5, fontVariantNumeric: 'tabular-nums' }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default FarmerPanel;

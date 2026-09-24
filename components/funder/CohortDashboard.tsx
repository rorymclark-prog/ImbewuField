'use client';

/*
 * THE COHORT DASHBOARD — what a funder or an NGO programme manager opens first.
 *
 * The question this screen exists to answer is not "how is this farm doing", which the map and the
 * farmer panel already answer well. It is the one asked in a funding meeting: WHAT DID THE MONEY
 * BUY, ACROSS EVERYONE, AND HOW DO I CHECK IT. So it is laid out in that order —
 *
 *    1. what the cohort adds up to          (portfolioTotals, lib/network.ts)
 *    2. how that moved month by month       (CohortTimeline ← the server's `monthly` series)
 *    3. how far the training got            (CohortTrainingChart ← cohortTraining)
 *    4. every farm, searchable, exportable  (the roster below, + cohortCsv)
 *    5. any single farm, in full            (FarmerPanel, the same one the map opens)
 *
 * ── THE ONE RULE THIS SCREEN CANNOT BEND ─────────────────────────────────────────────────────
 * Every figure on it comes from `useNetworkPortfolio()` — the authorised, consent-projected read
 * in app/api/network/farmers/route.ts — or from the pure selectors over it. There is no constant
 * in this file that a funder could mistake for a measurement, and there is no fallback that
 * invents one. The old NGO dashboard beside it (components/NgoDashboard.tsx) carries a hardcoded
 * `TOTALS = { gardens: 142, farmers: 3012, produceT: 38.6, … }` which it shows in demo mode; that
 * is exactly the pattern this screen was built to replace, and copying it here would defeat the
 * whole exercise.
 *
 * ── WHY THE FILTERS SIT BELOW THE CHARTS AND NOT ABOVE THEM ──────────────────────────────────
 * The month-by-month series is computed SERVER-SIDE, per organisation, because per-farmer totals
 * cannot be re-bucketed into months on the client. So it cannot answer a district filter, and a
 * filter control placed above it would silently imply that it had. The controls therefore live
 * inside the roster section they actually govern, the roster states its own count against the
 * cohort, and the two totals never appear to contradict each other.
 *
 * ── WHAT IS DELIBERATELY NOT HERE ────────────────────────────────────────────────────────────
 *  • PHOTOS. `NetworkFarmer.photoUrl` is null for every record the app can currently produce, and
 *    filling the gap would mean putting Firebase Storage download URLs — which are bearer
 *    capabilities, not paths — into a payload that crosses an organisation boundary.
 *  • GENERATED REPORTS. The `reports` collection carries no `org_id`, so the staff read rule
 *    (`sameOrg`) matches nothing for another org's farmer. A list that is always empty for the
 *    person it was built for is worse than no list.
 * Both are findings for the owner, not silently-missing features: an empty "Evidence" panel on a
 * funder screen reads as a programme with no evidence.
 */

import { useCallback, useMemo, useState } from 'react';
import {
  AlertTriangle, ArrowUpRight, Download, Search, SlidersHorizontal, X,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import FieldDataStatus from '@/components/FieldDataStatus';
import { useNetworkPortfolio } from '@/lib/use-network-portfolio';
import {
  attentionFlags,
  filterNetwork,
  portfolioTotals,
  rollupBy,
  sortNetwork,
  type NetworkFarmerSummary,
  type NetworkAttentionFlag,
  type NetworkSortKey,
} from '@/lib/network';
import { cohortCsv, cohortCsvFilename, cohortTraining } from '@/lib/cohort-report';
import { isSampleMode } from '@/lib/sample-mode';
import { DEMO_NETWORK_NOTICE, demoFarmerById } from '@/lib/network-demo';
import { kgTotalLabel, randLabel } from '@/lib/format-figures';
import { useLanguage } from '@/lib/i18n';
import FarmerPanel from '@/components/network/FarmerPanel';
import { CohortTimeline, CohortTrainingChart } from './CohortCharts';
import type { GardenStatus } from '@/lib/db/types';

/* Programme surfaces match the assessment cards; chart meanings retain their colours. */
const INK = '#183427';
const INK_SOFT = '#44574B';
const INK_MUTED = '#506158';
const LINE = '#D7E3D9';
const PAPER = '#FFFFFF';
const FIELD = '#EFF4EF';
const FOREST = '#1F4D2B';
const ATTENTION = '#C0531E';

const STATUS_COLOR: Record<GardenStatus, string> = {
  thriving: '#1F4D2B',
  establishing: '#9E5C08',
  support: '#C0531E',
};

/** Micro-label floor. Nothing in this file goes under it. */
const MICRO = 12;

const DASH = '—';
/** Space-grouped thousands, locale-independent so SSR and the first client render agree. */
function group(n: number): string {
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
/** A null aggregate means "not readable by this account" — never 0. */
function statKg(n: number | null): string {
  return n === null ? DASH : kgTotalLabel(n);
}
function statZar(n: number | null): string {
  return n === null ? DASH : randLabel(n);
}

const SORTS: Array<{ key: NetworkSortKey; label: string }> = [
  { key: 'attention', label: 'Needs a visit' },
  { key: 'production', label: 'Harvest' },
  { key: 'income', label: 'Income' },
  { key: 'joined', label: 'Joined' },
  { key: 'name', label: 'Name' },
];

/* ────────────────────────────────────────────────────────────────────────────
 * Headline tiles
 * ──────────────────────────────────────────────────────────────────────────*/

function Tile({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: 'attention';
}) {
  return (
    <div
      className="rounded-2xl px-4 py-4 min-w-0"
      style={{ background: PAPER, border: `1px solid ${LINE}` }}
    >
      {/* Wraps rather than truncates. At 375px a two-column tile is ~160px wide and "Logged this
          month" ellipsed to "LOGGED THIS MON…", which is a label that has stopped labelling. */}
      <div
        className="font-sans uppercase"
        style={{ fontSize: MICRO, letterSpacing: '0.09em', color: INK_MUTED, lineHeight: 1.35 }}
      >
        {label}
      </div>
      <div
        className="font-display font-bold"
        style={{
          fontSize: 'clamp(19px, 2.1vw, 26px)', lineHeight: 1.15, marginTop: 3,
          color: tone === 'attention' ? ATTENTION : INK,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      {sub && (
        <div className="font-sans" style={{ fontSize: MICRO, color: INK_MUTED, marginTop: 2, lineHeight: 1.4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * The dashboard
 * ──────────────────────────────────────────────────────────────────────────*/

export default function CohortDashboard({ mode = 'ngo' }: { mode?: 'funder' | 'ngo' }) {
  const { lang } = useLanguage();
  const ui = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const { user } = useAuth();
  const portfolio = useNetworkPortfolio(Boolean(user));
  const all = portfolio.rows;

  const [query, setQuery] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [attentionOnly, setAttentionOnly] = useState(false);
  const [sort, setSort] = useState<NetworkSortKey>('attention');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /* Headline and charts are always the WHOLE cohort — see the header. */
  const totals = useMemo(() => portfolioTotals(all), [all]);
  const training = useMemo(() => cohortTraining(all), [all]);
  const allDistricts = useMemo(
    () => rollupBy(all, 'municipality').map((d) => ({ key: d.key, count: d.farmerCount })),
    [all],
  );

  /* The roster, and only the roster, answers the controls. */
  const filtered = useMemo(
    () =>
      filterNetwork(all, {
        query: query.trim() || undefined,
        municipalities: districts.length ? districts : undefined,
        needsAttentionOnly: attentionOnly || undefined,
      }),
    [all, query, districts, attentionOnly],
  );
  const sorted = useMemo(() => sortNetwork(filtered, sort), [filtered, sort]);

  const selected = useMemo(
    () => all.find((r) => r.farmer.id === selectedId) ?? null,
    [all, selectedId],
  );

  const monthly = portfolio.monthly;
  /* The current calendar month's bucket, straight off the series the chart is drawn from. Named
     rather than described as "this month" in the abstract, because the month it means is the last
     column of the chart directly below it. */
  const thisMonth = monthly.months.length > 0 ? monthly.months[monthly.months.length - 1] : null;

  const toggleDistrict = (key: string) =>
    setDistricts((cur) => (cur.includes(key) ? cur.filter((d) => d !== key) : [...cur, key]));

  const clearFilters = () => { setQuery(''); setDistricts([]); setAttentionOnly(false); };
  const filtersOn = query.trim().length > 0 || districts.length > 0 || attentionOnly;

  /* EXPORTS EXACTLY WHAT IS ON SCREEN — the filtered, sorted rows, never the whole portfolio.
     An export that quietly widens the selection hands over records the person never looked at. */
  const exportCsv = useCallback(() => {
    const csv = cohortCsv(sorted);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = cohortCsvFilename(new Date(), portfolio.isDemo ? 'sample-cohort' : 'cohort');
    a.click();
    URL.revokeObjectURL(url);
  }, [sorted, portfolio.isDemo]);

  const tiles: Array<{ label: string; value: string; sub?: string; tone?: 'attention' }> = [
    {
      label: mode === 'funder' ? ui('Farms funded','Amapulazi axhasiwe') : ui('Farms','Amapulazi'),
      value: String(totals.farmerCount),
      sub: `${totals.municipalityCount} ${ui(totals.municipalityCount === 1 ? 'district' : 'districts', totals.municipalityCount === 1 ? 'isifunda' : 'izifunda')}`,
    },
    {
      label: ui('Reported plot area','Indawo ebikiwe yeziza'),
      value: `${totals.totalPlotHa} ha`,
      sub: `${group(totals.totalPlotM2)} m² · ${ui('reported; may include shared gardens','kubikiwe; kungafaka nezingadi ezabiwe')}`,
    },
    { label: ui('Harvested','Okuvunyiwe'), value: statKg(totals.producedKg), sub: `${statKg(totals.soldKg)} ${ui('sold','kudayisiwe')}` },
    {
      label: ui('Farmer income','Imali engenayo yabalimi'),
      value: statZar(totals.incomeZar),
      sub: totals.netZar === null ? undefined : `${statZar(totals.netZar)} ${ui('after costs','emva kwezindleko')}`,
    },
    {
      label: ui('Training records shared','Amarekhodi okuqeqeshwa abiwe'),
      value: `${training.reporting} / ${training.total}`,
      sub: ui('farmers sharing course progress','abalimi ababelana ngenqubekelaphambili yesifundo'),
    },
    {
      label: ui('Logged this month','Okuqoshiwe kule nyanga'),
      value: thisMonth === null ? DASH : String(thisMonth.activeFarmers),
      sub: thisMonth === null ? ui('no month-by-month data','ayikho idatha yenyanga ngayinye') : `${ui('farms recording in','amapulazi aqopha ngo-')}${thisMonth.longLabel}`,
    },
    {
      label: ui('Course finished','Isifundo esiqediwe'),
      value: training.reporting === 0 ? DASH : `${training.averagePct ?? 0}%`,
      sub: training.reporting === 0
        ? ui('no training records shared','akukho marekhodi okuqeqeshwa abiwe')
        : `${ui('average over','isilinganiso samapulazi angu-')}${training.reporting} ${ui('of','kwangu-')} ${training.total}`,
    },
    {
      label: ui('Needs a visit','Idinga ukuvakashelwa'),
      value: String(totals.needsAttentionCount),
      sub: `${totals.activeLast90Days} ${ui('active in 90 days','asebenze ezinsukwini ezingu-90')}`,
      tone: totals.needsAttentionCount > 0 ? 'attention' : undefined,
    },
  ];

  const emptyPortfolio = !portfolio.loading && !portfolio.error && all.length === 0;

  return (
    <div className="flex-1 flex overflow-hidden relative min-h-0">
      {/* ── main column ── */}
      <div className="flex-1 overflow-y-auto min-w-0" style={{ background: FIELD }}>
        {/* Banners, in order of what would stop you trusting the screen ------------------- */}
        <FieldDataStatus data={portfolio.deviceData} />
      {portfolio.error && (
          <div
            className="flex items-center gap-2 px-3 md:px-5 py-2.5"
            style={{ background: 'rgba(158,92,8,0.08)', borderBottom: `1px solid ${LINE}` }}
          >
            <AlertTriangle size={14} style={{ color: '#9E5C08', flexShrink: 0 }} />
            <span className="font-sans" style={{ fontSize: 12.5, color: '#7A4A06', lineHeight: 1.45 }}>
              {portfolio.error}
            </span>
            <button
              type="button"
              onClick={portfolio.reload}
              className="font-sans font-semibold"
              style={{
                fontSize: MICRO, color: '#7A4A06', background: 'transparent',
                border: '1px solid rgba(158,92,8,0.35)', borderRadius: 7,
                padding: '3px 10px', cursor: 'pointer', marginLeft: 'auto', flexShrink: 0,
              }}
            >
              {ui('Try again','Zama futhi')}
            </button>
          </div>
        )}
        {portfolio.loading && !portfolio.error && (
          <div
            className="px-3 md:px-5 py-1.5 font-sans"
            style={{ fontSize: MICRO, color: INK_MUTED, background: PAPER, borderBottom: `1px solid ${LINE}` }}
          >
            {ui('Loading the cohort…','Kusalayishwa iqembu…')}
          </div>
        )}
        {portfolio.isDemo && !isSampleMode() && (
          <div
            className="px-3 md:px-5 py-2 font-sans"
            style={{
              fontSize: MICRO, color: '#7A4A06', lineHeight: 1.5,
              background: 'rgba(158,92,8,0.10)', borderBottom: '1px solid rgba(158,92,8,0.25)',
            }}
          >
            {ui(DEMO_NETWORK_NOTICE,'Iphothifoliyo yesibonelo')}
          </div>
        )}

        {lang === 'zu' && <p role="note" className="px-3 md:px-5 py-2 font-sans" style={{ fontSize: MICRO, color: INK_MUTED, lineHeight: 1.5, background: PAPER }}>
          Izilawuli nezaziso zokwabelana kuleli khasi zisesiZulu. Amanye amagrafu, izexwayiso zesimo sedatha nephaneli yemininingwane yomlimi zisaboniswa ngesiNgisi; amagama, amanani nobufakazi obuqoshwe ngabantu kuboniswa njengoba kugcinwe.
        </p>}

        <div className="px-3 md:px-5 pt-4" style={{ paddingBottom: 160, maxWidth: 1480, margin: '0 auto' }}>
          {/* ── 1. what the cohort adds up to ─────────────────────────────────────────── */}
          <h2
            className="font-display font-bold"
            style={{ fontSize: 'clamp(25px, 2.5vw, 32px)', color: INK, margin: '0 0 2px' }}
          >
            {mode === 'funder' ? ui('The cohort you are funding','Iqembu olixhasayo') : ui('The cohort','Iqembu')}
          </h2>
          <p className="font-sans" style={{ fontSize: 12.5, color: INK_MUTED, margin: '0 0 12px', lineHeight: 1.5 }}>
            {totals.reportingCount === totals.farmerCount
              ? ui(`Every figure below is recorded by the ${totals.farmerCount} ${totals.farmerCount === 1 ? 'farmer' : 'farmers'} it belongs to, and shown only for the categories they agreed to share.`,`Isibalo ngasinye esingezansi siqoshwe umlimi esingesakhe kubalimi abangu-${totals.farmerCount}, futhi siboniswa ezigabeni avume ukwabelana ngazo kuphela.`)
              : ui(`Totals cover the ${totals.reportingCount} of ${totals.farmerCount} farms whose records this account may read. The other ${totals.farmerCount - totals.reportingCount} are counted as farms, never as zeros.`,`Amarekhodi amapulazi angu-${totals.reportingCount} kwangu-${totals.farmerCount} ayafundeka kule akhawunti. Amanye angu-${totals.farmerCount - totals.reportingCount} asabalwa njengamapulazi, hhayi njengoziro.`)}
          </p>

          {emptyPortfolio ? (
            <div
              className="rounded-2xl px-4 py-6"
              style={{ background: PAPER, border: `1px solid ${LINE}` }}
            >
              <p className="font-display font-semibold" style={{ fontSize: 15, color: INK, margin: '0 0 6px' }}>
                {ui('No farms are visible to this account yet','Awekho amapulazi abonakala kule akhawunti okwamanje')}
              </p>
              <p className="font-sans" style={{ fontSize: 12.5, color: INK_SOFT, margin: 0, lineHeight: 1.6 }}>
                {ui('Farmers appear here once they have agreed to share their records with the organisation.','Abalimi babonakala lapha uma sebevumile ukwabelana ngenhlangano ngamarekhodi abo.')}{' '}
                {portfolio.withheldForConsent > 0
                  ? ui(`${portfolio.withheldForConsent} ${portfolio.withheldForConsent === 1 ? 'farmer is' : 'farmers are'} enrolled here and have not yet done so.`,`Abalimi abangu-${portfolio.withheldForConsent} babhalisiwe lapha kodwa abakavumi ukwabelana ngamarekhodi abo.`)
                  : ui('Nothing is hidden by an error — the list is genuinely empty.','Akukho okufihlwe iphutha — uhlu alunalutho ngempela.')}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-2.5 grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                {tiles.map((t) => (
                  <Tile key={t.label} label={t.label} value={t.value} sub={t.sub} tone={t.tone} />
                ))}
              </div>

              {/* ── 2 and 3. the two charts ───────────────────────────────────────────── */}
              <div className="grid gap-3 xl:grid-cols-2" style={{ marginTop: 14 }}>
                <CohortTimeline series={monthly} />
                <CohortTrainingChart training={training} />
              </div>

              {/* ── 4. every farm ─────────────────────────────────────────────────────── */}
              <section
                className="rounded-2xl overflow-hidden"
                style={{ background: PAPER, border: `1px solid ${LINE}`, marginTop: 14 }}
              >
                <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: `1px solid ${LINE}` }}>
                  <div className="flex items-center flex-wrap gap-2">
                    <h3
                      className="font-display font-bold"
                      style={{ fontSize: 15, color: INK, margin: 0, marginRight: 'auto' }}
                    >
                      {ui('Farm by farm','Ipulazi ngalinye')}
                    </h3>
                    <button
                      type="button"
                      onClick={exportCsv}
                      disabled={sorted.length === 0}
                      className="flex items-center gap-1.5 font-sans font-semibold"
                      style={{
                        fontSize: 12.5, borderRadius: 9, padding: '6px 11px',
                        minHeight: 34,
                        cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
                        opacity: sorted.length === 0 ? 0.45 : 1,
                        background: FOREST, color: '#F7F2E9', border: `1px solid ${FOREST}`,
                      }}
                    >
                      <Download size={13} />
                      {ui(`Export ${sorted.length === all.length ? 'all' : sorted.length} as CSV`,`Khipha ${sorted.length === all.length ? 'konke' : sorted.length} njenge-CSV`)}
                    </button>
                  </div>

                  {/* search */}
                  <div
                    className="flex items-center gap-2 px-2.5"
                    style={{ background: FIELD, border: `1px solid ${LINE}`, borderRadius: 10, height: 38, marginTop: 10 }}
                  >
                    <Search size={14} style={{ color: INK_MUTED, flexShrink: 0 }} />
                    <input
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={ui('Farmer, site, district or cohort…','Umlimi, indawo, isifunda noma iqembu…')}
                      aria-label={ui('Search the cohort','Sesha iqembu')}
                      className="flex-1 font-sans bg-transparent outline-none"
                      style={{ fontSize: 13, color: INK, border: 'none', minWidth: 0 }}
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery('')}
                        aria-label={ui('Clear search','Sula usesho')}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: INK_MUTED, display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* district chips + attention toggle */}
                  <div className="flex flex-wrap gap-1.5" style={{ marginTop: 9 }}>
                    {allDistricts.map((d) => {
                      const on = districts.includes(d.key);
                      return (
                        <button
                          key={d.key}
                          type="button"
                          onClick={() => toggleDistrict(d.key)}
                          aria-pressed={on}
                          className="font-sans font-semibold"
                          style={{
                            fontSize: MICRO, borderRadius: 999, padding: '5px 10px', cursor: 'pointer',
                            background: on ? FOREST : 'rgba(32,25,15,0.05)',
                            color: on ? '#F7F2E9' : INK_SOFT,
                            border: `1px solid ${on ? FOREST : LINE}`,
                          }}
                        >
                          {d.key} {d.count}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setAttentionOnly((v) => !v)}
                      aria-pressed={attentionOnly}
                      className="flex items-center gap-1.5 font-sans font-semibold"
                      style={{
                        fontSize: MICRO, borderRadius: 999, padding: '5px 10px', cursor: 'pointer',
                        background: attentionOnly ? 'rgba(192,83,30,0.12)' : 'rgba(32,25,15,0.05)',
                        color: attentionOnly ? ATTENTION : INK_SOFT,
                        border: `1px solid ${attentionOnly ? 'rgba(192,83,30,0.45)' : LINE}`,
                      }}
                    >
                      <AlertTriangle size={12} />
                      {ui('Needs a visit','Idinga ukuvakashelwa')} {totals.needsAttentionCount}
                    </button>
                  </div>

                  {/* sort */}
                  <div className="flex flex-wrap items-center gap-1.5" style={{ marginTop: 9 }}>
                    <span
                      className="flex items-center gap-1 font-sans uppercase"
                      style={{ fontSize: MICRO, color: INK_MUTED, letterSpacing: '0.08em' }}
                    >
                      <SlidersHorizontal size={12} />
                      {ui('Sort','Hlela')}
                    </span>
                    {SORTS.map((s) => (
                      <button
                        key={s.key}
                        type="button"
                        onClick={() => setSort(s.key)}
                        aria-pressed={sort === s.key}
                        className="font-sans font-semibold"
                        style={{
                          fontSize: MICRO, borderRadius: 999, padding: '4px 9px', cursor: 'pointer',
                          background: sort === s.key ? 'rgba(31,77,43,0.12)' : 'transparent',
                          color: sort === s.key ? FOREST : INK_MUTED,
                          border: `1px solid ${sort === s.key ? 'rgba(31,77,43,0.35)' : LINE}`,
                        }}
                      >
                        {{ attention: ui('Needs a visit','Idinga ukuvakashelwa'), production: ui('Harvest','Isivuno'), income: ui('Income','Imali engenayo'), joined: ui('Joined','Yabhaliswa'), name: ui('Name','Igama'), progress: ui('Progress','Inqubekelaphambili'), size: ui('Plot size','Usayizi wesiza'), nearest: ui('Distance','Ibanga') }[s.key]}
                      </button>
                    ))}
                  </div>

                  <p className="font-sans" style={{ fontSize: MICRO, color: INK_MUTED, margin: '9px 0 0', lineHeight: 1.5 }}>
                    {ui(`Showing ${sorted.length} of ${all.length} ${all.length === 1 ? 'farm' : 'farms'}. The totals and charts above always cover the whole cohort — the month-by-month figures are worked out for the organisation, not per district, so a filter here cannot change them.`,`Kuboniswa amapulazi angu-${sorted.length} kwangu-${all.length}. Izibalo namagrafu angenhla ahlanganisa iqembu lonke njalo — izibalo zenyanga ngayinye zenziwa ngenhlangano, hhayi ngesifunda, ngakho isihlungi salapha asikwazi ukuzishintsha.`)}
                    {filtersOn && (
                      <>
                        {' '}
                        <button
                          type="button"
                          onClick={clearFilters}
                          className="font-sans font-semibold"
                          style={{
                            fontSize: MICRO, background: 'none', border: 'none', padding: 0,
                            color: FOREST, cursor: 'pointer', textDecoration: 'underline',
                          }}
                        >
                          {ui('Clear the filters','Sula izihlungi')}
                        </button>
                      </>
                    )}
                  </p>
                </div>

                {/* ── the roster: a table on a laptop, cards on a phone ──────────────── */}
                {sorted.length === 0 ? (
                  <p className="font-sans" style={{ fontSize: 13, color: INK_MUTED, padding: '18px 16px', margin: 0 }}>
                    {ui('No farms match that search.','Alikho ipulazi elihambisana nalolu sesho.')}
                  </p>
                ) : (
                  <>
                    <div className="hidden md:block overflow-x-auto">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            {[ui('Farmer','Umlimi'), ui('Site','Indawo'), ui('Harvested','Okuvunyiwe'), ui('Sold','Okudayisiwe'), ui('Income','Imali engenayo'), ui('Course','Isifundo'), ui('Last logged','Okokugcina okuqoshiwe'), ''].map((h, i) => (
                              <th
                                key={h || `blank-${i}`}
                                scope="col"
                                className="font-sans uppercase"
                                style={{
                                  fontSize: MICRO, letterSpacing: '0.08em', color: INK_MUTED,
                                  textAlign: i >= 2 && i <= 5 ? 'right' : 'left',
                                  padding: '8px 12px', whiteSpace: 'nowrap',
                                  borderBottom: `1px solid ${LINE}`, fontWeight: 600,
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map((row) => (
                            <FarmRow
                              key={row.farmer.id}
                              row={row}
                              selected={row.farmer.id === selectedId}
                              onOpen={() => setSelectedId(row.farmer.id)}
                              ui={ui}
                            />
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="md:hidden">
                      {sorted.map((row) => (
                        <FarmCard
                          key={row.farmer.id}
                          row={row}
                          selected={row.farmer.id === selectedId}
                          onOpen={() => setSelectedId(row.farmer.id)}
                          ui={ui}
                        />
                      ))}
                    </div>
                  </>
                )}

                <p
                  className="font-sans"
                  style={{
                    fontSize: MICRO, color: INK_MUTED, lineHeight: 1.55, margin: 0,
                    padding: '11px 16px 14px', borderTop: `1px solid ${LINE}`,
                  }}
                >
                  {portfolio.isDemo
                    ? ui('A dash means a missing figure. It never means zero.','Udeshi usho ukuthi inani alikho. Awusho ukuthi kunguziro.')
                    : portfolio.withheldForConsent > 0
                      ? ui(`${portfolio.withheldForConsent} more ${portfolio.withheldForConsent === 1 ? 'farmer is' : 'farmers are'} enrolled here but have not agreed to share their figures, so they are not listed. A dash means a figure this account may not read — it never means zero.`,`Abalimi abangu-${portfolio.withheldForConsent} babhalisiwe kodwa abavumanga ukwabelana ngezibalo zabo, ngakho ababoniswa. Udeshi usho ukuthi le akhawunti ayikwazi ukufunda inani — awusho ukuthi kunguziro.`)
                      : ui('A dash means a figure this account may not read. It never means zero.','Udeshi usho ukuthi le akhawunti ayikwazi ukufunda inani. Awusho ukuthi kunguziro.')}
                </p>
              </section>
            </>
          )}
        </div>
      </div>

      {/* ── 5. one farm, in full — the same panel the portfolio map opens ── */}
      {selected && (
        <div
          className="absolute inset-x-0 bottom-0 z-20 rounded-t-3xl shadow-float max-h-[72dvh] md:static md:z-auto md:w-[380px] lg:w-[400px] md:flex-shrink-0 md:rounded-none md:border-l md:max-h-none md:shadow-none"
          style={{ background: PAPER, borderColor: LINE, display: 'flex', flexDirection: 'column' }}
        >
          <div className="flex items-center justify-between px-4 pt-2.5 pb-1.5 flex-shrink-0">
            <div
              className="md:hidden absolute left-1/2 -translate-x-1/2 top-2"
              style={{ width: 40, height: 4, borderRadius: 2, background: '#D5C9AE' }}
            />
            <span
              className="font-sans font-bold uppercase"
              style={{ fontSize: MICRO, letterSpacing: '0.12em', color: INK_MUTED, marginTop: 6 }}
            >
              {ui('Farmer','Umlimi')}
            </span>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label={ui('Close farmer record','Vala irekhodi lomlimi')}
              style={{
                background: 'rgba(32,25,15,0.06)', border: `1px solid ${LINE}`, borderRadius: 8,
                padding: 6, cursor: 'pointer', color: INK_SOFT, display: 'flex', marginTop: 4,
              }}
            >
              <X size={15} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-3.5 pb-6 pt-1" style={{ minHeight: 0 }}>
            {/* variant="embedded": the chrome, close button and scroller above are this file's,
                so the panel renders sections only. `sources` is the demo record's own ledgers and
                is what unlocks the panel's month-by-month strip; a live row has none, and the
                strip then simply does not render rather than inventing a trend. */}
            <FarmerPanel
              farmer={selected.farmer}
              summary={selected}
              sources={demoFarmerById(selected.farmer.id)?.sources ?? null}
              onClose={() => setSelectedId(null)}
              demoNotice={DEMO_NETWORK_NOTICE}
              variant="embedded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * One farm, two ways
 * ──────────────────────────────────────────────────────────────────────────*/

/** The cells both layouts print, worked out once so the phone and the laptop cannot disagree. */
type CohortUi = (en: string, zu: string) => string;

function farmCells(row: NetworkFarmerSummary, ui: CohortUi) {
  const { farmer, metrics } = row;
  const flags = attentionFlags(row);
  const days = metrics.daysSinceActivity;
  return {
    flags,
    harvested: statKg(metrics.producedKg),
    sold: statKg(metrics.soldKg),
    income: statZar(metrics.incomeZar),
    course:
      metrics.modulesDone === null
        ? DASH
        : `${metrics.modulesDone}/${metrics.modulesTotal}`,
    lastLogged: days === null
      ? DASH
      : days === 0
        ? ui('today','namuhla')
        : `${days} ${days === 1 ? ui('day ago','usuku olwedlule') : ui('days ago','izinsuku ezedlule')}`,
    place: `${farmer.siteName} · ${farmer.district}`,
  };
}

function attentionLabel(kind: NetworkAttentionFlag['kind'], ui: CohortUi) {
  return ({
    dormant: ui('No recent logs','Akukho okusha okuqoshiwe'),
    under_plan: ui('Under plan','Kungaphansi kohlelo'),
    loss_making: ui('Costs above income','Izindleko zingaphezu kwemali engenayo'),
    stalled_setup: ui('Setup incomplete','Ukulungiselela akuphelile'),
    no_survey: ui('Site survey incomplete','Ukuhlolwa kwendawo akuphelile'),
    no_data: ui('No records visible','Awekho amarekhodi abonakalayo'),
  })[kind];
}

function FarmRow({ row, selected, onOpen, ui }: {
  row: NetworkFarmerSummary; selected: boolean; onOpen: () => void; ui: CohortUi;
}) {
  const { farmer } = row;
  const c = farmCells(row, ui);
  const cell: React.CSSProperties = {
    padding: '9px 12px', borderBottom: `1px solid ${LINE}`, fontSize: 13,
    color: INK_SOFT, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
  };
  return (
    <tr style={{ background: selected ? 'rgba(31,77,43,0.06)' : 'transparent' }}>
      <td style={{ ...cell, color: INK }}>
        <span className="flex items-center gap-2">
          <span
            aria-hidden="true"
            style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[farmer.status], flexShrink: 0 }}
          />
          <span className="font-display font-semibold" style={{ fontSize: 13.5 }}>{farmer.name}</span>
          {c.flags.length > 0 && (
            <AlertTriangle size={12} style={{ color: ATTENTION, flexShrink: 0 }} aria-label={ui('Needs attention','Idinga ukunakwa')} />
          )}
        </span>
      </td>
      <td style={{ ...cell, maxWidth: 210, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.place}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{c.harvested}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{c.sold}</td>
      <td style={{ ...cell, textAlign: 'right', color: INK }}>{c.income}</td>
      <td style={{ ...cell, textAlign: 'right' }}>{c.course}</td>
      <td style={cell}>{c.lastLogged}</td>
      <td style={{ ...cell, textAlign: 'right' }}>
        <button
          type="button"
          onClick={onOpen}
          aria-label={ui(`Open ${farmer.name}'s record`,`Vula irekhodi lika-${farmer.name}`)}
          className="inline-flex items-center gap-1 font-sans font-semibold"
          style={{
            fontSize: MICRO, color: FOREST, background: 'rgba(31,77,43,0.08)',
            border: '1px solid rgba(31,77,43,0.25)', borderRadius: 8,
            padding: '4px 9px', cursor: 'pointer',
          }}
        >
          {ui('Open','Vula')}
          <ArrowUpRight size={12} />
        </button>
      </td>
    </tr>
  );
}

function FarmCard({ row, selected, onOpen, ui }: {
  row: NetworkFarmerSummary; selected: boolean; onOpen: () => void; ui: CohortUi;
}) {
  const { farmer } = row;
  const c = farmCells(row, ui);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={ui(`Open ${farmer.name}'s record`,`Vula irekhodi lika-${farmer.name}`)}
      className="w-full text-left"
      style={{
        display: 'block', background: selected ? 'rgba(31,77,43,0.06)' : 'transparent',
        border: 'none', borderBottom: `1px solid ${LINE}`, padding: '11px 16px', cursor: 'pointer',
      }}
    >
      <span className="flex items-center gap-2">
        <span
          aria-hidden="true"
          style={{ width: 9, height: 9, borderRadius: '50%', background: STATUS_COLOR[farmer.status], flexShrink: 0 }}
        />
        <span className="font-display font-semibold" style={{ fontSize: 14, color: INK, flex: 1, minWidth: 0 }}>
          {farmer.name}
        </span>
        {c.flags.length > 0 && <AlertTriangle size={13} style={{ color: ATTENTION, flexShrink: 0 }} />}
        <ArrowUpRight size={14} style={{ color: FOREST, flexShrink: 0 }} />
      </span>
      <span className="block font-sans" style={{ fontSize: MICRO, color: INK_MUTED, marginTop: 2, paddingLeft: 17 }}>
        {c.place}
      </span>
      <span
        className="block font-sans"
        style={{ fontSize: 12.5, color: INK_SOFT, marginTop: 3, paddingLeft: 17, fontVariantNumeric: 'tabular-nums' }}
      >
        {c.harvested} {ui('picked','kuvuniwe')} · {c.income} {ui('income','imali engenayo')} · {ui('course','isifundo')} {c.course}
      </span>
      <span className="block font-sans" style={{ fontSize: MICRO, color: INK_MUTED, marginTop: 2, paddingLeft: 17 }}>
        {ui('Last logged','Okokugcina okuqoshiwe')} {c.lastLogged}
        {c.flags.length > 0 ? ` · ${attentionLabel(c.flags[0].kind,ui)}` : ''}
      </span>
    </button>
  );
}

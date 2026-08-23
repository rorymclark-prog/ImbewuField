'use client';

// The Finance screen's graph option.
//
// Rory asked for two things in one breath: "a graph option for actual production
// actual sales actual usage" and "actual production verse estimate verse estimated
// loss". They are two different questions about the same kilograms, so they are two
// views behind one switch rather than two cards competing for the same space:
//
//   PICKED & SOLD  — measured only. What was logged picked each month, split into
//                    what was sold and what stayed on the farm.
//   PLAN vs ACTUAL — the crop plan's benchmark beside the measured harvest, per
//                    crop, with the farmer's own loss allowance marked on it.
//
// The two views never share a scale or a bar, because one is made of records and
// the other is half made of assumptions. Mixing a benchmark into the monthly bars
// is the single most tempting thing to build here and the one thing that would
// make every number on the card unreliable.
//
// "USAGE" IS CALLED "KEPT", DELIBERATELY. Rory's word was usage; the honest label
// is kept, because harvested − sold covers food eaten at home, given away, fed to
// animals, saved for seed AND spoiled, and the app cannot tell those apart.
// Calling the whole residual "eaten" overstated home consumption by 122% against
// the sample books — the note is in lib/harvest-reconciliation.ts. The caption
// says what the bar contains so the word does not have to carry it alone.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Trees } from 'lucide-react';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import type { CashflowSettings } from '@/lib/crop-plan';
import type { FinancePlanSource } from '@/lib/finance-plan-source';
import { buildFinanceSeries, type FinanceMonthPoint } from '@/lib/finance-series';
import { buildPlanVsActual, type PlanVsActualRow } from '@/lib/plan-vs-actual';
import { kgLabel } from '@/lib/format-figures';
import { cappedScale } from '@/lib/chart-scale';
import { BreakMark, BreakEdge } from '@/components/ChartBreakMark';
import {
  countsWithScope,
  loadIncludePerennials,
  saveIncludePerennials,
  DEFAULT_INCLUDE_PERENNIALS,
  produceKindOf,
} from '@/lib/produce-scope';
import { produceDisplayName } from '@/lib/perennial-produce';

const CARD: React.CSSProperties = { background: '#FFFEFA', border: '1px solid #E2D8C4' };

const INK = '#20190F';
const MUTED = '#5C5040';
const FAINT = '#8C7A62';
const HAIRLINE = '#E2D8C4';
const SOLD = '#1F4D2B';    // the forest green used for money in, for the same reason
const KEPT = '#C4A46A';    // gold — lighter by ~40 L*, so the split survives greyscale
const SHORT = '#B33A3A';   // sold beyond what the picking log accounts for
const BENCH = '#E3D8C0';   // the plan's benchmark: present, recessive, never the hero

type View = 'measured' | 'plan';
const WINDOWS = [6, 12, 24];

export default function FinanceGraphs({
  production,
  sales,
  invoices,
  source,
  settings,
  wide = false,
}: {
  production: ProductionLog[];
  sales: SalesLog[];
  invoices: SavedInvoice[];
  source: FinancePlanSource;
  settings: CashflowSettings;
  /** See CashflowChart: the desktop copy is drawn larger, not magnified. */
  wide?: boolean;
}) {
  const [view, setView] = useState<View>('measured');
  const [windowMonths, setWindowMonths] = useState(12);
  const [picked, setPicked] = useState<string | null>(null);
  // Read after mount, not during render: the stored choice lives in localStorage, which the server
  // render cannot see, and starting from the default keeps the first paint matching the HTML.
  const [includePerennials, setIncludePerennials] = useState(DEFAULT_INCLUDE_PERENNIALS);
  useEffect(() => { setIncludePerennials(loadIncludePerennials()); }, []);

  const now = useMemo(() => new Date(), []);
  const series = useMemo(
    () => buildFinanceSeries(production, sales, [], invoices, now, windowMonths, {
      countsKg: (name) => countsWithScope(name, includePerennials),
    }),
    [production, sales, invoices, now, windowMonths, includePerennials],
  );
  // Always the year. The plan's benchmark is a crop-CYCLE total, so month and
  // season have no defensible answer — lib/plan-vs-actual.ts refuses them, and
  // asking for one here would only surface that refusal as an empty card.
  const plan = useMemo(
    () => buildPlanVsActual(source.plantings, source.beds, production, sales, 'year', now, settings),
    [source.plantings, source.beds, production, sales, now, settings],
  );

  // Named so the plan view can explain an absence instead of leaving one. Only computed from what
  // is actually recorded: a farmer with no trees should never read a paragraph about trees.
  const orchardRecorded = useMemo(() => {
    // Deduped through the catalogue even though only this Set's SIZE is read today. A Set of raw
    // text does not deduplicate the same tree written two ways, so the moment anyone renders this
    // list — the obvious next edit — it names one tree twice.
    const names = new Set<string>();
    for (const row of production) if (produceKindOf(row.crop) === 'perennial') names.add(produceDisplayName(row.crop));
    for (const row of sales) if (produceKindOf(row.crop) === 'perennial') names.add(produceDisplayName(row.crop));
    return [...names].sort((a, b) => a.localeCompare(b, 'en-ZA'));
  }, [production, sales]);

  const header = (
    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <p className="text-xs font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: MUTED }}>
        <BarChart3 size={13} /> Harvest graphs
      </p>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <Segment active={view === 'measured'} onClick={() => setView('measured')}>Picked &amp; sold</Segment>
        <Segment active={view === 'plan'} onClick={() => setView('plan')}>Plan vs actual</Segment>
        {view === 'measured' && (
          <OrchardToggle
            on={includePerennials}
            onChange={(next) => { setIncludePerennials(next); saveIncludePerennials(next); }}
          />
        )}
        {view === 'measured' && (
          <span className="flex items-center gap-1 ml-auto">
            {WINDOWS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setWindowMonths(n); setPicked(null); }}
                aria-pressed={windowMonths === n}
                className="font-mono rounded-full px-2 py-0.5"
                style={{
                  fontSize: 10.5,
                  border: `1px solid ${windowMonths === n ? SOLD : HAIRLINE}`,
                  background: windowMonths === n ? SOLD : 'transparent',
                  color: windowMonths === n ? '#FFFEFA' : MUTED,
                  cursor: 'pointer',
                }}
              >
                {n}m
              </button>
            ))}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <section className="rounded-2xl overflow-hidden" style={CARD}>
      {header}
      {view === 'measured'
        ? <MeasuredView series={series} pickedKey={picked} onPick={setPicked} wide={wide} />
        : <PlanView plan={plan} source={source} wide={wide} orchard={orchardRecorded} />}
    </section>
  );
}

/**
 * The orchard switch.
 *
 * It reads as one control with two states rather than a checkbox, because what it does is not
 * "filter" but "answer a different question": with it on the card is the whole farm's harvest,
 * with it off it is the vegetable beds' harvest. Both are true; they are not a subset and a
 * superset in the farmer's head.
 *
 * It sits with the view switch and not in a settings panel because the note it produces is on this
 * card — a control whose effect you cannot see from where you flick it is the bug class already
 * recorded twice in this codebase.
 */
function OrchardToggle({ on, onChange }: { on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      aria-pressed={on}
      title={on
        ? 'Fruit, nuts and other orchard produce are counted in these kilograms. Tap to show the vegetable beds on their own.'
        : 'Only the vegetable beds are counted. Tap to include fruit, nuts and the rest of the food forest.'}
      className="font-sans rounded-full px-2.5 py-1 flex items-center gap-1"
      style={{
        fontSize: 11,
        fontWeight: on ? 600 : 400,
        border: `1px solid ${on ? SOLD : HAIRLINE}`,
        background: on ? 'rgba(31,77,43,0.08)' : 'transparent',
        color: on ? SOLD : FAINT,
        cursor: 'pointer',
      }}
    >
      <Trees size={12} strokeWidth={on ? 2.2 : 1.6} />
      {on ? 'Orchard in' : 'Orchard out'}
    </button>
  );
}

function Segment({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="font-sans rounded-full px-3 py-1"
      style={{
        fontSize: 11.5,
        fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? SOLD : HAIRLINE}`,
        background: active ? SOLD : 'transparent',
        color: active ? '#FFFEFA' : MUTED,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/* ── View 1: picked & sold ─────────────────────────────────────────────────── */

const PHONE = { W: 320, PAD: { left: 28, right: 8, top: 14, bottom: 16 }, PLOT_H: 118, barCap: 16 };
const DESK  = { W: 760, PAD: { left: 44, right: 12, top: 16, bottom: 18 }, PLOT_H: 168, barCap: 24 };

function MeasuredView({
  series,
  pickedKey,
  onPick,
  wide,
}: {
  series: ReturnType<typeof buildFinanceSeries>;
  pickedKey: string | null;
  onPick: (key: string) => void;
  wide: boolean;
}) {
  const { W, PAD, PLOT_H, barCap } = wide ? DESK : PHONE;
  if (!series.hasRecords) {
    return (
      <div className="px-4 py-5">
        <p className="font-display font-semibold" style={{ fontSize: 13.5, color: INK }}>
          {series.earlierRecords ? 'Nothing picked or sold in these months' : 'No harvest recorded yet'}
        </p>
        <p className="font-sans mt-1" style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
          {series.earlierRecords
            ? `Your records start in ${series.firstRecordLabel}. Try a longer window above.`
            : 'Log what you pick and what you sell, and this graph shows how much of your harvest is leaving the farm and how much is staying on it.'}
        </p>
        <Link href="/records" className="inline-block mt-2.5 font-sans font-semibold"
          style={{ fontSize: 12, color: SOLD, textDecoration: 'underline' }}>
          Log a harvest
        </Link>
      </div>
    );
  }

  const months = series.months;
  const n = months.length;
  const plotW = W - PAD.left - PAD.right;
  const colW = plotW / n;
  const barW = Math.min(colW * 0.54, barCap);
  const totalH = PAD.top + PLOT_H + PAD.bottom;

  // The scale must fit the taller of the two, because a month that sold more than
  // it logged picking draws an outline up to the sold figure. Capped: one bumper
  // month of a bulk crop otherwise turns the rest of the year into hairlines. Any
  // month that gets cut carries a break mark and is named in full underneath.
  const monthTotals = months.map((m) => Math.max(m.producedKg, m.soldKg));
  const kgScale = cappedScale(monthTotals);
  const maxKg = Math.max(kgScale.max, 1);
  const y = (kg: number) => PAD.top + PLOT_H - (Math.min(kg, maxKg) / maxKg) * PLOT_H;
  const cx = (i: number) => PAD.left + i * colW + colW / 2;
  const showLabel = (i: number) => n <= 12 || i === 0 || i === n - 1 || i % 2 === 0;

  const selected = months.find((m) => m.key === pickedKey)
    ?? [...months].reverse().find((m) => m.hasRecords)
    ?? months[n - 1];

  const anyShort = months.some((m) => m.soldExceedsProduced);
  // A capped axis is only honest while the figures it cut are still on the screen.
  const clipped = months
    .filter((_, i) => kgScale.isClipped(monthTotals[i]))
    .map((m) => `${m.longLabel}, ${kgLabel(Math.max(m.producedKg, m.soldKg))}`);

  return (
    <>
      <div className="px-4 py-3.5 flex flex-wrap items-baseline" style={{ gap: '4px 20px' }}>
        <Figure label={`Picked, ${series.windowMonths} months`} value={kgLabel(series.totalProducedKg)} tone={INK} />
        <Figure label="Sold" value={kgLabel(series.totalSoldKg)} tone={SOLD} />
        {/* Null is not zero: when the window sold more than it logged picking, the
            difference is a missing record, not food that stayed on the farm. */}
        {series.totalKeptKg === null
          ? <Figure label="Kept on the farm" value="—" tone={FAINT} />
          : <Figure label="Kept on the farm" value={kgLabel(series.totalKeptKg)} tone={KEPT} />}
      </div>

      <div className="px-2">
        <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ display: 'block' }} role="img"
          aria-label={`Kilograms picked each month for ${n} months, split into sold and kept on the farm.`}>
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + PLOT_H} y2={PAD.top + PLOT_H} stroke="rgba(140,122,98,0.45)" strokeWidth="0.8" />
          <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} stroke="rgba(140,122,98,0.16)" strokeWidth="0.8" strokeDasharray="3,3" />
          <text x={PAD.left - 4} y={PAD.top + 3} textAnchor="end" fontSize="7" fill={FAINT} fontFamily="monospace">{Math.round(maxKg)}</text>
          <text x={PAD.left - 4} y={PAD.top + PLOT_H + 2.5} textAnchor="end" fontSize="7" fill={FAINT} fontFamily="monospace">0</text>

          {months.map((m, i) => {
            const x = cx(i) - barW / 2;
            const base = PAD.top + PLOT_H;
            const soldTop = y(Math.min(m.soldKg, m.producedKg));
            const producedTop = y(m.producedKg);
            const soldH = base - soldTop;
            // A 2px gap of card colour between the two segments, so a stack of
            // near-equal parts still reads as two things and not one long bar.
            const keptH = Math.max(0, soldTop - producedTop - (m.keptKg && m.keptKg > 0 ? 2 : 0));
            return (
              <g key={m.key}>
                {soldH > 0 && <rect x={x} y={soldTop} width={barW} height={soldH} fill={SOLD} rx="2" />}
                {m.keptKg !== null && m.keptKg > 0 && keptH > 0 && (
                  <rect x={x} y={producedTop} width={barW} height={keptH} fill={KEPT} rx="2" />
                )}
                {/* Sold beyond what the picking log accounts for: an open outline up
                    to the sold figure. Not a filled bar — there is no harvest record
                    behind that height, and a solid block would claim there is. */}
                {m.soldExceedsProduced && m.soldKg > 0 && (
                  <rect
                    x={x} y={y(m.soldKg)} width={barW} height={Math.max(1, y(m.producedKg) - y(m.soldKg))}
                    fill="none" stroke={SHORT} strokeWidth="1" strokeDasharray="2.5,2" rx="2"
                  />
                )}
                {kgScale.isClipped(monthTotals[i]) && <BreakMark x={x} y={PAD.top} w={barW} down />}
              </g>
            );
          })}

          {months.map((m, i) => (
            <g key={`x-${m.key}`}>
              {showLabel(i) && (
                <text x={cx(i)} y={totalH - 5} textAnchor="middle" fontSize="7" fill={FAINT} fontFamily="monospace">{m.label}</text>
              )}
            </g>
          ))}

          {months.map((m, i) => (
            <g key={`hit-${m.key}`}>
              {m.key === selected.key && (
                <rect x={cx(i) - colW / 2} y={PAD.top - 6} width={colW} height={PLOT_H + 10} fill="rgba(32,25,15,0.05)" rx="2" />
              )}
              <rect x={cx(i) - colW / 2} y={0} width={colW} height={totalH} fill="transparent"
                style={{ cursor: 'pointer' }} onClick={() => onPick(m.key)}>
                <title>{`${m.longLabel} — picked ${kgLabel(m.producedKg)}, sold ${kgLabel(m.soldKg)}`}</title>
              </rect>
            </g>
          ))}
        </svg>
      </div>

      <div className="px-4 py-2.5 flex flex-wrap items-baseline" style={{ gap: '2px 14px', borderTop: '1px solid #F0E9DA' }}>
        <span className="font-display font-semibold" style={{ fontSize: 12.5, color: INK }}>{selected.longLabel}</span>
        {selected.hasRecords ? (
          <>
            <Chip dot={SOLD} label="sold" value={kgLabel(selected.soldKg)} />
            {selected.keptKg === null
              ? <span className="font-sans" style={{ fontSize: 11.5, color: SHORT }}>sold more than was logged picked</span>
              : <Chip dot={KEPT} label="kept" value={kgLabel(selected.keptKg)} />}
            <Chip dot="transparent" label="picked in total" value={kgLabel(selected.producedKg)} />
          </>
        ) : (
          <span className="font-sans" style={{ fontSize: 11.5, color: FAINT }}>nothing recorded this month</span>
        )}
      </div>

      <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, background: '#FBF7EF' }}>
        {(series.excludedProducedKg > 0 || series.excludedSoldKg > 0) && (
          /* Picked and sold said separately, because the card's own figures are separate and their
             sum is not a quantity of fruit — 40 kg picked of which 25 were sold is 40 kg, and a
             single "65 kg" would match none of picked, sold or kept. */
          <p className="font-sans" style={{ fontSize: 10.5, color: MUTED, lineHeight: 1.5 }}>
            <b style={{ fontWeight: 600 }}>Orchard is switched off</b>, so this card leaves out
            {series.excludedProducedKg > 0 ? ` ${kgLabel(series.excludedProducedKg)} picked` : ''}
            {series.excludedProducedKg > 0 && series.excludedSoldKg > 0 ? ' and' : ''}
            {series.excludedSoldKg > 0 ? ` ${kgLabel(series.excludedSoldKg)} sold` : ''}
            : {series.excludedNames.join(', ')}. The rands elsewhere on this
            page still count those sales — only the kilograms here are filtered.
          </p>
        )}
        <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
          <b style={{ color: MUTED, fontWeight: 600 }}>Kept</b> is what you picked less what you sold — food eaten at
          home, given away, fed out, saved for seed or spoiled. The app cannot tell those apart, so it does not guess.
        </p>
        {anyShort && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            A dashed outline means more was sold that month than was logged as picked, so the kept figure is unknown —
            usually picking that never got written down, sometimes a sale out of an earlier month&apos;s harvest.
          </p>
        )}
        {clipped.length > 0 && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            Too tall for this chart, and cut off at the mark so the other months stay readable:{' '}
            <b style={{ color: MUTED, fontWeight: 600 }}>{clipped.join('; ')}</b>.
          </p>
        )}
        <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
          Entries land in the month you recorded them; the logging forms have no date field yet.
        </p>
      </div>
    </>
  );
}

/* ── View 2: plan vs actual ────────────────────────────────────────────────── */

function PlanView({ plan, source, wide, orchard }: {
  plan: ReturnType<typeof buildPlanVsActual>; source: FinancePlanSource; wide: boolean;
  /** Orchard produce this farm has actually recorded, so its absence below can be explained. */
  orchard: string[];
}) {
  if (!source.loaded) {
    return <div className="px-4 py-6 font-sans" style={{ fontSize: 13, color: FAINT }}>Reading your crop plan…</div>;
  }

  if (plan.rows.length === 0) {
    const reason = source.origin === 'none'
      ? 'Trace your beds in the Design Studio, then plan a season, and this graph compares the plan against what you actually pick.'
      : plan.unbenchmarkedCropNames.length > 0
        ? `Nothing in your plan has a verified yield figure to compare against yet — ${plan.unbenchmarkedCropNames.join(', ')}.`
        : 'Your crop plan is empty, so there is nothing to compare your harvest against.';
    return (
      <div className="px-4 py-5">
        <p className="font-display font-semibold" style={{ fontSize: 13.5, color: INK }}>Nothing to compare yet</p>
        <p className="font-sans mt-1" style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{reason}</p>
        <Link href={source.origin === 'none' ? '/design' : '/facilitator/crops'}
          className="inline-block mt-2.5 font-sans font-semibold"
          style={{ fontSize: 12, color: SOLD, textDecoration: 'underline' }}>
          {source.origin === 'none' ? 'Open the Design Studio' : 'Open the crop plan'}
        </Link>
      </div>
    );
  }

  // One shared scale so the rows compare to each other — capped, because one
  // maize plot against a herb bed would leave every small crop with no bar at all
  // and nothing to read. Each row prints its own two figures regardless.
  const rowTotals = plan.rows.map((r) => Math.max(r.benchmarkKg, r.harvestedKg));
  const rowScale = cappedScale(rowTotals);
  const max = Math.max(rowScale.max, 1);
  const pct = (kg: number) => `${Math.min(100, (kg / max) * 100)}%`;
  const clippedRows = plan.rows
    .filter((_, i) => rowScale.isClipped(rowTotals[i]))
    .map((r) => `${r.cropName}, ${kgLabel(r.benchmarkKg)}`);

  return (
    <>
      <p className="px-4 pt-3 font-sans" style={{ fontSize: 11.5, color: MUTED, lineHeight: 1.5 }}>
        Each crop&apos;s plan benchmark, with what you have logged picking this year on top of it.
      </p>

      <div className="px-4 py-3 flex flex-col" style={{ gap: 14, maxWidth: wide ? 760 : undefined }}>
        {plan.rows.map((row, i) => (
          <PlanRow key={row.cropKey} row={row} pct={pct} lossPercent={plan.lossPercent}
            clipped={rowScale.isClipped(rowTotals[i])} />
        ))}
      </div>

      <div className="px-4 pb-3 flex flex-wrap items-center" style={{ gap: '4px 14px' }}>
        <Chip dot={BENCH} label="plan benchmark" value="" />
        <Chip dot={SOLD} label="logged picked" value="" />
        {plan.lossConfirmed
          ? <Chip dot="#C07A1E" label={`after your ${Math.round(plan.lossPercent)}% loss allowance`} value="" />
          : (
            <Link href="/facilitator/crops" className="font-sans"
              style={{ fontSize: 11, color: SOLD, textDecoration: 'underline' }}>
              Set your loss allowance to mark it on these bars
            </Link>
          )}
      </div>

      <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, background: '#FBF7EF' }}>
        {/* Deliberately does NOT repeat the names: `offPlanNames` below already lists them, and on
            a farm with fruit trees this paragraph and that one would otherwise say the same word
            twice, three lines apart. This one carries the reason; that one carries the list. */}
        {orchard.length > 0 && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            <b style={{ color: MUTED, fontWeight: 600 }}>Nothing from the orchard is compared here.</b> A tree is not
            planted into a bed for a season, so there is no plan benchmark to hold it against. Its harvests and sales
            still count everywhere else on this page.
          </p>
        )}
        <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
          The benchmark is what one <b style={{ color: MUTED, fontWeight: 600 }}>complete crop cycle</b> on that much
          ground is worth in kilograms — not a target for this calendar year. A short green bar can mean the cycle is
          not finished, or that picking was not written down. It is not proof of a lost harvest.
        </p>
        {clippedRows.length > 0 && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            Too long for these bars, and cut off at the mark so the smaller crops still have one:{' '}
            <b style={{ color: MUTED, fontWeight: 600 }}>{clippedRows.join('; ')}</b>.
          </p>
        )}
        {plan.unbenchmarkedCropNames.length > 0 && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            Left out — no verified yield figure yet: {plan.unbenchmarkedCropNames.join(', ')}.
          </p>
        )}
        {plan.offPlanNames.length > 0 && (
          <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
            Harvested but not in the plan, so not compared: {plan.offPlanNames.join(', ')}.
          </p>
        )}
      </div>
    </>
  );
}

function PlanRow({ row, pct, lossPercent, clipped }: {
  row: PlanVsActualRow; pct: (kg: number) => string; lossPercent: number; clipped: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-sans truncate min-w-0" style={{ fontSize: 12.5, color: INK }}>
          <span aria-hidden="true">{row.icon}</span> {row.cropName}
        </span>
        <span className="font-mono flex-shrink-0" style={{ fontSize: 11.5, color: MUTED }}>
          {kgLabel(row.harvestedKg)} <span style={{ color: '#B8AC96' }}>of {kgLabel(row.benchmarkKg)}</span>
        </span>
      </div>

      {/* A bullet bar: the benchmark is the range, the harvest is the measure sitting
          inside it, the loss allowance is the target mark. One shared scale across
          every crop, so the rows are comparable to each other and not just to
          themselves. */}
      <div className="mt-1.5 relative" style={{ height: 14, background: '#F5F0E8', borderRadius: 3 }}>
        <div style={{ position: 'absolute', inset: 0, width: pct(row.benchmarkKg), background: BENCH, borderRadius: 3 }} />
        <div style={{ position: 'absolute', top: 3.5, left: 0, height: 7, width: pct(row.harvestedKg), background: SOLD, borderRadius: 2 }} />
        {row.afterLossKg !== null && (
          <div
            title={`After your ${Math.round(lossPercent)}% loss allowance: ${kgLabel(row.afterLossKg)}`}
            style={{ position: 'absolute', top: -1, height: 16, left: pct(row.afterLossKg), width: 2, background: '#C07A1E', borderRadius: 1 }}
          />
        )}
        {clipped && <BreakEdge />}
      </div>

      {row.soldExceedsHarvested && (
        <p className="font-sans mt-1" style={{ fontSize: 10.5, color: SHORT }}>
          Sold {kgLabel(row.soldKg)} — more than was logged picked, so the green bar is short of what really came off.
        </p>
      )}
    </div>
  );
}

/* ── Shared bits ───────────────────────────────────────────────────────────── */

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono font-semibold" style={{ fontSize: 20, color: tone, letterSpacing: '-0.01em' }}>{value}</span>
      <span className="font-sans" style={{ fontSize: 10.5, color: FAINT }}>{label}</span>
    </span>
  );
}

function Chip({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span aria-hidden="true" style={{
        width: 7, height: 7, borderRadius: 2, display: 'inline-block',
        background: dot, border: dot === 'transparent' ? `1px solid ${HAIRLINE}` : undefined,
      }} />
      {value && <span className="font-mono" style={{ fontSize: 12, color: INK }}>{value}</span>}
      <span className="font-sans" style={{ fontSize: 10.5, color: FAINT }}>{label}</span>
    </span>
  );
}

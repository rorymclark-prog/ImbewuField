'use client';

/*
 * The two charts on the funder / NGO cohort dashboard.
 *
 * BOTH ARE DRAWN FROM lib/cohort-series.ts AND lib/cohort-report.ts AND NOTHING ELSE. Neither takes
 * a number the caller computed for it, so there is no path by which a headline figure and the bar
 * under it can disagree.
 *
 * ── THREE RULES INHERITED FROM THE FINANCE CHARTS, NOT REINVENTED ─────────────────────────────
 *
 * 1. ONE AXIS PER PANEL, NEVER TWO. Kilograms and rands accumulate at different magnitudes, and
 *    drawing both against one scale turns one of them into a row of hairlines. components/
 *    CashflowChart.tsx solved this the same way and says so in its header: two panels sharing ONE
 *    month axis. This file follows it rather than inventing a second y-axis, which is the single
 *    most tempting and most misleading thing to put on a funder dashboard.
 *
 * 2. A CAPPED AXIS ONLY WITH THE CUT VISIBLE AND THE TRUE FIGURE STILL ON SCREEN. `cappedScale()`
 *    (lib/chart-scale.ts) stops one bumper month flattening a year; every bar it cuts wears the
 *    shared break mark from components/ChartBreakMark.tsx and is named in full underneath. Both
 *    conditions, or neither — that is the contract written into chart-scale's own header.
 *
 * 3. NULL IS NOT ZERO, AND A QUIET MONTH IS NOT AN EMPTY ONE. A month nobody logged in draws no
 *    bar at all rather than a bar of height zero, and a book this account may not read prints
 *    "not shared" rather than a confident R0. The pure module carries that distinction the whole
 *    way; this file's only job is not to flatten it on the last step to the screen.
 *
 * 4. A BAR MAY NEVER COME OUT SHORTER THAN THE FIGURE PRINTED ABOVE IT. The kilogram panel has two
 *    drawings, and which one it uses is decided by `series.keptComparable` alone:
 *
 *      PAIRED — every farmer behind these bars shared BOTH their harvest and their sales book, so
 *        "sold" really is a part of "picked" for these people and the column is one stack: forest
 *        sold at the bottom, gold kept above, and a dashed outline to the true sold height on a
 *        month whose sales run past its harvest log.
 *      SIDE BY SIDE — anyone shared only one of the two, so the picked bar and the sold bar are
 *        made of DIFFERENT PEOPLE. Stacking them would assert that one is part of the other; the
 *        old code went further and clamped the sold bar down to the picked figure, which drew a
 *        bar quietly shorter than the "Sold" total beside it. They now stand apart, each at its
 *        own true height, and the card says in words whose books each one is.
 *
 *    The sold bar's height is never computed here. lib/cohort-series.ts#soldBarParts returns it as
 *    a filled part and an outlined part that always add back up to the stated total, so no clamp
 *    can survive in this file without its outline.
 *
 * ── WHY THE BARS ARE HTML AND NOT SVG ────────────────────────────────────────────────────────
 * The app's other charts label their axes with SVG <text>, sized in viewBox units: the same "9"
 * renders around 11px on a phone and 7px on a wide laptop, under any readable floor and under the
 * 12px micro-label floor this project's design spec sets (design/MODERN-2026-PLAN.md). Here the
 * geometry is HTML boxes on a CSS grid and every label is real pixels, so nothing on this screen
 * can scale itself below the floor. Palette, stacking and cut mark are unchanged, so it still
 * reads as the same app.
 */

import { useMemo } from 'react';
import { BarChart3, GraduationCap } from 'lucide-react';
import { cappedScale, type CappedScale } from '@/lib/chart-scale';
import { BreakTop } from '@/components/ChartBreakMark';
import { kgLabel, kgTotalLabel, randLabel, randTick } from '@/lib/format-figures';
import { soldBarParts, type CohortMonth, type CohortSeries, type SoldBarParts } from '@/lib/cohort-series';
import type { CohortTraining } from '@/lib/cohort-report';

/* White programme cards and darker labels; preserve the harvest/sales colour meanings. */
const CARD_STYLE: React.CSSProperties = { background: '#FFFFFF', border: '1px solid #D7E3D9' };
const INK = '#183427';
const MUTED = '#44574B';
const FAINT = '#506158';
const HAIRLINE = '#D7E3D9';
const AXIS = 'rgba(140,122,98,0.45)';
const SOLD = '#1F4D2B';   // forest — sold kilograms and money in, exactly CashflowChart's IN
const KEPT = '#C4A46A';   // gold — lighter, so the split survives greyscale and a printed report
// Gold again, for the whole picked bar when picked and sold are drawn side by side. Not a new
// hue: gold is already "harvest kilograms this chart is not attributing to a sale", and when the
// two bars come from different farmers that is the entire picked figure. The legend says which
// reading is in force, because the drawing changes with it.
const PICKED = KEPT;
// The sold total when a month's harvest rows do not account for it: the SAME forest as the
// filled sold bar, dashed, so it reads as "this much was sold, this much of it is backed by a
// harvest row in this month" rather than as an alert. Selling stock picked earlier is ordinary
// farming, and drawing it in the app's warning rust told the funder a fault had been found.
const OVER = SOLD;
const TRAIN = '#9E5C08';  // ochre — the course, as on every other training readout in the app

/** Micro-label floor for this project. Nothing in this file goes under it. */
const MICRO = 12;

const PLOT_KG = 132;
const PLOT_ZAR = 84;
const PLOT_TRAINING = 96;

function Overline({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <p
      className="font-sans font-semibold uppercase flex items-center gap-1.5"
      style={{ fontSize: MICRO, letterSpacing: '0.08em', color: MUTED, margin: 0 }}
    >
      {icon}
      {children}
    </p>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="min-w-0">
      <div className="font-sans" style={{ fontSize: MICRO, color: FAINT, whiteSpace: 'nowrap' }}>{label}</div>
      <div
        className="font-display font-bold"
        style={{
          fontSize: 'clamp(17px, 1.6vw, 21px)', color: tone, lineHeight: 1.2,
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
        }}
      >
        {value}
      </div>
    </div>
  );
}

/** The card every chart on this screen sits in. */
function ChartCard({ title, icon, note, children }: {
  title: string; icon: React.ReactNode; note?: string; children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
      <div className="px-4 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
        <Overline icon={icon}>{title}</Overline>
        {note && (
          <p className="font-sans" style={{ fontSize: MICRO, color: FAINT, margin: '5px 0 0', lineHeight: 1.5 }}>
            {note}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

/** Printed instead of a chart when the data refuses to draw itself. Never a blank rectangle. */
function NoChart({ reason }: { reason: string }) {
  return (
    <p className="px-4 py-5 font-sans" style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, margin: 0 }}>
      {reason}
    </p>
  );
}

function Footnote({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans" style={{ fontSize: MICRO, color: FAINT, margin: '9px 0 0', lineHeight: 1.55 }}>
      {children}
    </p>
  );
}

function Key({ colour, label, outline = false }: { colour: string; label: string; outline?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        aria-hidden="true"
        style={{
          width: 11, height: 11, borderRadius: 3, flexShrink: 0,
          background: outline ? 'transparent' : colour,
          border: outline ? `1px dashed ${colour}` : 'none',
        }}
      />
      <span className="font-sans" style={{ fontSize: MICRO, color: MUTED }}>{label}</span>
    </span>
  );
}

/**
 * The key for two bars that are NOT one stack: the swatch is the two colours standing apart, which
 * is exactly what the plot does when the picked farmers and the sold farmers are different people.
 * The same discipline as components/ChartBreakMark.tsx — a drawing that is not a plain reading of
 * the data carries a mark saying so, and the words underneath say the rest.
 */
function SplitKey({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span aria-hidden="true" className="flex items-end" style={{ gap: 2, flexShrink: 0 }}>
        <span style={{ width: 5, height: 11, borderRadius: 2, background: PICKED }} />
        <span style={{ width: 5, height: 8, borderRadius: 2, background: SOLD }} />
      </span>
      <span className="font-sans" style={{ fontSize: MICRO, color: MUTED }}>{label}</span>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Chart 1 — harvest and income, month by month
 * ══════════════════════════════════════════════════════════════════════════*/

/**
 * The taller of picked and sold. A month that sold more than it logged picking still needs an axis
 * that reaches the sold figure — otherwise the outline drawn to show that discrepancy is itself
 * cut off, and the discrepancy vanishes into the top of the chart.
 */
function kgTopOf(m: CohortMonth): number {
  return Math.max(m.producedKg ?? 0, m.soldKg ?? 0);
}

interface ColumnProps {
  m: CohortMonth;
  /** The month's sold figure, already split into what a harvest record backs and what it does not. */
  parts: SoldBarParts;
  scale: CappedScale;
  /** The drawn top of the axis. */
  maxKg: number;
}

/**
 * PAIRED: one stack, because every farmer here shared both books and "sold" really is part of
 * "picked" for them. Unchanged from the drawing this chart shipped with — the sample cohort, whose
 * sixteen farmers all share everything, still lands here and looks exactly as it did.
 */
function PairedKgColumn({ m, parts, scale, maxKg }: ColumnProps) {
  const sold = parts.backedKg;              // = min(sold, picked) here — and never on its own: the
  const kept = m.keptKg ?? 0;               //   outline below always draws the rest of the figure.
  const cut = scale.isClipped(kgTopOf(m));
  const soldPct = (scale.draw(sold) / maxKg) * 100;
  const keptPct = (scale.draw(Math.min(kept, Math.max(0, maxKg - sold))) / maxKg) * 100;
  // Sold beyond what the picking log accounts for: an open outline to the sold figure, never a
  // filled block — no harvest record stands behind that height.
  const overPct = parts.unbackedKg > 0 ? (scale.draw(parts.totalKg) / maxKg) * 100 : 0;

  return (
    <>
      {overPct > 0 && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', left: '18%', right: '18%', bottom: 0,
            height: `${overPct}%`, border: `1px dashed ${OVER}`, borderRadius: 3,
          }}
        />
      )}
      {keptPct > 0 && (
        <div
          className="relative"
          style={{
            margin: '0 18%', height: `${keptPct}%`, minHeight: 2,
            background: KEPT, borderRadius: '3px 3px 0 0',
          }}
        >
          {cut && <BreakTop />}
        </div>
      )}
      {soldPct > 0 && (
        <div
          className="relative"
          style={{
            margin: '0 18%', height: `${soldPct}%`, minHeight: 2,
            background: SOLD, borderRadius: keptPct > 0 ? 0 : '3px 3px 0 0',
          }}
        >
          {cut && keptPct === 0 && <BreakTop />}
        </div>
      )}
    </>
  );
}

/**
 * SIDE BY SIDE: picked and sold are different sets of farmers, so neither may be stacked on,
 * subtracted from or clamped down to the other. Each is drawn at its own true height, which is
 * what makes it impossible for either bar to come out shorter than its own headline figure — the
 * failure the old single clamped stack produced silently under any mixed consent.
 *
 * The sold bar keeps the outline reading it has in the paired drawing: filled as far as a harvest
 * record in this same chart stands behind it, open outline the rest of the way. With nobody
 * sharing both books, that outline is the whole bar, which is the honest picture.
 */
function SplitKgColumn({ m, parts, scale, maxKg }: ColumnProps) {
  const pickedPct = m.producedKg === null ? 0 : (scale.draw(m.producedKg) / maxKg) * 100;
  const backedPct = (scale.draw(parts.backedKg) / maxKg) * 100;
  const totalPct = (scale.draw(parts.totalKg) / maxKg) * 100;
  const pickedCut = scale.isClipped(m.producedKg ?? 0);
  const soldCut = scale.isClipped(parts.totalKg);

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%', gap: 2 }}>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {pickedPct > 0 && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${pickedPct}%`, minHeight: 2, background: PICKED, borderRadius: '3px 3px 0 0',
            }}
          >
            {pickedCut && <BreakTop />}
          </div>
        )}
      </div>
      <div style={{ flex: 1, position: 'relative', height: '100%' }}>
        {parts.unbackedKg > 0 && totalPct > 0 && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${totalPct}%`, minHeight: 3, border: `1px dashed ${OVER}`, borderRadius: 3,
            }}
          />
        )}
        {backedPct > 0 && (
          <div
            style={{
              position: 'absolute', left: 0, right: 0, bottom: 0,
              height: `${backedPct}%`, minHeight: 2, background: SOLD, borderRadius: '3px 3px 0 0',
            }}
          >
            {soldCut && <BreakTop />}
          </div>
        )}
      </div>
    </div>
  );
}

export function CohortTimeline({ series, className }: { series: CohortSeries; className?: string }) {
  const months = series.months;

  const kgTops = useMemo(() => months.map(kgTopOf), [months]);
  const zarTops = useMemo(() => months.map((m) => m.incomeZar ?? 0), [months]);
  const kgScale = useMemo(() => cappedScale(kgTops), [kgTops]);
  const zarScale = useMemo(() => cappedScale(zarTops), [zarTops]);
  // Every sold height on this screen comes from here. See rule 4 in the header.
  const soldParts = useMemo(() => months.map(soldBarParts), [months]);

  const maxKg = Math.max(kgScale.max, 1);
  const maxZar = Math.max(zarScale.max, 1);

  // Rule 3 reaches the axis itself. With no sales book shared, every month's incomeZar is null
  // (lib/cohort-series.ts sets income to 0 only when salesFarmers > 0), cappedScale sees only
  // zeros, and the Math.max(…, 1) floor above would print a confident "R1" over an empty plot —
  // a rand figure that corresponds to nothing. The tick and the plot say what is true instead;
  // the panel keeps its height so the month axis both panels share cannot move.
  const zarWithheld = series.salesFarmers === 0;

  // Rule 2: every bar the axis cut is named in full, in words, underneath the chart. Picked and
  // sold are named separately, because when they come from different farmers only one of them may
  // be the bar that was actually cut.
  const cutInFull = useMemo(() => {
    const out: string[] = [];
    months.forEach((m, i) => {
      const picked = m.producedKg ?? 0;
      if (kgScale.isClipped(picked)) out.push(`${m.longLabel} — ${kgTotalLabel(picked)} picked`);
      if (kgScale.isClipped(soldParts[i].totalKg)) {
        out.push(`${m.longLabel} — ${kgTotalLabel(soldParts[i].totalKg)} sold`);
      }
      if (zarScale.isClipped(zarTops[i])) out.push(`${m.longLabel} — ${randLabel(zarTops[i])} in`);
    });
    return out;
  }, [months, soldParts, zarTops, kgScale, zarScale]);

  if (!series.renderable) {
    return (
      <div className={className}>
        <ChartCard title="Harvest and income, month by month" icon={<BarChart3 size={13} />}>
          <NoChart reason={series.reason} />
        </ChartCard>
      </div>
    );
  }

  const columns = `repeat(${months.length}, minmax(0, 1fr))`;
  // ONE decision, taken here and nowhere else: may these bars be stacked? See rule 4 in the header
  // and the contract on CohortSeries.keptComparable.
  const paired = series.keptComparable;
  const anyOverSold = months.some((m) => m.soldExceedsProduced);
  const anyUnbacked = soldParts.some((p) => p.unbackedKg > 0);

  return (
    <div className={className}>
      <ChartCard
        title="Harvest and income, month by month"
        icon={<BarChart3 size={13} />}
        note={coverageSentence(series)}
      >
        {/* Window totals above the bars, so the chart is readable without reading a bar. */}
        <div className="px-4 py-3 flex flex-wrap" style={{ gap: '10px 22px' }}>
          <Figure
            label={`Picked, ${months.length} months`}
            value={series.totalProducedKg === null ? 'Not shared' : kgTotalLabel(series.totalProducedKg)}
            tone={series.totalProducedKg === null ? FAINT : INK}
          />
          <Figure
            label="Sold"
            value={series.totalSoldKg === null ? 'Not shared' : kgTotalLabel(series.totalSoldKg)}
            tone={series.totalSoldKg === null ? FAINT : SOLD}
          />
          {/* Named for the population it is actually made of. A kept figure worked out across four
              farms, sitting unlabelled beside a picked figure covering six, invites the reader to
              subtract two numbers that were never about the same people. */}
          <Figure
            label={paired || series.comparableFarmers === 0
              ? 'Harvest not matched to sales'
              : `Unmatched, on ${series.comparableFarmers} farms`}
            value={series.totalKeptKg === null ? 'Not comparable' : kgTotalLabel(series.totalKeptKg)}
            tone={series.totalKeptKg === null ? FAINT : KEPT}
          />
          <Figure
            label="Farmer income"
            value={series.totalIncomeZar === null ? 'Not shared' : randLabel(series.totalIncomeZar)}
            tone={series.totalIncomeZar === null ? FAINT : SOLD}
          />
        </div>

        {/* ── panel 1: kilograms ── */}
        <div className="px-4">
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT }}>
              {/* Names only the bars actually below it. */}
              {paired || series.salesFarmers === 0
                ? 'Kilograms picked'
                : series.productionFarmers === 0 ? 'Kilograms sold' : 'Kilograms picked, and sold'}
            </span>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
              {kgTotalLabel(maxKg)}
            </span>
          </div>
          <div
            role="img"
            aria-label={kgPlotDescription(series, paired)}
            style={{
              display: 'grid', gridTemplateColumns: columns, alignItems: 'end', gap: 2,
              height: PLOT_KG, borderBottom: `1px solid ${AXIS}`,
              borderTop: '1px dashed rgba(140,122,98,0.20)',
            }}
          >
            {months.map((m, i) => (
              <div
                key={m.key}
                className="relative flex flex-col justify-end"
                style={{ height: '100%' }}
                title={monthTooltip(m)}
              >
                {paired
                  ? <PairedKgColumn m={m} parts={soldParts[i]} scale={kgScale} maxKg={maxKg} />
                  : <SplitKgColumn m={m} parts={soldParts[i]} scale={kgScale} maxKg={maxKg} />}
              </div>
            ))}
          </div>
        </div>

        {/* ── panel 2: rands, on its own scale, sharing the month axis below ── */}
        <div className="px-4" style={{ marginTop: 12 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT }}>Money the farmers took in</span>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
              {zarWithheld ? 'Not shared' : randTick(maxZar)}
            </span>
          </div>
          {zarWithheld ? (
            /* The training chart's answer to the same situation, in the same voice — but kept at
               the plot's full height, because the month axis below is shared with the kilogram
               panel and must not shift when this one has nothing to draw. */
            <div className="flex items-center" style={{ height: PLOT_ZAR, borderBottom: `1px solid ${AXIS}` }}>
              <p className="font-sans" style={{ fontSize: 13, color: MUTED, lineHeight: 1.55, margin: 0 }}>
                No farm in this cohort has shared its sales book. Income nobody agreed to show is
                not an income of R0, so these months are simply not drawn.
              </p>
            </div>
          ) : (
          <div
            role="img"
            aria-label={`Rand income each month across ${series.salesFarmers} farms.`}
            style={{
              display: 'grid', gridTemplateColumns: columns, alignItems: 'end', gap: 2,
              height: PLOT_ZAR, borderBottom: `1px solid ${AXIS}`,
            }}
          >
            {months.map((m, i) => {
              const pct = (zarScale.draw(zarTops[i]) / maxZar) * 100;
              return (
                <div
                  key={m.key}
                  className="flex flex-col justify-end"
                  style={{ height: '100%' }}
                  title={monthTooltip(m)}
                >
                  {pct > 0 && (
                    <div
                      className="relative"
                      style={{
                        margin: '0 18%', height: `${pct}%`, minHeight: 2,
                        background: SOLD, opacity: 0.85, borderRadius: '3px 3px 0 0',
                      }}
                    >
                      {zarScale.isClipped(zarTops[i]) && <BreakTop />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          )}
        </div>

        {/* ── the one month axis both panels are drawn against ── */}
        <div className="px-4" style={{ display: 'grid', gridTemplateColumns: columns, gap: 2, marginTop: 5 }}>
          {months.map((m) => (
            <span
              key={m.key}
              className="font-sans text-center"
              style={{ fontSize: MICRO, color: FAINT, whiteSpace: 'nowrap', overflow: 'hidden' }}
              title={m.longLabel}
            >
              {m.label}
            </span>
          ))}
        </div>

        <div className="px-4 pb-4" style={{ paddingTop: 11 }}>
          <div className="flex flex-wrap items-center" style={{ gap: '5px 14px' }}>
            {paired ? (
              <>
                <Key colour={SOLD} label="Sold" />
                <Key colour={KEPT} label="Harvest not matched to sales" />
                {anyOverSold && <Key colour={OVER} label="More sold than picked that month" outline />}
              </>
            ) : (
              /* Only the bars actually on the plot get a key. A "Sold · 0 farms" swatch beside an
                 empty half-column is a legend for something nobody drew, and the two-colour split
                 key means nothing until there really are two populations to keep apart. */
              <>
                {series.productionFarmers > 0 && (
                  <Key colour={PICKED} label={`Picked · ${series.productionFarmers} ${series.productionFarmers === 1 ? 'farm' : 'farms'}`} />
                )}
                {series.salesFarmers > 0 && (
                  <Key colour={SOLD} label={`Sold · ${series.salesFarmers} ${series.salesFarmers === 1 ? 'farm' : 'farms'}`} />
                )}
                {anyUnbacked && <Key colour={OVER} label="Sold with no harvest logged behind it" outline />}
                {series.productionFarmers > 0 && series.salesFarmers > 0 && (
                  <SplitKey label="Different farmers — never stacked" />
                )}
              </>
            )}
          </div>

          <Footnote>
            Unmatched harvest may be stored, eaten, donated, lost or missing a sales entry. It is not measured household consumption.
            These four figures cover the {months.length} months drawn here. A cohort total
            elsewhere on this page counts every record since each farm joined, so it can be a
            little larger — the two are different periods, not two answers.
          </Footnote>
          {cutInFull.length > 0 && (
            <Footnote>
              Drawn short so the rest of the year stays readable: {cutInFull.join(' · ')}.
            </Footnote>
          )}
          {!paired && (series.productionFarmers > 0 || series.salesFarmers > 0) && (
            <Footnote>{populationSentence(series)}</Footnote>
          )}
          {!paired && series.totalKeptKg !== null && (
            <Footnote>
              Kept is worked out only across the {series.comparableFarmers}{' '}
              {series.comparableFarmers === 1 ? 'farm' : 'farms'} sharing both books, so it is not
              the picked figure above minus the sold one.
            </Footnote>
          )}
          {paired && anyOverSold && (
            <Footnote>
              A dashed outline is a month whose sales run past the harvest logged in that same
              month. Usually that is produce picked earlier and sold later; occasionally it is a
              harvest nobody wrote down.
            </Footnote>
          )}
          {!paired && anyUnbacked && (
            <Footnote>
              A dashed sold bar is weight with no harvest record behind it here — either that
              farmer has not shared their harvest book, or the produce was picked in an earlier
              month. The bar still reaches the full figure it sold; nothing is drawn short of it.
            </Footnote>
          )}
        </div>
      </ChartCard>
    </div>
  );
}

function monthTooltip(m: CohortMonth): string {
  const bits: string[] = [m.longLabel];
  bits.push(m.producedKg === null ? 'harvest not shared' : `${kgLabel(m.producedKg)} picked`);
  bits.push(m.soldKg === null ? 'sales not shared' : `${kgLabel(m.soldKg)} sold`);
  bits.push(m.incomeZar === null ? 'income not shared' : `${randLabel(m.incomeZar)} in`);
  if (m.activeFarmers > 0) {
    bits.push(`${m.activeFarmers} ${m.activeFarmers === 1 ? 'farm logging' : 'farms logging'}`);
  }
  return bits.join(' · ');
}

/** Stated on the card, never left implied: whose books these bars are actually made of. */
function coverageSentence(series: CohortSeries): string {
  const total = series.farmerCount;
  const farms = total === 1 ? 'farm shares' : 'farms share';
  const sold = series.salesFarmers;
  const both = series.keptComparable
    ? '' // every farmer here shares both, so naming the overlap would only repeat the two counts
    : ` ${series.comparableFarmers === 0 ? 'None' : series.comparableFarmers} of them ${series.comparableFarmers === 1 ? 'shares' : 'share'} both.`;
  return (
    `${series.productionFarmers} of ${total} ${farms} a harvest record and ${sold} ${sold === 1 ? 'shares' : 'share'} sales.${both} ` +
    'Anyone who has not is absent from these bars, not counted as a zero.'
  );
}

/**
 * What the kilogram plot is, for a screen reader. It must describe the drawing actually on the
 * page — a stack, two bars apart, or a single population's bars — because the alternative is a
 * blind funder being told about a split that is not there or a stack that is not either.
 */
function kgPlotDescription(series: CohortSeries, paired: boolean): string {
  const { productionFarmers: picked, salesFarmers: sold } = series;
  if (paired) {
    return `Kilograms picked each month across ${picked} farms, showing sold kilograms and harvest not matched to sales.`;
  }
  if (sold === 0) return `Kilograms picked each month across ${picked} farms. Nobody here shares a sales record.`;
  if (picked === 0) return `Kilograms sold each month across ${sold} farms. Nobody here shares a harvest record.`;
  return (
    `Kilograms picked each month across ${picked} farms, and kilograms sold across ${sold} farms, `
    + 'drawn side by side because they are not the same farms.'
  );
}

/**
 * Why the picked bars and the sold bars are drawn apart — printed whenever they are.
 *
 * The precedent this follows is components/ChartBreakMark.tsx and the capped-axis contract in
 * lib/chart-scale.ts: a drawing that is not a plain reading of the data carries a visible mark AND
 * the true position is stated in words. Here the mark is the two bars standing apart with their
 * own key, and this is the sentence.
 */
function populationSentence(series: CohortSeries): string {
  const { productionFarmers: picked, salesFarmers: sold, comparableFarmers: both } = series;
  if (picked === 0) {
    return 'Nobody here has agreed to share a harvest record, so only the sold bars are drawn. '
      + 'The empty half of each column is a permission nobody gave, not a harvest of nothing.';
  }
  if (sold === 0) {
    return 'Nobody here has agreed to share a sales record, so only the picked bars are drawn. '
      + 'The empty half of each column is a permission nobody gave, not a harvest nobody sold.';
  }
  const overlap = both === 0
    ? 'no farm shares both'
    : `only ${both} ${both === 1 ? 'farm shares' : 'farms share'} both`;
  return (
    `${picked} ${picked === 1 ? 'farm shares' : 'farms share'} a harvest record and ${sold} `
    + `${sold === 1 ? 'shares' : 'share'} sales, but ${overlap}. `
    + 'Picked and sold stand side by side because they are not the same farms: neither can be '
    + 'stacked on, subtracted from, or cut down to the other.'
  );
}

/* ════════════════════════════════════════════════════════════════════════════
 * Chart 2 — how far the cohort has got through the course
 * ══════════════════════════════════════════════════════════════════════════*/

export function CohortTrainingChart({ training, className }: { training: CohortTraining; className?: string }) {
  const { bands, modulesTotal, reporting, total } = training;
  const tallest = bands.reduce((max, b) => Math.max(max, b.farmers), 0);

  const note =
    reporting === 0
      ? `None of these ${total} farmers has agreed to share a training record.`
      : `${reporting} of ${total} ${total === 1 ? 'farmer shares' : 'farmers share'} a training record. ` +
        `The course is ${modulesTotal} modules.`;

  return (
    <div className={className}>
      <ChartCard title="Course progress across the cohort" icon={<GraduationCap size={13} />} note={note}>
        {reporting === 0 ? (
          <NoChart reason="A training record nobody agreed to share is not a farmer who has done no training, so nobody is drawn at zero here — they are simply not drawn." />
        ) : (
          <>
            <div className="px-4 py-3 flex flex-wrap" style={{ gap: '10px 22px' }}>
              <Figure
                label="Average of the course done"
                value={training.averagePct === null ? '—' : `${training.averagePct}%`}
                tone={TRAIN}
              />
              <Figure label="Finished every module" value={String(training.finishedCourse)} tone={INK} />
              <Figure label="Started the course" value={String(training.started)} tone={INK} />
              <Figure label="Modules finished in total" value={String(training.modulesCompleted)} tone={INK} />
            </div>

            <div className="px-4">
              <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
                <span className="font-sans" style={{ fontSize: MICRO, color: FAINT }}>Farmers</span>
                <span className="font-sans" style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
                  {tallest}
                </span>
              </div>
              <div
                role="img"
                aria-label={`How many of the ${reporting} reporting farmers have finished each number of course modules, from none to all ${modulesTotal}.`}
                style={{
                  display: 'grid', gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))`,
                  alignItems: 'end', gap: 2, height: PLOT_TRAINING, borderBottom: `1px solid ${AXIS}`,
                }}
              >
                {bands.map((band) => {
                  const pct = tallest > 0 ? (band.farmers / tallest) * 100 : 0;
                  return (
                    <div
                      key={band.done}
                      className="flex flex-col justify-end"
                      style={{ height: '100%' }}
                      title={`${band.farmers} ${band.farmers === 1 ? 'farmer has' : 'farmers have'} finished ${band.done} of ${modulesTotal} modules`}
                    >
                      {band.farmers > 0 && (
                        <div
                          style={{
                            margin: '0 14%', height: `${pct}%`, minHeight: 3,
                            background: band.done === modulesTotal ? SOLD : TRAIN,
                            opacity: band.done === 0 ? 0.4 : 1,
                            borderRadius: '3px 3px 0 0',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: `repeat(${bands.length}, minmax(0, 1fr))`,
                  gap: 2, marginTop: 5,
                }}
              >
                {bands.map((band) => (
                  <span
                    key={band.done}
                    className="font-sans text-center"
                    style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}
                  >
                    {band.done}
                  </span>
                ))}
              </div>
              <p className="font-sans text-center" style={{ fontSize: MICRO, color: FAINT, margin: '6px 0 0' }}>
                Modules finished, out of {modulesTotal}
              </p>
            </div>

            <div className="px-4 pb-4">
              <Footnote>
                A module counts once the farmer has completed it in the app. Farmers who have not
                shared a training record are not drawn at zero — they are not drawn at all.
              </Footnote>
            </div>
          </>
        )}
      </ChartCard>
    </div>
  );
}

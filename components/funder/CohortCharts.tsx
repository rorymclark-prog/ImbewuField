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
import { cappedScale } from '@/lib/chart-scale';
import { BreakTop } from '@/components/ChartBreakMark';
import { kgLabel, kgTotalLabel, randLabel, randTick } from '@/lib/format-figures';
import type { CohortMonth, CohortSeries } from '@/lib/cohort-series';
import type { CohortTraining } from '@/lib/cohort-report';

/* ── palette: the finance charts', unchanged, so three screens read as one app ───────────────── */
const CARD_STYLE: React.CSSProperties = { background: '#FFFEFA', border: '1px solid #E2D8C4' };
const INK = '#20190F';
const MUTED = '#5C5040';
const FAINT = '#8C7A62';
const HAIRLINE = '#E2D8C4';
const AXIS = 'rgba(140,122,98,0.45)';
const SOLD = '#1F4D2B';   // forest — sold kilograms and money in, exactly CashflowChart's IN
const KEPT = '#C4A46A';   // gold — lighter, so the split survives greyscale and a printed report
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

export function CohortTimeline({ series, className }: { series: CohortSeries; className?: string }) {
  const months = series.months;

  const kgTops = useMemo(() => months.map(kgTopOf), [months]);
  const zarTops = useMemo(() => months.map((m) => m.incomeZar ?? 0), [months]);
  const kgScale = useMemo(() => cappedScale(kgTops), [kgTops]);
  const zarScale = useMemo(() => cappedScale(zarTops), [zarTops]);

  const maxKg = Math.max(kgScale.max, 1);
  const maxZar = Math.max(zarScale.max, 1);

  // Rule 2: every bar the axis cut is named in full, in words, underneath the chart.
  const cutInFull = useMemo(() => {
    const out: string[] = [];
    months.forEach((m, i) => {
      if (kgScale.isClipped(kgTops[i])) out.push(`${m.longLabel} — ${kgTotalLabel(kgTops[i])} picked`);
      if (zarScale.isClipped(zarTops[i])) out.push(`${m.longLabel} — ${randLabel(zarTops[i])} in`);
    });
    return out;
  }, [months, kgTops, zarTops, kgScale, zarScale]);

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
  const anyOverSold = months.some((m) => m.soldExceedsProduced);

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
          <Figure
            label="Kept on the farms"
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
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT }}>Kilograms picked</span>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
              {kgTotalLabel(maxKg)}
            </span>
          </div>
          <div
            role="img"
            aria-label={`Kilograms picked each month across ${series.productionFarmers} farms, split into what was sold and what was kept.`}
            style={{
              display: 'grid', gridTemplateColumns: columns, alignItems: 'end', gap: 2,
              height: PLOT_KG, borderBottom: `1px solid ${AXIS}`,
              borderTop: '1px dashed rgba(140,122,98,0.20)',
            }}
          >
            {months.map((m, i) => {
              const produced = m.producedKg ?? 0;
              const sold = Math.min(m.soldKg ?? 0, produced);
              const kept = m.keptKg ?? 0;
              const cut = kgScale.isClipped(kgTops[i]);
              const soldPct = (kgScale.draw(sold) / maxKg) * 100;
              const keptPct = (kgScale.draw(Math.min(kept, Math.max(0, maxKg - sold))) / maxKg) * 100;
              // Sold beyond what the picking log accounts for: an open outline to the sold figure,
              // never a filled block — no harvest record stands behind that height.
              const overPct = m.soldExceedsProduced ? (kgScale.draw(m.soldKg ?? 0) / maxKg) * 100 : 0;
              return (
                <div
                  key={m.key}
                  className="relative flex flex-col justify-end"
                  style={{ height: '100%' }}
                  title={monthTooltip(m)}
                >
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
                </div>
              );
            })}
          </div>
        </div>

        {/* ── panel 2: rands, on its own scale, sharing the month axis below ── */}
        <div className="px-4" style={{ marginTop: 12 }}>
          <div className="flex items-baseline justify-between" style={{ marginBottom: 4 }}>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT }}>Money the farmers took in</span>
            <span className="font-sans" style={{ fontSize: MICRO, color: FAINT, fontVariantNumeric: 'tabular-nums' }}>
              {randTick(maxZar)}
            </span>
          </div>
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
            <Key colour={SOLD} label="Sold" />
            <Key colour={KEPT} label="Kept on the farm" />
            {anyOverSold && <Key colour={OVER} label="More sold than picked that month" outline />}
          </div>

          <Footnote>
            These four figures cover the {months.length} months drawn here. A cohort total
            elsewhere on this page counts every record since each farm joined, so it can be a
            little larger — the two are different periods, not two answers.
          </Footnote>
          {cutInFull.length > 0 && (
            <Footnote>
              Drawn short so the rest of the year stays readable: {cutInFull.join(' · ')}.
            </Footnote>
          )}
          {!series.keptComparable && series.productionFarmers > 0 && series.salesFarmers > 0 && (
            <Footnote>
              Harvest and sales here come from different sets of farmers, so what was kept on the
              farms cannot be worked out by subtracting one from the other.
            </Footnote>
          )}
          {anyOverSold && (
            <Footnote>
              A dashed outline is a month whose sales run past the harvest logged in that same
              month. Usually that is produce picked earlier and sold later; occasionally it is a
              harvest nobody wrote down.
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
  return (
    `${series.productionFarmers} of ${total} ${farms} a harvest record and ${series.salesFarmers} share sales. ` +
    'Anyone who has not is absent from these bars, not counted as a zero.'
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

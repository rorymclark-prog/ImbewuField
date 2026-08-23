'use client';

// Cash flow — the first thing on the Finance screen.
//
// Rory: "a cashflow graph right at the top". Everything else on /finances answers
// "what is the total for this period"; none of it answered "is money coming in
// faster than it is going out", which is the question a farmer actually opens a
// finance screen with.
//
// Two panels, one month axis. That is not decoration, it is the alternative to a
// second y-scale: monthly money in/out and a running total accumulate at wildly
// different magnitudes — twelve months of R800 sales run a total up past R9 000 —
// and drawing both against one axis makes every bar a hairline. Two stacked
// panels sharing an x-axis says the same thing without a chart that lies about
// proportion.
//
// WHAT THE RUNNING TOTAL IS NOT: a bank balance. The app has no opening figure and
// no account. It starts at zero on the left edge and answers "across these months,
// am I ahead or behind" — which is why the label says exactly that.
//
// Money in is cashIncomeTotal() per month, never sum(sales.amount): a paid
// invoice's kg lines are also sales rows, and adding both counts them twice. That
// arithmetic lives in lib/finance-series.ts with its own tests.

import { useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import { buildFinanceSeries, type FinanceMonthPoint } from '@/lib/finance-series';
import { randLabel, randTick } from '@/lib/format-figures';

const CARD: React.CSSProperties = { background: '#FFFEFA', border: '1px solid #E2D8C4' };

const INK = '#20190F';
const MUTED = '#5C5040';
const FAINT = '#8C7A62';
const HAIRLINE = '#E2D8C4';
const IN = '#1F4D2B';      // money in — the app's forest green
const OUT = '#C07A1E';     // money out — the ochre used for costs everywhere else
const RUN = '#235E86';     // the running total: a third hue, so it is never read as a third bar

const WINDOWS = [6, 12, 24];

export default function CashflowChart({
  sales,
  expenses,
  production,
  invoices,
  loading,
}: {
  sales: SalesLog[];
  expenses: ExpenseLog[];
  production: ProductionLog[];
  invoices: SavedInvoice[];
  loading: boolean;
}) {
  const [windowMonths, setWindowMonths] = useState(12);
  const [picked, setPicked] = useState<string | null>(null);

  // A fresh Date every render would rebuild the whole series on every keystroke
  // elsewhere on the page. The month is all this chart depends on.
  const now = useMemo(() => new Date(), []);
  const series = useMemo(
    () => buildFinanceSeries(production, sales, expenses, invoices, now, windowMonths),
    [production, sales, expenses, invoices, now, windowMonths],
  );

  const header = (
    <div className="px-4 py-3" style={{ borderBottom: `1px solid ${HAIRLINE}` }}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: MUTED }}>
          <TrendingUp size={13} /> Cash flow
        </p>
        <div className="flex items-center gap-1 flex-shrink-0">
          {WINDOWS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => { setWindowMonths(n); setPicked(null); }}
              aria-pressed={windowMonths === n}
              className="font-mono rounded-full px-2 py-0.5"
              style={{
                fontSize: 10.5,
                border: `1px solid ${windowMonths === n ? IN : HAIRLINE}`,
                background: windowMonths === n ? IN : 'transparent',
                color: windowMonths === n ? '#FFFEFA' : MUTED,
                cursor: 'pointer',
              }}
            >
              {n}m
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs font-sans mt-1" style={{ color: FAINT }}>
        Money in against money out, month by month, from what you have recorded.
      </p>
    </div>
  );

  if (loading) {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <div className="px-4 py-6 font-sans" style={{ fontSize: 13, color: FAINT }}>Reading your records…</div>
      </section>
    );
  }

  if (!series.hasRecords) {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <div className="px-4 py-5">
          <p className="font-display font-semibold" style={{ fontSize: 13.5, color: INK }}>
            {series.earlierRecords ? 'Nothing recorded in these months' : 'No money recorded yet'}
          </p>
          <p className="font-sans mt-1" style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            {series.earlierRecords
              ? `Your records start in ${series.firstRecordLabel}. Try a longer window above to reach them.`
              : 'Log a sale or a cost and this chart draws itself. Two or three months of entries is enough to see a pattern.'}
          </p>
        </div>
      </section>
    );
  }

  const selected = series.months.find((m) => m.key === picked)
    ?? [...series.months].reverse().find((m) => m.hasRecords)
    ?? series.months[series.months.length - 1];

  return (
    <section className="rounded-2xl overflow-hidden" style={CARD}>
      {header}

      <div className="px-4 py-3.5 flex flex-wrap items-baseline" style={{ gap: '4px 20px' }}>
        <Figure label={`In, ${series.windowMonths} months`} value={randLabel(series.totalInZar)} tone={IN} />
        <Figure label="Out" value={randLabel(series.totalOutZar)} tone={OUT} />
        <Figure
          label={series.totalNetZar < 0 ? 'Behind, altogether' : 'Ahead, altogether'}
          value={randLabel(series.totalNetZar)}
          tone={series.totalNetZar < 0 ? '#B33A3A' : INK}
        />
      </div>

      <Panels months={series.months} selectedKey={selected.key} onPick={setPicked} />

      <Readout month={selected} />

      <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${HAIRLINE}`, background: '#FBF7EF' }}>
        <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
          The lower band is the running total across these months only, starting from zero — not a bank balance.
        </p>
        <p className="font-sans" style={{ fontSize: 10.5, color: FAINT, lineHeight: 1.5 }}>
          Entries land in the month you recorded them. There is no date field on the logging forms yet, so a month
          you caught up on later will sit in the month you typed it.
        </p>
      </div>
    </section>
  );
}

function Figure({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono font-semibold" style={{ fontSize: 20, color: tone, letterSpacing: '-0.01em' }}>{value}</span>
      <span className="font-sans" style={{ fontSize: 10.5, color: FAINT }}>{label}</span>
    </span>
  );
}

/* ── The chart ──────────────────────────────────────────────────────────────
   Two panels in one SVG so they cannot drift out of horizontal alignment: the
   month a bar sits over and the month the running total sits over have to be the
   same month, and two separate <svg>s with independent padding would not
   guarantee that at every container width. */

const W = 320;
const PAD = { left: 34, right: 8, top: 12, bottom: 16 };
const BARS_H = 118;   // the in/out panel, excluding its padding
const GAP_H = 10;
const RUN_H = 44;     // the running-total band

function Panels({
  months,
  selectedKey,
  onPick,
}: {
  months: FinanceMonthPoint[];
  selectedKey: string;
  onPick: (key: string) => void;
}) {
  const n = months.length;
  const plotW = W - PAD.left - PAD.right;
  const colW = plotW / n;
  const barW = Math.min(colW * 0.52, 15);
  const totalH = PAD.top + BARS_H + GAP_H + RUN_H + PAD.bottom;

  const maxIn = Math.max(...months.map((m) => m.moneyInZar), 0);
  const maxOut = Math.max(...months.map((m) => m.moneyOutZar), 0);
  // One shared span, so a R500 cost and a R500 sale are drawn the same length.
  const span = maxIn + maxOut || 1;
  const zeroY = PAD.top + (maxIn / span) * BARS_H;

  const runTop = PAD.top + BARS_H + GAP_H;
  const runValues = months.map((m) => m.runningZar);
  const runMax = Math.max(...runValues, 0);
  const runMin = Math.min(...runValues, 0);
  const runSpan = runMax - runMin || 1;
  const runY = (v: number) => runTop + RUN_H - ((v - runMin) / runSpan) * RUN_H;
  const runZeroY = runY(0);

  const cx = (i: number) => PAD.left + i * colW + colW / 2;
  const runPath = months.map((m, i) => `${i === 0 ? 'M' : 'L'} ${cx(i).toFixed(2)} ${runY(m.runningZar).toFixed(2)}`).join(' ');
  const runArea = `${runPath} L ${cx(n - 1).toFixed(2)} ${runZeroY.toFixed(2)} L ${cx(0).toFixed(2)} ${runZeroY.toFixed(2)} Z`;

  // Every other label once the axis gets crowded; the first and last always show
  // so the window the farmer is looking at is never ambiguous.
  const showLabel = (i: number) => n <= 12 || i === 0 || i === n - 1 || i % 2 === 0;

  return (
    <div className="px-2">
      <svg viewBox={`0 0 ${W} ${totalH}`} width="100%" style={{ display: 'block' }} role="img"
        aria-label={`Money in and money out for each of the last ${n} months, with a running total below.`}>
        {/* Zero line for the bars, and the two extents of the shared scale. */}
        <line x1={PAD.left} x2={W - PAD.right} y1={zeroY} y2={zeroY} stroke="rgba(140,122,98,0.45)" strokeWidth="0.8" />
        {maxIn > 0 && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top} y2={PAD.top} stroke="rgba(140,122,98,0.16)" strokeWidth="0.8" strokeDasharray="3,3" />
            <text x={PAD.left - 4} y={PAD.top + 3} textAnchor="end" fontSize="7" fill={FAINT} fontFamily="monospace">{randTick(maxIn)}</text>
          </>
        )}
        <text x={PAD.left - 4} y={zeroY + 2.5} textAnchor="end" fontSize="7" fill={FAINT} fontFamily="monospace">R0</text>
        {maxOut > 0 && (
          <>
            <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + BARS_H} y2={PAD.top + BARS_H} stroke="rgba(140,122,98,0.16)" strokeWidth="0.8" strokeDasharray="3,3" />
            <text x={PAD.left - 4} y={PAD.top + BARS_H + 2.5} textAnchor="end" fontSize="7" fill={FAINT} fontFamily="monospace">{randTick(maxOut)}</text>
          </>
        )}

        {months.map((m, i) => {
          const inH = (m.moneyInZar / span) * BARS_H;
          const outH = (m.moneyOutZar / span) * BARS_H;
          const x = cx(i) - barW / 2;
          return (
            <g key={m.key}>
              {/* Money in grows up from zero, money out grows down. Position, not
                  only colour, tells the two apart — which is what keeps the chart
                  readable in greyscale and to a colourblind reader. */}
              {m.moneyInZar > 0 && <rect x={x} y={zeroY - inH} width={barW} height={inH} fill={IN} rx="2" />}
              {m.moneyOutZar > 0 && <rect x={x} y={zeroY} width={barW} height={outH} fill={OUT} rx="2" />}
            </g>
          );
        })}

        {/* The running band, drawn after the bars so its line is never buried. */}
        <rect x={PAD.left} y={runTop} width={plotW} height={RUN_H} fill="rgba(35,94,134,0.045)" />
        <line x1={PAD.left} x2={W - PAD.right} y1={runZeroY} y2={runZeroY} stroke="rgba(140,122,98,0.4)" strokeWidth="0.7" strokeDasharray="2,2" />
        <path d={runArea} fill="rgba(35,94,134,0.14)" />
        <path d={runPath} fill="none" stroke={RUN} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={cx(n - 1)} cy={runY(months[n - 1].runningZar)} r="2.4" fill={RUN} />
        <text x={PAD.left - 4} y={runTop + 4} textAnchor="end" fontSize="6.5" fill={FAINT} fontFamily="monospace">{randTick(runMax)}</text>

        {/* Month labels, and a year mark wherever the axis crosses into January. */}
        {months.map((m, i) => (
          <g key={`x-${m.key}`}>
            {showLabel(i) && (
              <text x={cx(i)} y={totalH - 5} textAnchor="middle" fontSize="7" fill={FAINT} fontFamily="monospace">{m.label}</text>
            )}
            {(m.month === 1 || i === 0) && (
              <text x={cx(i)} y={totalH - 12} textAnchor="middle" fontSize="6" fill="#B8AC96" fontFamily="monospace">{m.year}</text>
            )}
          </g>
        ))}

        {/* Selection: a full-height target per column, so a fingertip does not have
            to find a 4px bar. Drawn last to sit above everything. */}
        {months.map((m, i) => (
          <g key={`hit-${m.key}`}>
            {m.key === selectedKey && (
              <rect x={cx(i) - colW / 2} y={PAD.top - 4} width={colW} height={BARS_H + GAP_H + RUN_H + 8}
                fill="rgba(32,25,15,0.05)" rx="2" />
            )}
            <rect
              x={cx(i) - colW / 2} y={0} width={colW} height={totalH}
              fill="transparent" style={{ cursor: 'pointer' }}
              onClick={() => onPick(m.key)}
            >
              <title>{`${m.longLabel} — in ${randLabel(m.moneyInZar)}, out ${randLabel(m.moneyOutZar)}`}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Readout({ month }: { month: FinanceMonthPoint }) {
  return (
    <div className="px-4 py-2.5 flex flex-wrap items-baseline" style={{ gap: '2px 14px', borderTop: `1px solid #F0E9DA` }}>
      <span className="font-display font-semibold" style={{ fontSize: 12.5, color: INK }}>{month.longLabel}</span>
      {month.hasRecords ? (
        <>
          <Chip dot={IN} label="in" value={randLabel(month.moneyInZar)} />
          <Chip dot={OUT} label="out" value={randLabel(month.moneyOutZar)} />
          <Chip dot={RUN} label="running total" value={randLabel(month.runningZar)} />
        </>
      ) : (
        // Not "R0 in, R0 out". Nothing was written down, which is a different fact.
        <span className="font-sans" style={{ fontSize: 11.5, color: FAINT }}>nothing recorded this month</span>
      )}
    </div>
  );
}

function Chip({ dot, label, value }: { dot: string; label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 2, background: dot, display: 'inline-block' }} />
      <span className="font-mono" style={{ fontSize: 12, color: INK }}>{value}</span>
      <span className="font-sans" style={{ fontSize: 10.5, color: FAINT }}>{label}</span>
    </span>
  );
}

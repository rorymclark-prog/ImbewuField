'use client';

// "Coming up" — the forward half of the Finance screen.
//
// Everything else on /finances looks backwards: what was sold, what was spent,
// what was picked. Rory: "should we have some part of this in the finance
// section too? so we can see expected yields etc etc". This is that part — the
// crop plan read as a forward book of harvests, with a Rand figure ONLY once
// the farmer has confirmed the loss and sale assumptions behind it.
//
// The honesty rules this card is built around, all of them enforced upstream in
// lib/forward-harvests.ts and lib/plan-value.ts rather than here:
//  - A month total means "the pickings that BEGIN this month come to about X kg",
//    never "you will pick X kg this month". There is no picking curve in the
//    data and this card must not imply one — so it says so, in the caption.
//  - Crops with no verified kg/m² are excluded and NAMED. Absence of a benchmark
//    is not zero kilograms.
//  - No Rand headline until the sliders are confirmed. Until then the card links
//    to them instead of showing a number.
//  - An overbooked bed withholds every kilogram, matching the crop plan.

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { CalendarClock, ChevronDown } from 'lucide-react';
import type { CashflowSettings } from '@/lib/crop-plan';
import type { CropPrice } from '@/lib/crop-prices';
import { buildForwardHarvests, forwardValueRows, type ForwardHarvestMonth } from '@/lib/forward-harvests';
import { planValue, type ValueChannel } from '@/lib/plan-value';
import type { FinancePlanSource } from '@/lib/finance-plan-source';

const rand = (n: number): string =>
  `R${Math.round(n).toLocaleString('en-ZA').replace(/,/g, ' ')}`;

const kgLabel = (n: number): string => (n >= 100 ? `${Math.round(n)} kg` : `${n.toFixed(1)} kg`);

const CARD: React.CSSProperties = { background: '#FFFEFA', border: '1px solid #E2D8C4' };

export default function ComingUpHarvests({
  source,
  prices,
  settings,
  channel = 'retail',
  horizonMonths = 3,
}: {
  source: FinancePlanSource;
  prices: Record<string, CropPrice>;
  settings: CashflowSettings;
  channel?: ValueChannel;
  horizonMonths?: number;
}) {
  const [openMonth, setOpenMonth] = useState<string | null>(null);

  // A fresh Date on every render would rebuild the book on every keystroke
  // elsewhere on the page; the month is what this card actually depends on.
  const now = useMemo(() => new Date(), []);
  const book = useMemo(
    () => buildForwardHarvests(source.plantings, source.beds, now, horizonMonths),
    [source.plantings, source.beds, now, horizonMonths],
  );
  const value = useMemo(
    () => planValue(forwardValueRows(book), prices, channel, settings),
    [book, prices, channel, settings],
  );

  const header = (
    <div className="px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4' }}>
      <p className="text-xs font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: '#5C5040' }}>
        <CalendarClock size={13} /> Coming up
      </p>
      <p className="text-xs font-sans mt-1" style={{ color: '#8C7A62' }}>
        What your crop plan says is due to be picked over the next{' '}
        {book.horizonMonths === 1 ? 'month' : `${book.horizonMonths} months`}.
      </p>
    </div>
  );

  if (!source.loaded) {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <div className="px-4 py-6 font-sans" style={{ fontSize: 13, color: '#8C7A62' }}>Reading your crop plan…</div>
      </section>
    );
  }

  // Three genuinely different kinds of nothing. Saying "no harvests coming up"
  // to a farmer who has never mapped a bed sends them looking for a bug.
  if (source.origin === 'none') {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <Empty
          title="No growing area mapped yet"
          body="Trace your beds in the Design Studio and this card will show what is due to be picked, and roughly what it is worth."
          href="/design"
          cta="Open the Design Studio"
        />
      </section>
    );
  }

  if (book.areaConflictBedLabels.length > 0) {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <Empty
          title="Two crops are booked into the same ground"
          body={`${book.areaConflictBedLabels.join(', ')} — until that is resolved, any harvest figure here would be a guess about which crop loses the space.`}
          href="/facilitator/crops"
          cta="Fix it in the crop plan"
        />
      </section>
    );
  }

  if (book.harvests.length === 0) {
    return (
      <section className="rounded-2xl overflow-hidden" style={CARD}>
        {header}
        <Empty
          title="Nothing due to be picked yet"
          body={
            source.plantings.length === 0
              ? 'Your crop plan is empty. Plan a season and this card fills itself in.'
              : `Nothing in the plan starts picking in the next ${book.horizonMonths} months.`
          }
          href="/facilitator/crops"
          cta={source.plantings.length === 0 ? 'Plan your crops' : 'Open the crop plan'}
        />
        <Exclusions book={book} />
      </section>
    );
  }

  return (
    <section className="rounded-2xl overflow-hidden" style={CARD}>
      {header}

      <div className="px-4 py-3.5 flex flex-wrap items-baseline" style={{ gap: '4px 20px' }}>
        <Figure label="Expected to pick" value={kgLabel(book.totalKg)} />
        {value.confirmed ? (
          <>
            <Figure label="If sold" value={rand(value.cash)} tone="#1F4D2B" />
            {value.home > 0 && <Figure label="Kept at home, at shop prices" value={rand(value.home)} tone="#5C5040" />}
          </>
        ) : (
          <Link
            href="/facilitator/crops"
            className="font-sans"
            style={{ fontSize: 12, color: '#1F4D2B', textDecoration: 'underline', alignSelf: 'center' }}
          >
            Set your loss and sale assumptions to see what it is worth
          </Link>
        )}
      </div>

      <p className="px-4 pb-3 font-sans" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.45 }}>
        Each figure is a whole crop&apos;s harvest counted in the month its picking{' '}
        <em>starts</em> — not what you pick during that month. Planning estimates, not promises.
      </p>

      <div style={{ borderTop: '1px solid #E2D8C4' }}>
        {book.months.map((m) => (
          <MonthRow
            key={`${m.year}-${m.month}`}
            month={m}
            open={openMonth === `${m.year}-${m.month}`}
            onToggle={() => setOpenMonth(openMonth === `${m.year}-${m.month}` ? null : `${m.year}-${m.month}`)}
          />
        ))}
      </div>

      <Exclusions book={book} unpriced={value.confirmed ? value.unpricedCropNames : []} />
    </section>
  );
}

function Figure({ label, value, tone = '#20190F' }: { label: string; value: string; tone?: string }) {
  return (
    <span className="flex flex-col">
      <span className="font-mono font-semibold" style={{ fontSize: 20, color: tone, letterSpacing: '-0.01em' }}>{value}</span>
      <span className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>{label}</span>
    </span>
  );
}

function MonthRow({ month, open, onToggle }: { month: ForwardHarvestMonth; open: boolean; onToggle: () => void }) {
  const empty = month.harvests.length === 0;
  return (
    <div style={{ borderBottom: '1px solid #F0E9DA' }}>
      <button
        type="button"
        onClick={empty ? undefined : onToggle}
        aria-expanded={empty ? undefined : open}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left"
        style={{ background: 'transparent', border: 'none', cursor: empty ? 'default' : 'pointer' }}
      >
        <span className="flex items-center gap-2 min-w-0">
          <span className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{month.label}</span>
          {!empty && (
            <span className="font-sans truncate" style={{ fontSize: 12, color: '#8C7A62' }}>
              {month.harvests.length === 1 ? month.harvests[0].name : `${month.harvests.length} crops`}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1.5 flex-shrink-0">
          {/* An em-dash, not "0 kg": nothing starting is not a harvest of nothing. */}
          <span className="font-mono" style={{ fontSize: 13, color: empty ? '#B8AC96' : '#20190F' }}>
            {empty ? '—' : kgLabel(month.kg)}
          </span>
          {!empty && (
            <ChevronDown size={13} style={{ color: '#9A8268', transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 120ms' }} />
          )}
        </span>
      </button>
      {open && !empty && (
        <ul className="px-4 pb-3 pt-0.5 flex flex-col gap-1.5" style={{ listStyle: 'none', margin: 0 }}>
          {month.harvests.map((h) => (
            <li key={h.plantingId} className="flex items-baseline justify-between gap-3">
              <span className="font-sans min-w-0" style={{ fontSize: 12, color: '#5C5040' }}>
                <span aria-hidden="true">{h.icon}</span> {h.name}
                <span style={{ color: '#9A8268' }}> · {h.bedLabel}</span>
                {h.endMonth !== h.startMonth && (
                  <span style={{ color: '#9A8268' }}> · picking runs into {MONTH_NAME[h.endMonth]}</span>
                )}
              </span>
              <span className="font-mono flex-shrink-0" style={{ fontSize: 12, color: '#20190F' }}>{kgLabel(h.kg)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const MONTH_NAME: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
  7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

/**
 * What the numbers above leave out. This is not a footnote — it is the
 * difference between a farmer trusting the figure and quietly deciding the app
 * makes things up.
 */
function Exclusions({
  book,
  unpriced = [],
}: {
  book: ReturnType<typeof buildForwardHarvests>;
  unpriced?: string[];
}) {
  const lines: string[] = [];
  if (book.excludedCropNames.length > 0) {
    lines.push(`Left out of the kilograms — no verified yield figure yet: ${book.excludedCropNames.join(', ')}.`);
  }
  if (unpriced.length > 0) {
    lines.push(`Counted in kilograms but not in the Rand figure — no price on file: ${unpriced.join(', ')}.`);
  }
  if (book.nonFoodCropNames.length > 0) {
    lines.push(`Not counted as food — soil cover: ${book.nonFoodCropNames.join(', ')}.`);
  }
  if (lines.length === 0) return null;
  return (
    <div className="px-4 py-2.5" style={{ borderTop: '1px solid #E2D8C4', background: '#FBF7EF' }}>
      {lines.map((l) => (
        <p key={l} className="font-sans" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.5 }}>{l}</p>
      ))}
    </div>
  );
}

function Empty({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="px-4 py-5">
      <p className="font-display font-semibold" style={{ fontSize: 13.5, color: '#20190F' }}>{title}</p>
      <p className="font-sans mt-1" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.5 }}>{body}</p>
      <Link
        href={href}
        className="inline-block mt-2.5 font-sans font-semibold"
        style={{ fontSize: 12, color: '#1F4D2B', textDecoration: 'underline' }}
      >
        {cta}
      </Link>
    </div>
  );
}

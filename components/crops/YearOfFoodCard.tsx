'use client';

import { useState } from 'react';
import { CalendarRange, Package, Sprout, Trees, TriangleAlert, WandSparkles } from 'lucide-react';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { PRODUCT_LABEL } from '@/lib/animal-enterprises';
import { formatMonthSpan, monthSpanText } from '@/lib/perennial-harvest';
import type { GapFillMonth, GapFillSuggestion, YearOfFood, YearOfFoodMonth } from '@/lib/year-of-food';
import { PRODUCT_ICON } from './AnimalEnterprisesCard';

const SHARE_LABEL: ReadonlyArray<[number, string]> = [[1, 'whole bed'], [0.5, 'half the bed'], [1 / 3, 'a third of the bed'], [0.25, 'a quarter of the bed']];

function shareLabel(fraction: number, lang: string): string {
  const known = SHARE_LABEL.find(([value]) => Math.abs(value - fraction) < 1e-6)?.[1];
  return known ? inlineText(lang, known) : inlineTemplate(lang, '{n}% of the bed', null, { n: Math.round(fraction * 100) });
}

function monthName(month: number): string {
  return MONTHS_SHORT[month - 1] ?? '';
}

/** Other food expected in a crop-gap month; availability does not prove sufficiency. */
function otherCover(m: YearOfFoodMonth, lang: string): string | null {
  const parts = [
    ...(m.fruit.length ? [inlineText(lang, 'fruit')] : []),
    ...m.animalProducts.map((p) => inlineText(lang, PRODUCT_LABEL[p]).toLowerCase()),
  ];
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : inlineTemplate(lang, '{first} and {last}', null, { first: parts.slice(0, -1).join(', '), last: parts[parts.length - 1] });
  return inlineTemplate(lang, '{list} also expected', null, { list });
}

function MonthCell({ m }: { m: YearOfFoodMonth }) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const empty = m.status !== 'fresh';
  const label = [
    m.freshVeg.length ? inlineTemplate(lang, m.freshVeg.length === 1 ? '{n} crop kind ready to pick' : '{n} crop kinds ready to pick', null, { n: m.freshVeg.length }) : null,
    m.storedVeg.length ? inlineTemplate(lang, m.storedVeg.length === 1 ? '{n} stored crop kind' : '{n} stored crop kinds', null, { n: m.storedVeg.length }) : null,
    m.fruit.length ? inlineTemplate(lang, m.fruit.length === 1 ? '{n} fruit tree kind' : '{n} fruit tree kinds', null, { n: m.fruit.length }) : null,
    ...m.animalProducts.map((p) => inlineText(lang, PRODUCT_LABEL[p]).toLowerCase()),
  ].filter(Boolean).join(', ');
  return (
    <li
      className="rounded-lg flex flex-col items-center gap-1 py-2 px-1"
      style={{
        minWidth: 0,
        background: empty ? 'transparent' : 'var(--bg-2)',
        border: empty ? '1.5px dashed var(--gold)' : '1px solid var(--border)',
      }}
      aria-label={`${monthName(m.month)}: ${label || ui('nothing')}${m.status === 'stored-only' ? `, ${ui('nothing fresh')}` : ''}`}
      data-year-of-food-month={m.month}
      data-status={m.status}
    >
      <span className="font-display font-semibold" style={{ fontSize: 'clamp(13px, 1vw, 15px)', color: empty ? 'var(--gold-dim)' : 'var(--text-primary)' }}>
        {monthName(m.month)}
      </span>
      <span className="inline-flex flex-wrap items-center justify-center gap-1 font-sans" style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minHeight: 14 }} aria-hidden>
        {m.freshVeg.length > 0 && <span className="inline-flex items-center gap-0.5"><Sprout size={11} style={{ color: 'var(--emerald)' }} />{m.freshVeg.length}</span>}
        {m.fruit.length > 0 && <Trees size={11} style={{ color: 'var(--emerald)' }} />}
        {m.animalProducts.map((p) => {
          const Icon = PRODUCT_ICON[p];
          return <Icon key={p} size={11} style={{ color: 'var(--gold-dim)' }} />;
        })}
        {m.storedVeg.length > 0 && <Package size={11} style={{ color: 'var(--text-muted)' }} />}
        {m.status === 'empty' && <span style={{ color: 'var(--gold-dim)' }}>–</span>}
      </span>
    </li>
  );
}

function SuggestionRow({ s, onPlan }: { s: GapFillSuggestion; onPlan: (s: GapFillSuggestion) => void }) {
  const { lang } = useLanguage();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 py-1.5" style={{ borderTop: '1px solid var(--border)' }} data-gap-fill-suggestion={s.crop.key}>
      <div className="font-sans flex-1" style={{ minWidth: 180, fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.crop.name}</span>
        {' '}{inlineTemplate(lang, '· sow {month} in {bed} ({share}) · picking {span}', null, { month: monthName(s.sowMonth), bed: s.bed.label, share: shareLabel(s.areaFraction, lang), span: monthSpanText(lang, s.freshMonths) })}
      </div>
      <button
        type="button"
        onClick={() => onPlan(s)}
        className="font-sans font-semibold rounded-lg"
        style={{ fontSize: 12, padding: '5px 12px', cursor: 'pointer', background: '#1F4D2B', color: '#F7F2E9', border: 'none' }}
        aria-label={inlineTemplate(lang, 'Plan {crop}, sown in {month} in {bed}', null, { crop: s.crop.name, month: monthName(s.sowMonth), bed: s.bed.label })}
      >
        {inlineText(lang, 'Plan it')}
      </button>
    </li>
  );
}

const SHOWN_GAP_MONTHS = 4;

/**
 * The year of food: twelve months, every source the chart carries, and sowings that would fill
 * the months with no fresh crop. Reads the chart's own slots (lib/year-of-food.ts), so it
 * follows the chart's year mode and its tree and animal switches.
 */
export default function YearOfFoodCard({ year, gapFills, yearMode, hasBeds, climateKnown, onPlan }: {
  year: YearOfFood;
  gapFills: GapFillMonth[];
  yearMode: 'established' | 'fromToday';
  hasBeds: boolean;
  climateKnown: boolean;
  onPlan: (s: GapFillSuggestion) => void;
}) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const [showAll, setShowAll] = useState(false);
  const byMonth = new Map(year.months.map((m) => [m.month, m]));
  const hungry = year.hungryMonths;
  const summary = hungry.length === 0
    ? ui('Something fresh in all 12 months.')
    : inlineTemplate(lang, 'Something fresh in {n} of 12 months; nothing fresh in {span}.', null, { n: year.freshCount, span: formatMonthSpan(hungry) });
  const shown = showAll ? gapFills : gapFills.slice(0, SHOWN_GAP_MONTHS);

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-year-of-food>
      <div className="font-display font-semibold mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 'clamp(15px, 1.15vw, 17px)', color: 'var(--text-primary)' }}>
        <CalendarRange size={14} aria-hidden /> {ui('Year of food')}
      </div>
      <p className="font-sans mb-1" style={{ fontSize: 'clamp(13px, 1vw, 14px)', color: 'var(--text-primary)', lineHeight: 1.45 }} data-year-of-food-summary>
        {summary}
      </p>
      <p className="font-sans mb-3" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
        {yearMode === 'established'
          ? ui('The plan as it repeats each year, beds, trees and animals together — the rows switched on in the chart above.')
          : ui('The next 12 months from today, beds, trees and animals together — the rows switched on in the chart above.')}{' '}
        {ui('This shows whether food comes in, not whether it is enough. Availability bars count crop kinds, not kilograms.')}
      </p>

      <ol className="grid gap-1.5 grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 mb-2" style={{ listStyle: 'none', padding: 0 }}>
        {year.months.map((m) => <MonthCell key={m.slot} m={m} />)}
      </ol>
      <div className="font-sans flex flex-wrap gap-x-3 gap-y-1 mb-4" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        <span className="inline-flex items-center gap-1"><Sprout size={11} aria-hidden style={{ color: 'var(--emerald)' }} /> {ui('fresh vegetables & staples')}</span>
        <span className="inline-flex items-center gap-1"><Trees size={11} aria-hidden style={{ color: 'var(--emerald)' }} /> {ui('fruit')}</span>
        <span className="inline-flex items-center gap-1"><PRODUCT_ICON.eggs size={11} aria-hidden style={{ color: 'var(--gold-dim)' }} /> {ui('animal products')}</span>
        <span className="inline-flex items-center gap-1"><Package size={11} aria-hidden /> {ui('in store only')}</span>
      </div>

      {gapFills.length > 0 && (
        <section data-gap-fills>
          <div className="font-sans font-semibold mb-1 inline-flex items-center gap-1.5" style={{ fontSize: 13.5, color: 'var(--text-primary)' }}>
            <WandSparkles size={13} aria-hidden /> {ui('Fill the months with no fresh crop')}
          </div>
          <p className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
            {climateKnown
              ? ui("Sowings in this region's usual window that your site’s temperatures allow, on a bed with room over the crop's months.")
              : ui("Sowings in this region's usual window, on a bed with room over the crop's months.")}{' '}
            {ui('“Plan it” opens the normal planting form so you can check it first.')}
          </p>
          {!hasBeds && (
            <p className="font-sans mb-2" style={{ fontSize: 12, color: 'var(--gold-dim)' }}>
              <TriangleAlert size={12} aria-hidden style={{ display: 'inline', verticalAlign: '-2px' }} /> {ui('No veg bed is mapped yet, so there is nowhere to suggest a sowing. Draw a bed on the map.')}
            </p>
          )}
          <div className="flex flex-col gap-3">
            {shown.map((g) => {
              const m = byMonth.get(g.targetMonth)!;
              const cover = otherCover(m, lang);
              return (
                <div key={g.targetMonth} data-gap-fill-month={g.targetMonth}>
                  <div className="font-sans" style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>
                    <span className="font-semibold">{monthName(g.targetMonth)}</span>
                    <span style={{ color: g.hungry ? 'var(--gold-dim)' : 'var(--text-muted)' }}>
                      {' '}— {g.hungry ? ui('nothing fresh at all') : `${ui('no fresh crop')}${cover ? ` (${cover})` : ''}`}
                    </span>
                  </div>
                  {g.suggestions.length > 0 ? (
                    <ul style={{ listStyle: 'none', padding: 0, margin: '4px 0 0' }}>
                      {g.suggestions.map((s) => <SuggestionRow key={`${s.crop.key}-${s.sowMonth}`} s={s} onPlan={onPlan} />)}
                    </ul>
                  ) : hasBeds ? (
                    <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.45 }}>
                      {g.noRoomCropNames.length > 0
                        ? inlineTemplate(lang, '{names} could pick then, but no bed has room over those months. Free a bed or map another.', null, { names: `${g.noRoomCropNames.slice(0, 4).join(', ')}${g.noRoomCropNames.length > 4 ? ` ${ui('and others')}` : ''}` })
                        : climateKnown
                          ? ui('No crop with sourced timing picks in this month from a sowing in this region’s window and your site’s temperatures.')
                          : ui('No crop with sourced timing picks in this month from a sowing in this region’s window.')}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
          {gapFills.length > SHOWN_GAP_MONTHS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="font-sans font-semibold mt-3"
              style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {showAll ? ui('Show fewer months') : inlineTemplate(lang, gapFills.length - SHOWN_GAP_MONTHS === 1 ? 'Show {n} more month' : 'Show {n} more months', null, { n: gapFills.length - SHOWN_GAP_MONTHS })}
            </button>
          )}
        </section>
      )}
    </div>
  );
}

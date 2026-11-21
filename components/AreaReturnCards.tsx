'use client';
import { numberLabel } from '@/lib/format-figures';
import { useEffect, useMemo, useState } from 'react';
import type { PlanBed } from '@/lib/crop-plan';
import type { ExpenseLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import type { FinancePeriod } from '@/lib/farm-metrics';
import { invoiceRandReviewMessage } from '@/lib/invoice-sales';
import { buildAreaReturns } from '@/lib/area-returns';
import { useLanguage } from '@/lib/i18n';
import IsiZuluDraftSource from '@/components/IsiZuluDraftSource';
import { recordsFill, recordsTemplate } from '@/lib/records-regional-drafts';
import { prefersReducedMotion, useInViewOnce, type InViewPhase } from '@/lib/use-in-view-once';
import styles from './AreaReturnCards.module.css';

// Sales and costs bars land over BAR_MS; the contribution figure counts over the same span.
const COUNT_MS = 700;
// Each card starts a little after the one before it: three cards, about 200 ms in all.
const CARD_STAGGER_MS = 100;

/** Counts 0 -> target while the cards play and always ends on the exact target. Server render, the
 *  first client render, reduced motion and a null target all show the real value straight away. */
function useCountUp(target: number | null, phase: InViewPhase, delayMs: number): number | null {
  const [value, setValue] = useState<number | null>(target);
  useEffect(() => {
    if (target === null) { setValue(null); return; }
    if (phase === 'armed') { setValue(0); return; }
    if (phase !== 'play' || prefersReducedMotion()) { setValue(target); return; }
    let raf = 0;
    const start = performance.now() + delayMs;
    setValue(0);
    const step = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - start) / COUNT_MS));
      setValue(p >= 1 ? target : target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [phase, target, delayMs]);
  return phase === 'final' ? target : value;
}

export default function AreaReturnCards({ beds, sales, expenses, invoices, period, now, loading }: { beds: PlanBed[]; sales: SalesLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; period: FinancePeriod; now: Date; loading: boolean; sample?: boolean }) {
  const { lang } = useLanguage();
  const text = (en: string, zu: string) => lang === 'zu' ? zu : recordsFill(lang, en);
  const result = useMemo(() => buildAreaReturns(beds, sales, expenses, invoices, period, now), [beds, sales, expenses, invoices, period, now]);
  const rand = (n: number | null) => n === null ? 'Unavailable' : `R ${numberLabel(n, 2)}`;
  // The three stacked cards are taller than 80% of a phone screen, so a 0.2 threshold could never fire.
  const { ref: gridRef, phase } = useInViewOnce<HTMLDivElement>({ threshold: 0, rootMargin: '0px 0px -25% 0px' });
  return <section aria-label={text('Returns per growing area', 'Imali etholwa endaweni yokulima')} className="record-paper my-6 rounded-2xl border p-5" style={{ background: 'var(--bg-1)', borderColor: 'var(--border)', color: 'var(--text-primary)' }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-semibold">{text('What your growing space returns', 'Imali etholwa endaweni yakho yokulima')}</h2><span className="text-sm">{period === 'month' ? text('This month', 'Le nyanga') : period === 'season' ? text('This season', 'Le sizini') : text('This calendar year', 'Lo nyaka wekhalenda')} · {now.getFullYear()}</span></div>
    <IsiZuluDraftSource className="text-sm mt-2 mb-4" lang={lang}
      english="Recorded sales minus assigned costs, per mapped m². Compare the same period and area over time."
      zulu="Imali etholwe ngokuthengisa okurekhodiwe kususwe izindleko ezabelwe leyo ndawo, ngemitha-skwele ebalwe emephini. Qhathanisa inkathi nendawo efanayo ngokuhamba kwesikhathi." />
    {result.moneyReview.status === 'held' && <p role="status" className="text-sm my-3">{invoiceRandReviewMessage(result.moneyReview)}</p>}
    <div ref={gridRef} className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${phase === 'armed' ? styles.armed : phase === 'play' ? styles.play : ''}`}>{result.cards.map((card, index) => <article key={card.key} style={{ ['--card' as string]: index, background: 'var(--bg-2)', borderColor: 'var(--border)' }} className="rounded-xl border p-4">
      <h3 className="text-sm font-semibold">{text(({ vegetables: 'Vegetable beds', staples: 'Staple plots', combined: 'Combined' })[card.key], ({ vegetables: 'Imibhede yemifino', staples: 'Amasimu ezitshalo eziyisisekelo', combined: 'Kuhlanganisiwe' })[card.key])}</h3>
      <p className="text-3xl font-display font-semibold my-3" style={{ color: card.contributionPerM2 !== null && card.contributionPerM2 < 0 ? 'var(--danger)' : 'var(--color-forest-800)' }}><CountedRand value={loading ? null : card.contributionPerM2} loading={loading} phase={phase} delayMs={index * CARD_STAGGER_MS} rand={rand} /> <span className="text-sm">/m²</span></p>
      {!loading && card.sales !== null && card.entries > 0 && card.moneyReview.status !== 'held' && (card.sales > 0 || card.costs > 0) && <SalesCostsBars sales={card.sales} costs={card.costs} salesLabel={text('Sales', 'Okudayisiwe')} costsLabel={text('Costs', 'Izindleko')} />}
      <p className="text-xs">{lang === 'zu' ? <>{numberLabel(card.areaM2)} m² ebalazweni · {card.entries} okufakiwe okwabelwe indawo</> : recordsTemplate(lang, '{area} m² mapped · {n} assigned entries', null, { area: numberLabel(card.areaM2), n: card.entries })}</p>
      {!loading && <p className="text-xs mt-2">{card.moneyReview.status === 'held' ? 'Sales and contribution unavailable pending currency review.' : card.entries ? (lang === 'zu' ? `${rand(card.sales)} okudayisiwe · ${rand(card.costs)} izindleko` : recordsTemplate(lang, '{sales} sales · {costs} costs', null, { sales: rand(card.sales), costs: rand(card.costs) })) : text('Assign sales and costs to see a result.', 'Yabela okudayisiwe nezindleko ukuze ubone umphumela.')}</p>}
    </article>)}</div>
    <IsiZuluDraftSource className="text-sm mt-4" lang={lang}
      template={result.unassignedEntries ? '{n} entries still unassigned: {sales} sales and {costs} costs. Edit a Sold or Spent entry and choose its growing area.' : undefined}
      vars={{ n: result.unassignedEntries, sales: rand(result.unassignedSales), costs: rand(result.unassignedCosts) }}
      english={result.unassignedEntries
        ? `${result.unassignedEntries} entries still unassigned: ${rand(result.unassignedSales)} sales and ${rand(result.unassignedCosts)} costs. Edit a Sold or Spent entry and choose its growing area.`
        : 'Only explicitly assigned entries are included.'}
      zulu={result.unassignedEntries
        ? `${result.unassignedEntries} okufakile akukabelwa indawo: ukuthengisa okungu-${rand(result.unassignedSales)} nezindleko ezingu-${rand(result.unassignedCosts)}. Hlela okufakile ngaphansi kwe-Sold noma i-Spent, bese ukhetha indawo yakho yokulima.`
        : 'Kubalwa okufakile kuphela okwabelwe indawo ngokusobala.'} />
    <IsiZuluDraftSource className="text-xs mt-2" lang={lang}
      template="Shared costs ({shared}) reduce Combined only. Orchard and other activities stay separate. These figures exclude unassigned costs and may omit overheads or labour; they are not full net profit. The denominator is today’s mapped area, not a historical measurement or harvested area."
      vars={{ shared: rand(result.sharedCosts) }}
      english={`Shared costs (${rand(result.sharedCosts)}) reduce Combined only. Orchard and other activities stay separate. These figures exclude unassigned costs and may omit overheads or labour; they are not full net profit. The denominator is today’s mapped area, not a historical measurement or harvested area.`}
      zulu={`Izindleko ezabiwe (${rand(result.sharedCosts)}) zehlisa isamba esihlanganisiwe kuphela. Ingadi yezithelo neminye imisebenzi kubalwa ngokwehlukana. Lezi zibalo azifaki izindleko ezingabelwe indawo futhi zingase zingafaki izindleko ezijwayelekile noma umsebenzi; azimeleli yonke inzuzo ngemva kwezindleko. Indawo ehlukanisa lezi zibalo yileyo ebalwe emephini namuhla, hhayi isilinganiso sakudala noma indawo evuniwe.`} />
  </section>;
}

/** The contribution figure. Null (held, no mapped area, no entries) never animates: it shows the
 *  same dash or ellipsis the card showed before. */
function CountedRand({ value, loading, phase, delayMs, rand }: { value: number | null; loading: boolean; phase: InViewPhase; delayMs: number; rand: (n: number | null) => string }) {
  const shown = useCountUp(value, phase, delayMs);
  if (loading) return <>…</>;
  if (value === null || shown === null) return <>—</>;
  return <span className={styles.figure}>{rand(shown === value ? value : shown)}</span>;
}

/** Two bars on one shared scale, sales then costs, growing up from the same baseline. Purely a
 *  picture of the two figures printed under it, so it is hidden from screen readers. */
function SalesCostsBars({ sales, costs, salesLabel, costsLabel }: { sales: number; costs: number; salesLabel: string; costsLabel: string }) {
  const top = Math.max(sales, costs);
  const pct = (n: number) => `${Math.max(0, (n / top) * 100)}%`;
  return <div className={styles.bars} aria-hidden="true">
    <div className={styles.barCol}>
      <div className={styles.track}>{sales > 0 && <span className={`${styles.bar} ${styles.barSales}`} style={{ height: pct(sales) }} />}</div>
      <span className={styles.barLabel}>{salesLabel}</span>
    </div>
    <div className={styles.barCol}>
      <div className={styles.track}>{costs > 0 && <span className={`${styles.bar} ${styles.barCosts}`} style={{ height: pct(costs), ['--bar' as string]: 1 }} />}</div>
      <span className={styles.barLabel}>{costsLabel}</span>
    </div>
  </div>;
}

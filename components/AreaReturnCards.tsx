'use client';
import { useMemo } from 'react';
import type { PlanBed } from '@/lib/crop-plan';
import type { ExpenseLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import type { FinancePeriod } from '@/lib/farm-metrics';
import { buildAreaReturns } from '@/lib/area-returns';
import { useLanguage } from '@/lib/i18n';

export default function AreaReturnCards({ beds, sales, expenses, invoices, period, now, loading }: { beds: PlanBed[]; sales: SalesLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; period: FinancePeriod; now: Date; loading: boolean; sample?: boolean }) {
  const { lang } = useLanguage();
  const text = (en: string, zu: string) => lang === 'zu' ? zu : en;
  const result = useMemo(() => buildAreaReturns(beds, sales, expenses, invoices, period, now), [beds, sales, expenses, invoices, period, now]);
  const rand = (n: number) => `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
  return <section aria-label={text('Returns per growing area', 'Imali etholwa endaweni yokulima')} className="record-paper my-6 rounded-2xl border p-5" style={{ background: '#FFFEFA', borderColor: '#d2c7b5', color: '#263b2d' }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-semibold">{text('What your growing space returns', 'Imali etholwa endaweni yakho yokulima')}</h2><span className="text-sm">{period === 'month' ? text('This month', 'Le nyanga') : period === 'season' ? text('This season', 'Le sizini') : text('This calendar year', 'Lo nyaka wekhalenda')} · {now.getFullYear()}</span></div>
    <p className="text-sm mt-2 mb-4">{text('Recorded sales minus assigned costs, per mapped m². Compare the same period and area over time.', 'Incazelo enemininingwane ngesiNgisi: Recorded sales minus assigned costs, per mapped m². Compare the same period and area over time.')}</p>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{result.cards.map(card => <article key={card.key} className="rounded-xl border p-4" style={{ background: '#f1ede3', borderColor: '#d2c7b5' }}>
      <h3 className="text-sm font-semibold">{text(({ vegetables: 'Vegetable beds', staples: 'Staple plots', combined: 'Combined' })[card.key], ({ vegetables: 'Imibhede yemifino', staples: 'Amasimu ezitshalo eziyisisekelo', combined: 'Kuhlanganisiwe' })[card.key])}</h3>
      <p className="text-3xl font-display font-semibold my-3" style={{ color: card.contributionPerM2 !== null && card.contributionPerM2 < 0 ? '#9a312b' : '#245d35' }}>{loading ? '…' : card.contributionPerM2 === null ? '—' : rand(card.contributionPerM2)} <span className="text-sm">/m²</span></p>
      <p className="text-xs">{card.areaM2.toLocaleString('en-ZA')} m² {text('mapped', 'ebalazweni')} · {card.entries} {text('assigned entries', 'okufakiwe okwabelwe indawo')}</p>
      {!loading && <p className="text-xs mt-2">{card.entries ? `${rand(card.sales)} ${text('sales', 'okudayisiwe')} · ${rand(card.costs)} ${text('costs', 'izindleko')}` : text('Assign sales and costs to see a result.', 'Yabela okudayisiwe nezindleko ukuze ubone umphumela.')}</p>}
    </article>)}</div>
    <p className="text-sm mt-4">{text(result.unassignedEntries ? `${result.unassignedEntries} entries still unassigned: ${rand(result.unassignedSales)} sales and ${rand(result.unassignedCosts)} costs. Edit a Sold or Spent entry and choose its growing area.` : 'Only explicitly assigned entries are included.', result.unassignedEntries ? 'Incazelo enemininingwane ngesiNgisi: Some entries are still unassigned. Edit a Sold or Spent entry and choose its growing area.' : 'Incazelo enemininingwane ngesiNgisi: Only explicitly assigned entries are included.')}</p>
    <p className="text-xs mt-2">{text('Shared costs ({amount}) reduce Combined only. Orchard and other activities stay separate. These figures exclude unassigned costs and may omit overheads or labour; they are not full net profit. The denominator is today’s mapped area, not a historical measurement or harvested area.'.replace('{amount}', rand(result.sharedCosts)), `Incazelo enemininingwane ngesiNgisi: Shared costs (${rand(result.sharedCosts)}) reduce Combined only. Orchard and other activities stay separate. These figures exclude unassigned costs and may omit overheads or labour; they are not full net profit. The denominator is today’s mapped area, not a historical measurement or harvested area.`)}</p>
  </section>;
}

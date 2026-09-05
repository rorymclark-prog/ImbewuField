'use client';
import { useMemo } from 'react';
import type { PlanBed } from '@/lib/crop-plan';
import type { ExpenseLog, SalesLog } from '@/lib/db/types';
import type { SavedInvoice } from '@/lib/invoices';
import type { FinancePeriod } from '@/lib/farm-metrics';
import { buildAreaReturns } from '@/lib/area-returns';

export default function AreaReturnCards({ beds, sales, expenses, invoices, period, now, loading, sample = false }: { beds: PlanBed[]; sales: SalesLog[]; expenses: ExpenseLog[]; invoices: SavedInvoice[]; period: FinancePeriod; now: Date; loading: boolean; sample?: boolean }) {
  const result = useMemo(() => buildAreaReturns(beds, sales, expenses, invoices, period, now), [beds, sales, expenses, invoices, period, now]);
  const rand = (n: number) => `R ${n.toLocaleString('en-ZA', { maximumFractionDigits: 2 })}`;
  return <section aria-label="Returns per growing area" className="my-6 rounded-2xl border p-5" style={{ background: 'var(--color-card)', borderColor: 'var(--color-hairline)', color: 'var(--color-ink)' }}>
    <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className="font-display text-xl font-semibold">What your growing space returns</h2><span className="text-sm">{period === 'month' ? 'This month' : period === 'season' ? 'This season' : 'This calendar year'} · {now.getFullYear()}</span></div>
    <p className="text-sm mt-2 mb-4">Recorded sales minus assigned costs, per mapped m². Compare the same period and area over time.</p>
    {sample && <p className="text-sm mb-4">Illustrative sample transactions, using the mapped growing areas. Bed sales follow the sample crop plan; staple plots show preparation costs, with no harvest sales yet. These are not actual Ubhejane results or forecasts.</p>}
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{result.cards.map(card => <article key={card.key} className="rounded-xl border p-4" style={{ background: 'var(--color-canvas)', borderColor: 'var(--color-hairline)' }}>
      <h3 className="text-sm font-semibold">{({ vegetables: 'Vegetable beds', staples: 'Staple plots', combined: 'Combined' })[card.key]}</h3>
      <p className="text-3xl font-display font-semibold my-3" style={{ color: card.contributionPerM2 !== null && card.contributionPerM2 < 0 ? 'var(--color-ink)' : 'var(--color-forest-800)' }}>{loading ? '…' : card.contributionPerM2 === null ? '—' : rand(card.contributionPerM2)} <span className="text-sm">/m²</span></p>
      <p className="text-xs">{card.areaM2.toLocaleString('en-ZA')} m² mapped · {card.entries} assigned entries</p>
      {!loading && <p className="text-xs mt-2">{card.entries ? `${rand(card.sales)} sales · ${rand(card.costs)} costs` : 'Assign sales and costs to see a result.'}</p>}
    </article>)}</div>
    <p className="text-sm mt-4">{result.unassignedEntries ? `${result.unassignedEntries} entries still unassigned: ${rand(result.unassignedSales)} sales and ${rand(result.unassignedCosts)} costs. Edit a Sold or Spent entry and choose its growing area.` : 'Only explicitly assigned entries are included.'}</p>
    <p className="text-xs mt-2">Shared costs ({rand(result.sharedCosts)}) reduce Combined only. Orchard and other activities stay separate. These figures exclude unassigned costs and may omit overheads or labour; they are not full net profit. The denominator is today’s mapped area, not a historical measurement or harvested area.</p>
  </section>;
}

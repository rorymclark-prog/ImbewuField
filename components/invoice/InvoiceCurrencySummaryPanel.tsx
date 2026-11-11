'use client';

import { useRef, useState } from 'react';
import { INVOICE_PILOT_CURRENCIES, inspectInvoiceCurrencyBasis, type InvoicePilotCurrency } from '@/lib/invoice-currency';
import { invoiceCurrencySummary } from '@/lib/invoice-currency-summary';
import { formatRecordedMoney, formattingContext } from '@/lib/international/locales/formatting';
import { useInvoiceReadSource } from './useInvoiceBookSource';

/** Saved invoice amounts stay separate from the cash ledger and its Rand
 * reconciliation. No currency is inferred from the account or interface. */
export default function InvoiceCurrencySummaryPanel({ language = 'en' }: { language?: string }) {
  const source = useInvoiceReadSource();
  const intent = useRef<object>({}), renderedIntent = intent.current;
  const [, publishIntent] = useState<object>({});
  const [selection, setSelection] = useState<{ currency: InvoicePilotCurrency; epoch: number; view: object } | null>(null);
  const view = source.view;
  const current = source.isCurrent();
  const selected = current && selection && selection.epoch === source.epoch && selection.view === view ? selection.currency : '';
  const summary = current && view && view.status !== 'held' && selected
    ? invoiceCurrencySummary(view.invoices, selected) : null;

  function chooseCurrency(value: string) {
    if (intent.current !== renderedIntent || !source.isCurrent() || !view || view.status === 'held') return;
    const basis = inspectInvoiceCurrencyBasis({ currencyCode: value });
    if (value && basis.status !== 'recorded') return;
    intent.current = {}; publishIntent({});
    setSelection(value && basis.status === 'recorded' ? { currency: basis.currency, epoch: source.epoch, view } : null);
  }
  function refresh() {
    if (intent.current !== renderedIntent || !source.isActorCurrent()) return;
    intent.current = {}; publishIntent({});
    source.reload();
    setSelection(null);
  }
  const money = (amount: number, currency: string) => formatRecordedMoney({ amount, currency }, formattingContext(language))?.text ?? 'Amount unavailable';
  const held = !current || summary?.status === 'held';

  return (
    <section lang="en" aria-label="Saved invoice currency summary" className="space-y-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--text-primary)' }}>
      <h3 className="font-display text-base font-semibold">Saved invoice currency summary</h3>
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Saved invoices on this device, across all loaded dates. Choose one currency to view its recorded amounts.</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block">Summary currency</span>
          <select aria-label="Summary currency" value={selected} disabled={!current}
            onChange={event => chooseCurrency(event.target.value)}
            className="min-h-11 w-full rounded-lg border px-3 py-2" style={{ borderColor: 'var(--border)', background: 'var(--bg-1)', color: 'var(--text-primary)' }}>
            <option value="">Choose currency</option>
            {INVOICE_PILOT_CURRENCIES.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <button type="button" onClick={refresh} disabled={!source.isActorCurrent()} className="min-h-11 rounded-lg border px-3 py-2 text-sm" style={{ borderColor: 'var(--border)' }}>Refresh saved invoices</button>
      </div>
      {view?.status === 'sample' && <p role="note" className="text-sm font-semibold">DEMO — these are sample invoice amounts.</p>}
      {held ? <p role="status" className="text-sm">Saved invoice records changed or need review. Totals are unavailable. Refresh the current records before choosing a currency.</p>
        : !selected ? <p role="status" className="text-sm">Choose a currency to view invoice counts and amounts.</p>
          : summary?.status === 'ready' && (
            <dl className="grid gap-3 sm:grid-cols-3">
              {([
                ['Issued invoices', summary.issued],
                ['Recorded paid invoices', summary.recordedPaid],
                ['Unpaid invoices', summary.unpaid],
              ] as const).map(([label, total]) => (
                <div key={label} className="min-w-0 rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                  <dt className="text-sm font-semibold">{label}</dt>
                  <dd className="break-words text-lg">{money(total.total, summary.currencyCode)}</dd>
                  <dd className="text-sm">{total.count} invoice(s)</dd>
                </div>
              ))}
            </dl>
          )}
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Invoice-only amounts exclude pending link drafts, external sales records and costs. Recorded paid reflects the saved invoice status; it is not proof of bank receipt, cash income or profit. No currency conversion is made.</p>
    </section>
  );
}

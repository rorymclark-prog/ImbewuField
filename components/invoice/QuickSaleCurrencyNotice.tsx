import React, { type ReactElement } from 'react';
import Link from 'next/link';
import { INVOICE_PILOT_CURRENCIES } from '../../lib/invoice-currency.ts';

// Legacy quick-sale forms write rand. Reuse the existing invoice editor for another currency instead of relabelling amounts.
export default function QuickSaleCurrencyNotice(): ReactElement {
  const otherCurrencies = INVOICE_PILOT_CURRENCIES.filter((code) => code !== 'ZAR').join(', ');

  return (
    <div
      lang="en"
      role="note"
      className="text-sm leading-relaxed"
      style={{
        padding: '12px 14px',
        borderRadius: '6px',
        backgroundColor: 'var(--bg-1)',
        border: '1px solid var(--border)',
        color: 'var(--text-secondary)',
        fontFamily: 'var(--font-sans, system-ui, sans-serif)',
      }}
    >
      <p style={{ margin: 0, color: 'var(--text-primary)', fontWeight: 500 }}>
        This quick sale records South African rand (ZAR).
      </p>
      <p style={{ margin: '4px 0 0 0' }}>
        Other supported invoice currencies: {otherCurrencies}.
      </p>
      <div style={{ marginTop: '10px' }}>
        <Link
          href="/invoice?mode=sale"
          className="min-h-11 text-sm inline-flex items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          style={{
            fontWeight: 600,
            color: 'var(--text-primary)',
            textDecoration: 'underline',
          }}
        >
          Record a sale in another currency
        </Link>
      </div>
      <p style={{ margin: '6px 0 0 0', color: 'var(--text-secondary)' }}>
        This opens a separate form. Enter the sale there; this quick-sale draft is not transferred.
      </p>
    </div>
  );
}

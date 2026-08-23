/**
 * The invoice as it appears on screen and, via `window.print()`, on paper.
 *
 * It renders `InvoiceDocument` and computes nothing. Every string here comes from
 * `buildInvoiceDocument()`, which the PDF writer also consumes — see the header comment in
 * `lib/invoice-document.ts` for why the two renderers are not allowed their own arithmetic.
 *
 * Print behaviour lives in `app/invoice/print.css`, keyed off `#invoice-doc`. On screen this is
 * a card in a 28rem column; on A4 it is the whole page. Both used to be true at once, which is
 * why printing produced a narrow strip of invoice floating in a full page of beige.
 */

import type { InvoiceDocument } from '@/lib/invoice-document';

function Sprout() {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EAF3E2"
      strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      <path d="M12 21V11" />
      <path d="M12 11c0-3.5-2.5-6-6.5-6 0 4 2.5 6 6.5 6Z" />
      <path d="M12 13c0-3 2.2-5.2 6-5.2 0 3.6-2.2 5.2-6 5.2Z" />
    </svg>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="invoice-label text-xs font-sans uppercase mb-1"
      style={{ color: '#8C7A62', letterSpacing: '0.1em' }}
    >
      {children}
    </div>
  );
}

export default function InvoiceDocumentView({ doc }: { doc: InvoiceDocument }) {
  return (
    <div id="invoice-doc" className="rounded-2xl p-5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>

      {/* Seller letterhead. The enterprise logo, when the farmer has set one, leads on the
          left the way a letterhead reads. With no logo there is no empty slot — the app's own
          mark sits on the right instead, so an unbranded invoice looks finished rather than
          like a business that failed to upload something. */}
      <div className="invoice-head flex items-start justify-between gap-3.5 mb-4">
        <div className="flex items-start gap-3 min-w-0">
          {doc.sellerLogo && (
            /* eslint-disable-next-line @next/next/no-img-element -- a data URL the farmer
               supplied; next/image cannot optimise it and would only add a loader. */
            <img
              className="invoice-logo flex-shrink-0 rounded-lg object-contain"
              src={doc.sellerLogo}
              alt=""
              style={{ width: 52, height: 52, background: '#fff' }}
            />
          )}
          <div className="min-w-0">
            <div className="invoice-seller-name font-display font-bold text-xl" style={{ color: '#20190F', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
              {doc.sellerName || <span style={{ color: '#B8AC97' }}>Your business name</span>}
            </div>
            {doc.sellerLines.map((line) => (
              <div key={line} className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>{line}</div>
            ))}
          </div>
        </div>
        {!doc.sellerLogo && (
          <div
            className="invoice-mark flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 40, height: 40, background: '#1F4D2B' }}
          >
            <Sprout />
          </div>
        )}
      </div>

      {/* Invoice number, dates, buyer reference */}
      <div
        className="invoice-meta flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5"
        style={{ borderTop: '1px solid #E2D8C4', borderBottom: '1px solid #E2D8C4' }}
      >
        <span className="text-xs font-sans font-semibold" style={{ color: '#20190F' }}>Invoice {doc.number}</span>
        <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Issued {doc.issuedLabel}</span>
        {doc.dueLabel && (
          <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Due {doc.dueLabel}</span>
        )}
        {doc.referenceLabel && (
          <span className="text-xs font-sans" style={{ color: '#8C7A62' }}>Your ref {doc.referenceLabel}</span>
        )}
      </div>

      {/* Bill to */}
      <div className="mt-3.5">
        <Label>Bill to</Label>
        <div className="font-display text-sm" style={{ color: doc.buyerName ? '#20190F' : '#B8AC97' }}>
          {doc.buyerName || 'Buyer name'}
        </div>
        {doc.buyerLines.map((line) => (
          <div key={line} className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>{line}</div>
        ))}
      </div>

      {/* Line items */}
      <div className="invoice-rows mt-4">
        <div
          className="invoice-rows-head flex items-baseline justify-between pb-1.5 text-xs font-sans uppercase"
          style={{ color: '#8C7A62', letterSpacing: '0.08em', borderBottom: '1px solid #E2D8C4' }}
        >
          <span>Item</span><span>Amount</span>
        </div>
        {doc.rows.length === 0 ? (
          <div className="py-3 text-sm font-display" style={{ color: '#B8AC97' }}>No items yet</div>
        ) : doc.rows.map((row, index) => (
          <div
            key={`${row.desc}-${index}`}
            className="invoice-row flex items-baseline justify-between gap-3 py-2"
            style={{ borderBottom: '1px solid #F0E9DC' }}
          >
            <div className="min-w-0">
              <div className="font-display text-sm" style={{ color: '#20190F' }}>{row.desc}</div>
              <div className="text-xs font-sans mt-0.5" style={{ color: '#8C7A62' }}>{row.detail}</div>
            </div>
            <div
              className="font-display text-sm font-semibold tabular-nums flex-shrink-0"
              style={{ color: '#20190F' }}
            >
              {row.amount}
            </div>
          </div>
        ))}
      </div>

      {/* Total — the one number the buyer is looking for, so it gets its own tinted band
          rather than sitting as one more row in the list. */}
      <div
        className="invoice-total-band flex items-center justify-between mt-3 px-3 py-2.5 rounded-lg"
        style={{ background: 'rgba(31,77,43,0.07)', borderTop: '2px solid #1F4D2B' }}
      >
        <span className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>Total due</span>
        <span className="invoice-total font-display font-bold text-2xl tabular-nums" style={{ color: '#1F4D2B', letterSpacing: '-0.01em' }}>
          {doc.totalLabel}
        </span>
      </div>

      {doc.paidStamp && (
        <div
          className="invoice-paid inline-block mt-3 px-2.5 py-1 rounded-full text-xs font-sans font-semibold"
          style={{ background: 'rgba(46,107,58,0.12)', border: '1px solid rgba(46,107,58,0.35)', color: '#2E6B3A' }}
        >
          {doc.paidStamp}
        </div>
      )}

      {/* How to pay — omitted entirely when the farmer has entered no banking details, because an
          empty "How to pay" heading tells a buyer less than no heading at all. */}
      {doc.bankingLines.length > 0 && (
        <div className="invoice-pay mt-4 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
          <Label>How to pay</Label>
          {doc.bankingLines.map((line) => (
            <div key={line} className="text-xs font-sans" style={{ color: '#20190F' }}>{line}</div>
          ))}
        </div>
      )}

      {doc.notes && (
        <div className="invoice-notes mt-3 text-xs font-sans whitespace-pre-line" style={{ color: '#5C5040' }}>
          {doc.notes}
        </div>
      )}

      <div className="invoice-footer text-center text-xs font-sans mt-6" style={{ color: '#8C7A62' }}>
        {doc.footer}
      </div>
    </div>
  );
}

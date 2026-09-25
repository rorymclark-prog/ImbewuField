/**
 * The invoice as it appears on screen and, via `window.print()`, on paper.
 *
 * It renders `InvoiceDocument` and computes nothing. Every string here comes from
 * `buildInvoiceDocument()`, which the PDF writer also consumes — see the header comment in
 * `lib/invoice-document.ts` for why the two renderers are not allowed their own arithmetic.
 *
 * Print behaviour lives in `app/invoice/page.tsx`, keyed off `#invoice-doc`. The responsive
 * screen preview sits beside the editor on wide displays; print resets every wrapper so
 * A4 still uses the whole page, without the editor, app background or sticky positioning.
 */

import type { InvoiceDocument } from '@/lib/invoice-document';

/* ═══ THIS SHEET DOES NOT FOLLOW THE APP'S THEME ═══
 *
 * An invoice is a printed artefact. It goes to a buyer on paper or as a PDF, and it has to look
 * the same whichever theme the farmer happens to have the app set to — so every colour on this
 * document is a literal, deliberately, and the theme-token codemod that swept the rest of the
 * farmer screens is excluded from this file.
 *
 * Leaving it in was measured: with the document's inks following the theme, dark mode painted
 * pale type onto the sheet's own fixed white and the buyer name, the amounts, the "each" unit and
 * every payment-terms option fell to 2.89–3.48:1 on the page a buyer actually reads.
 *
 * lib/invoice-document.ts makes the same call for the numbers (see formatInvoiceZar): this
 * document's job is to be identical everywhere, not to be responsive.
 * ═══════════════════════════════════════════════════ */

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
      style={{ color: '#755942', letterSpacing: '0.1em' }}
    >
      {children}
    </div>
  );
}

export default function InvoiceDocumentView({ doc }: { doc: InvoiceDocument }) {
  return (
    <div id="invoice-doc" className="rounded-2xl p-5 sm:p-8" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>

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
              {doc.sellerName || <span style={{ color: '#755942' }}>{doc.labels.sellerPlaceholder}</span>}
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
        <span className="text-xs font-sans font-semibold" style={{ color: '#20190F' }}>{doc.labels.invoice} {doc.number}</span>
        <span className="text-xs font-sans" style={{ color: '#755942' }}>{doc.labels.issued} {doc.issuedLabel}</span>
        {doc.dueLabel && (
          <span className="text-xs font-sans" style={{ color: '#755942' }}>{doc.labels.due} {doc.dueLabel}</span>
        )}
        {doc.referenceLabel && (
          <span className="text-xs font-sans" style={{ color: '#755942' }}>{doc.labels.buyerReference} {doc.referenceLabel}</span>
        )}
        {doc.paperReferenceLabel && (
          <span className="w-full text-xs font-sans" style={{ color: '#5C5040' }}>{doc.labels.originalPaperInvoice}: {doc.paperReferenceLabel}</span>
        )}
      </div>

      {/* Bill to */}
      <div className="mt-3.5">
        <Label>{doc.labels.billTo}</Label>
        <div className="font-display text-sm" style={{ color: doc.buyerName ? '#20190F' : '#755942' }}>
          {doc.buyerName || doc.labels.buyerPlaceholder}
        </div>
        {doc.buyerLines.map((line) => (
          <div key={line} className="text-xs font-sans mt-0.5" style={{ color: '#5C5040' }}>{line}</div>
        ))}
      </div>

      {/* Line items */}
      <div className="invoice-rows mt-4">
        <div
          className="invoice-rows-head flex items-baseline justify-between pb-1.5 text-xs font-sans uppercase"
          style={{ color: '#755942', letterSpacing: '0.08em', borderBottom: '1px solid #E2D8C4' }}
        >
          <span>{doc.labels.item}</span><span>{doc.labels.amount}</span>
        </div>
        {doc.rows.length === 0 ? (
          <div className="py-3 text-sm font-display" style={{ color: '#755942' }}>{doc.labels.noItems}</div>
        ) : doc.rows.map((row, index) => (
          <div
            key={`${row.desc}-${index}`}
            className="invoice-row flex items-baseline justify-between gap-3 py-2"
            style={{ borderBottom: '1px solid #F0E9DC' }}
          >
            <div className="min-w-0">
              <div className="font-display text-sm" style={{ color: '#20190F' }}>{row.desc}</div>
              <div className="text-xs font-sans mt-0.5" style={{ color: '#755942' }}>{row.detail}</div>
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
        <span className="font-display font-semibold text-sm" style={{ color: '#20190F' }}>{doc.totalHeading}</span>
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
          <Label>{doc.labels.howToPay}</Label>
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

      <div className="invoice-footer text-center text-xs font-sans mt-6" style={{ color: '#755942' }}>
        {doc.footer}
      </div>
    </div>
  );
}

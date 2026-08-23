// The invoice is the one artefact in this app that a third party keeps. A buyer files it, pays
// from it, and argues from it months later. So the things checked here are the things that would
// be wrong on somebody's paper copy: the amount, the date, who is being billed, and where to pay.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  buildInvoiceDocument, formatInvoiceZar, formatQuantity, INVOICE_FOOTER,
  type InvoiceDocumentInput,
} from '../lib/invoice-document.ts';

const src = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const BASE: InvoiceDocumentInput = {
  no: 44,
  issuedISO: '2026-06-24T08:00:00.000Z',
  seller: { name: 'Thandi Mbeki' },
  buyer: { name: 'Spar Nquthu' },
  items: [{ desc: 'Amadumbe', qty: 8, unit: 'bags', price: 95 }],
  status: 'unpaid',
};

/* ── Money ──────────────────────────────────────────────────────────── */

test('money on an invoice always carries cents', () => {
  // `n.toLocaleString('en-ZA')`, which both renderers used, printed these as R37,5 and
  // R1 234,567 — the second reads as one and a quarter MILLION rand to anyone glancing at it.
  assert.equal(formatInvoiceZar(37.5), 'R37,50');
  assert.equal(formatInvoiceZar(1234.567), 'R1 234,57');
  assert.equal(formatInvoiceZar(60), 'R60,00');
  assert.equal(formatInvoiceZar(0), 'R0,00');
  assert.equal(formatInvoiceZar(1000000), 'R1 000 000,00');
});

test('thousands are grouped with a plain space, not U+00A0', () => {
  // The non-breaking space Intl emits for en-ZA has already broken a text export in this repo
  // once. jsPDF's core fonts cannot encode it either.
  assert.ok(!/ /.test(formatInvoiceZar(1234.5)), 'grouping used a non-breaking space');
});

test('a non-finite amount is shown as unavailable, never as an amount', () => {
  assert.equal(formatInvoiceZar(Number.NaN), '—');
  assert.equal(formatInvoiceZar(Number.POSITIVE_INFINITY), '—');
});

test('quantities are not padded to a precision the scale does not have', () => {
  assert.equal(formatQuantity(8), '8');
  assert.equal(formatQuantity(12.5), '12,5');
});

test('the total is the sum of the lines, to the cent', () => {
  const doc = buildInvoiceDocument({
    ...BASE,
    items: [
      { desc: 'Green beans', qty: 1.5, unit: 'kg', price: 35.5 },
      { desc: 'Dry beans', qty: 2, unit: 'kg', price: 25.25 },
    ],
  });
  // 53.25 + 50.50
  assert.equal(doc.totalLabel, 'R103,75');
});

/* ── Nothing invented ───────────────────────────────────────────────── */

test('an unset farm name, address or phone prints nothing at all', () => {
  // The regression this repo already shipped: a plausible value standing in for a missing one,
  // indistinguishable in the output from a real one. Here the same guarantee is executed rather
  // than pattern-matched in the source — blank inputs must produce zero lines, not a placeholder.
  const doc = buildInvoiceDocument(BASE);
  assert.deepEqual(doc.sellerLines, []);
  assert.deepEqual(doc.buyerLines, []);
  assert.deepEqual(doc.bankingLines, []);
  assert.equal(doc.notes, null);
  assert.equal(doc.dueLabel, null);
  assert.equal(doc.referenceLabel, null);
});

test('blank and whitespace-only fields are dropped, not printed as empty lines', () => {
  const doc = buildInvoiceDocument({
    ...BASE,
    seller: { name: 'Thandi Mbeki', farm: '   ', address: 'Plot 14\n\n  \nNquthu', phone: '' },
  });
  assert.deepEqual(doc.sellerLines, ['Plot 14', 'Nquthu']);
});

test('the letterhead carries every detail the farmer entered', () => {
  const doc = buildInvoiceDocument({
    ...BASE,
    seller: {
      name: 'Thandi Mbeki', farm: 'Tugela Valley smallholding', address: 'Plot 14, Nquthu',
      phone: '072 345 6789', email: 'thandi@example.co.za', taxNumber: '4820123456',
    },
  });
  assert.deepEqual(doc.sellerLines, [
    'Thandi Mbeki', 'Plot 14, Nquthu', '072 345 6789',
    'thandi@example.co.za', 'VAT/Tax no. 4820123456',
  ]);
});

/* ── Who the invoice is FROM ────────────────────────────────────────── */

test('a business invoices as the business, with the person underneath', () => {
  // A crèche selling vegetables sends an invoice from the crèche. The document used to lead
  // with whoever held the app account and push the enterprise into the small print, so the
  // buyer filed it under a person's name and could not match it to the supplier they had
  // agreed terms with.
  const doc = buildInvoiceDocument({
    ...BASE,
    seller: { name: 'Rory Clark', farm: 'Ubhejane Creche', phone: '072 345 6789' },
  });
  assert.equal(doc.sellerName, 'Ubhejane Creche');
  assert.deepEqual(doc.sellerLines, ['Rory Clark', '072 345 6789']);
});

test('with no business name the person leads, and is never printed twice', () => {
  // The other half of the same rule: nothing is invented for an unset enterprise, and the
  // name that took the heading must not also appear as a contact line under itself.
  const doc = buildInvoiceDocument({
    ...BASE,
    seller: { name: 'Thandi Mbeki', phone: '072 345 6789' },
  });
  assert.equal(doc.sellerName, 'Thandi Mbeki');
  assert.deepEqual(doc.sellerLines, ['072 345 6789']);
});

test('a whitespace-only business name does not take the heading', () => {
  const doc = buildInvoiceDocument({
    ...BASE,
    seller: { name: 'Thandi Mbeki', farm: '   ' },
  });
  assert.equal(doc.sellerName, 'Thandi Mbeki');
  assert.deepEqual(doc.sellerLines, []);
});

/* ── The logo ───────────────────────────────────────────────────────── */

test('only a real image payload becomes a logo', () => {
  // The letterhead is drawn from whatever this field holds, on a document a buyer keeps.
  // A stray string would render as a broken-image icon there, so anything that is not an
  // image data URL is dropped rather than passed through.
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(buildInvoiceDocument({ ...BASE, seller: { name: 'T', logo: png } }).sellerLogo, png);
  assert.equal(buildInvoiceDocument({ ...BASE, seller: { name: 'T', logo: 'https://example.com/l.png' } }).sellerLogo, null);
  assert.equal(buildInvoiceDocument({ ...BASE, seller: { name: 'T', logo: '  ' } }).sellerLogo, null);
  assert.equal(buildInvoiceDocument(BASE).sellerLogo, null);
});

/* ── Units ──────────────────────────────────────────────────────────── */

test('a quantity of one is not printed as a plural', () => {
  // "1 bunches x R5,00" shipped on a real invoice. The unit list is plural because that is
  // how it reads in the picker; the document is what a buyer keeps.
  const doc = buildInvoiceDocument({
    ...BASE,
    items: [
      { desc: 'Swiss chard', qty: 1, unit: 'bunches', price: 5 },
      { desc: 'Maize', qty: 3, unit: 'bags', price: 40 },
      { desc: 'Tomatoes', qty: 1, unit: 'kg', price: 22 },
    ],
  });
  assert.equal(doc.rows[0].detail, '1 bunch × R5,00');
  assert.equal(doc.rows[1].detail, '3 bags × R40,00');
  // 'kg' and 'each' have no separate singular — they must be left exactly as they are.
  assert.equal(doc.rows[2].detail, '1 kg × R22,00');
});

test('the buyer block carries an address, which the document had no field for at all', () => {
  const doc = buildInvoiceDocument({
    ...BASE,
    buyer: { name: 'Spar Nquthu', address: 'Shop 3, Main Road\nNquthu', phone: '034 271 0000' },
  });
  assert.equal(doc.buyerName, 'Spar Nquthu');
  assert.deepEqual(doc.buyerLines, ['Shop 3, Main Road', 'Nquthu', '034 271 0000']);
});

test('banking details appear only once there are banking details', () => {
  const withBank = buildInvoiceDocument({
    ...BASE,
    banking: { accountName: 'T Mbeki', bankName: 'Capitec', accountNumber: '1234567890', branchCode: '470010' },
  });
  assert.deepEqual(withBank.bankingLines, ['T Mbeki', 'Capitec', 'Account 1234567890', 'Branch code 470010']);
  // A half-filled bank block still prints what it has rather than nothing.
  const partial = buildInvoiceDocument({ ...BASE, banking: { bankName: 'Capitec' } });
  assert.deepEqual(partial.bankingLines, ['Capitec']);
});

/* ── Dates ──────────────────────────────────────────────────────────── */

test('the document is dated when it was ISSUED, not when it is being looked at', () => {
  // Both renderers called a todayLong() helper, so reopening invoice #0044 next month reprinted
  // it dated next month while the ledger still held the original date.
  const doc = buildInvoiceDocument(BASE);
  assert.equal(doc.issuedLabel, '24 June 2026');
  assert.ok(!doc.issuedLabel.includes(String(new Date().getFullYear() + 1)));
});

test('an unreadable issue date shows as missing rather than as today', () => {
  const doc = buildInvoiceDocument({ ...BASE, issuedISO: 'not-a-date' });
  assert.equal(doc.issuedLabel, '—');
});

test('a due date is shown when there is one', () => {
  const doc = buildInvoiceDocument({ ...BASE, dueISO: '2026-07-24T08:00:00.000Z' });
  assert.equal(doc.dueLabel, '24 July 2026');
});

/* ── Paid state ─────────────────────────────────────────────────────── */

test('an unpaid invoice can never show a paid stamp', () => {
  assert.equal(buildInvoiceDocument(BASE).paidStamp, null);
  // A 'paid' record with no payment date is what cleanInvoice already refuses to trust.
  assert.equal(buildInvoiceDocument({ ...BASE, status: 'paid' }).paidStamp, 'Paid');
});

test('a paid invoice states when and how it was paid', () => {
  const doc = buildInvoiceDocument({
    ...BASE, status: 'paid', paidAt: '2026-07-02T09:00:00.000Z', paymentMethod: 'eft',
  });
  assert.equal(doc.paidStamp, 'Paid · 2 Jul 2026 · EFT');
});

/* ── The footer ─────────────────────────────────────────────────────── */

test('the footer points at a domain that resolves', () => {
  // fieldproof.vercel.app is retired. It was printed on every invoice and every PDF, so a buyer
  // who typed it in got nothing.
  assert.ok(INVOICE_FOOTER.includes('imbewufield.vercel.app'));
  assert.ok(!INVOICE_FOOTER.includes('fieldproof.vercel.app'));
  assert.equal(buildInvoiceDocument(BASE).footer, INVOICE_FOOTER);
});

/* ── The two renderers ──────────────────────────────────────────────── */

test('every field of the document is read by BOTH renderers', () => {
  // This is the check that replaces the source-scanning assertions in
  // tests/invoice-seller-identity.test.ts. The bug those were written for was a field that was
  // right on one render path and wrong on the other, and the failure mode is structural: two
  // renderers, one of which is forgotten. Adding a field to InvoiceDocument and wiring it into
  // only the screen — or only the PDF — turns this red.
  const screen = src('../components/invoice/InvoiceDocument.tsx');
  const pdf = src('../lib/invoice-pdf.ts');
  const doc = buildInvoiceDocument({
    ...BASE,
    dueISO: '2026-07-24T08:00:00.000Z',
    reference: 'PO-8821',
    notes: 'Crates returned with next order.',
    banking: { accountName: 'T Mbeki' },
    status: 'paid',
    paidAt: '2026-07-02T09:00:00.000Z',
  });

  for (const field of Object.keys(doc)) {
    assert.ok(
      screen.includes(`doc.${field}`),
      `components/invoice/InvoiceDocument.tsx never reads doc.${field} — it will be missing from the printed page`,
    );
    assert.ok(
      pdf.includes(`doc.${field}`),
      `lib/invoice-pdf.ts never reads doc.${field} — it will be missing from the PDF the buyer is sent`,
    );
  }
});

test('neither renderer formats money or dates for itself', () => {
  const screen = src('../components/invoice/InvoiceDocument.tsx');
  const pdf = src('../lib/invoice-pdf.ts');
  for (const [name, text] of [['screen', screen], ['pdf', pdf]] as const) {
    assert.ok(!/toLocaleString/.test(text), `${name} renderer formats a number itself instead of using the document model`);
    assert.ok(!/toLocaleDateString/.test(text), `${name} renderer formats a date itself instead of using the document model`);
  }
});

test('the PDF pages its items instead of writing them off the bottom of the sheet', () => {
  // A4 is 842pt tall and the old writer put the footer at a fixed 808pt, adding to a running y
  // with no bound. Past roughly twenty lines the items simply stopped appearing, while the total
  // — computed from the data, not from what was drawn — still printed correctly underneath.
  const pdf = src('../lib/invoice-pdf.ts');
  assert.ok(/addPage\(\)/.test(pdf), 'the PDF writer never starts a second page');
  assert.ok(/splitTextToSize/.test(pdf), 'the PDF writer never wraps text, so long names run off the edge');
});

test('printing whitens the app chrome instead of tinting the whole sheet', () => {
  // #invoice-doc alone was reset for print. Its ancestors kept the app's beige page colour and a
  // 28rem reading column, so A4 came out as a narrow strip of invoice on a full page of tint.
  const page = src('../app/invoice/page.tsx');
  const printBlock = page.slice(page.indexOf('@media print'));
  for (const wrapper of ['.invoice-page', '.invoice-scroll', '.invoice-column']) {
    assert.ok(printBlock.includes(wrapper), `the print stylesheet never resets ${wrapper}`);
  }
  assert.ok(/max-width: none/.test(printBlock), 'the print stylesheet never releases the reading column');
});

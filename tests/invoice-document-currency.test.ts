import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { createElement, type ComponentType } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
import {
  buildInvoiceDocument, INVOICE_CURRENCY_REVIEW,
  type InvoiceDocument, type InvoiceDocumentInput,
} from '../lib/invoice-document.ts';
import { buildInvoicePdf } from '../lib/invoice-pdf.ts';
import { pdfContentStreams } from './pdf-content-streams.ts';

const BASE: InvoiceDocumentInput = {
  no: 23, issuedISO: '2026-07-02T09:00:00.000Z', dueISO: '2026-07-24T09:00:00.000Z',
  seller: { farm: 'Example enterprise', name: 'Seller', address: 'Seller address' },
  buyer: { name: 'Buyer', address: 'Buyer address' },
  items: [{ desc: 'Line A', qty: 2, unit: 'crates', price: 37.5 }],
  status: 'unpaid', reference: 'ORDER-A', notes: 'Keep this note.',
};

// Node does not load TSX. Compile the actual passive component, using the real
// React runtime and server renderer; none of the displayed document is mocked.
const require = createRequire(import.meta.url);
let view: ComponentType<{ doc: InvoiceDocument }> | undefined;
function html(doc: InvoiceDocument): string {
  if (!view) {
    const source = readFileSync(new URL('../components/invoice/InvoiceDocument.tsx', import.meta.url), 'utf8');
    const code = ts.transpileModule(source, { compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022,
    } }).outputText;
    const module = { exports: {} as { default: ComponentType<{ doc: InvoiceDocument }> } };
    new Function('require', 'module', 'exports', code)(require, module, module.exports);
    view = module.exports.default;
  }
  return renderToStaticMarkup(createElement(view, { doc }));
}
async function pdf(doc: InvoiceDocument): Promise<string> {
  const file = await buildInvoicePdf(doc, 'currency-check.pdf');
  assert.equal(file.type, 'application/pdf');
  return pdfContentStreams(await file.arrayBuffer());
}

for (const code of ['ZAR', 'KES', 'GBP', 'USD', 'EUR', 'BRL']) {
  test(`${code}: both real invoice renderers retain the recorded denomination at unit, line and total`, async () => {
    const input = { ...BASE, language: 'en', currencyCode: code };
    const before = structuredClone(input);
    const doc = buildInvoiceDocument(input);
    assert.equal(doc.rows[0].detail, `2 crates × ${code} 37.50`);
    assert.equal(doc.rows[0].amount, `${code} 75.00`);
    assert.equal(doc.totalLabel, `${code} 75.00`);
    assert.deepEqual(input, before, 'formatting must not convert or mutate the saved amounts/parties');
    for (const rendered of [html(doc), await pdf(doc)]) {
      assert.ok(rendered.includes(`${code} 37.50`));
      assert.ok(rendered.includes(`${code} 75.00`));
      assert.ok(!rendered.includes('R37,50'));
    }
  });
}

test('language changes number presentation while the original recorded currency and amounts stay fixed', () => {
  for (const code of ['ZAR', 'KES', 'GBP', 'USD', 'EUR', 'BRL']) {
    const input = { ...BASE, currencyCode: code };
    for (const language of ['en', 'zu', 'pt-BR', 'fr-FR', 'not_a_locale']) {
      const doc = buildInvoiceDocument({ ...input, language });
      assert.ok(doc.rows[0].detail.includes(code));
      assert.ok(doc.rows[0].amount.includes(code));
      assert.ok(doc.totalLabel.includes(code));
      assert.ok(!/[\u00a0\u202f]/.test(doc.rows[0].detail + doc.totalLabel), 'the existing PDF font receives ordinary spaces');
      const digits = doc.totalLabel.replace(/[^0-9]/g, '');
      assert.equal(digits, '7500', 'locale changes separators, never the amount owed');
    }
    assert.equal(input.items[0].price, 37.5);
    assert.equal(input.items[0].qty, 2);
    assert.equal(input.currencyCode, code);
  }
});

test('absent currency metadata preserves historical shared Rand strings, issue/due/payment dates and party snapshots', async () => {
  const doc = buildInvoiceDocument({ ...BASE, status: 'paid', paidAt: '2026-07-03T09:00:00.000Z', paymentMethod: 'cash' });
  assert.equal(doc.rows[0].detail, '2 crates × R37,50');
  assert.equal(doc.rows[0].amount, 'R75,00');
  assert.equal(doc.totalLabel, 'R75,00');
  assert.equal(doc.issuedLabel, '2 July 2026');
  assert.equal(doc.dueLabel, '24 July 2026');
  assert.equal(doc.paidStamp, 'Paid · 3 Jul 2026 · Cash');
  assert.equal(doc.totalHeading, 'Invoice total');
  assert.equal(doc.sellerName, 'Example enterprise');
  assert.deepEqual(doc.sellerLines, ['Seller', 'Seller address']);
  assert.equal(doc.buyerName, 'Buyer');
  assert.deepEqual(doc.buyerLines, ['Buyer address']);
  for (const rendered of [html(doc), await pdf(doc)]) {
    for (const expected of ['R37,50', 'R75,00', '2 July 2026', '24 July 2026', 'Example enterprise', 'Buyer address']) {
      assert.ok(rendered.includes(expected), expected);
    }
  }
  const zu = buildInvoiceDocument({ ...BASE, language: 'zu' });
  assert.equal(zu.rows[0].detail, '2 amakhreyithi × R37,50');
  assert.equal(zu.totalLabel, 'R75,00');
  assert.equal(zu.issuedLabel, '2 Julayi 2026');
});

test('present undefined, null and other unsupported metadata visibly holds every monetary field without a Rand default', async () => {
  const values: unknown[] = [undefined, null, '', 'zar', ' ZAR', 'ZAR ', 'CAD', 'R', 710, false, {}, ['USD']];
  for (const currencyCode of values) {
    const doc = buildInvoiceDocument({ ...BASE, currencyCode, items: [...BASE.items, { desc: 'No price yet', qty: 1, unit: 'each', price: 0 }] });
    for (const row of doc.rows) {
      assert.equal(row.amount, INVOICE_CURRENCY_REVIEW);
      assert.ok(row.detail.endsWith(` × ${INVOICE_CURRENCY_REVIEW}`));
      assert.ok(!/R\d/.test(row.detail + row.amount));
    }
    assert.equal(doc.totalLabel, INVOICE_CURRENCY_REVIEW);
    assert.ok(doc.rows[0].detail.startsWith('2 crates'));
  }
  const held = buildInvoiceDocument({ ...BASE, currencyCode: undefined });
  for (const rendered of [html(held), await pdf(held)]) {
    assert.ok(rendered.includes(INVOICE_CURRENCY_REVIEW));
    assert.ok(!rendered.includes('R37,50'));
    assert.ok(!rendered.includes('R75,00'));
  }
});

test('currency accessors and inherited markers cannot print plausible Rand invoices or invoke a getter', () => {
  let calls = 0;
  const own = { ...BASE };
  Object.defineProperty(own, 'currencyCode', { enumerable: true, get() { calls++; return 'USD'; } });
  assert.equal(buildInvoiceDocument(own).totalLabel, INVOICE_CURRENCY_REVIEW);
  const inherited = Object.assign(Object.create({ currencyCode: 'USD' }), BASE) as InvoiceDocumentInput;
  assert.equal(buildInvoiceDocument(inherited).totalLabel, INVOICE_CURRENCY_REVIEW);
  assert.equal(calls, 0);
});

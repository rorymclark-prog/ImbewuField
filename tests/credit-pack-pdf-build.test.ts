// Builds a REAL lender PDF end to end, with jsPDF actually running — kept apart from
// tests/credit-pack-pdf.test.ts on purpose. That file fakes `window` to drive
// enterSampleMode()/isSampleMode(), and jsPDF's Node build inspects `window` at load time: a
// partial fake window makes it try (and fail) to use browser code paths. Here there is no window
// mock at all, so isSampleMode() reads `typeof window === 'undefined'` and is naturally false —
// the same "no Firebase, no window" shape a real Node/SSR context has — and jsPDF loads its plain
// Node build cleanly.

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';
import { isSampleMode } from '@/lib/sample-mode';
import { buildCreditPackPdf } from '@/lib/credit-pack-pdf';

const NOW = new Date('2026-08-15T09:00:00.000Z');

function farmer() {
  return { name: 'Thandi Mbeki', farmName: 'Tugela Valley smallholding', phone: '0821234567' };
}
function sale(): SalesLog {
  return {
    id: 's1', profile_id: 'f', garden_id: null, crop: 'Spinach', kg: 10, amount: 300,
    buyer: 'Spar Nquthu', sold_at: '2026-08-01T00:00:00.000Z', created_at: '2026-08-01T00:00:00.000Z',
  };
}
function expense(): ExpenseLog {
  return {
    id: 'e1', profile_id: 'f', garden_id: null, item: 'Seed', amount: 80, supplier: null,
    spent_at: '2026-08-02T00:00:00.000Z', created_at: '2026-08-02T00:00:00.000Z', category: 'seed',
  };
}
function harvest(): ProductionLog {
  return {
    id: 'p1', profile_id: 'f', garden_id: null, crop: 'Spinach', kg: 20, photo_url: null,
    logged_at: '2026-07-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z',
  };
}

test('isSampleMode() is false with no window at all — the plain-Node/SSR shape', () => {
  assert.equal(typeof globalThis.window, 'undefined');
  assert.equal(isSampleMode(), false);
});

test('a real export builds an actual, non-empty PDF', async () => {
  const blob = await buildCreditPackPdf({
    farmer: farmer(),
    production: [harvest()],
    sales: [sale()],
    expenses: [expense()],
    now: NOW,
  });
  assert.ok(blob instanceof Blob);
  assert.equal(blob.type, 'application/pdf');
  // A one-page "nothing to see" PDF is a few hundred bytes; this document has a cover plus three
  // more sections' worth of headings, tables and paragraphs, so a suspiciously small file means a
  // section silently failed to draw rather than that the content is simply short.
  assert.ok(blob.size > 2000, `PDF looked too small to hold the real document (${blob.size} bytes)`);
});

test('an empty farmer (no records at all) still builds — the caller, not this function, decides whether to offer the button', async () => {
  const blob = await buildCreditPackPdf({
    farmer: { name: null, farmName: null, phone: null },
    production: [],
    sales: [],
    expenses: [],
    now: NOW,
  });
  assert.ok(blob instanceof Blob);
  assert.ok(blob.size > 500);
});

test('a farmer with only harvests logged (no sales, no costs) still builds a usable document', () => {
  return buildCreditPackPdf({
    farmer: farmer(),
    production: [harvest()],
    sales: [],
    expenses: [],
    now: NOW,
  }).then((blob) => {
    assert.ok(blob instanceof Blob);
    assert.ok(blob.size > 1000);
  });
});

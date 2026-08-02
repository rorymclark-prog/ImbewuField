import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DUPLICATE_WINDOW_DAYS,
  suspectedDuplicateIncomeIds,
  type IncomeEntry,
} from '@/lib/duplicate-income';

const sale = (id: string, amount: number, iso: string): IncomeEntry => ({ id, kind: 'sale', amount, iso });
const invoice = (id: string, amount: number, iso: string): IncomeEntry => ({ id, kind: 'invoice', amount, iso });

test('the same sale entered twice, once as an invoice and once as a sale, is flagged on both rows', () => {
  // 40 kg of spinach to a shop for R1 200. The invoice is marked Paid, then the farmer logs the
  // sale as well to clear the harvest-reconciliation flag — and income reads R2 400.
  const flagged = suspectedDuplicateIncomeIds([
    invoice('inv-51', 1200, '2026-08-01T00:00:00.000Z'),
    sale('sale-9', 1200, '2026-08-02T00:00:00.000Z'),
  ]);
  assert.equal(flagged.size, 2);
  assert.ok(flagged.has('inv-51'));
  assert.ok(flagged.has('sale-9'));
});

test('only a sale paired with an invoice counts — not two sales, and not two invoices', () => {
  // Two market days at the same price are two sales, not one entered twice. It is the crossing of
  // the two ROUTES that creates the double count.
  assert.equal(suspectedDuplicateIncomeIds([
    sale('a', 1200, '2026-08-01T00:00:00.000Z'),
    sale('b', 1200, '2026-08-02T00:00:00.000Z'),
  ]).size, 0);

  assert.equal(suspectedDuplicateIncomeIds([
    invoice('a', 1200, '2026-08-01T00:00:00.000Z'),
    invoice('b', 1200, '2026-08-02T00:00:00.000Z'),
  ]).size, 0);
});

test('a different amount or a distant date is left alone', () => {
  assert.equal(suspectedDuplicateIncomeIds([
    invoice('inv', 1200, '2026-08-01T00:00:00.000Z'),
    sale('sale', 1250, '2026-08-01T00:00:00.000Z'),
  ]).size, 0, 'different amounts are two different sales');

  assert.equal(suspectedDuplicateIncomeIds([
    invoice('inv', 1200, '2026-08-01T00:00:00.000Z'),
    sale('sale', 1200, `2026-08-0${1 + DUPLICATE_WINDOW_DAYS + 1}T00:00:01.000Z`),
  ]).size, 0, 'outside the window is a separate sale at the same price');
});

test('the window is inclusive at its edge', () => {
  const flagged = suspectedDuplicateIncomeIds([
    invoice('inv', 1200, '2026-08-01T00:00:00.000Z'),
    sale('sale', 1200, '2026-08-04T00:00:00.000Z'),
  ]);
  assert.equal(flagged.size, 2, `${DUPLICATE_WINDOW_DAYS} days apart is still the same sale`);
});

test('rand is compared in whole cents, so floating point cannot hide a match', () => {
  const flagged = suspectedDuplicateIncomeIds([
    invoice('inv', 0.1 + 0.2, '2026-08-01T00:00:00.000Z'),
    sale('sale', 0.3, '2026-08-01T00:00:00.000Z'),
  ]);
  assert.equal(flagged.size, 2, '0.1 + 0.2 must match 0.3');
});

test('zero, negative and unparseable entries never raise a flag', () => {
  // A zero-rand row would otherwise match every other zero-rand row in the period.
  assert.equal(suspectedDuplicateIncomeIds([
    invoice('inv', 0, '2026-08-01T00:00:00.000Z'),
    sale('sale', 0, '2026-08-01T00:00:00.000Z'),
  ]).size, 0);

  assert.equal(suspectedDuplicateIncomeIds([
    invoice('inv', Number.NaN, '2026-08-01T00:00:00.000Z'),
    sale('sale', Number.NaN, '2026-08-01T00:00:00.000Z'),
  ]).size, 0);

  assert.equal(suspectedDuplicateIncomeIds([
    invoice('inv', 1200, 'not-a-date'),
    sale('sale', 1200, '2026-08-01T00:00:00.000Z'),
  ]).size, 0);
});

test('one invoice matching two sales flags all three, because all three need checking', () => {
  const flagged = suspectedDuplicateIncomeIds([
    invoice('inv', 1200, '2026-08-02T00:00:00.000Z'),
    sale('s1', 1200, '2026-08-01T00:00:00.000Z'),
    sale('s2', 1200, '2026-08-03T00:00:00.000Z'),
  ]);
  assert.equal(flagged.size, 3);
});

// The non-negotiable this file exists to prove: a document built while the app is showing the
// Ubhejane Crèche sample farm must never come out the door looking like a real farmer's record.
// buildCreditPackPdf refuses outright rather than watermarking — see lib/credit-pack-pdf.ts for
// why. These tests exercise the real isSampleMode()/sample-mode.ts machinery (the same mocking
// pattern tests/sample-mode.test.ts uses), not a stub, so the guard is proven against the actual
// flag the rest of the app sets.

import assert from 'node:assert/strict';
import test from 'node:test';

import type { ExpenseLog, ProductionLog, SalesLog } from '@/lib/db/types';

class MemoryStorage {
  readonly rows = new Map<string, string>();
  get length(): number { return this.rows.size; }
  key(index: number): string | null { return [...this.rows.keys()][index] ?? null; }
  getItem(key: string): string | null { return this.rows.get(String(key)) ?? null; }
  setItem(key: string, value: string): void { this.rows.set(String(key), String(value)); }
  removeItem(key: string): void { this.rows.delete(String(key)); }
  clear(): void { this.rows.clear(); }
}

Object.defineProperty(globalThis, 'Storage', { configurable: true, value: MemoryStorage });
const realLocal = new MemoryStorage();
const session = new MemoryStorage();
const browser = new EventTarget() as EventTarget & { localStorage: MemoryStorage; sessionStorage: MemoryStorage };
browser.localStorage = realLocal;
browser.sessionStorage = session;
Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: realLocal });
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: session });

const sampleMode = await import('@/lib/sample-mode');
const { buildCreditPackPdf, creditPackPdfFilename, CreditPackSampleModeError } = await import('@/lib/credit-pack-pdf');

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

test('the export refuses outright while sample mode is on', async () => {
  session.rows.clear();
  assert.equal(sampleMode.enterSampleMode(), true);
  assert.equal(sampleMode.isSampleMode(), true);

  await assert.rejects(
    buildCreditPackPdf({ farmer: farmer(), production: [harvest()], sales: [sale()], expenses: [expense()], now: NOW }),
    (err: unknown) => {
      assert.ok(err instanceof CreditPackSampleModeError, `expected CreditPackSampleModeError, got ${err}`);
      // The class name alone is not proof anyone reads the message — the farmer-facing UI shows
      // err.message directly (components/MyRecords.tsx), so it must say something a farmer acts on.
      assert.match((err as Error).message, /sample/i);
      return true;
    },
  );

  sampleMode.exitSampleMode();
});

// Building a REAL (non-sample) PDF end to end lives in its own file
// (tests/credit-pack-pdf-build.test.ts) rather than here, deliberately: jsPDF's Node build
// inspects `window` at load time, and this file's fake `window` (needed to drive
// enterSampleMode()) makes jsPDF try, and fail, to use browser code paths. Node isolates each
// test file into its own process, so keeping the two apart is not a workaround for a shared-state
// bug — it is what lets this file test the guard with a fake window while the other file tests
// the real document with none.

/* ── Filename ─────────────────────────────────────────────────────────────── */

test('the filename is filesystem-safe and carries the date', () => {
  const name = creditPackPdfFilename('Tugela Valley smallholding', new Date('2026-08-15T00:00:00.000Z'));
  assert.equal(name, 'ImbewuField-Records-Tugela-Valley-smallholding-2026-08-15.pdf');
});

test('an unset farm name falls back to a generic label rather than a blank or "null"', () => {
  const name = creditPackPdfFilename(null, new Date('2026-08-15T00:00:00.000Z'));
  assert.equal(name, 'ImbewuField-Records-Farm-2026-08-15.pdf');
});

test('punctuation and slashes in a farm name cannot break the file path', () => {
  const name = creditPackPdfFilename('Ma/Pa\'s Farm & Co.', new Date('2026-08-15T00:00:00.000Z'));
  assert.doesNotMatch(name, /[/\\]/);
  assert.match(name, /^ImbewuField-Records-.*-2026-08-15\.pdf$/);
});

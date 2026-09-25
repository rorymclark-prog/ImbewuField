import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import test from 'node:test';
import { numberLabel, randLabel, kgTotalLabel } from '@/lib/format-figures';

// A FIGURE THAT CHANGES AFTER THE PAGE LOADS.
//
// /survey rendered the year's rain harvest with `known.rainL.toLocaleString('en-ZA')`. React
// logged a real hydration failure against it — "Text content did not match. Server: 86 400,
// Client: 86,400" — and the number visibly changed under the farmer a moment after load. The
// figure that screen exists to show cannot flicker.
//
// `toLocaleString()` with no locale formats in the RUNTIME's default: Node's on the server, the
// browser's on the client. 60 call sites did that. Naming 'en-ZA' explicitly is not enough
// either, which is what the /survey case proves: grouping still varies with the ICU data the
// platform was built against, and en-ZA emits U+00A0, which survives a spreadsheet paste as a
// non-breaking space and quietly breaks it.
//
// lib/format-figures.ts had already written that rationale down for `kgTotalLabel`, and
// `formatZar` (price-book.ts), `formatInvoiceZar` (invoice-document.ts) and `group()`
// (app/network/page.tsx) had each separately landed on regex grouping for the same reason. Four
// independent discoveries of one rule is a rule that belongs in one place: `numberLabel`.
//
// This file keeps it there.

const ROOT = new URL('..', import.meta.url).pathname;

/** Every .ts/.tsx under app, components and lib except the API routes (server-only, no hydration). */
function sourceFiles(): string[] {
  return execSync("find app components lib -name '*.tsx' -o -name '*.ts'", { cwd: ROOT })
    .toString().trim().split('\n')
    .filter((f) => f && !f.startsWith('app/api/'));
}

/** `src` with comment bodies blanked, so prose about the rule is not mistaken for the bug. */
function withoutComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m) => ' '.repeat(m.length));
}

test('no figure is formatted in whatever locale the runtime happens to have', () => {
  const offences: string[] = [];
  for (const rel of sourceFiles()) {
    const code = withoutComments(readFileSync(`${ROOT}/${rel}`, 'utf8'));
    for (const m of code.matchAll(/\.toLocaleString\(\s*\)/g)) {
      offences.push(`${rel}:${code.slice(0, m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(
    offences,
    [],
    `${offences.length} bare toLocaleString() call(s) — these format in the runtime's default `
      + `locale, so the server and the browser can disagree and the number changes after load:\n`
      + offences.map((o) => `  ${o}`).join('\n')
      + '\n\nUse numberLabel() from @/lib/format-figures for a plain figure, randLabel/formatZar '
      + 'for money, or pass an explicit locale to a DATE call (dates are not covered by this rule).',
  );
});

test('no plain figure is grouped by en-ZA either — that is the bug /survey actually had', () => {
  // Scoped to NUMBER formatting: `toLocaleString('en-ZA')` and the maximumFractionDigits form.
  // Date calls legitimately name a locale and are left alone, as are the two sites that pick
  // zu-ZA vs en-ZA at runtime for a date.
  const offences: string[] = [];
  for (const rel of sourceFiles()) {
    const src = readFileSync(`${ROOT}/${rel}`, 'utf8');
    const code = withoutComments(src);
    const forms = [
      /\.toLocaleString\('en-ZA'\)/g,
      /\.toLocaleString\('en-ZA',\s*\{\s*maximumFractionDigits:[^}]*\}\)/g,
    ];
    for (const re of forms) {
      for (const m of code.matchAll(re)) {
        const line = code.slice(0, m.index).split('\n').length;
        // A Date receiver is a date format, not a figure — those may keep their locale.
        const before = code.slice(Math.max(0, (m.index ?? 0) - 60), m.index);
        if (/new Date\([^)]*\)\s*$|Date\([^)]*\)\s*$/.test(before)) continue;
        offences.push(`${rel}:${line}`);
      }
    }
  }
  assert.deepEqual(
    offences,
    [],
    `${offences.length} figure(s) grouped by en-ZA. Its grouping varies with the platform's ICU `
      + `build — which is exactly how /survey rendered "86 400" on the server and "86,400" in the `
      + `browser — and it emits U+00A0, which breaks a spreadsheet paste:\n`
      + offences.map((o) => `  ${o}`).join('\n')
      + '\n\nUse numberLabel(n) or numberLabel(n, digits) instead.',
  );
});

test('numberLabel groups thousands with a plain space and never a comma', () => {
  assert.equal(numberLabel(86400), '86 400');
  assert.equal(numberLabel(1000), '1 000');
  assert.equal(numberLabel(999), '999');
  assert.equal(numberLabel(1234567), '1 234 567');
  // A plain space, U+0020 — not the U+00A0 en-ZA emits, which is the whole point.
  assert.ok(!numberLabel(86400).includes(' '), 'numberLabel must not emit a non-breaking space');
  assert.ok(!numberLabel(1234567).includes(','), 'numberLabel must not emit a comma');
});

test('numberLabel keeps a fraction, rounds to the digits asked for, and survives odd input', () => {
  assert.equal(numberLabel(405.2, 1), '405.2');
  assert.equal(numberLabel(1234.567, 2), '1 234.57');
  assert.equal(numberLabel(1234.567, 0), '1 235');
  assert.equal(numberLabel(2.5, 0), '3');
  assert.equal(numberLabel(-1500), '-1 500');
  assert.equal(numberLabel(0), '0');
  // Not-a-number is shown as unavailable, never as a figure — the house rule in formatZar.
  assert.equal(numberLabel(Number.NaN), '—');
  assert.equal(numberLabel(Number.POSITIVE_INFINITY), '—');
});

test('numberLabel is deterministic — the same input formats identically every call', () => {
  // The property the locale route could not offer. A regex cannot consult platform data, so this
  // is true by construction; the test is here so a future "simplification" back to
  // toLocaleString cannot pass.
  const once = numberLabel(86400);
  for (let i = 0; i < 100; i++) assert.equal(numberLabel(86400), once);
  assert.equal(numberLabel(86400), '86 400');
});

test('the money and kilogram labels built on it still read as they did', () => {
  // randLabel and kgTotalLabel both dropped a now-dead separator normaliser when they moved onto
  // numberLabel; these pin the output, not the implementation.
  assert.equal(randLabel(1240), 'R1 240');
  assert.equal(randLabel(-120), '−R120');
  assert.equal(randLabel(0), 'R0');
  assert.equal(kgTotalLabel(27090), '27 090 kg');
});

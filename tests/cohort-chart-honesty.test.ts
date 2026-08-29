/*
 * THE FUNDER CHART MAY NOT DRAW A BAR SHORTER THAN THE FIGURE PRINTED ABOVE IT.
 *
 * The bug this file exists to keep dead: components/funder/CohortCharts.tsx drew the sold bar as
 *
 *     const sold = Math.min(m.soldKg ?? 0, produced);          // unconditional
 *     const overPct = m.soldExceedsProduced ? …draw(m.soldKg) : 0;   // conditional
 *
 * — a clamp that always ran, and an outline meant to restore the true height that ran only when
 * `soldExceedsProduced` was set. That flag was computed in lib/cohort-series.ts with an `every()`
 * over the WHOLE cohort: production and sales had to be readable for exactly the same farmers, or
 * it stayed false for everybody. Per-scope consent ships six independent switches, so one farmer
 * sharing sales but not harvest — the normal case, not an edge one — turned the outline off
 * cohort-wide and left the clamp running alone. The bar came out at the harvest figure while the
 * "Sold: X kg" headline above it, computed independently, stayed correct. A funder saw a number
 * and a bar disagreeing, silently, on the one screen whose entire purpose is to be evidence.
 *
 * The sample cohort never reproduced it: all sixteen demo farmers share every scope, so the demo
 * is permanently in the comparable case. Only real per-org data hit it, which is why the fixtures
 * below are the proof and the demo is not.
 *
 * WHAT IS PINNED HERE
 *   1. uniform consent            — the drawing the app already shipped is unchanged
 *   2. one mixed farmer among comparable ones — the overshoot finding SURVIVES for the pairs
 *   3. all mixed                  — the series carries what the card needs to say "not comparable"
 *   4. the invariant              — filled + outlined always equals the stated sold figure
 *   5. source shape               — the clamp-without-an-outline shape cannot come back
 *
 * Run with:
 *   node --import ./tests/register-alias.mjs --test tests/cohort-chart-honesty.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { ProductionLog, SalesLog } from '../lib/db/types.ts';
import {
  buildCohortSeries,
  soldBarParts,
  type CohortLedger,
  type CohortSeries,
} from '../lib/cohort-series.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const NOW = new Date('2026-06-15T09:00:00.000Z');

/** Comments stripped, so a file's own explanation can never satisfy a source-shape check. */
function code(path: string): string {
  return readFileSync(ROOT + path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/* ────────────────────────────────────────────────────────────────────────────
 * fixtures — a year of records, so `renderable` is never what is under test
 * ──────────────────────────────────────────────────────────────────────────*/

const MONTHS = [
  '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
  '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
] as const;

function production(month: string, kg: number, id: string): ProductionLog {
  return {
    id, profile_id: id, garden_id: null, crop: 'spinach', kg,
    photo_url: null, logged_at: `${month}-10T08:00:00.000Z`, created_at: `${month}-10T08:00:00.000Z`,
  };
}

function sale(month: string, kg: number, amount: number, id: string): SalesLog {
  return {
    id, profile_id: id, garden_id: null, crop: 'spinach', kg, amount,
    buyer: null, sold_at: `${month}-12T08:00:00.000Z`, created_at: `${month}-12T08:00:00.000Z`,
  };
}

/** Twelve months of harvest rows at `kg` each. */
function harvest(who: string, kg: number): ProductionLog[] {
  return MONTHS.map((m) => production(m, kg, `p-${who}-${m}`));
}

/** Twelve months of sales at `kg` each, priced at R10/kg. */
function sold(who: string, kg: number): SalesLog[] {
  return MONTHS.map((m) => sale(m, kg, kg * 10, `s-${who}-${m}`));
}

/** Shares both books — the only shape that can join the produced-vs-sold comparison. */
function comparableFarmer(who: string, pickedKg: number, soldKg: number): CohortLedger {
  return { production: harvest(who, pickedKg), sales: sold(who, soldKg), expenses: null, joinedAt: null };
}

/** Shares sales, withholds harvest. Contributes to the sold total and the sold bar, nothing else. */
function salesOnlyFarmer(who: string, soldKg: number): CohortLedger {
  return { production: null, sales: sold(who, soldKg), expenses: null, joinedAt: null };
}

/** Shares harvest, withholds sales. */
function productionOnlyFarmer(who: string, pickedKg: number): CohortLedger {
  return { production: harvest(who, pickedKg), sales: null, expenses: null, joinedAt: null };
}

/** The month every fixture below puts its interesting numbers in. */
function may(series: CohortSeries) {
  const m = series.months.find((x) => x.key === '2026-05');
  assert.ok(m, 'the window must contain May 2026');
  return m;
}

/* ════════════════════════════════════════════════════════════════════════════
 * 1 — uniform consent: nothing about the shipped drawing changes
 * ══════════════════════════════════════════════════════════════════════════*/

test('uniform consent: every farmer shares both books, so the stack is still legal', () => {
  const s = buildCohortSeries([comparableFarmer('a', 30, 12), comparableFarmer('b', 20, 8)], {
    months: 12, now: NOW,
  });

  assert.equal(s.productionFarmers, 2);
  assert.equal(s.salesFarmers, 2);
  assert.equal(s.comparableFarmers, 2);
  assert.equal(s.keptComparable, true, 'the three populations are the same two people');

  const m = may(s);
  assert.equal(m.producedKg, 50);
  assert.equal(m.soldKg, 20);
  // The comparable subset IS the whole cohort here, so the two pairs of figures agree exactly.
  assert.equal(m.comparableProducedKg, m.producedKg);
  assert.equal(m.comparableSoldKg, m.soldKg);
  assert.equal(m.keptKg, 30, 'picked minus sold, across the same farmers');
  assert.equal(s.totalKeptKg, (s.totalProducedKg ?? 0) - (s.totalSoldKg ?? 0));

  // And the bar: entirely filled, no outline, at exactly the stated figure.
  const parts = soldBarParts(m);
  assert.deepEqual(parts, { backedKg: 20, unbackedKg: 0, totalKg: 20 });
});

test('uniform consent: an overshoot month still clamps the FILL and outlines the rest', () => {
  // The whole cohort sold 60 kg in May against 30 kg logged as picked. The filled block may only
  // reach the harvest figure — but the outline must carry the bar the rest of the way, or the
  // drawing contradicts the headline.
  const s = buildCohortSeries(
    [{
      production: [...harvest('a', 30).filter((r) => !r.logged_at.startsWith('2026-05'))],
      sales: sold('a', 60),
      expenses: null,
      joinedAt: null,
    }],
    { months: 12, now: NOW },
  );

  const m = may(s);
  assert.equal(m.producedKg, 0, 'no harvest row was logged in May');
  assert.equal(m.soldKg, 60);
  assert.equal(m.soldExceedsProduced, true);
  assert.equal(m.keptKg, null, 'never a negative kept figure');

  const parts = soldBarParts(m);
  assert.equal(parts.backedKg, 0, 'no harvest record stands behind any of it');
  assert.equal(parts.unbackedKg, 60, 'so all sixty kilograms are drawn as an open outline');
  assert.equal(parts.totalKg, m.soldKg, 'and the bar still reaches the stated figure');
});

/* ════════════════════════════════════════════════════════════════════════════
 * 2 — one mixed-consent farmer beside comparable ones
 * ══════════════════════════════════════════════════════════════════════════*/

test('one mixed farmer does NOT switch the overshoot finding off for the comparable pairs', () => {
  // THE REGRESSION. Two farmers share both books and between them sold more in May than they
  // logged picking. A third shares sales only. Under the old series-wide every(), that third
  // farmer made keptComparable false, soldExceedsProduced false for every month, and the chart's
  // outline dark — leaving the unconditional Math.min clamp to draw the sold bar short on its own.
  const overshootPair = (who: string): CohortLedger => ({
    production: harvest(who, 5),
    sales: sold(who, 25), // sells five times what it logs picking, every month
    expenses: null,
    joinedAt: null,
  });

  const s = buildCohortSeries(
    [overshootPair('a'), overshootPair('b'), salesOnlyFarmer('c', 40)],
    { months: 12, now: NOW },
  );

  assert.equal(s.productionFarmers, 2);
  assert.equal(s.salesFarmers, 3);
  assert.equal(s.comparableFarmers, 2, 'two farmers share both books');
  assert.equal(s.keptComparable, false, 'but the populations are not the same people');

  const m = may(s);
  assert.equal(m.producedKg, 10, 'the two harvest books');
  assert.equal(m.soldKg, 90, 'all three sales books — 25 + 25 + 40');
  assert.equal(m.comparableProducedKg, 10);
  assert.equal(m.comparableSoldKg, 50, 'the comparable pair alone, NOT the sales-only farmer');
  assert.equal(
    m.soldExceedsProduced,
    true,
    'the finding is about the two farmers who share both, and it survives the third one',
  );

  const parts = soldBarParts(m);
  assert.equal(parts.backedKg, 10, 'only what those two farmers actually logged picking');
  assert.equal(parts.unbackedKg, 80, 'the rest is an outline — nothing here is silently dropped');
  assert.equal(parts.totalKg, m.soldKg, 'THE POINT: the drawn bar reaches the stated sold figure');
});

test('a mixed cohort still yields a kept figure — for the farmers who share both, named as such', () => {
  const s = buildCohortSeries(
    [comparableFarmer('a', 30, 10), comparableFarmer('b', 30, 10), salesOnlyFarmer('c', 100)],
    { months: 12, now: NOW },
  );

  const m = may(s);
  assert.equal(m.producedKg, 60);
  assert.equal(m.soldKg, 120);
  assert.equal(m.keptKg, 40, 'the comparable pair picked 60 and sold 20 of it');
  assert.notEqual(m.keptKg, (m.producedKg ?? 0) - (m.soldKg ?? 0), 'never the two populations subtracted');
  assert.ok((s.totalKeptKg ?? 0) > 0);
  assert.equal(s.comparableFarmers, 2, 'the card must be able to name whose kept figure this is');
});

test('production-only and sales-only farmers each still reach their own bar', () => {
  const s = buildCohortSeries([productionOnlyFarmer('a', 30), salesOnlyFarmer('b', 12)], {
    months: 12, now: NOW,
  });

  assert.equal(s.comparableFarmers, 0);
  assert.equal(s.keptComparable, false);

  const m = may(s);
  assert.equal(m.producedKg, 30, 'the harvest-sharing farmer is drawn');
  assert.equal(m.soldKg, 12, 'and so is the sales-sharing one');
  assert.equal(soldBarParts(m).totalKg, 12, 'at its full height, not clamped to anything');
});

test('nobody sharing sales no longer blanks the kilogram panel', () => {
  // The mirror of the same bug. With no readable sales book the old chart computed
  // sold = min(null ?? 0, produced) = 0 and kept = null ?? 0 = 0, so it drew NOTHING at all,
  // under a headline reading "Picked: 360 kg".
  const s = buildCohortSeries([productionOnlyFarmer('a', 30)], { months: 12, now: NOW });

  assert.equal(s.salesFarmers, 0);
  assert.equal(s.totalSoldKg, null, 'not shared is not zero');
  assert.equal(s.totalProducedKg, 360);
  for (const m of s.months) {
    assert.notEqual(m.producedKg, null, `${m.key} has a picked figure that must be drawn`);
  }
  assert.equal(soldBarParts(may(s)).totalKg, 0, 'and no sold bar is invented for it');
});

/* ════════════════════════════════════════════════════════════════════════════
 * 3 — all mixed: the series carries what the card needs to say so
 * ══════════════════════════════════════════════════════════════════════════*/

test('all-mixed: no kept figure at all, and the counts needed to explain why', () => {
  const s = buildCohortSeries(
    [productionOnlyFarmer('a', 30), productionOnlyFarmer('b', 20), salesOnlyFarmer('c', 25)],
    { months: 12, now: NOW },
  );

  assert.equal(s.comparableFarmers, 0, 'nobody shares both books');
  assert.equal(s.keptComparable, false);
  assert.equal(s.totalKeptKg, null, 'a kept figure here would be pure invention');
  for (const m of s.months) {
    assert.equal(m.keptKg, null, `${m.key} kept`);
    assert.equal(m.comparableProducedKg, null, `${m.key} has no comparable population`);
    assert.equal(m.comparableSoldKg, null);
    assert.equal(m.soldExceedsProduced, false, 'there is no pair of books to find an overshoot in');
  }

  // The three counts the card prints in words. Without all three it cannot say WHY the bars stand
  // apart, and an unexplained pair of bars is the thing this whole change is against.
  assert.equal(s.productionFarmers, 2);
  assert.equal(s.salesFarmers, 1);
  assert.equal(s.farmerCount, 3);

  // Every sold kilogram is unbacked, so the whole sold bar draws as an outline. That IS the
  // statement: no harvest record on this chart stands behind any of it.
  const m = may(s);
  const parts = soldBarParts(m);
  assert.equal(parts.backedKg, 0);
  assert.equal(parts.unbackedKg, parts.totalKg);
  assert.equal(parts.totalKg, m.soldKg);
});

/* ════════════════════════════════════════════════════════════════════════════
 * 4 — the invariant, over every consent mix that can occur
 * ══════════════════════════════════════════════════════════════════════════*/

test('filled + outlined is ALWAYS the stated sold figure, whatever the consent mix', () => {
  const mixes: Array<[string, CohortLedger[]]> = [
    ['uniform', [comparableFarmer('a', 30, 12), comparableFarmer('b', 20, 9)]],
    ['uniform, oversold', [comparableFarmer('a', 5, 40)]],
    ['one sales-only', [comparableFarmer('a', 30, 12), salesOnlyFarmer('b', 40)]],
    ['one production-only', [comparableFarmer('a', 30, 12), productionOnlyFarmer('b', 40)]],
    ['one of each', [comparableFarmer('a', 30, 12), salesOnlyFarmer('b', 7), productionOnlyFarmer('c', 9)]],
    ['all mixed', [productionOnlyFarmer('a', 30), salesOnlyFarmer('b', 12)]],
    ['sales only, nobody picks', [salesOnlyFarmer('a', 12), salesOnlyFarmer('b', 3)]],
    ['harvest only, nobody sells', [productionOnlyFarmer('a', 12)]],
    ['fractions', [comparableFarmer('a', 3.3, 1.1), salesOnlyFarmer('b', 0.7)]],
  ];

  for (const [name, ledgers] of mixes) {
    const s = buildCohortSeries(ledgers, { months: 12, now: NOW });
    for (const m of s.months) {
      const { backedKg, unbackedKg, totalKg } = soldBarParts(m);
      assert.ok(backedKg >= 0 && unbackedKg >= 0, `${name} ${m.key}: no negative bar segment`);
      assert.ok(
        Math.abs(backedKg + unbackedKg - totalKg) < 1e-9,
        `${name} ${m.key}: the two drawn parts must add back up to the sold figure`,
      );
      assert.equal(totalKg, m.soldKg ?? 0, `${name} ${m.key}: the bar's height IS the stated total`);
      assert.ok(
        backedKg <= (m.comparableProducedKg ?? 0) + 1e-9,
        `${name} ${m.key}: only a comparable farmer's own harvest may back a sale`,
      );
    }
    // And the window totals the headline prints stay the population totals, never the subset's.
    const summed = s.months.reduce((a, m) => a + (m.soldKg ?? 0), 0);
    if (s.totalSoldKg !== null) {
      assert.ok(Math.abs(summed - s.totalSoldKg) < 1e-9, `${name}: the Sold headline is the sum of the bars`);
    }
  }
});

/* ════════════════════════════════════════════════════════════════════════════
 * 5 — source shape: the broken shape cannot return
 * ══════════════════════════════════════════════════════════════════════════*/

const CHART = code('components/funder/CohortCharts.tsx');
const SERIES = code('lib/cohort-series.ts');

test('the chart never clamps a sold figure itself — the clamp shape cannot come back', () => {
  assert.ok(
    !/Math\.min\([^;]*soldKg/.test(CHART),
    'a Math.min() over soldKg in the chart is the exact bug: a clamp whose restoring outline is '
      + 'gated on a separate flag. The split belongs in lib/cohort-series.ts#soldBarParts, which '
      + 'returns the filled part and the outlined part together so they always add back up.',
  );
  assert.match(
    CHART,
    /import\s*\{[^}]*\bsoldBarParts\b[^}]*\}\s*from\s*'@\/lib\/cohort-series'/,
    'the chart must take the sold bar from the pure module',
  );
  assert.match(CHART, /map\(soldBarParts\)|soldBarParts\(/, 'and actually call it');
  for (const part of ['backedKg', 'unbackedKg', 'totalKg']) {
    assert.match(CHART, new RegExp(`\\b${part}\\b`), `the chart must draw ${part} — half a split is a clamp`);
  }
});

test('the chart has two drawings and picks between them on comparability alone', () => {
  assert.match(CHART, /series\.keptComparable/, 'the stack/side-by-side decision must be that flag');
  assert.match(CHART, /PairedKgColumn/, 'the stacked drawing, for one population');
  assert.match(CHART, /SplitKgColumn/, 'the side-by-side drawing, for two');
  // And the side-by-side case must SAY it, in words, on the card.
  assert.match(CHART, /populationSentence/, 'different farmer sets must be stated, not implied');
  assert.match(CHART, /comparableFarmers/, 'the count that makes that sentence specific');
});

test('comparability is decided per farmer, never with an every() over the cohort', () => {
  const decl = SERIES.slice(SERIES.indexOf('const keptComparable'), SERIES.indexOf('for (const bucket of months)'));
  assert.ok(decl.length > 0, 'keptComparable must still be computed in lib/cohort-series.ts');
  assert.ok(
    !/\.every\(/.test(decl),
    'an every() over the ledgers is what made one mixed-consent farmer switch the produced-vs-sold '
      + 'machinery off for the whole cohort. Compare the per-farmer counts instead.',
  );
  assert.match(decl, /comparableFarmers/, 'it must be a statement about the comparable population');
  // The per-farmer test itself, so the counts cannot quietly go back to a whole-series one.
  assert.match(SERIES, /l\.production !== null && l\.sales !== null/, 'a farmer is comparable only with BOTH books');
});

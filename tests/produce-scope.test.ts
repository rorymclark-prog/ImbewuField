import test from 'node:test';
import assert from 'node:assert/strict';

import {
  produceKindOf,
  perennialKeyForName,
  countsWithScope,
  DEFAULT_INCLUDE_PERENNIALS,
} from '@/lib/produce-scope';
import { PERENNIAL_PRODUCE } from '@/lib/perennial-produce';
import { buildFinanceSeries } from '@/lib/finance-series';
import { buildFarmMetrics } from '@/lib/farm-metrics';
import type { ProductionLog, SalesLog } from '@/lib/db/types';

const NOW = new Date(2026, 7, 15);

function harvest(crop: string, kg: number, at: string): ProductionLog {
  return { id: `h-${crop}-${at}`, profile_id: 'p', garden_id: null, crop, kg, photo_url: null, logged_at: at, created_at: at };
}
function sale(crop: string, kg: number, amount: number, at: string): SalesLog {
  return { id: `s-${crop}-${at}`, profile_id: 'p', garden_id: null, crop, kg, amount, buyer: null, sold_at: at, created_at: at };
}

test('produce scope: an annual, a perennial and a name of the farmer\'s own are told apart', () => {
  assert.equal(produceKindOf('Tomatoes'), 'annual');
  assert.equal(produceKindOf('Avocado'), 'perennial');
  // 'unknown' is a real answer, not a failure: every form lets a farmer type their own name and the
  // app has no basis for calling it one or the other.
  assert.equal(produceKindOf('Grandmother\'s special'), 'unknown');
  assert.equal(produceKindOf(''), 'unknown');
  assert.equal(produceKindOf('   '), 'unknown');
});

test('produce scope: the plural a farmer actually types resolves to the singular catalogue name', () => {
  // Nobody records "1 Avocado". They record avocados, mangoes, guavas.
  assert.equal(perennialKeyForName('Avocados'), perennialKeyForName('Avocado'));
  assert.ok(perennialKeyForName('Mangos') || perennialKeyForName('Mangoes'), 'no plural for mango');
  assert.equal(perennialKeyForName('  BANANAS  '), perennialKeyForName('Banana'));
  assert.equal(perennialKeyForName('not a fruit at all'), null);
});

test('produce scope: an annual crop wins a name tie with the orchard', () => {
  // The annual is the SCHEDULABLE one. If a name ever appeared in both lists, resolving it to the
  // perennial would drop that harvest out of the plan comparison for no reason the farmer can see.
  assert.equal(produceKindOf('Watermelon'), 'annual');
  assert.equal(produceKindOf('Sweet potato'), 'annual');
});

test('produce scope: switching the orchard off keeps everything else, including unknown names', () => {
  // Excluding what is KNOWN to be orchard produce is a claim the data supports. Claiming the
  // remainder is "vegetables only" is not — so a farmer's own typed name is never dropped.
  assert.equal(countsWithScope('Avocado', false), false);
  assert.equal(countsWithScope('Tomatoes', false), true);
  assert.equal(countsWithScope('Grandmother\'s special', false), true);
  for (const name of ['Avocado', 'Tomatoes', 'Grandmother\'s special']) {
    assert.equal(countsWithScope(name, true), true, `${name} dropped while the orchard was ON`);
  }
});

test('produce scope: on by default, because a total that quietly omits the orchard is the worse error', () => {
  assert.equal(DEFAULT_INCLUDE_PERENNIALS, true);
});

test('produce scope: the kilogram series drops orchard rows and says what it dropped', () => {
  const production = [
    harvest('Tomatoes', 10, '2026-08-04T08:00:00.000Z'),
    harvest('Avocados', 40, '2026-08-05T08:00:00.000Z'),
  ];
  const sales = [sale('Avocados', 40, 800, '2026-08-06T08:00:00.000Z')];

  const all = buildFinanceSeries(production, sales, [], [], NOW, 12);
  assert.equal(all.totalProducedKg, 50);
  assert.equal(all.excludedKg, 0);
  assert.deepEqual(all.excludedNames, []);

  const vegOnly = buildFinanceSeries(production, sales, [], [], NOW, 12, {
    countsKg: (name) => countsWithScope(name, false),
  });
  assert.equal(vegOnly.totalProducedKg, 10, 'the avocado harvest still counted');
  assert.equal(vegOnly.totalSoldKg, 0, 'the avocado sale still counted');
  // The honesty condition: 80 kg left out (40 picked + 40 sold), and the fruit named.
  assert.equal(vegOnly.excludedKg, 80);
  assert.deepEqual(vegOnly.excludedNames, ['Avocados']);
});

test('produce scope: the money is never filtered, only the kilograms', () => {
  // An invoice total can carry a delivery charge, a discount, or crates that never become
  // kilograms. Splitting it between vegetables and fruit would be a claim the invoice does not
  // make — and would break the rule that a paid invoice is counted exactly once.
  const sales = [
    sale('Avocados', 40, 800, '2026-08-06T08:00:00.000Z'),
    sale('Tomatoes', 5, 100, '2026-08-07T08:00:00.000Z'),
  ];
  const vegOnly = buildFinanceSeries([], sales, [], [], NOW, 12, {
    countsKg: (name) => countsWithScope(name, false),
  });
  assert.equal(vegOnly.totalInZar, 900, 'money in moved when the orchard was switched off');
  assert.equal(vegOnly.totalSoldKg, 5);
});

test('produce scope: a zero-kilogram orchard row is not reported as something hidden', () => {
  // A sale logged in rands with no weight has nothing to exclude, and naming it would send the
  // farmer looking for kilograms that were never recorded.
  const vegOnly = buildFinanceSeries([], [sale('Avocados', 0, 300, '2026-08-06T08:00:00.000Z')], [], [], NOW, 12, {
    countsKg: (name) => countsWithScope(name, false),
  });
  assert.equal(vegOnly.excludedKg, 0);
  assert.deepEqual(vegOnly.excludedNames, []);
  assert.equal(vegOnly.totalInZar, 300);
});

test('produce scope: two spellings of one fruit are named once each, in a stable order', () => {
  const production = [
    harvest('Mangoes', 5, '2026-08-04T08:00:00.000Z'),
    harvest('Avocado', 3, '2026-08-05T08:00:00.000Z'),
    harvest('Avocado', 2, '2026-08-06T08:00:00.000Z'),
  ];
  const vegOnly = buildFinanceSeries(production, [], [], [], NOW, 12, {
    countsKg: (name) => countsWithScope(name, false),
  });
  assert.equal(vegOnly.excludedKg, 10);
  assert.deepEqual(vegOnly.excludedNames, ['Avocado', 'Mangoes']);
});

test('produce scope: with no filter given, nothing is excluded and nothing is claimed to be', () => {
  const series = buildFinanceSeries([harvest('Avocados', 9, '2026-08-04T08:00:00.000Z')], [], [], [], NOW, 12);
  assert.equal(series.totalProducedKg, 9);
  assert.equal(series.excludedKg, 0);
  assert.deepEqual(series.excludedNames, []);
});

test('produce scope: every catalogue name resolves to its own fruit, never a neighbour\'s plural', () => {
  // The invariant behind the two-pass alias build. If one fruit's generated plural ever landed on
  // another fruit's real name, every log of the second would be filed under the first and nothing
  // on screen would show it happening.
  for (const produce of PERENNIAL_PRODUCE) {
    assert.equal(
      perennialKeyForName(produce.label), produce.key,
      `${produce.label} resolves to something else`,
    );
  }
});

test('produce scope: the per-square-metre card drops orchard produce and names it', () => {
  // A RULE, NOT A PREFERENCE, and so not wired to the switch at all: every figure on the Crop
  // performance card is per square metre of bed. A tree's fruit does not come off a bed, so a
  // kg/m² for it would rise without bound as the tree grew and mean nothing. Before this an
  // avocado appeared there reading "Planted area not recorded" in warning orange — an instruction
  // a tree can never carry out.
  const metrics = buildFarmMetrics([], [], [
    harvest('Tomatoes', 10, '2026-08-04T08:00:00.000Z'),
    harvest('Avocados', 40, '2026-08-05T08:00:00.000Z'),
  ], [sale('Avocados', 40, 800, '2026-08-06T08:00:00.000Z')], [], 'year', NOW, []);

  assert.deepEqual(metrics.crops.map((c) => c.cropName), ['Tomatoes']);
  assert.deepEqual(metrics.perennialProduceNames, ['Avocados']);
});

test('produce scope: taking the orchard off that card never moves the farm\'s money', () => {
  // The gross margin is built from the sales and invoices directly, not from the per-m² rows, so
  // an avocado sale is still the farm's income even though avocado is not a row above it.
  const metrics = buildFarmMetrics([], [], [], [
    sale('Avocados', 40, 800, '2026-08-06T08:00:00.000Z'),
    sale('Tomatoes', 5, 100, '2026-08-07T08:00:00.000Z'),
  ], [], 'year', NOW, []);
  const total = metrics.gardenMargins.reduce((s, m) => s + m.grossMarginZar, 0);
  assert.equal(total, 900, 'the avocado sale left the farm margin');
});

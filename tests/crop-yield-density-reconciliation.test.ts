import assert from 'node:assert/strict';
import test from 'node:test';

import { CROPS, plantsPerM2 } from '../lib/crop-catalog.ts';

// Density × yield reconciliation instrument (2026-08-19 audit).
//
// The catalog's plant spacing and its kg/m² planning yields come from different
// authorities (KZN DARD establishment tables vs conservative commercial yield
// lines) and were never reconciled against each other. Dividing one by the
// other gives the kg the catalog implicitly promises PER PLANT — and for several
// large-fruited crops that implied figure sits far below what a single fruit
// weighs (butternut: 0.72 kg/plant implied, while one butternut fruit alone is
// usually ≥1 kg and a plant typically bears several).
//
// This file changes NO catalog numbers — fixing an incoherence needs a named
// source, not code. It is a tripwire: any future edit to a spacing or a yield
// changes the implied kg/plant and fails here, forcing the editor to reconcile
// BOTH axes against sources before re-recording the value. The known-outlier
// list may only SHRINK; growing it (or raising its cap) without a named source
// is exactly the silent incoherence this instrument exists to block.

interface ImpliedRow { key: string; name: string; yieldKgPerM2: number; plantsPerM2: number; impliedKgPerPlant: number }

function computeImpliedTable(): ImpliedRow[] {
  const rows: ImpliedRow[] = [];
  for (const crop of CROPS) {
    if (crop.yieldKgPerM2 == null) continue; // no verified yield — nothing to reconcile
    const density = plantsPerM2(crop);
    if (!(density > 0)) continue; // no usable spacing geometry
    rows.push({
      key: crop.key,
      name: crop.name,
      yieldKgPerM2: crop.yieldKgPerM2,
      plantsPerM2: density,
      impliedKgPerPlant: crop.yieldKgPerM2 / density,
    });
  }
  return rows.sort((a, b) => a.impliedKgPerPlant - b.impliedKgPerPlant);
}

function tableText(rows: ImpliedRow[]): string {
  const lines = rows.map((r) =>
    `${r.key.padEnd(14)} yield=${r.yieldKgPerM2.toString().padStart(5)} kg/m²  density=${r.plantsPerM2.toFixed(3).padStart(8)} plants/m²  implied=${r.impliedKgPerPlant.toFixed(3)} kg/plant`);
  return `\nFull implied kg/plant table (yieldKgPerM2 ÷ plantsPerM2):\n${lines.join('\n')}\n`
    + 'A changed or new row means a spacing or yield edit: reconcile BOTH numbers against named sources '
    + '(docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md), then update RECORDED_IMPLIED_KG_PER_PLANT here. '
    + 'Do NOT add to KNOWN_OUTLIERS — that list only shrinks.\n';
}

/** Implied kg/plant recorded from the catalog as of 2026-08-19 (6 d.p.).
 * These are the catalog's own numbers restated, not agronomic claims. */
const RECORDED_IMPLIED_KG_PER_PLANT: Record<string, number> = {
  'oats': 0, // soil-cover crop: zero FOOD kg by design
  'groundnuts': 0.002812,
  'green-beans': 0.014438,
  'peas': 0.0156,
  'garlic': 0.019125,
  'carrots': 0.021,
  'beetroot': 0.021,
  'dry-beans': 0.0225,
  'onions': 0.02625,
  'broad-beans': 0.048,
  'maize': 0.06825,
  'broccoli': 0.121875,
  'lettuce': 0.162,
  'swiss-chard': 0.3,
  'potato': 0.3325,
  'sweet-potato': 0.463125,
  'peppers': 0.63,
  'cabbage': 0.66,
  'cucumber': 0.663,
  'butternut': 0.72,
  'watermelon': 1.221,
  'tomatoes': 1.4175,
  'pumpkin': 1.95,
};

/**
 * Crops the 2026-08-19 audit flagged as internally incoherent: the implied
 * kg/plant is a large factor below what one plant of the crop ordinarily
 * bears (for these large-fruited crops, often below the weight of a single
 * fruit). The recorded implied value is the catalog's own arithmetic; the
 * flag makes no replacement claim — resolving one needs a named source for
 * BOTH the spacing and the yield, after which the entry is REMOVED.
 */
const KNOWN_OUTLIERS: Record<string, number> = {
  'peppers': 0.63,
  'cucumber': 0.663,
  'butternut': 0.72, // audit's worked example: normal per-plant context 3–6 kg
  'watermelon': 1.221,
  'tomatoes': 1.4175,
  'pumpkin': 1.95,
};
/** The ratchet cap. Lowering it (after fixing a crop with sources) is the only allowed edit. */
const KNOWN_OUTLIER_CAP = 6;

test('every catalog crop with both spacing and yield matches its recorded implied kg/plant', () => {
  const rows = computeImpliedTable();
  const context = tableText(rows);

  assert.deepEqual(
    rows.map((r) => r.key).sort(),
    Object.keys(RECORDED_IMPLIED_KG_PER_PLANT).sort(),
    `the set of crops carrying both a spacing and a yield changed — record the new implied value only after source reconciliation${context}`,
  );

  for (const row of rows) {
    const recorded = RECORDED_IMPLIED_KG_PER_PLANT[row.key];
    const tolerance = recorded === 0 ? 1e-9 : recorded * 0.01;
    assert.ok(
      Math.abs(row.impliedKgPerPlant - recorded) <= tolerance,
      `${row.key}: implied kg/plant drifted from the recorded ${recorded} to ${row.impliedKgPerPlant.toFixed(3)} — a spacing or yield edit must reconcile both axes against named sources before re-recording${context}`,
    );
  }
});

test('the known density-yield outlier set does not grow', () => {
  const rows = computeImpliedTable();
  const context = tableText(rows);
  const outlierKeys = Object.keys(KNOWN_OUTLIERS);

  assert.ok(
    outlierKeys.length <= KNOWN_OUTLIER_CAP,
    `KNOWN_OUTLIERS grew past ${KNOWN_OUTLIER_CAP} — incoherent entries may not be waved through; fix the catalog numbers with named sources instead${context}`,
  );

  for (const [key, recorded] of Object.entries(KNOWN_OUTLIERS)) {
    const row = rows.find((r) => r.key === key);
    assert.ok(row, `outlier ${key} left the catalog or lost an axis — remove it from KNOWN_OUTLIERS${context}`);
    assert.ok(
      Math.abs(row!.impliedKgPerPlant - recorded) <= recorded * 0.01,
      `outlier ${key} changed (recorded ${recorded}, now ${row!.impliedKgPerPlant.toFixed(3)}) — if a sourced fix landed, remove it from KNOWN_OUTLIERS and lower KNOWN_OUTLIER_CAP${context}`,
    );
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { CROPS, MONTHS_SHORT } from '@/lib/crop-catalog';
import { harvestMonthForCrop, plannedBedEntryMonth } from '@/lib/crop-plan';

// The catalog header defines 'summer' as the hard-frost interior: real frost May-Aug,
// warm-season crops wait for it to pass. Until 2026-09-27 the column's late months
// still put frost-tender crops in the field through that frost before their first
// harvest — potatoes planted Feb/Mar, sweet potato and pumpkin in Dec, dry beans in
// Jan, amadumbe at all — and 65% of automatic summer plans contained one. A crop's
// frost exposure starts the month after sowing (emergence) or at transplant for a
// tray crop, and runs to its first harvest month.
const HARD_FROST_MONTHS = new Set([5, 6, 7, 8]);

function exposedMonths(sowMonth: number, crop: (typeof CROPS)[number]): number[] {
  const from = crop.transplant ? plannedBedEntryMonth(sowMonth, crop) : (sowMonth % 12) + 1;
  const firstHarvest = harvestMonthForCrop(sowMonth, crop);
  const span = (firstHarvest - from + 12) % 12;
  return Array.from({ length: span + 1 }, (_, i) => ((from - 1 + i) % 12) + 1);
}

test('no hard-frost sow month leaves a frost-tender crop in the field through frost before harvest', () => {
  const offenders: string[] = [];
  for (const crop of CROPS.filter((candidate) => candidate.frostTender)) {
    for (const sowMonth of crop.sowMonths.summer) {
      const frosted = exposedMonths(sowMonth, crop).filter((month) => HARD_FROST_MONTHS.has(month));
      if (frosted.length) {
        offenders.push(`${crop.key} sown ${MONTHS_SHORT[sowMonth - 1]} stands through ${frosted.map((m) => MONTHS_SHORT[m - 1]).join('/')}`);
      }
    }
  }
  assert.deepEqual(offenders, []);
});

test('the warm-season crops are flagged frost-tender', () => {
  for (const key of ['maize', 'dry-beans', 'green-beans', 'pumpkin', 'butternut', 'tomatoes', 'peppers',
    'chilli', 'sweet-potato', 'potato', 'amadumbe', 'groundnuts', 'cucumber', 'watermelon']) {
    assert.equal(CROPS.find((crop) => crop.key === key)?.frostTender, true, `${key} must be frostTender`);
  }
});

import { CROPS } from '@/lib/crop-catalog';
import { ECOCROP_HEAT_LIMITS_C } from '@/lib/crop-climate-gate';
import fs from 'node:fs';
fs.writeFileSync(process.argv[2], JSON.stringify(CROPS.map((c) => ({ key: c.key, name: c.name, sowMonths: c.sowMonths, daysToHarvest: c.daysToHarvest, daysToHarvestRange: c.daysToHarvestRange, transplant: !!c.transplant, frostTender: !!c.frostTender, harvestWindowMonths: c.harvestWindowMonths ?? 0, yieldKgPerM2: c.yieldKgPerM2, yieldRangeKgPerM2: c.yieldRangeKgPerM2, timingVerified: c.timingVerified !== false, heat: ECOCROP_HEAT_LIMITS_C[c.key] ?? null })), null, 1));

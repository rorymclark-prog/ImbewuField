import { perennialProduceByKey } from './perennial-produce';
import type { ProductionLog, SalesLog } from './db/types';

// Fictional bookkeeping exercises, not harvest forecasts or recommended prices.
// Keep names in the reviewed catalogue and orchard income out of vegetable-bed returns.
export const SAMPLE_ORCHARD = [
  { key: 'perennial:avocado', pickedKg: 24, soldKg: 18, price: 20 },
  { key: 'perennial:lemon', pickedKg: 18, soldKg: 12, price: 10 },
  { key: 'perennial:macadamia', pickedKg: 10, soldKg: 8, price: 30 },
  { key: 'perennial:mango', pickedKg: 30, soldKg: 24, price: 15 },
  { key: 'perennial:marula', pickedKg: 12, soldKg: 6, price: 10 },
].map(row => {
  const produce = perennialProduceByKey(row.key);
  if (!produce) throw new Error(`Missing reviewed sample produce: ${row.key}`);
  return { ...row, crop: produce.label };
});

export function sampleOrchardRecords(profileId: string, iso: string, suffix = 'current', selection = SAMPLE_ORCHARD) {
  const production: ProductionLog[] = selection.map(row => ({
    id: `${profileId}-orchard-picked-${suffix}-${row.key}`, profile_id: profileId,
    garden_id: null, crop: row.crop, kg: row.pickedKg, photo_url: null,
    logged_at: iso, created_at: iso,
  }));
  const sales: SalesLog[] = selection.map(row => ({
    id: `${profileId}-orchard-sold-${suffix}-${row.key}`, profile_id: profileId,
    garden_id: null, crop: row.crop, kg: row.soldKg, amount: row.soldKg * row.price,
    buyer: 'Mkuze produce stall', sold_at: iso, created_at: iso, enterprise: 'other',
  }));
  return { production, sales };
}

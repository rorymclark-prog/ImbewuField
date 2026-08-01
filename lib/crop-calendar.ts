import { cropByKey, type RainPattern } from '@/lib/crop-catalog';

export type PlantMark = 'B' | '';

/**
 * The calendar has no site-specific rainfall input, so it shows the catalog's
 * summer-rainfall window explicitly. The catalog supplies a window, not a
 * sourced best-versus-possible ranking; every included month therefore gets
 * the same recommended-window mark.
 */
export function sowMarksForPattern(catalogKey: string, pattern: RainPattern): PlantMark[] {
  const crop = cropByKey(catalogKey);
  if (!crop) return Array<PlantMark>(12).fill('');
  const sowMonths = new Set(crop.sowMonths[pattern]);
  return Array.from({ length: 12 }, (_, monthIndex) =>
    sowMonths.has(monthIndex + 1) ? 'B' : '',
  );
}

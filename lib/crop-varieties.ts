// Cultivar research per crop, grouped by the climate areas a site's data points to.
//
// The records are generated from the variety dossiers (scripts/build-crop-varieties.mjs);
// Every cultivar carries an outside reference, but the dossier's zone assignments
// can be researcher inferences from climate traits or a source's trial/market location.
// They are a shortlist for local checking, not proof that a cultivar was trialled at
// this farm. Nothing in sow timing or automatic planning reads this advice.

import { CROP_VARIETY_DATA } from './crop-varieties-data';
import type { GrowingZoneId } from './growing-zones';

export interface VarietySource {
  quote: string;
  url: string | null;
  doc: string;
  page: number | string | null;
}

export interface SourcedVariety {
  name: string;
  /** Research climate grouping; may be inferred rather than a source-named region.
   * Empty means the dossier recorded no grouping, not that the cultivar is unsuitable. */
  zones: GrowingZoneId[];
  season: string | null;
  maturity: string | null;
  traits: string | null;
  /** Research classification; some dossiers infer it from a name or breeding history.
   * It cannot by itself support a farmer-facing seed-saving instruction. */
  type: 'OP' | 'hybrid' | null;
  sources: VarietySource[];
}

export interface ZoneAdvice {
  text: string;
  sources: VarietySource[];
}

export interface CropVarietyRecord {
  varieties: SourcedVariety[];
  zoneAdvice: Partial<Record<GrowingZoneId, ZoneAdvice>>;
}

export interface VarietiesForSite {
  /** Research options grouped with at least one of the site's possible climate areas.
   * Matching is a shortlist, not cultivar-specific local validation. */
  forYourArea: SourcedVariety[];
  /** Other research options, including those without a recorded climate grouping. */
  others: SourcedVariety[];
  /** Research notes for possible climate areas, in the site's area order.
   * A note may apply a source's general climate rule to a research zone. */
  advice: { zone: GrowingZoneId; advice: ZoneAdvice }[];
}

export function cropVarietyRecord(cropKey: string): CropVarietyRecord | null {
  return (CROP_VARIETY_DATA as Record<string, CropVarietyRecord>)[cropKey] ?? null;
}

export function varietiesForSite(cropKey: string, zones: readonly GrowingZoneId[]): VarietiesForSite {
  const rec = cropVarietyRecord(cropKey);
  if (!rec) return { forYourArea: [], others: [], advice: [] };
  const inArea = (v: SourcedVariety) => v.zones.some((z) => zones.includes(z));
  return {
    forYourArea: rec.varieties.filter(inArea),
    others: rec.varieties.filter((v) => !inArea(v)),
    advice: zones.flatMap((zone) => {
      const advice = rec.zoneAdvice[zone];
      return advice ? [{ zone, advice }] : [];
    }),
  };
}

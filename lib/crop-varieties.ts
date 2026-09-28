// Sourced cultivars per crop, grouped by the growing zone(s) a site's climate points to.
//
// The records are generated from the variety dossiers (scripts/build-crop-varieties.mjs);
// every cultivar here carries at least one outside source. Advisory only, like the
// catalog's `varieties`: nothing in the sow-window or auto-suggest logic reads this.

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
  /** Zones the source named this cultivar for. Empty when the source named none. */
  zones: GrowingZoneId[];
  season: string | null;
  maturity: string | null;
  traits: string | null;
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
  /** Cultivars the source named for one of the site's zones. */
  forYourArea: SourcedVariety[];
  /** Everything else: named for other zones, or for no zone at all. */
  others: SourcedVariety[];
  /** Zone notes for the site's zones, in the site's zone order. */
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

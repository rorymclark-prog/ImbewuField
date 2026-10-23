// South Africa's eight growing zones, and which of them a site's own climate points to.
//
// The zones are the ones the variety research was filed under
// (research/crop-sources/_zones.json: definitions, Köppen classes, evidence and gaps).
// They exist for ONE job: telling a farmer which of a crop's sourced cultivars were
// named for an area like theirs. Sow timing never reads them — that stays on the four
// RainPattern columns in lib/crop-catalog.ts.
//
// WHY A SITE GETS A LIST, NOT ONE ZONE. The research could not separate every pair of
// zones from the data a site actually has (twelve monthly temperatures and rain totals;
// no elevation, no distance to the sea). Where it could not, both zones are returned and
// the UI names both, rather than choosing one and printing it as fact:
//   - Highveld vs Midlands/Mistbelt: same Köppen class (Cwb), same summer rain; the
//     research found no sourced coldest-month figure for the Midlands (_zones.json gaps).
//   - Lowveld vs Subtropical Coast: both warm with summer-dominant rain. Real Durban
//     normals put about two thirds of the year's rain in Oct-Mar, the same side of the
//     0.65 line as the Lowveld, so rain share cannot split them. The Köppen f/w letter
//     only orders the pair (f, rain in the dry season too, reads as coast first).
//   - Semi-arid steppe (BS) with summer rain: _zones.json lists BSk under BOTH highveld
//     and karoo-arid, and BSh under both lowveld-bushveld and karoo-arid (Free State
//     fringe, northern Limpopo bushveld). Desert (BW) is karoo-arid alone.
//   - Hard frost (coldest month under 7 °C, lib/koppen-global.ts's own threshold, whose
//     audit names the Lesotho border): high-mountain with highveld, since no elevation
//     field can confirm a site is actually alpine. Köppen Cwc is high-mountain alone.
//
// Every threshold below is one lib/koppen-global.ts already uses and tests; nothing new
// is invented here.

import {
  classifyKoppen,
  summerMonthIndices,
  HARD_FROST_COLDEST_MONTH_C,
  LIGHT_FROST_COLDEST_MONTH_C,
} from '@/lib/koppen-global';

export type GrowingZoneId =
  | 'highveld'
  | 'lowveld-bushveld'
  | 'subtropical-coast'
  | 'midlands-mistbelt'
  | 'western-cape'
  | 'southern-cape'
  | 'karoo-arid'
  | 'high-mountain';

export interface GrowingZone {
  id: GrowingZoneId;
  name: string;
  /** One line a farmer can recognise their area in (from _zones.json). */
  description: string;
}

export const GROWING_ZONES: Record<GrowingZoneId, GrowingZone> = {
  'highveld': { id: 'highveld', name: 'Highveld', description: 'Cold, summer-rain interior plateau with hard winter frost.' },
  'lowveld-bushveld': { id: 'lowveld-bushveld', name: 'Lowveld / Bushveld', description: 'Hot, summer-rain interior lowland, frost-free to light frost.' },
  'subtropical-coast': { id: 'subtropical-coast', name: 'Subtropical coast', description: 'Humid, frost-free coastal belt.' },
  'midlands-mistbelt': { id: 'midlands-mistbelt', name: 'Midlands / Mistbelt', description: 'Cool, moist, summer-rain upland with moderate frost.' },
  'western-cape': { id: 'western-cape', name: 'Western Cape', description: 'Winter rain with dry, hot summers.' },
  'southern-cape': { id: 'southern-cape', name: 'Southern Cape', description: 'Mild coastal strip with rain all year.' },
  'karoo-arid': { id: 'karoo-arid', name: 'Karoo / arid interior', description: 'Dry interior with severe clear-night frost; crops need irrigation.' },
  'high-mountain': { id: 'high-mountain', name: 'High mountain', description: 'Severe frost and a short growing season.' },
};

export const GROWING_ZONE_IDS = Object.keys(GROWING_ZONES) as GrowingZoneId[];

export function isGrowingZoneId(v: unknown): v is GrowingZoneId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(GROWING_ZONES, v);
}

/** "Highveld or Midlands / Mistbelt". */
export function growingZoneLabel(zones: readonly GrowingZoneId[]): string {
  const names = zones.map((z) => GROWING_ZONES[z].name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

/** Share of the year's rain falling Oct-Mar (southern hemisphere) — koppen-global's summer half. */
function summerRainShare(precipMm: number[], lat: number): number {
  const total = precipMm.reduce((s, p) => s + p, 0);
  if (total <= 0) return 1;
  return summerMonthIndices(lat).reduce((s, m) => s + precipMm[m], 0) / total;
}

/**
 * The growing zone(s) a site's own monthly climate points to, most likely first.
 * An empty list means the climate matched none of the rules (or the input was
 * unusable) — the UI then shows every variety without claiming an area.
 */
export function growingZonesForClimate(monthlyTempC: number[], monthlyRainMm: number[], lat: number): GrowingZoneId[] {
  const monthly = { tempC: monthlyTempC, precipMm: monthlyRainMm, lat };
  const koppen = classifyKoppen(monthly);
  if (koppen.code === '?') return [];

  const share = summerRainShare(monthlyRainMm, lat);
  const tCold = Math.min(...monthlyTempC);
  const tropical = koppen.group === 'A';
  const summerDominant = share >= 0.65;

  // Aridity first, exactly as classifyKoppen checks it first.
  if (koppen.group === 'B') {
    if (koppen.code.startsWith('BS') && summerDominant) {
      return tCold < LIGHT_FROST_COLDEST_MONTH_C ? ['highveld', 'karoo-arid'] : ['lowveld-bushveld', 'karoo-arid'];
    }
    return ['karoo-arid'];
  }
  if (koppen.code === 'Cwc') return ['high-mountain'];
  if (share <= 0.35) return ['western-cape'];
  if (!tropical && tCold < HARD_FROST_COLDEST_MONTH_C) return ['high-mountain', 'highveld'];

  if (summerDominant) {
    if (tropical || tCold >= LIGHT_FROST_COLDEST_MONTH_C) {
      return koppen.code[1] === 'f' ? ['subtropical-coast', 'lowveld-bushveld'] : ['lowveld-bushveld', 'subtropical-coast'];
    }
    return ['highveld', 'midlands-mistbelt'];
  }

  // Rain spread across the year (between the 35% and 65% lines).
  if (tropical || koppen.code === 'Cfa') return ['subtropical-coast'];
  if (koppen.code === 'Cfb' || koppen.code === 'Cfc') return ['southern-cape'];
  return [];
}

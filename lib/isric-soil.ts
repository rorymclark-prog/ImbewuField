import type { SoilData } from './types';

function textureClass(sand: number, clay: number, silt: number): string {
  if (clay >= 40) return 'Clay';
  if (clay >= 27 && silt >= 28) return 'Clay loam';
  if (clay >= 35 && sand >= 45) return 'Sandy clay';
  if (sand >= 85) return 'Sand';
  if (sand >= 70 && clay < 15) return 'Sandy loam';
  if (silt >= 80) return 'Silt';
  if (silt >= 50 && clay < 27) return 'Silt loam';
  if (clay >= 27 && sand < 20) return 'Silty clay loam';
  if (clay >= 20 && sand >= 45) return 'Sandy clay loam';
  if (clay < 27 && sand < 52) return 'Loam';
  return 'Sandy loam';
}

/**
 * The three SoilGrids v2.0 topsoil depths, with the centimetres each covers.
 *
 * `0-30cm` — what this file asked for until 2026-08-06 — IS NOT A SOILGRIDS
 * DEPTH. The API answers an unknown depth with HTTP 500, so `fetchSoilData`
 * threw on EVERY request, for every point on Earth, and the route substituted
 * its constant. That is why the app served Loam / pH 6.5 / 1.2% OC to every
 * site: not an outage, not a coverage gap, one wrong query parameter.
 * Confirmed at Ubhejane (-27.7262, 31.9632): `0-30cm` -> HTTP 500, while all
 * three depths below -> HTTP 200 with real values on the same day.
 *
 * SoilGrids publishes 0-5 / 5-15 / 15-30 separately, so the 0-30cm root zone
 * the app reasons about has to be assembled here. The weights are simply how
 * many centimetres each band contributes — a depth-weighted mean of measured
 * values, which invents nothing.
 */
const DEPTHS: { label: string; cm: number }[] = [
  { label: '0-5cm', cm: 5 },
  { label: '5-15cm', cm: 10 },
  { label: '15-30cm', cm: 15 },
];
const TOTAL_CM = DEPTHS.reduce((s, d) => s + d.cm, 0);

interface IsricLayer {
  name: string;
  unit_measure?: { d_factor?: number };
  depths?: { label: string; values?: { mean?: number | null } }[];
}

export async function fetchSoilData(lat: number, lon: number): Promise<SoilData> {
  // property and depth REPEAT as separate keys — SoilGrids does not accept a
  // comma-joined list, which is the other half of why the old call failed.
  const params = new URLSearchParams();
  params.set('lon', lon.toFixed(4));
  params.set('lat', lat.toFixed(4));
  for (const p of ['phh2o', 'soc', 'clay', 'sand', 'silt', 'bdod']) params.append('property', p);
  for (const d of DEPTHS) params.append('depth', d.label);
  params.set('value', 'mean');

  // Timeout matches lib/nasa-power.ts and lib/elevation.ts's sibling upstream calls in the same
  // /api/location-data request. Without it, a hung ISRIC response hung this request forever: it is
  // one of four calls awaited with Promise.allSettled, which does not settle until every one of
  // them does — so a farmer tapping the map got a spinner with no way to fail and no way to finish.
  const res = await fetch(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?${params}`,
    { signal: AbortSignal.timeout(8000), next: { revalidate: 86400 } } as RequestInit
  );

  if (!res.ok) {
    // The status and body, not just the status. The old message said only
    // "ISRIC API error: 500", which is exactly why a parameter bug survived
    // this long looking like an upstream outage.
    const body = await res.text().catch(() => '');
    throw new Error(`ISRIC API error: ${res.status} ${res.statusText} — ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const layers: IsricLayer[] = data?.properties?.layers ?? [];

  /**
   * Depth-weighted mean in the property's own real units.
   *
   * THROWS rather than substitutes. The previous version fell back to `?? 25`,
   * `?? 6.5`, `?? 1.0` per property INSIDE the fetcher, so a partial response
   * returned invented numbers that the route then tagged
   * `soilSource: 'soilgrids'` — a fallback wearing a real source's name, the
   * same defect the soilSource field was added to expose. A missing property
   * is a failed read, and the caller already handles a failed read honestly.
   */
  const weightedValue = (name: string): number => {
    const layer = layers.find((l) => l.name === name);
    if (!layer) throw new Error(`ISRIC returned no '${name}' layer for ${lat},${lon}`);
    // d_factor comes from the response itself rather than a hardcoded divisor,
    // so a units change upstream cannot silently rescale a farmer's soil.
    const factor = layer.unit_measure?.d_factor;
    if (!factor) throw new Error(`ISRIC gave no d_factor for '${name}' — cannot convert to real units`);

    let sum = 0;
    let cm = 0;
    for (const d of DEPTHS) {
      const mean = layer.depths?.find((x) => x.label === d.label)?.values?.mean;
      if (mean == null) continue; // a single missing band is tolerable; none is not
      sum += mean * d.cm;
      cm += d.cm;
    }
    if (cm === 0) throw new Error(`ISRIC has no topsoil values for '${name}' at ${lat},${lon}`);
    if (cm < TOTAL_CM) console.warn(`ISRIC: '${name}' covers only ${cm}/${TOTAL_CM}cm at ${lat},${lon}`);
    return sum / cm / factor;
  };

  const round = (v: number, dp: number) => parseFloat(v.toFixed(dp));
  const clay = round(weightedValue('clay'), 1);
  const sand = round(weightedValue('sand'), 1);
  const silt = round(weightedValue('silt'), 1);

  // soc IS THE ONE PROPERTY d_factor DOES NOT FINISH. d_factor takes the stored
  // integer to the property's CONVENTIONAL unit, and those units differ: clay,
  // sand and silt land directly on % and pH lands on pH, but soc lands on g/kg,
  // which is a further factor of 10 away from the % this app stores and prints.
  // Caught by reading the output, not by a test: the first run returned 18.18,
  // and 18% organic carbon is a peat bog, not a Zululand sandy clay loam. (The
  // pre-2026-08-06 code had the same missing step — `socRaw / 10` commented
  // "dg/kg -> divide by 10 = %" — but it never surfaced, because the 0-30cm
  // parameter meant this function threw before it could ever return a number.)
  const organicCarbonPct = weightedValue('soc') / 10;

  return {
    textureClass: textureClass(sand, clay, silt),
    ph: round(weightedValue('phh2o'), 1),
    organicCarbon: round(organicCarbonPct, 2),
    clay,
    sand,
    silt,
    bulkDensity: round(weightedValue('bdod'), 2),
  };
}

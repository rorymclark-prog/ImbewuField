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

export async function fetchSoilData(lat: number, lon: number): Promise<SoilData> {
  const params = new URLSearchParams({
    lon: lon.toFixed(4),
    lat: lat.toFixed(4),
    property: 'phh2o,soc,clay,sand,silt,bdod',
    depth: '0-30cm',
    value: 'mean',
  });

  const res = await fetch(
    `https://rest.isric.org/soilgrids/v2.0/properties/query?${params}`,
    { next: { revalidate: 86400 } }
  );

  if (!res.ok) throw new Error(`ISRIC API error: ${res.status}`);
  const data = await res.json();

  const getValue = (name: string): number => {
    const layer = data.properties.layers.find((l: { name: string }) => l.name === name);
    return layer?.depths?.[0]?.values?.mean ?? null;
  };

  const phRaw = getValue('phh2o');      // pH * 10
  const socRaw = getValue('soc');       // dg/kg → divide by 10 = %
  const clayRaw = getValue('clay');     // g/kg → divide by 10 = %
  const sandRaw = getValue('sand');
  const siltRaw = getValue('silt');
  const bdRaw = getValue('bdod');       // cg/cm³ → divide by 100 = g/cm³

  const clay = clayRaw != null ? parseFloat((clayRaw / 10).toFixed(1)) : 25;
  const sand = sandRaw != null ? parseFloat((sandRaw / 10).toFixed(1)) : 50;
  const silt = siltRaw != null ? parseFloat((siltRaw / 10).toFixed(1)) : 25;

  return {
    textureClass: textureClass(sand, clay, silt),
    ph: phRaw != null ? parseFloat((phRaw / 10).toFixed(1)) : 6.5,
    organicCarbon: socRaw != null ? parseFloat((socRaw / 10).toFixed(2)) : 1.0,
    clay,
    sand,
    silt,
    bulkDensity: bdRaw != null ? parseFloat((bdRaw / 100).toFixed(2)) : 1.3,
  };
}

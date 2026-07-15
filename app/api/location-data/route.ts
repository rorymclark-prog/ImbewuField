import { NextRequest, NextResponse } from 'next/server';
import { fetchNasaPower } from '@/lib/nasa-power';
import { fetchSoilData } from '@/lib/isric-soil';
import { fetchElevation } from '@/lib/elevation';
import { fetchVegetation } from '@/lib/sanbi';
import { classifyBiome } from '@/lib/biome';
import { lookupBRU } from '@/lib/bru';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lon = parseFloat(searchParams.get('lon') ?? '');

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
  }

  try {
    // Fetch all data sources in parallel
    const [nasaResult, soil, elevation, vegetation] = await Promise.allSettled([
      fetchNasaPower(lat, lon),
      fetchSoilData(lat, lon),
      fetchElevation(lat, lon),
      fetchVegetation(lat, lon),
    ]);

    const { rainfall, climate } =
      nasaResult.status === 'fulfilled'
        ? nasaResult.value
        : {
            rainfall: {
              monthly: Array(12).fill(50) as number[],
              annual: 600, pattern: 'summer' as const,
              wetSeason: 'Oct–Mar', drySeason: 'May–Aug',
            },
            climate: defaultClimate(),
          };

    const soilData =
      soil.status === 'fulfilled' ? soil.value : defaultSoil();

    const elevData =
      elevation.status === 'fulfilled' ? elevation.value : defaultElevation();

    const biome = classifyBiome(
      lat, lon,
      rainfall.annual,
      climate.minTemp,
      rainfall.monthly
    );

    const veg = vegetation.status === 'fulfilled' ? vegetation.value : null;

    // KZN-only finer zone (bundled BRU data — see lib/bru.ts). Never throws;
    // returns null outside KZN or if no polygon match, so classifyBiome's
    // result and non-KZN behavior are always unaffected.
    let bru = null;
    try {
      bru = lookupBRU(lat, lon);
    } catch (err) {
      console.error('BRU lookup error:', err);
    }

    return NextResponse.json({ lat, lon, biome, rainfall, climate, soil: soilData, elevation: elevData, vegetation: veg, bru });
  } catch (err) {
    console.error('location-data error:', err);
    return NextResponse.json({ error: 'Failed to fetch location data' }, { status: 500 });
  }
}

function defaultClimate() {
  return { meanTemp: 18, maxTemp: 28, minTemp: 8, monthlyTemp: Array(12).fill(18), solarRadiation: 5.5, koppen: '?', koppenDesc: 'Unknown', windSpeed: 3, windFromSummer: '—', windFromWinter: '—' };
}

function defaultSoil() {
  return { textureClass: 'Loam', ph: 6.5, organicCarbon: 1.2, clay: 25, sand: 45, silt: 30, bulkDensity: 1.3 };
}

function defaultElevation() {
  return { elevation: 0, slopeDeg: 0, slopePct: 0, aspectDeg: 0, aspectLabel: 'N' };
}

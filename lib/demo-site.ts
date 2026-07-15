// Curated read-only fixture data for the "Show me an example" demo (/example).
// Pure data only — no I/O, no localStorage, nothing that touches a real
// farmer's saved places/reports. Safe to import from a display-only page.
//
// DEMO_LOCATION is a real captured API response for a KwaZulu-Natal Highveld
// grassland site near Ezakheni (lat -28.628, lon 29.891), pasted as a typed
// literal so the example report shows genuine numbers rather than invented
// placeholders.

import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { CompletionScoreInputs } from '@/lib/completion-score';

export const DEMO_COORDS = { lat: -28.628, lon: 29.891 };

export const DEMO_LOCATION: LocationData = {
  lat: -28.628,
  lon: 29.891,
  biome: {
    name: 'Grassland',
    code: 'GR',
    description: 'Highveld temperate grassland, summer rainfall, cold frosty winters',
    color: '#9FC169',
    rainfallPattern: 'summer',
    meanRainfall: '500–900mm',
    keySpecies: ['Buffalo Thorn', 'Wild Olive', 'Highveld Protea', 'Rooigrass', 'Bulbine', 'Wild Garlic'],
    soilType: 'Red/yellow apedal soils, moderate depth, clay-rich on Highveld',
    waterStrategy: 'Heavy summer thunderstorms (short, intense). Keyline design on all slopes — angle swales 1:1000 off true contour to move water across hillside. Winter dry → storage essential. Roof: 1m² = 1L per 1mm rain.',
    soilStrategy: 'Often compacted by livestock. Subsoil aeration before earthworks. Oats/vetch winter cover crops. pH usually 5.5–6.5, add agricultural lime if below 5.5. Build OM with compost + biochar.',
    challenges: ['Hard frosts (–5°C to –10°C)', 'Hail', 'Erodible clay soils on slopes', 'Vlei (wetland) drainage issues'],
  },
  rainfall: {
    monthly: [133.6, 107, 86.5, 47.7, 11.8, 12, 12.1, 18.6, 36.9, 82.1, 110.7, 132.4],
    annual: 791,
    pattern: 'summer',
    wetSeason: 'Oct–Mar',
    drySeason: 'May–Aug',
    rainfallSource: 'nasa-power',
  },
  climate: {
    meanTemp: 18.1,
    maxTemp: 42.1,
    minTemp: -2.3,
    monthlyTemp: [22.72, 22.25, 20.78, 17.67, 14.78, 11.6, 11.54, 14.43, 17.92, 19.83, 21.08, 22.4],
    solarRadiation: 5.3,
    koppen: 'Dwb',
    koppenDesc: 'Cold continental highland',
    windSpeed: 2.2,
    windFromSummer: 'E',
    windFromWinter: 'NW',
  },
  soil: {
    textureClass: 'Loam',
    ph: 6.5,
    organicCarbon: 1.2,
    clay: 25,
    sand: 45,
    silt: 30,
    bulkDensity: 1.3,
  },
  elevation: {
    elevation: 962,
    slopeDeg: 1.3,
    slopePct: 2.3,
    aspectDeg: 355,
    aspectLabel: 'N',
  },
  vegetation: {
    vegUnit: 'Thukela Thornveld',
    biome: 'Savanna',
    bioregion: 'Sub-Escarpment Savanna Bioregion',
  },
  bru: {
    brucode: 'Tc1',
    bruParent: 'Tc1',
    map: 723,
    tmin: -6.5,
    tmean: 18.1,
    tmax: 40.1,
    nearestBrg: 'Dry Tall Grassveld',
    isApproximateName: true,
    attribution: 'Zone data: KZN DARD Bioresource Units',
  },
};

export const DEMO_SITE_DATA: SiteData = {
  areaM2: 4500,
  areaHa: 0.45,
  perimeterM: 280,
  perimeterKm: 0.28,
  count: 1,
  features: [{ name: 'Home field', category: 'Field', areaHa: 0.45 }],
};

export const DEMO_WATER_DATA: WaterData = {
  count: 1,
  areaM2: 120,
  estVolumeKL: 180,
  avgDepthM: 1.5,
  features: [{ name: 'Roof + tank', category: 'Roof catchment', estVolumeKL: 180 }],
};

// A fully-complete site so the demo's completion donut shows 100% — this is
// a showcase of the finished state, not a sample in-progress site.
export const DEMO_COMPLETION: CompletionScoreInputs = {
  hasSite: true,
  boundaryPointCount: 3,
  surveyFilledFields: 10,
  surveyTotalFields: 10,
  zoneCount: 5,
  elementCount: 8,
  hasCropPlan: true,
};

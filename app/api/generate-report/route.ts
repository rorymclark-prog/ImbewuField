import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { SiteSurvey } from '@/lib/site-survey';
import { surveyToPrompt } from '@/lib/site-survey';
import { deriveSolar, isValidEarthLatitude } from '@/lib/solar';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { WATER_SHEET_ROOF_RUNOFF_COEFFICIENT } from '@/lib/roof-runoff';
import type { DesignLayer } from '@/lib/design-studio';
import type { PhasePlan } from '@/lib/phasing';
import {
  assuranceMarkdown,
  buildReportHeaderMarkdown,
  cropPlanPromptBlock,
  designPromptBlock,
  irrigationRowsBlock,
  measurementsPromptBlock,
  normaliseReportSiteFacts,
  roofCalcLine,
  waterPromptBlock,
  zonePromptBlock,
  type ReportSiteFacts,
} from '@/lib/report-site-facts';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Canonical section names — every literal used in sections.includes() checks below
// plus the batch logic. Any value not in this set is silently dropped before any
// Anthropic call is made.
const KNOWN_SECTIONS = new Set([
  'Executive Summary',
  'Site Conditions',
  'Natural Vegetation & Biome',
  'Water Harvesting',
  'Soil Strategy',
  'Planting Calendar',
  'Fruit, Nut & Berry Trees',
  'Indigenous Trees',
  'Agroecosystem Planting Guide',
  'Crop Rotation',
  'Irrigation Plan',
  'Year-Round Food Production',
  'Animals & Livestock',
  'Sun & Solar',
  'Wind & Windbreaks',
  'Fire & Hazards',
  'Economic Opportunities',
  'Plant Guilds',
  'Zone Design',
  'Seasonal Calendar',
  '5-Year Vision',
  'Year 1 Priorities',
]);

// Reverse-geocode coordinates → SA administrative area (municipality / district / province).
// Used so the report can name the real municipality and ground market-gap advice in the right place.
async function reverseGeocode(lat: number, lon: number): Promise<{ municipality: string | null; district: string | null; province: string | null; label: string | null } | null> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&zoom=10&addressdetails=1`,
      { headers: { 'User-Agent': 'ImbewuField/1.0', 'Accept-Language': 'en' }, signal: AbortSignal.timeout(6000) },
    );
    if (!res.ok) return null;
    const j = await res.json();
    const a = j.address ?? {};
    const municipality = a.municipality ?? a.city ?? a.town ?? a.village ?? a.suburb ?? null;
    const district = a.county ?? a.state_district ?? a.district ?? null;
    const province = a.state ?? null;
    const label = [municipality, district, province].filter(Boolean).join(', ') || j.display_name || null;
    if (!municipality && !district && !province) return null;
    return { municipality, district, province, label };
  } catch {
    return null;
  }
}

const LANGUAGES: Record<string, string> = {
  en: 'English',
  af: 'Afrikaans',
  zu: 'isiZulu',
  xh: 'isiXhosa',
  st: 'Sesotho (Southern Sotho)',
  nso: 'Sepedi (Northern Sotho)',
  tn: 'Setswana',
  ts: 'Xitsonga',
  ve: 'Tshivenda',
  ss: 'siSwati',
  nr: 'isiNdebele',
};

const MONTH_INDEX = new Map(MONTHS.map((month, index) => [month.toLowerCase(), index]));

function drySeasonMonthIndices(drySeason: string, pattern: string): number[] {
  const namedMonths = [...drySeason.matchAll(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/gi)]
    .map((match) => MONTH_INDEX.get(match[0].toLowerCase()))
    .filter((month): month is number => month !== undefined);
  if (namedMonths.length >= 2) {
    const [start, end] = namedMonths;
    const months: number[] = [];
    for (let month = start, count = 0; count < 12; count += 1) {
      months.push(month);
      if (month === end) return months;
      month = (month + 1) % 12;
    }
    return months;
  }
  if (namedMonths.length === 1) return namedMonths;
  if (pattern === 'summer') return [4, 5, 6, 7]; // May–Aug, the catalogued summer-rainfall dry season
  if (pattern === 'winter') return [10, 11, 0, 1, 2]; // Nov–Mar, the catalogued winter-rainfall dry season
  return [];
}

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/generate-report');
  if (auth.response) return auth.response;
  let body: {
    locationData: LocationData;
    photoAnalysis?: string;
    siteData?: SiteData;
    waterData?: WaterData;
    studioLayers?: DesignLayer[];
    /** What the farmer actually drew and recorded — see lib/report-site-facts.ts. Untyped here on
     *  purpose: it crosses the wire from a client we do not control and is validated, not trusted. */
    siteFacts?: unknown;
    phasePlan?: PhasePlan;
    surveyData?: SiteSurvey;
    evidenceData?: Record<string, { count: number; notes: string[] }>;
    sections: string[];
    language?: string;
    bilingual?: boolean;
    tone?: 'simple' | 'professional';
    length?: 'one-pager' | 'standard' | 'comprehensive';
  };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const { locationData, photoAnalysis, siteData, waterData, phasePlan, surveyData, evidenceData, sections, language, bilingual, tone, length } = body;

  // The farmer's drawn geometry, validated. `studioLayers` (the old approved-DesignLayer path) is
  // deliberately no longer read: nothing in the app ever sets `approved: true`, so the branch that
  // consumed it could never run and every report printed "no design exists" over a finished plan.
  const facts: ReportSiteFacts | null = normaliseReportSiteFacts(body.siteFacts);

  // DoS hardening: drop any section name not in the canonical allow-list so an
  // attacker cannot drive unbounded parallel Anthropic calls via a crafted request.
  const safeSections = (Array.isArray(sections) ? sections : []).filter(
    (s) => KNOWN_SECTIONS.has(s),
  );
  if (safeSections.length === 0) {
    return new Response(JSON.stringify({ error: 'No valid sections requested.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Validate locationData shape before any field access to avoid unhandled 500s.
  if (
    !locationData ||
    typeof locationData.lat !== 'number' ||
    !isValidEarthLatitude(locationData.lat) ||
    typeof locationData.lon !== 'number' ||
    !Number.isFinite(locationData.lon) ||
    locationData.lon < -180 ||
    locationData.lon > 180 ||
    !locationData.rainfall?.monthly ||
    !Array.isArray(locationData.rainfall.monthly) ||
    !locationData.elevation?.aspectLabel ||
    !locationData.soil ||
    !locationData.biome?.keySpecies ||
    !locationData.climate
  ) {
    return new Response(JSON.stringify({ error: 'locationData is missing required fields' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const langCode = language ?? 'en';
  const langName = LANGUAGES[langCode] ?? 'English';
  const isSimple = tone === 'simple';
  const reportLength = length ?? 'standard';

  // ── Language instruction ──────────────────────────────
  let languageInstruction = '';
  if (langCode !== 'en' && bilingual) {
    languageInstruction = `\n\n🌍 LANGUAGE: Write this report BILINGUALLY. For every heading and every paragraph/bullet, write it FIRST in ${langName}, then immediately below give the English version in italics. Keep both versions simple and aligned. Plant/species names may stay in English or Latin where no local word exists.`;
  } else if (langCode !== 'en') {
    languageInstruction = `\n\n🌍 LANGUAGE: Write the ENTIRE report in ${langName}. Use natural, everyday ${langName} that an ordinary person speaks — not formal or academic ${langName}. Plant and species names may stay in English or Latin where there is no common local word, with a short ${langName} description.`;
  }

  // ── Tone instruction ──────────────────────────────────
  const toneInstruction = isSimple
    ? `\n\n👤 AUDIENCE & TONE: The reader is a small-scale farmer who may have only basic schooling and little technical training. Write in VERY SIMPLE, short sentences. Use plain everyday words. Avoid jargon — if you must use a technical word (like "swale" or "pH"), explain it in a few plain words right after, e.g. "a swale (a shallow ditch that catches rain)". Be warm, direct and encouraging. Use practical, real-life examples. Numbers should be rounded and easy. Think: explaining to a neighbour, not writing for a university.`
    : `\n\n👤 AUDIENCE & TONE: A professional, publication-quality document. Use precise language, real calculations, and correct technical terms.`;

  // ── Length instruction ────────────────────────────────
  const lengthInstruction =
    reportLength === 'one-pager'
      ? `\n\n📏 LENGTH — ONE PAGE ONLY: This must fit on a single page. Be extremely concise. For each requested section give only the 2–3 MOST important points as short bullets. NO tables, NO long explanations, NO calculations shown. Total well under 450 words. Lead with what to DO.`
      : reportLength === 'comprehensive'
      ? `\n\n📏 LENGTH — COMPREHENSIVE: A thorough, detailed report. Use the full structure for each section including all tables and calculations. Be complete.`
      : `\n\n📏 LENGTH — STANDARD: A focused, practical report. Cover each section usefully but stay concise — keep tables small and explanations tight.`;

  const d = locationData;
  // Real administrative area for this point (municipality / district / province)
  const admin = await reverseGeocode(d.lat, d.lon);
  const rainStr = d.rainfall.monthly.map((v, i) => `${MONTHS[i]}:${Math.round(v)}mm`).join(' · ');
  const facingNote = d.elevation.aspectLabel.includes('N')
    ? 'north-facing (warmer/drier in southern hemisphere)'
    : d.elevation.aspectLabel.includes('S')
    ? 'south-facing (cooler/moister in southern hemisphere)'
    : 'lateral slope';

  // Sun geometry from latitude (pure astronomy) — noon sun elevation + day length at solstices.
  // Uses lib/solar.deriveSolar (SECTOR-MODEL-SPEC §0.2/§1) rather than a hardcoded "sun is always
  // in the north" claim — false for any site inside the tropics (northernmost SA ≈ -22.13°, north
  // of the Tropic of Capricorn at -23.4359°), where the two solstices can disagree on which side
  // the noon sun sits (`middayFrom === 'mixed'`).
  const DECL = 23.44;
  const dayLen = (decl: number) => {
    const cosH = -Math.tan((d.lat * Math.PI) / 180) * Math.tan((decl * Math.PI) / 180);
    const H = Math.acos(Math.max(-1, Math.min(1, cosH)));
    return ((2 * H * 180) / Math.PI / 15).toFixed(1);
  };
  const solar = deriveSolar(d.lat);
  const sunSummerNoon = Math.round(solar.summer.noonAltitudeDeg);
  const sunWinterNoon = Math.round(solar.winter.noonAltitudeDeg);
  const compassWord = (side: 'N' | 'S' | 'overhead') =>
    side === 'N' ? 'NORTH' : side === 'S' ? 'SOUTH' : 'OVERHEAD';
  const winterShadowSide = solar.winter.noonSide === 'N'
    ? 'SOUTH'
    : solar.winter.noonSide === 'S'
    ? 'NORTH'
    : 'directly below the sun';
  const sunSkyText =
    solar.middayFrom === 'N'
      ? `Sun is in the ${compassWord(solar.summer.noonSide)} sky at midday → north-facing aspects get the most sun, south-facing are shaded/cooler.`
      : solar.middayFrom === 'S'
      ? `Sun is in the ${compassWord(solar.winter.noonSide)} sky at midday → south-facing aspects get the most sun, north-facing are shaded/cooler.`
      : `This site sits inside the tropics — the midday sun swings sides through the year (from the ${compassWord(solar.winter.noonSide)} in winter to the ${compassWord(solar.summer.noonSide)} in summer), so both north- and south-facing aspects get strong sun at different times of year.`;
  const sunData = `${sunSkyText} Noon sun elevation: ~${sunSummerNoon}° in summer (high), ~${sunWinterNoon}° in winter (low — longest shadows toward the ${winterShadowSide}). Day length: ~${dayLen(-DECL)}h summer / ~${dayLen(DECL)}h winter.`;
  const dryMonths = drySeasonMonthIndices(d.rainfall.drySeason, d.rainfall.pattern);
  const drySeasonRainMm = dryMonths.reduce((total, month) => total + (d.rainfall.monthly[month] ?? 0), 0);
  const summerSunSide = compassWord(solar.summer.noonSide);
  const winterSunSide = compassWord(solar.winter.noonSide);
  const preferredSunSide = solar.middayFrom === 'mixed'
    ? `${summerSunSide} in summer and ${winterSunSide} in winter`
    : compassWord(solar.middayFrom);

  // ── SITE BOUNDARY ────────────────────────────────────────────────────────────
  // siteData is the SUM of every non-water polygon on the map (components/Map.tsx), so a farm that
  // has traced its house roof and driveway INSIDE its own boundary has its land counted twice —
  // Ubhejane reports 1,232 m² against a traced boundary of 1,037 m², and that ~19% error then
  // propagates into catchment, swale count and carrying capacity. The traced boundary ring is the
  // honest figure and wins whenever one exists; the sum stays as a labelled fallback, and its
  // compactness ratio (a shape metric of nothing, over a mixed sum) is not printed for it.
  const boundaryFact = facts?.boundary;
  const boundaryBlock = boundaryFact
    ? `\nSITE BOUNDARY (traced by the farmer — measured, not estimated)
Area: ${Math.round(boundaryFact.areaM2).toLocaleString()} m² (${(boundaryFact.areaM2 / 10000).toFixed(boundaryFact.areaM2 < 10000 ? 3 : 2)} ha)${boundaryFact.perimeterM ? `\nPerimeter: ${Math.round(boundaryFact.perimeterM).toLocaleString()} m` : ''}
Source: ${boundaryFact.source}${boundaryFact.label ? ` — "${boundaryFact.label}"` : ''}
Use these exact figures in all calculations and scale every recommendation to this size.${siteData && Math.abs(siteData.areaM2 - boundaryFact.areaM2) > boundaryFact.areaM2 * 0.05 ? `\nNOTE: the map also holds other traced shapes (roof, driveway) that sit INSIDE this boundary; their combined total is ${siteData.areaM2.toLocaleString()} m². Do not add them to the boundary — the property is ${Math.round(boundaryFact.areaM2).toLocaleString()} m².` : ''}`
    : siteData
    ? `\nMAPPED SITE AREA (the SUM of every shape drawn on the map — not one traced boundary)
Total area of all drawn shapes: ${siteData.areaHa} ha (${siteData.areaM2.toLocaleString()} m²) across ${siteData.count ?? 1} shape(s)
Combined perimeter: ${siteData.perimeterKm} km (${siteData.perimeterM.toLocaleString()} m)
Treat this as an upper bound on the property, not a measured boundary — shapes drawn inside one another are counted twice. Say so if you lean on it heavily.`
    : '\n(No site boundary drawn or traced — give general recommendations scalable to the property, and say the site size is not known)';

  // Which area figure the per-hectare maths is allowed to use, and what it honestly is.
  const siteAreaForCalcM2 = boundaryFact?.areaM2 ?? siteData?.areaM2 ?? null;
  const siteAreaSourceNote = boundaryFact ? 'traced boundary' : 'sum of all drawn shapes — an upper bound';

  const buildPrompt = (sections: string[], withTitle: boolean) => `You are an expert permaculture designer creating a permaculture site report for a small-scale farmer in South Africa. Name REAL species suited to the site, give practical actions, and use the actual site data. No generic permaculture theory.${languageInstruction}${toneInstruction}${lengthInstruction}

---
SITE DATA
Biome: ${d.biome.name} (${d.biome.code}) — ${d.biome.description}${d.vegetation ? `\nExact vegetation type (SANBI 2018 National Vegetation Map): ${d.vegetation.vegUnit} — biome ${d.vegetation.biome}. Use this precise vegetation unit to name truly local indigenous species and the natural plant community.` : ''}${d.bru ? `\nKZN Bioresource Unit (KZN DARD): zone ${d.bru.brucode} (parent ${d.bru.bruParent}), closest matching Bioresource Group: ${d.bru.nearestBrg} — this is a BEST-EFFORT climate-similarity match, NOT a verified BRU→BRG crosswalk, so name it as approximate, never as confirmed fact. Zone temperature range ${d.bru.tmin}–${d.bru.tmax}°C (mean ${d.bru.tmean}°C). Use this as extra agro-ecological zone context (e.g. frost/mistbelt character, local grassveld type) alongside the vegetation unit above. Do NOT quote the BRU's own zone-average rainfall as a rainfall figure — Annual rainfall below is the ONLY rainfall number to use; never present two conflicting rainfall figures.` : ''}
Coordinates: ${Math.abs(d.lat).toFixed(4)}°S, ${d.lon.toFixed(4)}°E
${admin ? `Administrative area (reverse-geocoded — use these REAL names, do not invent): ${admin.label}${admin.municipality ? `\n  · Local municipality: ${admin.municipality}` : ''}${admin.district ? `\n  · District municipality: ${admin.district}` : ''}${admin.province ? `\n  · Province: ${admin.province}` : ''}` : 'Administrative area: identify the local & district municipality and province from the coordinates.'}
Elevation: ${d.elevation.elevation}m ASL · Slope: ${d.elevation.slopeDeg}° (${d.elevation.slopePct}%) · Aspect: ${d.elevation.aspectLabel} (${facingNote})

CLIMATE
Köppen: ${d.climate.koppen} (${d.climate.koppenDesc})
Annual rainfall: ${d.rainfall.annual}mm · Pattern: ${d.rainfall.pattern}
Wet season: ${d.rainfall.wetSeason} · Dry season: ${d.rainfall.drySeason}
Summer max: ${d.climate.maxTemp}°C · Winter min: ${d.climate.minTemp}°C · Mean: ${d.climate.meanTemp}°C
Solar radiation: ${d.climate.solarRadiation} kWh/m²/day · Monthly rain: ${rainStr}
Wind: mean ${d.climate.windSpeed} m/s · prevailing FROM ${d.climate.windFromSummer} in summer, FROM ${d.climate.windFromWinter} in winter (place windbreaks on these sides)
Sun: ${sunData}

SOIL (ISRIC 0–30cm)
Texture: ${d.soil.textureClass} · pH: ${d.soil.ph} · Organic carbon: ${d.soil.organicCarbon}%
Clay: ${d.soil.clay}% · Sand: ${d.soil.sand}% · Silt: ${d.soil.silt}% · Bulk density: ${d.soil.bulkDensity} g/cm³

BIOME KEY SPECIES: ${d.biome.keySpecies.join(', ')}
BIOME CHALLENGES: ${d.biome.challenges.join(' · ')}
${boundaryBlock}
${waterData ? `\nWATER STORAGE POLYGONS (user-drawn on map)
${waterData.count} water storage feature(s) drawn — total surface area ${waterData.areaM2.toLocaleString()} m².
Estimated capacity: ~${waterData.estVolumeKL.toLocaleString()} kL (${(waterData.estVolumeKL * 1000).toLocaleString()} L), assuming ${waterData.avgDepthM}m average depth.
Use this existing/planned storage in the water plan: compare it to the dry-season demand and rainfall capture, and say whether it is enough or more is needed. Treat the estimate as approximate (real depth varies).` : ''}

${waterPromptBlock(facts, Boolean(waterData))}

${facts ? designPromptBlock(facts) : `DESIGN AS DRAWN
No design has been drawn for this site yet. Do not describe a drawn layout, a bed count or a planted area as if one exists.`}${phasePlan && phasePlan.phases.length > 0 ? `

BUILD PHASES (derived from the same drawn design — the farmer's own build programme)
${phasePlan.phases.map((phase) => `Phase ${phase.n} — ${phase.title} (${phase.weekRange})\n  Tasks: ${phase.tasks.join(' · ')}\n  Hold point: ${phase.holdPoint}`).join('\n')}
Critical order: ${phasePlan.criticalOrder.join(' → ')}
Site rules: ${phasePlan.siteRules.join(' · ')}
Refer to these phases by number when you sequence work. Do not invent a different phase order.` : ''}
${facts ? `\n${measurementsPromptBlock(facts)}` : ''}
${facts?.crop ? `\n${cropPlanPromptBlock(facts)}` : ''}
${photoAnalysis ? `\nSITE PHOTO ANALYSIS:\n${photoAnalysis}` : ''}
${surveyData ? `\nSITE SURVEY (farmer-completed — treat this as authoritative ground truth about the site):\n${surveyToPrompt(surveyData, d.rainfall.annual)}` : ''}
${evidenceData && Object.keys(evidenceData).length > 0 ? `\nFARMER'S EVIDENCE (items the farmer has photographed, measured or noted on this site — treat as ACTUAL observed conditions, not estimates):\n${
  Object.entries(evidenceData)
    .map(([key, { count, notes }]) => `  · ${key.replace(/_/g, ' ')}: ${count} item${count !== 1 ? 's' : ''}${notes.length > 0 ? ' — notes: ' + notes.map(n => `"${n}"`).join(', ') : ''}`)
    .join('\n')
}\nReference this evidence where relevant — if water items exist, mention them in the Water Harvesting section; soil items in Soil Strategy; etc. This is real ground-truth data.` : ''}
---

${withTitle ? `The document title, its subheading and a "Site at a Glance" table of this farm's measured figures have ALREADY been written for you and will be placed above your output — every figure in them is measured, so never contradict one. Do NOT write a title, a subheading, an introduction or a preamble of your own.\n\n` : ''}Do NOT write any document title, introduction or preamble. Output ONLY the section(s) requested below, starting directly with the first "## " heading.

Generate ONLY the sections listed here, in this order: ${sections.join(', ')}

Use this exact markdown structure for each section (copy the headings exactly):

${sections.includes('Executive Summary') ? `## Executive Summary
[3–5 sentences. Most critical site characteristics, biggest opportunity, biggest constraint, and the single most important first action. Be specific — name the slope, the rainfall, the soil pH.${facts ? ` A "Site at a Glance" table of this farm's measured figures has ALREADY been printed above this section, so do not repeat it as a table — instead write about ${[facts.farmName ?? 'this site', facts.design ? `its ${facts.design.growingAreaM2} m² of drawn growing area` : null, facts.water && facts.water.statedStorageLitres > 0 ? `its ${facts.water.statedStorageLitres.toLocaleString()} L of planned tank storage` : null].filter(Boolean).join(', ')} by name and by number.` : ''}]

` : ''}${sections.includes('Site Conditions') ? `## Site Conditions

### Climate Profile
[Detailed climate interpretation specific to this location. What does ${d.rainfall.annual}mm of ${d.rainfall.pattern} rainfall mean practically? What are the frost/heat risks?]

### Terrain Analysis
[What does ${d.elevation.slopeDeg}° slope on ${d.elevation.aspectLabel}-facing ground mean for water movement, sun exposure, and design? Which earthworks are indicated?]

### Soil Assessment
| Property | Value | Interpretation |
|----------|-------|----------------|
| pH | ${d.soil.ph} | [acid/neutral/alkaline + what this means] |
| Organic Carbon | ${d.soil.organicCarbon}% | [low/adequate/rich + target] |
| Texture | ${d.soil.textureClass} | [water-holding capacity, drainage, workability] |
| Bulk Density | ${d.soil.bulkDensity} g/cm³ | [compaction status] |

[2–3 sentence synthesis of soil health and priority corrections]

` : ''}${sections.includes('Natural Vegetation & Biome') ? `## Natural Vegetation & Biome

${d.vegetation
  ? `The SANBI 2018 National Vegetation Map places this site in the **${d.vegetation.vegUnit}** vegetation unit (biome: ${d.vegetation.biome}${d.vegetation.bioregion ? `, bioregion: ${d.vegetation.bioregion}` : ''}).`
  : `The biome at this location is **${d.biome.name}** (${d.biome.code}).`}
${d.bru ? `\nThis site also falls in KZN Bioresource Unit zone ${d.bru.brucode} (parent ${d.bru.bruParent}), closest to the **${d.bru.nearestBrg}** Bioresource Group — a best-effort climate-similarity match, so refer to it as approximate ("similar to...", "in the ${d.bru.nearestBrg} zone character") rather than a confirmed classification. Zone temperatures run ${d.bru.tmin}–${d.bru.tmax}°C. Use this to sharpen frost risk and local vegetation character (e.g. mistbelt, grassveld type) — do not restate its rainfall figure, only the Annual rainfall given elsewhere in this brief.\n` : ''}
Using the site data above, write this section:

1. **Natural plant community:** Name the exact natural vegetation type at this spot. Use the SANBI vegetation unit and biome name (${d.vegetation ? `${d.vegetation.vegUnit}, ${d.vegetation.biome}` : d.biome.name}). Describe what this plant community looks like — its structure, dominant plants, and natural cycles.

2. **What it tells you about soil, water and climate:** Explain concretely what the natural vegetation reveals about this site's soil fertility, water availability, drainage, fire regime, frost exposure, and growing conditions. Be specific — these are free clues from nature.

3. **Truly local indigenous species:** List the indigenous plants that genuinely belong to this exact vegetation unit. Draw on the key species (${d.biome.keySpecies.join(', ')}) but go deeper — name species typical of the ${d.vegetation ? d.vegetation.vegUnit : d.biome.name} specifically, including understorey, grasses, geophytes, and shrubs where relevant. Give common name + botanical name.

4. **Designing WITH this vegetation — the permaculture angle:** Explain how to design a permaculture system that works WITH rather than against this natural plant community:
   - Which indigenous plants to keep, protect and propagate on-site
   - What the reference ecosystem teaches about guild design (what grows together naturally here?)
   - How the natural water pathways and plant communities should guide earthwork and planting placement
   - Restoration opportunity: how to use indigenous species to stabilise soil, attract beneficial insects, and build long-term resilience while still producing food

Keep the tone and length consistent with the rest of the report.

` : ''}${sections.includes('Water Harvesting') ? `## Water Harvesting Design

### Strategy
[1 paragraph: the water harvesting approach for THIS site — ${d.rainfall.annual}mm, ${d.rainfall.pattern} pattern, ${d.elevation.slopeDeg}° slope, ${d.soil.textureClass} soil]

### Recommended Earthworks (priority order)
1. **[Earthwork name]** — [location on site, dimensions, why this first]
2. **[Earthwork name]** — [details]
3. **[Earthwork name]** — [details]

### Calculations
${roofCalcLine(facts, d.rainfall.annual)}
${siteAreaForCalcM2 ? `- **Total site catchment:** ${(siteAreaForCalcM2 / 10000).toFixed(siteAreaForCalcM2 < 10000 ? 3 : 2)} ha (${Math.round(siteAreaForCalcM2).toLocaleString()} m², ${siteAreaSourceNote}) × ${d.rainfall.annual}mm = **${Math.round(siteAreaForCalcM2 * d.rainfall.annual / 1000).toLocaleString()} kL/year** potential capture (realistic 30–50% harvest: **${Math.round(siteAreaForCalcM2 * d.rainfall.annual / 1000 * 0.4).toLocaleString()} kL**)` : '- **Total site catchment:** the site area is not known (no boundary traced), so do NOT calculate one. Say what the farmer must measure to get it.'}
- **Swale spacing** on ${d.elevation.slopeDeg}° slope: approx every **${Math.max(5, Math.round(40 / Math.max(d.elevation.slopeDeg, 1)))}m** vertical interval${facts?.design?.routes.some((route) => /swale/i.test(route.label)) ? ` — the farmer has ALREADY traced ${facts.design.routes.filter((route) => /swale/i.test(route.label)).map((route) => `${route.totalLengthM} m of swale`).join(' and ')} on this plan, so start from that line rather than proposing a fresh layout` : ''}
- **Dry season storage gap:** ${d.rainfall.drySeason} = ~${Math.round(drySeasonRainMm)}mm total — minimum tank size for food garden: **[X,XXX L]**
- **ETo vs rainfall:** Dry season ETo est. ${(d.climate.solarRadiation * 1.1 * 90).toFixed(0)}mm vs ${Math.round(drySeasonRainMm)}mm rain → **deficit: [Xmm] — must be covered by storage or irrigation**
${waterData ? `- **Drawn water storage:** ${waterData.count} store(s), ~**${waterData.estVolumeKL.toLocaleString()} kL** capacity (est. ${waterData.avgDepthM}m avg depth over ${waterData.areaM2.toLocaleString()} m²). State clearly whether this covers the dry-season deficit above, and if not, how much more storage is needed.` : ''}
${facts?.water && facts.water.statedStorageLitres > 0 ? `- **Tank storage on the plan:** **${facts.water.statedStorageLitres.toLocaleString()} L** stated capacity (${facts.water.tanks.map((tank) => `${tank.name} x${tank.count}`).join(', ')}). Compare THIS number to the dry-season need you calculate above and say plainly whether it is enough, and if not by how much.` : ''}

### Implementation Timeline
When to build each earthwork relative to the ${d.rainfall.wetSeason} wet season.

` : ''}${sections.includes('Soil Strategy') ? `## Soil Building Plan

### Immediate Actions (Month 1–3)
[Specific amendments for pH ${d.soil.ph} and OC ${d.soil.organicCarbon}% — what to add, how much, why]

### 12-Month Programme
| Period | Action | Purpose |
|--------|--------|---------|
| Month 1–3 | [action] | [why] |
| Month 4–6 | [action] | [why] |
| Month 7–9 | [action] | [why] |
| Month 10–12 | [action] | [why] |

### Target Numbers
- pH target: [X.X] → add [X kg/100m² of what amendment]
- OC target: 2–3% → [what to add, how long to reach target]

` : ''}${sections.includes('Planting Calendar') ? `## Year-Round Planting Calendar

A month-by-month guide of WHAT TO PLANT at this site, based on ${d.rainfall.pattern} rainfall (wet: ${d.rainfall.wetSeason}, dry: ${d.rainfall.drySeason}), ${d.climate.minTemp}–${d.climate.maxTemp}°C temperatures, and ${d.rainfall.annual}mm/year. Focus on vegetables and food crops that feed a family all year and suit ${d.biome.name}.${facts?.crop ? `\n\nThis farmer has ALREADY entered ${facts.crop.plantingCount} plantings (listed in the site data above). In the "Plant now" column, put THEIR crop in that month first and mark it (already planned), then add what is missing. Do not silently replace their plan with a different one.` : ''}

| Month | Plant now | Ready to harvest | Tip |
|-------|-----------|------------------|-----|
| January | [crops] | [crops] | [short tip] |
| February | [crops] | [crops] | [tip] |
| March | [crops] | [crops] | [tip] |
| April | [crops] | [crops] | [tip] |
| May | [crops] | [crops] | [tip] |
| June | [crops] | [crops] | [tip] |
| July | [crops] | [crops] | [tip] |
| August | [crops] | [crops] | [tip] |
| September | [crops] | [crops] | [tip] |
| October | [crops] | [crops] | [tip] |
| November | [crops] | [crops] | [tip] |
| December | [crops] | [crops] | [tip] |

Mark the frost-risk months (winter min ${d.climate.minTemp}°C) and the best months to plant for the rains.

` : ''}${sections.includes('Fruit, Nut & Berry Trees') ? `## Fruit, Nut & Berry Trees

Fruit, nut and berry crops that suit ${d.biome.name}, ${d.rainfall.annual}mm rainfall, and ${d.climate.minTemp}–${d.climate.maxTemp}°C (note chill needs — winter low is ${d.climate.minTemp}°C). Mix quick wins with long-term trees.

| Crop | Type | Plant when | First harvest | Why it suits this site |
|------|------|-----------|---------------|------------------------|
| [e.g. Pawpaw] | Fruit | [season] | [1–2 yrs] | [reason] |
| [e.g. Pecan] | Nut | [season] | [4–7 yrs] | [reason] |
| [berry] | Berry | [season] | [time] | [reason] |

Include at least: 3 fruit trees, 1–2 nut trees, 1 berry. Prioritise hardy, low-water options where rainfall is low. Note water needs for each.

` : ''}${sections.includes('Indigenous Trees') ? `## Indigenous Trees for This Site

Indigenous South African trees suited to ${d.biome.name} — these survive local conditions far better than exotics, need little water once established, and give food, shade, fodder, nitrogen or medicine.

| Tree (common / botanical) | Main uses | Water need | Notes |
|---------------------------|-----------|-----------|-------|
| [e.g. Marula / Sclerocarya birrea] | Fruit, shade | Low | [tip] |
| [indigenous species] | [uses] | [need] | [tip] |
| [indigenous species] | [uses] | [need] | [tip] |

Prioritise indigenous FRUIT and multi-purpose trees that grow naturally in or near the ${d.biome.name} biome. Name real species only.

` : ''}${sections.includes('Agroecosystem Planting Guide') ? `## Agroecosystem Planting Guide

A species reference and design framework for building a productive, biodiverse agroecosystem rooted in the natural plant communities of ${d.vegetation ? d.vegetation.vegUnit : d.biome.name}. All species must be genuinely suited to this location: ${Math.abs(d.lat).toFixed(1)}°S, ${d.elevation.elevation}m elevation, ${d.rainfall.annual}mm ${d.rainfall.pattern} rainfall, ${d.climate.minTemp}–${d.climate.maxTemp}°C.

### Top 5 Indigenous Canopy Trees
Trees that anchor the system: deep roots, long-lived, wildlife habitat, soil function. Indigenous only — no exotics.

| Tree | Botanical name | Size | Key uses | Wildlife value |
|------|---------------|------|----------|---------------|
| [name] | [Genus species] | [Xm tall] | [food/timber/fodder/N-fix/medicine] | [birds/insects/mammals] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |

### Top 5 Indigenous Shrubs & Sub-canopy
The structural mid-layer: edge habitat, windbreak understorey, food forest guild fill, insect corridors.

| Shrub | Botanical name | Size | Key uses | Wildlife value |
|-------|---------------|------|----------|---------------|
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |
| [name] | [Genus species] | [Xm] | [uses] | [wildlife] |

### Top 10 Fruit & Nut Trees for This Site
Productive food-forest canopy and sub-canopy. Include indigenous fruiting species AND well-adapted exotics. Flag chill-hour requirements honestly (winter min here is ${d.climate.minTemp}°C).

| Crop | Type | Chill hrs | First harvest | Water needs | Why it fits |
|------|------|-----------|---------------|-------------|------------|
| [name] | Fruit/Nut | [hrs] | [1–3 yrs etc] | [low/med/high] | [why] |
| (×10 rows) | | | | | |

### Agroecosystem Design — Layering for Balance

**Food forest structure for ${d.vegetation ? d.vegetation.vegUnit : d.biome.name}:**
Describe the natural layering strategy for this specific vegetation unit — which canopy trees go where, how to set back the food forest from existing indigenous vegetation, and the succession sequence from pioneer to climax.

**Windbreak & buffer composition:**
Name 3–5 specific species for a multi-row windbreak on the ${d.climate.windFromSummer}/${d.climate.windFromWinter} side. Give the row order: tallest natives at back, fruiting sub-canopy in middle, dense shrubs at front. Include at least one nitrogen-fixer and one insect-attracting species.

**Guild associations — what grows together naturally here:**
Give 2 specific plant guilds based on what actually co-occurs in ${d.vegetation ? d.vegetation.vegUnit : d.biome.name}: a canopy tree, its natural understorey companions, a ground cover or geophyte that belongs. Explain the ecological relationship (shade tolerance, soil chemistry, mycorrhizal networks).

**Habitat corridors for birds and beneficial insects:**
Which plantings most effectively attract:
- Pollinators (bees, flies, butterflies) — name 3–4 flowering plants with peak bloom timing
- Insectivorous birds (pest control) — which species, what habitat features they need
- Seed dispersers (frugivorous birds) — which fruiting plants bring them in
Give practical placement: where to put nectar strips, nest boxes, dense shrub patches relative to food production zones.

---

### Appendix — Extended Species Reference

#### Nitrogen Fixers & Soil Builders
List 6–8 indigenous or well-adapted nitrogen-fixing species for ${d.biome.name}. Include legume trees, shrubs, and ground-cover legumes. Note whether they are indigenous to this vegetation unit or introduced. Give 1-line practical use for each.

#### Nectar & Pollinator Plants (Indigenous)
List 8–10 indigenous plants that reliably attract pollinators at this location. For each: common name, flowering month(s), main pollinator attracted. Prioritise species with different bloom windows to cover the whole year.

#### Ground Covers & Living Mulch
List 6–8 ground covers or low-growing plants that suppress weeds, retain moisture, and provide habitat. Include at least 2 that also produce food or medicine. Note sun/shade requirements.

#### Indigenous Climbers & Scrambling Plants
List 4–5 indigenous climbers for trellises, fences, and forest edges. Note fruit/flower/habitat value. Flag any that become invasive in disturbed ground.

#### Medicinal & Ethnobotanical Plants for This Area
List 6–8 plants with documented traditional use in this biome — common name, use, and whether indigenous. These are excellent zone 1–2 additions: useful, low-maintenance, and culturally relevant.

All species in this appendix must be genuinely appropriate to ${Math.abs(d.lat).toFixed(1)}°S at ${d.elevation.elevation}m in the ${d.vegetation ? d.vegetation.vegUnit : d.biome.name}. Do not include species from different biomes or elevation bands.

` : ''}${sections.includes('Crop Rotation') ? `## Crop Rotation Plan

A simple rotation to keep soil healthy and cut pests and disease WITHOUT chemicals, matched to the planting calendar and ${d.rainfall.pattern} rainfall.

Explain the 4 rotation groups in plain words (Legumes that feed the soil → Leafy greens → Fruiting crops → Roots), then give a simple bed-by-bed plan a small plot can follow.

${facts?.design && facts.design.bedCount > 0 ? `### Rotation across the beds this farmer has actually drawn
Their beds are: ${facts.design.beds.filter((bed) => bed.kind === 'bed').map((bed) => `${bed.label} (${bed.areaM2} m²)`).join(', ')}${facts.design.plotCount > 0 ? `, plus ${facts.design.plotCount} traced staple plots totalling ${facts.design.plotAreaM2} m²` : ''}.

Build the rotation table with ONE COLUMN PER BED, using these EXACT bed names in this order. Do not renumber them, do not invent a bed, and do not fall back to a generic "Bed 1–4" example. Rows: one per season for a full cycle, showing which rotation group lands in which bed.${facts.design.plotCount > 0 ? ` Add one line for the staple plots, which rotate on their own longer cycle.` : ''}` : `### Example 4-bed rotation
| Season | Bed 1 | Bed 2 | Bed 3 | Bed 4 |
|--------|-------|-------|-------|-------|
| ${d.rainfall.pattern === 'winter' ? 'Autumn' : 'Spring'} | [group] | [group] | [group] | [group] |
| Next season | [shift each bed one group along] | | | |

(No beds have been drawn for this site, so this is a generic example — say so.)`}

One or two short rules to remember (e.g. "never plant the same family in the same bed two seasons running").

` : ''}${sections.includes('Irrigation Plan') ? `## Irrigation Plan — How Much Water You Need

Work out the water needed to irrigate the growing areas through the dry season (${d.rainfall.drySeason}).
- A vegetable garden needs roughly 5–6mm of water per day in dry-season heat. Rule: 1mm over 1m² = 1 litre, so 100m² × 5mm = 500 L/day.

${irrigationRowsBlock(facts)}

Recommend the cheapest effective method for this ${d.soil.textureClass} soil and how to cut water use (mulch, shade, swales).${siteAreaForCalcM2 ? ` Scale to the ${(siteAreaForCalcM2 / 10000).toFixed(siteAreaForCalcM2 < 10000 ? 3 : 2)} ha site.` : ''}${waterData ? ` Compare the total need to the ~${waterData.estVolumeKL.toLocaleString()} kL of drawn storage and say if it is enough.` : ''}${facts?.water && facts.water.statedStorageLitres > 0 ? ` Compare the total daily need to the **${facts.water.statedStorageLitres.toLocaleString()} L** of tank storage on the plan and say how many days it covers.` : ''}

` : ''}${sections.includes('Year-Round Food Production') ? `## All-Year-Round Food Production

How to harvest something every month — the heart of food security.${facts?.crop ? `\n\nStart from the plan this farmer has already entered (${facts.crop.plantingCount} plantings, ${facts.crop.crops.length} crops, listed in the site data above): name which months their own plan already covers and which months it leaves bare, and fill only the bare ones. Do not print a yield or a rand figure for any crop.` : ''}
- **Succession planting:** plant small batches of fast crops every 2–3 weeks, not all at once.
- **Storage crops:** which to grow that keep for months (pumpkin, sweet potato, dried beans, onions, garlic).
- **Preserving:** simple methods for this climate (drying, fermenting, bottling).
- **The hungry gap:** name the hardest months here and exactly what to grow or store to bridge them.
- **Perennials:** crops that come back yearly with little work.

End with a one-line plan: "for food all year — plant X for summer, Y for winter, store Z for the gap."

` : ''}${sections.includes('Animals & Livestock') ? `## Animals & Livestock

Small animals suited to ${siteAreaForCalcM2 ? `a ${(siteAreaForCalcM2 / 10000).toFixed(siteAreaForCalcM2 < 10000 ? 3 : 2)} ha property (${siteAreaSourceNote})` : 'a property whose size is not known'} here — for eggs, meat, manure and pest control. Recommend HARDY INDIGENOUS SA breeds over exotics.

| Animal | Suited? | Recommended SA breed(s) | Why / notes |
|--------|---------|--------------------------|-------------|
| Chickens (layers) | [yes/maybe] | [e.g. Boschveld, Potchefstroom Koekoek, Ovambo] | [hardy, eggs + manure] |
| Chickens (meat) | [yes/maybe] | [breed] | [notes] |
| [Goats / Ducks / Rabbits / Bees] | [yes/maybe] | [breed/type] | [notes] |

- How many animals the land can carry without overgrazing${siteAreaForCalcM2 ? ` (scale to ${(siteAreaForCalcM2 / 10000).toFixed(siteAreaForCalcM2 < 10000 ? 3 : 2)} ha — ${siteAreaSourceNote})` : ' — say the site area is not known rather than assuming one'}.
- How animals fit the system: chicken tractors for pests/weeds, manure for compost, rotational grazing.

` : ''}${sections.includes('Sun & Solar') ? `## Sun & Solar

${sunData}
- **Placement:** face the house, sun-loving crops and any solar panels toward the ${preferredSunSide} sun. Keep tall trees on the side opposite the winter sun (${winterShadowSide}) so they don't shade growing areas.
- **Winter sun:** the low ~${sunWinterNoon}° winter sun sits in the ${winterSunSide} and throws its longest shadows toward the ${winterShadowSide} — plan so winter beds stay sunny.
- **Solar power:** at ${d.climate.solarRadiation} kWh/m²/day this site has ${d.climate.solarRadiation > 5.5 ? 'excellent' : 'good'} solar potential — roughly **${Math.round(d.climate.solarRadiation * 0.75 * 365).toLocaleString()} kWh/year per 1 kW** of panels. Good for water pumping, lights, fencing.
- **Summer shade:** deciduous trees on the north/west give shade in summer then drop leaves for winter sun.

` : ''}${sections.includes('Wind & Windbreaks') ? `## Wind & Windbreaks

Prevailing wind is FROM the ${d.climate.windFromSummer} in summer and FROM the ${d.climate.windFromWinter} in winter, averaging ${d.climate.windSpeed} m/s.
- **Need one?** ${d.climate.windSpeed > 4 ? 'Yes — winds here are strong enough to dry out and damage crops.' : 'Winds are moderate, but a windbreak still protects young plants and cuts water loss.'}
- **Where:** plant on the ${d.climate.windFromSummer} and ${d.climate.windFromWinter} sides to block the main winds, without shading crops from the northern sun.
- **What:** a permeable multi-row windbreak (slows wind, not a solid wall) — name 3–4 real species suited to ${d.biome.name}, mixing fast shelter with useful/indigenous trees.
- **Benefits:** less water loss, protected crops, fewer broken branches, habitat for pest-eating birds.

` : ''}${sections.includes('Fire & Hazards') ? `## Fire Risk & Other Hazards

- **Fire risk:** ${d.biome.name} ${/Fynbos|Grassland|Savanna|Karoo/.test(d.biome.name) ? 'is fire-prone in the dry season' : 'has a lower but real dry-season fire risk'}. Rate it and say which side fire is most likely to come from (usually the dry, windward side).
- **Firebreaks:** keep a cleared or green strip and fire-resistant plants (aloes, spekboom, vygies) between wild land and the home/crops.
- **Other hazards:** frost (winter min ${d.climate.minTemp}°C${d.climate.minTemp < 2 ? ' — frost likely, protect tender crops' : ''}), hail, and flood/erosion in heavy rain. Biome challenges: ${d.biome.challenges.slice(0, 2).join(', ')}.
- Give 2–3 practical, low-cost protections for the biggest risks.

` : ''}${sections.includes('Economic Opportunities') ? `## Economic Opportunities

Ways this ${siteAreaForCalcM2 ? `${(siteAreaForCalcM2 / 10000).toFixed(siteAreaForCalcM2 < 10000 ? 3 : 2)} ha ` : ''}property could earn income for a small-scale farmer in this area. Ground EVERYTHING in the real location — use the municipality, district and province named in the SITE DATA above${admin ? ` (${admin.label})` : ''}.
- **Where this farm sits:** name the local municipality, the district municipality and the province, and one line on the character of the area (rural/peri-urban, distance to the nearest town/city).
- **What this area is known for in agriculture:** the dominant commercial and small-scale farming of THIS municipality/district (e.g. specific crops, livestock, forestry, citrus, sugarcane, deciduous fruit, dryland grain). Be specific to the place, not generic.
- **Economic zone & infrastructure:** any relevant economic context near here — agri-parks, Fresh Produce Markets, a Special Economic Zone or development corridor, co-ops, pack-houses, abattoirs, or major buyers (mines, lodges, hospitals, retailers) within reach. Note the nearest market town.
- **⭐ MARKET GAPS (most important):** what produce is in real DEMAND in this area but UNDER-supplied locally — food currently trucked in from far away that a local grower could supply fresher and cheaper. Name 2–4 specific crops/products this farmer could grow to fill a genuine gap, and explain WHY the gap exists (seasonality, distance from supply, no nearby grower, post-harvest losses). This is the highest-value advice — be concrete.
- **Best cash crops:** 3–5 crops with real local market demand that grow well here — mix quick-return (veg, herbs, eggs) with longer-term (fruit, nuts, honey).
- **Value-adding:** simple ways to earn more (drying, jam, packaging, free-range eggs, seedlings, compost).
- **Markets:** where to sell — local markets, bakkie traders, co-ops, schools/clinics, restaurants, roadside, and any institutional buyers named above.
- **Cheapest start:** what needs the least money to start earning in year 1.
- **Local support:** point to real SA help — ARC, the provincial Department of Agriculture extension officer, LandCare, local co-ops, and Land Bank / CASP funding for small farmers.

Keep it realistic for a grower with limited capital.

` : ''}${sections.includes('Plant Guilds') ? `## Plant Guilds

Design 3 guilds specifically for ${d.biome.name} biome, ${d.climate.koppen} climate, ${d.rainfall.annual}mm ${d.rainfall.pattern} rainfall. Name REAL species, indigenous first.

### Guild 1: [Descriptive Name]
*Purpose: [what this guild does — food, nitrogen, water, habitat]*
| Layer | Species | Role |
|-------|---------|------|
| Canopy | [species] | [function] |
| Sub-canopy | [species] | [function] |
| Shrub | [species] | [function] |
| Nitrogen fixer | [species] | [function] |
| Groundcover | [species] | [function] |
| Root/accumulator | [species] | [function] |

### Guild 2: [Descriptive Name]
[Same table format]

### Guild 3: [Descriptive Name]
[Same table format]

` : ''}${sections.includes('Zone Design') ? `## Zone Design

${zonePromptBlock(facts)}

` : ''}${sections.includes('Seasonal Calendar') ? `## Seasonal Action Calendar

| Month | Key Activity | Category |
|-------|-------------|----------|
| January | [specific action] | [Water/Soil/Plant/Harvest] |
| February | [action] | [category] |
| March | [action] | [category] |
| April | [action] | [category] |
| May | [action] | [category] |
| June | [action] | [category] |
| July | [action] | [category] |
| August | [action] | [category] |
| September | [action] | [category] |
| October | [action] | [category] |
| November | [action] | [category] |
| December | [action] | [category] |

` : ''}${sections.includes('5-Year Vision') ? `## 5-Year Vision

[2–3 paragraphs describing what this site will look, feel, and produce like in 5 years if the design is implemented. Be vivid and specific to the ${d.biome.name} biome. What trees are established, how the water system functions, what food is being harvested.]

` : ''}${sections.includes('Year 1 Priorities') ? `## Year 1 Priorities

The 5 highest-impact actions for this specific site, in order of importance:

1. **[Action]** — [why this is #1 for this site, specific to slope/rainfall/soil]
2. **[Action]** — [specifics]
3. **[Action]** — [specifics]
4. **[Action]** — [specifics]
5. **[Action]** — [specifics]

` : ''}

Be direct. Use actual numbers from the data above. Every recommendation must be justified by something specific about this site.`;

  // Generating all sections in ONE streaming call is too slow to finish inside
  // the function's maxDuration window (~26 words/s → a 20-section comprehensive
  // report needs ~9 min, and Vercel kills it mid-stream → the "cut-off"). Instead
  // generate the sections in parallel batches and stream them to the client IN
  // ORDER as each completes — wall-clock ≈ the slowest batch (~2 min), well under
  // maxDuration, and the report always finishes.
  const BATCH_SIZE = reportLength === 'one-pager' ? 4 : 2;
  const perBatchTokens = reportLength === 'comprehensive' ? 16000 : reportLength === 'one-pager' ? 2000 : 8000;
  const batches: string[][] = [];
  for (let i = 0; i < safeSections.length; i += BATCH_SIZE) batches.push(safeSections.slice(i, i + BATCH_SIZE));

  // ALL batches run concurrently. The old wave loop (4 at a time, each wave awaited before the
  // next started) made wall-clock = sum of the slowest batch PER WAVE — a Comprehensive report
  // (7+ batches × 16k-token generations, several minutes each) needed two waves and blew the
  // function's maxDuration, so Vercel killed it with zero bytes sent and the farmer saw a bare
  // "500". Concurrent, wall-clock = the single slowest batch, comfortably inside the window.
  // The section allow-list above already caps how many batches a request can create; a dozen
  // parallel calls is well inside Anthropic rate limits.
  const batchResults: string[] = new Array(batches.length);

  const runBatch = async (batchSections: string[], idx: number): Promise<void> => {
    try {
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: perBatchTokens,
        // THE ANTI-INVENTION RULE, and why it is a system prompt rather than another
        // paragraph in the user message: sections are generated in independent parallel
        // batches that cannot see each other, so a rule stated once inside one batch's
        // prompt does not bind the others. This binds every batch equally.
        //
        // It exists because a report for a crèche with a 2,500 L JoJo tank and a municipal
        // tap told the farmer to "monitor the dam weekly with a marked depth gauge" and
        // computed a 38-day buffer from a 193 kL reserve. There is no dam. Both numbers
        // were the model's own arithmetic, filling a storage section the prompt demanded
        // while nothing in the context said what water the site actually had.
        system: [
          'You are writing a site report a South African smallholder will act on and spend money against.',
          'NEVER state that a physical structure exists — a dam, borehole, reservoir, tank, pond, river, well, pump, fence or building — unless it appears in the site facts supplied to you.',
          'NEVER attach a capacity, depth, water level, percentage or age to a structure that is not in those facts.',
          'Where the facts are silent, the honest reading is that the thing is absent. Write recommendations as something to BUILD or BUY, not as something to monitor or draw down.',
          'Prefer saying a figure is unknown over supplying a plausible one. An invented number in this report is worse than a missing one, because the farmer cannot tell them apart.',
        ].join(' '),
        messages: [{ role: 'user', content: buildPrompt(batchSections, idx === 0) }],
      }, {
        // One hung upstream call must not eat the whole maxDuration window — the catch below
        // ships an honest per-section placeholder instead.
        signal: AbortSignal.timeout(240_000),
      });
      const text = msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
      const cutShort = msg.stop_reason === 'max_tokens';
      batchResults[idx] = text + (cutShort
        ? '\n\n_[This section may be incomplete: the model reached its output limit.]_\n'
        : '');
    } catch {
      batchResults[idx] = '\n\n_[A section could not be generated — please regenerate the report.]_\n';
    }
  };

  await Promise.all(batches.map((b, i) => runBatch(b, i)));

  // ── Front matter and back matter, written in CODE ────────────────────────────
  //
  // The title, the standfirst and the SITE AT A GLANCE table are the first thing a reader sees and
  // are therefore the last thing that should be generated: every figure in them is measured off
  // this farm's own map or read from a named data source, and none of it can drift because no
  // model touches it. The trust statement (lib/plan-assurance.ts) closes the document for the same
  // reason — the crop-plan PDF has carried it since the agronomic review, and the site report, the
  // document most likely to be handed to a funder or an extension officer, carried none of it.
  const header = buildReportHeaderMarkdown({
    facts,
    biomeName: d.biome.name,
    vegUnit: d.vegetation?.vegUnit ?? null,
    bruLabel: d.bru?.nearestBrg ?? null,
    adminLabel: admin?.label ?? null,
    lat: d.lat,
    lon: d.lon,
    dateLabel: new Date().toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' }),
    rainfallMm: d.rainfall.annual,
    rainfallSource: d.rainfall.rainfallSource,
    wetSeason: d.rainfall.wetSeason,
    drySeason: d.rainfall.drySeason,
    soilPh: d.soil.ph,
    soilOrganicCarbon: d.soil.organicCarbon,
    soilTexture: d.soil.textureClass,
    soilSource: d.soil.soilSource,
    elevationM: d.elevation.elevation,
    slopeDeg: d.elevation.slopeDeg,
    aspectLabel: d.elevation.aspectLabel,
    siteAreaM2: siteData?.areaM2,
    sitePerimeterM: siteData?.perimeterM,
    hasMapWaterPolygons: Boolean(waterData),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`${header}\n\n`));
        for (const text of batchResults) {
          controller.enqueue(encoder.encode(text.trimEnd() + '\n\n'));
        }
        controller.enqueue(encoder.encode(`${assuranceMarkdown()}\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

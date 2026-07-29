import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 300;
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import type { SiteSurvey } from '@/lib/site-survey';
import { surveyToPrompt } from '@/lib/site-survey';
import { deriveSolar, isValidEarthLatitude } from '@/lib/solar';

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

export async function POST(req: NextRequest) {
  let body: {
    locationData: LocationData;
    photoAnalysis?: string;
    siteData?: SiteData;
    waterData?: WaterData;
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
  const { locationData, photoAnalysis, siteData, waterData, surveyData, evidenceData, sections, language, bilingual, tone, length } = body;

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
  const sunSkyText =
    solar.middayFrom === 'N'
      ? 'Sun is in the NORTHERN sky at midday → north-facing aspects get the most sun, south-facing are shaded/cooler.'
      : solar.middayFrom === 'S'
      ? 'Sun is in the SOUTHERN sky at midday → south-facing aspects get the most sun, north-facing are shaded/cooler.'
      : `This site sits inside the tropics — the midday sun swings sides through the year (from the ${solar.winter.noonSide} in winter to the ${solar.summer.noonSide} in summer), so both north- and south-facing aspects get strong sun at different times of year.`;
  const sunData = `${sunSkyText} Noon sun elevation: ~${sunSummerNoon}° in summer (high), ~${sunWinterNoon}° in winter (low${solar.middayFrom === 'S' ? ' — long shadows to the north' : ' — long shadows to the south'}). Day length: ~${dayLen(-DECL)}h summer / ~${dayLen(DECL)}h winter.`;

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
${siteData ? `\nSITE BOUNDARY (user-drawn polygon)
Area: ${siteData.areaHa} ha (${siteData.areaM2.toLocaleString()} m²)
Perimeter: ${siteData.perimeterKm} km (${siteData.perimeterM.toLocaleString()} m)
Compactness ratio: ${(4 * Math.PI * siteData.areaM2 / (siteData.perimeterM ** 2)).toFixed(2)} (1.0 = perfect circle)
Use these exact figures in all calculations. Scale recommendations to this site size.` : '\n(No site boundary drawn — give general recommendations scalable to the property)'}
${waterData ? `\nWATER STORAGE (user-drawn on map)
${waterData.count} water storage feature(s) drawn — total surface area ${waterData.areaM2.toLocaleString()} m².
Estimated capacity: ~${waterData.estVolumeKL.toLocaleString()} kL (${(waterData.estVolumeKL * 1000).toLocaleString()} L), assuming ${waterData.avgDepthM}m average depth.
Use this existing/planned storage in the water plan: compare it to the dry-season demand and rainfall capture, and say whether it is enough or more is needed. Treat the estimate as approximate (real depth varies).` : ''}
${photoAnalysis ? `\nSITE PHOTO ANALYSIS:\n${photoAnalysis}` : ''}
${surveyData ? `\nSITE SURVEY (farmer-completed — treat this as authoritative ground truth about the site):\n${surveyToPrompt(surveyData, d.rainfall.annual)}` : ''}
${evidenceData && Object.keys(evidenceData).length > 0 ? `\nFARMER'S EVIDENCE (items the farmer has photographed, measured or noted on this site — treat as ACTUAL observed conditions, not estimates):\n${
  Object.entries(evidenceData)
    .map(([key, { count, notes }]) => `  · ${key.replace(/_/g, ' ')}: ${count} item${count !== 1 ? 's' : ''}${notes.length > 0 ? ' — notes: ' + notes.map(n => `"${n}"`).join(', ') : ''}`)
    .join('\n')
}\nReference this evidence where relevant — if water items exist, mention them in the Water Harvesting section; soil items in Soil Strategy; etc. This is real ground-truth data.` : ''}
---

${withTitle ? `Begin with this title line exactly:\n# Permaculture Site Report\nthen a one-line subheading naming the biome and region, then the sections below.\n\n` : `Do NOT write any document title, introduction or preamble. Output ONLY the section(s) requested below, starting directly with the first "## " heading.\n\n`}Generate ONLY the sections listed here, in this order: ${sections.join(', ')}

Use this exact markdown structure for each section (copy the headings exactly):

${sections.includes('Executive Summary') ? `## Executive Summary
[3–5 sentences. Most critical site characteristics, biggest opportunity, biggest constraint, and the single most important first action. Be specific — name the slope, the rainfall, the soil pH.]

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
- **Roof catchment yield:** 1m² roof × 1mm rain = 1L → 100m² roof × ${d.rainfall.annual}mm = **${Math.round(d.rainfall.annual * 100).toLocaleString()} L/year** (first-flush loss ~10%: **${Math.round(d.rainfall.annual * 90).toLocaleString()} L usable**)
${siteData ? `- **Total site catchment:** ${siteData.areaHa} ha × ${d.rainfall.annual}mm = **${Math.round(siteData.areaM2 * d.rainfall.annual / 1000).toLocaleString()} kL/year** potential capture (realistic 30–50% harvest: **${Math.round(siteData.areaM2 * d.rainfall.annual / 1000 * 0.4).toLocaleString()} kL**)` : ''}
- **Swale spacing** on ${d.elevation.slopeDeg}° slope: approx every **${Math.max(5, Math.round(40 / Math.max(d.elevation.slopeDeg, 1)))}m** vertical interval${siteData ? ` — approximately ${Math.max(1, Math.round(siteData.perimeterM / Math.max(5, Math.round(40 / Math.max(d.elevation.slopeDeg, 1))) / 4))} swales on this ${siteData.areaHa} ha site` : ''}
- **Dry season storage gap:** ${d.rainfall.drySeason} = ~${Math.round(d.rainfall.monthly.filter((_, i) => i >= 4 && i <= 7).reduce((a,b) => a+b,0))}mm total — minimum tank size for food garden: **[X,XXX L]**
- **ETo vs rainfall:** Dry season ETo est. ${(d.climate.solarRadiation * 1.1 * 90).toFixed(0)}mm vs ${Math.round(d.rainfall.monthly.filter((_, i) => i >= 4 && i <= 7).reduce((a,b) => a+b,0))}mm rain → **deficit: [Xmm] — must be covered by storage or irrigation**
${waterData ? `- **Drawn water storage:** ${waterData.count} store(s), ~**${waterData.estVolumeKL.toLocaleString()} kL** capacity (est. ${waterData.avgDepthM}m avg depth over ${waterData.areaM2.toLocaleString()} m²). State clearly whether this covers the dry-season deficit above, and if not, how much more storage is needed.` : ''}

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

A month-by-month guide of WHAT TO PLANT at this site, based on ${d.rainfall.pattern} rainfall (wet: ${d.rainfall.wetSeason}, dry: ${d.rainfall.drySeason}), ${d.climate.minTemp}–${d.climate.maxTemp}°C temperatures, and ${d.rainfall.annual}mm/year. Focus on vegetables and food crops that feed a family all year and suit ${d.biome.name}.

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

### Example 4-bed rotation
| Season | Bed 1 | Bed 2 | Bed 3 | Bed 4 |
|--------|-------|-------|-------|-------|
| ${d.rainfall.pattern === 'winter' ? 'Autumn' : 'Spring'} | [group] | [group] | [group] | [group] |
| Next season | [shift each bed one group along] | | | |

One or two short rules to remember (e.g. "never plant the same family in the same bed two seasons running").

` : ''}${sections.includes('Irrigation Plan') ? `## Irrigation Plan — How Much Water You Need

Work out the water needed to irrigate the growing areas through the dry season (${d.rainfall.drySeason}).
- A vegetable garden needs roughly 5–6mm of water per day in dry-season heat. Rule: 1mm over 1m² = 1 litre, so 100m² × 5mm = 500 L/day.

| Growing area | Size | Daily need (dry season) | Over the dry season | Best method |
|--------------|------|--------------------------|---------------------|-------------|
| Kitchen garden | [m²] | [L/day] | [L total] | [drip / mulch basin] |
| Young fruit trees | [m²] | [L/day] | [L total] | [deep watering] |
| [field / orchard] | [m²] | [L/day] | [L total] | [method] |

Recommend the cheapest effective method for this ${d.soil.textureClass} soil and how to cut water use (mulch, shade, swales).${siteData ? ` Scale to the ${siteData.areaHa} ha site.` : ''}${waterData ? ` Compare the total need to the ~${waterData.estVolumeKL.toLocaleString()} kL of drawn storage and say if it is enough.` : ''}

` : ''}${sections.includes('Year-Round Food Production') ? `## All-Year-Round Food Production

How to harvest something every month — the heart of food security.
- **Succession planting:** plant small batches of fast crops every 2–3 weeks, not all at once.
- **Storage crops:** which to grow that keep for months (pumpkin, sweet potato, dried beans, onions, garlic).
- **Preserving:** simple methods for this climate (drying, fermenting, bottling).
- **The hungry gap:** name the hardest months here and exactly what to grow or store to bridge them.
- **Perennials:** crops that come back yearly with little work.

End with a one-line plan: "for food all year — plant X for summer, Y for winter, store Z for the gap."

` : ''}${sections.includes('Animals & Livestock') ? `## Animals & Livestock

Small animals suited to ${siteData ? `a ${siteData.areaHa} ha property` : 'a small property'} here — for eggs, meat, manure and pest control. Recommend HARDY INDIGENOUS SA breeds over exotics.

| Animal | Suited? | Recommended SA breed(s) | Why / notes |
|--------|---------|--------------------------|-------------|
| Chickens (layers) | [yes/maybe] | [e.g. Boschveld, Potchefstroom Koekoek, Ovambo] | [hardy, eggs + manure] |
| Chickens (meat) | [yes/maybe] | [breed] | [notes] |
| [Goats / Ducks / Rabbits / Bees] | [yes/maybe] | [breed/type] | [notes] |

- How many animals the land can carry without overgrazing${siteData ? ` (scale to ${siteData.areaHa} ha)` : ''}.
- How animals fit the system: chicken tractors for pests/weeds, manure for compost, rotational grazing.

` : ''}${sections.includes('Sun & Solar') ? `## Sun & Solar

${sunData}
- **Placement:** face the house, sun-loving crops and any solar panels NORTH. Keep tall trees on the south side so they don't shade growing areas.
- **Winter sun:** the low ~${sunWinterNoon}° winter sun throws long shadows south — plan so winter beds stay sunny.
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

Ways this ${siteData ? `${siteData.areaHa} ha ` : ''}property could earn income for a small-scale farmer in this area. Ground EVERYTHING in the real location — use the municipality, district and province named in the SITE DATA above${admin ? ` (${admin.label})` : ''}.
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

Layout recommendations for ${d.biome.name} biome and this terrain.

**Zone 0 — House:** [orientation, passive solar considerations for ${d.climate.meanTemp}°C mean temp, ${d.climate.minTemp}°C winter]
**Zone 1 — Kitchen garden:** [what to grow immediately adjacent, water proximity]
**Zone 2 — Food forest:** [canopy species, size, placement relative to ${d.elevation.aspectLabel}-facing slope]
**Zone 3 — Main production:** [field crops, pasture, guilds relevant to ${d.biome.name}]
**Zone 4 — Managed wild:** [indigenous species to establish, water harvesting]
**Zone 5 — Wilderness:** [what to protect, let regenerate]

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

  // Fan-out concurrency is capped at 4 batches at a time so even a legitimate
  // max-section request cannot burst all Anthropic calls simultaneously.
  const CONCURRENCY = 4;
  const batchResults: string[] = new Array(batches.length);

  const runBatch = async (batchSections: string[], idx: number): Promise<void> => {
    batchResults[idx] = await client.messages
      .create({
        model: 'claude-sonnet-4-6',
        max_tokens: perBatchTokens,
        messages: [{ role: 'user', content: buildPrompt(batchSections, idx === 0) }],
      })
      .then((msg) => msg.content.map((b) => (b.type === 'text' ? b.text : '')).join(''))
      .catch(() => `\n\n_[A section could not be generated — please regenerate the report.]_\n`);
  };

  // Execute batches in chunks of CONCURRENCY, preserving original order.
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    await Promise.all(batches.slice(i, i + CONCURRENCY).map((b, j) => runBatch(b, i + j)));
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for (const text of batchResults) {
          controller.enqueue(encoder.encode(text.trimEnd() + '\n\n'));
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

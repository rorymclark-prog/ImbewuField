import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { AI_MODELS, meteredAi } from '@/lib/metered-ai';
import { resolveLocalAdvicePolicy, localAdviceDecisionCurrent } from '@/lib/local-advice-policy';
import type { LocalAdviceDecision } from '@/lib/local-advice-types';
import { selectLocalAdviceSystem } from '@/lib/local-advice-prompts';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function buildPrompt(d: LocationData): string {
  const rain = d.rainfall.monthly.map((v, i) => `${MONTH_NAMES[i]}:${Math.round(v)}`).join(' ');
  const facingNote = d.elevation.aspectLabel.includes('N')
    ? '(north-facing — WARM & DRY in southern hemisphere, more sun)'
    : d.elevation.aspectLabel.includes('S')
    ? '(south-facing — COOLER & MOISTER in southern hemisphere, less sun)'
    : '(lateral slope)';

  return `You are an expert permaculture designer specialising in South African landscapes. Generate detailed, site-specific, actionable permaculture guidance for this exact location.

--- SITE DATA ---
Coordinates: ${d.lat.toFixed(4)}°S, ${d.lon.toFixed(4)}°E
Biome: ${d.biome.name} (${d.biome.code}) — ${d.biome.description}
Known biome challenges: ${d.biome.challenges.join('; ')}${d.bru ? `\nKZN Bioresource Unit: zone ${d.bru.brucode} (parent ${d.bru.bruParent}), closest matching Bioresource Group ${d.bru.nearestBrg} (best-effort climate match — treat as approximate, not confirmed). Zone temps ${d.bru.tmin}–${d.bru.tmax}°C. Use as extra zone context (frost/mistbelt/grassveld character) — do NOT quote its rainfall figure, only the Annual rainfall above.` : ''}

CLIMATE
- Köppen: ${d.climate.koppen} (${d.climate.koppenDesc})
- Annual rainfall: ${d.rainfall.annual}mm (${d.rainfall.pattern} rainfall pattern)
- Wet season: ${d.rainfall.wetSeason} · Dry season: ${d.rainfall.drySeason}
- Mean temp: ${d.climate.meanTemp}°C · Summer max: ${d.climate.maxTemp}°C · Winter min: ${d.climate.minTemp}°C
- Solar radiation: ${d.climate.solarRadiation} kWh/m²/day (annual avg)
- Monthly rainfall (mm): ${rain}

TERRAIN
- Elevation: ${d.elevation.elevation}m ASL
- Slope: ${d.elevation.slopeDeg}° (${d.elevation.slopePct}%)
- Aspect: ${d.elevation.aspectDeg}° ${d.elevation.aspectLabel} ${facingNote}

SOIL (ISRIC SoilGrids 0–30cm)
- Texture: ${d.soil.textureClass}
- pH: ${d.soil.ph}
- Organic carbon: ${d.soil.organicCarbon}% (target for healthy soil: >2%)
- Composition: ${d.soil.clay}% clay · ${d.soil.sand}% sand · ${d.soil.silt}% silt
- Bulk density: ${d.soil.bulkDensity} g/cm³

--- BIOME NOTES FROM DATABASE ---
Water strategy: ${d.biome.waterStrategy}
Soil strategy: ${d.biome.soilStrategy}
Key indigenous species: ${d.biome.keySpecies.join(', ')}

--- GENERATE 5 SECTIONS ---
Be specific to THIS location. Reference the actual numbers — slope, rainfall timing, biome, soil pH, OC content. Give concrete recommendations, not generic permaculture theory.

## 🌧 Water Harvesting
Based on ${d.rainfall.annual}mm of ${d.rainfall.pattern} rainfall and ${d.elevation.slopeDeg}° slope: specific earthworks strategy. Calculate swale spacing. Dam viability. Tank sizing (give actual litres per 100m² of roof). Which earthworks to do first and when (tie to rainfall season).

## 🌱 Soil Building
Based on pH ${d.soil.ph} and OC ${d.soil.organicCarbon}%: what to add, what to avoid, target numbers. pH correction strategy. Organic matter building plan. What grows naturally in this biome that improves the soil.

## 🌳 Plant Guilds
3 specific guild designs for this exact biome and climate. Name actual species (indigenous first, useful exotics second). Include: canopy / sub-canopy / shrub / nitrogen-fixer / groundcover / root-crop layer. Reference the specific season and rainfall pattern.

## 📅 Seasonal Action Calendar
Month-by-month key activities tied to the actual rainfall pattern (${d.rainfall.wetSeason} wet, ${d.rainfall.drySeason} dry). Earthworks timing, planting windows, harvest, soil-building activities.

## ⚡ Year-1 Quick Wins
3 high-impact actions specific to this site's biggest constraints and opportunities. Be direct and practical.`;
}

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/ai-insights');
  if (auth.response) return auth.response;
  let body: { adviceContext?: unknown; locationData?: LocationData };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const data = body?.locationData;
  if (!body || typeof body !== 'object' || Array.isArray(body) || !data?.biome
      || !Array.isArray(data.rainfall?.monthly) || !data.elevation || !data.soil || !data.climate
      || !Number.isFinite(data.lat) || !Number.isFinite(data.lon)) {
    return NextResponse.json({ error: 'Invalid location data' }, { status: 400 });
  }
  let personalPrompt: string;
  try { personalPrompt = buildPrompt(data); }
  catch { return NextResponse.json({ error: 'Invalid location data' }, { status: 400 }); }
  const policyInput = { adviceContext: body.adviceContext, location: data, hasSiteInputs: true };
  let decision: LocalAdviceDecision;
  try { decision = await resolveLocalAdvicePolicy(req, auth, policyInput); }
  catch { return NextResponse.json({ code: 'LOCAL_ADVICE_COUNTRY_SOURCE_UNAVAILABLE',
    error: 'Saved-site country details could not be checked. Try again after account updates reconnect.', allowanceMayBeSpent: false },
    { status: 503, headers: { 'Cache-Control': 'no-store' } }); }
  if (!decision.allowed) return NextResponse.json({ code: decision.code, error: decision.error, allowanceMayBeSpent: false },
    { status: decision.status, headers: { 'Cache-Control': 'no-store' } });
  if (decision.mode !== 'personal-site') return NextResponse.json({ code: 'LOCAL_ADVICE_PERSONAL_CONTEXT_NOT_ALLOWED',
    error: 'This route requires a supported saved-site context. General app help is available in chat.', allowanceMayBeSpent: false },
    { status: 422, headers: { 'Cache-Control': 'no-store' } });
  let allowanceMayBeSpent = false;
  const contextChanged = () => NextResponse.json({ code: 'LOCAL_ADVICE_CONTEXT_CHANGED',
    error: 'The saved-site country context changed or could not be checked. No advice was delivered. Check the intended site before asking again.', allowanceMayBeSpent },
    { status: 409, headers: { 'Cache-Control': 'no-store' } });
  const stillCurrent = async () => {
    if (req.signal.aborted) return false;
    try {
      const fresh = await resolveLocalAdvicePolicy(req, auth, policyInput);
      return !req.signal.aborted && localAdviceDecisionCurrent(decision, fresh);
    } catch { return false; }
  };
  const prompt = selectLocalAdviceSystem(decision.mode, personalPrompt);
  if (!await stillCurrent()) return contextChanged();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const metered = await meteredAi(req, auth, '/api/ai-insights', client);
    allowanceMayBeSpent = true;
    if (metered.response) return metered.response;
    if (!await stillCurrent()) return contextChanged();
    const stream = await metered.ai.messages.stream({ model: AI_MODELS.main, max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }] }, { signal: req.signal });
    // Preserve the completed metering iterator while withholding every chunk
    // until the original saved-country decision has been checked again.
    const chunks: string[] = [];
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') chunks.push(chunk.delta.text);
    }
    if (!await stillCurrent() || req.signal.aborted) return contextChanged();
    return new Response(chunks.join(''), { headers: { 'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Imbewu-Advice-Mode': decision.mode } });
  } catch {
    console.error('[api/ai-insights] local advice request failed');
    if (!await stillCurrent()) return contextChanged();
    return NextResponse.json({ code: 'LOCAL_ADVICE_MODEL_UNAVAILABLE',
      error: 'The advice request could not be completed. No advice was delivered. Try again explicitly.', allowanceMayBeSpent },
      { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

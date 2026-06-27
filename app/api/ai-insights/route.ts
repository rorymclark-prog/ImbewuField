import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

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
Known biome challenges: ${d.biome.challenges.join('; ')}

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
  let data: LocationData;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!data?.biome || !data.rainfall?.monthly || !Array.isArray(data.rainfall.monthly)
      || !data.elevation || !data.soil || !data.climate) {
    return NextResponse.json({ error: 'Invalid location data' }, { status: 400 });
  }
  const prompt = buildPrompt(data);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(new TextEncoder().encode(`\n\n⚠ ${msg}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

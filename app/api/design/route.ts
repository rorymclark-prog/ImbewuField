import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const LANGUAGES: Record<string, string> = {
  en: 'English', af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa',
  st: 'Sesotho', nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga',
  ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};

export async function POST(req: NextRequest) {
  const { images, locationData, photoAnalysis, language, tone }: {
    images: Array<{ data: string; mediaType: string }>;
    locationData: LocationData;
    photoAnalysis?: string;
    language?: string;
    tone?: 'simple' | 'professional';
  } = await req.json();

  if (!images?.length) return NextResponse.json({ error: 'No sketch provided' }, { status: 400 });

  const d = locationData;
  const langCode = language ?? 'en';
  const langName = LANGUAGES[langCode] ?? 'English';
  const langLine = langCode !== 'en'
    ? `\n\nWrite the ENTIRE design in natural, everyday ${langName} (plant names may stay English/Latin).`
    : '';
  const toneLine = tone === 'professional'
    ? ''
    : `\n\nThe reader is a small-scale farmer with basic schooling. Use very simple, short sentences and explain any technical word in plain language.`;

  const sunNote = d.lat < 0 ? 'In South Africa the midday sun is in the NORTHERN sky, so north-facing ground is sunniest/warmest and south-facing is shaded/cooler.' : '';

  const content: Anthropic.MessageParam['content'] = [
    ...images.map((img) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: img.mediaType as 'image/jpeg' | 'image/png', data: img.data },
    })),
    {
      type: 'text' as const,
      text: `You are an expert permaculture designer. The farmer has uploaded a hand-drawn (or rough) sketch of their property. Read the sketch carefully — note everything they have marked: the house/buildings, boundaries, slopes, water (rivers, dams, taps), existing trees, roads/paths, a north arrow if present, and anything else.

Produce a practical permaculture DESIGN laid out on THEIR sketch — refer to the actual features they drew ("near the house you marked top-left…", "along the slope running down to the stream…"). Make it buildable for a small-scale farmer.

SITE DATA
Biome: ${d.biome.name}${d.vegetation ? ` · exact vegetation: ${d.vegetation.vegUnit}` : ''}
Coordinates: ${Math.abs(d.lat).toFixed(3)}°S, ${d.lon.toFixed(3)}°E · Elevation ${d.elevation.elevation}m · Slope ${d.elevation.slopeDeg}° facing ${d.elevation.aspectLabel}
Rainfall: ${d.rainfall.annual}mm/yr, ${d.rainfall.pattern} (wet ${d.rainfall.wetSeason}, dry ${d.rainfall.drySeason})
Temperature: ${d.climate.minTemp}–${d.climate.maxTemp}°C · Soil: ${d.soil.textureClass}, pH ${d.soil.ph}
Wind: from ${d.climate.windFromSummer} (summer) / ${d.climate.windFromWinter} (winter). ${sunNote}
${photoAnalysis ? `\nGROUND PHOTO NOTES:\n${photoAnalysis}\n` : ''}
Use this structure (keep headings exactly):

## 📐 Reading Your Sketch
What you can see in the sketch — the layout, orientation, and key features you'll design around.

## 🧭 Key Design Moves
The 3–4 most important decisions for THIS site, based on sun (north), water (slope), and wind.

## 🗺 Zone-by-Zone Placement
Walk through where each zone goes ON THEIR sketch, referencing the features they drew:
- **Zone 1 (kitchen garden / herbs)** — where and why
- **Zone 2 (food forest, small animals)** — where and why
- **Zone 3 (main crops / orchard)** — where and why
- **Zone 4 (grazing / fodder / woodlot)** — where and why
- **Zone 5 (wild / conservation)** — where and why

## 💧 Water Layout
Where to put swales, tanks, dams and greywater on their land (use the slope direction).

## 🌳 What to Plant Where
Key plantings per area — name real species suited to ${d.biome.name}, windbreaks on the windward sides, sun-lovers to the north.

## 👣 First 3 Steps
The first three things to mark out and start on the ground.${langLine}${toneLine}

Be specific to their sketch and this site. This is a real plan they will use.`,
    },
  ];

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 3000,
    messages: [{ role: 'user', content }],
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
        const friendly = /could not process image/i.test(msg)
          ? '\n\n⚠ Could not read this image. Try a clearer photo of the sketch (good light, whole page in frame).'
          : `\n\n⚠ Design error: ${msg}`;
        controller.enqueue(new TextEncoder().encode(friendly));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

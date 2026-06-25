import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { reverseGeocode } from '@/lib/reverse-geocode';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface OverpassElement {
  tags?: {
    name?: string; shop?: string; amenity?: string; office?: string;
    leisure?: string; operator?: string; description?: string;
    opening_hours?: string; phone?: string;
  };
}

async function findLocalPOIs(lat: number, lon: number): Promise<string> {
  const r = 8000; // 8 km radius
  const query = `
[out:json][timeout:12];
(
  node["shop"="farm"](around:${r},${lat},${lon});
  node["shop"="organic"](around:${r},${lat},${lon});
  node["shop"="agrarian"](around:${r},${lat},${lon});
  node["amenity"="marketplace"](around:${r},${lat},${lon});
  node["market_type"](around:${r},${lat},${lon});
  node["amenity"="community_centre"](around:${r},${lat},${lon});
  node["office"="ngo"](around:${r},${lat},${lon});
  node["office"="association"](around:${r},${lat},${lon});
  node["leisure"="garden"](around:${r},${lat},${lon});
  node["landuse"="allotments"](around:${r},${lat},${lon});
  node["shop"="cooperative"](around:${r},${lat},${lon});
  node["amenity"="bank"](around:${r},${lat},${lon});
  node["amenity"="atm"](around:${r},${lat},${lon});
  node["shop"="supermarket"](around:${r},${lat},${lon});
  node["amenity"="school"](around:${r},${lat},${lon});
  node["amenity"="clinic"](around:${r},${lat},${lon});
  way["leisure"="garden"](around:${r},${lat},${lon});
  way["landuse"="allotments"](around:${r},${lat},${lon});
);
out body;`;
  try {
    const res = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: `data=${encodeURIComponent(query)}`,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(14000),
    });
    if (!res.ok) return '(OSM Overpass unavailable)';
    const json = await res.json() as { elements?: OverpassElement[] };
    const elements = json.elements ?? [];
    if (!elements.length) return 'No tagged markets, gardens, or community organisations found within 8 km in OpenStreetMap.';
    const PRIORITY = ['marketplace', 'market_type', 'farm', 'organic', 'cooperative', 'agrarian', 'ngo', 'association', 'garden', 'allotments', 'community_centre', 'supermarket', 'bank', 'school', 'clinic'];
    const sorted = [...elements].sort((a, b) => {
      const ta = Object.values(a.tags ?? {}).find(v => PRIORITY.includes(v ?? '')) ?? 'z';
      const tb = Object.values(b.tags ?? {}).find(v => PRIORITY.includes(v ?? '')) ?? 'z';
      return PRIORITY.indexOf(ta) - PRIORITY.indexOf(tb);
    });
    const named = sorted.filter(e => e.tags?.name).slice(0, 20);
    if (!named.length) return 'Some OSM features exist nearby but none have named entries.';
    return named.map(e => {
      const t = e.tags!;
      const type = t.shop ?? t.amenity ?? t.office ?? t.leisure ?? 'facility';
      const op = t.operator ? ` (${t.operator})` : '';
      return `${t.name}${op} [${type}]`;
    }).join('; ');
  } catch {
    return '(OSM lookup timed out — omit from analysis)';
  }
}

function buildPrompt(
  lat: number, lon: number,
  admin: NonNullable<Awaited<ReturnType<typeof reverseGeocode>>>,
  pois: string,
): string {
  const suburb = admin.suburb ? `${admin.suburb}, ` : '';
  const nearestTown = admin.nearestTown ?? admin.municipality ?? 'nearest town unknown';
  const road = admin.road ? ` near ${admin.road}` : '';

  return `You are a South African local-economy researcher helping a small-scale farmer understand their specific neighbourhood — NOT a generic municipal summary.

PRECISE LOCATION (use EXACTLY these names):
- Neighbourhood/Suburb: ${suburb}${admin.municipality ?? 'unknown'}${road}
- District: ${admin.district ?? 'n/a'}
- Province: ${admin.province ?? 'unknown'}
- Nearest town: ${nearestTown}
- GPS: ${Math.abs(lat).toFixed(4)}°S, ${lon.toFixed(4)}°E

ACTUAL INFRASTRUCTURE FOUND NEARBY (from OpenStreetMap, within 8 km):
${pois}

Write a hyper-local, SPECIFIC community profile. Use the REAL suburb/neighbourhood name throughout. Reference the actual POIs found above by name where relevant. Do NOT write generic municipal summaries — write about THIS specific street-level area.

Use this EXACT markdown structure with 3–5 sharp, specific bullets each:

## 📍 ${suburb}${admin.municipality ?? 'This area'}
Where exactly this is — describe the specific suburb/neighbourhood character (dense housing, smallholdings, estate, township, farming area, etc.), what you can see from the GPS point, and the nearest recognisable landmark or town centre. Be specific.

## 🏘 Local economic character
What kind of economic zone this is: affluent / middle-income / working-class / farming community / mixed? Note if there are smallholding belts, farm stalls, or local markets in this specific area. If the OSM data shows markets or cooperative facilities nearby, name them. Describe who the local buyers and sellers are.

## 🛒 Markets & selling opportunities
Name SPECIFIC local outlets, farmers markets, farm stall strips, informal markets, or local selling groups in this area. If OSM shows relevant facilities, list them. Give a realistic picture of where someone in this EXACT area could sell produce: weekly/monthly markets, roadside, direct-to-neighbour, WhatsApp selling groups typical for this suburb, etc.

## 🤝 Support organisations & resources
Name SPECIFIC organisations nearby: agricultural extension offices, DAFF offices, NGOs, community food gardens, cooperatives, or support groups for small farmers. If OSM shows NGOs or associations nearby, list them. Also mention provincial/district resources relevant here.

## 💰 Economic opportunity gaps
2–3 specific produce or product gaps FOR THIS EXACT SUBURB — what is in demand but not locally grown/sold? Consider the local demographic (affluent suburb → herbs/premium veg/eggs; township → staple veg; smallholding area → value-added products). Be specific to THIS location.

Base everything on your knowledge of South Africa at this specific GPS point. If you don't know exact details for this precise spot, say so honestly and give the closest comparable context. Do NOT pad with generic South Africa facts. Start directly with the first "## " heading.`;
}

export async function POST(req: NextRequest) {
  const { lat, lon } = await req.json();
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return new Response('Invalid coordinates', { status: 400 });
  }

  const [admin, pois] = await Promise.all([
    reverseGeocode(lat, lon),
    findLocalPOIs(lat, lon),
  ]);

  if (!admin) return new Response('Could not resolve location', { status: 422 });

  const prompt = buildPrompt(lat, lon, admin, pois);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1600,
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
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

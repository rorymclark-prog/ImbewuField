import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData, SiteData, WaterData } from '@/lib/types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const LANG_NAMES: Record<string, string> = {
  en: 'English', zu: 'isiZulu', xh: 'isiXhosa', af: 'Afrikaans', st: 'Sesotho',
  nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga', ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};

const SYSTEM = `You are ImbewuField's farm assistant — a knowledgeable, friendly advisor for a specific South African grower, working ONLY within these areas:
- Permaculture, organic & regenerative agriculture, agroecology — both for THIS farmer's specific site and in general.
- Sustainable living, water harvesting, soil building, indigenous/climate-appropriate species, food forests, companion planting, natural pest & disease management.
- The economics & financials of THIS farm — crop value, gross margins, viability, market opportunities, what's most profitable to grow — grounded in the farmer's own production records when provided.
- Their project, contracts, funding and programme participation, at a practical level.

Hard rules:
- You are this farmer's assistant about THEIR site, crops, reports, finances and project. Do NOT re-introduce yourself or ask "what are we talking about" — you already have their context below; use it directly.
- NEVER recommend synthetic/commercial pesticides, herbicides or chemical fertilisers. Always favour natural, organic, regenerative methods.
- Decline politely and redirect anything off-topic (e.g. holidays, unrelated trivia) — you only help with their farming, site, sustainability, finances and project.
- Be practical, specific and concise — concrete steps, species, quantities, timing, rand figures where useful. Short paragraphs or bullets, plain warm language.
- Ground every answer in the SITE CONTEXT, REPORTS and RECORDS below whenever relevant.`;

interface ChatMsg { role: 'user' | 'assistant'; content: string }
interface Ctx {
  locationData?: LocationData;
  siteData?: SiteData;
  waterData?: WaterData;
  language?: string;
  reports?: { name: string; savedAt: string; text?: string }[];
  production?: { crop: string; kg: number }[];
}

function buildContext(ctx?: Ctx): string {
  if (!ctx) return '';
  const parts: string[] = [];

  const loc = ctx.locationData;
  if (loc) {
    parts.push(`--- THIS FARMER'S SITE ---
Location: ${loc.lat.toFixed(4)}°S, ${loc.lon.toFixed(4)}°E
Biome: ${loc.biome.name} (${loc.biome.code})
Climate: Köppen ${loc.climate.koppen}; mean ${loc.climate.meanTemp}°C (winter min ${loc.climate.minTemp}°C, summer max ${loc.climate.maxTemp}°C)
Rainfall: ${loc.rainfall.annual}mm/yr, ${loc.rainfall.pattern} pattern (wet ${loc.rainfall.wetSeason}, dry ${loc.rainfall.drySeason})
Terrain: ${loc.elevation.elevation}m ASL, slope ${loc.elevation.slopeDeg}°, ${loc.elevation.aspectLabel}-facing
Soil: ${loc.soil.textureClass}, pH ${loc.soil.ph}, organic carbon ${loc.soil.organicCarbon}%`
      + (ctx.siteData ? `\nDrawn land area: ${ctx.siteData.areaHa} ha (${ctx.siteData.areaM2.toLocaleString()} m²)` : '')
      + (ctx.waterData ? `\nWater storage drawn: ~${ctx.waterData.estVolumeKL.toLocaleString()} kL` : ''));
  }

  if (ctx.production && ctx.production.length) {
    const byCrop = new Map<string, number>();
    for (const p of ctx.production) byCrop.set(p.crop, (byCrop.get(p.crop) ?? 0) + (p.kg || 0));
    const lines = Array.from(byCrop.entries()).map(([c, kg]) => `${c}: ${Math.round(kg)}kg`).join(', ');
    parts.push(`--- THIS FARMER'S PRODUCTION RECORDS ---\n${lines}`);
  }

  if (ctx.reports && ctx.reports.length) {
    const list = ctx.reports.map((r) => `• ${r.name} (saved ${new Date(r.savedAt).toLocaleDateString()})`).join('\n');
    let block = `--- THIS FARMER'S SAVED REPORTS ---\n${list}`;
    const withText = ctx.reports.find((r) => r.text);
    if (withText?.text) block += `\n\nMost recent report (excerpt):\n${withText.text.slice(0, 2000)}`;
    parts.push(block);
  }

  return parts.join('\n\n');
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const messages: ChatMsg[] = Array.isArray(body.messages) ? body.messages : [];
  const ctx = body.context as Ctx | undefined;

  const ctxBlock = buildContext(ctx);
  const langName = ctx?.language ? LANG_NAMES[ctx.language] : undefined;
  const langLine = langName && langName !== 'English'
    ? `\n\nThe farmer's preferred language is ${langName} — reply in ${langName} unless they clearly write in another language.`
    : '';

  const system = SYSTEM + langLine + (ctxBlock ? `\n\n${ctxBlock}` : '');

  const clean = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  if (clean.length === 0) {
    return new Response('Ask me anything about your site, crops, finances or project.', { status: 200 });
  }

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system,
    messages: clean,
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

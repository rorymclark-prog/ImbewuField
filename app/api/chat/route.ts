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
- The economics & financials of THIS farm — crop value, gross margins, viability, market opportunities, what's most profitable to grow — grounded in the farmer's own production AND sales records when provided. Use real rand figures from their sales.
- Their project, contracts, funding and programme participation, at a practical level.
- Diagnosing plants, pests, diseases, weeds and soil from PHOTOS the farmer sends — identify the issue and give organic/regenerative remedies (companion planting, natural sprays, soil/biological fixes). Never a chemical-pesticide recommendation.

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
  sales?: { crop: string; kg: number; amount: number }[];
  project?: {
    programme: string; funder: string; ngo?: string;
    contractValue?: number; disbursed?: number; currency?: string;
    garden?: string; plotSizeM2?: number; supervisor?: string;
    startDate?: string; endDate?: string;
    obligations?: string[];
    milestones?: { name: string; due: string; status: string }[];
  };
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

  if (ctx.sales && ctx.sales.length) {
    const byCrop = new Map<string, { kg: number; amount: number }>();
    for (const s of ctx.sales) {
      const cur = byCrop.get(s.crop) ?? { kg: 0, amount: 0 };
      byCrop.set(s.crop, { kg: cur.kg + (s.kg || 0), amount: cur.amount + (s.amount || 0) });
    }
    const totalIncome = ctx.sales.reduce((sum, s) => sum + (s.amount || 0), 0);
    const lines = Array.from(byCrop.entries())
      .map(([c, v]) => `${c}: ${Math.round(v.kg)}kg sold for R${Math.round(v.amount)} (≈R${(v.amount / Math.max(1, v.kg)).toFixed(2)}/kg)`)
      .join('\n');
    parts.push(`--- THIS FARMER'S SALES / INCOME ---\nTotal income: R${Math.round(totalIncome)}\n${lines}`);
  }

  if (ctx.project) {
    const p = ctx.project;
    const cur = p.currency ?? 'R';
    const lines = [`Programme: ${p.programme}`, `Funder: ${p.funder}${p.ngo ? ` (via ${p.ngo})` : ''}`];
    if (p.contractValue != null) lines.push(`Contract value: ${cur}${p.contractValue.toLocaleString()}${p.disbursed != null ? ` (${cur}${p.disbursed.toLocaleString()} disbursed, ${cur}${(p.contractValue - p.disbursed).toLocaleString()} outstanding)` : ''}`);
    if (p.garden) lines.push(`Garden: ${p.garden}${p.plotSizeM2 ? `, plot ${p.plotSizeM2} m²` : ''}`);
    if (p.supervisor) lines.push(`Mentor: ${p.supervisor}`);
    if (p.startDate || p.endDate) lines.push(`Term: ${p.startDate ?? '?'} → ${p.endDate ?? '?'}`);
    if (p.obligations?.length) lines.push(`Contract obligations:\n${p.obligations.map((o) => `  - ${o}`).join('\n')}`);
    if (p.milestones?.length) lines.push(`Milestones:\n${p.milestones.map((m) => `  - ${m.name} (due ${m.due}): ${m.status}`).join('\n')}`);
    parts.push(`--- THIS FARMER'S PROJECT / FUNDING / CONTRACT ---\n${lines.join('\n')}`);
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

  const clean: Anthropic.MessageParam[] = messages
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content }));

  // Optional photo on the latest user turn → multimodal diagnosis
  const image = body.image as { data: string; mediaType: string } | undefined;
  if (image?.data && clean.length) {
    const last = clean[clean.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') {
      last.content = [
        { type: 'image', source: { type: 'base64', media_type: (image.mediaType || 'image/jpeg') as 'image/jpeg', data: image.data } },
        { type: 'text', text: last.content || 'Please look at this photo and diagnose it (plant, pest, disease, weed or soil) with organic/regenerative remedies.' },
      ];
    }
  }

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

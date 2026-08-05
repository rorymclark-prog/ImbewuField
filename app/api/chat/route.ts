import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData, SiteData, WaterData } from '@/lib/types';
import { guardPaidApiRequest } from '@/lib/api-auth';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── The model behind the assistant ───────────────────────────────────────
// 2026-08-06, Rory: "what model is behind the chat bot because we need to have
// something that is very clever, maybe researches, accurate".
//
// Was claude-sonnet-4-6 with no thinking and no tools: a single-pass answer from
// whatever the model already knew plus the SITE CONTEXT block below. That is fine
// for "what is companion planting" and wrong for "what are tomatoes fetching in
// Mkuze this month" — the second needs a source, and the old setup had no way to
// get one, so it answered from memory and sounded just as sure.
//
// Three changes, in order of how much they matter:
//  1. WEB SEARCH. The assistant can now look something up instead of guessing.
//     Prices, cultivar availability, a pest outbreak, a subsidy scheme — none of
//     that is in any model's weights, and a farmer acting on a confidently wrong
//     price loses money.
//  2. ADAPTIVE THINKING. The model decides per question how long to reason. A
//     one-line question still answers in one line; "should I put maize or beans
//     in the lower plots given my rainfall" gets worked through.
//  3. A BIGGER MODEL. Opus 5 over Sonnet 4.6 — but this is the smallest of the
//     three levers, and it is deliberately last in the list.
const MODEL = 'claude-opus-5';
// Effort is the cost/latency dial, and the one to reach for first if this gets
// expensive or slow — 'medium' still reasons well on this model. Kept explicit
// rather than left to the API default so it is visible and tunable here.
const EFFORT = 'high';
// Thinking shares this budget with the answer, so it cannot stay at the old
// 1500 — that would have paid for reasoning and then truncated the reply.
const MAX_TOKENS = 8000;
// A hard ceiling on searches per answer. Each one costs money and seconds, and a
// farmer on metered mobile is waiting the whole time.
const MAX_SEARCHES = 3;

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
- Ground every answer in the SITE CONTEXT, REPORTS and RECORDS below whenever relevant.

Being right matters more than sounding sure. This farmer will spend money and a season on what you say:
- You can search the web. Use it when the answer depends on something you cannot know: current prices, what a supplier actually stocks, a pest or disease outbreak, a subsidy or programme, weather beyond the climate averages below, anything the farmer flags as recent. Search first and answer second — do not answer those from memory.
- Do NOT search for things you already know or that are already in their site context and records. Every search costs the farmer time on a slow connection.
- When a figure comes from a search, say where it came from in the sentence that uses it. When it comes from their own records, say that instead.
- Never invent a yield, a spacing, a price, a planting date or a rainfall figure. If you do not know and cannot find it, say exactly that and say what would settle it — a soil test, a call to the co-op, one season of records. "I don't know" is a useful answer; a confident wrong number is not.
- Distinguish what is measured on their site, what is modelled from climate and soil data, and what is your general knowledge. Those are three different levels of confidence and the farmer is entitled to know which one they are acting on.`;

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
      + (loc.bru ? `\nKZN Bioresource Unit: zone ${loc.bru.brucode}, closest to ${loc.bru.nearestBrg} Bioresource Group (best-effort climate match, not confirmed), zone temps ${loc.bru.tmin}–${loc.bru.tmax}°C — extra local zone context only, do not quote its rainfall figure, use the Rainfall above` : '')
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

const ALLOWED_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const;
type AllowedMediaType = typeof ALLOWED_MEDIA_TYPES[number];

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/chat');
  if (auth.response) return auth.response;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid request', { status: 400 });
  }
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
    const suppliedType = image.mediaType || 'image/jpeg';
    const mediaType: AllowedMediaType = (ALLOWED_MEDIA_TYPES as readonly string[]).includes(suppliedType)
      ? suppliedType as AllowedMediaType
      : 'image/jpeg';
    const last = clean[clean.length - 1];
    if (last.role === 'user' && typeof last.content === 'string') {
      last.content = [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image.data } },
        { type: 'text', text: last.content || 'Please look at this photo and diagnose it (plant, pest, disease, weed or soil) with organic/regenerative remedies.' },
      ];
    }
  }

  if (clean.length === 0) {
    return new Response('Ask me anything about your site, crops, finances or project.', { status: 200 });
  }

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    thinking: { type: 'adaptive' },
    output_config: { effort: EFFORT },
    // Anthropic runs this one; nothing is executed here and no key of ours is
    // exposed to it. max_uses is the farmer's data bill as much as our spend.
    tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: MAX_SEARCHES }],
    system,
    messages: clean,
  });

  const readable = new ReadableStream({
    async start(controller) {
      const send = (s: string) => controller.enqueue(new TextEncoder().encode(s));
      // Sources are collected as they arrive and printed once at the end, rather
      // than interrupting the answer mid-sentence. A farmer told to change what
      // they plant deserves to see where the claim came from.
      const sources = new Map<string, string>();
      let sawText = false;
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_start') {
            const block = chunk.content_block;
            // Thinking and searching both happen before a single character of
            // answer exists. On a rural connection that silence reads as a
            // broken app, so say what is happening.
            // The break before the status matters: the model often writes a
            // sentence, THEN searches, and without it the notice lands glued to
            // the end of that sentence mid-flow ("…prices move weekly._Looking
            // this up…_"), which reads like the answer glitched.
            const gap = sawText ? '\n\n' : '';
            if (block.type === 'thinking' && !sawText) send('_Thinking…_\n\n');
            if (block.type === 'server_tool_use' && block.name === 'web_search') {
              send(`${gap}_Looking this up…_\n\n`);
            }
            if (block.type === 'web_search_tool_result') {
              // content is a LIST of results on success and a single error
              // OBJECT on failure — branch before iterating, or a failed search
              // throws inside the stream and eats the whole answer.
              const results = block.content;
              if (Array.isArray(results)) {
                for (const r of results) {
                  if (r.type === 'web_search_result') sources.set(r.url, r.title || r.url);
                }
              }
            }
          }
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            sawText = true;
            send(chunk.delta.text);
          }
        }
        const final = await stream.finalMessage();
        // A safety decline arrives as a normal 200 with an empty or partial
        // body. Without this the farmer gets silence and no idea why.
        if (final.stop_reason === 'refusal') {
          send('\n\n⚠ I can\'t answer that one. Try asking it a different way, or ask me something about your own site, crops or records.');
        }
        if (sources.size) {
          send('\n\n---\n**Where this came from**\n');
          for (const [url, title] of sources) send(`- [${title}](${url})\n`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        send(`\n\n⚠ ${msg}`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

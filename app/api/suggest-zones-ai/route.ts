import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { guardPaidApiRequest } from '@/lib/api-auth';

// Hybrid AI-vision zone suggest — the model REASONS over the real satellite plot and returns
// INTENT (per-zone anchor + size + outward direction + rationale), NOT raw polygons. Clean
// geometry is synthesised client-side in lib/design-suggest.ts (suggestZonesFromPlan). This
// mirrors app/api/design-detect's Claude-vision fallback: same client, same model, same
// image+text message + regex-JSON parse. Claude is good at WHAT/roughly-WHERE but bad at
// pixel-accurate polygons, so we deliberately never ask it for the geometry itself.

export const maxDuration = 60;

type Ring = Array<[number, number]>;

interface ZonePlanBody {
  imageBase64: string;
  imgW: number;
  imgH: number;
  mPerPx: number;
  boundary?: Ring;
  house?: Ring;
  driveway?: Ring;
  slopeDeg?: number;
  aspectLabel?: string;
  rainfallMm?: number;
  biome?: string;
}

const ASPECTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function clamp01(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

// Compact ring rendering for the prompt — 2dp normalised coords, capped so a many-point ring
// can't blow the token budget.
function ringForPrompt(ring: Ring | undefined, max = 24): string {
  if (!ring || ring.length < 2) return 'not traced';
  const step = ring.length > max ? Math.ceil(ring.length / max) : 1;
  const pts: string[] = [];
  for (let i = 0; i < ring.length; i += step) {
    pts.push(`[${ring[i][0].toFixed(2)},${ring[i][1].toFixed(2)}]`);
  }
  return pts.join(' ');
}

const client = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null;

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/suggest-zones-ai');
  if (auth.response) return auth.response;
  let body: ZonePlanBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { imageBase64, imgW, imgH, mPerPx } = body;
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }
  if (!client) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 502 });
  }

  const plotW = imgW && mPerPx ? Math.round(imgW * mPerPx) : null;
  const plotH = imgH && mPerPx ? Math.round(imgH * mPerPx) : null;
  const slopeLine =
    typeof body.slopeDeg === 'number' && body.aspectLabel
      ? `The land slopes about ${body.slopeDeg.toFixed(0)}° downhill toward ${body.aspectLabel}.`
      : 'Slope is unknown or negligible.';
  const contextLine = [
    body.biome ? `Biome: ${body.biome}.` : '',
    typeof body.rainfallMm === 'number' ? `Annual rainfall ~${Math.round(body.rainfallMm)} mm.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const prompt = `You are an expert permaculture designer looking at THIS actual top-down satellite photo of a South African smallholding. The image is ${imgW}x${imgH} px at roughly ${mPerPx.toFixed(3)} metres/px${plotW && plotH ? ` (~${plotW}x${plotH} m of ground)` : ''}.

Traced references (normalised [x,y], origin top-left, x east, y south):
- Property boundary ring: ${ringForPrompt(body.boundary)}
- House/dwelling footprint: ${ringForPrompt(body.house)}
- Driveway/access: ${ringForPrompt(body.driveway)}
${slopeLine} ${contextLine}

Reason like a designer standing on THIS plot: read the actual satellite image (where the buildings, existing trees, cleared/lawn areas, steep or wet ground, and the road/access are) and decide where permaculture zones 0-5 belong for THIS specific site. Zone conventions: 0 = the house; 1 = intensive daily-use garden right by the door; 2 = kitchen/annual veg beds; 3 = orchard / food forest; 4 = low-care, grazing, woodlot, support; 5 = wild / conservation / buffer, usually the farthest, steepest, or least accessible ground.

Do NOT return polygons — you are unreliable at pixel-accurate shapes. Instead return, for each zone you recommend (you may omit a zone if it has no sensible place here), an ANCHOR point (where its centre sits), an approximate size, and the outward direction it should grow. Return STRICT JSON only, no prose, exactly:
{"zones":[{"zone":0-5,"anchor":[x,y] normalised 0..1 on the image,"extentM":approx radius/reach in metres,"outwardDir":one of ${ASPECTS.join('|')} or null,"rationale":"one short line, e.g. zone 1 = flat lawn just N of the door"}],"overall":"one short line summarising the layout"}
Anchor every zone at a REAL feature you can see in the image. Keep rationales under 12 words.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 40_000);
    let msg;
    try {
      msg = await client.messages.create(
        {
          model: 'claude-opus-4-8', // most advanced reasoning for the spatial zone judgement
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
                { type: 'text', text: prompt },
              ],
            },
          ],
        },
        { signal: controller.signal },
      );
    } finally {
      clearTimeout(timeout);
    }

    const textBlock = msg.content.find((b) => b.type === 'text');
    const raw = textBlock?.type === 'text' ? textBlock.text : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('suggest-zones-ai: no JSON block. Raw:', raw.slice(0, 400));
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
    }

    let parsed: { zones?: unknown; overall?: unknown };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.error('suggest-zones-ai: JSON parse failed. Raw:', raw.slice(0, 400));
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
    }

    const rawZones = Array.isArray(parsed.zones) ? parsed.zones : [];
    const zones: Array<{ zone: number; anchor: [number, number]; extentM: number; outwardDir: string | null; rationale: string }> = [];
    for (const item of rawZones) {
      if (!item || typeof item !== 'object') continue;
      const z = item as Record<string, unknown>;
      const zoneNum = Math.round(Number(z.zone));
      if (!Number.isFinite(zoneNum) || zoneNum < 0 || zoneNum > 5) continue;
      const anchorRaw = Array.isArray(z.anchor) ? z.anchor : [];
      if (anchorRaw.length !== 2) continue;
      const anchor: [number, number] = [clamp01(Number(anchorRaw[0])), clamp01(Number(anchorRaw[1]))];
      const extentM = clamp(Number(z.extentM), 2, 500);
      const dir = typeof z.outwardDir === 'string' && ASPECTS.includes(z.outwardDir.trim().toUpperCase())
        ? z.outwardDir.trim().toUpperCase()
        : null;
      const rationale = typeof z.rationale === 'string' ? z.rationale.slice(0, 120) : '';
      zones.push({ zone: zoneNum, anchor, extentM, outwardDir: dir, rationale });
    }

    if (zones.length === 0) {
      return NextResponse.json({ error: 'No zones returned' }, { status: 502 });
    }

    const overall = typeof parsed.overall === 'string' ? parsed.overall.slice(0, 160) : '';
    console.log(`suggest-zones-ai: ok — ${zones.length} zone intents`);
    return NextResponse.json({ zones, overall });
  } catch (err) {
    console.error('suggest-zones-ai error:', err);
    const message = err instanceof Error ? err.message : 'Zone suggest failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

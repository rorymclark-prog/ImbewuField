import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { guardPaidApiRequest } from '@/lib/api-auth';

// AI Auto-Design — ONE vision call that plans the WHOLE farm. The model REASONS over the real
// satellite plot + the farmer's questionnaire answers and returns INTENT only (per-element
// anchor + size + direction + rationale), NEVER raw polygons. Clean geometry is synthesised
// server-agnostically in lib/design-suggest.ts (suggestFromAutoDesignPlan). A strict superset
// of app/api/suggest-zones-ai: same client/model/message/parse/validate skeleton, extended to
// also cover the veg garden, wind belt, key water and the main path. Claude is good at
// WHAT/roughly-WHERE but unreliable at pixel-accurate shapes, so it is never asked for geometry.

export const maxDuration = 60;

type Ring = Array<[number, number]>;

interface AutoDesignBody {
  imageBase64: string;
  imgW: number;
  imgH: number;
  mPerPx: number;
  boundary?: Ring;
  house?: Ring;
  driveway?: Ring;
  slopeDeg?: number;
  aspectLabel?: string;
  windFromSummer?: string;
  rainfallMm?: number;
  biome?: string;
  // Questionnaire answers — every field optional ("figure it out from the image").
  goal?: 'food' | 'income' | 'both';
  people?: 'small' | 'medium' | 'large';
  accessSide?: string; // aspect label or null
  waterSource?: 'tank' | 'borehole' | 'municipal';
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

function anchorOf(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length !== 2) return null;
  return [clamp01(Number(v[0])), clamp01(Number(v[1]))];
}

function aspectOf(v: unknown): string | null {
  return typeof v === 'string' && ASPECTS.includes(v.trim().toUpperCase()) ? v.trim().toUpperCase() : null;
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
  const auth = await guardPaidApiRequest(req, '/api/auto-design');
  if (auth.response) return auth.response;
  let body: AutoDesignBody;
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
  const windLine = body.windFromSummer
    ? `Prevailing summer wind blows FROM the ${body.windFromSummer} (so the ${body.windFromSummer} side is windward — put the wind belt there).`
    : 'Summer wind direction unknown.';
  const contextLine = [
    body.biome ? `Biome: ${body.biome}.` : '',
    typeof body.rainfallMm === 'number' ? `Annual rainfall ~${Math.round(body.rainfallMm)} mm.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const goalText =
    body.goal === 'food'
      ? 'Food security — prioritise a generous kitchen garden and staple food beds close to the house.'
      : body.goal === 'income'
        ? 'Income — allow a larger market-crop / orchard block, but still keep a kitchen garden.'
        : body.goal === 'both'
          ? 'Both food security and income — a strong kitchen garden plus a market block.'
          : 'Goal not stated — assume a balanced food-first smallholding.';
  const peopleText =
    body.people === 'small'
      ? 'Feeding a small household (1-2 people) — a modest veg garden is enough.'
      : body.people === 'medium'
        ? 'Feeding a medium household (3-5 people) — a solid veg garden.'
        : body.people === 'large'
          ? 'Feeding a large household (6+ people) — a generous veg garden.'
          : 'Household size not stated.';
  const accessAspect = aspectOf(body.accessSide);
  const accessText = accessAspect
    ? `The farmer says the main access / kitchen side is toward the ${accessAspect} — anchor zone 1 and the veg garden on that side.`
    : 'Access / kitchen side not stated — infer it from the driveway, the road, and the building layout in the image.';
  const waterText =
    body.waterSource === 'tank'
      ? 'Main water is rainwater tanks — emphasise tanks at the biggest roof.'
      : body.waterSource === 'borehole'
        ? 'Main water is a borehole — a tank is optional; you may still add a downslope dam/swale for runoff.'
        : body.waterSource === 'municipal'
          ? 'Main water is municipal — tanks are a backup; focus on swales/dam for runoff capture.'
          : 'Water source not stated — recommend rainwater tanks at the biggest roof plus a downslope swale.';

  const prompt = `You are an expert permaculture designer looking at THIS actual top-down satellite photo of a South African smallholding, designing the WHOLE farm in one pass. The image is ${imgW}x${imgH} px at roughly ${mPerPx.toFixed(3)} metres/px${plotW && plotH ? ` (~${plotW}x${plotH} m of ground)` : ''}.

Traced references (normalised [x,y], origin top-left, x east, y south):
- Property boundary ring: ${ringForPrompt(body.boundary)}
- House/dwelling footprint: ${ringForPrompt(body.house)}
- Driveway/access: ${ringForPrompt(body.driveway)}
${slopeLine} ${windLine} ${contextLine}

The farmer's brief:
- ${goalText}
- ${peopleText}
- ${accessText}
- ${waterText}

Reason like a designer standing on THIS plot: read the actual satellite image (where the buildings, existing trees, cleared/lawn areas, steep or wet ground, and the road/access are) and lay out the whole farm for THIS specific site.

Zone conventions: 0 = the house (already known — do NOT move it); 1 = intensive daily-use garden right by the door; 2 = kitchen/annual veg beds; 3 = orchard / food forest; 4 = low-care, grazing, woodlot, support; 5 = wild / conservation / buffer, usually the farthest, steepest, or least accessible ground.

Also place these key elements:
- veg garden: flat, sunny, open ground near the house (in the zone 1-2 band), on the access/kitchen side.
- wind belt (tree line): along the WINDWARD side — the side the summer wind blows FROM.
- water: rainwater tanks at the corner of the LARGEST visible roof; a dam or swale on the DOWNSLOPE side to catch runoff.
- main path: only if no driveway is traced — a line from the access edge to the house.

Do NOT return polygons — you are unreliable at pixel-accurate shapes. Return anchors, sizes and directions ONLY. Return STRICT JSON, no prose, exactly:
{"zones":[{"zone":0-5,"anchor":[x,y] normalised 0..1,"extentM":approx radius in metres,"outwardDir":${ASPECTS.join('|')} or null,"rationale":"short line"}],"vegGarden":{"anchor":[x,y],"extentM":radius m,"rationale":"short"},"windbreak":{"anchor":[x,y],"dir":${ASPECTS.join('|')},"lengthM":belt length m,"rationale":"short"},"water":[{"kind":"tank"|"dam"|"swale","anchor":[x,y],"extentM":m,"rationale":"short"}],"path":{"anchor":[x,y],"dir":${ASPECTS.join('|')}} or null,"overall":"one short line"}
Anchor every element at a REAL feature you can see in the image. Keep every rationale under 12 words. Omit (null / empty array) any element that has no sensible place here.`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55_000);
    let msg;
    try {
      msg = await client.messages.create(
        {
          model: 'claude-opus-4-8', // most advanced reasoning for the whole-farm spatial judgement
          max_tokens: 2000,
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
      console.error('auto-design: no JSON block. Raw:', raw.slice(0, 400));
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.error('auto-design: JSON parse failed. Raw:', raw.slice(0, 400));
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
    }

    // ── Zones — same shape/validation as suggest-zones-ai ──────────────────────────
    const rawZones = Array.isArray(parsed.zones) ? parsed.zones : [];
    const zones: Array<{ zone: number; anchor: [number, number]; extentM: number; outwardDir: string | null; rationale: string }> = [];
    for (const item of rawZones) {
      if (!item || typeof item !== 'object') continue;
      const z = item as Record<string, unknown>;
      const zoneNum = Math.round(Number(z.zone));
      if (!Number.isFinite(zoneNum) || zoneNum < 0 || zoneNum > 5) continue;
      const anchor = anchorOf(z.anchor);
      if (!anchor) continue;
      const extentM = clamp(Number(z.extentM), 2, 500);
      const rationale = typeof z.rationale === 'string' ? z.rationale.slice(0, 120) : '';
      zones.push({ zone: zoneNum, anchor, extentM, outwardDir: aspectOf(z.outwardDir), rationale });
    }

    // ── Veg garden ─────────────────────────────────────────────────────────────────
    let vegGarden: { anchor: [number, number]; extentM: number; rationale: string } | null = null;
    if (parsed.vegGarden && typeof parsed.vegGarden === 'object') {
      const v = parsed.vegGarden as Record<string, unknown>;
      const anchor = anchorOf(v.anchor);
      if (anchor) {
        vegGarden = {
          anchor,
          extentM: clamp(Number(v.extentM), 2, 120),
          rationale: typeof v.rationale === 'string' ? v.rationale.slice(0, 120) : '',
        };
      }
    }

    // ── Windbreak ────────────────────────────────────────────────────────────────────
    let windbreak: { anchor: [number, number]; dir: string; lengthM: number; rationale: string } | null = null;
    if (parsed.windbreak && typeof parsed.windbreak === 'object') {
      const w = parsed.windbreak as Record<string, unknown>;
      const anchor = anchorOf(w.anchor);
      const dir = aspectOf(w.dir);
      if (anchor && dir) {
        windbreak = {
          anchor,
          dir,
          lengthM: clamp(Number(w.lengthM), 5, 500),
          rationale: typeof w.rationale === 'string' ? w.rationale.slice(0, 120) : '',
        };
      }
    }

    // ── Water ──────────────────────────────────────────────────────────────────────
    const rawWater = Array.isArray(parsed.water) ? parsed.water : [];
    const water: Array<{ kind: 'tank' | 'dam' | 'swale'; anchor: [number, number]; extentM: number; rationale: string }> = [];
    for (const item of rawWater) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Record<string, unknown>;
      const kind = w.kind === 'tank' || w.kind === 'dam' || w.kind === 'swale' ? w.kind : null;
      const anchor = anchorOf(w.anchor);
      if (!kind || !anchor) continue;
      water.push({
        kind,
        anchor,
        extentM: clamp(Number(w.extentM), 1, 200),
        rationale: typeof w.rationale === 'string' ? w.rationale.slice(0, 120) : '',
      });
    }

    // ── Path ─────────────────────────────────────────────────────────────────────────
    let path: { anchor: [number, number]; dir: string } | null = null;
    if (parsed.path && typeof parsed.path === 'object') {
      const p = parsed.path as Record<string, unknown>;
      const anchor = anchorOf(p.anchor);
      const dir = aspectOf(p.dir);
      if (anchor && dir) path = { anchor, dir };
    }

    if (zones.length === 0 && !vegGarden && !windbreak && water.length === 0) {
      return NextResponse.json({ error: 'No design returned' }, { status: 502 });
    }

    const overall = typeof parsed.overall === 'string' ? parsed.overall.slice(0, 160) : '';
    console.log(
      `auto-design: ok — ${zones.length} zones, veg=${!!vegGarden}, windbreak=${!!windbreak}, water=${water.length}, path=${!!path}`,
    );
    return NextResponse.json({ zones, vegGarden, windbreak, water, path, overall });
  } catch (err) {
    console.error('auto-design error:', err);
    const message = err instanceof Error ? err.message : 'Auto-design failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

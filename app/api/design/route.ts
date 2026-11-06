import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { LocationData } from '@/lib/types';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { AI_MODELS, meteredAi } from '@/lib/metered-ai';
import { imageTooLarge, MAX_FREE_TEXT_CHARS, MAX_IMAGES_PER_REQUEST } from '@/lib/api-request-limits';
import { resolveLocalAdvicePolicy, localAdviceDecisionCurrent } from '@/lib/local-advice-policy';
import type { LocalAdviceDecision } from '@/lib/local-advice-types';
import { selectLocalAdviceSystem } from '@/lib/local-advice-prompts';

const LANGUAGES: Record<string, string> = {
  en: 'English', af: 'Afrikaans', zu: 'isiZulu', xh: 'isiXhosa',
  st: 'Sesotho', nso: 'Sepedi', tn: 'Setswana', ts: 'Xitsonga',
  ve: 'Tshivenda', ss: 'siSwati', nr: 'isiNdebele',
};

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/design');
  if (auth.response) return auth.response;
  let body: { adviceContext?: unknown; images: Array<{ data: string; mediaType: string }>; locationData: LocationData; photoAnalysis?: string; language?: string; tone?: 'simple' | 'professional' };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  const { images, locationData, photoAnalysis, language, tone } = body;

  if (!Array.isArray(images) || !images.length) return NextResponse.json({ error: 'No sketch provided' }, { status: 400 });
  if (images.length > MAX_IMAGES_PER_REQUEST) {
    return NextResponse.json({ error: 'Too many images — send up to 6.' }, { status: 413 });
  }
  if (images.some((img) => imageTooLarge(img))) {
    return NextResponse.json({ error: 'One of the images is too large.' }, { status: 413 });
  }
  if (images.some(img => !img || typeof img.data !== 'string' || !img.data || !['image/jpeg', 'image/png'].includes(img.mediaType))
    || (photoAnalysis !== undefined && typeof photoAnalysis !== 'string')
    || (language !== undefined && typeof language !== 'string')
    || (tone !== undefined && tone !== 'simple' && tone !== 'professional')) {
    return NextResponse.json({ error: 'Invalid sketch inputs' }, { status: 400 });
  }
  if (typeof photoAnalysis === 'string' && photoAnalysis.length > MAX_FREE_TEXT_CHARS) {
    return NextResponse.json({ error: 'Photo analysis text is too long.' }, { status: 413 });
  }

  if (!locationData?.biome || !locationData.rainfall || !locationData.elevation
      || !locationData.soil || !locationData.climate
      || !Number.isFinite(locationData.lat) || !Number.isFinite(locationData.lon)) {
    return NextResponse.json({ error: 'Invalid location data' }, { status: 400 });
  }

  const policyInput = { adviceContext: body.adviceContext, location: locationData, hasSiteInputs: true };
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
      text: selectLocalAdviceSystem(decision.mode, `You are an expert permaculture designer. The farmer has uploaded a hand-drawn (or rough) sketch of their property. Read the sketch carefully — note everything they have marked: the house/buildings, boundaries, slopes, water (rivers, dams, taps), existing trees, roads/paths, a north arrow if present, and anything else.

Produce a practical permaculture DESIGN laid out on THEIR sketch — refer to the actual features they drew ("near the house you marked top-left...", "along the slope running down to the stream..."). Make it buildable for a small-scale farmer.

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

Be specific to their sketch and this site. This is a real plan they will use.`),
    },
  ];

  if (!await stillCurrent()) return contextChanged();
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const metered = await meteredAi(req, auth, '/api/design', client);
    allowanceMayBeSpent = true;
    if (metered.response) return metered.response;
    if (!await stillCurrent()) return contextChanged();
    const stream = await metered.ai.messages.stream({ model: AI_MODELS.main, max_tokens: 3000,
      messages: [{ role: 'user', content }] }, { signal: req.signal });
    const chunks: string[] = [];
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') chunks.push(chunk.delta.text);
    }
    // The metered iterator has settled actual completed work; stale buffered
    // advice is still withheld rather than leaking a previously sent prefix.
    if (!await stillCurrent() || req.signal.aborted) return contextChanged();
    return new Response(chunks.join(''), { headers: { 'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Imbewu-Advice-Mode': decision.mode } });
  } catch {
    console.error('[api/design] local advice request failed');
    if (!await stillCurrent()) return contextChanged();
    return NextResponse.json({ code: 'LOCAL_ADVICE_MODEL_UNAVAILABLE',
      error: 'The sketch advice could not be completed. No advice was delivered. Try a clear image of the whole sketch again explicitly.', allowanceMayBeSpent },
      { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

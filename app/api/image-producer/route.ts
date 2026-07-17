import { NextRequest, NextResponse } from 'next/server';

// Strict single-purpose "restyle, never redesign" endpoint. The caller has already
// composited the exact scene (satellite + placed elements + boundary) — this route
// only beautifies it via Gemini image generation ("nano banana").
// Gemini image generation can take 10-60s — Vercel max.
export const maxDuration = 60;

// BEST-EFFORT per-IP rate limit — this route calls billed external AI APIs
// (Gemini pro-preview and, since the second engine was added, OpenAI's
// gpt-image-2 via fal.ai at 'high' quality) and the site currently has NO
// auth wall at all (see
// middleware.ts — the shared-password gate was deliberately disabled during
// prototyping), so without SOME limit any anonymous caller could script an
// unbounded loop against real API keys. This in-memory sliding window is NOT
// a real security boundary (it resets on cold start and isn't shared across
// serverless instances/regions) — it only raises the bar above a trivial
// unthrottled loop. The durable fix is re-enabling the site's auth wall or a
// proper shared store (Vercel KV etc.); that's a product call, not made here.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 20; // generous enough for a real editing session (style/engine A-B, retries)
const requestLog = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(ip, recent);
  return recent.length > RATE_LIMIT_MAX;
}

function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
}

const GEMINI_MODELS = {
  flash: 'gemini-3.1-flash-image',
  pro: 'gemini-3-pro-image',
  'pro-preview': 'gemini-3-pro-image-preview',
} as const;
type GeminiModel = keyof typeof GEMINI_MODELS;

// Four researched site-plan styles (permaculture/landscape-plan traditions).
type StylePreset = 'field_ledger' | 'homestead_storybook' | 'extension_blueprint' | 'karoo_folk';

// Every style MUST render the ground as living land — a style that swaps the
// plot for "paper" or blank white is exactly the satellite-disappears failure.
const STYLE_LINES: Record<StylePreset, string> = {
  field_ledger:
    'STYLE — Field Ledger: a hand-inked site-plan illustration — fine dark pen linework over rich watercolour. The ground inside the plot is painted as living land in greens, olive and warm earth tones with visible lawn/veld/soil texture; it must NEVER read as blank, cream or paper. Warm, credible surveyor character.',
  homestead_storybook:
    'STYLE — Homestead Storybook: a saturated gouache-painted illustrated garden map, warm picture-book quality, rounded stylised beds bursting with vegetables, canopy-textured fruit trees, an earthy palette of ochre, leaf green and terracotta, whimsical but legible.',
  extension_blueprint:
    'STYLE — Extension Blueprint: a clean technical site plan with slight isometric character on structures, muted professional palette (slate blue, sage, warm grey) — but the ground is still softly tinted living land (sage lawn, buff soil, olive veld), never blank white; thin consistent linework, high legibility at small print size.',
  karoo_folk:
    'STYLE — Karoo Folk Map: a bold naive folk-art farm map, flattened bird’s-eye view, saturated colours (barn red, cobalt, sunflower yellow, pine green), decorative South African folk pattern textures, oversized clearly-iconic feature shapes, charming handmade brushwork.',
};

// The producer's job changed from "don't touch the elements" to "ILLUSTRATE the
// marked elements beautifully and recognisably, in place, and invent nothing new".
// The composite the model receives has the farmer's placed elements drawn as
// coloured markers; elementsText names what each is so the model draws it as the
// real thing (a bed of cabbages, a green JoJo tank, a beehive) rather than a flat shape.
function buildProducerPrompt(
  layerLabel: string | undefined,
  stylePreset: StylePreset,
  elementsText: string,
  mapKind: 'base' | 'full' = 'full',
  retry = false,
): string {
  const noWrite =
    `ABSOLUTELY NO WRITING: the output image must contain ZERO text, letters, words, labels, captions, numbers, legends, banners, signage, compass rose or watermark — not on features, not in corners, nowhere. If you are about to draw any glyph, do not. (Labels are added separately afterwards.) `;
  const noInvent =
    `DO NOT INVENT: draw only what is already visible or marked — no extra gardens, beds, paths, ponds, trees, buildings, fences, vehicles, animals, people or decorations. `;
  const featureLegend =
    `a green rectangle marker → a tidy vegetable bed full of cabbages and leafy greens; a small cylinder/drum marker → a green cylindrical JoJo water tank; a hive marker → a striped beehive; a tree marker → a fruit tree with a full canopy; a hut/shed marker → that building; ` +
    `a grey/tan tinted polygon area → a real driveway surface (gravel or paving) exactly that shape and size, empty of vehicles; a warm-tan tinted polygon area → a paved outdoor patio exactly that shape and size; a blue tinted polygon area → a real dam or pond of open water exactly that shape and size. `;
  const orient =
    `Keep the crop, scale and orientation identical (top of image is north); make the property boundary the crispest line.`;
  // The recurring failure is a sparse plot being painted plain/white ("blank").
  // This forbids it explicitly and demands the WHOLE plot be illustrated —
  // essential for a "base map" that may only have a house + one tree marked.
  const fillIt =
    `PAINT THE WHOLE PLOT: illustrate the ENTIRE area inside the property boundary as a complete, richly hand-painted garden map — the ground (grass, veld, soil, cultivated earth), every building, existing trees and shrubs, and paths. NEVER leave any area blank, white, plain, empty or unpainted — even if only a few features are marked, the whole plot must be a finished, beautiful illustration that matches the real photo's layout. `;
  // Field-tested failure: styles with "plan" character redraw the house as a
  // white architectural floor plan. Buildings must stay top-down roofs.
  const roofs =
    `BUILDINGS ARE ROOFS: paint the main house as its roof seen from directly above, matching the exact roof outline and colour visible in the photo — never as a floor plan, never with interior walls, never as a plain white shape. ` +
    // Field-tested failure #2 (recurring — happened twice): the model reads
    // ambiguous photo blobs near driveways/gates/shadows as a small shed and
    // paints an outbuilding the farmer never drew or marked. This is now the
    // single loudest rule in the prompt because softer wording kept losing.
    `STRICT BUILDING RULE — READ THIS TWICE: paint ONLY the main house's roof, plus any building explicitly marked in the list below. Do NOT paint a second building, shed, carport, garage or any other outbuilding ANYWHERE on the plot, even if a shape near the driveway, a gate, a shadow or a tree canopy looks roof-like to you — those are ALWAYS ground, vegetation or hardstanding, never a structure, unless that exact structure is named in the marked-features list. When in doubt, it is not a building. `;

  const task = mapKind === 'base'
    ? `\nTASK: repaint this satellite photo of a REAL South African smallholding as a beautiful illustrated BASE MAP of the land exactly as it is today${layerLabel ? ' (the ' + layerLabel + ')' : ''}. Paint what the photo actually shows — the main house, existing trees and vegetation, lawn, bare ground, paths and driveway — plus exactly the marked existing features, and no other buildings (see the strict building rule below). `
    : `\nTASK: turn this satellite photo of a REAL South African smallholding${layerLabel ? ' (the ' + layerLabel + ')' : ''} into a beautiful illustrated site map. `;

  // A plan set has ONE sheet per layer (see docs/PLAN-SET-SPEC.md). Without this, the model
  // painted a lush garden — beds, crop rows, orchards — onto the ZONES sheet, because the rules
  // above ask for a "garden map" and "cultivated earth" regardless of which layer was requested.
  // Each sheet must communicate its own layer and leave the others to their own sheet.
  const isLayerMap = !!layerLabel && layerLabel !== 'Full design';
  const layerFocus = isLayerMap
    ? `SINGLE-LAYER SHEET — READ CAREFULLY: this is the ${layerLabel!.toUpperCase()} sheet of a plan set and must communicate ONLY the ${layerLabel} layer. Every other layer has its own sheet. Do NOT illustrate vegetable beds, crop rows, orchards, flower borders, livestock, tanks or structures unless that exact element is named in the marked-features list below. Existing vegetation stays as plain, flat, muted canopy/ground — never elaborated into a designed garden. `
    : '';

  // On a single-layer sheet the "richly hand-painted garden map / cultivated earth" wording
  // directly contradicts the layer focus — it's what produced beds and orchards on the ZONES
  // sheet. Keep the whole plot painted (the blank-plot failure is worse), but keep it QUIET.
  const fillItCalm =
    `PAINT THE WHOLE PLOT, BUT CALMLY: illustrate the ENTIRE area inside the property boundary — never leave any area blank, white, plain or unpainted — but keep it a QUIET BASE: plain grass, veld, bare soil and existing tree canopies in flat, muted, low-contrast tones, matching the real photo's layout. The ${layerLabel} content must be the only thing that stands out. `;

  const rules =
    (retry ? `IMPORTANT — YOUR PREVIOUS ATTEMPT FAILED: it left the plot blank / plain white. That is unacceptable. Every part of the plot must be painted as living land this time. ` : '') +
    // Lead with the two most-violated rules, stated absolutely.
    noWrite + noInvent +
    task +
    layerFocus +
    (isLayerMap ? fillItCalm : fillIt) + roofs +
    `Redraw EACH marked feature as an attractive, instantly-recognisable illustration exactly where it is marked and at the same count — ` +
    featureLegend +
    (elementsText ? `The marked features are: ${elementsText}. ` : '') +
    `Keep the main house, driveway, road and the property boundary exactly in their true position, shape and size; ` +
    `the driveway is a simple access track of the exact traced shape — do NOT turn it into a loop, roundabout, circular drive or turning circle, and do not add extra branches to it; ${orient}`;
  return `${rules}\n\n${STYLE_LINES[stylePreset]}`;
}

async function callGemini(
  key: string,
  imageBase64: string,
  prompt: string,
  model: GeminiModel = 'pro-preview',
): Promise<NextResponse> {
  const modelId = GEMINI_MODELS[model] ?? GEMINI_MODELS['pro-preview'];
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
    { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
  ];
  const geminiBody = {
    contents: [{ parts }],
    // Lower temperature (default ~1) trades a little creative range for more
    // repeatable output — an attempt at tightening the roof-shape/colour
    // variance Rory saw across repeated produces of the same design. Image
    // generation still isn't deterministic at any temperature, so this is a
    // lever, not a guarantee.
    generationConfig: { responseModalities: ['image', 'text'], temperature: 0.4 },
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiBody),
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json(
      { error: `Gemini error ${res.status}`, detail: detail.slice(0, 400) },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json(
      { error: 'Gemini returned non-JSON response.', detail: raw.slice(0, 400) },
      { status: 502 },
    );
  }
  let out: string | null = null;
  for (const c of (data as { candidates?: { content?: { parts?: { inlineData?: { data?: string }; inline_data?: { data?: string } }[] } }[] }).candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      const inl = p.inlineData ?? p.inline_data;
      if (inl?.data) out = inl.data;
    }
  }
  if (!out) {
    return NextResponse.json(
      { error: 'Gemini returned no image.', detail: JSON.stringify(data).slice(0, 400) },
      { status: 502 },
    );
  }
  return NextResponse.json({ image: out, model: modelId });
}

// Second engine, opt-in ("advanced models" toggle, Pro mode only) — gpt-image-2,
// OpenAI's most advanced image model (gpt-image-1 is the older generation).
// Direct calls to OpenAI's images/edits endpoint 504 on Vercel's 60s cap once
// gpt-image-2 is in the loop (see app/api/ai-render/route.ts's own history —
// that's exactly why THAT route also moved gpt-image-2 behind fal.ai's async
// QUEUE instead of calling OpenAI directly). Reusing the identical proven
// pattern here: submit to fal's queue and return {pending, statusUrl,
// responseUrl} immediately — the actual generation runs on fal, so this
// request never sits open waiting. The client polls the SAME
// /api/ai-render/poll route (it's engine-agnostic — it only speaks fal's
// queue protocol, not anything ai-render-specific) via lib/ai-render-client's
// pollFalRender, exactly like the existing "Polish" flow already does.
async function submitGptImage2(key: string, imageBase64: string, prompt: string): Promise<NextResponse> {
  const body = {
    prompt,
    image_urls: [`data:image/jpeg;base64,${imageBase64}`],
    quality: 'high', // no 60s cap to fit under via the async queue — go for the best tier
    image_size: 'auto', // composite isn't square — let the model match the input aspect
    num_images: 1,
    output_format: 'jpeg',
  };
  let res: Response;
  try {
    res = await fetch('https://queue.fal.run/openai/gpt-image-2/edit', {
      method: 'POST',
      headers: { Authorization: `Key ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (e) {
    return NextResponse.json({ error: `Network error: ${String(e)}` }, { status: 502 });
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    return NextResponse.json({ error: `fal.ai submit error ${res.status}`, detail: detail.slice(0, 400) }, { status: 502 });
  }
  let data: { status_url?: string; response_url?: string };
  try {
    data = await res.json();
  } catch {
    const raw = await res.text().catch(() => '(unreadable)');
    return NextResponse.json({ error: 'fal.ai submit returned non-JSON.', detail: raw.slice(0, 400) }, { status: 502 });
  }
  if (!data.status_url || !data.response_url) {
    return NextResponse.json({ error: 'fal.ai submit gave no status/response URL.', detail: JSON.stringify(data).slice(0, 300) }, { status: 502 });
  }
  return NextResponse.json({ pending: true, statusUrl: data.status_url, responseUrl: data.response_url });
}

export async function POST(req: NextRequest) {
  if (isRateLimited(clientIp(req))) {
    return NextResponse.json(
      { error: 'Too many produce requests from this connection — please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  let body: {
    imageBase64?: string;
    layerLabel?: string;
    elementsText?: string;
    model?: GeminiModel;
    stylePreset?: StylePreset;
    mapKind?: 'base' | 'full';
    retry?: boolean;
    engine?: 'gemini' | 'openai';
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const stripDataUrl = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');
  const imageBase64 = body.imageBase64 ? stripDataUrl(body.imageBase64) : '';
  if (!imageBase64) {
    return NextResponse.json({ error: 'No image supplied.' }, { status: 400 });
  }

  const stylePreset: StylePreset =
    body.stylePreset && body.stylePreset in STYLE_LINES ? body.stylePreset : 'field_ledger';
  const elementsText = typeof body.elementsText === 'string' ? body.elementsText.slice(0, 1200) : '';
  const mapKind = body.mapKind === 'base' ? 'base' : 'full';
  const prompt = buildProducerPrompt(body.layerLabel, stylePreset, elementsText, mapKind, body.retry === true);

  if (body.engine === 'openai') {
    const falKey = process.env.FAL_KEY;
    if (!falKey) {
      return NextResponse.json(
        { error: 'FAL_KEY is not configured — add it with: vercel env add FAL_KEY production' },
        { status: 500 },
      );
    }
    return submitGptImage2(falKey, imageBase64, prompt);
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured — add it with: vercel env add GEMINI_API_KEY production' },
      { status: 500 },
    );
  }
  // Most advanced Gemini image model — settled winner across an exhaustive
  // provider comparison (see memory: "Provider verdict") — default when the
  // caller doesn't specify.
  const model: GeminiModel = body.model && body.model in GEMINI_MODELS ? body.model : 'pro-preview';
  return callGemini(geminiKey, imageBase64, prompt, model);
}

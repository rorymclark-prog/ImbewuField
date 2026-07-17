import { NextRequest, NextResponse } from 'next/server';
import { buildProducerPrompt, STYLE_LINES, type StylePreset } from '@/lib/producer-prompt';

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

// StylePreset, STYLE_LINES and buildProducerPrompt now live in lib/producer-prompt.ts, shared
// with the client so the background render-queue path (functions/) builds the IDENTICAL prompt.

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
  const body: Record<string, unknown> = {
    prompt,
    image_urls: [`data:image/jpeg;base64,${imageBase64}`],
    quality: 'high', // no 60s cap to fit under via the async queue — go for the best tier
    image_size: 'auto', // composite isn't square — let the model match the input aspect
    num_images: 1,
    output_format: 'jpeg',
  };
  // BYOK (bring-your-own-key): fal's HOSTED gpt-image-2 bills fal credits, and a fal account with
  // no balance/billing returns 403 Forbidden on submit (that's the "fal.ai submit error 403" the
  // farmer hit). If we have our own OpenAI key, hand it to fal so the generation bills OUR OpenAI
  // account instead — this bypasses the fal-credit gate entirely. (gpt-image on OpenAI still needs
  // the OpenAI org to be verified; if it isn't, fal relays OpenAI's own 403.)
  if (process.env.OPENAI_API_KEY) body.openai_api_key = process.env.OPENAI_API_KEY;
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
    // Surface fal's own reason text in the message (e.g. "Exhausted balance") so a 403 is
    // diagnosable from the UI instead of a bare status code.
    return NextResponse.json({ error: `fal.ai submit error ${res.status}${detail ? ` — ${detail.slice(0, 200)}` : ''}`, detail: detail.slice(0, 400) }, { status: 502 });
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
    designBrief?: string;
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
  // Capped like elementsText. The caller already assembles the brief within the same budget on line
  // boundaries; this is the server-side guard — request bodies are never trusted, and an unbounded
  // brief would push the real drawing rules out of the model's attention.
  const designBrief = typeof body.designBrief === 'string' ? body.designBrief.slice(0, 1500) : '';
  const mapKind = body.mapKind === 'base' ? 'base' : 'full';
  const prompt = buildProducerPrompt(body.layerLabel, stylePreset, elementsText, mapKind, body.retry === true, designBrief);

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

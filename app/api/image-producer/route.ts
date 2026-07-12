import { NextRequest, NextResponse } from 'next/server';

// Strict single-purpose "restyle, never redesign" endpoint. The caller has already
// composited the exact scene (satellite + placed elements + boundary) — this route
// only beautifies it via Gemini image generation ("nano banana").
// Gemini image generation can take 10-60s — Vercel max.
export const maxDuration = 60;

const GEMINI_MODELS = {
  flash: 'gemini-3.1-flash-image',
  pro: 'gemini-3-pro-image',
} as const;
type GeminiModel = keyof typeof GEMINI_MODELS;

type StylePreset = 'hand_drawn' | 'watercolour' | 'enhanced_real';

const STYLE_LINES: Record<StylePreset, string> = {
  hand_drawn:
    'Style: a clean, soft hand-drawn permaculture site map — gentle earth tones, subtle grass and soil texture, South African smallholding character.',
  watercolour:
    'Style: soft watercolour illustration — muted natural washes, light paper texture, gentle edges.',
  enhanced_real:
    'Style: the same photo, gently enhanced — cleaner light, richer but natural greens and soil, no stylisation, still photoreal.',
};

function buildProducerPrompt(layerLabel: string | undefined, stylePreset: StylePreset): string {
  const hardRules = `This is a REAL property${layerLabel ? ' — the ' + layerLabel : ''}, not a concept. Redraw the SAME scene in a new artistic style. STRICT: (1) Do NOT invent, add, move, remove or resize ANY feature — no new gardens, paths, ponds, trees, buildings, fences or decorations. (2) Do NOT paint any text, labels, banners, legends, compass or watermark. (3) Every feature already visible stays in its exact position, shape, count and size — the result must be recognisably THIS property, feature for feature. (4) Keep the crop, scale and orientation identical; top of image is north. (5) When unsure, keep it identical to the input. Change the STYLE only, never the content.`;

  return `${hardRules}\n\n${STYLE_LINES[stylePreset]}`;
}

async function callGemini(
  key: string,
  imageBase64: string,
  prompt: string,
  model: GeminiModel = 'flash',
): Promise<NextResponse> {
  const modelId = GEMINI_MODELS[model] ?? GEMINI_MODELS.flash;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${key}`;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
    { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
  ];
  const geminiBody = {
    contents: [{ parts }],
    generationConfig: { responseModalities: ['image', 'text'] },
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

export async function POST(req: NextRequest) {
  let body: {
    imageBase64?: string;
    layerLabel?: string;
    model?: GeminiModel;
    stylePreset?: StylePreset;
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

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured — add it with: vercel env add GEMINI_API_KEY production' },
      { status: 500 },
    );
  }

  const model: GeminiModel = body.model && body.model in GEMINI_MODELS ? body.model : 'flash';
  const stylePreset: StylePreset =
    body.stylePreset && body.stylePreset in STYLE_LINES ? body.stylePreset : 'hand_drawn';
  const prompt = buildProducerPrompt(body.layerLabel, stylePreset);

  return callGemini(geminiKey, imageBase64, prompt, model);
}

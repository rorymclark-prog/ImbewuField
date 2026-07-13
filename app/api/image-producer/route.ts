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
    `a green rectangle marker → a tidy vegetable bed full of cabbages and leafy greens; a small cylinder/drum marker → a green cylindrical JoJo water tank; a hive marker → a striped beehive; a tree marker → a fruit tree with a full canopy; a hut/shed marker → that building. `;
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
    `BUILDINGS ARE ROOFS: paint every building as its roof seen from directly above, matching the exact roof outline and colour visible in the photo — never as a floor plan, never with interior walls, never as a plain white shape. ` +
    // Field-tested failure #2: the model reads ambiguous photo blobs (shadows,
    // rocks, tanks, tree crowns, light patches) as sheds and adds buildings the
    // farmer never drew. Buildings need positive evidence; otherwise ground.
    `STRICT BUILDING RULE: draw a building ONLY where one is explicitly marked, or where the photo unmistakably shows a real roof. An ambiguous light patch, shadow, rock, vehicle or bush must NEVER become a shed or structure — when unsure, paint open ground instead. `;

  const task = mapKind === 'base'
    ? `\nTASK: repaint this satellite photo of a REAL South African smallholding as a beautiful illustrated BASE MAP of the land exactly as it is today${layerLabel ? ' (the ' + layerLabel + ')' : ''}. Paint only what the photo actually shows — the house and outbuildings, existing trees and vegetation, lawn, bare ground, paths and driveway — plus the marked existing features. `
    : `\nTASK: turn this satellite photo of a REAL South African smallholding${layerLabel ? ' (the ' + layerLabel + ')' : ''} into a beautiful illustrated site map. `;

  const rules =
    (retry ? `IMPORTANT — YOUR PREVIOUS ATTEMPT FAILED: it left the plot blank / plain white. That is unacceptable. Every part of the plot must be painted as living land this time. ` : '') +
    // Lead with the two most-violated rules, stated absolutely.
    noWrite + noInvent +
    task +
    fillIt + roofs +
    `Redraw EACH marked feature as an attractive, instantly-recognisable illustration exactly where it is marked and at the same count — ` +
    featureLegend +
    (elementsText ? `The marked features are: ${elementsText}. ` : '') +
    `Keep every real building, roof, driveway, road and the property boundary exactly in their true position, shape and size; ${orient}`;
  return `${rules}\n\n${STYLE_LINES[stylePreset]}`;
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
    elementsText?: string;
    model?: GeminiModel;
    stylePreset?: StylePreset;
    mapKind?: 'base' | 'full';
    retry?: boolean;
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
    body.stylePreset && body.stylePreset in STYLE_LINES ? body.stylePreset : 'field_ledger';
  const elementsText = typeof body.elementsText === 'string' ? body.elementsText.slice(0, 1200) : '';
  const mapKind = body.mapKind === 'base' ? 'base' : 'full';
  const prompt = buildProducerPrompt(body.layerLabel, stylePreset, elementsText, mapKind, body.retry === true);

  return callGemini(geminiKey, imageBase64, prompt, model);
}

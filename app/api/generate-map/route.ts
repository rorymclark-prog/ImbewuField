import { NextRequest, NextResponse } from 'next/server';

// Gemini image generation (the "nano-banana" image model). Takes the canonical
// map prompt + reference image(s) and returns one generated map image.
// Reads the key from the server env (set in Vercel). Several common names are
// accepted so it works whatever the project used.
const KEY =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_AI_API_KEY ||
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  '';

const MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';

interface InImage { data: string; mediaType: string }

export async function POST(req: NextRequest) {
  if (!KEY) {
    return NextResponse.json(
      { error: 'No Gemini key on the server. Set GEMINI_API_KEY in the Vercel project env.' },
      { status: 400 },
    );
  }

  let body: { prompt?: string; images?: InImage[] };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Bad request body.' }, { status: 400 }); }

  const prompt = (body.prompt ?? '').trim();
  if (!prompt) return NextResponse.json({ error: 'Missing prompt.' }, { status: 400 });

  const images = Array.isArray(body.images) ? body.images.filter((i) => i && i.data) : [];

  // When only the traced site map is available, tell the model so it doesn't
  // wait for a missing IMAGE 2.
  const preamble = images.length <= 1
    ? 'NOTE: Only IMAGE 1 (the traced site map) is provided. Treat it as the authoritative geometry and infer surroundings sensibly.\n\n'
    : '';

  const parts: Array<Record<string, unknown>> = [{ text: preamble + prompt }];
  for (const img of images) {
    parts.push({ inlineData: { mimeType: img.mediaType || 'image/png', data: img.data } });
  }

  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: { responseModalities: ['IMAGE'] },
        }),
      },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Network error calling Gemini.' }, { status: 502 });
  }

  if (!res.ok) {
    const detail = (await res.text().catch(() => '')).slice(0, 400);
    return NextResponse.json({ error: `Gemini error ${res.status}.`, detail }, { status: 502 });
  }

  const json = await res.json().catch(() => null) as
    | { candidates?: Array<{ content?: { parts?: Array<{ text?: string; inlineData?: { data?: string; mimeType?: string } }> } }> }
    | null;

  const outParts = json?.candidates?.[0]?.content?.parts ?? [];
  const imgPart = outParts.find((p) => p.inlineData?.data);
  if (!imgPart?.inlineData?.data) {
    const text = outParts.find((p) => p.text)?.text;
    return NextResponse.json({ error: 'Gemini returned no image.', detail: text?.slice(0, 300) }, { status: 502 });
  }

  return NextResponse.json({
    image: { data: imgPart.inlineData.data, mediaType: imgPart.inlineData.mimeType || 'image/png' },
  });
}

import { NextRequest, NextResponse } from 'next/server';

// Gemini image generation ("nano-banana") can take 10-40s — allow headroom.
export const maxDuration = 60;

const MODEL = 'gemini-2.5-flash-image';

interface RenderContext {
  placeName?: string;
  address?: string;
  biome?: string;
  rainfallMm?: number;
  soilTexture?: string;
  zones?: Array<{ n: number; title: string; items?: string[] }>;
  features?: Array<{ name: string; area?: string; type?: string }>;
}

function buildPrompt(ctx: RenderContext): string {
  const zoneLines = (ctx.zones ?? [])
    .map((z) => `  • Zone ${z.n}: ${z.title}${z.items?.length ? ` (${z.items.slice(0, 3).join(', ')})` : ''}`)
    .join('\n');
  const featureLines = (ctx.features ?? [])
    .map((f) => `  • ${f.name}${f.area ? ` — ${f.area}` : ''}`)
    .join('\n');
  return `You are a professional permaculture designer. The attached image is a REAL aerial/satellite photo of a property${ctx.address ? ` at ${ctx.address}` : ''}, South Africa${ctx.biome ? ` (${ctx.biome})` : ''}.

CRITICAL: Keep the real photograph exactly as-is underneath — do NOT redraw, move or invent the house, driveway, trees, roads or neighbouring buildings. Only ADD a clean, professional permaculture design overlay ON TOP, like an architect's annotated site plan.

Add, in a crisp modern flat-vector style:
- Numbered ZONE markers (filled coloured circles, white numbers) placed on the real features, with a thin matching-colour outline around each zone area following the real ground:
${zoneLines || '  • Zones 0–5 from house outward (0 house, 1 daily use, 2 intensive, 3 orchard, 4 low-care, 5 conservation buffer)'}
  Colours: 0 blue, 1 red, 2 orange, 3 gold, 4 light-green, 5 teal. Put the orchard/food-forest zone on open sunny ground toward the NORTH (strongest sun in the Southern Hemisphere).
- The green PROPERTY BOUNDARY outlined.
- Blue arrows for surface water runoff downhill; dashed blue arrows for slow/spread/infiltrate (swales); a rainwater-harvesting droplet icon at the house.
- A dashed white arrow along the existing driveway (vehicle access); fine dotted footpaths.
- Short clean white labels (subtle shadow) for the key areas (orchard / food forest, low-care production, existing tree belt & buffer, compost area, veg garden).
- A LEGEND panel on the right (semi-transparent dark card): the zones with colours + one-line descriptions, plus Access, Water Strategy, and a small Sun Path diagram (N strongest, summer high / winter low).
- A title block top-left on a translucent dark card: "${ctx.placeName ?? 'Permaculture Design'}" / "Permaculture Design Map"${ctx.address ? ` / "${ctx.address}"` : ''} / "${[ctx.biome, ctx.rainfallMm ? `${ctx.rainfallMm} mm/yr` : '', ctx.soilTexture ? `${ctx.soilTexture} soil` : ''].filter(Boolean).join(' · ')}".
- A north arrow (top-right) and a scale bar (bottom-left).
${featureLines ? `\nKnown traced features (keep them where they are):\n${featureLines}\n` : ''}
Style: high-end permaculture / landscape-architecture presentation board — legible, professional, not cluttered. Output the final annotated image.`;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  let body: { imageBase64?: string; context?: RenderContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const imageBase64 = (body.imageBase64 ?? '').replace(/^data:image\/\w+;base64,/, '');
  if (!imageBase64) {
    return NextResponse.json({ error: 'No satellite image supplied.' }, { status: 400 });
  }

  const prompt = buildPrompt(body.context ?? {});
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const geminiBody = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/png', data: imageBase64 } },
        ],
      },
    ],
    generationConfig: { responseModalities: ['IMAGE'] },
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

  const data = await res.json();
  let out: string | null = null;
  for (const c of data.candidates ?? []) {
    for (const p of c.content?.parts ?? []) {
      const inl = p.inlineData ?? p.inline_data;
      if (inl?.data) out = inl.data;
    }
  }
  if (!out) {
    return NextResponse.json(
      { error: 'Gemini returned no image (possibly blocked or text-only).' },
      { status: 502 },
    );
  }
  return NextResponse.json({ image: `data:image/png;base64,${out}` });
}

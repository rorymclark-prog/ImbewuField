import { NextRequest, NextResponse } from 'next/server';

// Gemini image generation ("nano-banana") can take 10-40s — allow headroom.
export const maxDuration = 60;

const MODEL = 'gemini-2.5-flash-image';

type RenderLayer = 'overall' | 'base' | 'water' | 'sector' | 'zone' | 'implementation';

interface SurveyCtx {
  siteType?: string;
  adults?: string;
  goals?: string[];
  waterSource?: string[];
  waterStorage?: string[];
  existingCrops?: string[];
  livestock?: string[];
  otherInfra?: string[];
  soilCondition?: string;
  hasFencing?: string;
  farmingPractice?: string;
  challenges?: string[];
  notes?: string;
}

interface RenderContext {
  placeName?: string;
  address?: string;
  layer?: RenderLayer;
  biome?: string;
  rainfallMm?: number;
  rainfallPattern?: string;
  soilTexture?: string;
  soilPh?: number;
  slopeDeg?: number;
  aspectLabel?: string;
  minTemp?: number;
  maxTemp?: number;
  zones?: Array<{ n: number; title: string; items?: string[] }>;
  polygons?: Array<{ name: string; type?: string; area?: string }>;
  survey?: SurveyCtx;
}

function layerTheme(layer: RenderLayer): string {
  switch (layer) {
    case 'base':
      return `MAP FOCUS — BASE MAP: a clean "what's here today" map. Keep the satellite crisp and bright; outline the property boundary, house roof, vegetable garden and any tree belt with clean coloured lines + short labels. NO zones, NO design arrows — just the honest existing site.`;
    case 'water':
      return `MAP FOCUS — WATER & HYDROLOGY: emphasise water. Bold blue arrows = surface runoff downhill; dashed blue = swales / slow-spread-sink on contour; a droplet + tank icon at the house roof (rainwater harvesting); dam/pond markers at low points. Mute other elements to soft greys so water reads clearly.`;
    case 'sector':
      return `MAP FOCUS — SECTOR ANALYSIS: show external energies entering from OUTSIDE the boundary — a sun arc (sun strongest from the NORTH in the Southern Hemisphere, summer-high / winter-low), bold prevailing summer & winter wind arrows, and frost / fire wedges aimed at the site. Keep the boundary crisp.`;
    case 'zone':
      return `MAP FOCUS — ZONE MAP: show permaculture Zones 0–5 as clean coloured regions with big numbered badges (0 house → 5 wild edge), placed on the real ground. This is about WHERE each zone is, not detailed design.`;
    case 'implementation':
      return `MAP FOCUS — IMPLEMENTATION MAP: show the phased BUILD SEQUENCE — numbered pins (1,2,3…) at each task location, connected by a dotted path in order, coloured by phase (Phase 1 / 2 / 3). It should read like a step-by-step build plan on the land.`;
    default:
      return `MAP FOCUS — OVERALL MASTER PLAN: a balanced design — zones 0–5, water strategy, access and food forest integrated but uncluttered.`;
  }
}

function buildPrompt(ctx: RenderContext): string {
  const layer = ctx.layer ?? 'overall';
  const zoneLines = (ctx.zones ?? [])
    .map((z) => `  • Zone ${z.n}: ${z.title}${z.items?.length ? ` (${z.items.slice(0, 3).join(', ')})` : ''}`)
    .join('\n');
  const polyLines = (ctx.polygons ?? [])
    .map((p) => `  • ${p.name}${p.type ? ` [${p.type}]` : ''}${p.area ? ` — ${p.area}` : ''}`)
    .join('\n');
  const s = ctx.survey;
  const surveyLines = s
    ? [
        s.adults ? `Household: ${s.adults}` : '',
        s.goals?.length ? `Goals: ${s.goals.join(', ')}` : '',
        s.waterSource?.length ? `Water sources: ${s.waterSource.join(', ')}` : '',
        s.waterStorage?.length ? `Water storage: ${s.waterStorage.join(', ')}` : '',
        s.existingCrops?.length ? `Existing crops: ${s.existingCrops.join(', ')}` : '',
        s.livestock?.length ? `Livestock: ${s.livestock.join(', ')}` : '',
        s.otherInfra?.length ? `Existing infrastructure: ${s.otherInfra.join(', ')}` : '',
        s.soilCondition ? `Soil (farmer-assessed): ${s.soilCondition}` : '',
        s.hasFencing ? `Fencing: ${s.hasFencing}` : '',
        s.farmingPractice ? `Practice: ${s.farmingPractice}` : '',
        s.challenges?.length ? `Challenges: ${s.challenges.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join('\n  ')
    : '';
  const siteFigs = [
    ctx.biome,
    ctx.rainfallMm ? `${ctx.rainfallMm} mm/yr${ctx.rainfallPattern ? ` (${ctx.rainfallPattern})` : ''}` : '',
    ctx.soilTexture ? `${ctx.soilTexture} soil` : '',
    ctx.soilPh ? `pH ${ctx.soilPh}` : '',
    ctx.slopeDeg != null ? `slope ${ctx.slopeDeg}°` : '',
    ctx.aspectLabel ? `faces ${ctx.aspectLabel}` : '',
  ]
    .filter(Boolean)
    .join(' · ');

  return `You are a professional permaculture designer. The FIRST attached image is a REAL aerial/satellite photo of a property${ctx.address ? ` at ${ctx.address}` : ''}, South Africa${ctx.biome ? ` (${ctx.biome})` : ''}, WITH A SURVEYED DESIGN OVERLAY ALREADY DRAWN ON IT. Any further attached images are ground-level photos of the SAME property, for reference only.

THE COLOURED LINES ALREADY ON THE FIRST IMAGE ARE SURVEYED GROUND TRUTH AND ARE IMMUTABLE — the farmer traced them on the real land. PRESERVE THEM EXACTLY where they are; do not move, redraw, straighten, resize or invent them:
  • GREEN outline = the PROPERTY BOUNDARY (keep this exact shape).
  • ORANGE area = the EXISTING VEGETABLE GARDEN (acknowledge and keep it).
  • DASHED line = the DRIVEWAY / vehicle access (keep it).
  • BLUE area/outline = the HOUSE ROOF.
If NO dashed driveway line is present, IDENTIFY the existing driveway / vehicle access visible in the photo (the cleared track running from the road to the house) and mark it with a dashed white access arrow — locate it on the real track, do not invent a new one.
Also keep the underlying photograph exactly as-is — do NOT move or invent the house, driveway, trees, roads or neighbouring buildings. Your ONLY job is to ADD styling, icons, labels and annotations ON TOP of these fixed lines, like an architect finishing a surveyed site plan.

${layerTheme(layer)}

Add, in a crisp modern flat-vector style consistent with the layer focus above:
- Numbered ZONE markers (filled coloured circles, white numbers) on the real features, thin matching outlines following the real ground:
${zoneLines || '  • Zones 0–5 from house outward (0 house, 1 daily use, 2 intensive, 3 orchard, 4 low-care, 5 conservation buffer)'}
  Colours: 0 blue, 1 red, 2 orange, 3 gold, 4 light-green, 5 teal. Put the orchard/food-forest on open sunny ground toward the NORTH.
- Short clean white labels (subtle shadow) for the key areas.
- A LEGEND panel on the right (semi-transparent dark card): colours + one-line descriptions, plus Access, Water Strategy, and a small Sun Path diagram (N strongest, summer high / winter low).
- A title block top-left (translucent dark card): "${ctx.placeName ?? 'Permaculture Design'}" / "${layer === 'overall' ? 'Permaculture Design Map' : layer.charAt(0).toUpperCase() + layer.slice(1) + ' Layer'}"${ctx.address ? ` / "${ctx.address}"` : ''} / "${siteFigs}".
- A north arrow (top-right) and a scale bar (bottom-left).
${polyLines ? `\nSURVEYED POLYGONS (these correspond to the coloured lines — keep exactly):\n${polyLines}\n` : ''}${surveyLines ? `\nSITE CONTEXT (farmer survey — design within this reality):\n  ${surveyLines}\n` : ''}
QUALITY BAR (important): produce a CRISP, BRIGHT, HIGH-RESOLUTION professional permaculture / landscape-architecture presentation board — the kind a paid designer hands a client. Keep the satellite bright and sharp (no muddy dark wash). Use clean flat-vector styling, a tasteful colour palette, and BOLD, LARGE, clearly-legible labels (never tiny or blurry) with subtle shadows so they read over the photo. Generous spacing, strong visual hierarchy, no clutter. Output a single polished image.`;
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY is not configured on the server.' },
      { status: 500 },
    );
  }

  let body: { imageBase64?: string; photos?: string[]; context?: RenderContext };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const stripDataUrl = (s: string) => s.replace(/^data:image\/\w+;base64,/, '');
  const imageBase64 = stripDataUrl(body.imageBase64 ?? '');
  if (!imageBase64) {
    return NextResponse.json({ error: 'No composite image supplied.' }, { status: 400 });
  }
  const photos = (body.photos ?? []).slice(0, 4).map(stripDataUrl).filter(Boolean);

  const prompt = buildPrompt(body.context ?? {});
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const parts: Array<{ text: string } | { inline_data: { mime_type: string; data: string } }> = [
    { text: prompt },
    { inline_data: { mime_type: 'image/png', data: imageBase64 } },
    ...photos.map((d) => ({ inline_data: { mime_type: 'image/jpeg', data: d } })),
  ];
  const geminiBody = {
    contents: [{ parts }],
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

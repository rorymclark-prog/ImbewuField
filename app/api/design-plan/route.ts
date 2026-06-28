import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Claude design generation can take 15-40s — allow up to 60s so the (best-effort,
// background) enrichment call isn't killed by the default serverless timeout.
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

// ── Request shape ─────────────────────────────────────────────────────────────
interface DesignPlanRequest {
  boundary: number[][];
  features: Array<{
    layerType: string;
    name: string;
    centroid: [number, number];
    areaM2: number;
  }>;
  site: {
    lat: number;
    lon: number;
    biome?: string;
    rainfallMm?: number;
    soilTexture?: string;
    frost?: boolean;
    elevation?: number;
    householdSize?: number;
    goals?: string[];
  };
}

// ── Response shape ────────────────────────────────────────────────────────────
type AnchorHint =
  | 'house'
  | 'near-house'
  | 'existing-garden'
  | 'tree-belt'
  | 'open-north'
  | 'open-south'
  | 'open-east'
  | 'open-west'
  | 'edges';

interface DesignPlanAI {
  summary: string;
  zones: Array<{
    n: 0 | 1 | 2 | 3 | 4 | 5;
    title: string;
    items: string[];
    note: string;
    anchor: AnchorHint;
  }>;
  water: Array<{
    kind: 'runoff' | 'infiltrate' | 'harvest';
    note: string;
    from: 'house' | 'high' | 'garden';
    to: 'low' | 'garden' | 'boundary';
  }>;
  access: Array<{ kind: 'vehicle' | 'foot'; note: string }>;
  opportunities: Array<{ title: string; note: string; anchor: AnchorHint }>;
  notes: string;
}

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are an experienced South African permaculture designer advising small-scale farmers.
Your job is to produce a practical zone-based permaculture layout based on what is already on the property.

LOCKED GEOMETRY RULE: The features the caller provides are already on the ground — treat them as authoritative. Never move, scale, or remove them. Plan around them.

ZONE PLACEMENT RULES (by proximity / use frequency):
- Zone 0 = the HOUSE itself (anchor: "house")
- Zone 1 = daily-use area right next to the house — kitchen herbs, salads, chickens (anchor: "near-house")
- Zone 2 = existing veggie garden or orchard if one is present (anchor: "existing-garden" when applicable, otherwise "near-house")
- Zone 3 = larger food forest or orchard in an open, sunny spot — NORTH-facing in the Southern Hemisphere (anchor: "open-north" for SA, adjust by lat)
- Zone 4 = low-care grazing, woodlot, fodder trees, further out (anchor: "open-south" or "edges")
- Zone 5 = conservation, wild buffer, tree belts, boundary (anchor: "tree-belt" or "edges")

WATER STRATEGY: slow–spread–sink. Roof harvest first, swales on contour second, grey-water to mulched garden beds third.

ACCESS: vehicle track to house and main working areas; foot paths between zones.

LANGUAGE: plain South African farmer language — short sentences, no NGO jargon, no fancy words.

OUTPUT: Return ONLY valid JSON matching this exact TypeScript type — no markdown, no comments, no extra keys:

{
  "summary": string,
  "zones": [{ "n": 0|1|2|3|4|5, "title": string, "items": string[], "note": string, "anchor": AnchorHint }],
  "water": [{ "kind": "runoff"|"infiltrate"|"harvest", "note": string, "from": "house"|"high"|"garden", "to": "low"|"garden"|"boundary" }],
  "access": [{ "kind": "vehicle"|"foot", "note": string }],
  "opportunities": [{ "title": string, "note": string, "anchor": AnchorHint }],
  "notes": string
}

AnchorHint must be one of: "house" | "near-house" | "existing-garden" | "tree-belt" | "open-north" | "open-south" | "open-east" | "open-west" | "edges"

Return ONLY the JSON object — nothing else.`;

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Basic validation
  const b = body as Partial<DesignPlanRequest>;
  if (!b || !Array.isArray(b.boundary) || b.boundary.length < 3) {
    return NextResponse.json({ error: 'boundary is required (ring of at least 3 [lng,lat] pairs)' }, { status: 400 });
  }
  if (!Array.isArray(b.features)) {
    return NextResponse.json({ error: 'features array is required' }, { status: 400 });
  }
  if (!b.site || typeof b.site.lat !== 'number' || typeof b.site.lon !== 'number') {
    return NextResponse.json({ error: 'site.lat and site.lon are required' }, { status: 400 });
  }

  const { boundary, features, site } = b as DesignPlanRequest;

  // Hemisphere note
  const hemisphereNote = site.lat < 0
    ? 'This property is in the SOUTHERN hemisphere — north-facing slopes and aspects are sunniest and warmest.'
    : 'This property is in the NORTHERN hemisphere — south-facing slopes are sunniest.';

  // Summarise existing features for the prompt
  const featureSummary = features.length === 0
    ? 'No existing features have been mapped yet.'
    : features.map(f =>
        `- ${f.name} (${f.layerType}): centroid [${f.centroid[1].toFixed(5)}S, ${f.centroid[0].toFixed(5)}E], area ${Math.round(f.areaM2)}m²`
      ).join('\n');

  const userMessage = `PROPERTY DATA
Location: ${Math.abs(site.lat).toFixed(4)}°${site.lat < 0 ? 'S' : 'N'}, ${site.lon.toFixed(4)}°E
${site.elevation != null ? `Elevation: ${site.elevation}m` : ''}
${site.biome ? `Biome / vegetation: ${site.biome}` : ''}
${site.rainfallMm != null ? `Rainfall: ${site.rainfallMm}mm/year` : ''}
${site.soilTexture ? `Soil texture: ${site.soilTexture}` : ''}
${site.frost != null ? `Frost risk: ${site.frost ? 'yes' : 'no'}` : ''}
${site.householdSize != null ? `Household size: ${site.householdSize} people` : ''}
${site.goals && site.goals.length > 0 ? `Goals: ${site.goals.join(', ')}` : ''}
${hemisphereNote}

BOUNDARY (lng/lat ring, ${boundary.length} points):
${boundary.map(p => `[${p[0].toFixed(6)}, ${p[1].toFixed(6)}]`).join(', ')}

EXISTING LOCKED FEATURES (do not move or remove these):
${featureSummary}

Design a permaculture layout for this property. Remember: return ONLY the JSON object.`;

  let raw: string;
  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = msg.content.find(b => b.type === 'text');
    raw = block && block.type === 'text' ? block.text.trim() : '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 502 });
  }

  // Strip markdown code fences if Claude wraps the JSON anyway
  const stripped = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let plan: DesignPlanAI;
  try {
    plan = JSON.parse(stripped) as DesignPlanAI;
  } catch {
    return NextResponse.json({ error: 'Failed to parse design plan from AI response', raw }, { status: 502 });
  }

  // Light structural validation before returning
  if (!plan.summary || !Array.isArray(plan.zones) || !Array.isArray(plan.water) || !Array.isArray(plan.access) || !Array.isArray(plan.opportunities)) {
    return NextResponse.json({ error: 'AI response missing required fields', raw }, { status: 502 });
  }

  return NextResponse.json(plan);
}

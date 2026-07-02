import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 60;

type DetectKind = 'tree' | 'building' | 'water_tank' | 'pond' | 'veg_area' | 'driveway';
const VALID_KINDS: DetectKind[] = ['tree', 'building', 'water_tank', 'pond', 'veg_area', 'driveway'];

interface DetectedFeature {
  kind: DetectKind;
  points: Array<[number, number]>;
  sizeM?: number;
  note?: string;
}

interface DetectBody {
  imageBase64: string;
  imgW: number;
  imgH: number;
  mPerPx: number;
}

interface DetectResult {
  features: DetectedFeature[];
  boundary?: Array<[number, number]>;
  metresAcross?: number;
}

function clamp01(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

// ── Primary path: fal.ai Florence-2 real vision detector ───────────────────
//
// Claude-vision localisation proved unusable for this (±5-10% of image width
// off on point placement) — Claude is good at recognising WHAT is in a photo
// but bad at saying WHERE, pixel-accurately. Florence-2 is an actual object
// detector: it returns real pixel bounding boxes. We also use any detected
// car as a scale reference (cars are ~4.5 m long — a much better metre/px
// estimate than any LLM guess).

interface FalBbox {
  label?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
}

// Buildings now come from geo data (site-features), and Florence-2 misread
// roofs as "pools"/"dams" and sheds as "tanks" on aerial photos in field
// testing — so building/house/roof and pool/dam/pond entries are dropped
// here entirely rather than risk more false positives from this model.
const FLORENCE_LABEL_MAP: Array<{ match: string; kind: DetectKind }> = [
  { match: 'tree', kind: 'tree' },
  { match: 'water tank', kind: 'water_tank' },
  { match: 'tank', kind: 'water_tank' },
];

function labelToKind(label: string): DetectKind | null {
  const lower = label.toLowerCase();
  for (const { match, kind } of FLORENCE_LABEL_MAP) {
    if (lower.includes(match)) return kind;
  }
  return null;
}

function isCarLabel(label: string): boolean {
  return label.toLowerCase().includes('car');
}

/** Extract the bboxes array regardless of exact nesting fal returns. */
function extractBboxes(data: unknown): FalBbox[] {
  if (!data || typeof data !== 'object') return [];
  const obj = data as Record<string, unknown>;
  const candidates = [
    (obj.results as Record<string, unknown> | undefined)?.bboxes,
    obj.bboxes,
    (obj.output as Record<string, unknown> | undefined)?.bboxes,
  ];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as FalBbox[];
  }
  return [];
}

async function detectWithFal(falKey: string, body: DetectBody): Promise<DetectResult> {
  const { imageBase64, imgW, imgH, mPerPx } = body;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch('https://fal.run/fal-ai/florence-2-large/caption-to-phrase-grounding', {
      method: 'POST',
      headers: { Authorization: `Key ${falKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image_url: `data:image/jpeg;base64,${imageBase64}`,
        text_input: 'tree. water tank. car.',
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`fal.ai ${res.status}: ${detail.slice(0, 300)}`);
  }

  const data: unknown = await res.json();
  const bboxes = extractBboxes(data);
  if (bboxes.length === 0) {
    // No detections is a valid (if uninteresting) result — not a failure.
    return { features: [] };
  }

  const effImgW = imgW || 1;
  const effImgH = imgH || 1;

  // Scale from cars: cars are ~4.5 m long — beats any LLM guess at scale.
  const carSpans: number[] = [];
  for (const b of bboxes) {
    const label = typeof b.label === 'string' ? b.label : '';
    if (!isCarLabel(label)) continue;
    const w = Number(b.w);
    const h = Number(b.h);
    if (!Number.isFinite(w) || !Number.isFinite(h)) continue;
    carSpans.push(Math.max(w, h));
  }
  let metresAcross: number | undefined;
  if (carSpans.length > 0) {
    carSpans.sort((a, b) => a - b);
    const median = carSpans[Math.floor(carSpans.length / 2)];
    if (median > 0) {
      const estimate = (4.5 * effImgW) / median;
      metresAcross = clamp(estimate, 5, 5000);
    }
  }
  const effMPerPx = metresAcross ? metresAcross / effImgW : (mPerPx || 0.2);

  const features: DetectedFeature[] = [];
  for (const b of bboxes) {
    if (features.length >= 20) break;
    const label = typeof b.label === 'string' ? b.label : '';
    if (!label || isCarLabel(label)) continue; // cars are scale-only, not a feature

    const kind = labelToKind(label);
    if (!kind) continue;

    const x = Number(b.x);
    const y = Number(b.y);
    const w = Number(b.w);
    const h = Number(b.h);
    if (![x, y, w, h].every(Number.isFinite)) continue;

    // Drop degenerate boxes: too tiny or near-whole-image.
    if (w < effImgW * 0.01 || h < effImgH * 0.01) continue;
    if (w > effImgW * 0.9 || h > effImgH * 0.9) continue;

    // Kills the giant-circle failure mode: reject any box whose longer side
    // exceeds 25% of the image dimension it's measured against.
    if (w > effImgW * 0.25 || h > effImgH * 0.25) continue;

    const cx = clamp01((x + w / 2) / effImgW);
    const cy = clamp01((y + h / 2) / effImgH);

    const sizeMRaw = Math.max(w, h) * effMPerPx;
    let sizeM = clamp(Math.round(sizeMRaw * 10) / 10, 0.5, 60);

    // Per-kind sanity clamps — Florence-2's box size is unreliable enough
    // that a tree or tank estimate outside these ranges is almost certainly
    // a misdetection rather than a genuinely huge tree/tank.
    if (kind === 'tree') {
      sizeM = clamp(sizeM, 1, 12);
    } else if (kind === 'water_tank') {
      sizeM = clamp(sizeM, 0.5, 5);
    }

    features.push({
      kind,
      points: [[cx, cy]],
      sizeM,
      note: label,
    });
  }

  return metresAcross ? { features, metresAcross } : { features };
}

// ── Fallback path: Claude vision (kept working for when FAL_KEY is absent
// or the fal call fails/times out). This was the original implementation. ──

const claudeClient = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

async function detectWithClaude(body: DetectBody): Promise<DetectResult> {
  const { imageBase64, imgW, imgH, mPerPx } = body;
  if (!claudeClient) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const prompt = `You are analysing a top-down satellite photo of a South African smallholding for a permaculture design app. The image is ${imgW}x${imgH} px at an ASSUMED ${mPerPx} metres/px — this assumed scale may be wrong, so estimate the real-world scale independently from known-size objects visible in the image (cars are ~4.5 m long, a domestic roof typically spans 8-15 m, a road lane is ~3.5 m wide). Identify visible features and also the visible property/plot boundary (fence lines, hedge lines, cadastral-looking edges), if one is discernible. Return STRICT JSON only, with exactly these top-level keys: {"features":[{"kind":one of tree|building|water_tank|pond|veg_area|driveway,"points":[[x,y],...] normalised 0..1 (single point for tree/tank/pond/building-centre; 3+ ring for veg_area and large building footprints; 2+ polyline along a driveway),"sizeM":estimated diameter/width in metres for point features,"note":"5-word description"}],"boundary":[[x,y],...] normalised 0..1 ring of 3+ points tracing the property/plot boundary, or null if none is discernible,"metresAcross":your independent estimate of the real-world width in metres of the ENTIRE image (left edge to right edge), or null if you cannot estimate it}. Max 15 features, most confident first. Only clearly visible features — no speculation.`;

  const msg = await claudeClient.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: prompt,
          },
        ],
      },
    ],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '';

  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    console.error('design-detect (claude): no JSON block found. Raw:', raw);
    throw new Error('Could not read the image — try again.');
  }

  let parsed: { features?: unknown[]; boundary?: unknown; metresAcross?: unknown };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    console.error('design-detect (claude): JSON parse failed. Raw:', raw);
    throw new Error('Could not read the image — try again.');
  }

  const rawFeatures = Array.isArray(parsed.features) ? parsed.features : [];

  const features: DetectedFeature[] = [];
  for (const item of rawFeatures) {
    if (features.length >= 15) break;
    if (!item || typeof item !== 'object') continue;
    const f = item as Record<string, unknown>;

    if (typeof f.kind !== 'string' || !VALID_KINDS.includes(f.kind as DetectKind)) continue;
    if (!Array.isArray(f.points) || f.points.length === 0) continue;

    const points: Array<[number, number]> = [];
    for (const p of f.points) {
      if (!Array.isArray(p) || p.length !== 2) continue;
      const x = clamp01(Number(p[0]));
      const y = clamp01(Number(p[1]));
      points.push([x, y]);
    }
    if (points.length === 0) continue;

    const feature: DetectedFeature = {
      kind: f.kind as DetectKind,
      points,
    };
    if (typeof f.sizeM === 'number' && Number.isFinite(f.sizeM)) {
      feature.sizeM = f.sizeM;
    }
    if (typeof f.note === 'string') {
      feature.note = f.note;
    }
    features.push(feature);
  }

  let boundary: Array<[number, number]> | undefined;
  if (Array.isArray(parsed.boundary)) {
    const ring: Array<[number, number]> = [];
    for (const p of parsed.boundary) {
      if (!Array.isArray(p) || p.length !== 2) continue;
      const x = clamp01(Number(p[0]));
      const y = clamp01(Number(p[1]));
      ring.push([x, y]);
    }
    if (ring.length >= 3) {
      boundary = ring;
    }
  }

  let metresAcross: number | undefined;
  if (typeof parsed.metresAcross === 'number' && Number.isFinite(parsed.metresAcross)) {
    const m = parsed.metresAcross;
    if (m >= 5 && m <= 5000) {
      metresAcross = m;
    }
  }

  return { features, boundary, metresAcross };
}

export async function POST(req: NextRequest) {
  let body: DetectBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { imageBase64 } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const falKey = process.env.FAL_KEY;

  if (falKey) {
    try {
      const result = await detectWithFal(falKey, body);
      console.log(`design-detect: fal ok — ${result.features.length} features, metresAcross=${result.metresAcross ?? 'n/a'}`);
      return NextResponse.json({ ...result, engine: 'florence' });
    } catch (err) {
      console.error('design-detect: fal.ai path failed, falling back to Claude:', err);
      // fall through to Claude below
    }
  }

  try {
    const result = await detectWithClaude(body);
    console.log(`design-detect: claude fallback — ${result.features.length} features`);
    return NextResponse.json({ ...result, engine: 'claude' });
  } catch (err) {
    console.error('design-detect error:', err);
    const message = err instanceof Error ? err.message : 'Auto-detect failed — please try again.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

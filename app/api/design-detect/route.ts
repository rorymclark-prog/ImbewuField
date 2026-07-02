import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export const maxDuration = 60;

type DetectKind = 'tree' | 'building' | 'water_tank' | 'pond' | 'veg_area' | 'driveway';
const VALID_KINDS: DetectKind[] = ['tree', 'building', 'water_tank', 'pond', 'veg_area', 'driveway'];

interface DetectedFeature {
  kind: DetectKind;
  points: Array<[number, number]>;
  sizeM?: number;
  note?: string;
}

function clamp01(n: number): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

export async function POST(req: NextRequest) {
  let body: { imageBase64: string; imgW: number; imgH: number; mPerPx: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { imageBase64, imgW, imgH, mPerPx } = body;

  if (!imageBase64) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const prompt = `You are analysing a top-down satellite photo of a South African smallholding for a permaculture design app. The image is ${imgW}x${imgH} px at ${mPerPx} metres/px. Identify visible features and return STRICT JSON only: {"features":[{"kind":one of tree|building|water_tank|pond|veg_area|driveway,"points":[[x,y],...] normalised 0..1 (single point for tree/tank/pond/building-centre; 3+ ring for veg_area and large building footprints; 2+ polyline along a driveway),"sizeM":estimated diameter/width in metres for point features,"note":"5-word description"}]}. Max 15 features, most confident first. Only clearly visible features — no speculation.`;

  try {
    const msg = await client.messages.create({
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
      console.error('design-detect: no JSON block found. Raw:', raw);
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
    }

    let parsed: { features?: unknown[] };
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      console.error('design-detect: JSON parse failed. Raw:', raw);
      return NextResponse.json({ error: 'Could not read the image — try again.' }, { status: 502 });
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

    return NextResponse.json({ features });
  } catch (err) {
    console.error('design-detect error:', err);
    return NextResponse.json({ error: 'Auto-detect failed — please try again.' }, { status: 502 });
  }
}

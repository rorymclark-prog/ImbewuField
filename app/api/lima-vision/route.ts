import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { image, mode }: {
    image: { data: string; mediaType: string };
    mode: 'crop' | 'weigh';
  } = await req.json();

  if (!image?.data) {
    return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  }

  const cropPrompt = `You are Lima, a warm and practical permaculture field assistant based in South Africa. A farmer has taken a photo of a planted bed and wants to know what is growing and when they can expect a harvest.

Look carefully at the photo and respond with ONLY a valid JSON object — no markdown fences, no explanation, just the JSON. Use this exact shape:
{"crop": string, "confidence": "high"|"medium"|"low", "estimatedKg": number, "weeksToHarvest": number, "note": string}

- crop: the most likely crop or plant name visible
- confidence: your confidence in the identification — use "low" honestly if the photo is unclear, the bed is very young, or you cannot make a good estimate
- estimatedKg: rough yield estimate in kilograms for what looks like is there or will be harvested from this bed (your best field guess — a range's midpoint is fine)
- weeksToHarvest: approximate weeks until the first meaningful harvest based on the growth stage visible
- note: one short, warm, plain-language sentence — like something you would say to the farmer face-to-face (for example: "Looks like healthy spinach — about 3 weeks from a good first pick.")

These are rough field estimates for guidance only, not guarantees. Be honest about low confidence when the image is dark, blurry, or the plants are very small.`;

  const weighPrompt = `You are Lima, a warm and practical permaculture field assistant based in South Africa. A farmer has taken a photo of harvested produce and wants a rough weight estimate.

Look carefully at the photo. If there is a known-size reference object visible (a hand, a bottle, a bucket, a ruler, a standard container), use it to help calibrate your estimate.

Respond with ONLY a valid JSON object — no markdown fences, no explanation, just the JSON. Use this exact shape:
{"estimatedKg": number, "confidence": "high"|"medium"|"low", "note": string}

- estimatedKg: your best estimate of the total weight of the harvested produce in kilograms
- confidence: your confidence — "high" if a clear reference object is visible and the pile is well-lit, "medium" if you can make a reasonable guess, "low" if the image is unclear or no reference is visible
- note: one short, warm, plain-language sentence — mention if a reference object helped your estimate, or gently suggest placing one next to the produce next time if nothing was visible (for example: "A 2 L bottle next to the pile next time will sharpen the estimate — but this looks like about 1.5 kg.")

These are rough field estimates for guidance only.`;

  const prompt = mode === 'crop' ? cropPrompt : weighPrompt;

  const content: Anthropic.MessageParam['content'] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: image.mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: image.data,
      },
    },
    {
      type: 'text',
      text: prompt,
    },
  ];

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content }],
  });

  const textBlock = msg.content.find((b) => b.type === 'text');
  const raw = textBlock?.type === 'text' ? textBlock.text : '';

  // Strip markdown code fences if present
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    return NextResponse.json({ ok: true, ...parsed });
  } catch {
    console.error('Lima vision JSON parse failed. Raw:', raw);
    return NextResponse.json({
      ok: false,
      error: 'Could not read the photo — try a clearer, well-lit shot.',
    });
  }
}

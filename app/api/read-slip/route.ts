import { NextRequest, NextResponse } from 'next/server';
import { lowCostText } from '@/lib/low-cost-ai';
import { guardPaidApiRequest } from '@/lib/api-auth';

// Lima reads a photographed till slip / receipt and pulls out the total, a short
// description and the supplier, so the farmer can log a cost without typing.
export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/read-slip');
  if (auth.response) return auth.response;
  const { image }: { image?: { data: string; mediaType: string } } = await req.json();
  if (!image?.data || !['image/jpeg','image/png','image/webp'].includes(image.mediaType)) return NextResponse.json({ error: 'No image provided' }, { status: 400 });

  const prompt = `You are Lima, a farm bookkeeping assistant in South Africa. This is a photo of a till slip / receipt for farm inputs (seeds, compost, tools, fuel, etc.).

Read it and respond with ONLY a JSON object — no markdown, no code fences:
{
  "amount": <the TOTAL paid, as a plain number in South African Rand, e.g. 340>,
  "item": "<a short description of what was bought, e.g. 'Spinach seedlings & compost'>",
  "supplier": "<the shop/supplier name if visible, else empty string>",
  "confidence": "high" | "medium" | "low",
  "note": "<one short, warm, plain sentence confirming what you read, e.g. 'I read R340 from Agri Co-op — looks like inputs for spinach.'>"
}

Rules: "amount" must be the grand total (look for TOTAL), as a number only (no 'R', no spaces). If you genuinely cannot read the total, set amount to 0 and confidence to "low". Keep "item" under 6 words.`;

  try {
    const raw = await lowCostText('/api/read-slip', prompt, 400, image);
    const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned) as {
      amount: number; item: string; supplier: string; confidence: string; note: string;
    };
    if (!Number.isFinite(parsed.amount) || parsed.amount < 0 || typeof parsed.item !== 'string' || typeof parsed.supplier !== 'string' || typeof parsed.note !== 'string' || !['high','medium','low'].includes(parsed.confidence)) throw Error('Invalid receipt fields');
    return NextResponse.json({ ok: true, ...parsed });
  } catch {
    return NextResponse.json({ ok: false, error: 'Could not read the slip — try a clearer, flat, well-lit photo.' });
  }
}

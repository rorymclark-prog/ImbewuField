import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { reverseGeocode } from '@/lib/reverse-geocode';

export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

function buildPrompt(lat: number, lon: number, admin: { municipality: string | null; district: string | null; province: string | null; label: string | null } | null): string {
  const loc = admin
    ? `LOCATION (use these REAL administrative names — do not invent):
- Local municipality: ${admin.municipality ?? '(metro / not separately named)'}
- District municipality: ${admin.district ?? '(n/a)'}
- Province: ${admin.province ?? '(unknown)'}
- Coordinates: ${Math.abs(lat).toFixed(4)}°S, ${lon.toFixed(4)}°E`
    : `LOCATION: Coordinates ${Math.abs(lat).toFixed(4)}°S, ${lon.toFixed(4)}°E (identify the local & district municipality and province from these).`;

  return `You are a South African rural-development analyst. Give a concise, realistic community profile for a small-scale farmer deciding what to grow and how to sell.

${loc}

Write SHORT, practical sections with this EXACT markdown structure — 2–4 plain-language bullets each:

## 📍 Where this is
The local municipality, district and province, plus the nearest main town and rough distance.

## 👥 Population
Rough total population of the local municipality (a number or range) and whether it is mostly rural, peri-urban or urban.

## 🛠 Infrastructure & services
The real state of water, electricity, sanitation and roads here — what's reliable, what's a gap. Be honest about typical service-delivery issues if relevant.

## 📶 Connectivity
Mobile network and internet coverage to expect (which networks, 3G/4G/fibre) and how it affects a farmer (mobile money, checking market prices, ordering inputs).

## ⚠ Social challenges
The main challenges here — unemployment, poverty, water security, youth, etc. Factual and brief.

## 💰 Economic opportunities
What the area produces well, the nearest markets/buyers, and 2–3 specific MARKET GAPS a small farmer could fill (produce in demand locally but trucked in from far).

Base everything on real knowledge of this municipality. If unsure of an exact figure, give a sensible range and say "approx". Do NOT add any preamble or closing — start directly with the first "## " heading.`;
}

export async function POST(req: NextRequest) {
  const { lat, lon } = await req.json();
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    return new Response('Invalid coordinates', { status: 400 });
  }

  const admin = await reverseGeocode(lat, lon);
  const prompt = buildPrompt(lat, lon, admin);

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1400,
    messages: [{ role: 'user', content: prompt }],
  });

  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(new TextEncoder().encode(chunk.delta.text));
          }
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

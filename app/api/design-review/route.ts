import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

export async function POST(req: NextRequest) {
  const { layoutText, siteText, language }: {
    layoutText: string;
    siteText?: string;
    language?: string;
  } = await req.json();

  if (!layoutText?.trim()) return NextResponse.json({ error: 'No layout provided' }, { status: 400 });

  const langLine = language && language !== 'en'
    ? `\n\nWrite your review in natural, everyday ${language} (keep element names simple).`
    : '';

  const prompt = `You are an expert permaculture designer reviewing a garden/farm layout a facilitator has drawn on a 2D plan. NORTH is up (top of the plan). Positions are given in metres from the top-left corner, so a SMALLER y means further north.

${siteText ? `SITE: ${siteText}\n` : ''}LAYOUT THE USER DREW:
${layoutText}

Give a short, practical review for a small-scale South African site. Use these exact sections:

## ✅ What works
1–3 good things about this layout.

## ⚠ Changes I'd make
The 3–5 most important fixes, each specific to what they drew and WHY — think water (gravity-feed tanks from the high/north side), sun (north-facing, don't shade beds with trees on the north), wind, access, and spacing. Reference actual elements and their positions.

## 💧 Water & piping
A note on whether the tank/pond placement and piping make sense, and the rough pipe run needed.

## 👣 Next 3 steps
The first three things to peg out or move on the ground.

Be direct and concrete. This is a real plan a facilitator will act on.${langLine}`;

  const stream = await client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1600,
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
      } catch (err) {
        controller.enqueue(new TextEncoder().encode(`\n\n⚠ Review error: ${err instanceof Error ? err.message : String(err)}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
  });
}

import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

interface TreeIdResult {
  species: string;
  scientificName: string;
  confidence: number;
  type: 'indigenous' | 'exotic' | 'fruit' | 'unknown';
  fruiting: string;
  heightM: string;
  estAge: string;
  estYield: 'Low' | 'Medium' | 'High' | 'Unknown';
  protected: boolean;
  invasive: boolean;
  limaNote: string;
  needsBaseShot: boolean;
}

const SYSTEM_PROMPT = `You are Lima, an AI permaculture assistant trained on South African indigenous plants and fruit trees.
When given a tree photo, analyse it and return a structured JSON object (no markdown, raw JSON only).
Be specific to South African species. If unsure, return your best guess with a low confidence score.`;

const USER_PROMPT = `Identify the tree in this photo and return ONLY a JSON object with these fields:
- species: common name (string)
- scientificName: Latin name (string, or "" if unknown)
- confidence: 0–100 integer
- type: one of "indigenous" | "exotic" | "fruit" | "unknown"
- fruiting: fruiting months or "N/A" (string)
- heightM: estimated mature height e.g. "~8 m" (string)
- estAge: estimated age from trunk/bark e.g. "~12 yrs" or "Unknown" (string)
- estYield: one of "Low" | "Medium" | "High" | "Unknown"
- protected: true if legally protected in South Africa (Marula, Wild Fig, etc.)
- invasive: true if this is an invasive alien species
- limaNote: 1–2 sentence Lima coaching note about this tree for the farmer (string)
- needsBaseShot: true if you'd like a base & trunk photo for more info`;

export async function POST(req: NextRequest) {
  const { imageBase64, mediaType } = await req.json();
  if (!imageBase64) return new Response('Missing imageBase64', { status: 400 });

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType ?? 'image/jpeg',
              data: imageBase64,
            },
          },
          { type: 'text', text: USER_PROMPT },
        ],
      },
    ],
  });

  const text = msg.content.find((b) => b.type === 'text')?.text ?? '';
  try {
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const result: TreeIdResult = JSON.parse(text.slice(jsonStart, jsonEnd));
    return Response.json(result);
  } catch {
    return new Response('Failed to parse tree ID response', { status: 500 });
  }
}

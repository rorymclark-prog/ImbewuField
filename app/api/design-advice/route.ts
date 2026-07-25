import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// Advice calls are small and frequent (fired on most canvas edits) — allow up to 30s
// but keep them cheap: claude-haiku-4-5, short system prompt, short max_tokens.
export const maxDuration = 30;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are a permaculture design mentor for South African smallholder farmers. Southern Hemisphere: the north side gets the most sun; shadows fall south. Given the farmer's current design layout summary and site data, return the 3 most valuable, specific, actionable suggestions. "groundFeatures" is EXISTING site fabric the farmer already traced (house, patio, driveway, lawn, orchard, veg garden, cleared ground) — context to design around, never something to critique or redesign. "currentStep" is which part of the design the farmer is actively working on right now — weight suggestions toward that step when it's useful, but don't ignore the rest of the design. You may suggest what to place and roughly where; you never place anything yourself. Keep each suggestion under 25 words. Return STRICT JSON: {"suggestions":["...","...","..."]}`;

interface DesignAdviceRequest {
  designSummary: unknown;
  site?: unknown;
}

interface DesignAdviceAI {
  suggestions: string[];
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const b = body as Partial<DesignAdviceRequest>;
  if (!b || typeof b.designSummary === 'undefined') {
    return NextResponse.json({ error: 'designSummary is required' }, { status: 400 });
  }

  const userMessage = JSON.stringify({ designSummary: b.designSummary, site: b.site ?? null });

  let raw: string;
  try {
    const msg = await client.messages.create({
      // Small, frequent, cost-conscious calls — Haiku is plenty for short layout tips.
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const block = msg.content.find((c) => c.type === 'text');
    raw = block && block.type === 'text' ? block.text.trim() : '';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Claude API error: ${msg}` }, { status: 502 });
  }

  // Parse defensively — extract the first {...} block in case Claude wraps it in prose/fences.
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return NextResponse.json({ error: 'Failed to parse advice from AI response', raw }, { status: 502 });
  }

  let parsed: DesignAdviceAI;
  try {
    parsed = JSON.parse(match[0]) as DesignAdviceAI;
  } catch {
    return NextResponse.json({ error: 'Failed to parse advice from AI response', raw }, { status: 502 });
  }

  if (!Array.isArray(parsed.suggestions)) {
    return NextResponse.json({ error: 'AI response missing suggestions array', raw }, { status: 502 });
  }

  const suggestions = parsed.suggestions.filter((s): s is string => typeof s === 'string').slice(0, 3);

  return NextResponse.json({ suggestions });
}

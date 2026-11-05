import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { guardPaidApiRequest } from '@/lib/api-auth';
import { AI_MODELS, meteredAi } from '@/lib/metered-ai';
import { resolveDesignAdvicePolicy } from '@/lib/design-advice-policy';

// Explicit advice requests remain small: the saved summary needs no image pass.
export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a permaculture design mentor using the app's existing South African references. This is grower-confirmed reference context, not independently verified geography or local agronomy approval. Southern Hemisphere: the north side gets the most sun; shadows fall south. Given the saved design layout summary, return the 3 most valuable, specific, actionable suggestions. Do not invent missing environmental facts, species, spacings, yields, rainfall or timings. "groundFeatures" is EXISTING site fabric the farmer already traced (house, patio, driveway, lawn, orchard, veg garden, cleared ground) — context to design around, never something to critique or redesign. "currentStep" is which part of the design the farmer is actively working on right now — weight suggestions toward that step when it's useful, but don't ignore the rest of the design. You may suggest roughly where to put existing design elements; you never place anything yourself. Keep each suggestion under 25 words. Return STRICT JSON: {"suggestions":["...","...","..."]}`;

interface DesignAdviceAI {
  suggestions: string[];
}

export async function POST(req: NextRequest) {
  const auth = await guardPaidApiRequest(req, '/api/design-advice');
  if (auth.response) return auth.response;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const decision = await resolveDesignAdvicePolicy(req, auth, body);
  if (!decision.allowed) return NextResponse.json({ code: decision.code, error: decision.error },
    { status: decision.status, headers: { 'Cache-Control': 'no-store' } });
  const contextChanged = () => NextResponse.json({ code: 'ADVICE_CONTEXT_CHANGED',
    error: 'The design or its country details changed or could not be checked. Ask again after the intended site saves. Completed AI work may already have used allowance.' },
    { status: 409, headers: { 'Cache-Control': 'no-store' } });
  const stillCurrent = async () => {
    if (req.signal.aborted) return false;
    const fresh = await resolveDesignAdvicePolicy(req, auth, body);
    return !req.signal.aborted && fresh.allowed && fresh.fingerprint === decision.fingerprint;
  };
  // Country/source reads and hashing may await account updates. Check again
  // before allowance setup, before the provider, and before releasing its text.
  if (!await stillCurrent()) return contextChanged();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const metered = await meteredAi(req, auth, '/api/design-advice', client);
  if (metered.response) return metered.response;
  if (!await stillCurrent()) return contextChanged();
  const { ai } = metered;
  const userMessage = JSON.stringify({ designSummary: decision.summary, referenceMode: decision.mode });

  let raw: string;
  try {
    const msg = await ai.messages.create({
      // Small, frequent, cost-conscious calls — Haiku is plenty for short layout tips.
      model: AI_MODELS.cheap,
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

  if (!await stillCurrent()) return contextChanged();

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

  return NextResponse.json({ suggestions, mode: decision.mode, siteId: decision.siteId,
    sourceFingerprint: decision.sourceFingerprint, countryFingerprint: decision.countryFingerprint,
    currentStep: decision.summary.currentStep }, { headers: { 'Cache-Control': 'no-store' } });
}

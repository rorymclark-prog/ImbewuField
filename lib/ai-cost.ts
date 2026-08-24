// What a single AI call actually costs, and a structured line in the logs saying so.
//
// This exists because the per-farmer cost of running ImbewuField was an ESTIMATE, and the estimate
// was wrong. The figure in circulation — ~R139k/yr at 3,000 farmers — was gpt-image render spend,
// which is a real number for a feature that is being parked. Nobody had ever measured what the
// text side costs, and the text side is where the duplication is: app/api/generate-report/route.ts
// sends the same system prompt and the same seven images once per batch, up to eleven times for one
// comprehensive report, and its own comment says so.
//
// A price you cannot defend in a room is not a price. So: log the usage the API already returns,
// price it, and let the real number replace the guess.

/** USD per million tokens. Keep in step with the model IDs actually used by app/api/**. */
const RATES: Record<string, { input: number; output: number }> = {
  'claude-opus-4-8': { input: 5, output: 25 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/**
 * Prompt-cache multipliers, applied to the model's INPUT rate.
 *
 * A cache write costs MORE than an uncached send, which is the whole reason naive caching can lose
 * money: N requests that fire concurrently all miss, all write, and the bill goes UP by 25% rather
 * than down. Caching only pays when something has already written the entry — i.e. when one call is
 * allowed to land before the rest follow.
 */
export const CACHE_WRITE_MULTIPLIER = 1.25;
export const CACHE_READ_MULTIPLIER = 0.1;

/** The shape the Anthropic SDK returns on `msg.usage`; cache fields are absent unless used. */
export interface AiUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export interface AiCost {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
  /** Billable input tokens with cache multipliers applied — the number that costs money. */
  effectiveInputTokens: number;
  usd: number;
}

const n = (v: number | null | undefined): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

export function costOf(model: string, usage: AiUsage | null | undefined): AiCost {
  const rate = RATES[model];
  const inputTokens = n(usage?.input_tokens);
  const outputTokens = n(usage?.output_tokens);
  const cacheWriteTokens = n(usage?.cache_creation_input_tokens);
  const cacheReadTokens = n(usage?.cache_read_input_tokens);

  // input_tokens already EXCLUDES cached tokens; the cache counters are reported separately.
  const effectiveInputTokens =
    inputTokens
    + cacheWriteTokens * CACHE_WRITE_MULTIPLIER
    + cacheReadTokens * CACHE_READ_MULTIPLIER;

  // An unknown model must not silently price at zero and read as "this call was free".
  const usd = rate
    ? (effectiveInputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output
    : Number.NaN;

  return { model, inputTokens, outputTokens, cacheWriteTokens, cacheReadTokens, effectiveInputTokens, usd };
}

/** Sum a set of calls — one report is many calls, and the report is the unit that gets priced. */
export function totalCost(costs: AiCost[]): Omit<AiCost, 'model'> & { calls: number } {
  return {
    calls: costs.length,
    inputTokens: costs.reduce((t, c) => t + c.inputTokens, 0),
    outputTokens: costs.reduce((t, c) => t + c.outputTokens, 0),
    cacheWriteTokens: costs.reduce((t, c) => t + c.cacheWriteTokens, 0),
    cacheReadTokens: costs.reduce((t, c) => t + c.cacheReadTokens, 0),
    effectiveInputTokens: costs.reduce((t, c) => t + c.effectiveInputTokens, 0),
    usd: costs.reduce((t, c) => t + (Number.isNaN(c.usd) ? 0 : c.usd), 0),
  };
}

/**
 * One machine-greppable line per call. `[ai-cost]` is the prefix to filter Vercel logs on.
 * Deliberately console.log and not a metrics service: the point is to get a real number this week.
 */
export function logAiUsage(routeName: string, model: string, usage: AiUsage | null | undefined, note?: string): AiCost {
  const c = costOf(model, usage);
  console.log(
    `[ai-cost] ${JSON.stringify({
      route: routeName,
      model,
      in: c.inputTokens,
      out: c.outputTokens,
      cacheWrite: c.cacheWriteTokens,
      cacheRead: c.cacheReadTokens,
      usd: Number.isNaN(c.usd) ? 'UNPRICED_MODEL' : Number(c.usd.toFixed(5)),
      ...(note ? { note } : {}),
    })}`,
  );
  return c;
}

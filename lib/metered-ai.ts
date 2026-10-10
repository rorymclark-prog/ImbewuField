// The one door every Claude call in app/api/** goes through.
//
// It does three things the routes used to do (or not do) on their own:
//   1. picks the model — the route's choice while the person has allowance left, the cheap model
//      once it is spent (lib/ai-budget.ts);
//   2. adjusts the request for that model (the newer models think by default and count ~30% more
//      tokens for the same text; the cheap model does not take the newer thinking settings);
//   3. prices the real usage, logs it as an [ai-cost] line and adds it to the person's ledger.

import type Anthropic from '@anthropic-ai/sdk';
import type { MessageStream } from '@anthropic-ai/sdk/lib/MessageStream';
import { logAiUsage } from './ai-cost';
import { CHEAP_MODEL, guestAllowanceSpentResponse, loadAiBudget, type AiBudget, type AiSpendStore } from './ai-budget';
import { clientIp } from './api-rate-limit';

/**
 * Model choices, by job. Chosen from Rory's value-for-money research (Sep 2026): the current Sonnet
 * is cheaper per token than the one it replaces, and the current Opus costs the same as the old one.
 */
export const AI_MODELS = {
  /** Chat and photo reading — the everyday writer. */
  main: 'claude-sonnet-5',
  /** Site reports and design reviews use Rory's chosen Sonnet upgrade. */
  report: 'claude-sonnet-5-5',
  /** Whole-farm spatial judgement, where the hardest reasoning pays for itself. */
  deep: 'claude-opus-5',
  /** Short, cheap jobs — and every call once an allowance is spent. */
  cheap: CHEAP_MODEL,
} as const;

/** Models on the newer tokenizer, which counts about 30% more tokens for the same text. */
const NEW_TOKENIZER = new Set<string>([AI_MODELS.main, AI_MODELS.report, AI_MODELS.deep]);

type Shapeable = { model: string; max_tokens: number; thinking?: Anthropic.ThinkingConfigParam };

/** Fit a request written for one model to the model it will actually run on. */
export function shapeParams<P extends Shapeable>(params: P, model: string): P {
  const out: P = { ...params, model };
  if (NEW_TOKENIZER.has(model)) {
    // Same answer, more tokens: keep the ceiling where the old model had it in words.
    out.max_tokens = Math.ceil(params.max_tokens * 1.3);
    // These models think unless told not to. The routes were written for no thinking; keep it
    // that way so cost and output length stay what the routes were tuned for.
    if (model === AI_MODELS.report && (!params.thinking || params.thinking.type === 'disabled')) {
      // Sonnet 5.5 rejects "disabled". The installed SDK predates its equivalent wire setting.
      // https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5
      out.thinking = { type: 'between_tools' } as unknown as Anthropic.ThinkingConfigParam;
    } else if (!params.thinking) out.thinking = { type: 'disabled' };
  }
  if (model === CHEAP_MODEL) delete out.thinking;
  return out;
}

export interface MeteredAi {
  budget: AiBudget;
  /** The model a call asking for `preferred` will really use — for provenance labels. */
  model(preferred: string): string;
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming, options?: Anthropic.RequestOptions): Promise<Anthropic.Message>;
    stream(params: Anthropic.MessageStreamParams, options?: Anthropic.RequestOptions): MessageStream;
  };
}

export function meter(client: Anthropic, budget: AiBudget, route: string): MeteredAi {
  const settle = async (model: string, usage: Anthropic.Usage | undefined, note?: string) => {
    logAiUsage(route, model, usage, note);
    await budget.record(model, usage);
  };
  const noteFor = (preferred: string, model: string) => (model !== preferred ? 'allowance spent: cheap model' : undefined);
  return {
    budget,
    model: (preferred) => budget.model(preferred),
    messages: {
      async create(params, options) {
        const model = budget.model(params.model);
        const msg = await client.messages.create(shapeParams(params, model), options);
        await settle(model, msg.usage, noteFor(params.model, model));
        return msg;
      },
      stream(params, options) {
        const model = budget.model(params.model);
        const stream = client.messages.stream(shapeParams(params, model), options);
        const settled = stream.finalMessage()
          .then((final) => settle(model, final.usage, noteFor(params.model, model)))
          .catch(() => { /* a failed stream has no usage to record; the route reports the error */ });
        // Keep the function alive until the spend is written: the route's reader loop only ends
        // once this iterator does, and a serverless function may be frozen the moment it returns.
        const iterate = stream[Symbol.asyncIterator].bind(stream);
        stream[Symbol.asyncIterator] = async function* () {
          for await (const event of { [Symbol.asyncIterator]: iterate }) yield event;
          await settled;
        } as unknown as typeof stream[typeof Symbol.asyncIterator];
        return stream;
      },
    },
  };
}

/**
 * Load the caller's allowance and hand back a metered client — or, for a guest whose daily pool is
 * empty, the sign-in reply to send instead.
 */
export async function meteredAi(
  req: Request,
  auth: { uid: string | null },
  route: string,
  client: Anthropic,
  opts: { store?: AiSpendStore; now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<{ ai: MeteredAi; response?: undefined } | { ai?: undefined; response: Response }> {
  const who = auth.uid ? { kind: 'user' as const, uid: auth.uid } : { kind: 'guest' as const, ip: clientIp(req) };
  const budget = await loadAiBudget(who, route, opts);
  if (who.kind === 'guest' && budget.allowance.capped) return { response: guestAllowanceSpentResponse(budget.allowance) };
  return { ai: meter(client, budget, route) };
}

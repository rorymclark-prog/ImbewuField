import Anthropic from '@anthropic-ai/sdk';
import { logAiUsage, type AiUsage } from './ai-cost';
import { guestAllowanceSpentResponse, loadAiBudget, type AiSpendStore, type Spender } from './ai-budget';
import { clientIp } from './api-rate-limit';

interface LowCostResult { text: string; model: string; usage: AiUsage }

/** The provider call itself — no budget check, no usage logging. Callers price and record it. */
async function callLowCostProvider(prompt: string, maxTokens: number, image?: {data:string;mediaType:string}): Promise<LowCostResult> {
  const provider = process.env.LOW_COST_AI_PROVIDER ?? (process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic');
  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw Error('Low-cost AI is not configured.');
    const model = 'gemini-2.5-flash-lite';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method:'POST', headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY}, signal:AbortSignal.timeout(25000),
      body:JSON.stringify({contents:[{role:'user',parts:[...(image?[{inlineData:{mimeType:image.mediaType,data:image.data}}]:[]),{text:prompt}]}],generationConfig:{maxOutputTokens:maxTokens,temperature:0}}),
    });
    if (!response.ok) throw Error('Low-cost AI could not complete this request.');
    const result = await response.json();
    const candidate=result.candidates?.[0];
    if(candidate?.finishReason!=='STOP') throw Error('The response was incomplete.');
    const text = (candidate.content?.parts??[]).map((p:{text?:string})=>p.text??'').join('');
    return { text, model, usage: { input_tokens: result.usageMetadata?.promptTokenCount, output_tokens: result.usageMetadata?.candidatesTokenCount } };
  }
  if (provider !== 'anthropic' || !process.env.ANTHROPIC_API_KEY) throw Error('Low-cost AI is not configured.');
  const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:25000,maxRetries:0});
  const model='claude-haiku-4-5';
  const content:Anthropic.MessageParam['content']=[...(image?[{type:'image' as const,source:{type:'base64' as const,media_type:image.mediaType as 'image/jpeg'|'image/png',data:image.data}}]:[]),{type:'text',text:prompt}];
  const result=await client.messages.create({model,max_tokens:maxTokens,messages:[{role:'user',content}]});
  if(result.stop_reason!=='end_turn') throw Error('The response was incomplete.');
  const text = result.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  return { text, model, usage: result.usage };
}

/** Extraction and copy cleanup never need the report-writing model or an automatic costly retry. */
export async function lowCostText(route: string, prompt: string, maxTokens: number, image?: {data:string;mediaType:string}): Promise<string> {
  const result = await callLowCostProvider(prompt, maxTokens, image);
  logAiUsage(route, result.model, result.usage);
  return result.text;
}

export interface LowCostAi {
  text(prompt: string, maxTokens: number, image?: {data:string;mediaType:string}): Promise<string>;
}

/**
 * Load the caller's R18/R1 allowance and hand back a metered lowCostText — or, for a guest whose
 * daily pool is empty, the sign-in reply to send instead. Mirrors lib/metered-ai.ts's meteredAi:
 * lowCostText calls are already on the cheapest model available, so there is nothing cheaper to
 * fall back to, but the spend still needs to count against the same ledger and guests still need
 * to be turned away once their pool is spent (sec-04).
 */
export async function meteredLowCostAi(
  req: Request,
  auth: { uid: string | null },
  route: string,
  opts: { store?: AiSpendStore; now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<{ ai: LowCostAi; response?: undefined } | { ai?: undefined; response: Response }> {
  const who: Spender = auth.uid ? { kind: 'user', uid: auth.uid } : { kind: 'guest', ip: clientIp(req) };
  const budget = await loadAiBudget(who, route, opts);
  if (who.kind === 'guest' && budget.allowance.capped) return { response: guestAllowanceSpentResponse(budget.allowance) };
  return {
    ai: {
      async text(prompt, maxTokens, image) {
        const result = await callLowCostProvider(prompt, maxTokens, image);
        logAiUsage(route, result.model, result.usage);
        await budget.record(result.model, result.usage);
        return result.text;
      },
    },
  };
}

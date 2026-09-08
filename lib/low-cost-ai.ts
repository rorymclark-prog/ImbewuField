import Anthropic from '@anthropic-ai/sdk';
import { logAiUsage } from './ai-cost';
/** Extraction and copy cleanup never need the report-writing model or an automatic costly retry. */
export async function lowCostText(route: string, prompt: string, maxTokens: number, image?: {data:string;mediaType:string}): Promise<string> {
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
    logAiUsage(route,model,{input_tokens:result.usageMetadata?.promptTokenCount,output_tokens:result.usageMetadata?.candidatesTokenCount});
    const candidate=result.candidates?.[0];
    if(candidate?.finishReason!=='STOP') throw Error('The response was incomplete.');
    return (candidate.content?.parts??[]).map((p:{text?:string})=>p.text??'').join('');
  }
  if (provider !== 'anthropic' || !process.env.ANTHROPIC_API_KEY) throw Error('Low-cost AI is not configured.');
  const client=new Anthropic({apiKey:process.env.ANTHROPIC_API_KEY,timeout:25000,maxRetries:0});
  const model='claude-haiku-4-5';
  const content:Anthropic.MessageParam['content']=[...(image?[{type:'image' as const,source:{type:'base64' as const,media_type:image.mediaType as 'image/jpeg'|'image/png',data:image.data}}]:[]),{type:'text',text:prompt}];
  const result=await client.messages.create({model,max_tokens:maxTokens,messages:[{role:'user',content}]});
  logAiUsage(route,model,result.usage);
  if(result.stop_reason!=='end_turn') throw Error('The response was incomplete.');
  return result.content.filter(b=>b.type==='text').map(b=>b.text).join('');
}

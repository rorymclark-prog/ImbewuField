// One Gemini image edit.
//
// THE MODEL WAS A TEXT MODEL. This asked `gemini-2.5-flash` for `responseModalities: ["IMAGE"]`,
// which that model cannot produce — the call fails, and the failure is indistinguishable from "the
// key is wrong" or "Gemini is down" from the outside. The header above still said "Gemini 1.5
// Flash", so the name had already drifted twice without the call ever being exercised: the app only
// enqueues jobs with engine 'openai', so this branch has never run in production.
//
// It now uses the same image models the app's own Gemini route uses (app/api/ai-render/route.ts),
// which are the ones that actually work against this key. Flash is the default here rather than Pro
// because this is the BACKGROUND worker — batch work where cost matters more than the last few
// percent of fidelity — while the interactive route defaults to pro-preview.
//
// If you change these ids, change them in both places. They are duplicated rather than imported
// because functions/ builds independently of the Next app and cannot reach lib/.
export const GEMINI_IMAGE_MODELS = {
  flash: 'gemini-3.1-flash-image',
  pro: 'gemini-3-pro-image',
  'pro-preview': 'gemini-3-pro-image-preview',
} as const;
export type GeminiImageModel = keyof typeof GEMINI_IMAGE_MODELS;
const DEFAULT_GEMINI_IMAGE_MODEL: GeminiImageModel = 'flash';

const MAX_RETRIES = 3;
const MAX_429_RETRIES = 8;
const ATTEMPT_TIMEOUT_MS = 60000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function geminiEdit(
  key: string,
  imageB64: string,
  prompt: string,
  attempt = 0,
  model: GeminiImageModel = DEFAULT_GEMINI_IMAGE_MODEL,
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  let res: Response;
  try {
    // NO GEMINI-ONLY CLAUSE. This used to prepend "FINAL RULE: DO NOT alter the house footprint,
    // driveway, boundary line or any traced structure. They must remain pixel-identical to the
    // source image." — a rule gpt-image-2 never sees, on a branch that had never run in production.
    //
    // The first real Gemini render is what showed why that is not a free safety net. The composed
    // sheet is [gutter][map][gutter][legend]: the gutters are RESERVED BLANK CREAM PAPER by design,
    // and there is an empty NOTES box. Asked to paint the page while also forbidden to alter it,
    // Gemini did the honest thing and refused — finishReason STOP, with: "it contains several empty
    // white boxes that I am not able to replace with the required elements while still adhering to
    // the 'do not alter' policy." A blank panel it was told to leave alone reads as a placeholder it
    // was told to fill, and the two instructions cannot both be satisfied.
    //
    // gpt-image-2 renders the same composite without complaint precisely because it never received
    // this clause. Geometry is protected by the PROTECT MASK and by the app compositing exact
    // elements back on top afterwards — mechanisms that hold regardless of what any model is asked.
    // An extra sentence on one engine only was never what was keeping the house in place; it was
    // just the one difference between the engine that works and the engine that did not.
    //
    // Same lesson as the responseModalities fix: where a never-run path diverges from the proven
    // one, the proven one wins.
    const strictPrompt = prompt;
    
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_MODELS[model]}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: strictPrompt },
            { inlineData: { mimeType: "image/png", data: imageB64 } }
          ]
        }],
        generationConfig: {
          // MATCHES app/api/ai-render/route.ts EXACTLY, and that is the whole point. This worker's
          // branch has never run in production, so nothing here is known to work; that route's
          // shape has actually returned images against this same key. Where the two differed, the
          // proven one wins — this asked for ["IMAGE"] alone, which may or may not be accepted,
          // and a rejected modality config fails indistinguishably from a bad key. The parser
          // below picks the image part out with .find(), so the extra text part costs nothing.
          responseModalities: ['image', 'text']
        }
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return geminiEdit(key, imageB64, prompt, attempt + 1, model);
    }
    throw new Error(`gemini network/abort: ${String(e)}`);
  }
  clearTimeout(timer);

  if (res.status === 429 && attempt < MAX_429_RETRIES) {
    const ra = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 30_000 + Math.floor(Math.random() * 15_000);
    await sleep(wait);
    return geminiEdit(key, imageB64, prompt, attempt + 1, model);
  }
  if (res.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(2000 * (attempt + 1));
    return geminiEdit(key, imageB64, prompt, attempt + 1, model);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }
  
  const data = await res.json() as any;
  const parts = data?.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
  
  if (!imagePart?.inlineData?.data) {
    // SAY WHY. A 200 with no image is the model declining, or a safety block, or a modality config
    // it did not honour — three very different problems that all look identical as "no image", and
    // this branch has never run in production, so its first real failure is the one that has to be
    // readable. The reason is right there in the response; carry it.
    const reason = data?.candidates?.[0]?.finishReason;
    const said = parts?.filter((p: any) => typeof p?.text === 'string').map((p: any) => p.text).join(' ').trim();
    const blocked = data?.promptFeedback?.blockReason;
    const why = [
      blocked ? `blocked: ${blocked}` : '',
      reason ? `finishReason: ${reason}` : '',
      said ? `model said: ${said.slice(0, 300)}` : '',
    ].filter(Boolean).join(' | ');
    throw new Error(`Gemini returned no image${why ? ` (${why})` : ' (no reason given)'}`);
  }
  return imagePart.inlineData.data;
}

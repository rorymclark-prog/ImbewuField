// One Gemini image edit — using the Gemini 1.5 Flash multimodal endpoint.
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
): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ATTEMPT_TIMEOUT_MS);
  let res: Response;
  try {
    const strictPrompt = "FINAL RULE: DO NOT alter the house footprint, driveway, boundary line or any traced structure. They must remain pixel-identical to the source image.\n\n" + prompt;
    
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${key}`, {
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
          responseModalities: ["IMAGE"]
        }
      }),
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (attempt < MAX_RETRIES) {
      await sleep(1500 * (attempt + 1));
      return geminiEdit(key, imageB64, prompt, attempt + 1);
    }
    throw new Error(`gemini network/abort: ${String(e)}`);
  }
  clearTimeout(timer);

  if (res.status === 429 && attempt < MAX_429_RETRIES) {
    const ra = Number(res.headers.get('retry-after'));
    const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 30_000 + Math.floor(Math.random() * 15_000);
    await sleep(wait);
    return geminiEdit(key, imageB64, prompt, attempt + 1);
  }
  if (res.status >= 500 && attempt < MAX_RETRIES) {
    await sleep(2000 * (attempt + 1));
    return geminiEdit(key, imageB64, prompt, attempt + 1);
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${detail.slice(0, 200)}`);
  }
  
  const data = await res.json() as any;
  const parts = data?.candidates?.[0]?.content?.parts;
  const imagePart = parts?.find((p: any) => p.inlineData && p.inlineData.mimeType.startsWith('image/'));
  
  if (!imagePart?.inlineData?.data) {
    throw new Error('Gemini returned no image');
  }
  return imagePart.inlineData.data;
}

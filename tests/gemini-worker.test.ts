import test from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { geminiEdit, GEMINI_IMAGE_MODELS } from '../functions/src/gemini.ts';

test('geminiEdit sends the correct shape and strict prompt', async (t) => {
  let fetchCall: any;

  // Mock global fetch
  const originalFetch = global.fetch;
  global.fetch = async (url, init) => {
    fetchCall = { url, init };
    return {
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [{
          content: {
            parts: [{
              inlineData: {
                mimeType: "image/png",
                data: "dummyb64"
              }
            }]
          }
        }]
      })
    } as any;
  };

  try {
    const res = await geminiEdit('fake_key', 'image_data', 'user prompt');
    assert.equal(res, 'dummyb64');

    assert.ok(fetchCall, 'fetch was called');
    // The worker asks an IMAGE model for an image. It used to ask gemini-2.5-flash, a text model,
    // for responseModalities:["IMAGE"] — a call that cannot succeed, and whose failure is
    // indistinguishable from a bad key or an outage. This test pinned that mistake in place, so it
    // now pins the opposite: whatever model id is used here must be one of the image models.
    assert.equal(fetchCall.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image:generateContent?key=fake_key');
    assert.ok(
      Object.values(GEMINI_IMAGE_MODELS).some((id) => fetchCall.url.includes(`/models/${id}:`)),
      'the worker must call a Gemini model that can return an image',
    );
    assert.equal(fetchCall.init.method, 'POST');
    
    const body = JSON.parse(fetchCall.init.body);
    
    // Ensure no mask property anywhere
    assert.strictEqual(body.mask, undefined);
    
    // Check parts
    const parts = body.contents[0].parts;
    assert.equal(parts.length, 2);
    
    // Strict prompt verification
    assert.ok(parts[0].text.includes('FINAL RULE: DO NOT alter the house footprint, driveway, boundary line or any traced structure.'), 'strict rule is prepended');
    assert.ok(parts[0].text.includes('user prompt'), 'user prompt is included');
    
    // Image data verification
    assert.equal(parts[1].inlineData.mimeType, 'image/png');
    assert.equal(parts[1].inlineData.data, 'image_data');

    // MODALITIES — pinned to the route that actually works, not to a literal.
    //
    // This assertion used to read `['IMAGE']`, which is just the code restated: it would have gone
    // on passing however wrong the value was. The worker's Gemini branch has never run in
    // production, so nothing about it is known-good; app/api/ai-render/route.ts, by contrast, has
    // returned real images against this key. Where the two disagreed, the proven one wins — and a
    // rejected modality config fails indistinguishably from a bad key, so this must not drift again.
    const routeSrc = readFileSync(new URL('../app/api/ai-render/route.ts', import.meta.url), 'utf8');
    const routeModalities = routeSrc.match(/responseModalities:\s*\[([^\]]+)\]/)?.[1]
      ?.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, ''));
    assert.ok(routeModalities?.length, 'could not read the working route\'s responseModalities');
    assert.deepEqual(
      body.generationConfig.responseModalities,
      routeModalities,
      'the worker must ask for the same modalities as the route that is known to return images',
    );
    assert.ok(body.generationConfig.responseModalities.includes('image'));

  } finally {
    global.fetch = originalFetch;
  }
});

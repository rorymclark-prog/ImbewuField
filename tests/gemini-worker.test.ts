import test, { type TestContext } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { geminiEdit, GEMINI_IMAGE_MODELS, geminiModelForQuality } from '../functions/src/gemini.ts';

test('the high-quality Studio setting uses Gemini Pro rather than the draft model', () => {
  assert.equal(geminiModelForQuality('high'), 'pro-preview');
  assert.equal(geminiModelForQuality('medium'), 'flash');
  assert.equal(geminiModelForQuality('low'), 'flash');
});

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
    
    // THE PROMPT IS THE CALLER'S, VERBATIM — no engine-specific additions.
    //
    // This asserted that a Gemini-only "FINAL RULE: DO NOT alter the house footprint…" was
    // prepended. The first real Gemini render is what proved that rule was not a free safety net:
    // the composed sheet reserves blank cream gutters and an empty NOTES box by design, so a model
    // told to paint the page AND forbidden to alter it refused outright — finishReason STOP, "it
    // contains several empty white boxes that I am not able to replace with the required elements
    // while still adhering to the 'do not alter' policy." gpt-image-2 renders the same composite
    // happily, because it never received the clause.
    //
    // Geometry is held by the protect mask and by the app compositing exact elements back on top,
    // not by a sentence one engine gets and the other does not. Divergence between a never-run path
    // and a proven one is the defect this file keeps producing; pin the absence of it.
    assert.equal(parts[0].text, 'user prompt', 'the caller\'s prompt must reach Gemini unmodified');
    assert.doesNotMatch(parts[0].text, /FINAL RULE|pixel-identical/);
    
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

// Exercise the actual retry requests without a provider call or waiting through backoff. The
// timeout for each fetch remains in place; only the retry delay is shortened in these tests.
function skipRetryDelays(t: TestContext) {
  const originalSetTimeout = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback: (...args: any[]) => void, delay?: number, ...args: any[]) =>
    originalSetTimeout(callback, delay === 60_000 ? delay : 0, ...args));
}

function renderedImageResponse() {
  return Response.json({
    candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'rendered-image' } }] } }],
  });
}

for (const failure of ['network', 429, 503] as const) {
  test(`a ${failure} retry preserves the requested model, sheet aspect and output size`, async (t) => {
    skipRetryDelays(t);
    const requests: Array<{ url: string; body: any }> = [];
    t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
      requests.push({ url: String(url), body: JSON.parse(String(init.body)) });
      if (requests.length === 1) {
        if (failure === 'network') throw new Error('simulated connection reset');
        return new Response('temporary failure', { status: failure, headers: { 'retry-after': '1' } });
      }
      return renderedImageResponse();
    });
    const imageConfig = { aspectRatio: '4:3', imageSize: '2K' };
    assert.equal(await geminiEdit('fake_key', 'source-image', 'draw this saved map', 0, 'pro-preview', imageConfig), 'rendered-image');
    assert.equal(requests.length, 2);
    for (const request of requests) {
      assert.ok(request.url.includes(GEMINI_IMAGE_MODELS['pro-preview']));
      assert.deepEqual(request.body.generationConfig.imageConfig, imageConfig);
      assert.deepEqual(request.body.contents, requests[0].body.contents);
    }
  });
}

test('transient retries keep the unsupported-config fallback after a model explicitly rejects it', async (t) => {
  skipRetryDelays(t);
  const configs: unknown[] = [];
  const statuses = [400, 429, 503, 200];
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    configs.push(JSON.parse(String(init.body)).generationConfig.imageConfig);
    const status = statuses[configs.length - 1];
    return status === 200
      ? renderedImageResponse()
      : new Response(status === 400 ? 'Unsupported imageConfig' : 'temporary failure', {
        status, headers: { 'retry-after': '1' },
      });
  });
  const imageConfig = { aspectRatio: '3:2', imageSize: '1K' };
  assert.equal(await geminiEdit('fake_key', 'source-image', 'draw this saved map', 0, 'flash', imageConfig), 'rendered-image');
  assert.deepEqual(configs, [imageConfig, undefined, undefined, undefined]);
});

test('a 400 unrelated to image configuration does not silently remove the chosen output settings', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    calls += 1;
    return new Response('Invalid source image', { status: 400 });
  });
  await assert.rejects(
    geminiEdit('fake_key', 'source-image', 'draw this saved map', 0, 'flash', { aspectRatio: '3:2', imageSize: '1K' }),
    /Gemini 400: Invalid source image/,
  );
  assert.equal(calls, 1);
});

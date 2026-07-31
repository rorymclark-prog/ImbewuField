import test from 'node:test';
import assert from 'node:assert';
import { geminiEdit } from '../functions/src/gemini.ts';

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
    assert.equal(fetchCall.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=fake_key');
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

    // Modalities verification
    assert.deepEqual(body.generationConfig.responseModalities, ['IMAGE']);

  } finally {
    global.fetch = originalFetch;
  }
});

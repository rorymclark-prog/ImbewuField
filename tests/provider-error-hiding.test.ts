// sec-10: raw upstream provider errors (vendor names, HTTP status numbers, response bodies) used
// to reach the farmer verbatim from app/api/chat/route.ts, app/api/design-detect/route.ts and
// app/api/ai-render/poll/route.ts. Each now logs the real error server-side and returns a short,
// generic message instead.

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';

import { sharedLimiter } from '@/lib/api-rate-limit';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

let originalWarn: typeof console.warn;
let originalError: typeof console.error;
let originalLog: typeof console.log;

before(() => {
  originalWarn = console.warn; console.warn = () => {};
  originalError = console.error; console.error = () => {};
  originalLog = console.log; console.log = () => {};
  sharedLimiter.reset();
});

after(() => {
  console.warn = originalWarn;
  console.error = originalError;
  console.log = originalLog;
  sharedLimiter.reset();
});

function neverLeaksUpstream(message: string) {
  assert.doesNotMatch(message, /[{}]/, `leaked a JSON body: ${message}`);
  assert.doesNotMatch(message, /\b(4|5)\d\d\b/, `leaked an HTTP status: ${message}`);
  assert.doesNotMatch(message, /anthropic|openai|gemini|fal\.ai|queue\.fal|ANTHROPIC_API_KEY/i, `leaked a vendor name: ${message}`);
}

test('design-detect: a configuration failure logs server-side and answers with a short generic message', async () => {
  const previousAnthropic = process.env.ANTHROPIC_API_KEY;
  const previousFal = process.env.FAL_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.FAL_KEY;
  try {
    const { POST } = await import('@/app/api/design-detect/route');
    const errors: unknown[] = [];
    console.error = (...args: unknown[]) => { errors.push(args); };
    const req = new NextRequest('http://localhost/api/design-detect', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.50' },
      body: JSON.stringify({ imageBase64: 'AA==', imgW: 100, imgH: 100, mPerPx: 0.2 }),
    });
    const res = await POST(req);
    assert.equal(res.status, 502);
    const body = await res.json();
    neverLeaksUpstream(body.error);
    assert.ok(errors.length > 0, 'the real failure must still be logged server-side');
  } finally {
    if (previousAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousAnthropic;
    if (previousFal === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = previousFal;
  }
});

test('ai-render/poll: an upstream status failure logs server-side and answers with a short generic message, no vendor name/status/body', async () => {
  const previousFal = process.env.FAL_KEY;
  process.env.FAL_KEY = 'test-placeholder';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = (async () => new Response('{"error":{"code":"invalid_api_key"}}', { status: 401 })) as typeof fetch;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const { POST } = await import('@/app/api/ai-render/poll/route');
    const req = new NextRequest('http://localhost/api/ai-render/poll', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.51' },
      body: JSON.stringify({
        statusUrl: 'https://queue.fal.run/some/status',
        responseUrl: 'https://queue.fal.run/some/result',
      }),
    });
    const res = await POST(req);
    assert.equal(res.status, 502);
    const body = await res.json();
    neverLeaksUpstream(body.error);
    assert.equal(body.detail, undefined, 'no raw upstream body field at all');
    assert.ok(errors.length > 0, 'the real failure must still be logged server-side');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousFal === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = previousFal;
  }
});

test('ai-render/poll: a result with no image logs server-side and answers with a short generic message', async () => {
  const previousFal = process.env.FAL_KEY;
  process.env.FAL_KEY = 'test-placeholder';
  const previousFetch = globalThis.fetch;
  let call = 0;
  globalThis.fetch = (async () => {
    call++;
    if (call === 1) return new Response(JSON.stringify({ status: 'COMPLETED' }), { status: 200 });
    return new Response(JSON.stringify({ images: [] }), { status: 200 });
  }) as typeof fetch;
  const errors: unknown[] = [];
  console.error = (...args: unknown[]) => { errors.push(args); };
  try {
    const { POST } = await import('@/app/api/ai-render/poll/route');
    const req = new NextRequest('http://localhost/api/ai-render/poll', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.52' },
      body: JSON.stringify({
        statusUrl: 'https://queue.fal.run/some/status',
        responseUrl: 'https://queue.fal.run/some/result',
      }),
    });
    const res = await POST(req);
    assert.equal(res.status, 502);
    const body = await res.json();
    neverLeaksUpstream(body.error);
    assert.ok(errors.length > 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousFal === undefined) delete process.env.FAL_KEY; else process.env.FAL_KEY = previousFal;
  }
});

test('chat: the stream error handler logs server-side instead of echoing the raw error to the farmer', () => {
  const src = read('app/api/chat/route.ts');
  const catchBlock = src.slice(src.indexOf('for await (const chunk of stream)'), src.indexOf('return new Response(readable'));
  assert.match(catchBlock, /console\.error/, 'the real stream error must be logged server-side');
  assert.doesNotMatch(catchBlock, /err\.message/, 'the raw error message must not reach the farmer');
  assert.doesNotMatch(catchBlock, /String\(err\)/, 'the raw error must not be stringified into the response');
});

// sec-03: a single oversized guest chat or design request (huge messages, a huge context array, a
// huge embedded image) could overshoot the R1 guest allowance and server memory before ever being
// turned away. Pins both the shared limit helpers and that the two routes actually call them before
// any AI call.

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { NextRequest } from 'next/server';

import {
  contextTooLarge,
  imageTooLarge,
  MAX_CHAT_MESSAGES,
  MAX_IMAGE_B64_CHARS,
  messageTooLong,
  tooManyMessages,
} from '@/lib/api-request-limits';
import { sharedLimiter } from '@/lib/api-rate-limit';

let originalWarn: typeof console.warn;

before(() => {
  originalWarn = console.warn; console.warn = () => {};
  sharedLimiter.reset();
});

after(() => {
  console.warn = originalWarn;
  sharedLimiter.reset();
});

test('tooManyMessages / messageTooLong / contextTooLarge / imageTooLarge', () => {
  assert.equal(tooManyMessages(MAX_CHAT_MESSAGES), false);
  assert.equal(tooManyMessages(MAX_CHAT_MESSAGES + 1), true);

  assert.equal(messageTooLong([{ content: 'hi' }]), false);
  assert.equal(messageTooLong([{ content: 'x'.repeat(8001) }]), true);

  assert.equal(contextTooLarge(undefined), false);
  assert.equal(contextTooLarge({ a: 1 }), false);
  assert.equal(contextTooLarge({ reports: Array(10000).fill({ name: 'x'.repeat(20) }) }), true);
  // A circular object can't be JSON.stringify'd — treat that as oversized/invalid rather than
  // throwing out of the guard.
  const circular: Record<string, unknown> = {};
  circular.self = circular;
  assert.equal(contextTooLarge(circular), true);

  assert.equal(imageTooLarge(undefined), false);
  assert.equal(imageTooLarge({ data: 'AA==' }), false);
  assert.equal(imageTooLarge({ data: 'A'.repeat(MAX_IMAGE_B64_CHARS + 1) }), true);
});

test('chat refuses too many messages before any AI call', async () => {
  const { POST } = await import('@/app/api/chat/route');
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.30', 'x-imbewu-sample': '1' },
    body: JSON.stringify({ messages: Array.from({ length: MAX_CHAT_MESSAGES + 1 }, () => ({ role: 'user', content: 'hi' })) }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

test('chat refuses an overlong single message before any AI call', async () => {
  const { POST } = await import('@/app/api/chat/route');
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.31', 'x-imbewu-sample': '1' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(8001) }] }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

test('chat refuses an oversized context blob before any AI call', async () => {
  const { POST } = await import('@/app/api/chat/route');
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.32', 'x-imbewu-sample': '1' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'hi' }],
      context: { reports: Array.from({ length: 5000 }, (_, i) => ({ name: `report-${i}`, savedAt: '2026-01-01' })) },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

test('chat refuses an oversized embedded photo before any AI call', async () => {
  const { POST } = await import('@/app/api/chat/route');
  const req = new NextRequest('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.33', 'x-imbewu-sample': '1' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'what is this?' }],
      image: { data: 'A'.repeat(MAX_IMAGE_B64_CHARS + 1), mediaType: 'image/jpeg' },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

test('design refuses too many images before any AI call', async () => {
  const { POST } = await import('@/app/api/design/route');
  const req = new NextRequest('http://localhost/api/design', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.34' },
    body: JSON.stringify({
      images: Array.from({ length: 7 }, () => ({ data: 'AA==', mediaType: 'image/jpeg' })),
      locationData: {
        biome: { name: 'x' }, rainfall: { annual: 1, pattern: 'x', wetSeason: 'x', drySeason: 'x' },
        elevation: { elevation: 1, slopeDeg: 1, aspectLabel: 'x' }, soil: { textureClass: 'x', ph: 6 },
        climate: { minTemp: 1, maxTemp: 1, windFromSummer: 'x', windFromWinter: 'x' }, lat: -29, lon: 30,
      },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

test('design refuses an oversized sketch image before any AI call', async () => {
  const { POST } = await import('@/app/api/design/route');
  const req = new NextRequest('http://localhost/api/design', {
    method: 'POST',
    headers: { 'x-forwarded-for': '203.0.113.35' },
    body: JSON.stringify({
      images: [{ data: 'A'.repeat(MAX_IMAGE_B64_CHARS + 1), mediaType: 'image/jpeg' }],
      locationData: {
        biome: { name: 'x' }, rainfall: { annual: 1, pattern: 'x', wetSeason: 'x', drySeason: 'x' },
        elevation: { elevation: 1, slopeDeg: 1, aspectLabel: 'x' }, soil: { textureClass: 'x', ph: 6 },
        climate: { minTemp: 1, maxTemp: 1, windFromSummer: 'x', windFromWinter: 'x' }, lat: -29, lon: 30,
      },
    }),
  });
  const res = await POST(req);
  assert.equal(res.status, 413);
});

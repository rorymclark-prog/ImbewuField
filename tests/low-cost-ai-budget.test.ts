// sec-04: lowCostText (read-slip, visit-notes) used to call AI with no allowance check at all —
// a guest with an empty daily pool could keep reading slips for free. meteredLowCostAi puts the
// same R18/R1 ledger in front of it that lib/metered-ai.ts puts in front of chat/area-profile/etc.

import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerKey, type AiSpendStore } from '@/lib/ai-budget';
import { meteredLowCostAi } from '@/lib/low-cost-ai';

const NOW = new Date('2026-09-27T10:00:00Z');

function memoryStore(start: Record<string, number> = {}): AiSpendStore & { data: Record<string, number> } {
  const data = { ...start };
  return {
    data,
    async spentUsd(k) { return data[k] ?? 0; },
    async add(k, usd) { data[k] = (data[k] ?? 0) + usd; },
  };
}

test('a guest whose daily pool is spent is turned away before any call is made', async () => {
  const req = new Request('https://x/api/read-slip', { headers: { 'x-forwarded-for': '198.51.100.7' } });
  const key = ledgerKey({ kind: 'guest', ip: '198.51.100.7' }, NOW);
  const store = memoryStore({ [key]: 1 }); // already at the R1 guest cap
  const out = await meteredLowCostAi(req, { uid: null }, '/api/read-slip', { store, now: NOW });
  assert.equal(out.response?.status, 429);
  assert.match(JSON.stringify(await out.response!.json()), /Sign in/);
  assert.equal(out.ai, undefined);
});

test('a guest with allowance left can call, and the call is recorded against their ledger', async () => {
  const req = new Request('https://x/api/read-slip', { headers: { 'x-forwarded-for': '198.51.100.8' } });
  const key = ledgerKey({ kind: 'guest', ip: '198.51.100.8' }, NOW);
  const store = memoryStore();
  const previousProvider = process.env.LOW_COST_AI_PROVIDER, previousKey = process.env.GEMINI_API_KEY;
  process.env.LOW_COST_AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'test-placeholder';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '{"amount":20}' }] } }],
    usageMetadata: { promptTokenCount: 2000, candidatesTokenCount: 200 },
  });
  try {
    const out = await meteredLowCostAi(req, { uid: null }, '/api/read-slip', { store, now: NOW });
    assert.equal(out.response, undefined);
    const text = await out.ai!.text('Read total', 400, { data: 'AA==', mediaType: 'image/jpeg' });
    assert.equal(text, '{"amount":20}');
    assert.ok(store.data[key] > 0, 'the call must add to the guest ledger, not bypass it');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousProvider === undefined) delete process.env.LOW_COST_AI_PROVIDER; else process.env.LOW_COST_AI_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('a signed-in user under their monthly cap can call, and spend is recorded against their own key', async () => {
  const req = new Request('https://x/api/visit-notes');
  const key = ledgerKey({ kind: 'user', uid: 'mentor-1' }, NOW);
  const store = memoryStore();
  const previousProvider = process.env.LOW_COST_AI_PROVIDER, previousKey = process.env.GEMINI_API_KEY;
  process.env.LOW_COST_AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'test-placeholder';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Cleaned up notes.' }] } }],
    usageMetadata: { promptTokenCount: 500, candidatesTokenCount: 50 },
  });
  try {
    const out = await meteredLowCostAi(req, { uid: 'mentor-1' }, '/api/visit-notes', { store, now: NOW });
    assert.equal(out.response, undefined);
    const text = await out.ai!.text('Clean up these notes', 1800);
    assert.equal(text, 'Cleaned up notes.');
    assert.ok(store.data[key] > 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousProvider === undefined) delete process.env.LOW_COST_AI_PROVIDER; else process.env.LOW_COST_AI_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});

test('a ledger outage never blocks a signed-in call', async () => {
  const req = new Request('https://x/api/visit-notes');
  const broken: AiSpendStore = { async spentUsd() { throw new Error('down'); }, async add() { throw new Error('down'); } };
  const previousProvider = process.env.LOW_COST_AI_PROVIDER, previousKey = process.env.GEMINI_API_KEY;
  process.env.LOW_COST_AI_PROVIDER = 'gemini'; process.env.GEMINI_API_KEY = 'test-placeholder';
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'ok' }] } }],
    usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
  });
  try {
    const out = await meteredLowCostAi(req, { uid: 'mentor-2' }, '/api/visit-notes', { store: broken, now: NOW });
    assert.equal(out.response, undefined);
    assert.equal(await out.ai!.text('x', 10), 'ok');
  } finally {
    globalThis.fetch = previousFetch;
    if (previousProvider === undefined) delete process.env.LOW_COST_AI_PROVIDER; else process.env.LOW_COST_AI_PROVIDER = previousProvider;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previousKey;
  }
});

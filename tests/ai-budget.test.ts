import test from 'node:test';
import assert from 'node:assert/strict';
import { allowanceFrom, budgetConfig, CHEAP_MODEL, ledgerKey, loadAiBudget, monthlyResetDate, pickModel, type AiSpendStore } from '@/lib/ai-budget';
import { AI_MODELS, meteredAi, shapeParams } from '@/lib/metered-ai';

const NOW = new Date('2026-09-27T10:00:00Z');
const cfg = budgetConfig({});

function memoryStore(start: Record<string, number> = {}): AiSpendStore & { data: Record<string, number> } {
  const data = { ...start };
  return { data, async spentUsd(k) { return data[k] ?? 0; }, async add(k, usd) { data[k] = (data[k] ?? 0) + usd; } };
}

test('defaults: €3 a month per person, a few cents a day per guest', () => {
  assert.equal(cfg.monthlyCapEur, 3);
  assert.ok(cfg.guestDailyEur > 0 && cfg.guestDailyEur < 0.5);
  assert.equal(budgetConfig({ AI_MONTHLY_CAP_EUR: '5' }).monthlyCapEur, 5);
  assert.equal(budgetConfig({ AI_MONTHLY_CAP_EUR: 'nonsense' }).monthlyCapEur, 3);
});

test('the monthly allowance refills on the 1st, including across a year end', () => {
  assert.equal(monthlyResetDate(NOW), '2026-10-01');
  assert.equal(monthlyResetDate(new Date('2026-12-31T23:00:00Z')), '2027-01-01');
});

test('a person keeps the chosen model until the cap, then drops to the cheap one', () => {
  const who = { kind: 'user' as const, uid: 'u1' };
  const under = allowanceFrom(who, 2 * cfg.usdPerEur, NOW, cfg);
  assert.equal(under.capped, false);
  assert.equal(under.remainingEur, 1);
  assert.equal(pickModel(AI_MODELS.main, under), AI_MODELS.main);
  const over = allowanceFrom(who, 3 * cfg.usdPerEur, NOW, cfg);
  assert.equal(over.capped, true);
  assert.equal(pickModel(AI_MODELS.deep, over), CHEAP_MODEL);
});

test('guests always use the cheap model, and the ledger never stores their address', () => {
  const who = { kind: 'guest' as const, ip: '203.0.113.9' };
  assert.equal(pickModel(AI_MODELS.main, allowanceFrom(who, 0, NOW, cfg)), CHEAP_MODEL);
  const key = ledgerKey(who, NOW);
  assert.ok(!key.includes('203.0.113.9'));
  assert.ok(key.endsWith('2026-09-27'));
  assert.equal(ledgerKey({ kind: 'user', uid: 'abc' }, NOW), 'u_abc_2026-09');
});

test('recorded spend is priced from real usage and adds up', async () => {
  const store = memoryStore();
  const budget = await loadAiBudget({ kind: 'user', uid: 'u1' }, '/api/chat', { store, now: NOW });
  await budget.record(AI_MODELS.main, { input_tokens: 1_000_000, output_tokens: 100_000 });
  await budget.record(AI_MODELS.main, { input_tokens: 1_000_000, output_tokens: 100_000 });
  assert.equal(store.data['u_u1_2026-09'], 6); // 2 × ($2 in + $1 out)
});

test('a ledger outage never blocks the call', async () => {
  const broken: AiSpendStore = { async spentUsd() { throw new Error('down'); }, async add() { throw new Error('down'); } };
  const budget = await loadAiBudget({ kind: 'user', uid: 'u1' }, '/api/chat', { store: broken, now: NOW });
  assert.equal(budget.model(AI_MODELS.main), AI_MODELS.main);
  await budget.record(AI_MODELS.main, { input_tokens: 10, output_tokens: 10 });
});

test('a guest whose daily pool is spent is asked to sign in', async () => {
  const req = new Request('https://x/api/chat', { headers: { 'x-forwarded-for': '198.51.100.4' } });
  const key = ledgerKey({ kind: 'guest', ip: '198.51.100.4' }, NOW);
  const store = memoryStore({ [key]: 1 });
  const out = await meteredAi(req, { uid: null }, '/api/chat', {} as never, { store, now: NOW });
  assert.equal(out.response?.status, 429);
  assert.match(JSON.stringify(await out.response!.json()), /Sign in/);
});

test('requests are fitted to the model they run on', () => {
  const base = { model: AI_MODELS.main, max_tokens: 1000, messages: [] };
  const newer = shapeParams(base, AI_MODELS.main);
  assert.equal(newer.max_tokens, 1300);
  assert.deepEqual((newer as { thinking?: unknown }).thinking, { type: 'disabled' });
  const cheap = shapeParams({ ...base, thinking: { type: 'disabled' as const } }, CHEAP_MODEL);
  assert.equal(cheap.model, CHEAP_MODEL);
  assert.equal(cheap.max_tokens, 1000);
  assert.equal('thinking' in cheap, false);
});

test('the in-memory fallback ledger still counts spend', async () => {
  const { memorySpendStore } = await import('@/lib/ai-budget');
  await memorySpendStore.add('u_mem_2026-09', 1.5, '/api/chat', AI_MODELS.main);
  await memorySpendStore.add('u_mem_2026-09', 2, '/api/chat', AI_MODELS.main);
  assert.equal(await memorySpendStore.spentUsd('u_mem_2026-09'), 3.5);
  const budget = await loadAiBudget({ kind: 'user', uid: 'mem' }, '/api/chat', { store: memorySpendStore, now: NOW });
  assert.equal(budget.allowance.capped, true);
  assert.equal(budget.model(AI_MODELS.main), CHEAP_MODEL);
});

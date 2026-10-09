// A monthly AI allowance per person, and a small daily one per guest.
//
// WHY: every AI call is priced (lib/ai-cost.ts), but nothing added the prices up per person, so one
// heavy user could run up any bill. Rory's rule (Oct 2026): R18 of AI per signed-in user per
// month — the same as the R18 a month the platform is priced at. Reaching it does NOT switch AI off — it moves that person onto the cheap model until the
// 1st of next month. Guests (no sign-in) get a tiny daily pool on the cheap model, then a nudge to
// sign in. Both numbers are env-tunable so the cap can follow the research without a deploy of code.
//
// HOW IT COUNTS: after each call the real usage is priced and added with an atomic Firestore
// increment. The check happens before the call, so a burst of calls that all start under the cap
// can overshoot it by the cost of those in-flight calls — a few cents, never an open-ended bill.
//
// FAILURE MODE: production may have no server-side Firestore credentials (see the note at the top
// of lib/api-rate-limit.ts). The ledger read is capped at 1.5 s so it can never slow an AI call,
// and when Firestore is unreachable the count falls back to this server instance's memory — the
// same honest, partial protection the rate limiter gives — and Firestore is retried after 10
// minutes. Nothing here ever turns AI off for a signed-in person.

import { createHash } from 'node:crypto';
import { costOf, type AiUsage } from './ai-cost';

/** The cheap model every capped request falls back to. */
export const CHEAP_MODEL = 'claude-haiku-4-5';

const num = (v: string | undefined, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

export interface AiBudgetConfig {
  /** Monthly allowance per signed-in person, in rand. */
  monthlyCapZar: number;
  /** Daily allowance per guest address, in rand. */
  guestDailyZar: number;
  /** Planning rate: the API bills in US dollars. */
  zarPerUsd: number;
}

export function budgetConfig(env: Record<string, string | undefined> = process.env): AiBudgetConfig {
  return {
    monthlyCapZar: num(env.AI_MONTHLY_CAP_ZAR, 18),
    guestDailyZar: num(env.AI_GUEST_DAILY_ZAR, 1),
    zarPerUsd: num(env.AI_ZAR_PER_USD, 18) || 18,
  };
}

/** `2026-09` — the ledger month, in UTC so every server agrees on when it rolls over. */
export function monthKey(now: Date): string {
  return now.toISOString().slice(0, 7);
}

export function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

/** The first day of next month (UTC), as YYYY-MM-DD — when a monthly allowance starts again. */
export function monthlyResetDate(now: Date): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export type Spender =
  | { kind: 'user'; uid: string }
  | { kind: 'guest'; ip: string };

export function ledgerKey(who: Spender, now: Date): string {
  if (who.kind === 'user') return `u_${who.uid}_${monthKey(now)}`;
  // An address is personal data: store a hash, never the address itself.
  const hashed = createHash('sha256').update(`imbewu-ai:${who.ip}`).digest('hex').slice(0, 24);
  return `g_${hashed}_${dayKey(now)}`;
}

/** Where spend is kept. Firestore in production; a Map in the tests. */
export interface AiSpendStore {
  spentUsd(key: string): Promise<number>;
  add(key: string, usd: number, route: string, model: string): Promise<void>;
}

export interface AiAllowance {
  kind: Spender['kind'];
  spentZar: number;
  capZar: number;
  remainingZar: number;
  /** YYYY-MM-DD the allowance refills (tomorrow for guests, the 1st for signed-in people). */
  resetsOn: string;
  /** True once the allowance is used up: calls run on the cheap model (or stop, for guests). */
  capped: boolean;
}

export function allowanceFrom(who: Spender, spentUsd: number, now: Date, cfg: AiBudgetConfig): AiAllowance {
  const capZar = who.kind === 'user' ? cfg.monthlyCapZar : cfg.guestDailyZar;
  const spentZar = spentUsd * cfg.zarPerUsd;
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  return {
    kind: who.kind,
    spentZar: Math.round(spentZar * 100) / 100,
    capZar,
    remainingZar: Math.max(0, Math.round((capZar - spentZar) * 100) / 100),
    resetsOn: who.kind === 'user' ? monthlyResetDate(now) : tomorrow,
    capped: spentZar >= capZar,
  };
}

/**
 * Which model a call may use. Signed-in people get the route's chosen model until their monthly
 * allowance is spent, then the cheap one. Guests always get the cheap one.
 */
export function pickModel(preferred: string, allowance: AiAllowance): string {
  if (allowance.kind === 'guest') return CHEAP_MODEL;
  return allowance.capped ? CHEAP_MODEL : preferred;
}

let firestoreStore: AiSpendStore | null = null;
let firestoreDownUntil = 0;
const FIRESTORE_RETRY_MS = 10 * 60_000;
const LEDGER_READ_TIMEOUT_MS = 1500;

/** Per-instance fallback ledger for when Firestore is unreachable. Resets on a cold start. */
const memory = new Map<string, number>();
export const memorySpendStore: AiSpendStore = {
  async spentUsd(key) { return memory.get(key) ?? 0; },
  async add(key, usd) {
    memory.set(key, (memory.get(key) ?? 0) + usd);
    if (memory.size > 5000) memory.delete(memory.keys().next().value as string);
  },
};

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`ledger read timed out after ${ms} ms`)), ms);
    p.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

/** Lazily bound so tests and builds never touch firebase-admin. */
async function defaultStore(): Promise<AiSpendStore> {
  if (firestoreStore) return firestoreStore;
  const { getApps, getApp, initializeApp } = await import('firebase-admin/app');
  const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
  const db = getFirestore(getApps().length ? getApp() : initializeApp());
  const col = db.collection('ai_spend');
  firestoreStore = {
    async spentUsd(key) {
      const snap = await col.doc(key).get();
      const usd = snap.data()?.usd;
      return typeof usd === 'number' && Number.isFinite(usd) ? usd : 0;
    },
    async add(key, usd, route, model) {
      await col.doc(key).set({
        usd: FieldValue.increment(usd),
        calls: FieldValue.increment(1),
        [`byRoute.${route.replace(/[^a-z0-9-]/gi, '_')}`]: FieldValue.increment(usd),
        lastModel: model,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    },
  };
  return firestoreStore;
}

export interface AiBudget {
  who: Spender;
  allowance: AiAllowance;
  /** The model this request may actually use in place of `preferred`. */
  model(preferred: string): string;
  /** Price the call's real usage and add it to the ledger. Never throws. */
  record(model: string, usage: AiUsage | null | undefined): Promise<void>;
}

export async function loadAiBudget(
  who: Spender,
  route: string,
  opts: { store?: AiSpendStore; now?: Date; env?: Record<string, string | undefined> } = {},
): Promise<AiBudget> {
  const now = opts.now ?? new Date();
  const cfg = budgetConfig(opts.env);
  const key = ledgerKey(who, now);
  let store: AiSpendStore | null = opts.store ?? null;
  let spent = 0;
  if (store) {
    try {
      spent = await store.spentUsd(key);
    } catch (error) {
      console.warn(`[ai-budget] ${route}: ledger unavailable, not metering this call`, error instanceof Error ? error.message : error);
      store = null;
    }
  } else if (Date.now() < firestoreDownUntil) {
    store = memorySpendStore;
    spent = await store.spentUsd(key);
  } else {
    try {
      store = await defaultStore();
      spent = await withTimeout(store.spentUsd(key), LEDGER_READ_TIMEOUT_MS);
    } catch (error) {
      console.warn(`[ai-budget] ${route}: Firestore ledger unavailable, counting in memory for 10 min`, error instanceof Error ? error.message : error);
      firestoreDownUntil = Date.now() + FIRESTORE_RETRY_MS;
      store = memorySpendStore;
      spent = await store.spentUsd(key);
    }
  }
  const allowance = allowanceFrom(who, spent, now, cfg);
  return {
    who,
    allowance,
    model: (preferred) => pickModel(preferred, allowance),
    async record(model, usage) {
      const usd = costOf(model, usage).usd;
      if (!store || !Number.isFinite(usd) || usd <= 0) return;
      try {
        await store.add(key, usd, route, model);
      } catch (error) {
        console.warn(`[ai-budget] ${route}: could not record spend`, error instanceof Error ? error.message : error);
      }
    },
  };
}

/** The reply a guest gets once their daily pool is empty. */
export function guestAllowanceSpentResponse(allowance: AiAllowance): Response {
  return Response.json(
    {
      error: 'Today’s free AI for visitors is used up. Sign in to keep going — it is free.',
      code: 'guest_ai_allowance_spent',
      resetsOn: allowance.resetsOn,
    },
    { status: 429, headers: { 'Cache-Control': 'no-store' } },
  );
}

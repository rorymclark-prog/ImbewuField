/*
 * A CEILING ON WHAT ONE CALLER CAN SPEND, IN THE ONE PLACE EVERY PAID ROUTE ALREADY PASSES THROUGH.
 *
 * Nineteen routes call a billed upstream model (Anthropic, Gemini, OpenAI via fal). Until this
 * file, exactly one of them — /api/image-producer — counted anything, and it counted alone: its
 * own Map, its own window, its own 429 wording, invisible to the other eighteen. A runaway client
 * loop on /api/chat, or a bored stranger with curl on /api/generate-report, had no ceiling at all
 * except the credit card behind the API keys. This is the ceiling.
 *
 * ── WHY IT IS IN MEMORY, AND WHAT THAT HONESTLY BUYS ─────────────────────────────────────────
 *
 * The obvious better design is a shared sliding window in Firestore, so every serverless instance
 * counts against one budget. It is not available here, and the reason is checkable rather than a
 * matter of taste: THIS APP HAS NO SERVER-SIDE FIRESTORE CREDENTIALS IN PRODUCTION. The only
 * server code that reaches Firestore is lib/network-caller.ts, and it wraps getFirestore() in a
 * try/catch that returns 503 precisely because the credentials may not be there — see the
 * deployment-preconditions note at the top of app/api/network/farmers/route.ts, which lists Admin
 * SDK credentials as OFF by default. (The Admin SDK's token VERIFICATION works without them — it
 * needs only a project id, see lib/api-auth.ts — but reading and writing documents does not.)
 * A limiter that throws on a cold instance is worse than no limiter, and a limiter that silently
 * fails open on every request is a comment pretending to be code. Paid third-party stores
 * (Upstash, Redis) are out of scope by instruction and would be a new bill to guard a bill.
 *
 * So: a per-instance Map. What that means, stated plainly rather than buried:
 *
 *   • The budget is enforced PER RUNNING INSTANCE, not per deployment. Vercel may run several
 *     concurrently and recycles them freely, so a determined distributed attacker multiplies the
 *     effective budget by however many instances they can spread across, and a cold start hands a
 *     fresh budget to whoever lands on it.
 *   • It is still real protection. The failure this actually stops is the common one: a client
 *     retry loop, a stuck poll, one script hammering one endpoint from one address. Those keep
 *     hitting the same warm instance, and they are what turns a $5 day into a $500 one.
 *   • It is strictly more than the zero enforcement that preceded it on eighteen of nineteen
 *     routes.
 *
 * If server credentials are ever provisioned, the swap is contained: keep the policy tables and
 * the verdict shape below and replace RateLimiter's Map with a Firestore transaction.
 *
 * ── WHAT IS COUNTED ──────────────────────────────────────────────────────────────────────────
 *
 * One bucket per (caller, cost class). The caller is the verified uid when there is one and the
 * client IP when there is not — so a signed-in farmer carries their budget across networks, and an
 * anonymous caller cannot mint a fresh budget by reloading. The cost class is the route's price
 * band, because "twenty requests an hour" means something very different for a one-shot chat turn
 * than for a comprehensive report that fans out into eleven model calls carrying images.
 */

/** Price bands. A route's class decides which budget row applies to it. */
export type CostClass =
  /** One text or vision model call per request: chat, insights, advice, a photo read. */
  | 'ai'
  /** app/api/generate-report — fans out into up to eleven model calls carrying images. */
  | 'report'
  /** Image generation (gpt-image-2 / Gemini image / fal). The most expensive call in the app. */
  | 'image'
  /** A status check against a queue we already paid to enqueue. Cheap, and issued in the HUNDREDS
   *  per render — lib/ai-render-client.ts polls every 3–6s for up to eight minutes. Budgeting this
   *  like an AI call would make one legitimate render kill its own poll loop. */
  | 'poll'
  /** Authorised Firestore reads (the funder/NGO portfolio). No model spend, but ~264 document
   *  reads per call — a bill of a different colour, and worth a ceiling for the same reason. */
  | 'data';

export interface Budget {
  /** Requests permitted inside the window. */
  limit: number;
  windowMs: number;
}

const HOUR = 60 * 60 * 1000;

/**
 * ANONYMOUS callers, keyed by IP. Small on purpose.
 *
 * This is the entire protection behind the guest lane (see GUEST_LANE_ROUTES in lib/api-auth.ts):
 * the `x-imbewu-sample` header that admits a demo visitor can be forged by anyone, so the lane's
 * security is not the header — it is that the header buys you twenty AI calls an hour from one
 * address and nothing more. Enough to walk the whole sample farm and hold a real conversation with
 * it; useless as a free API.
 */
export const ANONYMOUS_BUDGETS: Record<CostClass, Budget> = {
  ai: { limit: 20, windowMs: HOUR },
  // Three comprehensive reports is more than any evaluator needs and about R30 of upstream spend.
  report: { limit: 3, windowMs: HOUR },
  // Not reachable via the guest lane at all (image routes are deliberately excluded from it), so
  // this only ever applies while REQUIRE_API_AUTH is unset — i.e. it is the cap on the hole that
  // tests/paid-api-auth-wiring.test.ts recorded as live on production.
  image: { limit: 8, windowMs: HOUR },
  poll: { limit: 200, windowMs: HOUR },
  data: { limit: 20, windowMs: HOUR },
};

/**
 * SIGNED-IN callers, keyed by uid. Generous: this is not an anti-abuse limit, it is the stop on a
 * runaway client — a retry loop, a re-render storm, a poll that never notices it succeeded. A real
 * farmer should never meet it, and if one does, the message says to wait rather than accusing them.
 */
export const USER_BUDGETS: Record<CostClass, Budget> = {
  ai: { limit: 120, windowMs: HOUR },
  report: { limit: 30, windowMs: HOUR },
  // Replaces the private limit inside app/api/image-producer/route.ts, which was 20 per 10 minutes
  // — i.e. 120/hour if sustained. A burst of 20 in ten minutes still passes here; what no longer
  // passes is that rate held for a full hour, which is a loop, not an editing session.
  image: { limit: 60, windowMs: HOUR },
  // One render polls ~100 times over its eight-minute deadline. Six concurrent renders an hour is
  // already an unusual session; a poll loop that never terminates is what this number stops.
  poll: { limit: 600, windowMs: HOUR },
  data: { limit: 300, windowMs: HOUR },
};

/**
 * Route → price band. Keys are NORMALISED route names (see normaliseRouteName): the guard is
 * called with '/api/chat' from most routes and with 'network/farmers' from the portfolio ones, and
 * a table that had to know which spelling a route happened to use would be a table with a hole in
 * it.
 *
 * A route missing from this map is charged as 'ai' — the safe default, because it is the band every
 * new AI route belongs to and the one that costs an unlisted route the least headroom.
 */
const ROUTE_COST_CLASS: Record<string, CostClass> = {
  'generate-report': 'report',
  'image-producer': 'image',
  'ai-render': 'image',
  'ai-render/poll': 'poll',
  'network/farmers': 'data',
  'network/orgs': 'data',
};

/** '/api/ai-render/poll' and 'ai-render/poll' are the same route. Compare one spelling. */
export function normaliseRouteName(routeName: string): string {
  return routeName.replace(/^\/+/, '').replace(/^api\//, '').replace(/\/+$/, '');
}

export function costClassFor(routeName: string): CostClass {
  return ROUTE_COST_CLASS[normaliseRouteName(routeName)] ?? 'ai';
}

export interface RateLimitVerdict {
  allowed: boolean;
  /** Requests left in the window after this one. Zero when refused. */
  remaining: number;
  /** Seconds until the oldest counted request falls out of the window. 0 when allowed. */
  retryAfterSeconds: number;
}

/**
 * A sliding window per key, with a bounded number of keys.
 *
 * Deliberately NOT a singleton class-with-globals: the instance is created below and shared, but
 * the class is exported so a test can hold its own and so a future Firestore-backed implementation
 * can be swapped in behind the same three methods.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  /**
   * Hard ceiling on tracked keys. Without it, one attacker cycling source addresses turns the
   * limiter into an unbounded memory leak — a denial of service delivered BY the defence. When
   * full, the least recently touched key is evicted, which is the right one to lose: an idle key
   * is one whose window has probably expired anyway.
   *
   * Declared as a field rather than a constructor parameter property: `node --test` strips types
   * rather than compiling them, and a parameter property is syntax it refuses to strip.
   */
  private readonly maxKeys: number;

  constructor(maxKeys = 2000) {
    this.maxKeys = maxKeys;
  }

  /**
   * Count one request against `key` and say whether it may proceed.
   *
   * A REFUSED REQUEST IS NOT COUNTED. The alternative (the behaviour of the old image-producer
   * limiter, which pushed the timestamp before testing the length) turns the window into a penalty
   * box: keep hammering and the window never drains, so Retry-After becomes a lie and a client
   * that politely backs off is treated the same as one that does not. Here the window always
   * drains in real time, and Retry-After is exactly true.
   */
  check(key: string, budget: Budget, now: number = Date.now()): RateLimitVerdict {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < budget.windowMs);

    if (recent.length >= budget.limit) {
      this.touch(key, recent);
      const oldest = recent[0];
      return {
        allowed: false,
        remaining: 0,
        // Ceil, and never below 1: a Retry-After of 0 invites an immediate retry that is certain
        // to fail again.
        retryAfterSeconds: Math.max(1, Math.ceil((budget.windowMs - (now - oldest)) / 1000)),
      };
    }

    recent.push(now);
    this.touch(key, recent);
    return { allowed: true, remaining: budget.limit - recent.length, retryAfterSeconds: 0 };
  }

  /** Re-insert so the Map's insertion order is least-recently-used order. */
  private touch(key: string, recent: number[]): void {
    this.hits.delete(key);
    if (recent.length > 0) this.hits.set(key, recent);
    while (this.hits.size > this.maxKeys) {
      const oldest = this.hits.keys().next();
      if (oldest.done) break;
      this.hits.delete(oldest.value);
    }
  }

  /** Tracked keys. Exposed for the memory-bound test, not for callers. */
  get size(): number {
    return this.hits.size;
  }

  /** Test seam only. Production never needs to forget a window. */
  reset(): void {
    this.hits.clear();
  }
}

/**
 * The process-wide limiter. Module state, so it lives exactly as long as the serverless instance
 * does — see the honesty note at the top of this file about what that means.
 */
export const sharedLimiter = new RateLimiter();

/**
 * The address a request came from, as far as the edge will tell us.
 *
 * `x-forwarded-for` is a list; the FIRST entry is the client and the rest are proxies. On Vercel
 * the header is set by the platform, so it cannot be spoofed away — a caller can prepend entries,
 * but the platform appends the real address, and taking the first entry means a forged prefix
 * gives the attacker a bucket of their own choosing rather than someone else's. That is the right
 * trade for a limiter: the worst case is that a forger gets a fresh budget (they could get that
 * from a new address anyway), never that they exhaust an innocent party's.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const first = forwarded?.split(',')[0]?.trim();
  if (first) return first;
  return req.headers.get('x-real-ip')?.trim() || 'unknown-ip';
}

export interface RateLimitDecision {
  verdict: RateLimitVerdict;
  budget: Budget;
  costClass: CostClass;
  /** The bucket that was charged — logged on refusal, never returned to the caller. */
  key: string;
}

/**
 * Decide, without side effects beyond the count itself, whether this request may proceed.
 *
 * `uid` null means "no verified identity", which covers both a guest-lane demo visitor and (while
 * REQUIRE_API_AUTH is unset) any anonymous caller. Both are charged to the IP under the anonymous
 * budgets, because they are the same risk wearing different hats.
 */
export function checkApiRateLimit(
  req: Request,
  routeName: string,
  uid: string | null,
  options: { limiter?: RateLimiter; now?: number } = {},
): RateLimitDecision {
  const limiter = options.limiter ?? sharedLimiter;
  const now = options.now ?? Date.now();
  const costClass = costClassFor(routeName);
  const budget = uid ? USER_BUDGETS[costClass] : ANONYMOUS_BUDGETS[costClass];
  const key = `${uid ? `uid:${uid}` : `ip:${clientIp(req)}`}|${costClass}`;
  return { verdict: limiter.check(key, budget, now), budget, costClass, key };
}

/** Whole minutes, rounded up, for a message a farmer reads rather than parses. */
function minutesFrom(seconds: number): number {
  return Math.max(1, Math.ceil(seconds / 60));
}

/**
 * The 429 body. `error` is the field every client in this app already surfaces (ChatPanel and
 * friends read `body.error` and show it verbatim), so this string is farmer-facing copy, not a
 * developer message: it says what happened, how long to wait, and — for a demo visitor — what
 * signing in would change.
 */
export function rateLimitedResponse(
  decision: RateLimitDecision,
  audience: 'guest' | 'user',
): Response {
  const minutes = minutesFrom(decision.verdict.retryAfterSeconds);
  const wait = minutes === 1 ? 'about a minute' : `about ${minutes} minutes`;
  const error = audience === 'guest'
    ? `The sample farm shares a small pool of AI requests so everyone can try it. Please wait ${wait} and try again, or sign in to your own farm for full access.`
    : `That is a lot of AI requests in a short time. Please wait ${wait} and try again.`;

  return new Response(JSON.stringify({ error }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(decision.verdict.retryAfterSeconds),
    },
  });
}

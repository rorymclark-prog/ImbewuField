/*
 * THE CEILING ON WHAT ONE CALLER CAN SPEND.
 *
 * On 2026-08-24 this worked against production, with no account and no token:
 *
 *     curl -X POST https://imbewufield.vercel.app/api/chat -d '{"messages":[...]}'
 *
 * — recorded in tests/paid-api-auth-wiring.test.ts, which fixed the wiring half of it. The other
 * half is that nothing counted. Eighteen of nineteen billed routes had no ceiling of any kind;
 * the nineteenth, /api/image-producer, kept a private Map nobody else could see. A retry loop, a
 * stuck poll, or one bored stranger with a shell script had exactly as much of this app's model
 * budget as they cared to take.
 *
 * lib/api-rate-limit.ts is the ceiling, and it is deliberately live NOW — before REQUIRE_API_AUTH
 * is ever flipped — because it guards the same wallet either way. This file holds it to four
 * properties:
 *
 *   1. IT REFUSES. A budget that is exhausted returns 429, with a body a farmer can read and a
 *      Retry-After a client can obey.
 *   2. IT FORGIVES. The window is sliding and real: wait it out and the budget comes back. A
 *      limiter that never forgets is a ban, and this is not a ban — the guest lane's whole purpose
 *      is that a stranger CAN try the demo.
 *   3. IT SEPARATES. One caller's exhaustion is not another's, one route class is not another,
 *      and — the property that matters most on cutover day — a SIGNED-IN farmer is never refused
 *      because anonymous visitors used up the demo pool.
 *   4. IT IS BOUNDED. An attacker cycling addresses cannot grow the Map until the instance dies.
 *      A defence that becomes the outage is not a defence.
 *
 * The clock is injected everywhere below. A rate-limit test that sleeps is a slow test that is
 * flaky on a loaded machine, and the thing being tested — "does the window really drain?" — is
 * exactly what a fake clock can answer honestly.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
  ANONYMOUS_BUDGETS,
  RateLimiter,
  USER_BUDGETS,
  checkApiRateLimit,
  clientIp,
  costClassFor,
  normaliseRouteName,
  rateLimitedResponse,
} from '@/lib/api-rate-limit';
import { SAMPLE_REQUEST_HEADER, guardPaidApiRequest } from '@/lib/api-auth';

const T0 = Date.UTC(2026, 7, 29, 9, 0, 0);
const HOUR = 60 * 60 * 1000;

let originalWarn: typeof console.warn;
before(() => {
  originalWarn = console.warn;
  console.warn = () => {};
});
after(() => {
  console.warn = originalWarn;
});

async function withRequireApiAuth<T>(value: string | undefined, fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env.REQUIRE_API_AUTH;
  if (value === undefined) delete process.env.REQUIRE_API_AUTH;
  else process.env.REQUIRE_API_AUTH = value;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.REQUIRE_API_AUTH;
    else process.env.REQUIRE_API_AUTH = previous;
  }
}

function sampleRequest(ip: string): Request {
  return new Request('https://example.test/api/paid', {
    headers: { [SAMPLE_REQUEST_HEADER]: '1', 'x-forwarded-for': ip },
  });
}

function signedInRequest(): Request {
  return new Request('https://example.test/api/paid', {
    headers: { authorization: 'Bearer good-token', 'x-forwarded-for': '198.51.100.99' },
  });
}

const verifyAs = (uid: string) => async () => ({ uid });
const neverVerifies: () => Promise<{ uid: string }> = async () => {
  throw new Error('no token to verify');
};

/* ── 1. The window: it refuses, and it says how long for ────────────────────────────────────── */

test('a budget of N allows exactly N requests, then refuses', () => {
  const limiter = new RateLimiter();
  const budget = { limit: 3, windowMs: HOUR };

  for (let i = 0; i < 3; i += 1) {
    const verdict = limiter.check('caller', budget, T0 + i * 1000);
    assert.equal(verdict.allowed, true, `request ${i + 1} of 3 should be allowed`);
    assert.equal(verdict.remaining, 2 - i);
  }

  const refused = limiter.check('caller', budget, T0 + 3000);
  assert.equal(refused.allowed, false, 'the fourth request must be refused');
  assert.equal(refused.remaining, 0);
  assert.ok(refused.retryAfterSeconds > 0, 'a refusal must say when to come back');
});

test('the window slides: the budget returns as the oldest request ages out', () => {
  const limiter = new RateLimiter();
  const budget = { limit: 2, windowMs: HOUR };

  limiter.check('caller', budget, T0);              // 09:00
  limiter.check('caller', budget, T0 + 30 * 60000); // 09:30
  assert.equal(limiter.check('caller', budget, T0 + 31 * 60000).allowed, false, 'budget spent at 09:31');

  // At 10:01 the 09:00 request has left the hour — exactly one slot reopens, not two.
  assert.equal(limiter.check('caller', budget, T0 + 61 * 60000).allowed, true, 'the 09:00 slot must reopen');
  assert.equal(limiter.check('caller', budget, T0 + 62 * 60000).allowed, false, 'the 09:30 slot has not');

  // …and by 10:31 the whole window has drained.
  assert.equal(limiter.check('caller', budget, T0 + 91 * 60000).allowed, true, 'a full window later, the budget is back');
});

test('Retry-After counts down to the moment the budget actually reopens', () => {
  const limiter = new RateLimiter();
  const budget = { limit: 1, windowMs: HOUR };
  limiter.check('caller', budget, T0);

  const atOnce = limiter.check('caller', budget, T0 + 1000);
  assert.equal(atOnce.retryAfterSeconds, 3599, 'an hour minus the second already elapsed');

  const later = limiter.check('caller', budget, T0 + 59 * 60000);
  assert.equal(later.retryAfterSeconds, 60, 'a minute left, not another full hour');

  // Wait exactly as long as it said, and it must be true.
  assert.equal(limiter.check('caller', budget, T0 + 59 * 60000 + later.retryAfterSeconds * 1000).allowed, true);
});

test('a refused request is not counted, so hammering cannot extend the window', () => {
  // The limiter this replaces recorded the refused hit, which turned the window into a penalty box:
  // a client that kept retrying was never let back in, and Retry-After became a number that was
  // never true. A polite client and a rude one must serve the same sentence.
  const limiter = new RateLimiter();
  const budget = { limit: 1, windowMs: HOUR };
  limiter.check('caller', budget, T0);

  for (let i = 1; i <= 50; i += 1) limiter.check('caller', budget, T0 + i * 1000);

  assert.equal(
    limiter.check('caller', budget, T0 + HOUR + 1).allowed, true,
    'fifty refused retries must not have pushed the window forward',
  );
});

test('Retry-After is never zero — a refusal must not invite an instant retry', () => {
  const limiter = new RateLimiter();
  const budget = { limit: 1, windowMs: 1000 };
  limiter.check('caller', budget, T0);
  const verdict = limiter.check('caller', budget, T0 + 999);
  assert.ok(verdict.retryAfterSeconds >= 1, `got ${verdict.retryAfterSeconds}`);
});

/* ── 2. Buckets are separate ────────────────────────────────────────────────────────────────── */

test('one caller exhausting a budget does not touch another caller', () => {
  const limiter = new RateLimiter();
  const budget = { limit: 1, windowMs: HOUR };
  limiter.check('ip:1.2.3.4|ai', budget, T0);
  assert.equal(limiter.check('ip:1.2.3.4|ai', budget, T0).allowed, false);
  assert.equal(limiter.check('ip:5.6.7.8|ai', budget, T0).allowed, true, 'a different address is a different budget');
  assert.equal(limiter.check('uid:farmer-42|ai', budget, T0).allowed, true, 'a signed-in farmer is a different budget');
});

test('cost classes are counted separately: a spent report budget leaves chat alone', () => {
  const limiter = new RateLimiter();
  const req = sampleRequest('203.0.113.50');
  const options = { limiter, now: T0 };

  for (let i = 0; i < ANONYMOUS_BUDGETS.report.limit; i += 1) {
    assert.equal(checkApiRateLimit(req, '/api/generate-report', null, options).verdict.allowed, true);
  }
  assert.equal(
    checkApiRateLimit(req, '/api/generate-report', null, options).verdict.allowed, false,
    'the report budget must be spent',
  );
  assert.equal(
    checkApiRateLimit(req, '/api/chat', null, options).verdict.allowed, true,
    'a spent report budget must not silence the chat the demo is built around',
  );
});

test('the route → cost class table reads both spellings and defaults to the cheap band', () => {
  assert.equal(normaliseRouteName('/api/ai-render/poll'), 'ai-render/poll');
  assert.equal(normaliseRouteName('network/farmers'), 'network/farmers');

  assert.equal(costClassFor('/api/generate-report'), 'report');
  assert.equal(costClassFor('/api/ai-render'), 'image');
  assert.equal(costClassFor('/api/image-producer'), 'image');
  assert.equal(costClassFor('/api/ai-render/poll'), 'poll');
  assert.equal(costClassFor('network/farmers'), 'data');
  assert.equal(costClassFor('/api/chat'), 'ai');
  assert.equal(costClassFor('/api/a-route-invented-in-2027'), 'ai', 'an unlisted route must still be counted');
});

test('a render poll is budgeted for a render, not for an AI call', () => {
  // lib/ai-render-client.ts polls every 3–6 seconds for up to eight minutes — roughly a hundred
  // calls for ONE render. Budget that like a chat turn and a legitimate render kills its own poll
  // loop halfway through, which looks to the farmer like the render failing.
  assert.ok(
    USER_BUDGETS.poll.limit >= 500,
    `a signed-in farmer gets ${USER_BUDGETS.poll.limit} polls an hour — one render needs ~100`,
  );
  assert.ok(ANONYMOUS_BUDGETS.poll.limit >= 100);
});

/* ── 3. Through the guard: the properties a route actually sees ─────────────────────────────── */

test('hard mode: a guest exhausts the demo pool and gets a readable 429 with Retry-After', async () => {
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const req = () => sampleRequest('203.0.113.77');
    const options = { limiter, now: T0 };

    for (let i = 0; i < ANONYMOUS_BUDGETS.ai.limit; i += 1) {
      const ok = await guardPaidApiRequest(req(), '/api/chat', neverVerifies, options);
      assert.equal(ok.response, undefined, `demo request ${i + 1} should have been served`);
    }

    const refused = await guardPaidApiRequest(req(), '/api/chat', neverVerifies, options);
    assert.ok(refused.response, 'the budget was spent — this must be refused');
    assert.equal(refused.response.status, 429);
    assert.match(refused.response.headers.get('content-type') ?? '', /application\/json/);

    const retryAfter = refused.response.headers.get('retry-after');
    assert.ok(retryAfter, 'a 429 without Retry-After tells a client nothing but "go away"');
    assert.ok(Number(retryAfter) > 0);

    const body = await refused.response.json();
    // ChatPanel and its siblings render body.error verbatim, so this string is farmer-facing copy.
    assert.equal(typeof body.error, 'string');
    assert.ok(body.error.length > 0);
    assert.doesNotMatch(body.error, /429|rate.?limit|quota|throttl/i, 'the message must be words, not jargon');
    assert.match(body.error, /sample|demo/i, 'a demo visitor should be told this is the demo pool');
    assert.match(body.error, /sign in/i, 'and told what would lift it');
  });
});

test('hard mode: the guest pool is per address, so one abuser does not close the demo', async () => {
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    for (let i = 0; i <= ANONYMOUS_BUDGETS.ai.limit; i += 1) {
      await guardPaidApiRequest(sampleRequest('203.0.113.1'), '/api/chat', neverVerifies, options);
    }
    const other = await guardPaidApiRequest(sampleRequest('203.0.113.2'), '/api/chat', neverVerifies, options);
    assert.equal(other.response, undefined, 'a second visitor must still be able to try the demo');
  });
});

test('hard mode: a signed-in farmer is untouched by an exhausted guest budget', async () => {
  // The cutover-day property. If the demo pool and the farmer pool were one bucket, flipping the
  // flag would hand every stranger with curl the power to lock real farmers out of their own app.
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };

    for (let i = 0; i <= ANONYMOUS_BUDGETS.ai.limit + 5; i += 1) {
      await guardPaidApiRequest(sampleRequest('203.0.113.5'), '/api/chat', neverVerifies, options);
    }
    const spent = await guardPaidApiRequest(sampleRequest('203.0.113.5'), '/api/chat', neverVerifies, options);
    assert.equal(spent.response?.status, 429, 'the guest budget must in fact be spent');

    // Same instance, same clock, same route — and the farmer's own address is irrelevant, because
    // a verified caller is counted by uid.
    for (let i = 0; i < ANONYMOUS_BUDGETS.ai.limit + 5; i += 1) {
      const served = await guardPaidApiRequest(signedInRequest(), '/api/chat', verifyAs('farmer-42'), options);
      assert.equal(served.response, undefined, `the farmer's request ${i + 1} was refused`);
      assert.equal(served.uid, 'farmer-42');
    }
  });
});

test('two signed-in farmers behind one connection do not share a budget', async () => {
  await withRequireApiAuth('1', async () => {
    // A training centre, a phone hotspot, an NGO office: one address, many farmers. Counting them
    // by IP would make the busiest of them everyone else's problem.
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    const sameConnection = () => new Request('https://example.test/api/paid', {
      headers: { authorization: 'Bearer good-token', 'x-forwarded-for': '41.10.10.10' },
    });

    for (let i = 0; i <= USER_BUDGETS.ai.limit; i += 1) {
      await guardPaidApiRequest(sameConnection(), '/api/chat', verifyAs('farmer-a'), options);
    }
    const exhausted = await guardPaidApiRequest(sameConnection(), '/api/chat', verifyAs('farmer-a'), options);
    assert.equal(exhausted.response?.status, 429);

    const colleague = await guardPaidApiRequest(sameConnection(), '/api/chat', verifyAs('farmer-b'), options);
    assert.equal(colleague.response, undefined, 'the farmer at the next desk must still be served');
  });
});

test("a signed-in farmer's 429 does not talk to them about the sample farm", async () => {
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    for (let i = 0; i <= USER_BUDGETS.report.limit; i += 1) {
      await guardPaidApiRequest(signedInRequest(), '/api/generate-report', verifyAs('farmer-9'), options);
    }
    const refused = await guardPaidApiRequest(signedInRequest(), '/api/generate-report', verifyAs('farmer-9'), options);
    assert.equal(refused.response?.status, 429);
    const body = await refused.response!.json();
    assert.doesNotMatch(body.error, /sample|sign in/i, 'they are signed in and not in the sample farm');
    assert.match(body.error, /wait/i, 'tell them what to do');
  });
});

test('the limiter is live while REQUIRE_API_AUTH is unset — that is the point of it', async () => {
  // Everything else in lib/api-auth.ts waits for the flag. This does not: today, with the guard
  // log-only, the rate limit is the ONLY thing between an anonymous caller and the model bills.
  await withRequireApiAuth(undefined, async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    const anonymous = () => new Request('https://example.test/api/paid', {
      headers: { 'x-forwarded-for': '192.0.2.44' },
    });

    for (let i = 0; i < ANONYMOUS_BUDGETS.ai.limit; i += 1) {
      const served = await guardPaidApiRequest(anonymous(), '/api/chat', neverVerifies, options);
      assert.equal(served.response, undefined, 'soft mode still serves anonymous callers');
      assert.equal(served.uid, null);
    }
    const refused = await guardPaidApiRequest(anonymous(), '/api/chat', neverVerifies, options);
    assert.equal(refused.response?.status, 429, 'soft mode must still stop a runaway loop');
  });
});

test('a 401 is decided before the budget, and does not consume it', async () => {
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    const bare = () => new Request('https://example.test/api/paid', { headers: { 'x-forwarded-for': '192.0.2.9' } });

    for (let i = 0; i < ANONYMOUS_BUDGETS.ai.limit * 3; i += 1) {
      const refused = await guardPaidApiRequest(bare(), '/api/chat', neverVerifies, options);
      assert.equal(refused.response?.status, 401, 'no token, not on the lane — always 401');
    }
    // The same address, now declaring itself a demo visitor, arrives with a full budget: refusing
    // a request costs nothing upstream, so it must not have been charged to anyone.
    const guest = await guardPaidApiRequest(sampleRequest('192.0.2.9'), '/api/chat', neverVerifies, options);
    assert.equal(guest.response, undefined, 'rejected requests must not spend a budget');
  });
});

test('an oversized body is reported as a 413, not degraded into a 429', async () => {
  await withRequireApiAuth('1', async () => {
    const limiter = new RateLimiter();
    const options = { limiter, now: T0 };
    const big = () => new Request('https://example.test/api/paid', {
      headers: { [SAMPLE_REQUEST_HEADER]: '1', 'x-forwarded-for': '192.0.2.77', 'content-length': String(50 * 1024 * 1024) },
    });
    for (let i = 0; i < ANONYMOUS_BUDGETS.ai.limit * 2; i += 1) {
      const refused = await guardPaidApiRequest(big(), '/api/chat', neverVerifies, options);
      assert.equal(refused.response?.status, 413, 'a client sending too much must keep being told so');
    }
  });
});

/* ── 4. Bounded memory ──────────────────────────────────────────────────────────────────────── */

test('an attacker cycling addresses cannot grow the limiter without bound', () => {
  const limiter = new RateLimiter(50);
  const budget = { limit: 5, windowMs: HOUR };
  for (let i = 0; i < 5000; i += 1) limiter.check(`ip:10.0.${i >> 8}.${i & 255}|ai`, budget, T0 + i);
  assert.ok(limiter.size <= 50, `the key map grew to ${limiter.size}`);
});

test('eviction takes the least recently seen key, not the busiest one', () => {
  const limiter = new RateLimiter(2);
  const budget = { limit: 2, windowMs: HOUR };

  limiter.check('busy', budget, T0);
  limiter.check('idle', budget, T0 + 1);
  limiter.check('busy', budget, T0 + 2); // busy is now the most recently touched
  limiter.check('newcomer', budget, T0 + 3); // evicts 'idle', the least recently touched

  assert.equal(limiter.check('busy', budget, T0 + 4).allowed, false, 'the busy caller kept its count');
  assert.equal(limiter.check('idle', budget, T0 + 5).allowed, true, 'the idle caller was forgotten, as designed');
});

/* ── The address the count is keyed on ──────────────────────────────────────────────────────── */

test('the client address is the first entry of x-forwarded-for', () => {
  const req = new Request('https://example.test/api/paid', {
    headers: { 'x-forwarded-for': '41.1.2.3, 10.0.0.1, 10.0.0.2' },
  });
  assert.equal(clientIp(req), '41.1.2.3', 'the client is first; the rest are proxies');

  const realIp = new Request('https://example.test/api/paid', { headers: { 'x-real-ip': '41.9.9.9' } });
  assert.equal(clientIp(realIp), '41.9.9.9');

  // No header at all: one shared bucket rather than a free pass. Vercel always sets the header, so
  // this is the local/unknown case, and erring towards counting is the right default for a limiter.
  assert.equal(clientIp(new Request('https://example.test/api/paid')), 'unknown-ip');
});

/* ── The message itself ─────────────────────────────────────────────────────────────────────── */

test('the wait is expressed in plain minutes, singular and plural', async () => {
  const base = { budget: { limit: 1, windowMs: HOUR }, costClass: 'ai' as const, key: 'k' };
  const oneMinute = rateLimitedResponse(
    { ...base, verdict: { allowed: false, remaining: 0, retryAfterSeconds: 30 } }, 'user',
  );
  assert.match((await oneMinute.json()).error, /about a minute/);

  const many = rateLimitedResponse(
    { ...base, verdict: { allowed: false, remaining: 0, retryAfterSeconds: 20 * 60 } }, 'user',
  );
  assert.match((await many.json()).error, /about 20 minutes/);
});

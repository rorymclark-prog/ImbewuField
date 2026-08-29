/*
 * THE SAMPLE FARM MUST SURVIVE THE FLIP, AND REAL FARMER DATA MUST NOT.
 *
 * Two facts about this app pull in opposite directions. Sample mode (lib/sample-mode.ts) is how
 * ImbewuField is SHOWN — to funders, to NGOs, to a farmer who has not signed up — and it works
 * with no Firebase account at all, so its requests carry no ID token. And lib/api-auth.ts has a
 * switch, REQUIRE_API_AUTH, that turns nineteen paid routes from log-only into 401-or-nothing.
 * Throw that switch as it stood and the demo becomes a screen of dead buttons: every AI feature in
 * the sample farm 401s, silently, for everyone who is not signed in.
 *
 * The guest lane is the answer, and it is a small hole cut on purpose. This file is the fence
 * around it. It asserts the three properties that make the hole safe rather than merely small:
 *
 *   1. A declared sample request reaches the DEMO routes with no token, even in hard mode.
 *   2. A declared sample request reaches NOTHING ELSE. network/farmers — which serves real
 *      farmers' consent-projected production and sales figures — refuses it, and so does every
 *      other guarded route that nobody put on the list.
 *   3. The default for an unlisted route is REFUSAL. This is the property that survives the people
 *      who wrote it: the allowlist is a pick, so a route added next year is outside the lane until
 *      somebody decides otherwise, and the cost of forgetting is a demo button that 401s rather
 *      than a data endpoint that opened itself.
 *
 * The header that declares sample mode is forgeable — anyone can send it with curl, and there is
 * no server-side sample session to check it against. That is stated in lib/api-auth.ts and it is
 * not a defect to be fixed here: the lane's protection is this allowlist plus the per-address
 * budget in lib/api-rate-limit.ts (tests/api-rate-limit.test.ts). What this file guarantees is that
 * forging the header buys a demo and nothing else.
 *
 * Uses the injectable-verifier seam from tests/api-auth.test.ts, so nothing here touches the
 * network or firebase-admin.
 */

import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  GUEST_LANE_ROUTES,
  SAMPLE_REQUEST_HEADER,
  authenticateApiRequest,
  declaresSampleMode,
  guardPaidApiRequest,
  guestLaneAdmits,
} from '@/lib/api-auth';
import { RateLimiter } from '@/lib/api-rate-limit';

const ROOT = join(import.meta.dirname, '..');

let originalWarn: typeof console.warn;
before(() => {
  // Every refused request logs. This suite manufactures dozens on purpose.
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

/** A request from the sample farm: the declaration header, no Authorization, its own address. */
function sampleRequest(ip = '203.0.113.10'): Request {
  return new Request('https://example.test/api/paid', {
    headers: { [SAMPLE_REQUEST_HEADER]: '1', 'x-forwarded-for': ip },
  });
}

const throwIfCalled: () => Promise<{ uid: string }> = async () => {
  throw new Error('verifyToken must not be called when there is no bearer token to verify');
};

/** A private limiter per test, so budget exhaustion in one case cannot leak into another. */
function freshOptions() {
  return { limiter: new RateLimiter(), now: Date.UTC(2026, 7, 29, 9, 0, 0) };
}

/* ── 1. The lane is open where it should be ─────────────────────────────────────────────────── */

for (const route of [...GUEST_LANE_ROUTES]) {
  test(`hard mode: a sample-mode request with no token reaches /api/${route}`, async () => {
    await withRequireApiAuth('1', async () => {
      const result = await guardPaidApiRequest(
        sampleRequest(), `/api/${route}`, throwIfCalled, freshOptions(),
      );
      assert.equal(
        result.response,
        undefined,
        `the sample farm's ${route} feature would 401 the moment REQUIRE_API_AUTH is set`,
      );
      assert.equal(result.uid, null, 'the lane must never invent an identity');
      assert.equal(result.guest, true, 'the request must be MARKED as a guest, not merely allowed');
    });
  });
}

test('the lane is open under both spellings of the flag, and while it is unset', async () => {
  for (const flag of [undefined, '1', 'true']) {
    await withRequireApiAuth(flag, async () => {
      const result = await guardPaidApiRequest(
        sampleRequest(), '/api/chat', throwIfCalled, freshOptions(),
      );
      assert.equal(result.response, undefined, `REQUIRE_API_AUTH=${flag ?? 'unset'}`);
      assert.equal(result.guest, true, `REQUIRE_API_AUTH=${flag ?? 'unset'}`);
    });
  }
});

test('a route name spelled with or without the /api/ prefix is the same route', () => {
  // guardPaidApiRequest is called as '/api/chat' by most routes and as 'network/farmers' by the
  // portfolio ones. A lane that only recognised one spelling would be a lane with a hole in it.
  for (const spelling of ['/api/chat', 'api/chat', 'chat', '/api/chat/']) {
    assert.equal(guestLaneAdmits(sampleRequest(), spelling), true, spelling);
  }
});

/* ── 2. The lane is shut where it must be ───────────────────────────────────────────────────── */

test('hard mode: a sample-mode request to network/farmers is refused with 401', async () => {
  await withRequireApiAuth('1', async () => {
    const result = await guardPaidApiRequest(
      sampleRequest(), 'network/farmers', throwIfCalled, freshOptions(),
    );
    assert.ok(result.response, 'the header must not open the route that serves real farmer data');
    assert.equal(result.response.status, 401);
    assert.equal(result.uid, null);
    assert.notEqual(result.guest, true, 'a refused caller must not be marked as an admitted guest');
    const body = await result.response.json();
    assert.equal(typeof body.error, 'string');
  });
});

test('hard mode: neither network route is admitted, under any spelling', async () => {
  await withRequireApiAuth('1', async () => {
    for (const route of ['network/farmers', 'network/orgs', '/api/network/farmers', '/api/network/orgs']) {
      const result = await guardPaidApiRequest(sampleRequest(), route, throwIfCalled, freshOptions());
      assert.equal(result.response?.status, 401, route);
    }
  });
});

test('the allowlist names no route that reads stored data', () => {
  // The structural half of the property above: a future maintainer could add a data-bearing route
  // to the list, and the 401 test would then be asserting the wrong thing. A route that reaches
  // Firestore imports firebase-admin or goes through resolveNetworkCaller — neither belongs in a
  // lane whose callers have no identity.
  for (const route of GUEST_LANE_ROUTES) {
    const src = readFileSync(join(ROOT, 'app', 'api', route, 'route.ts'), 'utf8');
    assert.doesNotMatch(
      src, /firebase-admin|resolveNetworkCaller|getFirestore/,
      `/api/${route} reads stored data — it cannot be on a lane for callers with no identity`,
    );
  }
});

test('every allowlisted name is a route that actually exists', () => {
  // A typo here does not break a build or a type: it silently closes the lane for that feature,
  // and the symptom (one demo button 401s after the flip) is exactly the thing nobody notices.
  for (const route of GUEST_LANE_ROUTES) {
    assert.ok(
      existsSync(join(ROOT, 'app', 'api', route, 'route.ts')),
      `no route handler at app/api/${route}/route.ts — the lane names a route that does not exist`,
    );
  }
});

/* ── 3. Unlisted is refused — the default that outlives us ──────────────────────────────────── */

/** Route names under app/api whose handler calls the paid guard, normalised as the lane sees them. */
function guardedRoutes(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/route\.tsx?$/.test(p)) {
        const src = readFileSync(p, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/(^|[^:])\/\/.*$/gm, '$1');
        if (/\b(guardPaidApiRequest|authenticateApiRequest|resolveNetworkCaller)\s*\(/.test(src)) {
          out.push(relative(join(ROOT, 'app', 'api'), p).replace(/[/\\]route\.tsx?$/, '').replace(/\\/g, '/'));
        }
      }
    }
  };
  walk(join(ROOT, 'app', 'api'));
  return out.sort();
}

test('hard mode: every guarded route NOT on the list refuses a sample-mode request', async () => {
  const unlisted = guardedRoutes().filter((r) => !GUEST_LANE_ROUTES.has(r));
  assert.ok(unlisted.length > 0, 'found no unlisted guarded routes — the scanner is broken');

  await withRequireApiAuth('1', async () => {
    for (const route of unlisted) {
      const result = await guardPaidApiRequest(
        sampleRequest(), `/api/${route}`, throwIfCalled, freshOptions(),
      );
      assert.equal(
        result.response?.status, 401,
        `/api/${route} is not on the guest lane but admitted an unauthenticated sample request`,
      );
    }
  });
});

test('the routes deliberately left off the list are still off it', () => {
  // Not a mechanical check — a record of decisions, so removing one is deliberate. The image
  // routes are the most expensive calls in the app and the sample farm already refuses them
  // (lib/render-jobs.ts); the rest have no client call site at all.
  for (const route of [
    'image-producer', 'ai-render', 'ai-render/poll',
    'auto-design', 'design-detect', 'design-review', 'suggest-zones-ai', 'tree-id',
    'network/farmers', 'network/orgs',
  ]) {
    assert.equal(GUEST_LANE_ROUTES.has(route), false, `${route} was added to the guest lane`);
  }
});

test('a route nobody has decided about is outside the lane', () => {
  assert.equal(guestLaneAdmits(sampleRequest(), '/api/some-route-invented-in-2027'), false);
});

/* ── The header itself ──────────────────────────────────────────────────────────────────────── */

test('only the exact declaration opens the lane', () => {
  for (const value of ['0', 'true', 'yes', '', '11', '1,1']) {
    const req = new Request('https://example.test/api/paid', { headers: { [SAMPLE_REQUEST_HEADER]: value } });
    assert.equal(declaresSampleMode(req), false, `"${value}" must not be read as a declaration`);
  }
  assert.equal(declaresSampleMode(sampleRequest()), true);

  // Surrounding whitespace IS a declaration, and not because this code trims it: the Headers
  // implementation strips optional whitespace before the value is ever read, per RFC 9110. Worth
  // pinning — a future exact-match check written against the raw string would behave differently.
  for (const padded of [' 1', '1 ', '  1  ']) {
    const req = new Request('https://example.test/api/paid', { headers: { [SAMPLE_REQUEST_HEADER]: padded } });
    assert.equal(declaresSampleMode(req), true, `"${padded}" arrives trimmed`);
  }
});

test('hard mode: no header at all is still a 401 on a lane route', async () => {
  await withRequireApiAuth('1', async () => {
    const bare = new Request('https://example.test/api/paid', { headers: { 'x-forwarded-for': '198.51.100.7' } });
    const result = await guardPaidApiRequest(bare, '/api/chat', throwIfCalled, freshOptions());
    assert.equal(result.response?.status, 401, 'the lane must require the declaration, not merely the route');
  });
});

test('a valid token still wins on a lane route, and is not downgraded to a guest', async () => {
  await withRequireApiAuth('1', async () => {
    const req = new Request('https://example.test/api/paid', {
      headers: { authorization: 'Bearer good-token', [SAMPLE_REQUEST_HEADER]: '1' },
    });
    const result = await guardPaidApiRequest(req, '/api/chat', async () => ({ uid: 'farmer-42' }), freshOptions());
    assert.equal(result.uid, 'farmer-42');
    assert.equal(result.guest, undefined, 'a signed-in farmer must be counted as a farmer, not as a demo visitor');
  });
});

test('the client sends the declaration exactly when there is no user and sample mode is on', () => {
  // The server half is worthless if the browser never sends the header. lib/api-client-auth.ts is
  // a client module (it reaches for window and Firebase), so this is asserted against its source —
  // the same technique, and the same reason, as tests/paid-api-auth-wiring.test.ts.
  const src = readFileSync(join(ROOT, 'lib', 'api-client-auth.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  assert.match(src, /isSampleMode\(\)/, 'the helper must ask whether sample mode is on');
  assert.match(
    src, /\[SAMPLE_REQUEST_HEADER\]/,
    'the header name must come from lib/api-auth-shared, never be spelled out a second time',
  );
  assert.match(
    src, /if\s*\(!user\)\s*return\s*isSampleMode\(\)/,
    'the sample branch must be inside the no-user branch: a signed-in farmer sends their token',
  );
  assert.match(src, /Authorization/, 'the signed-in path must still send a bearer token');
});

test('the header name is defined once, in a module the browser can import', async () => {
  // lib/api-auth.ts imports firebase-admin. If the client imported the constant from there, the
  // Admin SDK would be dragged into the browser bundle — a build failure at best.
  const shared = await import('@/lib/api-auth-shared');
  assert.equal(shared.SAMPLE_REQUEST_HEADER, SAMPLE_REQUEST_HEADER);

  const sharedSrc = readFileSync(join(ROOT, 'lib', 'api-auth-shared.ts'), 'utf8');
  assert.doesNotMatch(sharedSrc, /^\s*import\s/m, 'the shared module must import nothing');

  const clientSrc = readFileSync(join(ROOT, 'lib', 'api-client-auth.ts'), 'utf8');
  assert.doesNotMatch(
    clientSrc, /from\s+'@\/lib\/api-auth'/,
    'the client must not import the server guard — it would pull firebase-admin into the bundle',
  );
});

/* ── The lane does not disturb what came before it ──────────────────────────────────────────── */

test('soft mode: an ordinary anonymous request is unchanged — no guest mark, no response', async () => {
  await withRequireApiAuth(undefined, async () => {
    const bare = new Request('https://example.test/api/paid');
    const result = await authenticateApiRequest(bare, '/api/chat', throwIfCalled);
    assert.deepEqual(result, { uid: null }, 'soft-mode behaviour must be byte-identical to before');
  });
});

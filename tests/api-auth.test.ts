import assert from 'node:assert/strict';
import test, { after, before } from 'node:test';

import {
  authenticateApiRequest,
  guardPaidApiRequest,
  MAX_API_BODY_BYTES,
  oversizedApiBodyResponse,
} from '@/lib/api-auth';

// NINETEEN ROUTES SPEND REAL MONEY ON AN UPSTREAM MODEL (Anthropic, OpenAI, Gemini), AND UNTIL
// THIS GUARD EXISTED THEY ACCEPTED ANY REQUEST THAT REACHED THEM — NO CALLER IDENTITY, NO BODY
// SIZE CEILING.
//
// The guard is deliberately built as TWO modes, not one:
//   - soft (REQUIRE_API_AUTH unset): every failure is logged and the request proceeds anyway
//     (`{ uid: null }`, no Response) — this is what lets the owner smoke-test the cutover on the
//     live routes without a farmer getting a 401 mid-design.
//   - hard (REQUIRE_API_AUTH="1" or "true"): the same failures return a real Response the route
//     must act on.
//
// That switch is the whole point of the file. A change that makes the guard hard-fail even when
// REQUIRE_API_AUTH is unset would turn on paid-API auth for every farmer with no warning. A change
// that makes REQUIRE_API_AUTH stop being honoured (e.g. hard-coding one mode, or reading the env
// var once at import time instead of per-request) would make the flag a no-op — the cutover the
// owner thinks he is controlling would already have happened, or would silently never happen. Both
// are the specific failure this file exists to catch, so every case below is asserted in BOTH
// modes wherever it can differ.
//
// `authenticateApiRequest` takes an injectable `verifyToken`, so none of this touches the network
// or firebase-admin — every test below supplies its own verifier.

let originalWarn: typeof console.warn;

before(() => {
  // Every unauthenticated request logs via console.warn (see logUnauthenticated in
  // lib/api-auth.ts). That is correct production behaviour, but this suite deliberately manufactures
  // dozens of unauthenticated requests, so silence it here rather than let real failures get lost
  // in a wall of expected warnings.
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

function requestWithHeaders(headers: Record<string, string>): Request {
  return new Request('https://example.test/api/paid', { headers });
}

const throwIfCalled: () => Promise<{ uid: string }> = async () => {
  throw new Error('verifyToken must not be called when there is no bearer token to verify');
};

test('AI tester access comes only from an explicit verified custom claim', async () => {
  const req = requestWithHeaders({ authorization: 'Bearer signed-token', 'x-ai-render-tester': 'true' });
  const approved = await authenticateApiRequest(req, '/api/ai-render', async () => ({ uid: 'tester', aiRenderTester: true }));
  assert.equal(approved.aiRenderTester, true);
  for (const value of [undefined, false, 'true', 1, { enabled: true }]) {
    const result = await authenticateApiRequest(req, '/api/ai-render', async () => ({ uid: 'farmer', aiRenderTester: value }));
    assert.equal(result.aiRenderTester, undefined, 'headers and truthy claim values must not grant access');
  }
});

// ── Soft mode: REQUIRE_API_AUTH unset ─────────────────────────────────────────

test('soft mode: a request with no Authorization header proceeds unauthenticated', async () => {
  await withRequireApiAuth(undefined, async () => {
    const result = await authenticateApiRequest(requestWithHeaders({}), '/api/paid', throwIfCalled);
    assert.deepEqual(result, { uid: null });
  });
});

test('soft mode: a malformed Authorization header proceeds unauthenticated', async () => {
  await withRequireApiAuth(undefined, async () => {
    for (const header of ['Basic dXNlcjpwYXNz', 'Bearer', 'Bearer   ', 'just-a-token', '']) {
      const result = await authenticateApiRequest(
        requestWithHeaders({ authorization: header }),
        '/api/paid',
        throwIfCalled,
      );
      assert.deepEqual(result, { uid: null }, header);
    }
  });
});

test('soft mode: a verifier that throws (expired or forged token) proceeds unauthenticated', async () => {
  await withRequireApiAuth(undefined, async () => {
    const req = requestWithHeaders({ authorization: 'Bearer bad-token' });
    const result = await authenticateApiRequest(req, '/api/paid', async () => {
      throw new Error('token expired');
    });
    assert.deepEqual(result, { uid: null });
  });
});

test('soft mode: a verifier that resolves without a uid proceeds unauthenticated', async () => {
  await withRequireApiAuth(undefined, async () => {
    const req = requestWithHeaders({ authorization: 'Bearer weird-token' });
    const result = await authenticateApiRequest(req, '/api/paid', async () => ({ uid: '' }));
    assert.deepEqual(result, { uid: null });
  });
});

// ── Hard mode: REQUIRE_API_AUTH="1" and REQUIRE_API_AUTH="true" ──────────────
// Both flag spellings are exercised because hardAuthRequired() checks them as two separate string
// equalities — a typo in either one would silently reopen the soft-mode hole for whichever route or
// deploy config uses that spelling.

for (const flag of ['1', 'true']) {
  test(`hard mode (REQUIRE_API_AUTH=${flag}): a missing Authorization header is rejected with 401`, async () => {
    await withRequireApiAuth(flag, async () => {
      const result = await authenticateApiRequest(requestWithHeaders({}), '/api/paid', throwIfCalled);
      assert.equal(result.uid, null);
      assert.ok(result.response, 'a Response must be returned so the route stops processing');
      assert.equal(result.response.status, 401);
      assert.match(result.response.headers.get('content-type') ?? '', /application\/json/);
      const body = await result.response.json();
      assert.equal(typeof body.error, 'string');
      assert.ok(body.error.length > 0);
    });
  });

  test(`hard mode (REQUIRE_API_AUTH=${flag}): a malformed Authorization header is rejected with 401`, async () => {
    await withRequireApiAuth(flag, async () => {
      const req = requestWithHeaders({ authorization: 'Basic dXNlcjpwYXNz' });
      const result = await authenticateApiRequest(req, '/api/paid', throwIfCalled);
      assert.equal(result.uid, null);
      assert.equal(result.response?.status, 401);
    });
  });

  test(`hard mode (REQUIRE_API_AUTH=${flag}): a verifier that throws is rejected with 401`, async () => {
    await withRequireApiAuth(flag, async () => {
      const req = requestWithHeaders({ authorization: 'Bearer bad-token' });
      const result = await authenticateApiRequest(req, '/api/paid', async () => {
        throw new Error('token expired');
      });
      assert.equal(result.uid, null);
      assert.equal(result.response?.status, 401);
    });
  });

  test(`hard mode (REQUIRE_API_AUTH=${flag}): a verifier that resolves without a uid is rejected with 401`, async () => {
    await withRequireApiAuth(flag, async () => {
      const req = requestWithHeaders({ authorization: 'Bearer weird-token' });
      const result = await authenticateApiRequest(req, '/api/paid', async () => ({ uid: '' }));
      assert.equal(result.uid, null);
      assert.equal(result.response?.status, 401);
    });
  });
}

// ── A valid token wins in every mode ──────────────────────────────────────────

for (const flag of [undefined, '1', 'true']) {
  test(`a valid bearer token returns the verified uid with no response (REQUIRE_API_AUTH=${flag ?? 'unset'})`, async () => {
    await withRequireApiAuth(flag, async () => {
      const req = requestWithHeaders({ authorization: 'Bearer good-token' });
      const result = await authenticateApiRequest(req, '/api/paid', async (token) => {
        assert.equal(token, 'good-token');
        return { uid: 'farmer-42' };
      });
      assert.deepEqual(result, { uid: 'farmer-42' });
    });
  });
}

// ── The Bearer regex ──────────────────────────────────────────────────────────

test('the Bearer scheme match is case-insensitive', async () => {
  await withRequireApiAuth(undefined, async () => {
    for (const scheme of ['Bearer', 'bearer', 'BEARER', 'BeArEr']) {
      const req = requestWithHeaders({ authorization: `${scheme} tok-1` });
      const result = await authenticateApiRequest(req, '/api/paid', async (token) => {
        assert.equal(token, 'tok-1', scheme);
        return { uid: 'u' };
      });
      assert.equal(result.uid, 'u', scheme);
    }
  });
});

test('surrounding whitespace around the header value and around the scheme separator is tolerated', async () => {
  await withRequireApiAuth(undefined, async () => {
    const req = requestWithHeaders({ authorization: '   Bearer   tok-2   ' });
    const result = await authenticateApiRequest(req, '/api/paid', async (token) => {
      assert.equal(token, 'tok-2', 'no leading or trailing whitespace should survive into the token');
      return { uid: 'u' };
    });
    assert.equal(result.uid, 'u');
  });
});

test('a bearer token containing dots (a JWT) or internal spaces survives intact, not truncated at the first space', async () => {
  await withRequireApiAuth(undefined, async () => {
    // JWTs are three dot-separated segments — the most common real-world shape this regex must
    // pass through whole.
    const jwt = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmYXJtZXItNDIifQ.c2lnbmF0dXJlLWJ5dGVz';
    const jwtReq = requestWithHeaders({ authorization: `Bearer ${jwt}` });
    const jwtResult = await authenticateApiRequest(jwtReq, '/api/paid', async (token) => {
      assert.equal(token, jwt);
      return { uid: 'u1' };
    });
    assert.equal(jwtResult.uid, 'u1');

    // The capture group is `(.+)$`, greedy to end-of-string — not `(\S+)`, which would stop at the
    // first internal space and silently truncate any token shaped like this.
    const spaced = 'part-one part-two.part-three';
    const spacedReq = requestWithHeaders({ authorization: `Bearer ${spaced}` });
    const spacedResult = await authenticateApiRequest(spacedReq, '/api/paid', async (token) => {
      assert.equal(token, spaced);
      return { uid: 'u2' };
    });
    assert.equal(spacedResult.uid, 'u2');
  });
});

// ── oversizedApiBodyResponse ───────────────────────────────────────────────────

test('a body under the limit is allowed through', () => {
  const req = requestWithHeaders({ 'content-length': String(MAX_API_BODY_BYTES - 1) });
  assert.equal(oversizedApiBodyResponse(req, '/api/paid'), undefined);
});

test('a body exactly at the limit is allowed through', () => {
  // The check in lib/api-auth.ts is `contentLength > MAX_API_BODY_BYTES`, strictly greater-than, so
  // the exact ceiling itself must not be rejected.
  const req = requestWithHeaders({ 'content-length': String(MAX_API_BODY_BYTES) });
  assert.equal(oversizedApiBodyResponse(req, '/api/paid'), undefined);
});

test('a body one byte over the limit is rejected with 413', async () => {
  const req = requestWithHeaders({ 'content-length': String(MAX_API_BODY_BYTES + 1) });
  const response = oversizedApiBodyResponse(req, '/api/paid');
  assert.ok(response);
  assert.equal(response.status, 413);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.length > 0);
});

test('a missing, unparseable or negative content-length never triggers a 413', () => {
  // The route's own body read enforces the real ceiling once bytes actually arrive — this check is
  // only a fast pre-flight reject, so an absent or nonsensical header must fail OPEN here, not
  // closed, or every request without a content-length would be wrongly rejected.
  for (const contentLength of [undefined, 'not-a-number', '-100', '-1', 'NaN', '']) {
    const headers: Record<string, string> = contentLength === undefined ? {} : { 'content-length': contentLength };
    const req = requestWithHeaders(headers);
    assert.equal(oversizedApiBodyResponse(req, '/api/paid'), undefined, String(contentLength));
  }
});

// ── guardPaidApiRequest: auth and size composed ───────────────────────────────

test('guardPaidApiRequest: auth failure takes precedence over an oversized body', async () => {
  await withRequireApiAuth('1', async () => {
    // No Authorization header AND an oversized content-length: if size were checked first, or if
    // the two checks disagreed about which failure to report, a caller could not tell an
    // unauthenticated request from a too-big one.
    const req = requestWithHeaders({ 'content-length': String(MAX_API_BODY_BYTES + 1) });
    const result = await guardPaidApiRequest(req, '/api/paid', throwIfCalled);
    assert.equal(result.uid, null);
    assert.equal(result.response?.status, 401, 'the auth failure must be reported, not the 413');
  });
});

test('guardPaidApiRequest: an oversized body with a valid token returns 413 but still reports the uid', async () => {
  await withRequireApiAuth(undefined, async () => {
    const req = requestWithHeaders({
      authorization: 'Bearer good-token',
      'content-length': String(MAX_API_BODY_BYTES + 1),
    });
    const result = await guardPaidApiRequest(req, '/api/paid', async () => ({ uid: 'farmer-42' }));
    assert.equal(result.response?.status, 413);
    assert.equal(result.uid, 'farmer-42', 'the caller identity is not thrown away just because the request is rejected');
  });
});

test('guardPaidApiRequest: a valid token and a body under the limit pass through with no response', async () => {
  await withRequireApiAuth(undefined, async () => {
    const req = requestWithHeaders({ authorization: 'Bearer good-token', 'content-length': '100' });
    const result = await guardPaidApiRequest(req, '/api/paid', async () => ({ uid: 'farmer-42' }));
    assert.deepEqual(result, { uid: 'farmer-42' });
  });
});

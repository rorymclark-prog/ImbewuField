import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { decideAiRenderAccess, readAiRenderTesterAccess } from '@/lib/ai-render/access';

// AI MAP GENERATION MUST BE OFF UNLESS SOMEBODY TURNED IT ON.
//
// /api/ai-render and /api/image-producer submit new billed image work. Polling an already-created
// request is retrieval, so switching off new work must not strand an image already paid for.
// The failure this guards is the
// one already in this repo's history (see the paid-render-gate suite, and the open
// paid routes found in the API-auth audit): a real, correct guard that was simply
// never in force in production because the variable enabling it was unset.
//
// So the polarity is the assertion. An unset NEXT_PUBLIC_AI_RENDER_ENABLED must
// mean OFF — a missing variable can then only ever cost nothing — and each route
// must refuse BEFORE it authenticates, parses a body, or reads a vendor key.

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const ROUTES = [
  'app/api/ai-render/route.ts',
  'app/api/image-producer/route.ts',
];

test('the flag is off unless the variable is exactly "true"', async () => {
  const { aiRenderEnabled } = await import('@/lib/ai-render/flag');
  const original = process.env.NEXT_PUBLIC_AI_RENDER_ENABLED;
  try {
    for (const v of [undefined, '', 'false', 'TRUE', '1', 'yes', 'on']) {
      if (v === undefined) delete process.env.NEXT_PUBLIC_AI_RENDER_ENABLED;
      else process.env.NEXT_PUBLIC_AI_RENDER_ENABLED = v;
      assert.equal(
        aiRenderEnabled(),
        false,
        `NEXT_PUBLIC_AI_RENDER_ENABLED=${JSON.stringify(v)} must not enable paid rendering`,
      );
    }
    process.env.NEXT_PUBLIC_AI_RENDER_ENABLED = 'true';
    assert.equal(aiRenderEnabled(), true, 'the one value that turns it on must turn it on');
  } finally {
    if (original === undefined) delete process.env.NEXT_PUBLIC_AI_RENDER_ENABLED;
    else process.env.NEXT_PUBLIC_AI_RENDER_ENABLED = original;
  }
});

for (const route of ROUTES) {
  test(`${route} refuses before it spends anything`, () => {
    const src = read(route);

    const post = src.indexOf('export async function POST(');
    assert.notEqual(post, -1, `${route} has no POST handler — this test needs updating, not deleting`);

    const gate = src.indexOf('aiRenderEnabled()', post);
    assert.notEqual(gate, -1, `${route} does not consult the AI-render kill switch`);

    // The gate has to come first. Every one of these is a way to spend money or
    // leak a credential, and each must sit AFTER the refusal.
    const mustFollow: Array<[string, string]> = [
      ['guardPaidApiRequest', 'authentication'],
      ['await req.json()', 'body parsing'],
      ['process.env.FAL_KEY', 'the fal credential'],
      ['process.env.OPENAI_API_KEY', 'the OpenAI credential'],
      ['process.env.GEMINI_API_KEY', 'the Gemini credential'],
      ['process.env.GOOGLE_API_KEY', 'the Google credential'],
    ];
    for (const [needle, what] of mustFollow) {
      const at = src.indexOf(needle, post);
      if (at === -1) continue; // this route does not use it at all
      assert.ok(at > gate, `${route} reaches ${what} before checking the kill switch`);
    }
  });
}

test('experimental map access is denied without an explicit trusted account grant', () => {
  for (const claims of [undefined, null, {}, { aiRenderTester: false }, { aiRenderTester: 'true' }, { role: 'admin' }, { role: 'owner' }, { rolloutPercent: 1 }]) {
    assert.equal(decideAiRenderAccess('farmer-1', claims).allowed, false);
  }
  assert.equal(decideAiRenderAccess(null, { aiRenderTester: true }).allowed, false);
  assert.equal(decideAiRenderAccess('farmer-1', { aiRenderTester: true }).allowed, true);
});

test('worker access uses current trusted claims and fails closed on revoked or unavailable accounts', async () => {
  const calls: string[] = [];
  const approved = await readAiRenderTesterAccess('tester-1', async (uid) => {
    calls.push(uid);
    return { aiRenderTester: true };
  });
  assert.equal(approved.allowed, true);
  const revoked = await readAiRenderTesterAccess('tester-1', async () => ({}));
  assert.equal(revoked.allowed, false, 'the previous approval must not be cached');
  const unavailable = await readAiRenderTesterAccess('tester-1', async () => { throw new Error('Auth unavailable'); });
  assert.equal(unavailable.allowed, false);
  assert.equal(unavailable.reason, 'unavailable');
  const anonymous = await readAiRenderTesterAccess(null, async () => { throw new Error('must not look up a missing UID'); });
  assert.equal(anonymous.reason, 'sign-in-required');
  assert.deepEqual(calls, ['tester-1']);
});

test('every image-generation endpoint enforces the verified grant before body or vendor handling', () => {
  for (const route of ROUTES) {
    const src = read(route);
    const post = src.indexOf('export async function POST(');
    const handler = src.slice(post);
    const gate = handler.indexOf('decideAiRenderAccess(auth.uid, auth)');
    assert.ok(gate >= 0, `${route} must use verified auth, not request data or a role`);
    assert.match(handler, /if \(!access\.allowed\)/);
    for (const needle of ['await req.json()', 'process.env.FAL_KEY', 'process.env.OPENAI_API_KEY', 'process.env.GEMINI_API_KEY']) {
      const position = handler.indexOf(needle);
      if (position >= 0) assert.ok(position > gate, `${route} reaches ${needle} before checking tester access`);
    }
  }
});

test('the worker rejects unapproved jobs before reserving quota, including owner jobs', () => {
  const src = read('functions/src/index.ts');
  const claim = src.slice(src.indexOf('async function claimJob('), src.indexOf('export const runRenderJob'));
  const gate = claim.indexOf('readAiRenderTesterAccess(job.uid');
  assert.ok(gate >= 0);
  assert.match(claim, /getAuth\(\)\.getUser\(uid\)/);
  assert.match(claim, /account\.disabled \? null : account\.customClaims/,
    'a disabled Auth account must lose rendering even if its old claim remains true');
  assert.match(claim, /if \(!access\.allowed\)/);
  assert.ok(gate < claim.indexOf('const usageRef'), 'unapproved users must not consume usage counters');
  assert.ok(gate < claim.indexOf('const isOwner'), 'the old owner budget exemption must not grant access');
});

test('the access endpoint returns only a noncached decision for the verified caller', () => {
  const src = read('app/api/ai-render/access/route.ts');
  assert.match(src, /authenticateApiRequest/);
  assert.match(src, /decideAiRenderAccess\(auth\.uid, auth\)/);
  assert.match(src, /private, no-store/);
  assert.doesNotMatch(src, /getFirestore|profiles|Math\.random|localStorage/);
});

test('previously submitted images remain retrievable after tester access is removed', () => {
  const src = read('app/api/ai-render/poll/route.ts');
  assert.doesNotMatch(src, /aiRenderEnabled\(|decideAiRenderAccess\(/);
  assert.match(src, /guardPaidApiRequest/);
  assert.match(src, /isFalQueueUrl/);
});

test('the Design Studio controls are driven by the same switch', () => {
  const src = read('components/design/DesignGlossy.tsx');

  assert.match(
    src,
    /import \{ aiRenderEnabled \} from '@\/lib\/ai-render\/flag'/,
    'DesignGlossy no longer imports the kill switch',
  );

  // Every derived "we are in an AI mode" boolean must carry the flag, or a control
  // that starts a paid render stays on screen while the route refuses it — the dead
  // control this repo already has a suite about.
  for (const name of ['restyleAiKind', 'phasingAiMode', 'aiLayerMode']) {
    const at = src.indexOf(`const ${name}`);
    assert.notEqual(at, -1, `${name} is gone — this test needs updating, not deleting`);
    const decl = src.slice(at, src.indexOf(';', at));
    assert.ok(
      decl.includes('aiRenderOn'),
      `${name} does not depend on the kill switch, so its AI controls would survive it being off`,
    );
  }

  // And the screen must not OPEN in AI mode when the switch is off.
  assert.match(
    src,
    /useState<'ai' \| 'exact'>\(aiRenderOn \? 'ai' : 'exact'\)/,
    'the initial render mode ignores the kill switch',
  );

  const accessStart = src.indexOf('const aiRenderOn =');
  const access = src.slice(accessStart, src.indexOf(';', accessStart));
  assert.match(access, /approvedRenderUid === renderUser\.uid/,
    'a previous account approval must not enable the next signed-in account');
  assert.match(access, /!isSampleMode\(\)/);
  assert.match(src, /\{aiRenderOn && selectedSheet && enginePicker\}/);
  assert.match(src, /\{aiRenderOn && selectedSheet && qualityPicker\}/);
  assert.match(src, /\{aiRenderOn && \(<button/,
    'the paid finish button must be hidden for ordinary users');
  assert.match(src, /\{aiRenderOn && fullTreatmentVisible && \(/,
    'the developer finish toggle must not bypass tester approval');
});

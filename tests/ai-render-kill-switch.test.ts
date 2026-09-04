import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// AI MAP GENERATION MUST BE OFF UNLESS SOMEBODY TURNED IT ON.
//
// /api/ai-render, /api/ai-render/poll and /api/image-producer are the three calls
// in this app that bill a vendor account per image. The failure this guards is the
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
  'app/api/ai-render/poll/route.ts',
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
});

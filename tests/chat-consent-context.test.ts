/*
 * LIMA HAS TO KNOW THE SHARING SWITCHES EXIST.
 *
 * The bug class this repo has hit before: a shipped feature the system prompt never names is
 * invisible to the assistant. Per-scope consent shipped with its own farmer-facing screen — six
 * switches deciding what an NGO or funder may see — and app/api/chat/route.ts's SYSTEM prompt
 * enumerated location, site, water, reports, production, sales and project, and stopped there. So
 * a farmer typing "does my NGO see my income?" — a question about the newest privacy-relevant
 * thing in the app, and one they are entitled to a straight answer to — got an ungrounded one.
 *
 * TWO HALVES, AND EITHER ALONE IS WORSE THAN NEITHER:
 *   • The prompt must describe the system, so Lima can explain it and point at the Account screen.
 *   • The context must carry THIS farmer's OWN switches, so the answer is theirs and not a
 *     plausible-sounding average. Nobody else's consent may ever enter this payload.
 *
 * And the absent case is deliberate: sample mode, an offline device and a farmer who has never
 * opened the sharing screen all read back null, and null must stay null all the way to the model,
 * which is told to say it cannot see the settings rather than to guess at them. A confident "you
 * are sharing nothing" built out of a failed read either alarms a private person or reassures one
 * who is not private at all.
 *
 * Guarded by source scan: the wiring lives in a client component that needs React, Firebase and a
 * signed-in session to exercise, and the property — "the prompt names it, the payload carries it"
 * — is plainly syntactic. Same technique and same reason as tests/chat-context-real-records.test.ts.
 *
 * Run with:
 *   node --import ./tests/register-alias.mjs --test tests/chat-consent-context.test.ts
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { CONSENT_SCOPES } from '../lib/consent.ts';

const ROOT = new URL('..', import.meta.url).pathname;

/** Comments stripped, so this file's own explanation can never satisfy the checks below. */
function code(path: string): string {
  return readFileSync(ROOT + path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CHAT_ROUTE = code('app/api/chat/route.ts');
const CHAT_PANEL = code('components/ChatPanel.tsx');

/** The SYSTEM template literal alone — not the whole file, so a type name cannot satisfy a check. */
const SYSTEM = (() => {
  const start = CHAT_ROUTE.indexOf('const SYSTEM = `');
  assert.notEqual(start, -1, 'app/api/chat/route.ts must still declare a SYSTEM prompt');
  const from = CHAT_ROUTE.indexOf('`', start) + 1;
  const end = CHAT_ROUTE.indexOf('`;', from);
  assert.ok(end > from, 'the SYSTEM prompt must be a single template literal');
  return CHAT_ROUTE.slice(from, end);
})();

test('the system prompt tells Lima the sharing system exists', () => {
  assert.match(SYSTEM, /shar(e|ing)/i, 'the prompt must name sharing at all — this was the whole gap');
  assert.match(
    SYSTEM,
    /Account screen/i,
    'and say where the farmer changes it, or the answer ends in "ask someone"',
  );
  assert.match(
    SYSTEM,
    /NGO|funder/i,
    'and who is on the other side of the switches',
  );
});

test('the prompt describes the switches accurately, not a reassuring paraphrase', () => {
  // The three facts lib/consent.ts actually enforces. A prompt that softens any of them is worse
  // than silence: the farmer acts on what Lima tells them about their own privacy.
  assert.match(SYSTEM, /\bOFF\b|starts? off|switched on/i, 'everything starts off — absence is refusal');
  assert.match(SYSTEM, /Stop sharing everything/i, 'one action withdraws all of it (revokeAll)');
  assert.match(
    SYSTEM,
    /only ever see|only see/i,
    'staff and funders see the granted scopes and nothing else',
  );
  // Location is the one scope with a coarsening fallback rather than a plain blank, so it is the
  // one most easily described wrongly.
  assert.match(SYSTEM, /district/i, 'with location off, a district is shown — not nothing, not the plot');
});

test('the prompt refuses to guess when the farmer’s own settings are missing', () => {
  assert.match(
    SYSTEM,
    /never (assume|guess)|cannot see/i,
    'sample mode and a farmer who never opened the screen both arrive with no consent block, and '
      + 'the model must say so rather than invent a state for it',
  );
});

test('the route accepts the farmer’s own consent state and prints it into the context', () => {
  const ctx = CHAT_ROUTE.slice(CHAT_ROUTE.indexOf('interface Ctx'), CHAT_ROUTE.indexOf('function buildContext'));
  assert.ok(ctx.length > 0, 'the Ctx interface must still be declared above buildContext');
  assert.match(ctx, /\bconsent\?:/, 'Ctx must carry a consent field — a field nobody sends is a dead prompt');
  assert.match(ctx, /sharing/, 'the granted scopes');
  assert.match(ctx, /notSharing/, 'and the withheld ones, so "not shared" is stated rather than absent');

  assert.match(CHAT_ROUTE, /ctx\.consent/, 'buildContext must actually read it');
});

test('the panel reads the farmer’s consent through the same query the consent screen uses', () => {
  const imports = CHAT_PANEL.match(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/db\/queries'/);
  assert.ok(imports, 'ChatPanel must import its loaders from @/lib/db/queries');
  assert.ok(
    imports[1].split(',').map((s) => s.trim()).includes('getMyConsent'),
    'getMyConsent is the query components/ConsentPanel.tsx uses; a second reader of the same '
      + 'record is a second thing to drift',
  );
  assert.match(CHAT_PANEL, /await\s+getMyConsent\s*\(/, 'and it must be called, not merely imported');
  assert.match(CHAT_PANEL, /consent:\s*consent\s*\n?\s*\?/, 'buildContext must put it on the payload');
  // Tolerating null is the point of the ternary: no record must not become a fabricated "nothing
  // is shared", which reads to the farmer as a fact about their account.
  assert.match(CHAT_PANEL, /:\s*undefined,/, 'a missing record sends no consent block at all');
});

test('only THIS farmer’s own consent may reach the assistant', () => {
  // getFarmerConsent(profileId) is the staff-side reader. It has no business in a farmer's chat
  // payload, and importing it here would be the quiet start of one farmer's assistant knowing
  // another farmer's privacy choices.
  assert.ok(
    !/getFarmerConsent/.test(CHAT_PANEL),
    'ChatPanel must never read another farmer’s consent record',
  );
  assert.ok(
    !/farmers|cohort|network/i.test(CHAT_PANEL.slice(
      CHAT_PANEL.indexOf('consent:'),
      CHAT_PANEL.indexOf('project:', CHAT_PANEL.indexOf('consent:')),
    )),
    'the consent block on the payload must be built from this farmer’s record alone',
  );
});

test('the labels sent to the model are the farmer’s own, from the shared catalogue', () => {
  // The screen and the assistant must call the six switches the same thing, or a farmer following
  // Lima's instructions looks for a row that is not on the screen.
  assert.match(CHAT_PANEL, /CONSENT_SCOPES/, 'the labels come from lib/consent.ts, never retyped here');
  assert.match(CHAT_PANEL, /hasConsent\(/, 'and granted/withheld is decided by the shared, fail-closed helper');
  assert.ok(CONSENT_SCOPES.length >= 6, 'six independent switches is what the prompt describes');
  for (const scope of CONSENT_SCOPES) {
    assert.ok(scope.label.trim().length > 0, `${scope.id} must have a farmer-facing label to send`);
  }
});

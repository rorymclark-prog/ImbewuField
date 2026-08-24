// The assistant answers money questions — "what did I earn from my cabbages", "is this worth
// growing" — and app/api/chat/route.ts builds a THIS FARMER'S RECORDS block out of whatever
// ChatPanel hands it, telling the model to "use real rand figures from their sales".
//
// For a long time ChatPanel loaded only ONE of the two record types from Firestore. Real harvests
// reached the assistant; real sales did not, because mySales() was never imported — the `sales`
// field was filled from the DEMO store alone. So a signed-in farmer with months of sales in the
// database asked what they had earned and the model answered from sample data, or from nothing,
// with no sign on screen that half the evidence was missing. A silent half-empty context is worse
// than an empty one: the answer still arrives, confidently, about the wrong farm.
//
// Guarded by source scan because the leak is in a client component's data wiring — it needs
// React, Firebase and a signed-in session to exercise, and the property ("both record types come
// from the database") is plainly syntactic.
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/chat-context-real-records.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;

/** Comments stripped, so this file's own explanation can never satisfy the checks below. */
function code(path: string): string {
  return readFileSync(ROOT + path, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const CHAT_PANEL = code('components/ChatPanel.tsx');
const CHAT_ROUTE = code('app/api/chat/route.ts');

test('the assistant is given the farmer’s real sales, not only their real harvests', () => {
  const imports = CHAT_PANEL.match(/import\s*\{([^}]*)\}\s*from\s*'@\/lib\/db\/queries'/);
  assert.ok(imports, 'ChatPanel must import its record loaders from @/lib/db/queries');
  const loaded = imports[1].split(',').map((s) => s.trim());
  for (const fn of ['myProduction', 'mySales']) {
    assert.ok(loaded.includes(fn), `${fn} must be imported — a record type nobody loads is invisible to the assistant`);
    assert.match(CHAT_PANEL, new RegExp(`await\\s+${fn}\\s*\\(`), `${fn} must actually be called, not merely imported`);
  }
});

test('the sales handed to the assistant are not demo-only', () => {
  const line = CHAT_PANEL.split('\n').find((l) => /^\s*const sales\s*=/.test(l));
  assert.ok(line, 'buildContext must assemble a `sales` array');
  assert.ok(
    !/^\s*const sales\s*=\s*getLocalSales\(\)/.test(line),
    'sales must not come from the local demo store alone — that was the bug: a signed-in farmer’s '
      + 'Firestore sales were dropped while the sample rows were passed off as their record',
  );
  // Production was always assembled from both sources; sales must be built the same way, or the
  // two halves of one farm disagree about which farm the assistant is looking at.
  assert.match(line!, /\.\.\..*,\s*\.\.\./, 'sales must merge the signed-in rows with the local ones, as production does');
});

test('the route still reads both record types, so the wiring is not dead on arrival', () => {
  for (const field of ['production', 'sales']) {
    assert.match(CHAT_ROUTE, new RegExp(`ctx\\.${field}`), `the chat route must read ctx.${field}`);
  }
});

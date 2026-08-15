import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// A SALE, EXPENSE OR HARVEST COULD HANG FOREVER ON A DROPPING CONNECTION.
//
// addDoc()/setDoc() do not resolve until the backend acknowledges the write — that is documented
// Firestore SDK behaviour, not a bug of this app's: "if the client cannot reach the backend...
// the returned Promise will not resolve for a potentially-long time (for example, until the
// client has gone back online)" (see the addDoc() JSDoc in @firebase/firestore). On a genuinely
// dropped connection — this audience's normal case, not its edge case — that left the Save button
// spinning with `loading: true` forever and told the farmer nothing.
//
// The SAME doc comment is why the fix is safe: the write "will be immediately created in the
// local cache" — durably, because getFirebase() (lib/firebase/init.ts) configures
// persistentLocalCache — so giving up on the wait is not giving up on the write. lib/db/queries.ts
// races every add* write against WRITE_TIMEOUT_MS and rejects with WriteTimeoutError rather than
// leaving the caller to guess; both save screens then tell the farmer the entry is safe, using the
// SAME navigator.onLine signal app/finances/page.tsx's read-side offline banner already tracks.

import {
  withWriteTimeout,
  WriteTimeoutError,
  WRITE_TIMEOUT_MS,
} from '../lib/db/queries.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

/* ── withWriteTimeout: the race itself ───────────────────────────────────── */

test('a write that confirms before the timeout resolves with its real value', async () => {
  const result = await withWriteTimeout(Promise.resolve('doc-123'), 50);
  assert.equal(result, 'doc-123');
});

test('a write that fails before the timeout surfaces its own error, not a timeout', async () => {
  await assert.rejects(
    withWriteTimeout(Promise.reject(new Error('permission-denied')), 50),
    /permission-denied/,
  );
});

test('a write that never settles times out instead of hanging forever', async () => {
  const neverSettles = new Promise<void>(() => {});
  await assert.rejects(withWriteTimeout(neverSettles, 20), WriteTimeoutError);
});

test('a write that eventually resolves AFTER the timeout does not crash the process', async () => {
  let unhandled: unknown = 'not fired';
  const onUnhandled = (reason: unknown) => { unhandled = reason; };
  process.on('unhandledRejection', onUnhandled);
  try {
    let resolveWork!: (v: string) => void;
    const work = new Promise<string>((resolve) => { resolveWork = resolve; });
    await assert.rejects(withWriteTimeout(work, 20), WriteTimeoutError);
    // The connection recovers and the original write finally lands — well after our caller
    // stopped waiting for it. This must not surface as an unhandled rejection.
    resolveWork('late-but-fine');
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(unhandled, 'not fired', 'a late resolve from the timed-out write must not blow up the process');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('a write that eventually REJECTS after the timeout is swallowed, not thrown as unhandled', async () => {
  let unhandled: unknown = 'not fired';
  const onUnhandled = (reason: unknown) => { unhandled = reason; };
  process.on('unhandledRejection', onUnhandled);
  try {
    let rejectWork!: (e: Error) => void;
    const work = new Promise<string>((_resolve, reject) => { rejectWork = reject; });
    await assert.rejects(withWriteTimeout(work, 20), WriteTimeoutError);
    rejectWork(new Error('backend finally said no'));
    await new Promise((r) => setTimeout(r, 40));
    assert.equal(unhandled, 'not fired', 'a late rejection from the loser must not escape as unhandled');
  } finally {
    process.off('unhandledRejection', onUnhandled);
  }
});

test('the default timeout is bounded near the "roughly 8 seconds" the audit called for', () => {
  assert.ok(
    WRITE_TIMEOUT_MS >= 4000 && WRITE_TIMEOUT_MS <= 15000,
    `WRITE_TIMEOUT_MS is ${WRITE_TIMEOUT_MS}ms — expected something in the neighbourhood of 8000ms`,
  );
});

/* ── Wiring: addSale / addExpense / addProduction actually bound their write ─ */

test('addProduction, addSale and addExpense each race their write against the timeout', () => {
  const src = read('../lib/db/queries.ts');
  for (const fn of ['addProduction', 'addSale', 'addExpense']) {
    const start = src.indexOf(`export async function ${fn}(`);
    assert.ok(start > 0, `${fn} is missing from lib/db/queries.ts`);
    const body = src.slice(start, src.indexOf('\n}', start));
    assert.match(
      body,
      /withWriteTimeout\(/,
      `${fn} no longer bounds its write — a dropping connection can hang it forever again`,
    );
  }
});

/* ── app/finances/page.tsx: the same bounded save, an honest branch ─────────── */

test('the finances Log sale/cost form tells a timeout apart from a real failure', () => {
  const src = read('../app/finances/page.tsx');
  assert.match(
    src,
    /import \{[\s\S]*?WriteTimeoutError[\s\S]*?\} from '@\/lib\/db\/queries'/,
    'WriteTimeoutError must be imported to branch on it',
  );
  const handlerStart = src.indexOf('async function handleSubmit');
  assert.ok(handlerStart > 0);
  const handler = src.slice(handlerStart, handlerStart + 3600);
  assert.match(handler, /err instanceof WriteTimeoutError/, 'handleSubmit must special-case a timeout');

  const branchStart = handler.indexOf('err instanceof WriteTimeoutError');
  // Bound the slice to just this if-block (up to its own `return;`), not the sibling generic
  // catch that follows it — that fallback legitimately still says "Failed to save".
  const returnAt = handler.indexOf('return;', branchStart);
  assert.ok(returnAt > branchStart, 'the WriteTimeoutError branch must return so it cannot fall through to the generic failure');
  const branch = handler.slice(branchStart, returnAt);
  assert.doesNotMatch(branch, /Failed to save/, 'a queued write must never be reported to the farmer as failed');
  assert.match(branch, /saved on your phone/i, 'the timeout message must say the entry is safe, not just stop spinning');
  // Reuses the SAME navigator.onLine-derived `online` signal the read-side banner already
  // tracks (app/finances/page.tsx ~line 1023) rather than inventing a second offline mechanism.
  assert.match(branch, /error: online\s*\n?\s*\?/, 'the wording must branch on the existing `online` signal, not a new one');
});

test('a timed-out save clears the entered values so a re-tap cannot log the same entry twice', () => {
  const src = read('../app/finances/page.tsx');
  const handlerStart = src.indexOf('async function handleSubmit');
  const handler = src.slice(handlerStart, handlerStart + 3600);
  const branchStart = handler.indexOf('err instanceof WriteTimeoutError');
  const returnAt = handler.indexOf('return;', branchStart);
  const branch = handler.slice(branchStart, returnAt);
  assert.match(
    branch,
    /emptyForm\(\)/,
    'the timeout branch must reset the form fields — leaving them filled invites a duplicate resubmit',
  );
});

test('both LogSaleForm mount points feed the shared online signal into the save path', () => {
  const src = read('../app/finances/page.tsx');
  const mounts = src.match(/<LogSaleForm[\s\S]*?\/>/g) ?? [];
  assert.equal(mounts.length, 2, 'expected exactly the desktop-modal mount and the phone mount');
  for (const mount of mounts) {
    assert.match(mount, /online=\{online\}/, `LogSaleForm mount is missing online={online}:\n${mount}`);
  }
});

/* ── components/MyRecords.tsx: the harvest and sale forms get equal treatment ─ */

test('MyRecords imports WriteTimeoutError and both forms branch on it', () => {
  const src = read('../components/MyRecords.tsx');
  assert.match(
    src,
    /import \{[\s\S]*?WriteTimeoutError[\s\S]*?\} from '@\/lib\/db\/queries'/,
  );
  const occurrences = src.match(/err instanceof WriteTimeoutError/g) ?? [];
  assert.equal(
    occurrences.length,
    2,
    'both LogProductionForm (addProduction) and LogSaleForm (addSale) must handle the timeout — one entry point cannot be left hanging',
  );
});

test('MyRecords never reports a queued write as "Failed to save"', () => {
  const src = read('../components/MyRecords.tsx');
  let from = 0;
  for (let i = 0; i < 2; i++) {
    const idx = src.indexOf('err instanceof WriteTimeoutError', from);
    assert.ok(idx > 0, `expected a ${i + 1}${i === 0 ? 'st' : 'nd'} WriteTimeoutError branch`);
    // Bound the slice to just this if-block (up to its own `return;`), not the sibling generic
    // catch-all that follows it — that fallback legitimately still says myRecordsSaveError.
    const returnIdx = src.indexOf('return;', idx);
    assert.ok(returnIdx > idx, 'the WriteTimeoutError branch must return so it cannot fall through to the generic failure');
    const branch = src.slice(idx, returnIdx);
    assert.doesNotMatch(branch, /myRecordsSaveError/, 'the timeout branch must not reuse the generic failure copy');
    assert.match(branch, /saveQueuedMessage\(\)/, 'the timeout branch must use the honest queued-save message');
    from = idx + 1;
  }
});

test('MyRecords does not mint a new translated i18n key for the queued-save message', () => {
  // This repo never invents isiZulu (or any other) translation. The honest fix is a hardcoded
  // English string (this file already hardcodes other English-only copy, e.g. the guide-price
  // note), not a new key spread across eleven locale blocks with wording nobody has reviewed.
  const src = read('../components/MyRecords.tsx');
  assert.match(src, /function saveQueuedMessage/, 'expected the shared queued-save message helper');
  assert.doesNotMatch(
    src,
    /t\('myRecordsSaveQueued/,
    'a translated key would require inventing translations this task must not add',
  );
  const i18n = read('../lib/i18n.tsx');
  assert.doesNotMatch(
    i18n,
    /myRecordsSaveQueued/,
    'lib/i18n.tsx must not gain a new key for this — it is out of scope and untranslated',
  );
});

test('MyRecords reads navigator.onLine directly rather than inventing a second offline mechanism', () => {
  const src = read('../components/MyRecords.tsx');
  const helperStart = src.indexOf('function saveQueuedMessage');
  assert.ok(helperStart > 0);
  const helper = src.slice(helperStart, helperStart + 200);
  assert.match(helper, /navigator\.onLine/, 'the queued-save wording must be driven by navigator.onLine, the same signal the finances page reads');
});

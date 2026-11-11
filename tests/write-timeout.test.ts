import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { registerHooks } from 'node:module';
import ts from 'typescript';

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
// bounds cloud acknowledgement with WRITE_TIMEOUT_MS rather than leaving the caller to guess.
// Direct production/cost writes report the queued write using the SAME navigator.onLine signal.
// Quick sales now have a stronger local invoice receipt: their bounded cloud-sync failure keeps
// that one invoice pending, and the form completes from its real local receipt, not a timeout.

import {
  withWriteTimeout,
  WriteTimeoutError,
  WRITE_TIMEOUT_MS,
} from '../lib/db/queries.ts';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');
function formDeclaration(source: string, name: string): string {
  const tree = ts.createSourceFile('form.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const node = tree.statements.find(statement => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(node, `The actual ${name} declaration must exist`);
  return node.getText(tree);
}

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

/* ── app/records/page.tsx: the same bounded save, an honest branch ───────────
   The money forms moved with the Picked · Sold · Spent merge; /finances is a redirect now. */

test('the finances Log sale/cost form tells a timeout apart from a real failure', () => {
  const src = read('../app/records/page.tsx');
  assert.match(
    src,
    /import \{[\s\S]*?WriteTimeoutError[\s\S]*?\} from '@\/lib\/db\/queries'/,
    'WriteTimeoutError must be imported to branch on it',
  );
  const handlerStart = src.indexOf('async function handleSubmit');
  assert.ok(handlerStart > 0);
  // Receipt persistence made this handler longer; a fixed character window cut
  // off the timeout return. Bound the function instead, keeping the same rule.
  const handler = src.slice(handlerStart, src.indexOf('\n  function closeForm', handlerStart));
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
  // tracks (app/records/page.tsx) rather than inventing a second offline mechanism.
  assert.match(branch, /error: online\s*\n?\s*\?/, 'the wording must branch on the existing `online` signal, not a new one');
});

test('a timed-out save clears the entered values so a re-tap cannot log the same entry twice', () => {
  const src = read('../app/records/page.tsx');
  const handlerStart = src.indexOf('async function handleSubmit');
  const handler = src.slice(handlerStart, src.indexOf('\n  function closeForm', handlerStart));
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
  const src = read('../app/records/page.tsx');
  const mounts = src.match(/<LogSaleForm[\s\S]*?\/>/g) ?? [];
  // Three now, not two: the merge split the one combined phone mount into a Sold mount and a
  // Spent mount (money-in and money-out, the toggle replaced by the tab you are standing on)
  // beside the unchanged desktop-modal mount. Every one of them still has to carry the shared
  // online signal, which is what this test is actually for.
  assert.equal(mounts.length, 3, 'expected the desktop-modal mount plus the Sold and Spent mounts');
  for (const mount of mounts) {
    assert.match(mount, /online=\{online\}/, `LogSaleForm mount is missing online={online}:\n${mount}`);
  }
});

/* ── components/MyRecords.tsx: distinct production and local-invoice receipts ─ */

test('MyRecords bounds direct production acknowledgement while sales complete only from the guarded local invoice receipt', () => {
  const src = read('../components/MyRecords.tsx');
  assert.match(
    src,
    /import \{[\s\S]*?WriteTimeoutError[\s\S]*?\} from '@\/lib\/db\/queries'/,
  );
  const production = formDeclaration(src, 'LogProductionForm'), sale = formDeclaration(src, 'LogSaleForm');
  assert.equal((production.match(/err instanceof WriteTimeoutError/g) ?? []).length, 1,
    'direct production still needs its queued-write acknowledgement branch');
  // Sale-invoice cutover deliberately moved timeout handling below the form:
  // pretending that any thrown timeout proves a local invoice would invent a receipt.
  assert.doesNotMatch(sale, /err instanceof WriteTimeoutError/);
  assert.match(sale, /const invoice = await addSale\([\s\S]*?invoiceSource\.book\)/);
  assert.match(sale, /attempt !== saleSequence\.current \|\| !invoiceSource\.isActorCurrent\(\)/);
  assert.match(sale, /invoiceSource\.reload\(\)/);
  assert.match(sale, /router\.push\(`\/invoice\?view=\$\{encodeURIComponent\(invoice\.id\)\}`\)/);
  const writer = read('../lib/sale-invoice.ts');
  assert.match(writer, /const result = saveInvoice\(invoice, source\)/);
  assert.match(writer, /result\.status !== 'written'[\s\S]*?throw new UserFacingError/,
    'held or unconfirmed local effects cannot be returned as a successful sale');
  assert.match(writer, /try \{ await sync\(stored, book\); \}[\s\S]*?catch \{[\s\S]*?invoiceBookIsCurrent\(book\)[\s\S]*?return stored;/,
    'only the current, already-written invoice survives a failed cloud acknowledgement');
});

test('MyRecords queued production clears its fields and reports pending delivery while receipt-backed sale failures retain honest invoice-review copy', () => {
  const src = read('../components/MyRecords.tsx');
  const production = formDeclaration(src, 'LogProductionForm'), idx = production.indexOf('err instanceof WriteTimeoutError');
  assert.ok(idx > 0);
  const returnIdx = production.indexOf('return;', idx);
  assert.ok(returnIdx > idx, 'the queued branch must return before the generic failure');
  const branch = production.slice(idx, returnIdx);
  assert.doesNotMatch(branch, /myRecordsSaveError|Failed to save/);
  assert.match(branch, /saveQueuedMessage\(\)/);
  for (const name of ['crop', 'quantity', 'photoPreview']) assert.match(branch, new RegExp(`${name}: ''`),
    'the queued production entry must not remain ready for accidental resubmission');
  assert.match(branch, /loading: false/);
  assert.match(branch, /fileRef\.current\.value = ''/);
  assert.match(branch, /onSaved\(\)/);
  const sale = formDeclaration(src, 'LogSaleForm');
  assert.match(sale, /setForm\(\{ crop: '', cropKey: null, quantity: '', unit: 'kg', amount: '', buyer: '', loading: false, error: '' \}\)/);
  assert.match(sale, /The sale could not be confirmed\. Check the invoice records before saving again\./);
  assert.doesNotMatch(sale, /saveQueuedMessage\(\)/,
    'an unconfirmed local invoice must not inherit production cache-success wording');
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


// Exercise the expense writer itself: the UI keeps the mounted owner's identity
// while Firebase can already have switched auth.currentUser to the next account.
const receiptQueryHarness = {
  uid: 'farmer-a',
  profileWait: Promise.resolve(),
  writes: [] as { method: string; path: string; value: Record<string, unknown> }[],
};
Object.assign(globalThis, { __imbewuReceiptQueryHarness: receiptQueryHarness });
const receiptQueryUrl = new URL('../lib/db/queries.ts?receipt-account-check', import.meta.url).href;
const receiptModule = (source: string) => `data:text/javascript,${encodeURIComponent(source)}`;
const receiptFirebase = receiptModule(`
const harness = globalThis.__imbewuReceiptQueryHarness;
export const getFirebase = () => ({db: {}, auth: {get currentUser() {return harness.uid ? {uid:harness.uid} : null}}});
`);
const receiptFirestore = receiptModule(`
const harness = globalThis.__imbewuReceiptQueryHarness;
export const collection = (_db, ...parts) => ({path: parts.join('/')});
export const doc = (_db, ...parts) => ({path:parts.join('/')});
export const getDoc = async ref => {await harness.profileWait; return {id:harness.uid, exists:()=>true, data:()=>({org_id:'org-a'})}};
export const setDoc = async (ref,value) => {harness.writes.push({method:'setDoc', path:ref.path,value})};
export const addDoc = async (ref,value) => {harness.writes.push({method:'addDoc', path:ref.path,value});return {id:'server-id'}};
export const updateDoc = async (ref,value) => {harness.writes.push({method:'updateDoc', path:ref.path,value})};
export const serverTimestamp = () => 'timestamp';
export const getDocs=()=>{}, deleteDoc=()=>{}, query=()=>{}, where=()=>{}, orderBy=()=>{}, writeBatch=()=>{}, getCountFromServer=()=>{}, runTransaction=()=>{};
`);
const receiptQueryHooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL === receiptQueryUrl) {
      if (specifier === '@/lib/firebase/init') return { url: receiptFirebase, shortCircuit: true };
      if (specifier === 'firebase/firestore') return { url: receiptFirestore, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
const receiptQueries = await import(receiptQueryUrl);
receiptQueryHooks.deregister();

test('new costs use the same stable ID as their receipt, including retries', async () => {
  receiptQueryHarness.uid = 'farmer-a'; receiptQueryHarness.profileWait = Promise.resolve(); receiptQueryHarness.writes = [];
  await receiptQueries.addExpense({ id: 'receipt-cost-123', item: 'Seeds', amount: 25 }, 'farmer-a');
  await receiptQueries.addExpense({ id: 'receipt-cost-123', item: 'Seeds', amount: 25 }, 'farmer-a');
  assert.deepEqual(receiptQueryHarness.writes.map(row => [row.method, row.path, row.value.profile_id]), [
    ['setDoc', 'expense_logs/receipt-cost-123', 'farmer-a'], ['setDoc', 'expense_logs/receipt-cost-123', 'farmer-a'],
  ]);
});

test('an old owner’s cost cannot be added or edited under a newly switched Firebase account', async () => {
  receiptQueryHarness.uid = 'farmer-b'; receiptQueryHarness.writes = [];
  await assert.rejects(receiptQueries.addExpense({ id: 'private-cost', item: 'Seeds', amount: 25 }, 'farmer-a'), /account changed/);
  await assert.rejects(receiptQueries.updateExpense('private-cost', { item: 'Seeds' }, 'farmer-a'), /account changed/);
  assert.equal(receiptQueryHarness.writes.length, 0);
});

test('an account switch during profile lookup stops a photographed cost before its database write', async () => {
  receiptQueryHarness.uid = 'farmer-a'; receiptQueryHarness.writes = [];
  let release!: () => void;
  receiptQueryHarness.profileWait = new Promise<void>(resolve => { release = resolve; });
  const pending = receiptQueries.addExpense({ id: 'private-cost', item: 'Seeds', amount: 25 }, 'farmer-a');
  const refused = assert.rejects(pending, /account changed/);
  receiptQueryHarness.uid = 'farmer-b'; release();
  await refused;
  assert.equal(receiptQueryHarness.writes.length, 0);
  receiptQueryHarness.profileWait = Promise.resolve();
});

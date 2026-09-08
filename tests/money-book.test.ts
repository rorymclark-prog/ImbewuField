import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// ONE BOOK, THREE TABS — and the guard that keeps it one.
//
// The Gogo Test audit (27 August, 375 x 812, an isiZulu-speaking KZN smallholder farming well on
// a hand-me-down Android) found her money behind separate doors: kilograms at "My Records", rands
// at "Finance", a home tile and a menu row for each, and no screen anywhere that could answer
// "how much did I make this season?". Its recommendation, verbatim: "Merge My Records and Finance
// into Picked · Sold · Spent … one book with three tabs … single route, keep the charts as a view
// inside it rather than a separate destination."
//
// That merge is a page composition, not a lib function, so these are source-shape assertions —
// weaker than a render, and strictly stronger than the nothing that would otherwise notice a
// second money door reappearing. The three things they hold down are the three that would quietly
// undo the merge: /finances growing a page again, a tab going missing, and a second money tile
// arriving on the home screen because someone added a link and nobody counted.

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

const financesPage = read('../app/finances/page.tsx');
const recordsPage = read('../app/records/page.tsx');
const homePage = read('../app/home/page.tsx');
const tabBar = read('../components/TabBar.tsx');
const navDrawer = read('../components/NavDrawer.tsx');

/* ── 1. The old door still opens, onto the new room ──────────────────────────── */

test('/finances is a redirect onto the merged book, not a second money screen', () => {
  // NOT DELETED. /finances is a tab-bar destination in every build already installed on a phone,
  // it is linked from the Journal and the invoice tool, and it is what a bookmark points at. A
  // 404 there reads as "my books are gone" — the single worst thing this screen can say.
  assert.match(financesPage, /from 'next\/navigation'/, '/finances must still resolve to a page');
  assert.match(financesPage, /redirect\(/, '/finances must redirect rather than render money');
  assert.match(
    financesPage,
    /redirect\(qs \? `\/records\?\$\{qs\}` : '\/records'\)/,
    'the redirect must land on /records and carry any query string with it',
  );

  // A redirect page renders nothing, so nothing may have crept back in beside it.
  for (const gone of ['SalesLedger', 'LogSaleForm', 'FinancialSheet', 'CashflowChart', 'SummaryCards']) {
    assert.ok(!financesPage.includes(gone), `/finances is rendering ${gone} again — the money must live in one place`);
  }
  assert.ok(!/'use client'/.test(financesPage), 'the redirect should run on the server, before the phone paints anything');
});

test('nothing still points a farmer at the retired route', () => {
  // The redirect is a safety net for links this repo does not control (an installed PWA, a
  // bookmark, a printed QR). Anything inside the app should go straight to the book.
  for (const [name, src] of [['the tab bar', tabBar], ['the menu', navDrawer], ['the home screen', homePage]] as const) {
    assert.ok(
      !/href: '\/finances'|href="\/finances"/.test(src),
      `${name} still sends a farmer through the redirect instead of straight to /records`,
    );
  }
});

/* ── 2. The book itself ──────────────────────────────────────────────────────── */

test('the merged book carries all three tabs plus the charts view', () => {
  assert.match(
    recordsPage,
    /const BOOK_TABS = \['picked', 'sold', 'spent', 'charts'\] as const;/,
    'Picked · Sold · Spent — the audit\'s words, in her order — and the charts as a view inside the book',
  );
  for (const key of ['bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts']) {
    assert.ok(recordsPage.includes(`t('${key}')`), `the ${key} tab must take its label from the dictionary`);
  }

  // Each tab has to actually hold something. The failure this catches is a tab that renders an
  // empty branch — a door that opens onto nothing is worse than no door.
  assert.match(recordsPage, /\{\(tab === 'picked' \|\| tab === 'sold'\) && \(/, 'Picked and Sold share one mounted MyRecords');
  assert.match(recordsPage, /\{tab === 'sold' && \(/, 'Sold must render its own money-in surface');
  assert.match(recordsPage, /\{tab === 'spent' && \(/, 'Spent must render its own money-out surface');
  assert.match(recordsPage, /\{tab === 'charts' && \(/, 'the charts must be a view inside the book');

  // The charts are a VIEW, not a destination: every chart the old /finances carried is mounted
  // here, so the merge did not quietly drop one on the way.
  for (const chart of ['CashflowChart', 'FinanceGraphs', 'FarmMetrics', 'ComingUpHarvests', 'HarvestReconciliation', 'FinancialSheet']) {
    assert.ok(recordsPage.includes(`<${chart}`), `the charts view lost ${chart}`);
  }
});

test('every write path that existed on either screen still has a door', () => {
  // THE BUG CLASS THIS REPO FEARS MOST. A UI merge that silently drops a form is future data
  // loss: the farmer keeps tapping, the entry never gets written, and nothing says so. Both
  // mutations that only ever had ONE caller are the sharp edges — addProduction (the harvest
  // form) and addExpense (the cost form, the only door to the till-slip camera).
  const myRecords = read('../components/MyRecords.tsx');
  for (const write of ['addProduction(', 'addSale(', 'uploadPhoto(']) {
    assert.ok(myRecords.includes(write), `MyRecords lost its ${write} path`);
  }
  for (const write of ['addSale(', 'addExpense(', 'updateSale(', 'updateExpense(', 'deleteSale(', 'deleteExpense(']) {
    assert.ok(recordsPage.includes(write), `the book lost its ${write} path`);
  }
  // The sandbox twins, so sample mode can still be edited without touching real books.
  for (const write of ['addSandboxSale', 'addSandboxExpense', 'updateSandboxSale', 'updateSandboxExpense', 'deleteSandboxSale', 'deleteSandboxExpense']) {
    assert.ok(recordsPage.includes(write), `the book lost its ${write} path`);
  }
  // The till slip: the one write path with a camera in front of it.
  assert.ok(recordsPage.includes("'/api/read-slip'"), 'the till-slip scanner must survive on the Spent page');
  // And the harvest form itself is mounted, not merely imported.
  assert.match(recordsPage, /<MyRecords section=\{tab\}/, 'the book must mount the harvest form it did not rewrite');
});

test('the harvest form kept its shape: crop, kilograms, optional photo, save', () => {
  // The audit's "what not to touch" list, first entry: "The harvest form. Crop, kilograms,
  // optional photo, save. Three fields, one optional. This is already the right shape; the
  // problem is finding it, not filling it." Only its front door moved.
  const myRecords = read('../components/MyRecords.tsx');
  const start = myRecords.indexOf('function LogProductionForm');
  assert.ok(start > 0, 'the harvest form is gone');
  const form = myRecords.slice(start, myRecords.indexOf('/* ── Log sale form', start));
  for (const field of ['myRecordsCropLabel', 'myRecordsKgHarvestedLabel', 'myRecordsPhotoLabel', 'myRecordsSaveHarvest']) {
    assert.ok(form.includes(`t('${field}')`), `the harvest form lost ${field}`);
  }
  assert.match(form, /<CropSelect/, 'the crop picker must stay');
  assert.match(form, /capture="environment"/, 'the optional photo must stay a camera, not a file browser');
});

/* ── 3. One money tile, one money row ────────────────────────────────────────── */

test('the home screen offers one money tile, not two', () => {
  const quickStart = homePage.indexOf('const QUICK_ACTIONS = [');
  assert.ok(quickStart > 0, 'the home quick-action grid is gone');
  const grid = homePage.slice(quickStart, homePage.indexOf('];', quickStart));

  const moneyTiles = [...grid.matchAll(/href: '(\/records|\/finances)'/g)].map((m) => m[1]);
  assert.deepEqual(
    moneyTiles,
    ['/records'],
    'the home screen must offer exactly one money door — the split between "Finance" and "My Records" is the whole finding',
  );
  assert.ok(
    !grid.includes('homeQuickFinance'),
    'the Finance tile\'s label is still on the home screen; two names for one book is how the split started',
  );
});

test('the menu and the tab bar each offer one money door, and it is the book', () => {
  const moneyRows = [...navDrawer.matchAll(/href: '(\/records|\/finances)'/g)].map((m) => m[1]);
  assert.deepEqual(moneyRows, ['/records'], 'the menu must offer exactly one money row');

  // These are the farmer's tabs; funders and NGOs now have their own workspaces.
  const farmerTabs = tabBar.match(/const TABS = \[([\s\S]*?)\];/)?.[1] ?? '';
  const tabs = [...farmerTabs.matchAll(/href: '([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(
    tabs,
    ['/home', '/farmer', '/records', '/account'],
    'the four bottom tabs — the money one is the book now',
  );
  // Its label has to be the SAME word as the tile and the header. Two names for one door is what
  // sent her looking for her sales under "Finance" and her kilograms under "My Records".
  assert.match(tabBar, /key: 'homeQuickMyRecords'/, 'the money tab must reuse the already-translated door name');
});

test('the tab label keys exist in English and were not coined in any other language', () => {
  // The repo rule (see tests/farmer-i18n-gaps.test.ts): new farmer copy goes into the English
  // block alone, and translate()'s fallback serves English until a first-language reviewer
  // supplies the real words. A fluent invented isiZulu label is worse than a true English one.
  const en = read('../lib/i18n.tsx');
  const NEW_KEYS = ['bookTabPicked', 'bookTabSold', 'bookTabSpent', 'bookTabCharts'] as const;
  for (const key of NEW_KEYS) {
    assert.match(en, new RegExp(`^  ${key}: '`, 'm'), `${key} has no English source text`);
  }
  for (const locale of ['af', 'zu', 'xh', 'nso', 'tn', 'st', 'ts', 've', 'ss', 'nr']) {
    const block = read(`../lib/locales/${locale}.ts`);
    for (const key of NEW_KEYS) {
      assert.ok(!block.includes(`${key}:`), `${key} was coined in ${locale} without a first-language reviewer`);
    }
  }
  // The door name itself was NOT renamed, precisely so this list stays short: it is already
  // translated everywhere, and renaming it would have traded ten real words for one English one.
  for (const locale of ['zu', 'af', 'xh']) {
    assert.ok(read(`../lib/locales/${locale}.ts`).includes('homeQuickMyRecords:'), `${locale} lost the door name`);
  }
});


// Receipts are durable device documents, not the short-lived FileReader URL that
// the AI scanner used to discard after extracting three fields.
const receipts = await import('../lib/expense-receipts.ts');
const { bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');

class ReceiptTestDb {
  rows = new Map<string, unknown>();
  failWrites = false;
  openCalls = 0;
  private transactionTail = Promise.resolve();
  pauseNext: Promise<void> | null = null;
  open() {
    this.openCalls += 1;
    const opening: { result: unknown; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void } = {
      result: { close() {}, transaction: (_name: string, mode: string) => this.transaction(mode) },
    };
    queueMicrotask(() => opening.onsuccess?.());
    return opening;
  }
  transaction(mode: string) {
    const previousTransaction = this.transactionTail;
    let finish!: () => void;
    this.transactionTail = new Promise<void>(resolve => { finish = resolve; });
    let staged: Map<string, unknown>;
    let pending = 0;
    let failed = false;
    const tx: { objectStore: () => unknown; oncomplete?: () => void; onabort?: () => void; onerror?: () => void } = { objectStore: () => store };
    const perform = (operation: 'get' | 'put' | 'delete', key: string, value?: unknown) => {
      const request: { result?: unknown; onsuccess?: () => void; onerror?: () => void } = {};
      pending += 1;
      const pause = this.pauseNext;
      this.pauseNext = null;
      queueMicrotask(async () => {
        await previousTransaction;
        staged ??= new Map(this.rows);
        if (pause) await pause;
        if (operation !== 'get' && this.failWrites) {
          failed = true;
          request.onerror?.(); tx.onabort?.(); finish();
        } else {
          if (operation === 'put') staged.set(key, structuredClone(value));
          if (operation === 'delete') staged.delete(key);
          if (operation === 'get') request.result = staged.get(key);
          request.onsuccess?.();
        }
        pending -= 1;
        if (!pending && !failed) {
          if (mode === 'readwrite') this.rows = staged;
          tx.oncomplete?.(); finish();
        }
      });
      return request;
    };
    const store = {
      get: (key: string) => perform('get', key),
      put: (value: unknown, key: string) => perform('put', key, value),
      delete: (key: string) => perform('delete', key),
    };
    return tx;
  }
}

function receiptEnvironment(t: { after(fn: () => void): void }) {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDb = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const session = new Map<string, string>();
  const events = new EventTarget();
  const windowStub = Object.assign(events, { sessionStorage: { getItem: (key: string) => session.get(key) ?? null } });
  const db = new ReceiptTestDb();
  Object.defineProperty(globalThis, 'window', { value: windowStub, configurable: true });
  Object.defineProperty(globalThis, 'indexedDB', { value: db, configurable: true });
  bindMountedAccountLocalStorageUid('farmer-a');
  t.after(() => {
    if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (originalDb) Object.defineProperty(globalThis, 'indexedDB', originalDb); else Reflect.deleteProperty(globalThis, 'indexedDB');
    bindMountedAccountLocalStorageUid(null);
  });
  return { db, sample(active: boolean) { if (active) session.set('imbewu_sample_mode', '1'); else session.delete('imbewu_sample_mode'); events.dispatchEvent(new Event('imbewu-sample-mode-changed')); } };
}

const receiptPhoto = (name = 'till-slip.png') => new File([
  Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jI5sAAAAASUVORK5CYII=', 'base64'),
], name, { type: 'image/png' });
const saveReceipt = (expenseId: string, photo = receiptPhoto(), saveExpense = async () => {}) => receipts.saveExpenseWithReceipt({
  scope: receipts.expenseReceiptScope(), expenseId, photo, saveExpense, isQueuedWrite: () => false,
});

test('a cost keeps its original receipt bytes and filename under the owning account, without network or resizing', async t => {
  const { db } = receiptEnvironment(t);
  const file = receiptPhoto('shop-original.png');
  let savedId = '';
  await saveReceipt('cost-123', file, async () => { savedId = 'cost-123'; });
  assert.equal(savedId, 'cost-123');
  const receipt = await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), savedId);
  assert.ok(receipt);
  assert.equal(receipt.name, file.name);
  assert.deepEqual(new Uint8Array(await receipt.original.arrayBuffer()), new Uint8Array(await file.arrayBuffer()));
  assert.equal(db.rows.size, 1);

  bindMountedAccountLocalStorageUid('farmer-b');
  assert.equal(await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), savedId), null, 'B must not see A’s photograph, even for the same expense ID');
  await saveReceipt(savedId, receiptPhoto('b-original.png'));
  assert.equal(db.rows.size, 2);
  bindMountedAccountLocalStorageUid(null);
  assert.equal(receipts.expenseReceiptScope(), null, 'signed-out users cannot open an owner-unknown receipt');
  bindMountedAccountLocalStorageUid('farmer-a');
  assert.equal((await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), savedId))?.name, file.name);
});

test('sample receipt photos never enter IndexedDB and disappear on sample re-entry while real originals survive', async t => {
  const env = receiptEnvironment(t);
  await saveReceipt('same-id', receiptPhoto('real-original.png'));
  const realRows = [...env.db.rows.keys()];
  env.sample(true);
  const opens = env.db.openCalls;
  await saveReceipt('same-id', receiptPhoto('practice-photo.png'));
  assert.equal((await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'same-id'))?.name, 'practice-photo.png');
  assert.equal(env.db.openCalls, opens, 'sample photos must stay in memory');
  env.sample(false); env.sample(true);
  assert.equal(await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'same-id'), null);
  assert.deepEqual([...env.db.rows.keys()], realRows);
  env.sample(false);
  assert.equal((await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'same-id'))?.name, 'real-original.png');
});

test('storage failure blocks the expense save, and a rejected expense edit restores its previous receipt', async t => {
  const { db } = receiptEnvironment(t);
  let saves = 0;
  db.failWrites = true;
  await assert.rejects(saveReceipt('cost-1', receiptPhoto(), async () => { saves += 1; }), /could not be saved on this device/);
  assert.equal(saves, 0);
  assert.equal(db.rows.size, 0);
  db.failWrites = false;
  await saveReceipt('cost-1', receiptPhoto('original.png'));
  await assert.rejects(saveReceipt('cost-1', receiptPhoto('replacement.png'), async () => { throw Error('permission-denied'); }), /permission-denied/);
  assert.equal((await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'cost-1'))?.name, 'original.png');
  await assert.rejects(saveReceipt('new-cost', receiptPhoto(), async () => { throw Error('rejected'); }), /rejected/);
  assert.equal(await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'new-cost'), null, 'failed new costs must not leave attached records');
});

test('a queued offline expense retains its receipt for later viewing', async t => {
  receiptEnvironment(t);
  const queued = Error('waiting for acknowledgement');
  await assert.rejects(receipts.saveExpenseWithReceipt({
    scope: receipts.expenseReceiptScope(), expenseId: 'offline-cost', photo: receiptPhoto(),
    saveExpense: async () => { throw queued; }, isQueuedWrite: error => error === queued,
  }), error => error === queued);
  assert.ok(await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'offline-cost'));
});

test('an account change during photo storage cancels the expense mutation and does not expose or misassign the original', async t => {
  const { db } = receiptEnvironment(t);
  let release!: () => void;
  db.pauseNext = new Promise<void>(resolve => { release = resolve; });
  let saved = false;
  const pending = saveReceipt('racing-cost', receiptPhoto(), async () => { saved = true; });
  // Let the image header and opening request finish so the storage operation is waiting.
  await new Promise<void>(resolve => setImmediate(resolve));
  bindMountedAccountLocalStorageUid('farmer-b');
  release();
  await assert.rejects(pending, /account or workspace changed/);
  assert.equal(saved, false);
  assert.equal(db.rows.size, 0);
  assert.equal(await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'racing-cost'), null);
});

test('a photo load started by A cannot display after the mounted account changes to B', async t => {
  const { db } = receiptEnvironment(t);
  await saveReceipt('private-cost');
  let release!: () => void;
  db.pauseNext = new Promise<void>(resolve => { release = resolve; });
  const pending = receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'private-cost');
  await new Promise<void>(resolve => setImmediate(resolve));
  bindMountedAccountLocalStorageUid('farmer-b');
  release();
  assert.equal(await pending, null);
});

test('receipt validation rejects oversized, disguised or unsupported files without saving an expense', async t => {
  const { db } = receiptEnvironment(t);
  await assert.rejects(saveReceipt('bad', new File(['<svg></svg>'], 'receipt.png', { type: 'image/png' })), /not a readable/);
  await assert.rejects(saveReceipt('large', new File([new Uint8Array(receipts.EXPENSE_RECEIPT_MAX_BYTES + 1)], 'large.png', { type: 'image/png' })), /up to 10 MB/);
  await assert.rejects(saveReceipt('pdf', new File(['%PDF-1.7'], 'receipt.pdf', { type: 'application/pdf' })), /JPG, PNG or WebP/);
  assert.equal(db.rows.size, 0);
});

test('choosing or cancelling a photo cannot persist it or invoke paid AI; explicit reading preserves the original draft', () => {
  const pickStart = recordsPage.indexOf('async function handlePickReceipt');
  const scanStart = recordsPage.indexOf('async function handleScan()', pickStart);
  const submitStart = recordsPage.indexOf('async function handleSubmit', scanStart);
  assert.ok(pickStart > 0 && scanStart > pickStart && submitStart > scanStart);
  const pick = recordsPage.slice(pickStart, scanStart);
  const scan = recordsPage.slice(scanStart, submitStart);
  assert.match(pick, /setReceiptPhoto\(file\)/);
  assert.doesNotMatch(pick, /fetch\(|saveExpenseWithReceipt\(|addExpense\(/);
  assert.doesNotMatch(scan, /setReceiptPhoto\(null\)/, 'AI must not discard the original after extracting the amount');
  assert.ok(scan.indexOf('if (isSampleMode())') < scan.indexOf('fetch('), 'sample photos never go to paid AI');
  assert.match(scan, /paidApiHeaders\(requestUser\)/, 'a pending file read must not take a different account’s token');
  assert.match(scan, /currentUser\?\.uid !== requestUser.uid/);
  assert.match(recordsPage, /disabled=\{form.loading \|\| readingPhoto \|\| scanning\}/, 'a save cannot race an unfinished photo selection');
  const close = recordsPage.slice(recordsPage.indexOf('function closeForm()'), recordsPage.indexOf('if (!open && !alwaysOpen)'));
  assert.doesNotMatch(close, /addExpense|saveExpenseWithReceipt/);
  const viewer = read('../components/records/ReceiptPreview.tsx');
  assert.match(viewer, /loadExpenseReceipt\(scope, expense.id\)/);
  assert.match(viewer, /isSampleMode\(\) && getSandboxExpenses/);
  assert.match(viewer, /No receipt photo is saved/);
  assert.match(viewer, /Download original/);
});


test('two overlapping failed receipt edits restore the committed original, never the other failed image', async t => {
  receiptEnvironment(t);
  await saveReceipt('shared-cost', receiptPhoto('original.jpg'));
  let rejectA!: (cause: Error) => void;
  let rejectB!: (cause: Error) => void;
  let startedA!: () => void;
  let startedB!: () => void;
  const aStarted = new Promise<void>(resolve => { startedA = resolve; });
  const bStarted = new Promise<void>(resolve => { startedB = resolve; });
  const a = saveReceipt('shared-cost', receiptPhoto('failed-A.jpg'), () => { startedA(); return new Promise<void>((_resolve, reject) => { rejectA = reject; }); });
  const aFailed = assert.rejects(a, /A rejected/);
  await aStarted;
  const b = saveReceipt('shared-cost', receiptPhoto('failed-B.jpg'), () => { startedB(); return new Promise<void>((_resolve, reject) => { rejectB = reject; }); });
  const bFailed = assert.rejects(b, /B rejected/);
  await bStarted;
  rejectA(Error('A rejected'));
  await aFailed;
  rejectB(Error('B rejected'));
  await bFailed;
  const restored = await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'shared-cost');
  assert.equal(restored?.name, 'original.jpg');
});

test('a slower failed receipt edit cannot undo a newer successfully saved photo', async t => {
  receiptEnvironment(t);
  await saveReceipt('shared-cost', receiptPhoto('original.png'));
  let rejectA!: (cause: Error) => void;
  let startedA!: () => void;
  const aStarted = new Promise<void>(resolve => { startedA = resolve; });
  const a = saveReceipt('shared-cost', receiptPhoto('failed-A.png'), () => { startedA(); return new Promise<void>((_resolve, reject) => { rejectA = reject; }); });
  const aFailed = assert.rejects(a, /A rejected/);
  await aStarted;
  await saveReceipt('shared-cost', receiptPhoto('saved-B.png'));
  rejectA(Error('A rejected')); await aFailed;
  assert.equal((await receipts.loadExpenseReceipt(receipts.expenseReceiptScope(), 'shared-cost'))?.name, 'saved-B.png');
});

test('desktop backdrop and Escape dismissal preserve a cost draft while its save is pending', () => {
  assert.match(recordsPage, /onSavingChange=\{setDesktopEntrySaving\}/);
  const modal = recordsPage.slice(recordsPage.indexOf('{desktopEntryOpen && ('), recordsPage.indexOf('Phone / tablet: the simple money view'));
  assert.match(modal, /onClick=\{\(\) => \{ if \(!desktopEntrySaving\)/);
  assert.match(modal, /e.key !== 'Escape'/);
  assert.equal((modal.match(/if \(!desktopEntrySaving\)/g) ?? []).length, 2, 'both backdrop and Escape must respect the pending write');
});

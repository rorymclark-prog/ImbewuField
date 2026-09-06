import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';

const KEY = 'imbewu_evidence_v1';

const accountHarness: { currentUid: string | null } = { currentUid: null };
Object.assign(globalThis, { __imbewuSiteEvidenceAccountHarness: accountHarness });
const fakeFirebaseInit = `data:text/javascript,${encodeURIComponent(`
const harness = globalThis.__imbewuSiteEvidenceAccountHarness;
export const getFirebase = () => ({
  auth: { currentUser: harness.currentUid ? { uid: harness.currentUid } : null },
});
export const isBackendConfigured = () => Boolean(harness.currentUid);
`)}`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.includes('/lib/account-local-storage.ts')
        && specifier === './firebase/init') {
      return { url: fakeFirebaseInit, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

class MemoryStorage {
  readonly rows = new Map<string, string>();
  failWrites = false;
  getItem(key: string): string | null { return this.rows.get(key) ?? null; }
  setItem(key: string, value: string): void {
    if (this.failWrites) throw new Error('quota exceeded');
    this.rows.set(key, value);
  }
}

const storage = new MemoryStorage();
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { localStorage: storage },
});
const evidence = await import('../lib/site-evidence.ts');
const { accountLocalStorageKey } = await import('../lib/account-local-storage.ts');
hooks.deregister();

function reset(): void {
  storage.rows.clear();
  storage.failWrites = false;
  accountHarness.currentUid = null;
}

test('lab PDFs retain their bytes separately and cannot be read through another site',async()=>{
  const g=window as unknown as {sessionStorage:unknown};
  g.sessionStorage={getItem:()=> '1'};
  const documents=await import('../lib/evidence-documents');
  try{
    const file=new File(['%PDF-1.4\nLab fixture'], 'lab.pdf', {type:'application/pdf'});
    const scope=documents.evidenceDocumentScope('site-a');
    const id=await documents.saveEvidenceDocument(scope,file);
    assert.equal(await (await documents.loadEvidenceDocument('site-a',id))!.text(),await file.text());
    assert.equal(await documents.loadEvidenceDocument('site-b',id),null);
    await documents.removeEvidenceDocument(scope,id);
    assert.equal(await documents.loadEvidenceDocument('site-a',id),null);
    await assert.rejects(documents.saveEvidenceDocument(scope,new File(['not PDF'],'bad.pdf')));
    assert.equal(documents.validEvidencePdf('%PDF-',10*1024*1024+1),false);
  }finally{g.sessionStorage={getItem:()=>null};}
});

test('malformed persisted sites, keys and rows are filtered into a safe store', () => {
  reset();
  storage.setItem(KEY, JSON.stringify({
    site: {
      items: {
        water_tank: [
          { id: 'good', type: 'photo', dataUrl: 'data:image/jpeg;base64,a', takenAt: 1 },
          { id: 'bad-time', type: 'photo', dataUrl: 'x', takenAt: null },
          { id: 'bad-type', type: 'video', dataUrl: 'x', takenAt: 2 },
          { id: 'empty-photo', type: 'photo', takenAt: 3 },
        ],
        constructor: [{ id: 'unsafe', type: 'note', note: 'x', takenAt: 4 }],
      },
      quickNumbers: { water: { capacity: '2500', constructor: 'unsafe' } },
    },
    broken: 'not a site',
  }));

  assert.deepEqual(evidence.getEvidenceItems('site', 'water_tank').map((item) => item.id), ['good']);
  assert.deepEqual(evidence.getQuickNumbers('site', 'water'), { capacity: '2500' });
  assert.deepEqual(evidence.getSiteEvidence('broken'), {});
  assert.equal(evidence.getTotalEvidenceCount('site'), 1);
});

test('unsafe keys and invalid payloads are rejected without touching storage', () => {
  reset();
  const before = storage.getItem(KEY);
  const photo = { type: 'photo' as const, dataUrl: 'data:image/jpeg;base64,a' };

  assert.equal(evidence.addEvidenceItem('__proto__', 'water_tank', photo), false);
  assert.equal(evidence.addEvidenceItem('site', 'constructor', photo), false);
  assert.equal(evidence.addEvidenceItem('site', 'water_tank', { type: 'photo' }), false);
  assert.equal(evidence.setQuickNumber('site', '__proto__', 'capacity', '2500'), false);
  assert.equal(storage.getItem(KEY), before);
});

test('per-key retention is bounded and drops the oldest item rather than insertion position', () => {
  reset();
  for (let index = 0; index < 12; index += 1) {
    assert.equal(evidence.addEvidenceItem('site', 'water_tank', {
      type: 'note',
      note: `note-${index}`,
    }), true);
  }

  const items = evidence.getEvidenceItems('site', 'water_tank');
  assert.ok(items.length > 0 && items.length < 12);
  assert.equal(items.at(-1)?.note, 'note-11');
  assert.ok(items.every((item) => Number.isFinite(item.takenAt)));
});

test('a diligent survey is kept in full — eviction is storage pressure, not a round number', () => {
  // This asserted `count < 70`, which only passed because of a `MAX_TOTAL = 40` cap. That cap was
  // removed: the catalogue offers 52 evidence tiles at 4 items each — 208 the app itself invites
  // someone to record — so a forty-item ceiling silently deleted the work of anyone who did the
  // survey properly, while sitting far inside the 4 MB byte budget.
  //
  // The rule is that nothing is discarded until storage is actually under pressure. Seventy small
  // notes are nowhere near 4 MB, so all seventy survive.
  reset();
  for (let index = 0; index < 70; index += 1) {
    assert.equal(evidence.addEvidenceItem('site', `group_${index}`, {
      type: 'note',
      note: `note-${index}`,
    }), true);
  }

  assert.equal(evidence.getTotalEvidenceCount('site'), 70, 'small notes must not be evicted');
  assert.equal(evidence.getEvidenceItems('site', 'group_69')[0]?.note, 'note-69');
  assert.equal(evidence.getEvidenceItems('site', 'group_0')[0]?.note, 'note-0', 'the oldest survives too');
});

test('an item larger than the whole budget fails without evicting older evidence', () => {
  reset();
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'keep me',
  }), true);
  const before = storage.getItem(KEY);

  assert.equal(evidence.addEvidenceItem('site', 'site_photo', {
    type: 'photo',
    dataUrl: `data:image/jpeg;base64,${'a'.repeat(2_200_000)}`,
  }), false);
  assert.equal(storage.getItem(KEY), before);
  assert.equal(evidence.getEvidenceItems('site', 'soil_note')[0]?.note, 'keep me');
});

test('quota failure reports false and preserves persisted truth', () => {
  reset();
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'existing',
  }), true);
  const before = storage.getItem(KEY);
  storage.failWrites = true;

  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'not saved',
  }), false);
  assert.equal(storage.getItem(KEY), before);

  storage.failWrites = false;
});

test('remove and quick-number summaries reflect only persisted changes', () => {
  reset();
  assert.equal(evidence.setQuickNumber('site', 'water', 'tank_capacity', '2500'), true);
  assert.equal(evidence.getReportCompleteness('site') > 0, true);
  assert.deepEqual(evidence.getQuickNumbers('site', 'water'), { tank_capacity: '2500' });

  assert.equal(evidence.addEvidenceItem('site', 'water_rain_tanks', {
    type: 'note',
    note: 'tank checked',
  }), true);
  const [item] = evidence.getEvidenceItems('site', 'water_rain_tanks');
  assert.equal(evidence.removeEvidenceItem('site', 'water_rain_tanks', 'missing'), false);
  assert.equal(evidence.removeEvidenceItem('site', 'water_rain_tanks', item.id), true);
  assert.equal(evidence.getGroupCount('site', 'water'), 0);
  assert.equal(evidence.getReportCompleteness('site') > 0, true, 'quick number still covers water');
});

test("one shared device never exposes farmer A's evidence to farmer B", () => {
  reset();
  storage.setItem(KEY, JSON.stringify({
    site: {
      items: { soil_note: [{ id: 'legacy', type: 'note', note: 'unknown owner', takenAt: 1 }] },
      quickNumbers: {},
    },
  }));

  accountHarness.currentUid = 'farmer-a';
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'farmer A only',
  }), true);

  accountHarness.currentUid = 'farmer-b';
  assert.deepEqual(evidence.getEvidenceItems('site', 'soil_note'), []);
  assert.equal(evidence.addEvidenceItem('site', 'soil_note', {
    type: 'note',
    note: 'farmer B only',
  }), true);

  accountHarness.currentUid = 'farmer-a';
  assert.deepEqual(
    evidence.getEvidenceItems('site', 'soil_note').map((item) => item.note),
    ['farmer A only'],
  );
  assert.ok(storage.getItem(accountLocalStorageKey(KEY, 'farmer-a')));
  assert.ok(storage.getItem(accountLocalStorageKey(KEY, 'farmer-b')));
  assert.ok(storage.getItem(KEY), 'unowned legacy evidence remains quarantined');
});

import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after, beforeEach } from 'node:test';
import { bindMountedAccountLocalStorageUid } from '../lib/account-local-storage.ts';
import { cycleHarvestDocumentId, makeCycleHarvestLink } from '../lib/cycle-harvest.ts';
import type { GrowerJournalLink } from '../lib/field-journal.ts';
import { buildGreenHorizonLettuceTarget } from '../lib/green-horizon-demo.ts';
import {
  addSandboxProduction, deleteSandboxProduction, enterSampleMode, exitSampleMode, getSandboxProduction,
} from '../lib/sample-mode.ts';

const user = 'owner';
const oldDay = '2026-08-04';
const observedOn = '2026-08-06';
const recordId = 'picked-1';
const rowPath = 'production_logs/' + recordId;
const linkPath = 'user_map_data/' + user + '/data/' + cycleHarvestDocumentId(recordId);
const plan: GrowerJournalLink = {
  version: 1, scope: { kind: 'mapped-site', siteId: 'site:0.00000,0.00000' },
  plantingId: 'accepted-cycle', bedId: 'bed-a', eventKind: 'first-pick', plannedDate: oldDay,
};
const row = { profile_id: user, crop: 'Cabbage', quantity: 2, unit: 'bunches', kg: null, logged_at: '2026-08-09T10:21:00Z' };

type Data = Record<string, unknown>;
const state = {
  documents: new Map<string, Data>(), pending: new Set<string>(), denied: new Set<string>(),
  auth: { currentUser: { uid: user } }, reads: 0, writes: 0, duringTransactionGet: null as (() => void) | null,
};
Object.assign(globalThis, { __cycleHarvestTest: state });

const mockedFirestore = `
const s=globalThis.__cycleHarvestTest;
export function collection(db,...segments){return segments.join('/')}
export function doc(collection,id){return collection+'/'+id}
export function where(field,op,value){return {field,value}}
export function query(path,condition){return {path,condition}}
function snapshot(path){
  if(s.denied.has(path))throw Error('permission denied');
  const value=s.documents.get(path);
  return {id:path.split('/').at(-1),exists:()=>!!value,data:()=>value,
    metadata:{fromCache:false,hasPendingWrites:s.pending.has(path)}};
}
export async function getDocFromServer(path){s.reads++;return snapshot(path);}
export async function getDocsFromServer({path,condition}){
  s.reads++;
  const docs=[...s.documents].filter(([key,value])=>key.slice(0,key.lastIndexOf('/'))===path
    && value[condition.field]===condition.value).map(([key])=>snapshot(key));
  return {docs};
}
export async function runTransaction(db, action){
  const staged=[];
  const result=await action({get:async path=>{
    const snap=snapshot(path);s.reads++;s.duringTransactionGet?.();return snap;
  },set:(path,value)=>staged.push([path,value]),delete:path=>staged.push([path,null])});
  for(const [path,value] of staged){if(value===null)s.documents.delete(path);else s.documents.set(path,value);s.writes++;}
  return result;
}
`;
const adapter = new URL('../lib/db/cycle-harvest.ts', import.meta.url).href;
const hooks = registerHooks({
  resolve(specifier, context, next) {
    if (context.parentURL === adapter && specifier === 'firebase/firestore') return {
      shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(mockedFirestore),
    };
    if (context.parentURL === adapter && specifier === '../firebase/init') return {
      shortCircuit: true,
      url: 'data:text/javascript,' + encodeURIComponent('export const getFirebase=()=>({auth:globalThis.__cycleHarvestTest.auth,db:{}})'),
    };
    return next(specifier, context);
  },
});
const { captureCycleHarvestReport, captureGardenCycleHarvest, linkExistingCycleHarvest, readCycleHarvestOptions, unlinkExistingCycleHarvest } = await import('../lib/db/cycle-harvest.ts');
after(() => hooks.deregister());

class TestStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
  clear() { this.data.clear(); }
}
const current = () => true;
beforeEach(() => {
  const localStorage = new TestStorage(), sessionStorage = new TestStorage();
  Object.assign(globalThis, { Storage: TestStorage, localStorage, sessionStorage,
    window: Object.assign(new EventTarget(), { localStorage, sessionStorage }) });
  state.documents.clear();
  state.pending.clear();
  state.denied.clear();
  state.reads = 0;
  state.writes = 0;
  state.duringTransactionGet = null;
  state.auth.currentUser = { uid: user };
  bindMountedAccountLocalStorageUid(user);
  state.documents.set(rowPath, row);
});
function association(planRef = plan, date = observedOn, id = recordId) {
  const link = makeCycleHarvestLink(planRef, 'cabbage', { recordId: id, observedOn: date });
  assert.ok(link);
  return link;
}
async function displayed() {
  const result = await readCycleHarvestOptions('cabbage', current);
  assert.equal(result.status, 'ready');
  assert.equal(result.options.length, 1);
  return result.options[0];
}

test('one explicit cycle link retains observed day and the canonical record across repeat and competing writes', async () => {
  const option = await displayed();
  assert.equal(option.enteredAt, '2026-08-09');
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: false });
  const link = association();
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'saved' });
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'saved' });
  assert.deepEqual(await linkExistingCycleHarvest(association({ ...plan, plantingId: 'other-cycle' }), option, current), { status: 'conflict' });
  assert.deepEqual(await linkExistingCycleHarvest(association(plan, '2026-08-05'), option, current), { status: 'conflict' });
  assert.equal(state.writes, 1);
  assert.strictEqual(state.documents.get(rowPath), row);
  assert.strictEqual(state.documents.get(linkPath), link);
  assert.equal('quantity' in link || 'unit' in link, false);
  const harvested = await captureCycleHarvestReport(plan, 'cabbage', current);
  assert.deepEqual(harvested.evidence, { status: 'ready', rows: [{ recordId, observedOn, quantity: 2, unit: 'bunches' }], incomplete: false });
  assert.equal(await harvested.checkCurrent(), true);
  assert.deepEqual((await captureCycleHarvestReport({ ...plan, plantingId: 'other-cycle' }, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: false });
});

test('changed, pending, withdrawn and foreign source records cannot gain a link', async () => {
  const option = await displayed(), link = association();
  assert.deepEqual(await linkExistingCycleHarvest(association(plan, '2099-11-25'), option, current), { status: 'held' });
  state.documents.set(rowPath, { ...row, quantity: 3 });
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'held' });
  state.documents.set(rowPath, { ...row, profile_id: 'somebody-else' });
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'held' });
  state.documents.set(rowPath, row);
  state.pending.add(rowPath);
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'held' });
  state.pending.clear();
  state.duringTransactionGet = () => { state.auth.currentUser = { uid: 'switched' }; };
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'held' });
  assert.equal(state.writes, 0);
  assert.equal(state.documents.has(linkPath), false);
});

test('garden read keeps recorded day and guarded explicit zero without changing harvest entry', async () => {
  const option = await displayed();
  assert.equal((await linkExistingCycleHarvest(association(), option, current)).status, 'saved');
  const before = await captureGardenCycleHarvest(plan, 'cabbage', current);
  assert.deepEqual(before.evidence, { status: 'ready', incomplete: false,
    rows: [{ recordId, observedOn, recordedOn: '2026-08-09', quantity: 2, unit: 'bunches' }] });
  state.documents.set(rowPath, { ...row, logged_at: '2026-08-09T23:58:00-02:00', unit: 'kg', kg: 0, quantity: 0 });
  assert.equal(await before.checkCurrent(), false);
  const zero = await captureGardenCycleHarvest(plan, 'cabbage', current);
  assert.deepEqual(zero.evidence, { status: 'ready', incomplete: false,
    rows: [{ recordId, observedOn, recordedOn: '2026-08-10', quantity: 0, unit: 'kg' }] });
  assert.deepEqual((await readCycleHarvestOptions('cabbage', current)).options, []);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: true });
  state.documents.set(rowPath, { ...row, logged_at: '2026-08-09Tbad' });
  const unknownDate = await captureGardenCycleHarvest(plan, 'cabbage', current);
  assert.equal(unknownDate.evidence.status, 'ready');
  if (unknownDate.evidence.status === 'ready') assert.equal(unknownDate.evidence.rows[0]?.recordedOn, null);
  assert.equal(await zero.checkCurrent(), false);
  const foreign = await captureGardenCycleHarvest({ ...plan, scope: { kind: 'mapped-site', siteId: 'site:1.00000,0.00000' } }, 'cabbage', current);
  assert.deepEqual(foreign.evidence, { status: 'ready', rows: [], incomplete: true });
  state.documents.set(rowPath, { ...row, profile_id: 'somebody-else' });
  assert.deepEqual((await captureGardenCycleHarvest(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: true });
  assert.equal(state.writes, 1);
});

test('export rechecks after a quantity edit and omits unavailable or changed-product records', async () => {
  assert.deepEqual(await linkExistingCycleHarvest(association(), await displayed(), current), { status: 'saved' });
  const prior = await captureCycleHarvestReport(plan, 'cabbage', current);
  state.documents.set(rowPath, { ...row, quantity: 3 });
  assert.equal(await prior.checkCurrent(), false);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence, {
    status: 'ready', rows: [{ recordId, observedOn, quantity: 3, unit: 'bunches' }], incomplete: false,
  });
  state.documents.set(rowPath, { ...row, crop: 'Tomatoes' });
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: true });
  state.documents.delete(rowPath);
  state.denied.add(rowPath);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: true });
});

test('sample links use the existing sample harvest book and are withdrawn on deletion or session restart', async () => {
  assert.equal(enterSampleMode(), true);
  addSandboxProduction({ crop: 'Cabbage', quantity: 4, unit: 'crates', kg: null });
  const options = await readCycleHarvestOptions('cabbage', current);
  const selected = options.options.find(option => option.unit === 'crates');
  assert.ok(selected);
  const link = association(plan, observedOn, selected.recordId);
  const original = getSandboxProduction();
  assert.deepEqual(await linkExistingCycleHarvest(link, selected, current), { status: 'saved' });
  assert.strictEqual(getSandboxProduction(), original);
  const reused = await captureCycleHarvestReport(plan, 'cabbage', current);
  assert.deepEqual(reused.evidence, { status: 'ready', rows: [
    { recordId: selected.recordId, observedOn, quantity: 4, unit: 'crates' },
  ], incomplete: false });
  deleteSandboxProduction(selected.recordId);
  assert.equal(reused.isCurrent(), false);
  assert.equal(await reused.checkCurrent(), false);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence, { status: 'ready', rows: [], incomplete: true });
  exitSampleMode();
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
  assert.equal((window.localStorage as unknown as TestStorage).data.size, 0);
  assert.equal(enterSampleMode(), true);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence, { status: 'ready', rows: [], incomplete: false });
  exitSampleMode();
});

test('Green Horizon can link its own practice harvest, with no access after switching or restarting', async () => {
  assert.equal(enterSampleMode('green-horizon'), true);
  const { siteId, window: { start } } = buildGreenHorizonLettuceTarget();
  const reference: GrowerJournalLink = {
    version: 1, scope: { kind: 'mapped-site', siteId }, plantingId: 'green-horizon-bed-a1-planting',
    bedId: 'green-horizon-bed-a1', eventKind: 'first-pick', plannedDate: start,
  };
  const options = await readCycleHarvestOptions('lettuce', current, reference);
  assert.equal(options.status, 'ready');
  const selected = options.options.find(option => option.recordId === 'green-horizon-example-harvest');
  assert.ok(selected);
  const link = makeCycleHarvestLink(reference, 'lettuce', { recordId: selected.recordId, observedOn: start });
  assert.ok(link);
  assert.deepEqual(await linkExistingCycleHarvest(link, selected, current), { status: 'saved' });
  const report = await captureGardenCycleHarvest(reference, 'lettuce', current);
  assert.deepEqual(report.evidence, {
    status: 'ready', rows: [{ recordId: selected.recordId, observedOn: start, recordedOn: start, quantity: 6, unit: 'kg' }],
    incomplete: false,
  });
  assert.equal(await report.checkCurrent(), true);

  const pending = readCycleHarvestOptions('lettuce', current, reference);
  assert.equal(enterSampleMode(), true);
  assert.deepEqual(await pending, { status: 'held', options: [] });
  assert.equal(await report.checkCurrent(), false);
  assert.deepEqual(await linkExistingCycleHarvest(link, selected, current), { status: 'held' });
  assert.equal(enterSampleMode('green-horizon'), true);
  const restarted = await readCycleHarvestOptions('lettuce', current, reference);
  assert.equal(restarted.status, 'ready');
  assert.deepEqual(restarted.linked, []);
  assert.ok(restarted.options.some(option => option.recordId === selected.recordId));
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
  exitSampleMode();
});

test('only the exact current private link can be removed even when its harvest is unavailable', async () => {
  const option = await displayed();
  const link = association();
  assert.deepEqual(await linkExistingCycleHarvest(link, option, current), { status: 'saved' });
  const report = await captureCycleHarvestReport(plan, 'cabbage', current);
  assert.deepEqual(await unlinkExistingCycleHarvest(association({ ...plan, plantingId: 'wrong' }), current), { status: 'conflict' });
  assert.deepEqual(await unlinkExistingCycleHarvest(association(plan, '2026-08-05'), current), { status: 'conflict' });
  assert.deepEqual(await unlinkExistingCycleHarvest(association({ ...plan, bedId: 'other-bed' }), current), { status: 'conflict' });
  assert.deepEqual(await unlinkExistingCycleHarvest(association({ ...plan, scope: { kind: 'mapped-site', siteId: 'site:1.00000,1.00000' } }), current), { status: 'conflict' });
  assert.deepEqual(await unlinkExistingCycleHarvest(link, () => false), { status: 'held' });
  assert.equal(state.writes, 1);
  // The row was edited to another product, so the old cycle still offers its association for removal only.
  state.documents.set(rowPath, { ...row, crop: 'Tomatoes' });
  const picker = await readCycleHarvestOptions('cabbage', current, plan);
  assert.deepEqual(picker, { status: 'ready', options: [], linked: [{ recordId, observedOn }] });
  assert.deepEqual(await unlinkExistingCycleHarvest(link, current), { status: 'saved' });
  assert.deepEqual(await unlinkExistingCycleHarvest(link, current), { status: 'saved' });
  assert.equal(state.writes, 2);
  assert.equal(state.documents.get(rowPath)?.crop, 'Tomatoes');
  assert.equal(state.documents.has(linkPath), false);
  assert.equal(await report.checkCurrent(), false);
  assert.deepEqual((await captureCycleHarvestReport(plan, 'cabbage', current)).evidence,
    { status: 'ready', rows: [], incomplete: false });
  state.documents.set(rowPath, row);
  assert.deepEqual(await linkExistingCycleHarvest(association(plan, '2026-08-05'), option, current), { status: 'saved' });
  assert.equal(state.documents.get(linkPath)?.observedOn, '2026-08-05');
});

test('an unreadable sample flag holds the operation even with a signed-in Firebase owner', async () => {
  Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw Error('Storage unavailable'); } });
  assert.deepEqual(await readCycleHarvestOptions('cabbage', current), { status: 'held', options: [] });
  const report = await captureCycleHarvestReport(plan, 'cabbage', current);
  assert.deepEqual(report.evidence, { status: 'held' });
  assert.equal(state.reads, 0);
  assert.equal(state.writes, 0);
});

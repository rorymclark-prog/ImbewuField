import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test, { after } from 'node:test';
import type { GrowerWorkflowSourceRequest } from '../lib/international/grower-workflow-source.ts';

class MemoryStorage {
  rows = new Map<string, string>(); onRead: (() => void) | null = null; failRead = false;
  get length() { return this.rows.size; }
  getItem(key: string) { if (this.failRead) throw Error('unreadable'); this.onRead?.(); return this.rows.get(key) ?? null; }
  setItem(key: string, value: string) { this.rows.set(key, String(value)); }
  removeItem(key: string) { this.rows.delete(key); }
  clear() { this.rows.clear(); }
  key(index: number) { return [...this.rows.keys()][index] ?? null; }
}
const local = new MemoryStorage(), session = new MemoryStorage();
const originals = new Map(['window', 'localStorage', 'sessionStorage', 'Storage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
Object.assign(globalThis, { window: Object.assign(new EventTarget(), { localStorage: local, sessionStorage: session }),
  localStorage: local, sessionStorage: session, Storage: MemoryStorage });
const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier === './firebase/init' || specifier === '@/lib/firebase/init') return {
    url: 'data:text/javascript,export const getFirebase=()=>null;export const isBackendConfigured=()=>false;', shortCircuit: true,
  };
  return next(specifier, context);
} });
const { inspectGrowerWorkflowSource, fingerprintGrowerWorkflowSource, growerWorkflowResourceSiteId } = await import('../lib/international/grower-workflow-source.ts');
const { readCanvasSourceReceipt, normaliseCanvasState } = await import('../lib/design-canvas.ts');
const { readFacilitatorSourceReceipt, normaliseFacilitatorState } = await import('../lib/facilitator-design.ts');
const { activeAccountLocalStorageKey, bindMountedAccountLocalStorageUid } = await import('../lib/account-local-storage.ts');
const { enterSampleMode, exitSampleMode, setSandboxFacilitatorState } = await import('../lib/sample-mode.ts');
after(() => {
  exitSampleMode(); hooks.deregister(); bindMountedAccountLocalStorageUid(null);
  for (const [key, descriptor] of originals) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
});
test.beforeEach(() => { exitSampleMode(); local.clear(); session.clear(); local.onRead = null; local.failRead = false; bindMountedAccountLocalStorageUid('fixture-owner-a'); });

// Synthetic authored geometry, not farm coordinates or agricultural recommendations.
const siteId = 'site:0.00000,0.00000';
const stamp = '2026-11-04T12:00:00.000Z';
function studio() {
  return { siteId, frame: { centerLng: 0, centerLat: 0, zoom: 10, imgW: 100, imgH: 100, mPerPx: 1 },
    items: [{ id: 's-bed', defId: 'veg_bed', x: 0.5, y: 0.5, wM: 2, hM: 4, rot: 0 }],
    zones: [{ id: 's-field', zone: 1, feature: 'staple_garden', points: [[0.1, 0.1], [0.2, 0.1], [0.2, 0.2], [0.1, 0.2]] }],
    lines: [{ id: 's-path', kind: 'bedpath', points: [[0.1, 0.1], [0.2, 0.1]], widthM: 1 }], step: 'planting', updatedAt: stamp, rev: 1 };
}
function facilitator() {
  return { version: 1, geomVersion: 2, designId: 'saved-fixture', items: [
    { id: 'f-bed', type: 'bed', x: 10, y: 10, xM: 1, yM: 1, wM: 2, hM: 4, rotation: 0 }],
    lines: [{ id: 'f-path', kind: 'path', points: [0, 0, 10, 0], pointsM: [0, 0, 1, 0] }], sectors: [],
    pxPerM: 10, activeLayer: 'planting', hiddenLayers: [], savedAt: 1, bgRect: { x: 0, y: 0, w: 100, h: 100 } };
}
function input(raw: unknown = studio(), kind: GrowerWorkflowSourceRequest['kind'] = 'studio-canvas', sourceId = siteId): GrowerWorkflowSourceRequest {
  return { kind, sourceId, raw, sourceRevision: JSON.stringify(raw) };
}
async function ready(request = input()) {
  const inspection = inspectGrowerWorkflowSource(request);
  assert.equal(inspection.status, 'inspected');
  const source = await fingerprintGrowerWorkflowSource(inspection);
  assert.equal(source.status, 'ready'); if (source.status !== 'ready') throw Error('Source held');
  return source;
}

test('Studio reads exact authored geometry and derives only existing explicit or calibrated allocations', async () => {
  const raw = studio(), before = JSON.stringify(raw), source = await ready(input(raw));
  assert.deepEqual(source.beds.map(bed => [bed.id, bed.areaM2]), [['s-bed', 8], ['s-field', 100]]);
  assert.deepEqual(source.measuredAreas.map(area => area.basis), ['explicit-saved-dimensions', 'calibrated-saved-polygon']);
  assert.deepEqual(source.scope, { kind: 'mapped-site', siteId });
  assert.equal(source.resourceSiteId, siteId); assert.equal(growerWorkflowResourceSiteId(source), siteId);
  assert.match(source.geometryFingerprint, /^[a-f0-9]{64}$/); assert.match(source.sourceRevision, /^[a-f0-9]{64}$/);
  assert.equal(source.sourceVerification, 'not-verified'); assert.equal(JSON.stringify(raw), before);
  assert.equal(Object.isFrozen(raw.items), false); assert.equal(Object.isFrozen(source.beds[0]), true);
});

test('navigation and save counters change raw revision while preserving geometry identity', async () => {
  const first = studio(), second = { ...studio(), step: 'review', updatedAt: '2026-11-05T12:00:00.000Z', rev: 2 };
  const a = await ready(input(first)), b = await ready(input(second));
  assert.equal(a.geometryFingerprint, b.geometryFingerprint); assert.notEqual(a.sourceRevision, b.sourceRevision);
  const reordered = Object.fromEntries(Object.entries(first).reverse());
  assert.equal((await ready(input(reordered))).geometryFingerprint, a.geometryFingerprint);
});

test('equal-area moves, rotations, ring and path edits and calibration changes invalidate geometry', async () => {
  const first = await ready();
  const mutations = [
    (raw: ReturnType<typeof studio>) => { raw.items[0].x += 0.1; },
    (raw: ReturnType<typeof studio>) => { raw.items[0].rot = 90; },
    (raw: ReturnType<typeof studio>) => { raw.zones[0].points.forEach(point => { point[0] += 0.1; }); },
    (raw: ReturnType<typeof studio>) => { raw.lines[0].points[1][1] += 0.1; },
    (raw: ReturnType<typeof studio>) => { raw.frame.mPerPx = 2; },
  ];
  for (const mutate of mutations) { const raw = studio(); mutate(raw); assert.notEqual((await ready(input(raw))).geometryFingerprint, first.geometryFingerprint); }
  const moved = studio(); moved.items[0].x += 0.1;
  assert.deepEqual((await ready(input(moved))).beds, first.beds, 'equal metrics cannot conceal the authored move');
});

test('field block config changes are bound and malformed/orphan block metadata cannot imply capacity', async () => {
  const raw = { ...studio(), zones: studio().zones.map(zone => ({ ...zone,
    fieldBlock: { mode: 'beds', bedLengthM: 4, bedWidthM: 2, pathWidthM: 1, angleDeg: 0 } })) };
  const first = await ready(input(raw)); assert.deepEqual(first.beds.map(bed => bed.id), ['s-bed']);
  const changed = structuredClone(raw); changed.zones[0].fieldBlock.pathWidthM = 2;
  assert.notEqual((await ready(input(changed))).geometryFingerprint, first.geometryFingerprint);
  const corrupt = structuredClone(raw); corrupt.zones[0].fieldBlock.mode = 'invalid';
  assert.equal(inspectGrowerWorkflowSource(input(corrupt)).status, 'held');
  const orphan = { ...studio(), items: studio().items.map(item => ({ ...item, fieldBlockId: 'not-a-field' })) };
  assert.equal(inspectGrowerWorkflowSource(input(orphan)).status, 'held');
});

test('missing saved dimensions are excluded honestly and never replaced by element or one-metre defaults', async () => {
  const s = JSON.parse(JSON.stringify(studio())); delete s.items[0].wM;
  const source = await ready(input(s));
  assert.deepEqual(source.beds.map(bed => bed.id), ['s-field']);
  assert.deepEqual(source.heldBeds, [{ bedId: 's-bed', reasons: ['explicit-saved-dimensions-required'] }]);
  const f = JSON.parse(JSON.stringify(facilitator())); delete f.items[0].hM;
  const localSource = await ready(input(f, 'facilitator-local', 'local'));
  assert.deepEqual(localSource.beds, []); assert.equal(localSource.heldBeds[0].bedId, 'f-bed');
  f.items[0].hM = 0;
  assert.equal(inspectGrowerWorkflowSource(input(f, 'facilitator-local', 'local')).status, 'held');
});

test('duplicate and corrupt raw rows stay held even if existing normalizers would salvage a first winner', () => {
  const duplicate = studio(); duplicate.items.push({ ...duplicate.items[0] });
  assert.ok(normaliseCanvasState(duplicate, siteId), 'legacy normalizer can deduplicate this source');
  assert.equal(inspectGrowerWorkflowSource(input(duplicate)).status, 'held');
  const cross = studio(); cross.lines[0].id = cross.items[0].id;
  assert.equal(inspectGrowerWorkflowSource(input(cross)).status, 'held');
  const f = facilitator(); f.items.push({ ...f.items[0], id: 'corrupt', wM: -1 });
  assert.equal(normaliseFacilitatorState(f)!.items.length, 1);
  assert.equal(inspectGrowerWorkflowSource(input(f, 'facilitator-local', 'local')).status, 'held');
  const partial = { ...facilitator(), items: facilitator().items.map(item => ({ ...item, xM: undefined })) };
  assert.equal(inspectGrowerWorkflowSource(input(partial, 'facilitator-local', 'local')).status, 'held');
});

test('authored source getters and inherited geometry cannot supply different validation and fingerprint inputs', () => {
  let reads = 0;
  const changing = { ...studio() };
  Object.defineProperty(changing, 'items', { enumerable: true, get() { reads++; return studio().items; } });
  assert.equal(inspectGrowerWorkflowSource({ kind: 'studio-canvas', sourceId: siteId,
    raw: changing, sourceRevision: 'synthetic-read' }).status, 'held');
  assert.equal(reads, 0, 'validation must not invoke an authored-source accessor');
  const inherited = Object.create(studio());
  assert.equal(inspectGrowerWorkflowSource(input(inherited)).status, 'held');
  const cloud = { id: 'cloud-fixture', owner_id: 'fixture-owner-a', data: { ...facilitator(), designId: 'cloud-fixture' } };
  Object.defineProperty(cloud.data, 'items', { enumerable: true, get() { reads++; return facilitator().items; } });
  const before = reads;
  const request = { kind: 'facilitator-cloud' as const, sourceId: 'cloud-fixture', raw: cloud, sourceRevision: 'synthetic-read' };
  assert.equal(inspectGrowerWorkflowSource(request).status, 'held');
  assert.equal(reads, before, 'a cloud document data accessor is not a fetched plain data snapshot');
});

test('facilitator saved metre geometry survives navigation changes and detects moves without fabricated savedAt', async () => {
  const raw = facilitator(), source = await ready(input(raw, 'facilitator-local', 'local'));
  assert.equal(source.beds[0].areaM2, 8); assert.equal(source.sourceId, 'saved-fixture');
  assert.deepEqual(source.scope, { kind: 'unmapped-workspace', workspaceId: 'design:saved-fixture' });
  assert.equal(source.resourceSiteId, 'design:local'); assert.equal(growerWorkflowResourceSiteId(source), 'design:local');
  const navigation = { ...raw, savedAt: 2, activeLayer: 'review', hiddenLayers: ['base'] };
  assert.equal((await ready(input(navigation, 'facilitator-local', 'local'))).geometryFingerprint, source.geometryFingerprint);
  const moved = structuredClone(raw); moved.items[0].xM += 1;
  assert.notEqual((await ready(input(moved, 'facilitator-local', 'local'))).geometryFingerprint, source.geometryFingerprint);
});

test('actual cloud rows retain document scope/resource identity instead of a synthesized local view', async () => {
  const data = { ...facilitator(), designId: 'cloud-fixture', bgSite: { lat: 0, lon: 0, name: 'Synthetic site' } };
  const row = { id: 'cloud-fixture', owner_id: 'fixture-owner-a', data };
  const source = await ready(input(row, 'facilitator-cloud', row.id));
  assert.deepEqual(source.scope, { kind: 'mapped-site', siteId }); assert.equal(source.resourceSiteId, 'design:cloud-fixture');
  assert.equal(growerWorkflowResourceSiteId(source), 'design:cloud-fixture');
  assert.equal(growerWorkflowResourceSiteId({ ...source, resourceSiteId: siteId }), null);
  assert.equal(growerWorkflowResourceSiteId({ ...source, sourceId: 'different-design' }), null);
  assert.equal(growerWorkflowResourceSiteId({ ...source, geometryFingerprint: '' }), null);
  assert.equal(growerWorkflowResourceSiteId({ ...source, status: 'inspected' }), null);
  assert.equal(inspectGrowerWorkflowSource(input(row, 'facilitator-cloud', 'wrong-document')).status, 'held');
  assert.equal(inspectGrowerWorkflowSource(input(data, 'facilitator-cloud', row.id)).status, 'held');
  const local = await ready(input({ ...facilitator(), bgSite: data.bgSite }, 'facilitator-local', 'local'));
  assert.equal(local.resourceSiteId, siteId); assert.notEqual(local.sourceKey, source.sourceKey);
});

test('image URLs and byte payloads never enter geometry fingerprints while photo calibration does', async () => {
  const raw = { ...studio(), customBase: { url: 'https://example.invalid/synthetic-image', uploadedAt: stamp, mPerPx: 1, scale: 1 }, useCustomBase: true };
  const inspection = inspectGrowerWorkflowSource(input(raw)); assert.equal(inspection.status, 'inspected');
  if (inspection.status !== 'inspected') return;
  assert.equal(inspection.geometryCanonical.includes('https://'), false);
  const a = await ready(input(raw)), b = await ready(input({ ...raw, customBase: { ...raw.customBase, url: 'https://example.invalid/other-image' } }));
  assert.equal(a.geometryFingerprint, b.geometryFingerprint); assert.notEqual(a.sourceRevision, b.sourceRevision);
  const c = await ready(input({ ...raw, customBase: { ...raw.customBase, scale: 2 } }));
  assert.notEqual(a.geometryFingerprint, c.geometryFingerprint);
});

test('inspection detaches before hashing and missing WebCrypto holds rather than returning a fake fingerprint', async () => {
  const raw = studio(), inspected = inspectGrowerWorkflowSource(input(raw));
  const pending = fingerprintGrowerWorkflowSource(inspected); raw.items[0].x += 0.1;
  const source = await pending; assert.equal(source.status, 'ready');
  assert.equal(source.status === 'ready' ? source.geometryFingerprint : '', (await ready()).geometryFingerprint);
  const original = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
  try {
    Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });
    const result = await fingerprintGrowerWorkflowSource(inspected); assert.equal(result.status, 'held');
    if (result.status === 'held') assert.deepEqual(result.reasons, ['secure-source-fingerprint-unavailable']);
  } finally { if (original) Object.defineProperty(globalThis, 'crypto', original); else Reflect.deleteProperty(globalThis, 'crypto'); }
});

test('real source receipts keep duplicate raw rows and bind the active account without writing or reading another owner', () => {
  const raw = studio(); raw.items.push({ ...raw.items[0] });
  const key = activeAccountLocalStorageKey(`imbewu_design_canvas_${siteId}`);
  local.setItem(key, JSON.stringify(raw));
  const before = JSON.stringify([...local.rows]);
  const receipt = readCanvasSourceReceipt(siteId); assert.equal(receipt.status, 'ready');
  if (receipt.status !== 'ready') return;
  assert.deepEqual(receipt.raw, raw); assert.equal(receipt.ownerUid, 'fixture-owner-a');
  assert.equal(inspectGrowerWorkflowSource(input(receipt.raw)).status, 'held');
  assert.equal(JSON.stringify([...local.rows]), before);
  bindMountedAccountLocalStorageUid('fixture-owner-b'); assert.equal(readCanvasSourceReceipt(siteId).status, 'held');
  bindMountedAccountLocalStorageUid('fixture-owner-a'); assert.equal(readCanvasSourceReceipt(siteId).status, 'ready');
});

test('source readers reject missing/corrupt/unreadable stores and late account changes rather than trusting normalization', () => {
  assert.equal(readCanvasSourceReceipt(siteId).status, 'held'); assert.equal(readFacilitatorSourceReceipt().status, 'held');
  local.setItem(activeAccountLocalStorageKey('imbewu_facilitator_design_v1'), '{broken');
  assert.equal(readFacilitatorSourceReceipt().status, 'held');
  local.setItem(activeAccountLocalStorageKey(`imbewu_design_canvas_${siteId}`), JSON.stringify(studio()));
  local.onRead = () => { local.onRead = null; bindMountedAccountLocalStorageUid('fixture-owner-b'); };
  const changed = readCanvasSourceReceipt(siteId); assert.equal(changed.status, 'held');
  if (changed.status === 'held') assert.deepEqual(changed.reasons, ['source-owner-changed']);
  local.failRead = true; assert.equal(readFacilitatorSourceReceipt().status, 'held');
});

test('late local-design owner and sample transitions cannot return a receipt for the old namespace', () => {
  local.setItem(activeAccountLocalStorageKey('imbewu_facilitator_design_v1'), JSON.stringify(facilitator()));
  local.onRead = () => { local.onRead = null; bindMountedAccountLocalStorageUid('fixture-owner-b'); };
  const owner = readFacilitatorSourceReceipt(); assert.equal(owner.status, 'held');
  if (owner.status === 'held') assert.deepEqual(owner.reasons, ['source-owner-changed']);
  bindMountedAccountLocalStorageUid('fixture-owner-a');
  local.onRead = () => { local.onRead = null; session.setItem('imbewu_sample_mode', '1'); };
  const sample = readFacilitatorSourceReceipt(); assert.equal(sample.status, 'held');
  if (sample.status === 'held') assert.deepEqual(sample.reasons, ['source-owner-changed']);
  exitSampleMode();
});

test('real sample shim and typed sample design stay separate from the account source receipts', () => {
  const key = activeAccountLocalStorageKey(`imbewu_design_canvas_${siteId}`), original = JSON.stringify(studio());
  local.setItem(key, original);
  assert.equal(enterSampleMode(), true);
  local.setItem(activeAccountLocalStorageKey(`imbewu_design_canvas_${siteId}`), JSON.stringify({ ...studio(), rev: 7 }));
  const sample = readCanvasSourceReceipt(siteId); assert.equal(sample.status, 'ready');
  if (sample.status === 'ready') { assert.equal(sample.sample, true); assert.equal(sample.ownerUid, null); assert.equal((sample.raw as { rev: number }).rev, 7); }
  setSandboxFacilitatorState(facilitator() as Parameters<typeof setSandboxFacilitatorState>[0]);
  const sampleLocal = readFacilitatorSourceReceipt(); assert.equal(sampleLocal.status, 'ready');
  if (sampleLocal.status === 'ready') assert.equal(sampleLocal.sample, true);
  exitSampleMode(); assert.equal(local.getItem(key), original);
  const actual = readCanvasSourceReceipt(siteId); assert.equal(actual.status, 'ready');
  if (actual.status === 'ready') assert.equal(actual.sample, false);
});

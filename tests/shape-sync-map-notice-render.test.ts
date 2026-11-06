import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import TestRenderer, { act, type ReactTestInstance } from 'react-test-renderer';
import type { ShapeSyncStatus, ShapeTransport } from '../lib/shape-sync/controller.ts';
import { createShapeSyncController, shapeSyncKeys, shapeSyncNotice } from '../lib/shape-sync/controller.ts';
import type { ConflictView } from '../lib/shape-sync/protocol.ts';
import { FakeShapeServer, MemoryStorage, makeDevice, renamed, square } from './shape-sync-v2-fakes.ts';
import { MAP_PATH, MAP_SOURCE, SEAMS, bind } from './map-source-seams.ts';

// B2 — the ordinary shapeSyncNotice 'info' status must be visible and non-blocking.
//
// What runs for real: Map.tsx's shape-sync banner JSX expression, extracted verbatim and rendered by
// React 18.3.1 through react-test-renderer; SHAPE_CONFLICT_TEXT from Map.tsx; the production
// shapeSyncNotice() wording; and every status / conflict below comes from a REAL controller put into
// that state (local-only, unresolved flush, offline flush, volatile journal, invalid journal row,
// corrupt remote, a committed flush, a two-device concurrent edit).
// What is stubbed: lucide icons (inert <svg data-icon>), downloadShapeRecovery / resolveShapeConflict
// (spies: their bodies are browser download / controller.resolve code, not under test here).
// What this is NOT: a browser. pointerEvents is asserted as the rendered style prop, not hit-tested;
// layout, CSS and screen-reader announcement are unverified.
// Red control: the baseline banner filters 'info' out in both the wrapper and the content.

const SHAPE_CONFLICT_TEXT = bind<Record<string, string>>(SEAMS.shapeConflictText(), {});
const BANNER = SEAMS.syncBanner();
const icon = (name: string) => (props: Record<string, unknown>) => React.createElement('svg', { 'data-icon': name, style: props.style });

interface BannerProps {
  status: ShapeSyncStatus | null; conflicts?: ConflictView[]; pinDraw?: null | 'site' | 'water';
  editPin?: null | { id: string; type: 'site' | 'water' }; onBackup?: () => void; onResolve?: (c: ConflictView, choice: string) => void;
}
/** Map's own state wiring around the extracted expression: `shapeSyncNoticeNow = shapeSyncNotice(shapeSyncStatus)`. */
function Banner(props: BannerProps) {
  const [conflictsOpen, setConflictsOpen] = React.useState(false);
  const shapeSyncNoticeNow = shapeSyncNotice(props.status);
  return bind<React.ReactNode>(BANNER, {
    React, pinDraw: props.pinDraw ?? null, editPin: props.editPin ?? null, shapeConflicts: props.conflicts ?? [],
    shapeSyncNoticeNow, downloadShapeRecovery: props.onBackup ?? (() => {}), conflictsOpen, setConflictsOpen,
    AlertTriangle: icon('AlertTriangle'), ChevronDown: icon('ChevronDown'), SHAPE_CONFLICT_TEXT,
    resolveShapeConflict: props.onResolve ?? (() => {}),
  }) || null;
}
function render(props: BannerProps) {
  let r!: TestRenderer.ReactTestRenderer;
  act(() => { r = TestRenderer.create(React.createElement(Banner, props)); });
  return r;
}
const text = (node: ReactTestInstance | null): string =>
  node ? node.children.map((c) => (typeof c === 'string' ? c : text(c))).join('') : '';
const byRole = (r: TestRenderer.ReactTestRenderer, role: string) => r.root.findAll((n) => typeof n.type === 'string' && n.props.role === role);
const buttons = (r: TestRenderer.ReactTestRenderer) => r.root.findAll((n) => n.type === 'button');
const wrapper = (r: TestRenderer.ReactTestRenderer) => (r.toJSON() as { props: { style: Record<string, unknown> } } | null);
const allText = (r: TestRenderer.ReactTestRenderer) => (r.toJSON() ? text(r.root) : '');
/** CSS pointer-events is inherited: the nearest explicit value on the element or an ancestor, else 'auto'. */
function pointerEvents(node: ReactTestInstance | null): string {
  for (let n = node; n; n = n.parent) {
    const value = typeof n.type === 'string' ? (n.props.style as Record<string, unknown> | undefined)?.pointerEvents : undefined;
    if (typeof value === 'string') return value;
  }
  return 'auto';
}

// ── real controllers in each state ──────────────────────────────────────────────────────────────
const hangingTransport: ShapeTransport = { transact: () => new Promise(() => {}) };
function localOnly(): ShapeSyncStatus {
  const d = makeDevice(null, { name: 'L' });
  d.controller.create(square('a', 30, -29), 'reticle-create');
  return d.controller.status();
}
function unresolved(): ShapeSyncStatus {
  let n = 0;
  const c = createShapeSyncController({
    keys: shapeSyncKeys((base) => `${base}::imbewu-owner::uid:farmer`), storage: new MemoryStorage(), transport: hangingTransport,
    isCurrent: () => true, now: () => 1_700_000_000_000, randomId: () => `u${n++}`, schedule: () => () => {},
  });
  c.start();
  c.create(square('a', 30, -29), 'reticle-create');
  void c.flush(); // the transaction never answers
  return c.status();
}
async function offline(): Promise<ShapeSyncStatus> {
  const server = new FakeShapeServer();
  const d = makeDevice(server, { name: 'O', gate: { offline: true } });
  d.controller.create(square('a', 30, -29), 'reticle-create');
  assert.equal((await d.controller.flush()).kind, 'error');
  return d.controller.status();
}
async function committed(): Promise<ShapeSyncStatus> {
  const server = new FakeShapeServer();
  const d = makeDevice(server, { name: 'C' });
  d.controller.create(square('a', 30, -29), 'reticle-create');
  assert.equal((await d.controller.flush()).kind, 'committed');
  return d.controller.status();
}
function volatileJournal(): ShapeSyncStatus {
  const storage = new MemoryStorage();
  const d = makeDevice(new FakeShapeServer(), { name: 'V', storage });
  storage.failPrefixes = ['imbewu_shape_op_v2:'];
  d.controller.create(square('a', 30, -29), 'reticle-create');
  return d.controller.status();
}
function invalidJournalRow(): ShapeSyncStatus {
  const storage = new MemoryStorage();
  storage.setItem('imbewu_shape_op_v2:op-garbage::imbewu-owner::uid:farmer', '{not json');
  return makeDevice(new FakeShapeServer(), { name: 'I', storage }).controller.status();
}
function corruptRemote(): ShapeSyncStatus {
  const d = makeDevice(new FakeShapeServer(), { name: 'R' });
  d.controller.receiveRemote({ v: 2, stateJson: '{definitely not a store' });
  return d.controller.status();
}
async function realConflict(): Promise<{ conflicts: ConflictView[]; status: ShapeSyncStatus }> {
  const server = new FakeShapeServer();
  const A = makeDevice(server, { name: 'A' });
  A.controller.create(square('s', 30, -29, { name: 'Dam' }), 'reticle-create');
  await A.controller.flush();
  const B = makeDevice(server, { name: 'B' });
  B.controller.receiveRemote(server.doc);
  const bBasis = B.controller.captureBasis('s')!;
  A.controller.update(A.controller.captureBasis('s')!, renamed(square('s', 30, -29), 'Big dam'), 'rename');
  await A.controller.flush();
  B.controller.update(bBasis, renamed(square('s', 30, -29), 'Old dam'), 'rename');
  await B.controller.flush();
  return { conflicts: B.controller.conflicts(), status: B.controller.status() };
}

test(`source fit: banner and conflict wording extracted from ${MAP_PATH.split('/').slice(-3).join('/')}`, async () => {
  assert.match(BANNER, /^!pinDraw && !editPin && \(shapeConflicts\.length > 0/);
  assert.equal(Object.keys(SHAPE_CONFLICT_TEXT).length, 6);
  // Wording authority stays the controller: the banner hard-codes none of shapeSyncNotice's texts.
  for (const phrase of ['Saved on this device only', 'syncing…', 'waiting to sync', 'All map changes synced', 'Map sync is paused']) {
    assert.ok(!BANNER.includes(phrase), `banner must not hard-code "${phrase}"`);
  }
  assert.ok(MAP_SOURCE.includes('const shapeSyncNoticeNow = shapeSyncNotice(shapeSyncStatus);'));
});

for (const [label, make, expected] of [
  ['local-only (no transport)', async () => localOnly(), 'Saved on this device only.'],
  ['first flush unresolved', async () => unresolved(), '1 change(s) syncing…'],
  ['offline flush failed', offline, '1 change(s) waiting to sync (offline?).'],
] as const) {
  test(`B2 info is shown as a non-blocking status: ${label}`, async () => {
    const status = await make();
    const notice = shapeSyncNotice(status)!;
    assert.deepEqual(notice, { level: 'info', text: expected, offerBackup: false }, 'precondition: the real controller reports info');
    const r = render({ status });
    assert.ok(r.toJSON(), 'an ordinary info status must be visible (baseline: filtered out by the wrapper condition)');
    const statuses = byRole(r, 'status');
    assert.equal(statuses.length, 1, 'rendered as role="status"');
    assert.equal(text(statuses[0]), notice.text, 'wording is exactly the controller’s');
    assert.equal(statuses[0].props['aria-live'], 'polite');
    assert.deepEqual(byRole(r, 'alert'), [], 'info is not escalated to an alert');
    assert.deepEqual(buttons(r), [], 'no backup offer and nothing to click for info');
    assert.equal(wrapper(r)!.props.style.pointerEvents, 'none', 'the strip does not block the map');
    assert.equal(pointerEvents(statuses[0]), 'none', 'the status chip is non-blocking');
    assert.doesNotMatch(allText(r), /\bsynced\b/i, 'no synced claim while anything is pending or local-only');
  });
}

test('B2 controls (pass before and after): warnings / errors keep the alert and the backup offer', async () => {
  for (const [label, status, level] of [
    ['volatile journal write', volatileJournal(), 'error'],
    ['corrupt remote (paused)', corruptRemote(), 'error'],
    ['invalid journal row', invalidJournalRow(), 'warn'],
  ] as const) {
    const notice = shapeSyncNotice(status)!;
    assert.equal(notice.level, level, `${label}: precondition`);
    assert.equal(notice.offerBackup, true, `${label}: precondition`);
    let backups = 0;
    const r = render({ status, onBackup: () => { backups += 1; } });
    const [alert] = byRole(r, 'alert');
    assert.ok(alert, `${label}: role="alert"`);
    assert.ok(text(alert).startsWith(notice.text), `${label}: controller wording`);
    const [backup] = buttons(r);
    assert.equal(pointerEvents(backup), 'auto', `${label}: the backup button stays clickable`);
    assert.equal(text(backup).trim(), 'Download backup');
    act(() => backup.props.onClick());
    assert.equal(backups, 1, `${label}: backup button wired to downloadShapeRecovery`);
    assert.deepEqual(byRole(r, 'status'), [], `${label}: no info chip beside an alert`);
    assert.doesNotMatch(allText(r), /\bsynced\b/i);
  }
});

test('B2 control (passes before and after): a preserved conflict keeps its tray, wording and decisions', async () => {
  const { conflicts, status } = await realConflict();
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].kind, 'concurrent-edit');
  const decisions: string[] = [];
  const r = render({ status, conflicts, onResolve: (c, choice) => { decisions.push(`${c.shapeId}:${choice}`); } });
  assert.match(allText(r), /1 shape needs your decision/);
  const toggle = buttons(r).find((b) => text(b).includes('needs your decision'))!;
  assert.equal(pointerEvents(toggle), 'auto', 'the conflict tray stays clickable');
  act(() => toggle.props.onClick());
  assert.match(allText(r), new RegExp(SHAPE_CONFLICT_TEXT['concurrent-edit'].replace('.', '\\.')));
  const keep = buttons(r).find((b) => text(b) === 'Keep this version')!;
  assert.equal(pointerEvents(keep), 'auto');
  act(() => keep.props.onClick());
  assert.deepEqual(decisions, ['s:keep-current']);
  assert.doesNotMatch(allText(r), /\bsynced\b/i);
});

test('B2 controls (pass before and after): nothing claims "synced" except after a genuine commit, and that claim stays hidden', async () => {
  assert.equal(render({ status: null }).toJSON(), null, 'no status → nothing');
  const status = await committed();
  assert.deepEqual(shapeSyncNotice(status), { level: 'ok', text: 'All map changes synced.', offerBackup: false });
  assert.equal(render({ status }).toJSON(), null, 'the ok state remains quiet (no banner)');
});

test('B2 controls (pass before and after): reticle draw / reticle edit hide the whole strip', async () => {
  for (const extra of [{ pinDraw: 'site' as const }, { editPin: { id: 'x', type: 'site' as const } }]) {
    assert.equal(render({ status: localOnly(), ...extra }).toJSON(), null);
    assert.equal(render({ status: volatileJournal(), ...extra }).toJSON(), null);
  }
});

// window.confirm is BANNED from this codebase. Embedded webviews (the Claude browser pane,
// some Android PWA wrappers) suppress native dialogs: confirm() returns false instantly with
// no UI, so every confirm-gated flow is silently dead there — and a flow where Cancel has its
// own meaning silently takes it (the saved-place duplicate guard auto-answered "make a
// duplicate", the exact outcome it exists to prevent; the crops page's Clear-all was a dead
// button — Rory, 2026-08-20: "button is not working").
//
// The replacement is components/AppConfirm.tsx: AppConfirmProvider in app/layout.tsx +
// useAppConfirm(), a promise-based in-app dialog. This file guards three things:
//   1. no window.confirm anywhere in app/, components/, lib/ — ever again;
//   2. promptNearbyUpdate (the save-time duplicate-site guard) still works, now through an
//      injected ask function, with its message + labels still centralized in ONE place;
//   3. the provider is actually mounted and the dialog keeps the semantics the conversions
//      rely on (alertdialog, above every sheet, Escape = cancel, focus starts on cancel).
//
// Run with:
//   node --import ./tests/register-alias.mjs --test tests/app-confirm.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------------------------
// 1. The ban. Whole-tree source scan, no exceptions: even AppConfirm.tsx words its own doc
//    comment around the token. A new window.confirm call fails here with the file:line and the
//    reason, so nobody has to rediscover the suppressed-dialog bug class in production.
// ---------------------------------------------------------------------------------------------

const ROOT = new URL('..', import.meta.url).pathname;
const SCAN_DIRS = ['app', 'components', 'lib'];

function scanForNativeConfirm(): string[] {
  const hits: string[] = [];
  for (const dir of SCAN_DIRS) {
    for (const entry of readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name)) continue;
      const path = join(entry.parentPath, entry.name);
      const source = readFileSync(path, 'utf8');
      source.split('\n').forEach((line, i) => {
        if (line.includes('window.confirm(')) hits.push(`${path.slice(ROOT.length)}:${i + 1}`);
      });
    }
  }
  return hits;
}

test('no window.confirm anywhere in app/, components/ or lib/', () => {
  assert.deepEqual(
    scanForNativeConfirm(),
    [],
    'window.confirm is suppressed (auto-false, no UI) in embedded webviews — use useAppConfirm() from components/AppConfirm.tsx instead',
  );
});

// ---------------------------------------------------------------------------------------------
// 2. promptNearbyUpdate through an injected ask. Same storage shim as tests/saved-places.test.ts
//    (lib/saved-places.ts reads localStorage/sessionStorage directly, browser-only style).
// ---------------------------------------------------------------------------------------------

class FakeStorage {
  #map = new Map<string, string>();
  getItem(k: string): string | null { return this.#map.has(k) ? this.#map.get(k)! : null; }
  setItem(k: string, v: string): void { this.#map.set(k, v); }
  removeItem(k: string): void { this.#map.delete(k); }
  clear(): void { this.#map.clear(); }
}

(globalThis as unknown as { window: unknown }).window = globalThis;
(globalThis as unknown as { localStorage: unknown }).localStorage = new FakeStorage();
(globalThis as unknown as { sessionStorage: unknown }).sessionStorage = new FakeStorage();
(globalThis as unknown as { dispatchEvent: unknown }).dispatchEvent = () => true;

const { promptNearbyUpdate, savePlace } = await import('../lib/saved-places.ts');

// ~11 m north of the seeded place — inside the guard's 60 m radius.
const HOME = { lat: -29.6, lon: 30.4 };
const NEARBY = { lat: HOME.lat + 0.0001, lon: HOME.lon };

function seedHome() {
  savePlace({
    id: 'place-home', name: 'Ubhejane Creche',
    lat: HOME.lat, lon: HOME.lon,
    biome: 'Savanna', rainfall: 800, elevation: 600,
    savedAt: '2026-08-01T00:00:00.000Z',
  });
}

test('promptNearbyUpdate: farmer confirms → the existing place comes back (same id)', async () => {
  seedHome();
  const asked: Array<{ message: string; confirmLabel: string; cancelLabel?: string }> = [];
  const nearby = await promptNearbyUpdate(NEARBY.lat, NEARBY.lon, async (opts) => {
    asked.push(opts);
    return true;
  });
  assert.equal(nearby?.id, 'place-home', 'the caller must get the existing row so downstream ids do not fork');
  assert.equal(asked.length, 1);
  // The question and BOTH labels are authored here, once, for all three call sites: the message
  // names the place and the distance, and neither button is a bare OK/Cancel — a suppressed or
  // misread dialog is exactly how this guard failed before.
  assert.match(asked[0].message, /"Ubhejane Creche"/);
  assert.match(asked[0].message, /\b11 m\b/);
  assert.match(asked[0].confirmLabel, /Update "Ubhejane Creche"/);
  assert.match(asked[0].cancelLabel ?? '', /Save as new place/);
});

test('promptNearbyUpdate: farmer declines → null, caller mints a new place', async () => {
  seedHome();
  const nearby = await promptNearbyUpdate(NEARBY.lat, NEARBY.lon, async () => false);
  assert.equal(nearby, null);
});

test('promptNearbyUpdate: nothing saved nearby → null without ever asking', async () => {
  seedHome();
  let asks = 0;
  const nearby = await promptNearbyUpdate(HOME.lat + 1, HOME.lon + 1, async () => { asks += 1; return true; });
  assert.equal(nearby, null);
  assert.equal(asks, 0, 'no nearby place means no dialog — the quick-save stays one tap');
});

// ---------------------------------------------------------------------------------------------
// 3. Wiring. Source-level (none of these render under node:test): the provider is mounted once
//    in the root layout, every converted surface asks through the hook, and the dialog keeps the
//    semantics the conversions rely on.
// ---------------------------------------------------------------------------------------------

const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');

test('AppConfirmProvider is mounted in the root layout', () => {
  const layout = read('app/layout.tsx');
  assert.match(layout, /import AppConfirmProvider from '@\/components\/AppConfirm';/);
  assert.match(layout, /<AppConfirmProvider>/);
});

test('every converted surface asks through useAppConfirm', () => {
  const surfaces = [
    'app/design/page.tsx',              // delete drone photo
    'app/community/profile/page.tsx',   // delete community profile
    'components/SiteSurveySheet.tsx',   // discard questionnaire answers
    'components/SavedPlaces.tsx',       // duplicate-site guard (form save)
    'components/Map.tsx',               // duplicate-site guard (pin save)
    'components/DataPanel.tsx',         // duplicate-site guard (one-tap save)
  ];
  for (const rel of surfaces) {
    assert.match(read(rel), /useAppConfirm\(\)/, `${rel} must ask through the in-app dialog`);
  }
  // The three duplicate-guard callers await the shared authority rather than re-wording it.
  for (const rel of ['components/SavedPlaces.tsx', 'components/Map.tsx', 'components/DataPanel.tsx']) {
    assert.match(read(rel), /await promptNearbyUpdate\(/, `${rel} must await the async guard`);
  }
});

test('the dialog keeps the semantics the conversions rely on', () => {
  const dialog = read('components/AppConfirm.tsx');
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  // Above every sheet: SiteSurveySheet asks from inside its own fixed inset-0 z-50 dialog.
  assert.match(dialog, /zIndex: 1200/);
  // Escape and the backdrop both decline; focus starts on the decline button so a stray Enter
  // on a destructive question cannot destroy anything.
  assert.match(dialog, /e\.key === 'Escape'/);
  assert.match(dialog, /data-autofocus=""/);
  assert.match(dialog, /useDialogFocus\(!!pending/);
  // No baked-in strings beyond the Cancel default: labels come from call sites (t() where the
  // surface is translated), so the provider itself needs no i18n keys.
  assert.match(dialog, /confirmLabel: string/);
});


// QUICK-SAVE-ACTOR-01: execute the actual saved-place callback bodies, rather
// than testing only the nearby lookup. Heavy React/map rendering is outside this
// test; real duplicate lookup, account namespaces and saved-place writes are not.
import ts from 'typescript';
import * as placeContexts from '../lib/length-unit-preference.ts';
import { accountLocalStorageKey, bindMountedAccountLocalStorageUid } from '../lib/account-local-storage.ts';
import { loadPlaces, savedRainfallFields } from '../lib/saved-places.ts';

const placeEvents = new EventTarget();
Object.assign(globalThis, {
  addEventListener: placeEvents.addEventListener.bind(placeEvents),
  removeEventListener: placeEvents.removeEventListener.bind(placeEvents),
  dispatchEvent: placeEvents.dispatchEvent.bind(placeEvents),
});

function actualSaveHandler(path: string, name: string, scope: Record<string, unknown>): () => Promise<void> {
  const source = read(path);
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name) {
      const initializer = node.initializer;
      body = initializer && ts.isCallExpression(initializer) ? initializer.arguments[0] : initializer;
    }
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) body = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(body, `actual ${path} handler must be found`);
  const js = ts.transpileModule(`return (${body.getText(ast)});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function(...Object.keys(scope), js)(...Object.values(scope));
}

for (const [path, handlerName] of [
  ['components/DataPanel.tsx', 'quickSavePlace'],
  ['components/SavedPlaces.tsx', 'handleSave'],
  ['components/Map.tsx', 'confirmSavePlace'],
]) for (const answer of [true, false]) for (const scenario of ['switch-account', 'keep-account', 'sample-round-trip', 'revoke-view']) {
  test(`${path}: nearby confirmation ${answer}, ${scenario} keeps the write in its original live view`, async () => {
    localStorage.clear(); sessionStorage.clear();
    bindMountedAccountLocalStorageUid('synthetic-save-A');
    seedHome();
    const keyA = accountLocalStorageKey('permamap_saved_places', 'synthetic-save-A');
    const keyB = accountLocalStorageKey('permamap_saved_places', 'synthetic-save-B');
    const before = localStorage.getItem(keyA);
    // Against the parent source, the new token is unused by the actual callback;
    // that negative control still reaches the real cross-account write assertion.
    const contexts = placeContexts as any;
    const context = contexts.captureSavedPlaceWriteContext?.() ?? { kind: 'unused-parent-token' };
    const contextRef = { current: context };
    let resolveAsk!: (value: boolean) => void;
    let asked = false;
    const confirmation = new Promise<boolean>(resolve => { resolveAsk = resolve; });
    const feedback: unknown[] = [];
    const mark = (value: unknown) => { feedback.push(value); };
    const data = { biome: { name: 'Savanna' }, rainfall: { annual: 600 }, elevation: { elevation: 600 } };
    const noop = () => {};
    try {
      const handler = actualSaveHandler(path, handlerName, {
        data, coords: NEARBY, locationData: data, namingPlace: NEARBY,
        name: 'Synthetic site', notes: '', placeName: 'Synthetic site',
        placeLabel: 'field', customPlaceColor: '', editingPlaceId: null, savedPins: loadPlaces(),
        promptNearbyUpdate, savePlace, savedRainfallFields, loadPlaces,
        appConfirm: () => { asked = true; return confirmation; },
        placeSaveContext: contextRef,
        savedPlaceWriteContextIsCurrent: contexts.savedPlaceWriteContextIsCurrent ?? (() => true),
        generateId: () => 'synthetic-new-place',
        setPlaceSaved: mark, setSaved: mark, setPlaces: mark, setSavedPins: mark,
        setSaving: noop, setNotes: noop, setEditingPlaceId: noop, setNamingPlace: noop,
        setTimeout: () => 0,
      });
      const pending = handler();
      assert.equal(asked, true, 'the real callback must suspend at the real nearby-site dialog');
      if (scenario === 'switch-account') bindMountedAccountLocalStorageUid('synthetic-save-B');
      if (scenario === 'sample-round-trip') {
        sessionStorage.setItem('imbewu_sample_mode', '1');
        dispatchEvent(new CustomEvent('imbewu-sample-mode-changed'));
        sessionStorage.removeItem('imbewu_sample_mode');
        dispatchEvent(new CustomEvent('imbewu-sample-mode-changed'));
      }
      if (scenario === 'revoke-view') { contexts.revokeSavedPlaceWriteContext?.(context); contextRef.current = null; }
      resolveAsk(answer);
      await pending;
      assert.equal(localStorage.getItem(keyB), null, 'old dialog must not create or update a row for the next account');
      if (scenario === 'keep-account') {
        const saved = JSON.parse(localStorage.getItem(keyA) ?? '[]');
        const written = saved.find((row: any) => row.id === (answer ? 'place-home' : 'synthetic-new-place'));
        assert.ok(written, 'a live confirmation must still save in the original account');
        assert.equal(written.lat, NEARBY.lat);
        assert.equal(written.rainfall, answer ? 800 : undefined, 'recorded rain survives updates; a new outage does not become rain');
        assert.ok(feedback.includes(true), 'a live save still shows success');
        assert.equal(saved.length, answer ? 1 : 2);
      } else {
        assert.equal(localStorage.getItem(keyA), before, 'retired confirmation must leave the original row untouched');
        assert.deepEqual(feedback, [], 'retired callback must not show success or install saved rows');
      }
    } finally {
      contexts.revokeSavedPlaceWriteContext?.(context);
      bindMountedAccountLocalStorageUid(null);
      localStorage.clear(); sessionStorage.clear();
    }
  });
}


import React from 'react';
import { act, create } from 'react-test-renderer';

test('the actual saved-place hook retires its receipt on unmount, without disabling the next view', () => {
  localStorage.clear(); sessionStorage.clear();
  bindMountedAccountLocalStorageUid('synthetic-save-A');
  let current: { current: any } | undefined;
  function View() { current = placeContexts.useSavedPlaceWriteContext(); return null; }
  let mounted: ReturnType<typeof create>;
  act(() => { mounted = create(React.createElement(View)); });
  const receipt = current!.current;
  assert.ok(receipt);
  assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(receipt), true);
  act(() => mounted.unmount());
  assert.equal(current!.current, null);
  assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(receipt), false);
  act(() => { mounted = create(React.createElement(View)); });
  assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(current!.current), true);
  act(() => mounted.unmount());
  bindMountedAccountLocalStorageUid(null);
});

test('a guarded local write followed by an account change cannot confirm or target the new owner', () => {
  localStorage.clear(); sessionStorage.clear(); bindMountedAccountLocalStorageUid('synthetic-save-A');
  const context = placeContexts.captureSavedPlaceWriteContext();
  assert.ok(context);
  const changeAccount = () => bindMountedAccountLocalStorageUid('synthetic-save-B');
  addEventListener('permamap-places-changed', changeAccount, { once: true });
  try {
    const result = savePlace({ id: 'synthetic-committed-A', name: 'Synthetic A', ...HOME,
      biome: 'Savanna', elevation: 600, savedAt: '2026-11-13T00:00:00.000Z' }, { isCurrent: () => placeContexts.savedPlaceWriteContextIsCurrent(context) });
    assert.equal(result, null, 'a completed local write is not a current-view success after notification retires it');
    assert.equal(localStorage.getItem(accountLocalStorageKey('permamap_saved_places', 'synthetic-save-B')), null);
    assert.ok(localStorage.getItem(accountLocalStorageKey('permamap_saved_places', 'synthetic-save-A')), 'the completed original-owner write is preserved, not rolled back into a different account');
  } finally {
    removeEventListener('permamap-places-changed', changeAccount);
    placeContexts.revokeSavedPlaceWriteContext(context); bindMountedAccountLocalStorageUid(null);
  }
});


test('a mounted sample view retires the old save receipt and renews one for the next explicit save', async () => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem('imbewu_sample_mode', '1');
  bindMountedAccountLocalStorageUid('synthetic-save-A');
  let current: { current: any } | undefined;
  function View() { current = placeContexts.useSavedPlaceWriteContext(); return null; }
  let mounted: ReturnType<typeof create>;
  act(() => { mounted = create(React.createElement(View)); });
  try {
    const oldReceipt = current!.current;
    assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(oldReceipt), true);
    const samplePlace = loadPlaces()[0]; assert.ok(samplePlace);
    const before = JSON.stringify(loadPlaces());
    let answer!: (value: boolean) => void;
    let asked = false;
    const pendingAnswer = new Promise<boolean>(resolve => { answer = resolve; });
    let ask = () => { asked = true; return pendingAnswer; };
    const feedback: boolean[] = [];
    const handler = actualSaveHandler('components/DataPanel.tsx', 'quickSavePlace', {
      data: { biome: { name: samplePlace.biome }, rainfall: { annual: 600 }, elevation: { elevation: samplePlace.elevation } },
      coords: { lat: samplePlace.lat, lon: samplePlace.lon }, promptNearbyUpdate, savePlace, savedRainfallFields,
      appConfirm: () => ask(), placeSaveContext: current!, savedPlaceWriteContextIsCurrent: placeContexts.savedPlaceWriteContextIsCurrent,
      generateId: () => 'synthetic-new-sample-place', setPlaceSaved: (saved: boolean) => feedback.push(saved),
    });
    const oldPendingSave = handler(); assert.equal(asked, true);
    // startRolePreview emits this event even when sample mode stays on. The
    // Map and its save button may stay mounted on the same route.
    act(() => { dispatchEvent(new CustomEvent('imbewu-sample-mode-changed')); });
    assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(oldReceipt), false);
    assert.notEqual(current!.current, oldReceipt, 'future explicit actions need a fresh receipt, never the retired callback receipt');
    assert.equal(placeContexts.savedPlaceWriteContextIsCurrent(current!.current), true);
    answer(true); await oldPendingSave;
    assert.equal(JSON.stringify(loadPlaces()), before, 'the newly current receipt cannot approve the old pending confirmation');
    assert.deepEqual(feedback, []);
    ask = async () => true;
    await handler();
    assert.deepEqual(feedback, [true], 'a fresh click in the same mounted view must still save');
  } finally {
    act(() => mounted.unmount());
    sessionStorage.clear(); bindMountedAccountLocalStorageUid(null);
  }
});

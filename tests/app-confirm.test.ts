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
    'components/design-studio-2/PreviewExport.tsx', // delete saved map
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
  assert.match(dialog, /cancelRef\.current\?\.focus\(\)/);
  // No baked-in strings beyond the Cancel default: labels come from call sites (t() where the
  // surface is translated), so the provider itself needs no i18n keys.
  assert.match(dialog, /confirmLabel: string/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Rory: "lets have a burger menu option on every screen."
//
// A promise like that is kept by a check, not by a sweep: the sweep was true the
// day it ran, and the next new screen quietly breaks it. Before this, exactly
// three of the app's screens had a way into the menu — a farmer who navigated
// into the Journal, the Calendar, Records, an invoice or the Atlas had Back and
// nothing else.
//
// The rule: if a page renders a <header>, that header's screen must be able to
// open the menu. Screens with no header at all are outside it — print sheets,
// the sign-in and gate pages (which must not offer routes into a signed-in app),
// the redirect stubs, and design/lite, which exists precisely because a phone
// could not load the big bundle and must not now pull in the drawer's icon set.
//
// Counting rather than merely finding matters: student/ and mentor/ each render
// several header branches (auth resolving, access refused, the real screen), and
// the version of this rollout that only found the FIRST one left the actual
// screen without a menu in both files.

// Space-in-path safety: .pathname would percent-encode, fileURLToPath does not.
const APP_DIR = join(fileURLToPath(new URL('../', import.meta.url)), 'app');

/**
 * Pages that legitimately render a header with no way into the menu.
 * Empty by design — add an entry only WITH the reason, never to silence a miss.
 */
const EXEMPT = new Map<string, string>();

function pageFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) pageFiles(full, out);
    else if (name === 'page.tsx') out.push(full);
  }
  return out;
}

const count = (src: string, re: RegExp): number => (src.match(re) ?? []).length;

test('every screen with a header can open the menu', () => {
  const missing: string[] = [];
  let checked = 0;

  for (const file of pageFiles(APP_DIR)) {
    const rel = file.slice(APP_DIR.length + 1);
    if (EXEMPT.has(rel)) continue;
    const src = readFileSync(file, 'utf8');
    const headers = count(src, /<header\b/g);
    if (headers === 0) continue;
    checked++;
    const buttons = count(src, /<MenuButton\b/g);
    if (buttons < headers) missing.push(`${rel} — ${headers} header(s), ${buttons} MenuButton(s)`);
  }

  assert.ok(checked > 20, `expected the app to have many header screens, found ${checked}`);
  assert.deepEqual(missing, [], `screens with no way into the menu:\n${missing.join('\n')}`);
});

test('the menu button is one component, not a per-page re-implementation', () => {
  // Three pages each had their own <button onClick={() => setNavOpen(true)}> at
  // 34, 36 and 38 px — every one of them under the 44 px touch floor this app
  // holds itself to, and every one painted with hardcoded hexes, so the control
  // stayed a light chip in dark mode. NavDrawer is now opened from one place.
  const offenders: string[] = [];
  for (const file of pageFiles(APP_DIR)) {
    const src = readFileSync(file, 'utf8');
    if (/setNavOpen\s*\(/.test(src) || /from '@\/components\/NavDrawer'/.test(src)) {
      offenders.push(file.slice(APP_DIR.length + 1));
    }
  }
  assert.deepEqual(offenders, [], `open NavDrawer through MenuButton, not directly: ${offenders.join(', ')}`);
});

test('the menu button keeps the touch floor and the theme tokens', () => {
  const src = readFileSync(
    fileURLToPath(new URL('../components/MenuButton.tsx', import.meta.url)),
    'utf8',
  );
  assert.match(src, /width:\s*44/, 'a 44 px touch target, like BackButton');
  assert.match(src, /height:\s*44/);
  assert.match(src, /var\(--bg-1\)/, 'themed background, not a hardcoded hex');
  assert.match(src, /var\(--border\)/);
  assert.match(src, /var\(--text-primary\)/);
  assert.match(src, /aria-label="Open navigation"/);
  // A hex here is the exact bug SettingsButton's comment records: a bright chip
  // in the corner of every dark-mode screen.
  assert.ok(!/#[0-9A-Fa-f]{6}/.test(src.replace(/\/\/.*$/gm, '')), 'no hardcoded colours');
});

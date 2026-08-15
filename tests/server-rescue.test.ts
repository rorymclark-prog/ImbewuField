import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  RESCUE_COOKIE,
  RESCUE_THRESHOLD,
  RESCUE_WINDOW_S,
  decideDesignRescue,
  parsePulse,
} from '../lib/server-rescue.ts';

// THE RESCUE THAT CANNOT BE KILLED, BECAUSE IT DOES NOT RUN ON THE PHONE.
//
// 15 August, 08:44, battery at 7% — and again with Low Power Mode off: the same grey iOS screen,
// with every client-side guard already deployed. They all assume our JavaScript gets to run; a
// phone with nothing left kills the design page before it does, and the rescue dies with the
// patient. Cookies ride with the REQUEST, so the server counts what the phone cannot live to
// report, and past the threshold it redirects to /design/lite — a page with nothing left to kill.

const source = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('the count climbs while pages die and redirects at the threshold', () => {
  // Open 1: no cookie → pass, store 1. The page dies before clearing it.
  const first = decideDesignRescue(null, false);
  assert.deepEqual(first, { action: 'pass', nextCount: 1 });
  // Open 2 (iOS's one automatic reload): pass, store 2. Dies again.
  const second = decideDesignRescue('1', false);
  assert.deepEqual(second, { action: 'pass', nextCount: 2 });
  // Open 3: the farmer taps the link again — and the SERVER answers with the lite page.
  assert.equal(decideDesignRescue('2', false).action, 'redirect');
});

test('a healthy visit never escalates', () => {
  // The settled page deletes the cookie, so the next open starts from nothing.
  assert.deepEqual(decideDesignRescue(null, false), { action: 'pass', nextCount: 1 });
  assert.deepEqual(decideDesignRescue(undefined, false), { action: 'pass', nextCount: 1 });
});

test('the lite page\'s way back in is not a one-way door', () => {
  // ?full=1 is a deliberate human choice to go back in heavy. It must both pass AND restart the
  // count — otherwise the very next open bounces straight back to lite and the full designer is
  // unreachable forever on that phone.
  const back = decideDesignRescue('9', true);
  assert.equal(back.action, 'pass');
  assert.equal(back.nextCount, 1, 'the count must restart, not carry the old streak');
});

test('a corrupt cookie is a first visit, never a verdict', () => {
  for (const bad of ['', 'NaN', '-3', 'banana', '1e999']) {
    assert.equal(parsePulse(bad), 0, `"${bad}" should read as zero`);
    assert.equal(decideDesignRescue(bad, false).action, 'pass');
  }
});

test('the window is short and the threshold matches the client\'s reasoning', () => {
  // The cookie expires on its own so a bad morning does not brand the phone for life…
  assert.ok(RESCUE_WINDOW_S <= 3600, 'a day-long window would lock a phone out over one bad hour');
  // …and the threshold mirrors the client guard: iOS grants one automatic reload; two requests
  // with no survival between them is the loop.
  assert.equal(RESCUE_THRESHOLD, 2);
});

test('the middleware wires the whole contract, and only for the design page', () => {
  const mw = source('../middleware.ts');
  assert.match(mw, /if \(pathname !== '\/design'\) return NextResponse\.next\(\);/,
    'the rescue must not tax every route in the app');
  // Prefetches are the router warming links nobody tapped — counting them charges crashes to
  // pages nobody opened.
  assert.match(mw, /prefetch/i, 'prefetch requests are being counted as opens');
  assert.match(mw, /decideDesignRescue\(req\.cookies\.get\(RESCUE_COOKIE\)/);
  // The redirect keeps the coordinates, so the lite page can offer the same farm back.
  assert.match(mw, /\/design\/lite\$\{search\}/, 'the redirect drops the farm coordinates');
  // The cookie must be readable by document.cookie — the SETTLED page deleting it is the whole
  // contract, and httpOnly would make that impossible.
  assert.match(mw, /httpOnly: false/, 'an httpOnly cookie can never be cleared by the healthy page');
  assert.match(mw, /maxAge: RESCUE_WINDOW_S/);
});

test('the settled design page tells the server it survived', () => {
  const page = source('../app/design/page.tsx');
  const settleAt = page.indexOf('markPageSettled(window.localStorage, safeMode.key)');
  assert.ok(settleAt > 0, 'the settle callback is gone');
  assert.match(page.slice(settleAt, settleAt + 500), /clearPulseCookie\(\)/,
    'nothing deletes the pulse cookie, so every phone ends up on the lite page eventually');
});

test('the lite page must have nothing left to kill', () => {
  // It is served precisely to phones that could not start the big bundle, so its discipline is
  // what it does NOT import. Any of these names appearing means someone made it heavy again.
  const lite = source('../app/design/lite/page.tsx');
  for (const heavy of [
    "from '@/components/Map'", 'mapbox', 'DesignCanvas', 'DesignGlossy', 'sheet-store',
    'design-canvas', "from '@/lib/i18n'", 'firebase',
  ]) {
    assert.ok(!lite.includes(heavy), `/design/lite imports ${heavy} — it is no longer survivable`);
  }
  // And it reads nothing at mount: no storage scan on the phone this page exists to spare.
  // Comments stripped first — the page is allowed to EXPLAIN the rule it follows.
  const code = lite.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(code, /localStorage|indexedDB/, 'the lite page went data-hungry');
  // The way back in resets the server count and asks the client to go light too.
  assert.match(lite, /safe=1&full=1/, 'the light way back in is gone');
  assert.match(lite, /full=1/, 'nothing resets the server count — lite became a one-way door');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  FARMER_PULSE_COOKIE,
  GRANT_WINDOW_S,
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

test('the automatic reload of a dead page IS the redirect', () => {
  // Open 1: no cookie → pass, store 1. The page dies before clearing it.
  const first = decideDesignRescue(null, false);
  assert.deepEqual(first, { action: 'pass', nextCount: 1 });
  // Open 2 is iOS's one automatic reload — the LAST request iOS ever makes on this URL. The grey
  // terminal screen needs a second death; the redirect must arrive before one can happen.
  assert.equal(decideDesignRescue('1', false).action, 'redirect');
});

test('a healthy visit never escalates', () => {
  // The settled page deletes the cookie, so the next open starts from nothing.
  assert.deepEqual(decideDesignRescue(null, false), { action: 'pass', nextCount: 1 }, 'null cookie must pass');
  assert.equal(decideDesignRescue(undefined, false).action, 'pass');
  assert.equal(decideDesignRescue(undefined, false).nextCount, 1);
});

test('the lite page\'s way back in is a one-shot grant, not a blank cheque', () => {
  // ?full=1 is a deliberate human choice to go back in heavy. Without a standing grant it must
  // pass, restart the count, AND plant the grant.
  const back = decideDesignRescue('9', true, false);
  assert.equal(back.action, 'pass');
  assert.equal(back.nextCount, 1, 'the count must restart, not carry the old streak');
  assert.equal(back.grant, true, 'the pass must plant the one-shot grant');
  // But iOS's automatic reload repeats the SAME URL — full=1 included. Observed 15 August,
  // 09:03: the grey screen on ...&safe=1&full=1, the lite page's own light link, because the
  // granted retry died and its reload was granted AGAIN. With the grant still standing, full=1
  // counts like any other request and goes straight back to the lite page.
  assert.equal(decideDesignRescue('1', true, true).action, 'redirect',
    'the reload of a dead granted retry must redirect, never re-pass into the second death');
});

test('a corrupt cookie is a first visit, never a verdict', () => {
  for (const bad of ['', 'NaN', '-3', 'banana', '1e999']) {
    assert.equal(parsePulse(bad), 0, `"${bad}" should read as zero`);
    assert.equal(decideDesignRescue(bad, false).action, 'pass');
  }
});

test('the thresholds and windows match how iOS actually behaves', () => {
  // The cookie expires on its own so a bad morning does not brand the phone for life…
  assert.ok(RESCUE_WINDOW_S <= 3600, 'a day-long window would lock a phone out over one bad hour');
  // …the grant exists only to outlive one crash-and-reload cycle…
  assert.ok(GRANT_WINDOW_S <= 120, 'a long grant re-passes reloads of retries that died long ago');
  // …and the threshold is ONE. iOS kills the page, auto-reloads it once, kills it again and
  // shows the terminal screen — there is no third request. A threshold of two was deployed on
  // 15 August and produced the same grey screenshot three minutes later, because it redirected
  // a request iOS never makes. The automatic reload must BE the redirect.
  assert.equal(RESCUE_THRESHOLD, 1);
});

test('the middleware stands down: no request is counted or redirected', () => {
  // 15 August, an hour after the rescue shipped, from Rory's LAPTOP: "disable this now its
  // interfering with my laptop use too". At threshold one, any open not followed by a settled
  // page — a quick refresh, a navigation mid-load, a healthy machine doing normal things — sent
  // the next open to the lite page. The rescue is OFF; the comprehensive fix is the design page
  // not crashing in the first place. The decision logic above stays tested so a deliberate,
  // narrower restore (e.g. phone-only) stays cheap; this test pins that the middleware itself
  // touches nothing until that decision is made ON PURPOSE.
  // Comments stripped first — the file is allowed to EXPLAIN what was disabled and how to
  // restore it; it is the CODE that must do nothing.
  const mw = source('../middleware.ts').replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(mw, /decideDesignRescue\(/, 'the rescue is wired back in — was that deliberate? See this test.');
  assert.doesNotMatch(mw, /cookies\.set/, 'the middleware must not stamp cookies while stood down');
  assert.doesNotMatch(mw, /redirect/i, 'the middleware must not redirect anything while stood down');
});

test('both settled pages tell the server they survived', () => {
  const design = source('../app/design/page.tsx');
  const settleAt = design.indexOf('markPageSettled(window.localStorage, safeMode.key)');
  assert.ok(settleAt > 0, 'the design settle callback is gone');
  assert.match(design.slice(settleAt, settleAt + 500), /clearPulseCookie\(\)/,
    'nothing deletes the design pulse, so every phone ends up on the lite page eventually');

  const farmer = source('../app/farmer/page.tsx');
  const farmerSettleAt = farmer.indexOf('markPageSettled(window.localStorage, mapGuard.key)');
  assert.ok(farmerSettleAt > 0, 'the farmer settle callback is gone');
  assert.match(farmer.slice(farmerSettleAt, farmerSettleAt + 500), /clearPulseCookie\(FARMER_PULSE_COOKIE\)/,
    'nothing deletes the farmer pulse, so every phone ends up on the lite page eventually');
  assert.match(farmer, /pageCrashGuard\(FARMER_LOAD_KEY, FARMER_PULSE_COOKIE\)/,
    'leaving the farmer page on purpose must also clear its pulse — see watchSessionExit');
});

test('leaving on purpose clears the pulse too, not only the settle timer', () => {
  // A farmer who opens the page and taps away before the settle timer was ALIVE — without this,
  // a healthy quick visit counts as a death and the next open lands on the lite page for no
  // reason. watchSessionExit's leave() carries the cookie name for exactly this.
  const crashLoop = source('../lib/crash-loop.ts');
  assert.match(crashLoop, /if \(pulseCookie\) clearPulseCookie\(pulseCookie\);/,
    'the leave() path no longer clears the server cookie');
  assert.match(crashLoop, /watchSessionExit\(key, RESCUE_COOKIE\)/,
    'the design guard must name its pulse cookie when wiring the exit watch');
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
  // The ways back in all carry the one-shot grant, the light one asks the client to go light
  // too, and the farmer links carry it as well — without full=1 a farmer-map streak would
  // bounce "Back to the map" straight back here forever.
  assert.match(lite, /safe=1&full=1/, 'the light way back in is gone');
  assert.match(lite, /\/farmer\$\{coords\}\$\{amp\}full=1/, 'the map link lost its grant');
  assert.match(lite, /panel=Reports&full=1/, 'the reports link lost its grant');
  // The middleware marks farmer-map redirects so the page can put the map first and say so.
  assert.match(lite, /from'\) === 'farmer'/, 'the farmer wording is gone');
});

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  CRASH_LOOP_KEY,
  CRASH_LOOP_THRESHOLD,
  isCrashLooping,
  markPageSettled,
  nextLoadCount,
  pageLoadKey,
  recordPageLoad,
  resolveSafeMode,
  type CrashLoopStore,
  lastCrashPhase,
  noteCrashPhase,
  markCleanExit,
  markResumed,
  startDeathWatch,
} from '../lib/crash-loop.ts';
import {
  recordReportAttempt,
  reportAttemptSurvived,
  reportShouldGoLight,
} from '../lib/report-attempts.ts';

// A PAGE THAT KEEPS DYING MUST COME BACK SIMPLER. Rory's design URL reached iOS Safari's terminal
// screen — "A problem repeatedly occurred on …/design?lat=…" — because every load did the same
// heavy work (drone photo + satellite underlay as data URLs, supersampled into a bake canvas) and
// was killed the same way. Trimming allocations helped and never closed the hole; counting the
// loads does, because it does not depend on knowing WHICH allocation was the last straw.

function memoryStore(seed: Record<string, string> = {}): CrashLoopStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(seed));
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('a load that settles clears the streak; a load that dies keeps counting', () => {
  const store = memoryStore();
  // Two healthy visits: each records a load and then settles, so neither accumulates.
  for (let visit = 0; visit < 2; visit++) {
    assert.equal(recordPageLoad(store), 1, 'a settled page must never carry a streak forward');
    markPageSettled(store);
  }
  assert.equal(store.map.get(CRASH_LOOP_KEY), undefined);
  // Now the crash loop: each load records and is killed before it can settle.
  assert.equal(recordPageLoad(store), 1);
  assert.equal(recordPageLoad(store), 2);
  assert.equal(recordPageLoad(store), 3);
});

test('safe mode engages at the threshold and not before', () => {
  // The farmer has already watched the app die THRESHOLD times; earlier than that could be one
  // busy phone, and refusing someone's photograph is not a free action.
  for (let loads = 1; loads < CRASH_LOOP_THRESHOLD; loads++) {
    assert.equal(isCrashLooping(loads), false, `${loads} load(s) must still try the photo`);
    assert.equal(resolveSafeMode(loads, false).active, false);
  }
  const engaged = resolveSafeMode(CRASH_LOOP_THRESHOLD, false);
  assert.equal(engaged.active, true);
  assert.equal(engaged.reason, 'crash-loop');
  assert.equal(engaged.loads, CRASH_LOOP_THRESHOLD);
});

test('?safe=1 works on a perfectly healthy phone', () => {
  // The manual escape hatch: a farmer (or a support conversation) can force the light path
  // immediately rather than crashing three times to earn it.
  const requested = resolveSafeMode(0, true);
  assert.equal(requested.active, true);
  assert.equal(requested.reason, 'requested');
});

test('unreadable or hostile storage never invents a crash loop', () => {
  // Refusing the farmer's photograph on the strength of a corrupt string would be its own bug.
  for (const junk of ['junk', '-4', 'NaN', '', '0']) {
    assert.equal(nextLoadCount(junk), 1, `stored ${JSON.stringify(junk)} must read as a first load`);
  }
  const broken: CrashLoopStore = {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
  };
  assert.equal(recordPageLoad(broken), 1, 'no storage must behave like a healthy first load');
  assert.doesNotThrow(() => markPageSettled(broken));
});

const PAGE_SRC = readFileSync(new URL('../app/design/page.tsx', import.meta.url), 'utf8');

test('safe mode keeps the farmer\'s own metres, never the satellite\'s', () => {
  // THE BUG THIS PINS. Safe mode skips the photo, and the obvious way to do that — reuse the
  // 'blank' base branch — derives its scale from the satellite projection. Handing a photo-based
  // farm the satellite's metres silently rescales every area, spacing, tank size and price on the
  // canvas and on all nine sheets. Losing the photograph for one load is the intended cost;
  // losing the measurements is not.
  const at = PAGE_SRC.indexOf('if (safeMode.active) {');
  assert.ok(at > 0, 'the safe-mode base branch is gone — the crash loop has nothing to break it');
  const branch = PAGE_SRC.slice(at, at + 600);
  assert.ok(branch.includes('activeBaseMPerPx('),
    'safe mode stopped resolving the farmer\'s active metres — measurements would silently change');
  assert.ok(!/mPerPx: baseMPerPx\(frameNoImg\)/.test(branch),
    'safe mode is using the satellite projection\'s metres for a farm that may be on a photo');
  assert.ok(branch.includes('satDataUrl: null') && branch.includes('underlayDataUrl: null'),
    'safe mode must load no image pixels at all — that is the entire point');
});

test('safe mode still loads the design, and still charges the load before the heavy work', () => {
  // An early return here would open safe mode on an EMPTY design — "the app lost my farm", a far
  // worse bug than the crash it survives. The branch must be part of the else-if chain so the
  // frame migration and setCanvasState below it still run.
  const at = PAGE_SRC.indexOf('if (safeMode.active) {');
  const branch = PAGE_SRC.slice(at, PAGE_SRC.indexOf('} else if (frameMoved) {', at));
  assert.ok(branch.length > 0, 'the safe-mode branch is no longer part of the base-image else-if chain');
  assert.ok(!/\breturn;/.test(branch),
    'safe mode returns early — the canvas state below would never load and the design would look lost');
  // The counter is read through the memoised resolver, which records the load during the first
  // client render — before any effect fetches anything. A load recorded after the heavy work
  // would never be recorded at all on the loads that die.
  assert.ok(/useMemo\(\(\) => designSafeMode\(\), \[\]\)/.test(PAGE_SRC),
    'safe mode is no longer resolved once per page load during render');
  assert.ok(/markPageSettled\(window\.localStorage/.test(PAGE_SRC),
    'nothing clears the streak — safe mode would latch on forever once it engaged');
  // Accepts both the arrow form and the block form (the callback grew a second job on 15 Aug:
  // deleting the server-rescue cookie). The invariant is the TIMER, not the callback's shape.
  assert.ok(/window\.setTimeout\(\(\) => \{?\s*\n?\s*markPageSettled/.test(PAGE_SRC),
    'the streak must be cleared on a TIMER: clearing it during render would mark a page settled '
    + 'the instant it opened, which is precisely the moment before it dies');
});

test('a light load never also renders sheets at print resolution', () => {
  // Rory, on the FREE no-AI sheet: "It's crashing even on the exact button." A phone that could
  // not survive opening the design must not then be handed the 1.5x sheet master.
  const scaleSrc = readFileSync(new URL('../lib/sheet-scale.ts', import.meta.url), 'utf8');
  const at = scaleSrc.indexOf('function readStoredScale()');
  const body = scaleSrc.slice(at, scaleSrc.indexOf('\n}', at));
  const guard = body.indexOf('peekSafeMode().active');
  const stored = body.indexOf("localStorage.getItem(SHEET_SCALE_KEY)");
  assert.ok(guard > 0, 'safe mode no longer caps the sheet scale');
  assert.ok(stored < 0 || guard < stored, 'the safe-mode cap must win over the stored preference');
  // peek, not the recording resolver: sheet-scale is imported by pages that are not the design
  // page, and counting their loads would inflate the streak.
  assert.ok(!scaleSrc.includes('designSafeMode('),
    'sheet-scale must peek at safe mode, never record a design-page load');
});

test('the streak is kept per farm, so a heavy design never disarms a healthy one', () => {
  // Rory, with three farms open: "my other 2 places don't crash it's only ubhejane creche."
  // A global counter would strip the photograph from the two innocent farms as well.
  const heavy = pageLoadKey('?lat=-27.72619&lon=31.96317');
  const other = pageLoadKey('?lat=-29.10000&lon=30.50000');
  assert.notEqual(heavy, other, 'two farms share one crash budget');
  assert.ok(heavy.startsWith(CRASH_LOOP_KEY), 'the per-farm key must stay under the same namespace');

  const store = memoryStore();
  for (let crash = 0; crash < CRASH_LOOP_THRESHOLD; crash++) recordPageLoad(store, heavy);
  assert.equal(isCrashLooping(recordPageLoad(store, other)), false,
    'the healthy farm must open with its photo even while the heavy one is looping');
  assert.equal(isCrashLooping(Number(store.getItem(heavy))), true, 'the heavy farm must still be caught');

  // Settling one farm must not clear another's streak.
  markPageSettled(store, other);
  assert.equal(isCrashLooping(Number(store.getItem(heavy))), true);
  // A URL with no coordinates still gets protection, just shared.
  assert.equal(pageLoadKey(''), CRASH_LOOP_KEY);
  assert.equal(pageLoadKey('?lat=1'), CRASH_LOOP_KEY, 'half a coordinate pair identifies nothing');
});

test('settle clears the same key the decision was read from', () => {
  // Clearing the shared key while the streak lives under the per-farm one would let safe mode
  // latch on permanently — the failure mode that turns a rescue into a new complaint.
  const at = PAGE_SRC.indexOf('markPageSettled(window.localStorage');
  assert.ok(at > 0, 'the settle timer is gone');
  assert.ok(PAGE_SRC.slice(at, at + 80).includes('safeMode.key'),
    'settle clears a different key than the one the streak was counted under');
});

test('a window without a usable location never throws — a throw here is a blank app', () => {
  // peekSafeMode runs at MODULE LOAD of lib/sheet-scale, which most of the app imports. `window`
  // can exist without `location` (test shims, embedded webviews, SSR emulations); throwing there
  // does not produce a wrong answer, it produces a white screen. Found by tests/sheet-scale.
  const src = readFileSync(new URL('../lib/crash-loop.ts', import.meta.url), 'utf8');
  assert.ok(!/window\.location\.search/.test(src),
    'an unguarded window.location read is back — it will throw at module scope and blank the app');
  assert.ok(/window\.location\?\.search/.test(src), 'the defensive location read is gone');
});

test('the settle clock starts when the heavy work ends, never on a fixed schedule', () => {
  // HOW THE SHIPPED GUARD WAS BEATEN. 13 August, Ubhejane, on 4G: "A problem repeatedly occurred"
  // — with this guard already deployed. The settle timer ran from MOUNT, so on a slow connection
  // it fired while the photo and underlay were still downloading, wiped the streak with a clean
  // record, and the bake then killed the page at second twelve. Every load repeated exactly that:
  // the counter could never reach the threshold, and the escape hatch built for this exact screen
  // never opened. A fixed timer measures the network, not survival.
  const settleAt = PAGE_SRC.indexOf('markPageSettled(window.localStorage');
  assert.ok(settleAt > 0, 'the settle timer is gone');
  const effect = PAGE_SRC.slice(PAGE_SRC.lastIndexOf('useEffect', settleAt), settleAt);
  assert.match(effect, /if \(!baseHeavyDone\) return;/,
    'the settle timer runs from mount again — a slow network will wipe the streak mid-download');

  // And every branch of the base pipeline must report in, or a farm on that branch settles never
  // (safe mode latches) or too early (the loop returns). One marker per branch:
  const markers = PAGE_SRC.match(/setBaseHeavyDone\(true\)/g) ?? [];
  assert.equal(markers.length, 6,
    `expected 6 pipeline branches to mark the heavy work done (safe, blank, satellite settled, `
    + `no imagery, photo fetch failed, bake finished) — found ${markers.length}; a missing branch `
    + 'latches safe mode on, an extra one may settle before the danger has run');

  // The photo farm's marker must hang off the BAKE, which is the peak allocation — not the fetch,
  // which merely precedes it.
  const bakeAt = PAGE_SRC.indexOf('bakeBaseAlignment(source.dataUrl');
  assert.ok(bakeAt > 0, 'the bake call moved; recheck where the photo farm reports settle');
  assert.match(PAGE_SRC.slice(bakeAt, bakeAt + 2200), /\.finally\(\(\) => setBaseHeavyDone\(true\)\)/,
    'surviving the downloads is not surviving the bake — the marker must follow the bake');
});

test('the farmer page can stop digging too', () => {
  // "IT'S HAPPENING EVERYWHERE!" — 13 August, minutes after Ubhejane's design page hit the
  // terminal screen, with /farmer?panel=Reports in the screenshot. Nothing merged that day
  // touches this page's memory profile; what the screen exposed is that /design was the only
  // page that knew how to stop. This page mounts Mapbox GL with satellite tiles on every load,
  // and on a phone short of memory it died identically on every retry — locking a farmer out of
  // their REPORTS because the MAP behind them is expensive.
  //
  // Exercised in a real browser (Chromium, iPhone viewport): three loads abandoned before
  // settling, and the fourth opened with the placeholder shown, the Reports panel alive, the
  // mapbox canvas genuinely unmounted, and the streak at 4; tapping "Load the map" cleared the
  // streak and remounted. These assertions keep that wiring from drifting.
  const farmer = readFileSync(new URL('../app/farmer/page.tsx', import.meta.url), 'utf8');

  // The guard is resolved once per load and the MAP is what it withholds — never the panels.
  assert.match(farmer, /pageCrashGuard\(FARMER_LOAD_KEY\)/, 'the farmer page no longer counts its own loads');
  assert.match(farmer, /\{mapHeld \? \(/, 'the guard no longer holds the map back');
  // The escape hatch must clear the SAME key the streak lives under.
  assert.match(farmer, /exitPageCrashGuard\(mapGuard\.key\)/, 'the "Load the map" button is gone or clears the wrong key');

  // Settle is gated on the map actually coming up — a fixed timer from mount is how the design
  // page's guard was beaten on 4G. A held load settles on the timer alone, because nothing heavy
  // mounts at all.
  assert.match(farmer, /if \(!mapReady && !mapGuard\.active\) return;/,
    'the settle timer runs from mount again — a slow network will wipe the streak mid-load');
  assert.match(farmer, /onMapReady=\{\(\) => setMapReady\(true\)\}/,
    'nothing reports the map came up, so a healthy load can never settle');

  // And the signal is real: Map.tsx must actually fire it from mapbox's own onLoad.
  const map = readFileSync(new URL('../components/Map.tsx', import.meta.url), 'utf8');
  assert.match(map, /onMapReady\?\.\(\);/, 'PermaMap no longer announces that the map initialised');
});

test('a dead load leaves behind the step it died in, and a healthy one wipes it', () => {
  // Every crash so far was diagnosed by reasoning backwards from screenshots, because a killed
  // page leaves nothing. Now each dangerous step notes itself before running; the note survives
  // a death, the settle wipes it, and the safe-mode banner reads it back — so the farmer's next
  // screenshot carries the diagnosis with it.
  const store = memoryStore();
  const key = 'k';
  noteCrashPhase(store, key, 'merging your photo with the map');
  assert.equal(lastCrashPhase(store, key), 'merging your photo with the map');
  markPageSettled(store, key);
  assert.equal(lastCrashPhase(store, key), null, 'a settled page must not carry a stale accusation');

  // Every dangerous step in the design pipeline names itself, and the banner reads the note.
  const page = PAGE_SRC;
  for (const phase of [
    'downloading your photo',
    'downloading the satellite backdrop',
    'downloading the satellite image',
    'merging your photo with the map',
  ]) {
    assert.ok(page.includes(`'${phase}'`), `the "${phase}" step no longer notes itself`);
  }
  assert.match(page, /lastCrashPhase\(window\.localStorage, safeMode\.key\)/,
    'the banner no longer reads the phase note — screenshots go back to being guesswork');
});

test('a generate that keeps killing the page goes light, and only a death counts', () => {
  // "Even if I try and generate a report it crashes." The page guards cannot see this: a
  // generate crash lands minutes after the page settled, on a clean record. The generate flow
  // keeps its own streak — recorded before the heavy work, cleared on ANY outcome the page
  // survives — so it grows only when the page died mid-generate.
  const store = memoryStore();
  assert.equal(reportShouldGoLight(recordReportAttempt(store)), false, 'a first attempt must send the sheets');
  assert.equal(reportShouldGoLight(recordReportAttempt(store)), false, 'one death can be bad luck');
  assert.equal(reportShouldGoLight(recordReportAttempt(store)), true, 'two deaths over one button is a pattern');
  reportAttemptSurvived(store);
  assert.equal(reportShouldGoLight(recordReportAttempt(store)), false, 'a survived attempt must reset the streak');

  const view = readFileSync(new URL('../components/ReportView.tsx', import.meta.url), 'utf8');
  // Recorded BEFORE the heavy work — after is too late for the attempt that dies.
  const record = view.indexOf('recordReportAttempt(window.localStorage)');
  const heavy = view.indexOf('prepareSiteAnalysisImages(plates, loadSheetImage, sheetPlate)');
  assert.ok(record > 0 && heavy > record, 'the attempt must be recorded before the sheet decode that kills');
  // Light skips exactly the megapixel step; the 400px ground photos still go.
  assert.match(view, /const siteImages = light\s*\n\s*\? \[\]/, 'light mode no longer skips the sheet decode');
  assert.doesNotMatch(view.slice(0, record), /light \? \[\] : prepareGroundPhotos/,
    'the ground photos are 400px thumbnails and must never be dropped');
  // Cleared in finally — the page being alive to run that line is the entire test.
  assert.match(view, /finally \{\s*\n[^}]*reportAttemptSurvived\(window\.localStorage\)/,
    'the streak must clear on every survived outcome, or network errors escalate into light mode');
  // And the farmer is told, in one line, why this report went light.
  assert.match(view, /\{wentLight && \(/, 'a light report must say so, or the missing analysis reads as a bug');
});

test('the threshold fits inside what iOS Safari actually allows', () => {
  // Safari reloads a crashed page exactly ONCE by itself; the second death is the terminal
  // "A problem repeatedly occurred" screen, after which nothing runs. A threshold above 2 can
  // therefore only be reached across separate openings — and Rory's crashes came through an
  // in-app browser whose storage need not survive between openings, which is how the guard
  // shipped, was verified in a persistent browser, and still produced four screenshots of the
  // same grey screen in one day. At 2, the automatic reload IS the safe load. Raising this
  // needs an answer to: how does load three ever happen on the screen above?
  assert.equal(CRASH_LOOP_THRESHOLD, 2);
});

test('a session that dies AFTER settling still counts, and the auto-reload opens light', () => {
  // "That was in the design generate a map page but I am sure it just crashes everywhere." The
  // load counter only sees loads that die before settling; a generate crash lands minutes after
  // settle, on a clean record. The death watch closes that hole: ALIVE without CLEAN-EXIT means
  // the last session was killed in the farmer's hands, whichever button did it.
  const store = memoryStore();
  const key = 'k';

  // Load 1: healthy start, settles, then dies mid-generate (no clean exit ever recorded).
  startDeathWatch(store, key);
  recordPageLoad(store, key);
  markPageSettled(store, key); // the load survived its startup — streak cleared
  // ...the page is killed while generating. Nothing runs. Then the automatic reload:
  const second = startDeathWatch(store, key);
  assert.equal(second.previousSessionDied, true, 'a foreground death after settle went unnoticed');
  const decision = resolveSafeMode(recordPageLoad(store, key), false, key);
  assert.equal(decision.active, true, 'the reload after a mid-session crash must open light');
});

test('a startup death is never counted twice', () => {
  // The load counter already carries a load that died before settling; the death watch adding
  // one more would make a single startup crash read as a loop on its own.
  const store = memoryStore();
  const key = 'k';
  startDeathWatch(store, key);
  recordPageLoad(store, key); // dies before settling — counter stands at 1
  const second = startDeathWatch(store, key);
  assert.equal(second.previousSessionDied, false, 'the unsettled load was double-counted');
  assert.equal(resolveSafeMode(recordPageLoad(store, key), false, key).active, true,
    'two dead loads must still engage safe mode through the load counter alone');
});

test('backgrounding is housekeeping, not a crash', () => {
  // iOS routinely evicts BACKGROUND tabs to reclaim memory. A farmer who switched apps and came
  // back tomorrow must not lose their photo over it — only a foreground death counts.
  const store = memoryStore();
  const key = 'k';
  startDeathWatch(store, key);
  recordPageLoad(store, key);
  markPageSettled(store, key);
  markCleanExit(store, key); // home button / app switcher
  // iOS evicts the tab overnight; the next open must read as clean:
  assert.equal(startDeathWatch(store, key).previousSessionDied, false,
    'a background eviction was counted as a crash');

  // But coming BACK to the foreground re-arms the watch — a death after resuming counts.
  markResumed(store, key);
  // (this session now dies in the foreground)
  assert.equal(startDeathWatch(store, key).previousSessionDied, true,
    'a death after resuming from the background went unnoticed');
});

test('both guards run the death watch before counting their own load', () => {
  // Order is the contract: startDeathWatch reads the counter as the LAST session left it to tell
  // a startup death (already counted) from a mid-session one (invisible until now). Counting the
  // new load first would make every death look like a startup death.
  const lib = readFileSync(new URL('../lib/crash-loop.ts', import.meta.url), 'utf8');
  for (const fn of ['designSafeMode', 'pageCrashGuard']) {
    const at = lib.indexOf(`export function ${fn}(`);
    const body = lib.slice(at, lib.indexOf('\n}', at));
    const watch = body.indexOf('startDeathWatch(');
    const count = body.indexOf('recordPageLoad(');
    assert.ok(watch > 0, `${fn} no longer watches for mid-session deaths`);
    assert.ok(count > watch, `${fn} counts its load before checking how the last session ended`);
    assert.ok(body.indexOf('watchSessionExit(') > 0, `${fn} never wires the exit markers`);
  }
});

test('bouncing off the page on purpose is not a crash streak', () => {
  // Open the page, tap away before the settle timer, twice. At a threshold of two, counting
  // those as dead loads would hold the map on the third visit for no reason — so a clean exit
  // settles the load as well as flagging the exit (the page was alive when they left; that is
  // the whole meaning of settled). This models what watchSessionExit's leave() does.
  const store = memoryStore();
  const key = 'k';
  for (let visit = 0; visit < 2; visit++) {
    startDeathWatch(store, key);
    recordPageLoad(store, key);
    markPageSettled(store, key); // leave() half one
    markCleanExit(store, key);   // leave() half two
  }
  startDeathWatch(store, key);
  assert.equal(resolveSafeMode(recordPageLoad(store, key), false, key).active, false,
    'two deliberate bounces held the map');

  // And the handlers really do both halves — asserted at the source, where they are wired.
  const lib = readFileSync(new URL('../lib/crash-loop.ts', import.meta.url), 'utf8');
  const leave = lib.slice(lib.indexOf('const leave = () => {'), lib.indexOf('const onHide'));
  assert.match(leave, /markPageSettled/, 'a clean exit no longer settles the load');
  assert.match(leave, /markCleanExit/, 'a clean exit no longer flags itself');
});

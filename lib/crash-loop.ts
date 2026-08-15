// A PAGE THAT KEEPS DYING MUST COME BACK SIMPLER, NOT THE SAME WAY.
//
// Rory, three times across one evening, on the same URL: "A problem repeatedly occurred on
// https://imbewufield.vercel.app/design?lat=…". That is iOS Safari's terminal screen — the OS has
// killed the page for memory several times in a row and stopped trying. The design URL was, from
// the farmer's side, permanently broken: every attempt to open it did the same heavy work and died
// the same way, and nothing in the app noticed it was in a loop.
//
// Individual allocations were trimmed first (release-canvas, the render-resume budget, a smaller
// difference measurement). Each one helped and none of them closed the hole, because the hole is
// structural: opening one design downloads the drone photo AND the satellite underlay as data
// URLs and supersamples them into a bake canvas, before the farmer has touched anything. On a
// phone with a big photo and little free memory, that is simply too much — and it re-runs on every
// reload, which is what turns one crash into a loop.
//
// So the page counts its own loads. Each load increments a counter BEFORE the heavy work starts —
// a page that is killed mid-load never gets to run anything afterwards, so "did we survive" can
// only be recorded later, never at the moment of death. A page still alive after SETTLE_MS clears
// the counter. Loads that keep dying therefore keep counting, and at the threshold the app opens
// in SAFE MODE: the farmer's design, geometry and measurements exactly as they are, with the
// photo pixels left out. Not a repair — an escape hatch that always fits through the door.
//
// The farmer's stored base-mode choice is never written by this. Safe mode overrides what is
// LOADED for one page load; the next healthy load brings their photo back on its own.

/** Where the load counter lives. localStorage, not sessionStorage: an iOS memory kill can start a
 *  fresh session, and a counter that resets on the very event it exists to count is no counter. */
export const CRASH_LOOP_KEY = 'imbewu_design_page_loads';

/**
 * The counter is PER FARM, not per app.
 *
 * Rory, once three of his farms were open: "my other 2 places don't crash it's only ubhejane
 * creche." That is the shape of the whole problem — one design carries a drone photo and years of
 * saved sheets, the others do not — and it means a global streak would punish the innocent farms
 * too: three crashes on the heavy one and his healthy farms would open without their photographs
 * for no reason. Keyed on the coordinates in the URL because they identify the site synchronously,
 * at the moment the page starts, long before any state has loaded.
 */
export function pageLoadKey(search: string): string {
  try {
    const params = new URLSearchParams(search);
    const lat = params.get('lat');
    const lon = params.get('lon');
    if (lat && lon) return `${CRASH_LOOP_KEY}:${lat},${lon}`;
  } catch {
    /* fall through to the shared key */
  }
  // No coordinates means one unidentified design; a single shared counter is still better than
  // no crash-loop protection at all.
  return CRASH_LOOP_KEY;
}

/** Consecutive unsettled loads before safe mode engages.
 *
 *  TWO, BECAUSE OF HOW iOS SAFARI COUNTS. It reloads a crashed page exactly once by itself, and
 *  the second death is the terminal "A problem repeatedly occurred" screen — after which nothing
 *  runs at all. At the old threshold of three, that automatic reload (load two) still ran the
 *  heavy path and died, so the third chance never arrived: the guard was beaten by the very
 *  screen it exists to prevent. Worse, Rory reproduced this from an in-app browser (a link
 *  opened inside another app), whose storage need not survive between presentations — so counts
 *  could not accumulate ACROSS openings either, and 14 August ended with the fourth screenshot
 *  of the same grey screen, guard shipped and useless. At two, the automatic reload IS the safe
 *  load: one crash, and the page comes back light inside the same presentation.
 *
 *  The price is that a single unlucky kill (a busy phone, nothing wrong with the design) opens
 *  the next load without its photo once — with the amber banner and its one-tap way back. That
 *  is a mild cost on a page where light mode keeps every drawing and every measurement. */
export const CRASH_LOOP_THRESHOLD = 2;

/** How long the page must stay alive AFTER THE HEAVY WORK FINISHES before the load counts as
 *  settled.
 *
 *  After, not after mount. This began as a fixed timer from page load, described here as "long
 *  enough to cover the photo fetch + bake" — and on 13 August Ubhejane crash-looped straight
 *  through the shipped guard, on 4G, because a slow network falsifies any fixed number: the
 *  downloads were still in flight when the timer fired, the streak was wiped with a clean
 *  record, and the bake then killed the page at second twelve. Every load repeated exactly that,
 *  so the counter could never reach the threshold and safe mode never engaged. The design page
 *  now starts this clock only once its base pipeline reports the dangerous allocations are done
 *  (or that none will run), so "settled" means what it claims: the work happened and the page
 *  survived it. */
export const CRASH_LOOP_SETTLE_MS = 8000;

/** The one slice of Storage this needs — injectable so the policy is testable without a browser. */
export interface CrashLoopStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Parse the stored counter and add this load. Anything unreadable counts as a first load:
 *  refusing the farmer's photo on the strength of a corrupt string would be its own bug. */
export function nextLoadCount(stored: string | null): number {
  const parsed = Number(stored);
  const previous = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  return previous + 1;
}

/** Has this design page died enough times in a row to stop loading its photo? */
export function isCrashLooping(count: number, threshold: number = CRASH_LOOP_THRESHOLD): boolean {
  return count >= threshold;
}

/** Record that a load STARTED, and report how many have started without one settling.
 *  Call before the heavy work — after it is too late for the load that dies. */
export function recordPageLoad(store: CrashLoopStore, key: string = CRASH_LOOP_KEY): number {
  try {
    const count = nextLoadCount(store.getItem(key));
    store.setItem(key, String(count));
    return count;
  } catch {
    return 1; // storage unavailable: behave like a healthy first load, never like a loop
  }
}

/** This page stayed up. Forget the streak — and the phase note that goes with it. */
export function markPageSettled(store: CrashLoopStore, key: string = CRASH_LOOP_KEY): void {
  try {
    store.removeItem(key);
    store.removeItem(`${key}:phase`);
  } catch {
    /* ignore */
  }
}

// ── Deaths AFTER the page settled ─────────────────────────────────────────────────────────────
//
// "That was in the design generate a map page but I am sure it just crashes everywhere."
//
// The load counter above is structurally blind to half the crashes. It counts loads that die
// BEFORE settling; a crash while generating a map or a report lands minutes after settle, on a
// clean record, so the page reloads heavy and offers the same button again. Per-button attempt
// streaks (lib/report-attempts.ts) patch one button at a time — whack-a-mole.
//
// The general answer is to detect that the previous SESSION died, whenever and however:
//  · every load writes an ALIVE marker that nothing ever removes during the session;
//  · leaving normally — pagehide, or the tab going to the background — writes a CLEAN-EXIT
//    marker; coming back to the foreground removes it again;
//  · a new load that finds ALIVE without CLEAN-EXIT knows the last session was killed while the
//    farmer was looking at it. That is a crash, whichever button caused it.
//
// The background rule is load-bearing: iOS routinely evicts BACKGROUND tabs to reclaim memory,
// and that is housekeeping, not a crash — a farmer who switched apps and came back tomorrow
// must not lose their photo over it. Only a death in the foreground counts.
//
// A post-settle death adds ONE to the same streak the load counter uses, and the arriving load
// adds its own one — so at CRASH_LOOP_THRESHOLD = 2, the automatic reload after a mid-session
// crash is already the safe load, exactly as it is for a startup crash. A death during an
// UNSETTLED load is not added: the load counter already carries that one, and counting it twice
// would make a single startup crash read as a loop.
//
// False positives — a battery dying, a force-quit mid-use — cost one light load, with the amber
// banner and its one-tap way back. That is the deliberate trade throughout this module.

/** The farmer left this page the normal way (or iOS put it in the background). Not a crash. */
export function markCleanExit(store: CrashLoopStore, key: string): void {
  try {
    store.setItem(`${key}:clean`, '1');
  } catch {
    /* ignore */
  }
}

/** The page is in front of the farmer again — a later death counts again. */
export function markResumed(store: CrashLoopStore, key: string): void {
  try {
    store.removeItem(`${key}:clean`);
  } catch {
    /* ignore */
  }
}

/**
 * Start the watch for THIS session and report on the previous one.
 * Call BEFORE recordPageLoad — the unsettled check reads the counter as the last session left it.
 */
export function startDeathWatch(store: CrashLoopStore, key: string): { previousSessionDied: boolean } {
  let previousSessionDied = false;
  try {
    const alive = store.getItem(`${key}:alive`);
    const clean = store.getItem(`${key}:clean`);
    const parsed = Number(store.getItem(key));
    const unsettled = Number.isFinite(parsed) && parsed > 0;
    // ALIVE and no CLEAN-EXIT: the last session was killed in the foreground. If its LOAD never
    // settled the load counter already carries it; otherwise this is the invisible kind — a
    // generate crash — and it joins the same streak here.
    if (alive && !clean && !unsettled) {
      previousSessionDied = true;
      recordPageLoad(store, key);
    }
    store.setItem(`${key}:alive`, '1');
    store.removeItem(`${key}:clean`);
  } catch {
    /* storage unavailable: watch nothing, break nothing */
  }
  return { previousSessionDied };
}

/** Wire the exit/resume markers to the events iOS actually fires. Returns an unsubscribe. */
export function watchSessionExit(key: string): () => void {
  if (typeof window === 'undefined') return () => {};
  // Leaving ON PURPOSE also settles the load. Without this, a farmer who opens the page and taps
  // away before the settle timer — twice — reads as two dead loads, and at a threshold of two
  // their next visit opens light for no reason. The page was alive when they left; that is the
  // whole meaning of settled.
  const leave = () => {
    markPageSettled(window.localStorage, key);
    markCleanExit(window.localStorage, key);
  };
  const onHide = leave;
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') leave();
    else markResumed(window.localStorage, key);
  };
  // BOTH events, deliberately. pagehide covers navigation and tab close; visibilitychange covers
  // the home button, the app switcher and iOS backgrounding — where pagehide is unreliable and
  // where the memory eviction that must NOT count as a crash actually happens.
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    window.removeEventListener('pagehide', onHide);
    document.removeEventListener('visibilitychange', onVisibility);
  };
}

// ── What was the page DOING when it died? ─────────────────────────────────────────────────────
//
// 14 August, the fourth screenshot of the same grey screen: every crash so far has been diagnosed
// by reasoning backwards from symptoms, because a killed page leaves nothing behind. So the heavy
// pipeline now writes a one-word note BEFORE each dangerous step, to the same localStorage that
// carries the streak. A page that survives clears it (markPageSettled above); a page that dies
// leaves the note standing, and the safe-mode banner can then say "it closed while merging your
// photo" — to the farmer, and through the farmer's screenshot, to whoever is debugging. The
// farmer's phone becomes the profiler nobody can attach to it.

/** Note the step about to run. One word, farmer-readable — it may end up on a banner. */
export function noteCrashPhase(store: CrashLoopStore, key: string, phase: string): void {
  try {
    store.setItem(`${key}:phase`, phase);
  } catch {
    /* ignore */
  }
}

/** The step the last dead load was in, or null after a healthy one. */
export function lastCrashPhase(store: CrashLoopStore, key: string): string | null {
  try {
    return store.getItem(`${key}:phase`);
  } catch {
    return null;
  }
}

export interface SafeModeDecision {
  active: boolean;
  /** Why, in a word: the farmer asked for it, or the app stopped digging. */
  reason: 'requested' | 'crash-loop' | null;
  /** Consecutive unsettled loads including this one — for the banner and for logs. */
  loads: number;
  /** The per-farm storage key this decision was read from; settle must clear the SAME one. */
  key: string;
}

/**
 * Decide whether this page load runs without its photo.
 *
 * `requested` covers the manual escape hatch (`?safe=1`): a farmer or a support conversation can
 * force the light path immediately, without waiting for the counter to reach the threshold. It is
 * checked first so it works even on a perfectly healthy phone.
 */
export function resolveSafeMode(
  loads: number,
  requested: boolean,
  key: string = CRASH_LOOP_KEY,
): SafeModeDecision {
  if (requested) return { active: true, reason: 'requested', loads, key };
  if (isCrashLooping(loads)) return { active: true, reason: 'crash-loop', loads, key };
  return { active: false, reason: null, loads, key };
}

/** The decision for THIS page load, resolved once and remembered.
 *
 *  Cached deliberately: the counter must advance once per page load, not once per caller or once
 *  per React re-render, and a component body is allowed to ask more than once. On the server there
 *  is no page to crash and no storage to read, so it answers "not safe" WITHOUT caching — the
 *  client's own first call is what counts the load. */
let resolvedForThisLoad: SafeModeDecision | null = null;

/** This page's query string, or '' if anything about reading it is unusual.
 *
 *  DEFENSIVE ON PURPOSE. peekSafeMode runs at MODULE LOAD of lib/sheet-scale, which most of the
 *  app imports, so a throw here is not a wrong answer — it is a blank app. `window` can exist
 *  without a usable `location` (test shims, embedded webviews, some SSR emulations), and this
 *  module's entire job is surviving a page that is already fragile. */
function currentSearch(): string {
  try {
    return typeof window === 'undefined' ? '' : (window.location?.search ?? '');
  } catch {
    return '';
  }
}

export function designSafeMode(): SafeModeDecision {
  if (resolvedForThisLoad) return resolvedForThisLoad;
  if (typeof window === 'undefined') return { active: false, reason: null, loads: 0, key: CRASH_LOOP_KEY };
  const search = currentSearch();
  const key = pageLoadKey(search);
  let requested = false;
  try {
    requested = new URLSearchParams(search).get('safe') === '1';
  } catch {
    /* a URL we cannot parse is not a request for safe mode */
  }
  // BEFORE the load is counted: did the last session die in the foreground after settling?
  // That is the generate-a-map / generate-a-report crash the load counter cannot see.
  startDeathWatch(window.localStorage, key);
  watchSessionExit(key);
  resolvedForThisLoad = resolveSafeMode(recordPageLoad(window.localStorage, key), requested, key);
  return resolvedForThisLoad;
}

/**
 * The same guard for any OTHER page — the farmer map first.
 *
 * 13 August, minutes after Ubhejane's design page hit the terminal screen: "It's happening
 * everywhere!" — with /farmer?panel=Reports in the screenshot. Nothing merged that day touches
 * that page's memory profile; what it exposed is that /design was the only page that knew how to
 * stop digging. The farmer page mounts Mapbox GL with satellite tiles on every load, so when a
 * phone is short of memory — many tabs, a long day, 4G — it dies the same way and, with no
 * counter, retries the same way forever. A farmer locked out of their REPORTS because the MAP
 * behind them is expensive is the exact shape safe mode exists for.
 *
 * Keyed per page (one farmer map, unlike the per-farm design keys), cached per page load for the
 * same reason designSafeMode is: the counter must advance once per load, not once per render.
 */
export const FARMER_LOAD_KEY = 'imbewu_farmer_page_loads';

const resolvedByKey = new Map<string, SafeModeDecision>();

export function pageCrashGuard(storageKey: string): SafeModeDecision {
  const cached = resolvedByKey.get(storageKey);
  if (cached) return cached;
  if (typeof window === 'undefined') return { active: false, reason: null, loads: 0, key: storageKey };
  let requested = false;
  try {
    requested = new URLSearchParams(currentSearch()).get('safe') === '1';
  } catch {
    /* not a request */
  }
  // Same order as designSafeMode: detect a foreground death from the LAST session before this
  // load adds its own count — see startDeathWatch.
  startDeathWatch(window.localStorage, storageKey);
  watchSessionExit(storageKey);
  const decision = resolveSafeMode(recordPageLoad(window.localStorage, storageKey), requested, storageKey);
  resolvedByKey.set(storageKey, decision);
  return decision;
}

/** Leave a pageCrashGuard's light mode: forget the streak and reload heavy. */
export function exitPageCrashGuard(storageKey: string): void {
  if (typeof window === 'undefined') return;
  markPageSettled(window.localStorage, storageKey);
  resolvedByKey.delete(storageKey);
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('safe');
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

/** Read the decision WITHOUT counting a load.
 *
 *  For modules that merely need to know whether this load is a light one — the sheet scale, for
 *  instance — and are imported by pages that are not the design page. Only designSafeMode()
 *  advances the counter, and only the design page calls it, so "consecutive design-page loads"
 *  cannot be inflated by a farmer browsing the course. */
export function peekSafeMode(): SafeModeDecision {
  if (resolvedForThisLoad) return resolvedForThisLoad;
  if (typeof window === 'undefined') return { active: false, reason: null, loads: 0, key: CRASH_LOOP_KEY };
  const search = currentSearch();
  const key = pageLoadKey(search);
  let requested = false;
  let loads = 0;
  try {
    requested = new URLSearchParams(search).get('safe') === '1';
  } catch {
    /* not a request */
  }
  try {
    const parsed = Number(window.localStorage.getItem(key));
    loads = Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  } catch {
    /* no storage: treat as healthy */
  }
  return resolveSafeMode(loads, requested, key);
}

/** Leave safe mode: forget the streak, drop `?safe=1`, and load the page fresh WITH the photo.
 *  A full reload rather than a state flip, because the photo pipeline reads its base decision
 *  once per load — the same reload contract the sheet-scale setting uses. */
export function exitSafeMode(): void {
  if (typeof window === 'undefined') return;
  markPageSettled(window.localStorage, pageLoadKey(currentSearch()));
  resolvedForThisLoad = null;
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('safe');
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}

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

/** Consecutive unsettled loads before safe mode engages. Two crashes can be bad luck (a huge
 *  photo, a busy phone); three in a row is the loop, and the farmer has by then watched the app
 *  die three times. */
export const CRASH_LOOP_THRESHOLD = 3;

/** How long a page must stay alive before it counts as a successful load. Long enough to cover
 *  the photo fetch + bake that does the killing, short enough that a farmer who reads the screen
 *  for a moment and reloads by hand is not mistaken for a crash. */
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

/** This page stayed up. Forget the streak. */
export function markPageSettled(store: CrashLoopStore, key: string = CRASH_LOOP_KEY): void {
  try {
    store.removeItem(key);
  } catch {
    /* ignore */
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
  resolvedForThisLoad = resolveSafeMode(recordPageLoad(window.localStorage, key), requested, key);
  return resolvedForThisLoad;
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

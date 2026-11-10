// The crop planner page lets a grower choose their sowing calendar and tells them which
// saved sowings fall outside it. These read the page source, as plan-assurance does, so a
// rewrite that drops the wiring fails here rather than in a grower's plan.
//
// WHY (10 November 2026, Rory: "go ahead with decisions 2 and 3"): the accuracy audit showed
// the grid cell can give the wrong calendar (Mbombela, Tzaneen, Worcester), and the grower
// knows their land. Nothing may rewrite a saved plan, so the page only lists what is off.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { hiddenCalendarNoticeWrite } from '@/lib/sowing-calendar-review';

const page = readFileSync(new URL('../app/facilitator/crops/page.tsx', import.meta.url), 'utf8');

function functionBody(name: string): string {
  const start = page.indexOf(`function ${name}(`);
  assert.ok(start > 0, `${name} must exist on the page`);
  const next = page.indexOf('\n  function ', start + 10);
  return page.slice(start, next > 0 ? next : start + 1500);
}

test('the sowing months a grower is offered come from the one calendar-in-use rule, with their own choice first', () => {
  assert.match(page, /sowingCalendarInUse\(\{[^}]*chosen:\s*chosenCalendar/);
  assert.match(page, /const pattern: RainPattern = calendarInUse\.pattern/);
  assert.match(page, /sowingCalendarChoiceFor\(plan, calendarScopeId\)/);
});

test('a calendar the grower chose is saved with the plan book and survives a reload', () => {
  const body = functionBody('chooseSowingCalendar');
  assert.match(body, /withSowingCalendarChoice\(/);
  assert.match(body, /setPlan\(/);
});

test('choosing a calendar goes through the autosave path, so it cannot bypass the stale-plan and conflict checks', () => {
  const body = functionBody('chooseSowingCalendar');
  assert.doesNotMatch(body, /saveCropPlanWithReceipt/);
  assert.doesNotMatch(body, /pushPlanHistory/);
});

test('the grower can pick a calendar or hand the decision back to the app, on a tap-sized control', () => {
  assert.match(page, /Sowing calendar for this site/);
  assert.match(page, /Let the app decide: /);
  assert.match(page, /SOWING_CALENDAR_OPTIONS\.map\(/);
  const select = page.slice(page.indexOf('Sowing calendar for this site'), page.indexOf('Choose one only if you know your land'));
  assert.match(select, /min-h-11/);
});

test('the page says when a calendar is the grower\'s own and not the satellite climate', () => {
  assert.match(page, /chosen by you/);
  assert.match(page, /Sowing calendar chosen by the grower/);
  assert.match(page, /Sowing calendar you chose/);
  assert.match(page, /You chose this calendar yourself\./);
});

test('a grower is told which planned sowings fall outside their calendar and that nothing was moved', () => {
  assert.match(page, /sowingsOutsideCalendar\(/);
  assert.match(page, /outOfCalendarSignature\(/);
  assert.match(page, /outOfCalendarLine\(/);
  assert.match(page, /Nothing has been changed/);
  assert.match(page, /Make a new plan/);
  assert.match(page, /Hide this list/);
});

test('hiding the list is remembered per site and per account, and read only after mount', () => {
  // This test used to pin a read and a write of the bare key 'imbewu_sowing_calendar_notice_hidden_v1'.
  // That was the fault: the record names a farm (its scope id is the site's coordinates) and its
  // crops, and a bare key stays in the browser for the next account on a shared phone. Every other
  // store of farm data here goes through activeAccountLocalStorageKey. Found on 10 November 2026
  // while checking the hosted build, before the feature was released.
  assert.doesNotMatch(page, /imbewu_sowing_calendar_notice_hidden_v1/, 'the bare key name must not be written into the page');
  assert.doesNotMatch(page, /localStorage\.(getItem|setItem)\(SOWING_CALENDAR_NOTICE_HIDDEN_KEY/, 'never read or written under the bare key');
  assert.match(page, /const hiddenNoticeStorageKey = activeAccountLocalStorageKey\(SOWING_CALENDAR_NOTICE_HIDDEN_KEY\);/);

  // One read, inside an effect that re-runs when the account's key changes: the server render never touches storage.
  const reads = page.split('localStorage.getItem(hiddenNoticeStorageKey)').length - 1;
  assert.equal(reads, 1);
  const before = page.slice(0, page.indexOf('localStorage.getItem(hiddenNoticeStorageKey)'));
  assert.ok(before.lastIndexOf('useEffect(() => {') > before.lastIndexOf('\nfunction '), 'the read must sit inside a useEffect, not at module level or in render');
  const effect = page.slice(page.indexOf('localStorage.getItem(hiddenNoticeStorageKey)'));
  assert.match(effect.slice(0, 400), /\}, \[hiddenNoticeStorageKey\]\);/, 'a change of account re-reads that account\'s own record');
  assert.match(page, /parseHiddenCalendarNotices\(localStorage\.getItem\(hiddenNoticeStorageKey\)\)/, 'what is read is cleaned before use');

  // A record read for one account is never shown for another.
  assert.match(page, /hiddenCalendarNotice\.storageKey === hiddenNoticeStorageKey \? hiddenCalendarNotice\.byScope : \{\}/);
  assert.match(page, /hiddenForThisAccount\[outOfCalendarScope\] !== outOfCalendarKey/);
  // This test first pinned a write that "computes the key again at the moment of the tap" and merges
  // from page state. That write was itself a fault (review comment 6765460003): the key at tap time
  // chose a destination for the OLD render's site. The write is now pinned by the tests at the end of
  // this file, which run the real handler through an account, sample and site change. Here it is
  // enough that the old shape is gone.
  assert.doesNotMatch(page, /const storageKey = activeAccountLocalStorageKey\(SOWING_CALENDAR_NOTICE_HIDDEN_KEY\);/);
  assert.doesNotMatch(page, /hiddenCalendarNotice\.storageKey === storageKey/);
});

test('the notice gives the grower the real reason: their own calendar choice, or a plan older than the correction', () => {
  // Seen in the browser on 2026-11-10: a grower who had just chosen a different calendar was
  // told their plan predated a correction. Their choice is the reason, and it is known.
  const notice = page.slice(page.indexOf('aria-label="Sowings outside the sowing calendar"'));
  assert.match(notice, /calendarBasis === 'grower-choice'\s*\?\s*<p[^>]*>You chose the &quot;\{SOWING_CALENDAR_LABEL\[pattern\]\}&quot; calendar for this site\. These sowings were planned on a different one\.<\/p>/);
  assert.match(notice, /:\s*planMayPredateCorrection\(plan\?\.planNotesAt\) && <p[^>]*>Sowing months and calendars were corrected on 10 November 2026\./,
    'the correction sentence is only for a plan that may predate it, and never alongside the choice sentence');
});

test('the list of out-of-season sowings is not drawn from a fallback guess for a mapped site', () => {
  // Hosted preview, fresh visitor, sample farm: the climate had not loaded and two in-season
  // sowings were listed against the Durban fallback (PR #1328, comment 6762970071).
  assert.match(page, /const canJudgeSavedSowings = calendarCanJudgeSavedSowings\(calendarInUse\.basis, hasSiteCoords\);/);
  assert.match(page, /allowCataloguePlanning && canJudgeSavedSowings \? sowingsOutsideCalendar\(/);
});

test('the printed plan takes its calendar line from the one rule that names a grower\'s choice', () => {
  const meta = page.slice(page.indexOf('const exportMeta = useMemo'), page.indexOf('estimatedKgPerYear: totalYieldKg'));
  assert.match(meta, /const climateLine = printedSowingCalendarLine\(calendarLabel, calendarBasis, climateSource\);/);
  assert.match(meta, /\n\s+climateLine,\n/, 'the PDF receives that line unchanged');
  assert.doesNotMatch(meta, /climateLine: /, 'no second, differently worded climate line');
});

// ── A RETAINED "HIDE THIS LIST" HANDLER MUST NOT WRITE ACROSS AN ACCOUNT, SAMPLE OR SITE CHANGE ──
//
// Independent review of PR #1328 (comment 6765460003) ran the handler published at 73734a40 with
// a render made for account A and the active account switched to B before the tap. It wrote
// account A's site and crop list under account B's key. Reproduced here before the fix: the write
// was ["KEY::B", {"site:A-coordinates": ...}], and B's own earlier entry was gone. Working out the
// current key at tap time only chose a destination for old-render data.
//
// These tests run the page's ACTUAL handler and its ACTUAL two admission functions, cut out of the
// page source and given synthetic identities. Nothing here signs in to anything.
const { stripTypeScriptTypes } = await import('node:module');
const pageFunction = (name: string): string => {
  const start = page.indexOf(`  function ${name}(`);
  assert.ok(start > 0, `the page must define ${name}`);
  return stripTypeScriptTypes(page.slice(start, page.indexOf('\n  }\n', start) + 5));
};
const build = (source: string, name: string, deps: Record<string, unknown>) =>
  new Function(...Object.keys(deps), `${source}; return ${name};`)(...Object.values(deps)) as () => unknown;

interface World {
  mountedUid: string | null; firebaseUid: string | null; sample: boolean; backend: boolean;
  context: { current: { siteId: string | null; owner: string | null; sample: boolean; scopeKey: string | null } };
  planningScopeAllowed: boolean;
  store: Map<string, string>; reads: string[]; writes: [string, string][]; stateSets: unknown[];
}
const keyFor = (world: World) => (world.sample ? 'HIDDEN' : world.mountedUid ? `HIDDEN::uid:${world.mountedUid}` : 'HIDDEN::guest');
const newWorld = (over: Partial<World> = {}): World => ({
  mountedUid: 'A', firebaseUid: 'A', sample: false, backend: true,
  context: { current: { siteId: 'site:A', owner: 'A', sample: false, scopeKey: 'scope:A' } },
  planningScopeAllowed: true, store: new Map(), reads: [], writes: [], stateSets: [], ...over,
});
/** One render's closure: its own owner, sample flag, site, scope, storage key, list scope and signature. */
function renderedHide(world: World, scope: string, signature: string) {
  const mine = { ...world.context.current };
  const plannerActorIsCurrent = build(pageFunction('plannerActorIsCurrent'), 'plannerActorIsCurrent', {
    activeAccountUid: () => (world.sample ? null : world.mountedUid), isSampleMode: () => world.sample,
    isBackendConfigured: () => world.backend, getFirebase: () => ({ auth: { currentUser: world.firebaseUid ? { uid: world.firebaseUid } : null } }),
  });
  const growerActorIsCurrent = build(pageFunction('growerActorIsCurrent'), 'growerActorIsCurrent', {
    growerBookContext: world.context, growerOwner: mine.owner, growerSample: mine.sample,
    productionSiteId: mine.siteId, growerScopeKey: mine.scopeKey, plannerActorIsCurrent,
  });
  return build(pageFunction('hideCalendarNotice'), 'hideCalendarNotice', {
    activeAccountLocalStorageKey: () => keyFor(world), SOWING_CALENDAR_NOTICE_HIDDEN_KEY: 'HIDDEN',
    growerActorIsCurrent, currentPlanningScopeAllowed: () => world.planningScopeAllowed,
    hiddenCalendarNoticeWrite, hiddenNoticeStorageKey: keyFor(world),
    outOfCalendarScope: scope, outOfCalendarKey: signature,
    setHiddenCalendarNotice: (next: unknown) => { world.stateSets.push(next); },
    localStorage: {
      getItem: (key: string) => { world.reads.push(key); return world.store.get(key) ?? null; },
      setItem: (key: string, value: string) => { world.writes.push([key, value]); world.store.set(key, value); },
    },
  });
}
const untouched = (world: World, why: string) => {
  assert.deepEqual(world.writes, [], `${why}: nothing may be written to storage`);
  assert.deepEqual(world.stateSets, [], `${why}: no state may be set`);
  assert.deepEqual(world.reads, [], `${why}: another context's record is not even read`);
};

test('an ordinary hide writes to this account\'s record and keeps the account\'s other entries', () => {
  const world = newWorld();
  world.store.set('HIDDEN::uid:A', JSON.stringify({ 'site:other-farm-of-A': 'sig-kept' }));
  renderedHide(world, 'site:A', 'summer|a1:cabbage:1:2.3')();
  assert.deepEqual(world.writes, [['HIDDEN::uid:A', JSON.stringify({ 'site:other-farm-of-A': 'sig-kept', 'site:A': 'summer|a1:cabbage:1:2.3' })]]);
  assert.deepEqual(world.stateSets, [{ storageKey: 'HIDDEN::uid:A', byScope: { 'site:other-farm-of-A': 'sig-kept', 'site:A': 'summer|a1:cabbage:1:2.3' } }]);
});

test('a handler kept from account A\'s render writes nothing after the account changes to B, and B\'s record survives', () => {
  const world = newWorld();
  const staleHide = renderedHide(world, 'site:A', 'summer|a1:cabbage:1:2.3');
  // Account B signs in and the page renders for B: storage owner, Firebase and the live context all move.
  world.mountedUid = 'B'; world.firebaseUid = 'B';
  world.context.current = { siteId: 'site:B', owner: 'B', sample: false, scopeKey: 'scope:B' };
  const recordOfB = JSON.stringify({ 'site:B': 'sig-of-B' });
  world.store.set('HIDDEN::uid:B', recordOfB);
  staleHide();
  untouched(world, 'account changed');
  assert.equal(world.store.get('HIDDEN::uid:B'), recordOfB, 'the newer account\'s record is exactly as it was');
  assert.equal(world.store.has('HIDDEN::uid:A'), false);
  // B's own, current handler still works, and does not carry anything of A's.
  renderedHide(world, 'site:B', 'winter|b1:peas:2:4.5')();
  assert.deepEqual(JSON.parse(world.store.get('HIDDEN::uid:B')!), { 'site:B': 'winter|b1:peas:2:4.5' });
});

test('the gap where the browser\'s signed-in user has changed but the mounted owner has not is refused', () => {
  const world = newWorld();
  const hide = renderedHide(world, 'site:A', 'sig');
  world.firebaseUid = 'B'; // Firebase has moved to B; the page still believes A, so the key is still A's
  hide();
  untouched(world, 'Firebase-versus-mounted-owner gap');
  world.firebaseUid = null; // or signed out underneath the page
  hide();
  untouched(world, 'signed out underneath the page');
});

test('leaving or entering sample mode retires the handler', () => {
  const sampling = newWorld({ mountedUid: null, firebaseUid: null, sample: true, context: { current: { siteId: 'site:sample', owner: null, sample: true, scopeKey: 'scope:sample' } } });
  const hideInSample = renderedHide(sampling, 'site:sample', 'sig');
  sampling.sample = false; sampling.context.current = { siteId: 'site:real', owner: null, sample: false, scopeKey: 'scope:real' };
  hideInSample();
  untouched(sampling, 'sample mode ended');

  const real = newWorld();
  const hideReal = renderedHide(real, 'site:A', 'sig');
  real.sample = true; real.context.current = { siteId: 'site:sample', owner: null, sample: true, scopeKey: 'scope:sample' };
  hideReal();
  untouched(real, 'sample mode began');
});

test('a change of site or planning scope under the same account retires the handler', () => {
  const moved = newWorld();
  const hideOld = renderedHide(moved, 'site:A', 'sig');
  moved.context.current = { siteId: 'site:A2', owner: 'A', sample: false, scopeKey: 'scope:A2' }; // the grower opened another of their farms
  hideOld();
  untouched(moved, 'site context changed');

  const rescoped = newWorld();
  const hide = renderedHide(rescoped, 'site:A', 'sig');
  rescoped.context.current = { ...rescoped.context.current, scopeKey: 'scope:A-other' };
  hide();
  untouched(rescoped, 'planning scope key changed');

  const closed = newWorld();
  const hideClosed = renderedHide(closed, 'site:A', 'sig');
  closed.planningScopeAllowed = false; // the country confirmation this page was opened under no longer holds
  hideClosed();
  untouched(closed, 'catalogue planning no longer allowed');
});

test('the admission is asked before anything is written, and the key of the render is the only destination', () => {
  const handler = page.slice(page.indexOf('  function hideCalendarNotice() {'), page.indexOf('\n  }\n', page.indexOf('  function hideCalendarNotice() {')));
  assert.match(handler, /const actorIsCurrent = growerActorIsCurrent\(\) && currentPlanningScopeAllowed\(\);/);
  assert.match(handler, /renderedStorageKey: hiddenNoticeStorageKey, currentStorageKey, actorIsCurrent,/);
  assert.ok(handler.indexOf('if (!write) return;') < handler.indexOf('setHiddenCalendarNotice('), 'refusal comes before the state write');
  assert.ok(handler.indexOf('if (!write) return;') < handler.indexOf('localStorage.setItem('), 'refusal comes before the storage write');
  assert.match(handler, /localStorage\.setItem\(write\.storageKey, JSON\.stringify\(write\.byScope\)\)/);
  // Even if the page's admission were wrong, a key that is not this render's is refused by the rule itself.
  assert.equal(hiddenCalendarNoticeWrite({ renderedStorageKey: 'HIDDEN::uid:A', currentStorageKey: 'HIDDEN::uid:B', actorIsCurrent: true, scope: 'site:A', signature: 'sig', storedRaw: null }), null);
  assert.equal(hiddenCalendarNoticeWrite({ renderedStorageKey: 'HIDDEN::uid:A', currentStorageKey: 'HIDDEN::uid:A', actorIsCurrent: false, scope: 'site:A', signature: 'sig', storedRaw: null }), null);
  assert.equal(hiddenCalendarNoticeWrite({ renderedStorageKey: '', currentStorageKey: '', actorIsCurrent: true, scope: 'site:A', signature: 'sig', storedRaw: null }), null);
  assert.deepEqual(hiddenCalendarNoticeWrite({ renderedStorageKey: 'K', currentStorageKey: 'K', actorIsCurrent: true, scope: 'site:A', signature: 'sig', storedRaw: '{damaged' }),
    { storageKey: 'K', byScope: { 'site:A': 'sig' } }, 'a damaged record is replaced by the one entry, never crashes the tap');
});

test('choosing a calendar asks the same admission, so a retained handler cannot put its site into another plan', () => {
  const choose = page.slice(page.indexOf('  function chooseSowingCalendar('), page.indexOf('\n  }\n', page.indexOf('  function chooseSowingCalendar(')));
  assert.match(choose, /if \(!calendarScopeId \|\| !currentPlanningScopeAllowed\(\) \|\| !growerActorIsCurrent\(\)\) return;/);
  assert.ok(choose.indexOf('growerActorIsCurrent()') < choose.indexOf('setPlan('), 'the check comes before the plan is touched');

  // The real function, run through the same account switch as the hide handler above.
  const world = newWorld();
  const mine = { ...world.context.current };
  const plannerActorIsCurrent = build(pageFunction('plannerActorIsCurrent'), 'plannerActorIsCurrent', {
    activeAccountUid: () => (world.sample ? null : world.mountedUid), isSampleMode: () => world.sample,
    isBackendConfigured: () => world.backend, getFirebase: () => ({ auth: { currentUser: world.firebaseUid ? { uid: world.firebaseUid } : null } }),
  });
  const growerActorIsCurrent = build(pageFunction('growerActorIsCurrent'), 'growerActorIsCurrent', {
    growerBookContext: world.context, growerOwner: mine.owner, growerSample: mine.sample,
    productionSiteId: mine.siteId, growerScopeKey: mine.scopeKey, plannerActorIsCurrent,
  });
  const planUpdates: unknown[] = [];
  const chooseForSiteA = build(pageFunction('chooseSowingCalendar'), 'chooseSowingCalendar', {
    calendarScopeId: 'site:A', currentPlanningScopeAllowed: () => world.planningScopeAllowed, growerActorIsCurrent,
    setPlan: (update: unknown) => { planUpdates.push(update); }, withSowingCalendarChoice: () => ({}),
  }) as unknown as (calendar: string | null) => void;
  chooseForSiteA('all-year');
  assert.equal(planUpdates.length, 1, 'an ordinary choice reaches the plan');
  world.mountedUid = 'B'; world.firebaseUid = 'B';
  world.context.current = { siteId: 'site:B', owner: 'B', sample: false, scopeKey: 'scope:B' };
  chooseForSiteA('summer');
  assert.equal(planUpdates.length, 1, 'account A\'s handler must not touch the plan on screen after the account changed to B');
});

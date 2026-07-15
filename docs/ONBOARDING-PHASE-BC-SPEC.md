# ImbewuField — Phase B + C build spec (onboarding, guided mode, demo, voice)

*Fable 5 design pass, 2026-07-16. Companion to `docs/ONBOARDING-PLAN.md` (Phase A shipped:
stage-gated report, per-site cards, save hero, header collapse — `components/DataPanel.tsx`,
`lib/completion-score.ts`). This doc is the buildable spec for Phase B (B7/B8/B9) and the
buildable parts of Phase C (C10/C12). C11 is a recommended DEFER (see §C11); C13 is
Rory-only infra (see §C13).*

**Hard constraints (design/DESIGN.md):** no emoji in UI — Lucide only; Newsreader +
Public Sans; palette Forest `#1F4D2B` / Ochre `#C07A1E` / Water `#235E86` / Paper `#F7F2E9`
/ Card `#FBF6EC` / Ink `#20190F` / Gold `#F7C97E`; Lima advises, never takes control;
≥44px touch targets; colour never the only signal; task-first home.
**Evidence constraints:** no tooltip tours; ONE persistent next-step card; do-one-thing-first;
auto-graduate; icon+text pairing; personalise via the stored POPIA goal.

---

## 0. Foundation — `lib/site-progress.ts` (shared progress helper) — build FIRST

DataPanel currently assembles `CompletionScoreInputs` inside a `useMemo`
(components/DataPanel.tsx:339-393). The coach, the home Continue card, and DataPanel must
all see the SAME per-site inputs or cross-site bleed returns. Lift the gathering into a
pure helper + a subscription hook.

### New file `lib/site-progress.ts`

```ts
'use client';
import { useEffect, useState, useMemo } from 'react';
import { loadPlaces } from '@/lib/saved-places';
import { loadSurvey, type SiteSurvey } from '@/lib/site-survey';
import { loadCanvasState } from '@/lib/design-canvas';
import { loadCropPlan } from '@/lib/crop-plan';
import { readLocalFarmShapes } from '@/lib/map-sync';
import { designSiteIdFromLocation } from '@/lib/design-studio';
import {
  computeCompletionScore, deriveSiteStage,
  type CompletionScoreInputs, type CompletionScoreResult, type SiteStage, type CompletionStepKey,
} from '@/lib/completion-score';
import type { LocationData } from '@/lib/types';

export interface Coords { lat: number; lon: number }

export const SURVEY_TOTAL_FIELDS = 10;

/** The 10 survey-completeness checks — lifted VERBATIM from DataPanel.tsx:342-353. */
export function surveyFilledCount(s: SiteSurvey | null): number;

/** Saved place within ~55 m (±0.0005°) of coords — lifted from DataPanel.tsx:378-379. */
export function savedPlaceAtCoords(c: Coords): boolean;

/** Non-water polygon whose first vertex is within ~2 km (±0.02°) of coords —
 *  lifted VERBATIM from DataPanel.tsx:358-372 (incl. the featureType==='water' skip
 *  and Polygon/MultiPolygon ring handling). */
export function boundaryNearCoords(c: Coords): boolean;

/** Pure synchronous gather — every read is localStorage. `assumeSaved` covers the
 *  instant after a Save tap, before loadPlaces() is re-read (DataPanel's placeSaved). */
export function gatherSiteInputs(c: Coords, opts?: { assumeSaved?: boolean }): CompletionScoreInputs;

export interface SiteProgress {
  inputs: CompletionScoreInputs;
  score: CompletionScoreResult;   // computeCompletionScore(inputs)
  stage: SiteStage;               // deriveSiteStage(inputs)
  pct: number;                    // score.overallPct
  /** First step in score.steps with !done, else null (all complete).
   *  NOTE: keyed off the STEP list, not the stage — a farmer can survey before
   *  tracing; the next action must be the first genuinely-missing step. */
  nextStep: CompletionStepKey | null;
}
export function getSiteProgress(c: Coords, opts?: { assumeSaved?: boolean }): SiteProgress;

/** Hook: recompute on mount + whenever any underlying store changes.
 *  Subscribes to: 'permamap-places-changed', 'imbewu-surveys-changed',
 *  'imbewu-design-canvas-changed' (DESIGN_CANVAS_CHANGED_EVENT, lib/design-canvas.ts:332),
 *  'imbewu-map-state-changed' (MAP_STATE_EVENT, lib/map-sync.ts:11).
 *  Returns null until mounted (hydration-safe) or when coords is null. */
export function useSiteProgress(c: Coords | null): SiteProgress | null;
```

Implementation notes (all logic already exists — this is a LIFT, not a rewrite):
- `gatherSiteInputs` body = DataPanel.tsx:339-392 verbatim, with
  `surveySiteId = designSiteIdFromLocation({ lat, lon } as LocationData)` derived from the
  passed coords (same as DataPanel.tsx:302), `hasCropPlan` keeping the
  `(zoneCount>0||elementCount>0) && loadCropPlan().plantings.length>0` guard.
- `useSiteProgress` guards `typeof window === 'undefined'` and computes only in
  `useEffect` (first client render returns null → no SSR/first-paint divergence).

### Edit `components/DataPanel.tsx` (mechanical refactor)

Replace the BODY of the `completionInputs` useMemo (lines 339-393) with:
```ts
const completionInputs: CompletionScoreInputs = useMemo(() => {
  if (!coords) return gatherSiteInputs({ lat: 0, lon: 0 }); // all-zero inputs
  return gatherSiteInputs(coords, { assumeSaved: placeSaved });
}, [surveySiteId, survey, siteData, coords?.lat, coords?.lon, placeSaved, tab]);
```
Keep the existing deps EXACTLY (survey/siteData/tab are change-signals). Delete the now-dead
inline `surveyChecks`/`boundaryNearSite`/`savedHere` code. `siteMetrics` (lines 399-456)
stays in DataPanel — it is display data, not progress data.

**Acceptance (increment 1):** `npm run build` green; on a fresh pin the score is 0% and
save-hero shows; on a saved+traced site the same % renders as before the refactor
(spot-check one real site before/after). No visual change anywhere.

---

## B9 — `NextStepCoach` (single persistent next-step card)

### New file `components/NextStepCoach.tsx`

```ts
'use client';
export interface NextStepCoachProps {
  /** The already-gathered inputs DataPanel owns — the coach must NOT re-gather
   *  (single source of truth; avoids double localStorage reads per render). */
  inputs: CompletionScoreInputs;
  coords: { lat: number; lon: number };
  /** Opens the site-survey sheet (DataPanel passes () => setSurveySheetOpen(true)). */
  onOpenSurvey: () => void;
  /** Optional — home ContinueCard renders the coach in "line" mode (no card chrome,
   *  title + CTA only). Default 'card'. */
  variant?: 'card' | 'line';
}
export default function NextStepCoach(props: NextStepCoachProps): JSX.Element | null;
```

### Guided-mode state — versioned key `imbewu_guided_mode_v1`

```ts
// stored as JSON in localStorage under 'imbewu_guided_mode_v1'
interface GuidedModeState {
  enabled: boolean;     // Settings "Guide me" toggle. Default true.
  dismissals: number;   // coach X-taps, cumulative
  retired: boolean;     // auto-graduation happened (all steps done, or 3 dismissals)
}
```
Accessors live in `lib/site-progress.ts` (same file — it's the guided-experience lib):
`getGuidedState(): GuidedModeState` (returns defaults on missing/corrupt JSON),
`setGuidedState(patch: Partial<GuidedModeState>)` (merge + write + dispatch
`new CustomEvent('imbewu-guided-changed')`). NEVER trust a cached client: any unknown
shape → defaults (PWA-staleness rule).

### Render rules

Coach renders `null` unless ALL of:
1. mounted (client) — internal `useState(false)` + effect flips true; SSR paints nothing;
2. `getGuidedState().enabled && !retired`;
3. `inputs.hasSite` — at `scout` stage the existing Save-this-site hero (DataPanel:733-749)
   IS the next step; the coach must not duplicate it;
4. there is a next step, OR all steps are done and the celebrate card hasn't been shown.

Next action = `getSiteProgress` logic run on the passed `inputs`
(`computeCompletionScore(inputs).steps` → first `!done`). Step → action table:

| stepKey | Title key | Body key | CTA key | CTA action |
|---|---|---|---|---|
| `located` | — | — | — | never reached (rule 3) |
| `boundary` | `coachStepBoundaryTitle` | `coachStepBoundaryBody` | `coachStepBoundaryCta` | `window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: 'site' }))` |
| `survey` | `coachStepSurveyTitle` | `coachStepSurveyBody` | `coachStepSurveyCta` | `props.onOpenSurvey()` |
| `design` | `coachStepDesignTitle` | `coachStepDesignBody` | `coachStepDesignCta` | `router.push('/design?lat=' + coords.lat.toFixed(5) + '&lon=' + coords.lon.toFixed(5))` (same pattern as app/farmer/page.tsx:316) |
| `cropPlan` | `coachStepCropTitle` | `coachStepCropBody` | `coachStepCropCta` | `router.push('/facilitator/crops')` (the planner — same target as the home quick-action) |
| all done | `coachDoneTitle` | `coachDoneBody` | `coachDoneCta` | sets `retired: true` (auto-graduation; card shows exactly once) |

The `imbewu-arm-draw` event is handled by Map.tsx (see B8 §Map edits) — it calls the
existing `startPinDraw('site')` (Map.tsx:882). Arming the draw already collapses the
bottom sheet (farmer page's `drawing` effect, app/farmer/page.tsx:224), so the coach's
one tap lands the farmer straight in trace mode with the reticle up. No new draw logic.

### Personalisation (the unused POPIA goal)

Read `localStorage['imbewu_popia']` → `PopiaRecord.goal` (`'feed'|'income'|'soil'`,
components/PopiaConsent.tsx:7-17; parse defensively, absent → no line). For steps
`survey|design|cropPlan` append ONE goal line under the body:
`coachGoalFeed` / `coachGoalIncome` / `coachGoalSoil`. Style: 12px Public Sans,
`#8C7A62`, prefixed with a 14px Lucide icon matching PopiaConsent's GOAL_DEFS
(`Utensils`/`TrendingUp`/`Recycle`).

### Dismissal + auto-graduation

- Top-right X (Lucide `X`, ≥44×44px hit area, `aria-label={t('coachDismiss')}`):
  `setGuidedState({ dismissals: n+1, retired: n+1 >= 3 })`. Dismissing hides the card for
  the session (`useState`) — it returns next mount unless retired.
- Auto-retire: when all 5 steps done, the celebrate card's CTA sets `retired: true`.
- The Settings toggle (below) is the only resurrection path — per the evidence,
  auto-graduation is primary; the toggle is the power-user override.

### Settings toggle — edit `components/ThemePanel.tsx`

ThemePanel is the settings sheet on BOTH /home and /farmer (gear button). Add a "Lima"
section under the text-size rows: one row, Lucide `Footprints` icon + `t('settingsGuideMe')`
label + `t('settingsGuideMeDesc')` sub-line + a pill toggle (copy the 34×20 `Toggle` from
components/PopiaConsent.tsx:27-62 — extract it to `components/ui/PillToggle.tsx` if the
builder prefers, or inline it). ON = `setGuidedState({ enabled: true, retired: false,
dismissals: 0 })` (full reset — "guide me again"); OFF = `setGuidedState({ enabled: false })`.
Row state derives from `getGuidedState()` read in an effect (hydration-safe) and refreshes
on `'imbewu-guided-changed'`.

### Card visual (Lima voice)

Card `#FBF6EC`, 1px `#E2D8C4` border, radius 16, left accent bar 3px Ochre `#C07A1E`.
Header row: 32px Forest-bg rounded icon (Lucide `Footprints`, Gold `#F7C97E` stroke) +
overline `t('coachOverline')` (11px caps, Ochre) + X. Title: Newsreader 600 16px Ink.
Body: Public Sans 13px `#5C5040`, max 2 lines. CTA: full-width 44px+ Forest button,
15px Public Sans 600, icon+text (never icon-only). One card, one action — no step list
(the CompletionScore checklist directly above already shows the journey).

Lima tone (all copy in §Copy): short sentences; second person; Lima offers, never
commands — "Lima measures it for you", never "You must trace now".

### Mount point — edit `components/DataPanel.tsx`

Overview tab, directly AFTER `{isSaved && <CompletionScore inputs={completionInputs} />}`
(line 752) and before the WeatherWidget line:
```tsx
{isSaved && coords && (
  <NextStepCoach inputs={completionInputs} coords={coords}
    onOpenSurvey={() => setSurveySheetOpen(true)} />
)}
```
The checklist says where you are; the coach card under it says the ONE thing to do next.
(Home mirror = the ContinueCard's next-step line, §B7 — not a second full card.)

**Acceptance (increment 2):**
- Fresh pin → save → coach appears showing "Walk your boundary"; tap "Trace now" → draw
  reticle armed, sheet collapsed. Finish a 3-corner polygon → coach flips to the survey step.
- Fill survey → coach shows Design step, deep-links to `/design?lat=…&lon=…`.
- Dismiss 3× (across reloads) → coach gone; Settings → Guide me ON → coach back with
  dismissals reset.
- Complete all 5 steps → celebrate card once → gone on next visit.
- POPIA goal `feed` → survey/design/crop steps show the feed line.
- With `localStorage.imbewu_guided_mode_v1 = '{"bogus":1}'` → defaults apply, no crash.

---

## B7 — Home welcome (new user) + Continue card (returner)

### New file `components/home/HomeHeroCard.tsx`

Replaces the "Analyse a site" CTA `<Link>` block in app/home/page.tsx:290-327 (the big
green card). Everything else on home (header, LastSiteCard, MainSiteWeatherCard,
quick-actions, TaskBoard, Dashboards disclosure) stays byte-identical.

```ts
export interface HomeHeroCardProps {
  /** null until the places effect has run — render the DEFAULT variant (today's
   *  analyse-CTA) so first paint is unchanged and returning users never see a
   *  welcome flash. */
  places: SavedPlace[] | null;
  mainSite: SavedPlace | null;          // resolveMainSite(places) — parent already computes it
  firstName: string | null;             // user?.displayName?.split(' ')[0] — parent has it
}
```

Three variants, same green card shell (keep the exact `background`/`backgroundImage`/
`borderRadius: 20`/`boxShadow` styles from lines 292-303 so the card never jumps):

**1. DEFAULT (`places === null`, i.e. pre-hydration):** exactly today's content —
overline `t('homeLimaSuggests')`, H2 `t('homeSurveyNew')`, body `t('homeSurveyDesc')`,
pill `t('homeOpenMap')` → `/farmer`. (This is also the SSR paint — zero hydration
mismatch because it IS the current markup.)

**2. WELCOME (`places.length === 0`):**
- Greeting line (Newsreader 700, 26px phone): `firstName ? t('homeGreeting').replace('{name}', firstName) : t('welcomeTitle')` — reuses the existing 11-language keys; no new
  greeting strings.
- H2: `t('welcomeHeroTitle')`; body: `t('welcomeHeroSub')`.
- PRIMARY (huge — full-width 52px min-height button-style Link, Paper-on-Forest inverse
  pill like today's CTA but full width, Lucide `MapPin` + text):
  `t('welcomeFindLand')` → **`/farmer?guided=1`**.
- SECONDARY (quiet text link under it, 14px, `rgba(234,243,226,0.78)`, Lucide `Eye` +
  text): `t('welcomeShowExample')` → **`/example`** (C10). Two choices max — nothing else.

**3. CONTINUE (`places.length > 0`):**
- Overline `t('homeLimaSuggests')`; H2: `t('continueSiteTitle').replace('{site}', mainSite.name)`.
- Progress line: donut-free, text + thin bar — `t('continueSitePct').replace('{pct}', String(pct))`
  where `pct` comes from `useSiteProgress({lat: mainSite.lat, lon: mainSite.lon})` (null-safe:
  while null, omit the line). Bar: 4px, Gold on `rgba(234,243,226,0.25)`, width = pct% —
  plus the numeric % so colour/length is never the only signal.
- Next-step line (the home "mirror" of the coach — one line, not a card):
  `t('coachOverline')`: {title of nextStep from the B9 table}, only when
  `getGuidedState().enabled && !retired` and `nextStep !== null`.
- PRIMARY pill: `t('continueSiteCta')` → **`/farmer?site={mainSite.id}`**.
- SECONDARY (quiet link): `t('startNewSite')` → **`/farmer?guided=1&new=1`**.

### Edit `app/home/page.tsx`

- `const [places, setPlaces] = useState<SavedPlace[] | null>(null);` (was `[]`) — the
  existing effect (line 203-214) sets the real array; `resolveMainSite(places ?? [])`.
  `MainSiteWeatherCard` render guard becomes `{places && mainSite && …}` (unchanged
  behaviour — it never rendered pre-hydration anyway since places was `[]`).
- Replace lines 290-327 with `<HomeHeroCard places={places} mainSite={mainSite} firstName={firstName} />`.
- Do NOT touch `Onboarding`/`PopiaConsent` mounting (lines 437-438). The welcome is page
  content UNDER the z-100/z-110 modals — first-run order stays: language modal → POPIA
  (polls for the language flag) → the welcome card is what they land on. Never a third modal.

### Edit `app/farmer/page.tsx` — `?site=<placeId>` deep link

In the existing searchParams effect (or a sibling one-shot effect):
```ts
const siteId = searchParams.get('site');
// one-shot: consume once (useRef guard), find place, drive the report + map
const p = loadPlaces().find(pl => pl.id === siteId);
if (p) {
  handlePlaceSelect({ name: p.name, id: p.id });
  handleLocationSelect(p.lat, p.lon);            // report loads regardless of map state
  setTimeout(() => setJumpTo({ lat: p.lat, lon: p.lon }), 800); // cosmetic flight after
                                                  // the dynamic Map has mounted
}
```
The 800ms delay exists because `PermaMap` is `dynamic(..., { ssr: false })` and Map's
jumpTo effect no-ops via optional chaining if the ref isn't set (Map.tsx:1485-1488).
The report is correct either way; the flight is cosmetic. (Builder MAY instead thread an
`onMapReady` callback from Map and fire the jump there — cleaner; do it only if trivial.)
Unknown/missing id → ignore silently. Do NOT auto-open the bottom sheet (`sheetOpen`
stays driven by panel/chat params) — the farmer sees the map fly, then taps Results, OR
builder may open the sheet after `data` arrives; pick ONE and note it. Recommended:
`setSheetOpen(true)` once data loads, so "Continue" lands ON the report (that's the promise
of the button).

**Acceptance (increment 3):**
- Cleared storage + first run: language modal → POPIA → home shows WELCOME variant
  (greeting in the picked language via existing keys); exactly two actions visible in the
  hero. No third modal. No flash of the welcome for a returning profile (places non-empty).
- Returner: CONTINUE variant with main-site name + live % (matches the % on the site's
  report) + next-step line; "Continue" lands on /farmer with that site's report open;
  "Start a new site" lands on /farmer in guided mode.
- SSR check: `curl localhost:4242/home | grep homeSurveyNew`-equivalent — the server
  HTML contains the DEFAULT variant, and no hydration warning in the console.

---

## B8 — Guided pin mode on /farmer

### Trigger

`guided = searchParams.get('guided') === '1' || (mounted && loadPlaces().length === 0)`
— computed in app/farmer/page.tsx (client effect for the places check; default false so
SSR/first paint has no bar) and passed to `<PermaMap guided={guided && !selected} …/>`.
A novice who lands on /farmer directly (no query param) still gets it; the param forces it
for "Start a new site" returners. It retires reactively: `!selected` means the instant a
pin exists (search hit, GPS, or map tap all call `onLocationSelect` → `setSelected`), the
bar disappears; and once a first place is saved the derived branch goes false forever.
`&new=1` needs no extra handling — guided=1 does the work; the param just documents intent.

### Edits to `components/Map.tsx` (small, additive — NO draw/map-logic changes)

1. **Prop:** `guided?: boolean` added to `Props` (Map.tsx:219-247).
2. **GuidedBar** (new JSX block next to the toolbarMin button, Map.tsx:2509): rendered when
   `guided && !pinDraw && !editPin && !activeDraw`. When guided, do NOT render the
   toolbarMin "Find your land" pill (the bar replaces it; both occupy top-left).
   - Full-width instruction bar, `position: absolute; top: 12px; left: 12px; right: 12px;
     zIndex: 10`, same glass style as the toolbarMin pill (`rgba(22,30,18,0.86)`, blur,
     radius 14), padding 12px 14px.
   - Row 1: 26px Forest square with `Sprout` (Lima's mark, matches toolbarMin) +
     `t('guidedBarSearch')` — Public Sans 600, 14.5px, `#F7F2E9`, up to 2 lines.
   - Row 2 (two ≥44px buttons, icon+text):
     `Search` icon + `t('searchPlaceholder')` → `setToolbarMin(false)` then
     `requestAnimationFrame(() => document.querySelector<HTMLInputElement>('.map-search-input')?.focus())`
     (the class exists, Map.tsx:2631). Call `setToolbarMin(false)` DIRECTLY — not
     `openPanel()` — so the 6-item Lima tips modal does NOT auto-fire mid-guided-flow
     (openPanel's auto-guide, Map.tsx:480-483, stays for the normal path).
     `LocateFixed` icon + `t('guidedBarLocate')` → existing `goToMyLocation` (Map.tsx:1413).
   - No dismiss X needed — it self-retires on pin drop (parent passes `guided && !selected`).
3. **Event listener** (for the B9 coach):
   ```ts
   useEffect(() => {
     const arm = (e: Event) => startPinDraw((e as CustomEvent).detail === 'water' ? 'water' : 'site');
     window.addEventListener('imbewu-arm-draw', arm);
     return () => window.removeEventListener('imbewu-arm-draw', arm);
   }, [startPinDraw]);
   ```

**Acceptance (increment 4):**
- `/farmer?guided=1`: bar visible over the map; "Search" opens the tools panel with the
  search input focused and NO tips modal; typing a town + choosing a suggestion drops the
  pin and the bar disappears; the scouting report (scout stage, save hero) slides up.
- GPS button asks for location and pins it (existing behaviour).
- Fresh profile hitting `/farmer` directly (no param) also sees the bar; a profile with
  saved places and no param does NOT.
- Regression: normal (non-guided) load still shows the "Find your land" toolbarMin pill;
  first-time panel-open still shows the tips modal; drawing/edit modes hide the bar.

---

## C10 — Demo/example site (`/example`)

**Approach: pre-baked ReportView, zero storage writes.** ReportView is already fully
prop-driven (locationData/siteData/waterData/savedPlaces/mapCapture/appLang/onClose —
see the call in app/farmer/page.tsx:262-274), so the demo renders the REAL finished
report with fixture props and never touches the farmer's localStorage. (A map-overlay
demo — fake pins/polygons on /farmer — would require namespacing every store the map
reads; deliberately out of scope. Note it as a possible C-later.)

### New file `lib/demo-site.ts`

```ts
import type { LocationData, SiteData, WaterData } from '@/lib/types';

/** Ezakheni, KwaZulu-Natal — Grassland biome, summer rainfall; matches the sample
 *  farm story already in lib/demo-data.ts ("Ezakheni Community Garden"). */
export const DEMO_COORDS = { lat: -28.628, lon: 29.891 } as const;

export const DEMO_LOCATION: LocationData = /* captured fixture — see build step */;
export const DEMO_SITE_DATA: SiteData = {
  areaM2: 4500, areaHa: 0.45, perimeterM: 280, perimeterKm: 0.28, count: 1,
  features: [{ name: 'Home field', category: 'Field', areaHa: 0.45 }],
};
export const DEMO_WATER_DATA: WaterData = {
  count: 1, areaM2: 120, estVolumeKL: 180, avgDepthM: 1.5,
  features: [{ name: 'Roof + tank', category: 'Roof catchment', estVolumeKL: 180 }],
};
```
**Build step for the fixture:** run the dev server and capture the real API response once —
`curl 'http://localhost:4242/api/location-data?lat=-28.628&lon=29.891'` — paste the JSON as
`DEMO_LOCATION` (typed `LocationData`). This keeps every stat (biome, BRU, rainfall, soil)
real and internally consistent. If the shape gains fields later it's just a re-capture.

### New file `app/example/page.tsx`

Client page, wrapped in `LanguageProvider` (same as app/farmer/page.tsx:36):
- Renders `<ReportView locationData={DEMO_LOCATION} siteData={DEMO_SITE_DATA}
  waterData={DEMO_WATER_DATA} savedPlaces={[]} mapCapture={null} appLang={lang}
  onClose={() => router.push('/home')} />`.
- Overlaid banner (fixed top, above the report, z higher than ReportView's header):
  Ochre `#C07A1E` strip, `Eye` icon + `t('demoBannerLabel')` (Public Sans 700 13px,
  white) + `t('demoBannerBody')` (12px, `rgba(255,255,255,0.85)`) + right-aligned
  `t('demoExit')` button (white pill, Forest text, ≥44px) → `/home`.
- NO auth guard, NO localStorage writes, NO savePlace/last-site calls. Verify
  `setLastSite` is not triggered (it lives in farmer page, not ReportView — confirm
  ReportView itself has no storage writes; if it saves reports on open, gate that with a
  `readOnly` prop — builder must check `components/ReportView.tsx` for writes before
  shipping and add `readOnly?: boolean` only if needed).
- Entry: the WELCOME hero's secondary link (§B7). Also fine to reach directly by URL.

**Acceptance (increment 5):**
- From the first-run welcome, "Show me an example" opens a full finished report (all
  sections incl. land/water numbers) with the Example banner always visible; "Leave the
  example" returns home; afterwards `localStorage` diff is EMPTY (assert:
  snapshot `JSON.stringify(localStorage)` before/after in devtools).
- Works signed out and offline-ish (no map, one prefetched API-shaped fixture).

---

## C12 — Lima voice guidance (Web Speech API, progressive enhancement)

### New file `lib/tts.ts`

```ts
'use client';

/** app-lang → BCP-47 the device voice list might use. Mirrors LANG_TO_LOCALE
 *  (app/home/page.tsx:42-54) — keep the two in sync. */
export const LANG_TO_BCP47: Record<string, string> = {
  en: 'en-ZA', af: 'af-ZA', zu: 'zu-ZA', xh: 'xh-ZA', st: 'st-ZA', nso: 'nso-ZA',
  tn: 'tn-ZA', ts: 'ts-ZA', ve: 've-ZA', ss: 'ss-ZA', nr: 'nr-ZA',
};

export function isTtsSupported(): boolean;           // 'speechSynthesis' in window
export function getTtsMuted(): boolean;              // localStorage 'imbewu_tts_muted_v1' === '1'
export function setTtsMuted(muted: boolean): void;   // + dispatch 'imbewu-tts-changed'

/** Find a device voice for the app language. Match order:
 *  exact BCP-47 ('zu-ZA') → prefix ('zu') → null. */
export function findVoice(appLang: string): SpeechSynthesisVoice | null;

/** Speak text in the app language. Returns 'spoken' | 'fallback' | 'unavailable'.
 *  - No support, or muted → 'unavailable' (silent no-op).
 *  - Native voice found → speak `text` with it → 'spoken'.
 *  - No native voice → speak `englishText` (the T.en source string the caller passes)
 *    with an 'en' voice → 'fallback'. NEVER read non-English text with an English
 *    voice — that produces garbage pronunciation.
 *  - Cancels any in-flight utterance first (one voice at a time; rate 0.95).
 *  - Voices load async on some Androids: if getVoices() is empty, retry once on
 *    the 'voiceschanged' event, else resolve 'unavailable'. */
export function speak(text: string, englishText: string, appLang: string): Promise<'spoken'|'fallback'|'unavailable'>;
export function stopSpeaking(): void;
```

**Honest limitation (record in the doc + code comment):** device voice coverage for SA
languages is poor — Android Google TTS commonly ships `af` and sometimes `zu`/`xh`;
`st/nso/tn/ts/ve/ss/nr` almost never. The fallback therefore speaks the ENGLISH copy.
Since new onboarding keys start as English-in-all-languages anyway (§Copy), the audio
matches the screen for those strings today, and upgrades automatically as translations
+ voices arrive. Zero cost, no API key, no network.

### Speaker buttons (progressive enhancement — render only if `isTtsSupported()`)

1. **NextStepCoach**: small round button next to the X (Lucide `Volume2`, 44px hit area,
   `aria-label={t('ttsSpeakLabel')}`) → `speak(title + '. ' + body, enTitle + '. ' + enBody, lang)`.
   The coach builds both strings via `t(key)` and `translate('en', key)` (lib/i18n.tsx:7966).
   While speaking, swap icon to `VolumeX` + `aria-label={t('ttsStopLabel')}` → `stopSpeaking()`.
2. **Report Lima read**: the same button on the DataPanel Overview "Lima read" paragraph
   (the `limaRead` string, DataPanel.tsx:600-607 — English-generated, so pass it as both
   args) and on the GuidedBar (B8) reading `t('guidedBarSearch')`.
3. **Mute pref**: one more row in ThemePanel's new Lima section — `Volume2` +
   `t('settingsVoiceLabel')`/`t('settingsVoiceDesc')` + pill toggle bound to
   `getTtsMuted()/setTtsMuted()`. Hidden entirely when `!isTtsSupported()`.

**Acceptance (increment 6):** on desktop Chrome (voices exist): coach speaker reads the
step aloud; toggling mute hides nothing but silences (button still visible, tap → no-op
returns 'unavailable' — builder choice: disable-style the button at 40% opacity when
muted); in a browser with `speechSynthesis` deleted, no buttons render and nothing
throws. Switching app language to isiZulu on a device with no zu voice speaks the English
string (not zu-text-in-English-voice).

---

## C11 — Facilitator-assisted onboarding: **DEFER (recommendation b)**

**Do not build in this phase.** Reasons:
1. It is undocumented in design/DESIGN.md and crosses a real product/legal line: POPIA
   consent (components/PopiaConsent.tsx) is the FARMER's personal consent — a facilitator
   tapping "I agree" for them is not consent. That needs a product decision, not a guess.
2. The cheap version already exists after B7/B8/C10 ship: a facilitator can hand the
   farmer their phone — language picker → POPIA → welcome → guided pin — or demonstrate
   with `/example`, all in the farmer's language, signed out (/home renders signed-out;
   auth only guards /farmer when Firebase is configured). The marginal value of a bespoke
   flow is low until real field friction is observed (C13's gogo test will surface it).
3. Every credible design touches auth + org data model (accounts created by proxy, site
   ownership transfer, Firestore rules that just survived a privilege-escalation audit) —
   high blast radius for a speculative flow.

**Questions Rory must answer before it gets designed:**
1. Whose account/data is it — created under the farmer's own identity (phone number?
   email they may not have?) or org-owned and later transferred?
2. Which device — the farmer's phone (handoff mode) or the facilitator's (multi-farm
   switching, offline sync-back)?
3. POPIA: is verbal consent recorded by the facilitator acceptable, and who is the
   responsible party of record?
4. Does the facilitator pre-fill (pin, boundary, survey) for the farmer to confirm, or
   sit beside them while THEY do it (training-wheels mode = just B8/B9 on the farmer's phone)?
5. Is this the same persona as the existing `mentor` role, or a new lighter "field agent"?

## C13 — Gogo field test / WhatsApp-USSD channel: **not buildable in-app**

Rory-only: recruit 1-3 elderly/low-literacy testers post-Phase-B; observe the
welcome → guided-pin → save → coach loop unaided. The WhatsApp/USSD-degradable entry
channel is separate infra (business API account, gateway provider, conversational flows)
— park it as its own future project; nothing in this repo blocks or prefigures it.

---

## Copy — i18n strategy + full new-key table

**Strategy:** `t()` falls back per-key to English automatically
(`T[lang]?.[key] ?? T.en[key] ?? key`, lib/i18n.tsx:8002). So new keys are added to
**`T.en` ONLY** — all 11 languages render the English string until a translation pass
adds them. Reused existing keys (`homeGreeting`, `welcomeTitle`, `homeLimaSuggests`,
`homeSurveyNew`, `homeSurveyDesc`, `homeOpenMap`, `searchPlaceholder`, `saveThisPlace`)
are already fully translated. **Do not duplicate English into the other 10 dicts** —
that would hide missing translations from a future grep.

New keys (add to `T.en`, lib/i18n.tsx — group under a `// Onboarding B/C` comment):

| Key | English |
|---|---|
| `welcomeHeroTitle` | `Let's find your land.` |
| `welcomeHeroSub` | `One tap — Lima reads your soil, rain and climate.` |
| `welcomeFindLand` | `Find my land` |
| `welcomeShowExample` | `Show me an example first` |
| `continueSiteTitle` | `Continue with {site}` |
| `continueSitePct` | `{pct}% complete` |
| `continueSiteCta` | `Open my site` |
| `startNewSite` | `Start a new site` |
| `guidedBarSearch` | `Search your town, or tap your home on the map.` |
| `guidedBarLocate` | `Use my location` |
| `coachOverline` | `Next step` |
| `coachStepBoundaryTitle` | `Walk your boundary` |
| `coachStepBoundaryBody` | `Tap each corner of your land. Lima measures it for you.` |
| `coachStepBoundaryCta` | `Trace now` |
| `coachStepSurveyTitle` | `Tell Lima about this land` |
| `coachStepSurveyBody` | `A few quick questions — water, soil, what grows here.` |
| `coachStepSurveyCta` | `Fill the survey` |
| `coachStepDesignTitle` | `Design your farm` |
| `coachStepDesignBody` | `Place beds, trees and water on your real land.` |
| `coachStepDesignCta` | `Open the Studio` |
| `coachStepCropTitle` | `Make your crop plan` |
| `coachStepCropBody` | `Choose crops and Lima builds your planting calendar.` |
| `coachStepCropCta` | `Plan crops` |
| `coachDoneTitle` | `Your site is fully planned` |
| `coachDoneBody` | `Lima will keep watch. Come back to log harvests and journal.` |
| `coachDoneCta` | `Done` |
| `coachDismiss` | `Hide this tip` |
| `coachGoalFeed` | `Your goal: feed the family — Lima favours year-round food crops.` |
| `coachGoalIncome` | `Your goal: earn income — Lima favours market crops.` |
| `coachGoalSoil` | `Your goal: restore the soil — Lima favours soil builders.` |
| `settingsGuideMe` | `Guide me` |
| `settingsGuideMeDesc` | `Show the next-step guide on your site report.` |
| `settingsVoiceLabel` | `Lima reads aloud` |
| `settingsVoiceDesc` | `Speak tips out loud when a voice is available.` |
| `demoBannerLabel` | `Example farm` |
| `demoBannerBody` | `This is what a finished site report looks like.` |
| `demoExit` | `Leave the example` |
| `ttsSpeakLabel` | `Read aloud` |
| `ttsStopLabel` | `Stop reading` |

(Translation follow-up: one later batch task translating the ~39 keys × 10 languages —
NOT part of this build.)

---

## Build order (increments = shippable commits; collision-aware)

| # | Ships | Files touched | Collides with |
|---|---|---|---|
| 1 | `lib/site-progress.ts` + DataPanel refactor + all i18n keys | **new** lib/site-progress.ts; edit components/DataPanel.tsx, lib/i18n.tsx | none — do first (everything depends on it) |
| 2 | B9 coach + Settings toggle | **new** components/NextStepCoach.tsx; edit components/DataPanel.tsx, components/ThemePanel.tsx | DataPanel (again) — sequence after 1, same lane |
| 3 | B7 home hero + `?site=` deep link | **new** components/home/HomeHeroCard.tsx; edit app/home/page.tsx, app/farmer/page.tsx | farmer/page.tsx also edited in 4 — keep 3 and 4 in ONE lane or sequence 3→4 |
| 4 | B8 guided pin + arm-draw listener | edit components/Map.tsx, app/farmer/page.tsx | farmer/page.tsx (see 3); Map.tsx untouched elsewhere |
| 5 | C10 demo | **new** lib/demo-site.ts, app/example/page.tsx; (HomeHeroCard link already points at /example from 3) | none |
| 6 | C12 TTS | **new** lib/tts.ts; edit components/NextStepCoach.tsx, components/ThemePanel.tsx, components/DataPanel.tsx (limaRead speaker), components/Map.tsx (GuidedBar speaker) | touches 2/3/4's files — do LAST |

Rule: increments 1→2 sequential (DataPanel), 3→4 sequential (farmer page), 5 parallel-safe
with 3/4, 6 strictly last. Each increment: build green (`npm run build`), verify its
acceptance list on dev (port 4242), commit, `/compact` between phases.

## Top risks (builder must respect)

1. **Hydration/first-paint.** Home hero's pre-hydration variant MUST be today's exact
   analyse-CTA markup (no mismatch, no welcome flash for returners). Coach, GuidedBar,
   speaker buttons, Continue-% are all mounted-only (`useState(false)` + effect). Never
   read localStorage during render on first paint.
2. **PWA staleness.** sw.js versions per deploy (app/sw.js/route.ts) but clients can run
   old JS for a session. All new flags are versioned (`imbewu_guided_mode_v1`,
   `imbewu_tts_muted_v1`) and parsed defensively (unknown shape → defaults). Never rename
   an existing key; never assume a flag's presence.
3. **Language/POPIA gate.** Welcome is page CONTENT under the stacked z-100/z-110 modals —
   adding any new modal/overlay on /home above z-100 is forbidden. Do not touch
   Onboarding.tsx / PopiaConsent.tsx logic; only READ `imbewu_popia` (defensively — it may
   be absent for pre-goal-picker users).
4. **Map surgery ban.** Map.tsx changes are exactly: one prop, one JSX bar, one event
   listener, one guarded toolbarMin render. No changes to draw logic, recompute, sync, or
   camera handling. The arm-draw listener calls the untouched `startPinDraw`.
5. **Cross-site bleed.** All progress everywhere flows through `gatherSiteInputs` (the
   ~55m save / ~2km boundary / surveySiteId conventions). Any new surface computing its
   own inputs is a bug.
6. **Demo purity.** `/example` writes nothing. Builder must grep ReportView for storage
   writes before shipping C10 and gate any found behind a `readOnly` prop.
7. **Farmer-page double edit.** Increments 3 and 4 both touch app/farmer/page.tsx — one
   lane or strict sequence, never parallel.

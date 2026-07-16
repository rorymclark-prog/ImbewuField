# ImbewuField — Discoverability & Simple-Path Plan

*Fable 5 design pass, 2026-07-16. Owner: Rory. Status: DESIGN — buildable spec for an Opus/Sonnet swarm.*

Four lanes: **(1)** shelve auto-draw zones to a quiet beta, **(2)** an obvious "+ Add"
entry point on both surfaces (the "where do I add a lawn?" fix), **(3)** a Simple Path
(beds + fruit trees → crop plan + shopping list), **(4)** per-step "Why this step?"
lessons with Lima narration.

**Binding constraints (design/DESIGN.md):** no emoji in UI (Lucide only — note: new UI
must comply even though the legacy element catalog `def.icon` fields are still emoji;
do NOT fix the catalog in these lanes), Newsreader + Public Sans, Forest `#1F4D2B` /
Ochre `#C07A1E` / Gold `#F7C97E`, Lima advises never controls, ≥44 px touch targets,
task-first, responsive font rules (§0). Model split: **farmer map (`/farmer`) = report
dashboard; Design Studio (`/design`) = the workshop where drawing happens.** These lanes
must not blur that split — the map never gains area-drawing tools; it hands off to the
Studio pre-armed.

**i18n convention used throughout:** new copy = new keys in `T.en` in `lib/i18n.tsx`
(en only; `translate()` already falls back to en for the other 10 languages). Every
Lima-narratable string follows the NextStepCoach pattern: `SpeakButton text={t(key)}
englishText={translate('en', key)}`. Each lane appends its keys inside its own
comment-marked block (`// ── Lane N: <name> ──`) at the END of `T.en` to keep merge
conflicts trivial.

---

## Ground truth (verified in code, 2026-07-16)

- `app/design/page.tsx` (1823 lines): gold `✨ Auto-design my farm` hero bar at lines
  ~1183–1212 (emoji — a standing DESIGN.md violation), `openAutoDesign` /
  `runAutoDesign` / `AutoDesignSheet` / running overlay; `handleSuggest` (l. 723) routes
  per step — base → vision detect, zones → `/api/suggest-zones-ai` with deterministic
  `suggestZones()` fallback, water/structures/planting → local generators; suggestions
  land as pending ghosts with an accept/reject card (l. 1315+); `chromeCollapsed` slim
  row with "More space" toggle (l. 1250+).
- `components/design/DesignWizard.tsx`: `STEP_ORDER = base water zones planting
  structures review glossy`; `STEP_GUIDANCE` one-liners; `SuggestButton` (guided = big
  gold hero, pro = compact pill); `SUGGEST_STEPS`/`SUGGEST_LABEL`.
- `components/design/DesignPalette.tsx`: chips are step-filtered
  (`categoriesForStep`); ground-feature chips (`GROUND_FEATURE_KINDS`: house patio lawn
  veg_garden orchard cleared) render **only on the base step** (`showAreaChips = step
  === 'base'`) — this is exactly why "add a lawn" is undiscoverable; zone chips only on
  zones step; line chips only on water/structures.
- `lib/design-canvas.ts`: `DesignCanvasState { siteId, frame, items, zones, lines,
  step, updatedAt }` in localStorage `imbewu_design_canvas_<siteId>`, cloud-synced via
  `lib/design-canvas-sync.ts` (last-write-wins on `updatedAt`). `ZoneShape.feature?:
  GroundFeatureKind` marks ground features. Optional added fields survive
  `migrateStateToFrame` (spread).
- `components/Map.tsx` (4016 lines): tools panel "Find your land"; collapsed pill
  `toolbarMinButton` top-left; `imbewu-arm-draw` window listener (l. 908–916) already
  handles detail `'site' | 'water'` → `startPinDraw`; Site Elements palette
  (`setDroppingElement(type)`, types in `lib/site-elements.ts`: jojo_tank tap borehole
  pond_dam compost gate beehive nursery tree) with reticle-drop; guided bar replaces the
  pill when `guided && toolbarMin`.
- `app/farmer/page.tsx`: hosts header (Design Studio link), Details button
  (bottom-right, `bottom: calc(60px + safe-area + 16px)`), mobile bottom sheet, TabBar.
  LimaBar is NOT mounted here (only /home) — bottom-left is free.
- Crop planner = `app/facilitator/crops/page.tsx` (2408 lines). **Its beds come from
  `loadFacilitatorState()` (the old Konva canvas) or Firestore `myDesigns()`, or a
  10 m² `VIRTUAL_BED` fallback — Design Studio `veg_bed` items DO NOT feed it today.**
  It already has: deterministic `autoSuggestPlan()` questionnaire
  (`lib/crop-autosuggest.ts`), `seedBoqForPlan()` shopping list (`lib/crop-plan.ts`),
  plan storage `imbewu_crop_plan_v1` (user-global, not per-site).
- `lib/site-progress.ts`: stages scout→saved→traced→designed→planned;
  `hasCropPlan = (zoneCount>0 || elementCount>0) && loadCropPlan().plantings.length>0`
  — a Simple-Path farmer (items, no zones) still completes this. Good.
- `lib/tts.ts` + `components/SpeakButton.tsx`: ready to reuse as-is.
- Course: `lib/course-modules.ts` module ids: `intro-permaculture`,
  `reading-landscape`, `water-harvesting`, `soil-health`, `plant-guilds`,
  `food-forest`, `small-livestock`, `market-community`. `/student` has **no**
  query-param deep-link today.

---

# LANE 1 — Shelve auto-draw zones (quiet beta), keep the hybrid

**Goal (Rory confirmed):** auto-polygon drawing (per-step Suggest + whole-farm
Auto-design) is demoted to an "Advanced" affordance marked *beta* — nothing deleted.
What stays first-class is the **hybrid**: AI **advice** (text + anchor pins) + guided
draw (wizard + chips) + free draw (Pro).

## 1.1 Remove the prominent surfaces

**`app/design/page.tsx`**
- DELETE the gold hero bar block (`{/* AI Auto-Design hero … */}`, ~l. 1183–1212).
  Keep `openAutoDesign`, `runAutoDesign`, `AutoDesignSheet` mount, and the
  running-overlay untouched — they're now reached from the Advanced sheet only.
- The running-overlay copy stays; replace its context line (see keys below) — no other
  change.

**`components/design/DesignWizard.tsx`**
- GuidedWizard: remove the `<SuggestButton …>` render entirely (l. 218–220). Guided
  farmers get the advice card (1.3) instead.
- ProWizard: keep the compact pill but relabel via `SUGGEST_LABEL` → append " (beta)"
  to zones/water/planting/structures labels; base keeps `Auto-detect features (AI)`
  unchanged (it detects what EXISTS — it is not auto-design). Replace the `Sparkles`
  icon on the beta pills with `FlaskConical` (Lucide) so beta reads visually.
- Update `STEP_GUIDANCE` strings for water/zones/planting/structures to drop the
  "— or tap ✨ Suggest…" clauses (they reference a button guided mode no longer has),
  e.g. zones → `'Paint your zones — Zone 1 nearest the kitchen door, wilder as numbers
  grow. Tap "Where do my zones go?" if you want Lima's advice.'` (also removes ✨
  emoji from copy — do the same sweep in all four strings).

## 1.2 New "Advanced" sheet (the beta home)

**NEW `components/design/AdvancedToolsSheet.tsx`** — bottom sheet, same visual pattern
as `ItemEditSheet` in `app/design/page.tsx` (fixed inset scrim, paper sheet, 44 px
rows).

```tsx
export interface AdvancedToolsSheetProps {
  open: boolean;
  step: WizardStep;
  detecting: boolean;
  onClose: () => void;
  onRun: (action: 'detect' | 'zones' | 'water' | 'planting' | 'structures' | 'autoDesign') => void;
}
```

Rows (Lucide icon · label · one-line hint · chevron; run → sheet closes, existing
pending-suggestions card takes over):
- `ScanSearch` · t('advDetect') — "Find what's already here from the satellite"
- `FlaskConical` · t('advZones') + BETA chip
- `FlaskConical` · t('advWater') + BETA chip
- `FlaskConical` · t('advPlanting') + BETA chip
- `FlaskConical` · t('advStructures') + BETA chip
- `Wand2` · t('advAutoDesign') + BETA chip — opens the existing questionnaire flow
- Footer note: t('advBetaNote') — honest framing ("Beta: Lima drafts shapes for you to
  review. You can accept, edit or throw them away — your own drawing is always the
  boss.")

BETA chip: 10 px uppercase Public Sans 700, Ochre text on `rgba(192,122,30,0.12)`,
radius 6.

**Entry point:** in the slim chrome row of `app/design/page.tsx` (the flex row with
"More space", ~l. 1250), add a quiet text button before "More space":
`<SlidersHorizontal size={15}/> {t('advancedButton')}` (same styling as the More-space
button). Opens the sheet. Present in both guided and pro, both collapsed and expanded
chrome.

**Page wiring:** refactor `handleSuggest` into `runSuggestForStep(step: WizardStep)`
(same body, step as arg instead of `canvasState.step`) so the sheet can run any step's
generator regardless of the current step; `handleSuggest` (Pro pill) calls
`runSuggestForStep(canvasState.step)`. `onRun('autoDesign')` → `openAutoDesign()`.
New state: `const [advancedOpen, setAdvancedOpen] = useState(false)`.

## 1.3 Keep the hybrid: zone ADVICE (text + anchor pins)

The advisor (`DesignAdvisor.tsx`) stays untouched — that's the text-advice surface.
NEW: on the **zones step (guided mode)**, a secondary full-width button under the zone
chips (rendered by the page, above `DesignPalette` or passed into it — implementer's
choice, simplest is a block in `app/design/page.tsx` just above the palette when
`step==='zones' && designMode==='guided'`):

`<Lightbulb size={18}/> {t('zoneAdviceButton')}` — outline Forest button, 48 px.

Tapping it runs the **existing deterministic** `suggestZones(refLayers.boundary,
refLayers.house, zoneOpts)` (no network, instant) and converts the result to advice
pins instead of polygons:

**`lib/design-suggest.ts`** — add:
```ts
export interface ZoneAdvicePin {
  id: string;
  zone: 0 | 1 | 2 | 3 | 4 | 5;
  x: number; y: number;      // normalised — centroid of the suggested ring
  note: string;              // the suggestion's note, e.g. "Zone 1 — daily herbs by the kitchen door"
}
export function zoneAdviceFromSuggestions(suggestions: DetectSuggestion[]): ZoneAdvicePin[]
// filter kind==='zone', centroid each ring (reuse the module's centroid()), carry zone+note.
```

**`components/design/DesignCanvas.tsx`** — new optional props:
```ts
advicePins?: ZoneAdvicePin[];
onAdvicePinTap?: (zone: 0|1|2|3|4|5) => void;
```
Render each pin as a small round badge at (x,y): 28 px circle filled with
`ZONE_DEFS[zone].color`, white zone number, dashed 1.5 px white outline, plus the note
as a 11 px label chip beneath (max-width 140 px, ellipsis). Rendered in the same
transformed layer as suggestions so pan/zoom track. **Tap = advise, never control:**
`onAdvicePinTap(zone)` — the page responds `setZoneDraw(zone); handleSetTool('zone');`
so the farmer is armed to draw that zone themselves. Pins are NOT hit-targets for
accept-into-geometry; nothing is committed.

**Page state:** `const [zoneAdvice, setZoneAdvice] = useState<ZoneAdvicePin[]>([])`.
A dismiss chip floats top-right of the canvas while pins exist ("`<X/>`
{t('zoneAdviceDismiss')}", 44 px). Advice clears on step change and on dismiss. While
advice pins exist, show a one-line hint above the palette: t('zoneAdviceHint') with a
`SpeakButton` (text = hint; englishText = `translate('en','zoneAdviceHint')`).

## 1.4 New T.en keys (Lane 1)

```
advancedButton: 'Advanced',
advSheetTitle: 'Advanced tools',
advDetect: 'Find what is already here (AI)',
advDetectHint: 'Reads your satellite photo and marks trees, roofs and water it can see.',
advZones: 'Auto-draw zones',
advWater: 'Auto-draw water setup',
advPlanting: 'Auto-draw planting',
advStructures: 'Auto-draw structures',
advAutoDesign: 'Auto-design my whole farm',
advBetaChip: 'Beta',
advBetaNote: 'Beta: Lima drafts shapes for you to review. Accept, move or delete them — your own drawing is always the boss.',
zoneAdviceButton: 'Where do my zones go?',
zoneAdviceHint: 'Lima marked where each zone would work well. Tap a pin, then draw that zone yourself.',
zoneAdviceDismiss: 'Hide advice',
autoDesignRunningHint: 'Reading your satellite photo and drafting zones, veg, water and a wind belt for review.',
```

## 1.5 Acceptance checks (Lane 1)

1. Open `/design?lat&lon` for a traced site, guided mode: NO gold auto-design bar; no
   per-step Suggest hero; wizard card is shorter; canvas taller.
2. Zones step (guided): "Where do my zones go?" → colour pins + notes appear instantly
   (offline too); tapping the Zone 1 pin arms the Zone 1 chip (chip highlights, hint
   line shows "Tap the map to paint Zone 1"); nothing was added to `canvasState.zones`.
3. Advanced → "Auto-draw zones (beta)" reproduces the old behaviour end-to-end (AI
   plan, deterministic fallback, pending ghosts, Accept all/Dismiss all, single undo
   entry on accept-all).
4. Advanced → "Auto-design my whole farm (beta)" opens the questionnaire sheet, runs,
   lands pending suggestions; failure paths still fall back deterministically.
5. Pro mode: compact per-step pill still present, labelled "… (beta)" with
   FlaskConical on the four design steps; base step unchanged.
6. `grep -n '✨' app/design/page.tsx components/design/DesignWizard.tsx` → no hits.
7. No change to `lib/design-suggest.ts` generator outputs (pure addition of
   `zoneAdviceFromSuggestions`).

**Decisions for Rory (Lane 1):**
- R1a. Keep base-step "Auto-detect features (AI)" as a first-class action (proposal:
  yes — it traces reality, it doesn't design) or demote it into Advanced too?
- R1b. Keep the Pro-mode compact suggest pill (proposal: yes, beta-tagged) or make the
  Advanced sheet the only door in Pro as well?
- R1c. Zone advice pins: also offer on Pro mode? (proposal: yes — same button, it's
  harmless.)

---

# LANE 2 — Discoverability: the "+ Add" entry point (STRONGEST LANE)

**The pain:** "I wanted to add a lawn polygon and as a beginner had no idea where."
Today "lawn" is a ground-feature chip visible ONLY on the Design Studio's Base step.
The farmer map has boundary/water draw and point elements buried in a collapsible
panel. There is no single answer to "where do I add a thing?".

**The fix:** ONE mental model — a "+ Add" button on BOTH surfaces opening the same
catalog sheet ("What do you want to add?"). The map executes what the map owns
(boundary, water body, point elements, saved place) and **hands areas off to the
Studio pre-armed** (`/design?lat&lon&add=lawn`). The Studio arms the right tool
regardless of the current wizard step.

## 2.1 Shared catalog — NEW `lib/add-actions.ts`

Pure data module (no React):

```ts
import type { LucideIcon } from 'lucide-react';
import { Landmark, Home, Squircle, Sprout, Trees, Droplets, Waves,
         CircleDot, Footprints, Fence, Grid3x3, LayoutGrid } from 'lucide-react';
// (final icon picks are the implementer's; plain, literal Lucide icons only)

export type AddActionId =
  | 'boundary'        // trace land boundary          → MAP draw
  | 'house'           // house outline (ground feature) → STUDIO areaFeature 'house'
  | 'lawn'            // lawn area                     → STUDIO areaFeature 'lawn'
  | 'veg_garden'      // existing veg-garden area      → STUDIO areaFeature 'veg_garden'
  | 'veg_bed'         // new veg bed (item)            → STUDIO place 'veg_bed'
  | 'tree'            // a tree                        → MAP element 'tree' / STUDIO place tree def
  | 'water_tank'      // JoJo/tank                     → MAP element 'jojo_tank' / STUDIO place 'jojo_5000'
  | 'water_body'      // dam/pond outline              → MAP water draw
  | 'tap'             // tap point                     → MAP element 'tap' / STUDIO place 'tap_point'
  | 'path'            // path line                     → STUDIO line 'path'
  | 'fence';          // fence line                    → STUDIO line 'fence'

export interface AddAction {
  id: AddActionId;
  icon: LucideIcon;
  labelKey: string;   // addLabel<Id>
  hintKey: string;    // addHint<Id>
  group: 'land' | 'growing' | 'water' | 'structures';
  // Where the action executes. 'map' = executable on /farmer; 'studio' = executable
  // in /design; an action present on a surface it doesn't execute on deep-links to
  // the other surface.
  runsOn: 'map' | 'studio' | 'both';
}
export const ADD_ACTIONS: AddAction[];               // exactly the 11 above, in this order
export const ADD_GROUP_LABEL_KEYS: Record<AddAction['group'], string>;
```

Mappings (single source of truth, also exported):
```ts
export const STUDIO_AREA_FOR: Partial<Record<AddActionId, GroundFeatureKind>> =
  { house: 'house', lawn: 'lawn', veg_garden: 'veg_garden' };
export const STUDIO_PLACE_FOR: Partial<Record<AddActionId, string>> =
  { veg_bed: 'veg_bed', tree: 'tree_citrus', water_tank: 'jojo_5000', tap: 'tap_point' };
export const STUDIO_LINE_FOR: Partial<Record<AddActionId, LineShape['kind']>> =
  { path: 'path', fence: 'fence' };
export const MAP_ELEMENT_FOR: Partial<Record<AddActionId, SiteElementType>> =
  { tree: 'tree', water_tank: 'jojo_tank', tap: 'tap' };
```

Keep v1 to these 11 — radical choice-reduction is the point. Orchard/patio/cleared,
swales, animals etc. remain reachable through the existing step chips and palette.

## 2.2 Shared sheet — NEW `components/AddSheet.tsx`

```tsx
export interface AddSheetProps {
  open: boolean;
  surface: 'map' | 'studio';
  onClose: () => void;
  onPick: (action: AddAction) => void;   // caller executes or deep-links
}
```
- Bottom sheet (same shell as farmer page's mobile sheet styling: paper bg, 20 px top
  radius, scrim). Title t('addSheetTitle') + `SpeakButton` (text/en pattern).
- Rows grouped under 4 small uppercase group headers; each row ≥52 px: icon (Forest,
  size 20) · label (Public Sans 15/600) · hint (12.5, Ink-muted) · trailing
  `ArrowRight`.
- Rows whose action does NOT run on this surface show a trailing 11 px chip instead:
  t('addOpensStudioChip') on the map / t('addOpensMapChip') in the studio — honest
  about the handoff (per the "copy honesty" rule in ONBOARDING-PLAN.md).
- No emoji anywhere.

## 2.3 Farmer map wiring

**`app/farmer/page.tsx`** hosts the button + sheet (keeps Map.tsx churn minimal):
- State `addOpen`. Render `<AddSheet surface="map" …/>` next to ProfileSheet.
- **Button placement:** a pill anchored bottom-LEFT, mirroring the Details button:
  `className="lg:hidden fixed left-4 z-30 …"` with the same
  `bottom: calc(60px + env(safe-area-inset-bottom) + 16px)`; content
  `<Plus size={16}/> {t('addButton')}`; Forest gradient like Details. Hidden when
  `drawing || sheetOpen` (same opacity/pointer-events trick as Details). On `lg:+`
  (desktop) render the same pill absolutely inside the map container, bottom-left
  (`absolute left-4 bottom-4 z-20`) — desktop has no TabBar overlap.
  *(LimaBar is not mounted on /farmer — verified — so bottom-left is free; still
  check on-device against the Mapbox attribution.)*
- `onPick(action)`:
  - `boundary` → `window.dispatchEvent(new CustomEvent('imbewu-arm-draw', { detail: 'site' }))`
  - `water_body` → same event, detail `'water'` (listener already supports it)
  - `tree | water_tank | tap` → `window.dispatchEvent(new CustomEvent('imbewu-arm-element', { detail: MAP_ELEMENT_FOR[action.id] }))`
  - `house | lawn | veg_garden | veg_bed | path | fence` → `router.push(selected
    ? `/design?lat=${lat.toFixed(5)}&lon=${lon.toFixed(5)}&add=${action.id}`
    : `/design?add=${action.id}`)` (no site selected → Studio's saved-places
    EmptyState shows; append `&add=` to its links so the intent survives — see 2.4).
  - Always `setAddOpen(false)` first (draw modes need the sheet gone).

**`components/Map.tsx`** — ONE small addition (keep it surgical):
```ts
// next to the existing imbewu-arm-draw listener (l. ~908)
useEffect(() => {
  const armEl = (e: Event) => {
    const t = (e as CustomEvent).detail as SiteElementType;
    if (ELEMENT_TYPES.includes(t)) setDroppingElement(t);
  };
  window.addEventListener('imbewu-arm-element', armEl);
  return () => window.removeEventListener('imbewu-arm-element', armEl);
}, []);
```
Plus: add an "Add to my map" row as the FIRST action in the tools panel's Tools
section (same 48 px button styling as "Locate me"), dispatching a new
`window.dispatchEvent(new CustomEvent('imbewu-open-add'))`; farmer page listens and
sets `addOpen=true`. (Two doors, one sheet: the FAB for everyone, the panel row for
farmers already in the tools.)

## 2.4 Design Studio wiring

**`app/design/page.tsx`:**
- State `addOpen`; render `<AddSheet surface="studio" …/>`.
- **Button placement:** first button in the palette tool row — pass a new optional
  prop through `DesignPalette`: `onOpenAdd?: () => void`; `DesignPalette` renders
  `<Plus/> {t('addButton')}` as the FIRST chip in the `Select · Undo · Delete` row
  (Gold background `#F7C97E`, Dark text — the one loud chip), in BOTH modes and on
  EVERY step. This is the headline fix: an always-visible Add regardless of step.
- `onPick(action)` (studio):
  - area (`STUDIO_AREA_FOR`): `setPlaceDefId(null); setAreaFeature(kind);
    handleSetTool('zone');` — **works on any step** (see step-gate lift below).
  - item (`STUDIO_PLACE_FOR`): `setAreaFeature(null); setPlaceDefId(defId);
    handleSetTool('place');`
  - line (`STUDIO_LINE_FOR`): `setLineKind(kind); handleSetTool('line');`
  - `tree`: the sheet's studio variant expands an inline second-level row of tree
    chips (Citrus, Guava, Pawpaw, Mango, Avocado, Banana, Moringa, Indigenous — from
    `ELEMENT_CATALOG` growing defs with `castsShade`), tap → place-arm that def.
  - `boundary | water_body`: `router.push('/farmer?panel=Farm&arm=' + (id==='boundary'
    ? 'site' : 'water'))` → farmer page consumes `?arm=` (add a one-shot effect
    mirroring the `?site=` pattern, l. 204–217: after mount + 800 ms,
    dispatch `imbewu-arm-draw` with the detail). NEW farmer-page param: `arm=site|water`.
- **Deep-link `?add=<AddActionId>`:** one-shot effect (ref-guarded like
  `siteParamHandled`) that waits for `canvasState && frame` then executes the same
  `onPick` mapping and shows the armed hint. Also: `EmptyState`'s saved-place links
  must carry the `add` param through (`/design?lat&lon&add=…`).
- **Lift the step gate for armed drawing:** in `DesignCanvas`, the zone/place/line
  tools already draw whatever is armed (the gate is purely which CHIPS the palette
  shows per step). Verify: arming `areaFeature='lawn'` + tool 'zone' on e.g. the
  planting step draws a lawn polygon correctly (the page's `setStep` clears
  `areaFeature` on step change — acceptable; Add re-arms). If any per-step guard in
  `DesignCanvas` blocks it, remove that guard for programmatic arming.
  **Do NOT change which chips the palette shows per step** — the wizard's focus
  filtering stays; Add is the escape hatch.

## 2.5 New T.en keys (Lane 2)

```
addButton: 'Add',
addSheetTitle: 'What do you want to add?',
addSheetSub: 'Pick one — Lima will put the right tool in your hand.',
addGroupLand: 'My land',
addGroupGrowing: 'Growing',
addGroupWater: 'Water',
addGroupStructures: 'Paths & structures',
addOpensStudioChip: 'Opens Studio',
addOpensMapChip: 'Opens map',
addLabelBoundary: 'Land boundary', addHintBoundary: 'Trace the edge of your land.',
addLabelHouse: 'House', addHintHouse: 'Draw your house outline.',
addLabelLawn: 'Lawn', addHintLawn: 'Draw a grass area that is already there.',
addLabelVegGarden: 'Veg garden (existing)', addHintVegGarden: 'Draw a garden that already grows.',
addLabelVegBed: 'New veg bed', addHintVegBed: 'Place a new bed to plant.',
addLabelTree: 'Tree', addHintTree: 'Mark a tree — existing or planned.',
addLabelWaterTank: 'Water tank', addHintWaterTank: 'Place a JoJo or tank.',
addLabelWaterBody: 'Dam / pond', addHintWaterBody: 'Trace water on your land.',
addLabelTap: 'Tap', addHintTap: 'Mark a tap point.',
addLabelPath: 'Path', addHintPath: 'Draw a walking path.',
addLabelFence: 'Fence', addHintFence: 'Draw a fence line.',
addToolsPanelRow: 'Add to my map',
```

## 2.6 Acceptance checks (Lane 2) — the lawn test is #1

1. **The lawn test:** cold start on `/farmer` with a saved, traced site selected →
   "+ Add" pill is visible without opening anything → tap → "Lawn" row → lands in
   `/design` with the lawn ground-feature armed, hint line reading "Draw your Lawn —
   tap corners, then ✓ Finish" → tap 4 corners + Finish → a filled lawn polygon
   exists in `canvasState.zones` with `feature:'lawn'`. Total: ≤5 taps before drawing.
2. Same from the Studio on the Structures step: Add → Lawn arms immediately (no step
   change needed), drawing works.
3. Map executions: Add → Boundary arms the boundary reticle; Add → Dam/pond arms the
   water draw; Add → Tree/Water tank/Tap arms the element reticle with the correct
   type; the sheet is closed in all draw modes.
4. `/design?add=veg_bed` (deep link, traced site) arms the veg-bed place tool after
   load; `?add=` is consumed once (no re-arm on state refresh).
5. Add pill hidden while `drawing`/sheet open on mobile; present on desktop map
   bottom-left; ≥44 px everywhere; zero emoji; all rows i18n'd.
6. `imbewu-arm-element` with a bogus detail is a no-op (guarded by
   `ELEMENT_TYPES.includes`).

**Decisions for Rory (Lane 2):**
- R2a. FAB placement bottom-left (proposed) — confirm on a real phone vs Mapbox
  attribution + zoom controls; fallback: a pill beside the collapsed "Find your land"
  pill top-left.
- R2b. The 11-action v1 list — anything to add/cut (e.g. Swale? Chicken coop)?
- R2c. On the map, should Tree prompt for species (like the element editor does) or
  drop-then-edit (proposed: drop-then-edit, current behaviour)?

---

# LANE 3 — Simple Path: beds + fruit trees → crop plan + shopping list

**Goal (Rory):** "the person who just wants veg beds + a few fruit trees, nothing
else" gets a straight line: place beds & trees on their real satellite → crop plan →
shopping list. Skips zones/water/sectors entirely. Reuses the strong existing crop
planner (`/facilitator/crops`: `autoSuggestPlan`, `seedBoqForPlan`).

**The critical gap (verified):** the crop planner's beds come from the OLD facilitator
Konva canvas / Firestore designs — Design Studio `veg_bed` items never reach it. The
bridge below is the load-bearing piece and is useful far beyond Simple Path.

## 3.1 The bridge — NEW `lib/design-beds-bridge.ts`

```ts
import type { DesignCanvasState } from '@/lib/design-canvas';
import type { PlanBed } from '@/lib/crop-plan';
import { ELEMENTS_BY_ID } from '@/lib/design-elements';

/** defIds that count as plantable beds for the crop planner. */
export const BED_DEF_IDS = ['veg_bed', 'keyhole_bed', 'herb_spiral'] as const;

/** Design-Studio canvas items → crop-planner beds. Pure; [] when state is null. */
export function bedsFromDesignCanvas(state: DesignCanvasState | null): PlanBed[]
// items where BED_DEF_IDS.includes(defId), in array order:
// { id: item.id, label: item.label ?? `Bed ${n}`,
//   areaM2: round1((item.wM ?? def.wM) * (item.hM ?? def.hM)),
//   minDimM: Math.min(item.wM ?? def.wM, item.hM ?? def.hM) }

/** Fruit/food trees placed on the canvas — for the shopping-list add-on. */
export function treesFromDesignCanvas(state: DesignCanvasState | null):
  Array<{ defId: string; name: string; count: number }>
// items whose def.category==='growing' && def.castsShade, grouped by defId.
```

## 3.2 Crop-planner entry — `app/facilitator/crops/page.tsx`

New query param **`?canvasSite=<siteId>`** (siteId = `designSiteIdFromLocation`
output, i.e. `"lat,lon"` at 5 dp — URL-encode it):
- When present: skip the Firestore/facilitator design picker entirely
  (`needsSitePicker` forced false); `designBeds = bedsFromDesignCanvas(
  loadCanvasState(canvasSite))`; header shows t('cropsFromStudioBadge') ("Beds from
  your Design Studio map") instead of the design-picker chrome.
- Subscribe to `DESIGN_CANVAS_CHANGED_EVENT` to live-refresh beds (mirrors how it
  reloads facilitator state).
- When absent: behaviour 100 % unchanged.
- New param **`&auto=1`**: after mount with ≥1 bed, open the existing auto-suggest
  questionnaire (`setAutoPhase('questions')`) once (ref-guarded). The questionnaire,
  review step, plan mutation, undo — all existing code, zero changes.
- The existing seed-BOQ/shopping surface then reflects the new plantings as today.

*Note: `imbewu_crop_plan_v1` is user-global, not per-site — pre-existing behaviour;
do NOT fix in this lane, but flag: a second site's Simple Path adds plantings to the
same plan. (Decision R3d.)*

## 3.3 Studio Simple mode

**State:** add optional field to `DesignCanvasState` (`lib/design-canvas.ts`):
```ts
flow?: 'simple' | 'full';   // undefined = full (every existing state)
```
JSON-safe, survives `migrateStateToFrame` (spread) and cloud sync unchanged.

**Entry — the chooser:** in `app/design/page.tsx`, when a site loads with an EMPTY
canvas (`items+zones+lines === 0`) and `flow` is undefined, render a chooser card
overlaying the canvas (not a modal — page content, like the onboarding-plan rule):
- Title t('flowChooserTitle') "How do you want to design?" + SpeakButton.
- Two 56 px option cards:
  - `Sprout` t('flowSimpleTitle') "Just beds & trees" / t('flowSimpleSub') "Place veg
    beds and a few fruit trees, then get a crop plan and shopping list."
  - `LayoutGrid` t('flowFullTitle') "Full design" / t('flowFullSub') "Step-by-step:
    water, zones, planting, structures."
- Pick → `handleChange(prev => ({ ...prev, flow }))`; chooser never shows again for
  that site (flow set). A site with existing content defaults to full.

**Simple-mode UI (when `canvasState.flow === 'simple'`):**
- HIDE: `DesignWizard`, the Advanced button (Lane 1), zone/line/layer chip rows,
  ground-feature chips, the Guided/Pro toggle (irrelevant here). KEEP: header,
  `DesignCanvas`, `DesignAdvisor` (it already warns "tree will shade the bed" —
  exactly the advice this farmer needs), Select/Undo/Delete row, the Add button
  (Lane 2; its studio sheet still works — nice).
- Palette: pass `mode` and a new prop `simple?: boolean` into `DesignPalette`; when
  simple, the catalog row shows ONLY: `veg_bed`, `keyhole_bed`, `herb_spiral`, then
  the fruit trees (`tree_citrus`, `tree_guava`, `tree_pawpaw`, `tree_mango`,
  `tree_avocado`, `banana_clump`, `tree_moringa`). Guided-size chips (64 px).
- Persistent bottom CTA bar (above the palette, full-width, Forest, 52 px):
  t('simpleDoneCta') `"Done — plan my crops"` + live count line
  t('simpleDoneCount') `"{beds} beds · {trees} trees"`. Disabled (40 % opacity +
  t('simpleNeedBedHint')) until ≥1 bed item exists.
- CTA action: opens a small confirm sheet (`SimpleHandoffSheet`, may live inline in
  page.tsx):
  - Recap: N beds (total m²), tree list from `treesFromDesignCanvas`.
  - The tree line doubles as the tree shopping list: t('simpleTreeShopping')
    `"Also buy: {list}"` e.g. "2 × Citrus tree, 1 × Mango tree" (trees don't enter
    the seed BOQ — see R3c).
  - Primary: t('simpleGoPlan') "Make my crop plan" →
    `router.push('/facilitator/crops?canvasSite=' + encodeURIComponent(siteId) + '&auto=1')`.
  - Quiet secondary: t('simpleSwitchFull') "Switch to full design" → sets
    `flow:'full'` (upgrade path; nothing lost — same canvas).
- A farmer in full mode is untouched; a Simple farmer can always upgrade. Downgrade
  (full→simple) is NOT offered (hiding existing zones would confuse) — R3e.

**Boundary not required:** the Studio's 120 m fallback frame (verified in
`computeCanvasFrame`) means Simple Path works straight from a saved pin — do not gate
on a traced boundary. The `DesignAdvisor` and progress score work without one.

**Progress integration:** `hasCropPlan` in `lib/site-progress.ts` already returns true
for items+plantings — a Simple farmer reaches `planned` without zones. Verify, don't
change.

## 3.4 Optional entry accelerators (flagged, small)

- Home (`components/home/HomeHeroCard.tsx` CONTINUE variant): if
  `progress?.inputs.elementCount === 0 && zoneCount === 0`, add a third quiet link
  t('homeQuickStart') "Quick start: beds & trees" →
  `/design?lat&lon&flow=simple` (the `?flow=simple` param pre-answers the chooser —
  one-shot, sets flow on first load). — R3a.
- Lane 2's Add sheet "New veg bed" row already lands beginners in the Studio; if the
  canvas is empty the chooser appears with Simple as the natural pick. No extra work.

## 3.5 New T.en keys (Lane 3)

```
flowChooserTitle: 'How do you want to design?',
flowSimpleTitle: 'Just beds & trees',
flowSimpleSub: 'Place veg beds and a few fruit trees, then get a crop plan and shopping list.',
flowFullTitle: 'Full design',
flowFullSub: 'Step-by-step: water, zones, planting, structures.',
simpleDoneCta: 'Done — plan my crops',
simpleDoneCount: '{beds} beds · {trees} trees',
simpleNeedBedHint: 'Place at least one veg bed first.',
simpleRecapTitle: 'Your quick design',
simpleTreeShopping: 'Also buy: {list}',
simpleGoPlan: 'Make my crop plan',
simpleSwitchFull: 'Switch to full design',
cropsFromStudioBadge: 'Beds from your Design Studio map',
homeQuickStart: 'Quick start: beds & trees',
```

## 3.6 Acceptance checks (Lane 3)

1. Fresh saved pin (no boundary): open Studio → chooser appears → "Just beds & trees"
   → palette shows only beds + fruit trees; wizard/zones/Advanced absent.
2. Place 2 veg beds + 1 citrus + 1 mango → CTA enabled, count line "2 beds · 2 trees"
   → Done sheet lists 2 beds (7.2 m²) and "1 × Citrus tree, 1 × Mango tree" → "Make
   my crop plan" lands on `/facilitator/crops` with EXACTLY those 2 beds (labels/areas
   match), no site picker, auto-suggest questionnaire open.
3. Complete the questionnaire → plantings land on those beds; seed shopping list
   (BOQ) renders; return to Studio → design intact, still simple mode.
4. Add a 3rd bed in the Studio → crops page (still open in another tab) refreshes its
   bed list via the change event.
5. `/facilitator/crops` WITHOUT `canvasSite` behaves byte-for-byte as before
   (facilitator designs, virtual bed, site picker).
6. Site progress: after step 3 the site reads stage `planned`; the home Continue card
   pct reflects it.
7. Simple→full upgrade keeps all items; chooser never reappears once `flow` is set;
   old canvases (no `flow`) never see the chooser if they have content.

**Decisions for Rory (Lane 3):**
- R3a. Home "Quick start: beds & trees" link — ship in v1 or hold? (proposal: ship;
  one line in HomeHeroCard.)
- R3b. Chooser copy/order — Simple listed first (proposal) or Full first?
- R3c. Trees in the shopping list: v1 shows them in the Done recap only (proposal) —
  or should they enter the crop-planner BOQ as bought seedlings (bigger change to
  `seedBoqForPlan`)?
- R3d. `imbewu_crop_plan_v1` is user-global — OK for v1 (single-farm reality) or
  should Simple Path force per-site plans now? (proposal: v1 OK, log as debt.)
- R3e. Confirm: no full→simple downgrade offered.
- R3f. Relationship to `/survey` (garden wizard also produces beds abstractly):
  proposal — leave `/survey` untouched; revisit merging after Simple Path proves out.

---

# LANE 4 — Per-step lessons: "Why this step?"

2–4 farmer-friendly sentences + the permaculture principle + one tip per design step,
expandable under the step guidance, Lima-narratable, optional course deep-link.

## 4.1 Content module — NEW `lib/design-lessons.ts`

```ts
import type { WizardStep } from '@/lib/design-canvas';
export interface StepLesson {
  titleKey: string; bodyKey: string; principleKey: string; tipKey: string;
  courseModuleId?: string;  // must exist in lib/course-modules.ts COURSE_MODULES
}
export const DESIGN_STEP_LESSONS: Record<Exclude<WizardStep, 'glossy'>, StepLesson>;
```
courseModuleId per step: base → `reading-landscape`, water → `water-harvesting`,
zones → `intro-permaculture`, planting → `food-forest`, structures →
`small-livestock`, review → (none). *(All ids verified against COURSE_MODULES.)*

## 4.2 The copy (final draft — en keys below; ship as written)

**Base — "Start with what's true"**
Body: "Before you design anything, get the real picture: your boundary, your house,
and what's already on the ground. Everything you place later is measured against
these. If the base is wrong, every distance in your plan is wrong too."
Principle: "Observe and interact — good design starts by seeing what's really there."
Tip: "Trace your boundary on the main map first — the Studio fits your satellite
photo to it, so every bed you place is true to scale."

**Water — "Water first, everything else second"**
Body: "Water is the heaviest thing to move and the first thing to run out. Catch it
where it falls: tanks next to roofs, and swale lines along the slope so rain sinks
into your soil instead of washing away. A garden planned around water survives a dry
month; one without doesn't."
Principle: "Catch and store energy — harvest rain in the wet season, spend it in the
dry."
Tip: "Place a tank within 3 m of a roof downpipe. Every 10 mm of rain on a 100 m²
roof gives you about 1,000 litres."

**Zones — "Put things where your feet already go"**
Body: "Zones plan your energy, not just your space. Things you visit every day —
herbs, veg beds, chickens — belong nearest the kitchen door. Things you visit weekly
or monthly go further out. This one idea saves you hundreds of walking hours a year."
Principle: "Zone planning — the more often you use it, the closer it lives."
Tip: "Stand at your kitchen door and count 20 steps. What you can reach is Zone 1 —
keep your daily harvest inside it."

**Planting — "Right plant, right place"**
Body: "Trees are the biggest, longest-living things you'll place — position them
first and fit beds around them. In South Africa the midday sun sits in the north, so
a tall tree on the north side of a bed steals its light. Give every fruit tree room
for its full-grown size, not its seedling size."
Principle: "Use and value diversity — a mix of trees, beds and flowers confuses pests
and feeds bees."
Tip: "Plant tall trees on the south or west of veg beds so winter sun still reaches
them. A mango grows 10 m wide — measure that out before you dig."

**Structures — "Buildings must work for the land"**
Body: "Sheds, coops and kraals are workers, not furniture: a roof catches water, a
wall blocks wind, animals make manure for your compost. Place each structure where
what it produces feeds the next thing along."
Principle: "Integrate rather than segregate — place things so they help each other."
Tip: "Put the compost bay on the path between kitchen and veg beds — scraps in on the
way out, finished compost back on the way in."

**Review — "Look before you build"**
Body: "Walk through your design like a real morning: fetch water, feed the chickens,
pick spinach. Are the paths short? Does anything shade the beds or block the tap?
Changing it on the map costs nothing — changing it after digging costs a season."
Principle: "Apply self-regulation and accept feedback — check the plan before the
spade hits the ground."
Tip: "Show the design to one other person. A mentor sees in one minute what you've
stopped noticing."

## 4.3 UI — `components/design/DesignWizard.tsx`

**GuidedWizard:** under the `STEP_GUIDANCE` blurb box, a quiet expander row (44 px):
`<HelpCircle size={15}/> {t('lessonWhyStep')} <ChevronDown/>` (Forest text, transparent
bg). Expanded panel (soft `rgba(31,77,43,0.06)` box, 12 px radius):
- lesson title (Public Sans 700, 14) with `SpeakButton` right-aligned — narration text
  = `${title}. ${body} ${principle} ${tip}` (translated) with the `translate('en',…)`
  English fallback string built the same way.
- body (13.5/1.5), principle as its own line prefixed `<Sprout size={13}/>` +
  t('lessonPrincipleLabel') overline, tip prefixed `<Lightbulb size={13}/>` +
  t('lessonTipLabel').
- If `courseModuleId`: footer link t('lessonCourseLink') "Learn more in the course" →
  `/student?module=<id>`.
- State: `useState<boolean>` reset to collapsed on step change (expanded is a
  per-step, per-visit choice; no persistence).

**ProWizard:** a 30 px `HelpCircle` icon button at the end of the guidance line; tap
toggles the same panel rendered full-width under the toolbar (Pro users get it on
demand, zero default height cost).

**`app/student/page.tsx` (optional, tiny):** support `?module=<id>` — on mount, if the
param matches a module, expand that module and `scrollIntoView`. If skipped (R4a),
`lessonCourseLink` links to plain `/student`.

## 4.4 New T.en keys (Lane 4)

```
lessonWhyStep: 'Why this step?',
lessonPrincipleLabel: 'The principle',
lessonTipLabel: 'Try this',
lessonCourseLink: 'Learn more in the course',
lessonBaseTitle / lessonBaseBody / lessonBasePrinciple / lessonBaseTip
lessonWaterTitle / lessonWaterBody / lessonWaterPrinciple / lessonWaterTip
lessonZonesTitle / lessonZonesBody / lessonZonesPrinciple / lessonZonesTip
lessonPlantingTitle / lessonPlantingBody / lessonPlantingPrinciple / lessonPlantingTip
lessonStructuresTitle / lessonStructuresBody / lessonStructuresPrinciple / lessonStructuresTip
lessonReviewTitle / lessonReviewBody / lessonReviewPrinciple / lessonReviewTip
```
(values = §4.2 verbatim; titles are the quoted headings without the step name).

## 4.5 Acceptance checks (Lane 4)

1. Guided mode, each of the 6 steps: "Why this step?" row present; expands to
   title/body/principle/tip; collapses; resets to collapsed on step change.
2. SpeakButton reads the full lesson aloud in en; with app language = zu and no zu
   voice, it reads the ENGLISH lesson (fallback contract intact); hidden when TTS
   muted.
3. Pro mode: HelpCircle toggle shows the same content; toolbar height unchanged when
   closed.
4. Course links resolve; `?module=water-harvesting` expands that module (if R4a=yes).
5. All copy via `t()`; no emoji; expander row ≥44 px.

**Decision for Rory (R4a):** ship the `/student?module=` deep-link (tiny) or link to
plain `/student` in v1?

---

# BUILD ORDER, COLLISIONS, RISKS

## File-collision map

| File | L1 | L2 | L3 | L4 |
|---|---|---|---|---|
| `app/design/page.tsx` | HEAVY (remove bar, Advanced sheet, advice state) | MED (Add button/sheet, `?add=`) | HEAVY (chooser, simple branches, CTA) | — |
| `components/design/DesignWizard.tsx` | MED (remove guided suggest, labels) | — | — | MED (lesson expander) |
| `components/design/DesignPalette.tsx` | — | SM (Add chip, `onOpenAdd`) | MED (`simple` filter) | — |
| `components/design/DesignCanvas.tsx` | SM (advice pins) | (verify only) | — | — |
| `components/Map.tsx` | — | SM (element listener + panel row) | — | — |
| `app/farmer/page.tsx` | — | MED (FAB, AddSheet, `?arm=`) | — | — |
| `app/facilitator/crops/page.tsx` | — | — | MED (`canvasSite`, `auto`) | — |
| `lib/i18n.tsx` | append | append | append | append |
| new files | AdvancedToolsSheet | add-actions, AddSheet | design-beds-bridge | design-lessons |

## Recommended waves

**Wave 1 (3 parallel agents — zero file overlap):**
- **A1 (L1, Sonnet/Opus):** all of Lane 1. Owns `app/design/page.tsx` +
  `DesignWizard.tsx` + `DesignCanvas.tsx` for this wave.
- **A2 (L2-map half, Sonnet):** `lib/add-actions.ts`, `components/AddSheet.tsx`,
  `app/farmer/page.tsx` (FAB + sheet + `?arm=`), `components/Map.tsx` (listener +
  panel row). Studio-side `onPick` mapping is written in AddSheet/add-actions but NOT
  wired into the design page yet.
- **A3 (L3-planner half, Sonnet):** `lib/design-beds-bridge.ts` +
  `app/facilitator/crops/page.tsx` (`canvasSite`/`auto`). Fully testable standalone by
  hand-crafting a canvas state in localStorage.

**Wave 2 (after Wave 1 merges; 2–3 parallel agents):**
- **B1 (L2-studio half + L3-studio half, ONE agent — both edit
  `app/design/page.tsx`/`DesignPalette.tsx`, do not split):** Add button in palette,
  `?add=` deep link, arm mappings; then flow chooser, simple-mode branches, Done
  handoff, `flow` field in `lib/design-canvas.ts`.
- **B2 (L4, Haiku/Sonnet):** `lib/design-lessons.ts` + DesignWizard expander (+
  optional student `?module=`). DesignWizard is stable after Wave 1.
- **B3 (optional, Haiku):** HomeHeroCard "Quick start" link (R3a) — one file.

**i18n:** every agent appends only inside its own `// ── Lane N ──` block at the end
of `T.en`; a final integrator pass resolves the (trivial) adjacent-append conflicts
and runs a duplicate-key check (`node -e` on the T.en object or eslint no-dupe-keys).

## Top risks

1. **`app/design/page.tsx` is the collision hot-spot** (L1 heavy + B1 heavy). The
   wave split above serialises it; do NOT run L1 and B1 concurrently.
2. **Map.tsx fragility** (4,016 lines, many interlocking draw modes). L2's changes are
   deliberately confined to one new listener + one panel row + a FAB hosted in
   farmer/page.tsx. Any temptation to restructure the tools panel = out of scope.
3. **Suggestion-pipeline regression** (L1 refactor of `handleSuggest` →
   `runSuggestForStep`). Guard: acceptance 1.3/1.4 exercise both AI and deterministic
   paths; the deterministic path must work offline.
4. **`DesignCanvasState.flow` + cloud sync:** additive optional field — verify
   `design-canvas-sync` round-trips it (it syncs the whole object; last-write-wins on
   `updatedAt` unchanged). Older cached PWA clients simply ignore it.
5. **Crop-plan store is user-global** (`imbewu_crop_plan_v1`): Simple Path from a
   second site appends to the same plan (pre-existing behaviour, R3d). Do not silently
   "fix" it in this pass.
6. **Deep-link params must be one-shot** (`?add=`, `?arm=`, `?flow=`, `&auto=1`):
   ref-guard each like the existing `siteParamHandled` pattern, or state refreshes
   re-trigger them.
7. **Hydration:** every new localStorage-derived render (chooser, FAB visibility,
   Add sheet contents) follows the mount-flag pattern — SSR paints nothing new.
8. **Copy honesty:** the map→studio handoff chips ("Opens Studio") must stay — a
   low-literacy farmer must never tap "Lawn" on the map and silently context-switch.

## Verify pass (after both waves)

Run the app (`npm run dev`, port 4242) and walk: the lawn test (2.6-1), the shelve
test (1.5-1..4), the simple-path end-to-end (3.6-1..3), lessons + TTS (4.5-1..2), then
a regression sweep: full guided design flow base→glossy, Pro mode, boundary trace on
map, existing crop-planner (no `canvasSite`) untouched, `/example` demo unaffected.
Update `design/DESIGN.md` "Newer decisions" with: auto-draw demoted to beta
(Advanced sheet), the Add entry-point model (map executes points/boundary/water,
areas hand off to Studio), Simple Path (`flow` field, beds bridge, `canvasSite`
param), and per-step lessons — DESIGN.md is canonical and requires it.

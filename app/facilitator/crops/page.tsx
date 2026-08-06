'use client';

// Facilitator crop plan — a Tend-style planting timeline built on the beds
// the facilitator has already placed on the design canvas (Planting layer).
//
// Reads the shared facilitator design (localStorage, read-only) for bed
// geometry + derives the site's rainfall pattern from bgSite, then keeps its
// own crop-plan store (lib/crop-plan.ts) for what's actually sown where.
// Zero network, zero new deps.

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, X, Menu, ChevronDown, Home } from 'lucide-react';
import NavDrawer from '@/components/NavDrawer';
import LessonLink from '@/components/design/LessonLink';
import CropPlanExportCard from '@/components/crops/CropPlanExportCard';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { bedsFromDesignCanvas } from '@/lib/design-beds-bridge';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import type { FacilitatorDesignState } from '@/lib/facilitator-design';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import type { Design } from '@/lib/db/types';
import { myDesigns } from '@/lib/db/queries';
import { nearestRainfall } from '@/lib/water-calc';
import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import { CROPS, cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed, Planting, CropPlanState, FoodAvailabilityItem, FoodValueMonth, CashflowSettings } from '@/lib/crop-plan';
import {
  loadCropPlan, saveCropPlan, harvestMonth, tasksForPlan, estimatedYieldKgAdjusted, nextValidSowMonth,
  isSpaceHungry, bedOverlapFraction, seedBoqForPlan, buildYearReport, buildFoodAvailability, buildFoodValueByMonth,
  buildFieldUtilizationByMonth, suggestSubstituteCrop, loadFavouriteCropKeys, saveFavouriteCropKeys, isGenuinelyIntercropped,
  loadAllowBedSharing, saveAllowBedSharing, loadCashflowSettings, saveCashflowSettings, yieldByCrop,
} from '@/lib/crop-plan';
import type { FoodGroup } from '@/lib/crop-groups';
import { FOOD_GROUP_META, foodGroupOf, ROTATION_SEQUENCE, ROTATION_BLURB } from '@/lib/crop-groups';
import type { AutoSuggestAnswers, AutoSuggestResult, GardenGoal, HouseholdSize, HarvestRhythm } from '@/lib/crop-autosuggest';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { CropPrice } from '@/lib/crop-prices';
import { UNPRICED_CROPS, priceFor, loadCropPriceOverrides, saveCropPriceOverrides } from '@/lib/crop-prices';
// Task wording lives in the export module now, not here: the screen, the
// calendar file and the printed plan all have to describe a task the same way,
// and three copies of that sentence is how they stop doing so.
import { sowingInstruction, taskSentence } from '@/lib/crop-export-schedule';

const ALL_GROUPS: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium_aromatic', 'fruiting_veg', 'staple_grain'];

// The rolling timeline shows this many months ahead from today (column 0),
// scrollable. TWO FULL YEARS as of 2026-08-05 (Rory: "the last month i feel
// is not fully utilised... should we make it 2 years and then we just pan
// sideways").
//
// The previous 15 was a half-measure that actively created the problem it
// was meant to soften. A planting is drawn from an offset forced into 0-11
// (forwardOnlyOffset), so NO bar can ever START in column 12, 13 or 14 —
// those columns could only ever hold the tail of something sown earlier.
// The window's last months were therefore blank BY CONSTRUCTION, on every
// bed, however good the plan was. Widening alone would have made that
// worse; the fix is width PLUS drawing the cycle's repeat (see
// barInstances), which is what this plan literally is — one annual cycle
// that recurs until the farmer re-runs it with rotation on.
const DISPLAY_MONTHS = 24;
// The resilience chart below keeps the previous window: it plots the annual
// RHYTHM, and a second identical copy of every column adds no information
// there (unlike the timeline, where the repeat is what makes a wrapped bar
// legible). Deliberately not DISPLAY_MONTHS.
const CHART_MONTHS = 15;
const GRID_MIN_WIDTH = Math.round((760 * DISPLAY_MONTHS) / 12);

// Bed-sharing presets — "half a bed" or a 3-way intercrop split. A custom
// fraction can still be reached by adding more crops of the same preset.
const FRACTION_PRESETS: { label: string; value: number }[] = [
  { label: 'Whole bed', value: 1 },
  { label: 'Half', value: 0.5 },
  { label: 'Third', value: 1 / 3 },
  { label: 'Quarter', value: 0.25 },
];

// ── Local helpers ────────────────────────────────────────────────────────
// Months throughout lib/crop-plan.ts are 1-12 (Jan-Dec), wrapping via the
// same rule as that module's internal wrapMonth — kept in sync here since
// it isn't exported.

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}
function monthLabel(m: number): string {
  return MONTHS_SHORT[wrapMonth(m) - 1];
}
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compact glyph for a bed-share fraction — falls back to a rounded percentage. */
function fractionLabel(f: number): string {
  if (f >= 1) return '';
  if (Math.abs(f - 0.5) < 0.01) return '½';
  if (Math.abs(f - 1 / 3) < 0.01) return '⅓';
  if (Math.abs(f - 0.25) < 0.01) return '¼';
  return `${Math.round(f * 100)}%`;
}

/** 🌱 = sown direct from seed, 🪴 = started as a seedling/transplant. */
function SeedBadge({ transplant, large }: { transplant: boolean; large?: boolean }) {
  return (
    <span
      title={transplant ? 'Started as a seedling, then transplanted' : 'Sown direct from seed'}
      style={{ fontSize: large ? 13 : 11 }}
    >
      {transplant ? '🪴' : '🌱'}
    </span>
  );
}

// Segment.start/end are already DISPLAY-COLUMN indices (0 = this month) —
// not real calendar months — clipped to the visible window if the span runs
// off either edge. `rawStart` is the UNCLIPPED start, kept because the
// harvest-cap geometry has to measure from where the crop actually began,
// not from where the left edge happened to cut it — and because which side of
// the year-two seam a copy belongs to is decided by where it STARTED, not by
// where clipping left it (see isYearTwo).
interface Segment { start: number; end: number; rawStart: number }

// The grid is a ROLLING 12-month window starting from the current real
// month (column 0 = this month), not a fixed Jan-Dec calendar year — a
// farmer opening the plan in July should see Jul-Jun ahead, not stare at
// six already-past, unfillable months before anything useful starts.
//
// A sowMonth on its own is ambiguous without a year (there's no year field
// anywhere in this data model) — it could mean "the next time this month
// comes around" OR "the most recent time it happened" (e.g. an `existing`
// crop sown a couple of months ago, already growing). For an EXISTING crop,
// picking whichever direction (forward or back) is NEARER to today is
// correct — that's specifically for a farmer-confirmed already-growing
// crop, which really could be a few months in the past.
function nearestSignedOffset(m: number, originMonth: number): number {
  const fwd = ((m - originMonth) % 12 + 12) % 12; // 0..11
  return fwd > 6 ? fwd - 12 : fwd; // prefer whichever direction is closer; ties favour forward
}

// For a NOT-YET-existing (planned/suggested, never confirmed as actually
// sown) planting, "nearest direction" is the WRONG resolution — it's never
// legitimately in the past; it hasn't happened yet. This matters concretely
// now that fillRemainingGaps (lib/crop-autosuggest.ts) can place a sowMonth
// up to 11 months forward: nearestSignedOffset flips anything past 6 months
// forward to read as "months ago" instead, making a freshly-suggested,
// never-sown crop render as an already-concluded phantom the moment it's
// generated (not just after time passes) — exactly the "why does this
// start from Feb" bug this was built to fix. Always resolves forward
// (0-11), matching how the auto-suggest engine itself always chooses a
// sowMonth for a non-existing entry in the first place.
function forwardOnlyOffset(m: number, originMonth: number): number {
  return ((m - originMonth) % 12 + 12) % 12;
}

/**
 * Every visible copy of a sow→harvest span, in display-column space, clipped
 * to the DISPLAY_MONTHS-column window. `harvest` is always the crop's OWN
 * forward span from `sowMonth` (a crop never takes longer than ~12 months, so
 * this offset is unambiguous regardless of "today"); `sowOffset` is the
 * CALLER's already-resolved position of the sow event itself
 * (nearest-direction for an existing crop, forward-only otherwise — see
 * nearestSignedOffset/forwardOnlyOffset above).
 *
 * WHY MORE THAN ONE COPY: this plan holds no year field anywhere — it is a
 * single annual cycle that recurs until the farmer re-runs auto-suggest with
 * Rotate crops on (the caption under the grid has always said so). Drawing
 * each planting exactly once was therefore an under-drawing of the plan, not
 * a faithful one, and it is what made the far columns look barren: a sow
 * offset is forced into 0-11, so nothing could ever START past column 11 and
 * the tail of the window could only ever hold leftovers. Repeating the cycle
 * every 12 columns fills those months with what actually happens in them.
 *
 * Only FORWARD repeats (cycle >= 0). A backward repeat would put crops in the
 * ground at column 0 that this plan never sowed — the establishment-year lie
 * tracked separately as "the printed plan has no first year". The left edge
 * stays honestly "from today"; it is the right edge this fixes.
 *
 * Returns [] if no copy lands in the window (a long-since-harvested existing
 * crop, or a genuinely far-future manual entry).
 */
function barInstances(sowOffset: number, sowMonth: number, harvest: number): Segment[] {
  const spanMonths = ((harvest - sowMonth) % 12 + 12) % 12; // crop's own forward duration, 0-11
  const out: Segment[] = [];
  for (let cycle = 0; sowOffset + cycle * 12 <= DISPLAY_MONTHS - 1; cycle++) {
    const rawStart = sowOffset + cycle * 12;
    const start = Math.max(rawStart, 0);
    const end = Math.min(rawStart + spanMonths, DISPLAY_MONTHS - 1);
    if (end >= start) out.push({ start, end, rawStart });
  }
  return out;
}

const COL_PCT = 100 / DISPLAY_MONTHS;
// Segment values are already clipped display-column indices, so
// position/width are now a plain, always-safe index calculation.
const leftPct = (idx: number) => idx * COL_PCT;
const widthPct = (seg: Segment) => (seg.end - seg.start + 1) * COL_PCT;

/** Linear-interpolate between two '#rrggbb' hex colours, t clamped to [0,1]. */
function lerpHex(a: string, b: string, t: number): string {
  const c = Math.max(0, Math.min(1, t));
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  const mix = pa.map((v, i) => Math.round(v + (pb[i] - v) * c));
  return `#${mix.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * CSS gradient for one bar segment, representing its slice of the OVERALL
 * sow→harvest span (not just the segment alone) — so a wrapped bar (e.g.
 * Nov→Feb, drawn as two DOM pieces either side of the Dec/Jan seam) still
 * reads as one continuous "growing → ready to harvest" fade across both.
 */
function barGradient(seg: Segment, sowMonth: number, totalMonths: number, from: string, to: string): string {
  const startFrac = ((seg.start - sowMonth + 12) % 12) / totalMonths;
  const endFrac = (((seg.end - sowMonth + 12) % 12) + 1) / totalMonths;
  return `linear-gradient(to right, ${lerpHex(from, to, startFrac)}, ${lerpHex(from, to, endFrac)})`;
}

/**
 * 2026-07-14: Rory asked to try a Tend-style flat colour + boundary line
 * instead of the smooth growing→harvest gradient blend (the gradient reads
 * as smudgy at a glance; a solid block + a crisp "ready" marker line reads
 * faster). `barGradient`/`lerpHex` above are kept fully intact — flip this
 * one constant back to 'gradient' to revert instantly if the solid style
 * doesn't work out in practice.
 */
const BAR_STYLE: 'gradient' | 'solid' = 'solid';

const VIRTUAL_BED: PlanBed = { id: 'virtual-bed-1', label: 'Bed 1', areaM2: 10 };

/**
 * A saved cloud design's items/lines already carry wM/hM in real metres
 * regardless of geomVersion (only x/y/points differ between px-v1 and
 * metres-v2) — so no coordinate conversion is needed just to read bed areas
 * and the site info. Only the fields the crop planner actually reads.
 */
function designStateFromCloudRow(d: Design): FacilitatorDesignState {
  const data = (d.data ?? {}) as Partial<FacilitatorDesignState>;
  return {
    version: 1,
    items: data.items ?? [],
    lines: data.lines ?? [],
    sectors: data.sectors ?? [],
    pxPerM: data.pxPerM ?? 26,
    activeLayer: data.activeLayer ?? 'base',
    hiddenLayers: data.hiddenLayers ?? [],
    title: d.title,
    bgSite: data.bgSite ?? undefined,
    savedAt: Date.now(),
  };
}

/** Beds = design items of type 'bed'/'hugel', in placement (array) order. */
function computeDesignBeds(state: FacilitatorDesignState | null): PlanBed[] {
  if (!state) return [];
  const beds: PlanBed[] = [];
  let bedN = 0;
  let hugelN = 0;
  for (const it of state.items) {
    if (it.type === 'bed') {
      bedN += 1;
      beds.push({ id: it.id, label: `Bed ${bedN}`, areaM2: (it.wM || 1) * (it.hM || 1), minDimM: Math.min(it.wM || 1, it.hM || 1) });
    } else if (it.type === 'hugel') {
      hugelN += 1;
      beds.push({ id: it.id, label: `Hügel ${hugelN}`, areaM2: (it.wM || 1) * (it.hM || 1), minDimM: Math.min(it.wM || 1, it.hM || 1) });
    }
  }
  return beds;
}

const PATTERN_META: Record<RainPattern, { icon: string; label: string }> = {
  summer: { icon: '☀️', label: 'Summer rainfall' },
  winter: { icon: '🌧️', label: 'Winter rainfall' },
  'all-year': { icon: '🌦️', label: 'All-year rainfall' },
  'mild-frost': { icon: '🌤️', label: 'Summer rainfall · mild winter frost' },
};

// ── Page ─────────────────────────────────────────────────────────────────

function FacilitatorCropsPageInner() {
  // Deep-link entry from the Design Studio Simple Path: ?canvasSite=<siteId> feeds
  // beds straight from the DesignCanvasState (via the bridge) instead of the
  // facilitator/Firestore design picker; &auto=1 opens the auto-suggest
  // questionnaire once beds are loaded. Absent → behaviour 100% unchanged.
  const searchParams = useSearchParams();
  const canvasSiteParam = searchParams.get('canvasSite');
  const autoParam = searchParams.get('auto');

  // FALLBACK when no ?canvasSite (home progress card, task board, nav drawer, /cropplan, /plan
  // all link here bare): use the MAIN saved place's Design-Studio canvas if it has beds. Without
  // this, a farmer who designed beds in /design and tapped 'Plan your crops' from Home landed on
  // 'No beds designed yet' with a back-link to the OLD canvas — the flow audit's worst blocker.
  const [fallbackCanvasSite, setFallbackCanvasSite] = useState<string | null>(null);
  useEffect(() => {
    if (canvasSiteParam) return;
    try {
      const main = resolveMainSite(loadPlaces());
      if (!main) return;
      const sid = `site:${main.lat.toFixed(5)},${main.lon.toFixed(5)}`;
      if (bedsFromDesignCanvas(loadCanvasState(sid)).length > 0) setFallbackCanvasSite(sid);
    } catch { /* corrupt cache — legacy behaviour stands */ }
  }, [canvasSiteParam]);
  const canvasSite = canvasSiteParam ?? fallbackCanvasSite;

  // The saved place's own name, for the printed plan's cover. Beds coming from
  // the Design Studio canvas carry no design title at all, so without this a
  // farmer's printout is headed "Garden design" while every other screen calls
  // it by name. `site:<lat>,<lon>` is the canvas key format built above.
  const [placeName, setPlaceName] = useState<string | null>(null);
  useEffect(() => {
    if (!canvasSite?.startsWith('site:')) return;
    try {
      const [lat, lon] = canvasSite.slice(5).split(',');
      const match = loadPlaces().find((p) => p.lat.toFixed(5) === lat && p.lon.toFixed(5) === lon);
      if (match?.name) setPlaceName(match.name);
    } catch { /* corrupt cache — the design title stands */ }
  }, [canvasSite]);
  // "Back to design" always means the NEW Design Studio — the flow audit caught these links
  // pointing at the legacy /facilitator canvas, which made farmers think their design vanished.
  const designHref = canvasSite?.startsWith('site:')
    ? `/design?lat=${canvasSite.slice(5).split(',')[0]}&lon=${canvasSite.slice(5).split(',')[1]}`
    : '/design';

  const [design, setDesign] = useState<FacilitatorDesignState | null | undefined>(undefined);
  // Beds read from the Design Studio canvas when arriving via ?canvasSite.
  const [canvasBeds, setCanvasBeds] = useState<PlanBed[]>([]);
  const [plan, setPlan] = useState<CropPlanState | null>(null);
  // One-level-per-action undo, mirroring FacilitatorCanvas's own pushHistory
  // pattern — mainly for undoing a whole auto-suggested batch in one tap
  // instead of deleting every planting by hand, but it covers manual
  // add/edit/remove too since they all go through the same mutating
  // functions below. Capped so it can't grow unbounded across a long session.
  const [planHistory, setPlanHistory] = useState<CropPlanState[]>([]);
  const PLAN_HISTORY_LIMIT = 10;
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [useVirtual, setUseVirtual] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  const [pickerBedId, setPickerBedId] = useState<string | null>(null);
  const [showBedCheck, setShowBedCheck] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCrop, setPickerCrop] = useState<CropDef | null>(null);
  const [pickerMonth, setPickerMonth] = useState(1);
  const [pickerFraction, setPickerFraction] = useState(1);
  const [pickerExisting, setPickerExisting] = useState(false);
  // Set when the picker was opened via "Edit" on an existing planting rather
  // than "+ crop" on a bed — confirmAdd checks this to update in place.
  const [editingPlantingId, setEditingPlantingId] = useState<string | null>(null);

  const [activePlanting, setActivePlanting] = useState<Planting | null>(null);

  // Auto-suggest — a short goals questionnaire that generates a proposed
  // plan (via lib/crop-autosuggest.ts, a deterministic rules engine — no
  // network call). Reviewed before anything is saved; never replaces
  // existing plantings, only adds to them (safe to re-run).
  const [autoPhase, setAutoPhase] = useState<'idle' | 'questions' | 'review'>('idle');
  const [aGoal, setAGoal] = useState<GardenGoal>('family');
  const [aHousehold, setAHousehold] = useState<HouseholdSize>('medium');
  const [aFocusCount, setAFocusCount] = useState(1);
  const [aGroups, setAGroups] = useState<FoodGroup[]>(ALL_GROUPS);
  const [aRhythm, setARhythm] = useState<HarvestRhythm>('steady');
  // Default on — good rotation practice, and it's how "plan for next season
  // too" actually works here: there's no separate multi-year planner, but a
  // rotation-aware plan today naturally leaves next season's beds able to
  // rotate correctly once you run this again with today's plantings still
  // showing (see the toggle's own blurb in the modal for the honest caveat).
  const [aRotateCrops, setARotateCrops] = useState(true);
  // Default off — a vine dedicating a whole veg bed for months, filling it
  // with nothing else all year, is a bad outcome for precious rotational bed
  // space. Off by default = recommend a dedicated plot/edge/food-forest area
  // instead; the farmer has to actively opt in to place one in a veg bed.
  const [aAllowVinesInBeds, setAAllowVinesInBeds] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoSuggestResult | null>(null);

  function openAutoSuggest() {
    setAGoal('family');
    setAHousehold('medium');
    setAFocusCount(1);
    setAGroups(ALL_GROUPS); // family default = all checked (diversify); commercial flips this on toggle
    setARhythm('steady');
    setARotateCrops(true);
    setAAllowVinesInBeds(false);
    setAutoResult(null);
    setAutoPhase('questions');
  }
  function chooseGoal(g: GardenGoal) {
    setAGoal(g);
    setAGroups(g === 'commercial' ? [] : ALL_GROUPS); // commercial starts empty — must actively concentrate
  }
  function toggleGroup(g: FoodGroup) {
    setAGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }
  function runAutoSuggest() {
    const answers: AutoSuggestAnswers = {
      goal: aGoal,
      householdSize: aGoal !== 'commercial' ? aHousehold : undefined,
      focusCropCount: aGoal !== 'family' ? aFocusCount : undefined,
      groups: aGroups,
      rhythm: aRhythm,
      rotateCrops: aRotateCrops,
      allowVinesInBeds: aAllowVinesInBeds,
    };
    setAutoResult(autoSuggestPlan(answers, pattern, beds, plantings, currentMonth));
    setAutoPhase('review');
  }
  // Snapshot the plan as it stood BEFORE a mutation, onto the undo stack —
  // called at the top of every plan-mutating action below. No-ops on an
  // empty plan (nothing to undo back to).
  function pushPlanHistory() {
    if (!plan) return;
    setPlanHistory((prev) => [...prev.slice(-(PLAN_HISTORY_LIMIT - 1)), plan]);
  }
  function undoLastChange() {
    if (!planHistory.length) return;
    setPlan(planHistory[planHistory.length - 1]);
    setPlanHistory((prev) => prev.slice(0, -1));
  }
  function acceptAutoSuggest() {
    if (!autoResult) return;
    pushPlanHistory();
    setPlan((prev) => {
      const base = prev ?? { version: 1 as const, plantings: [], updatedAt: Date.now() };
      return { version: 1, plantings: [...base.plantings, ...autoResult.plantings], updatedAt: Date.now() };
    });
    // Clear immediately (not just close the modal) — a second click landing
    // before React re-renders would otherwise still see a non-null
    // autoResult and append the same suggestions twice.
    setAutoResult(null);
    setAutoPhase('idle');
  }

  // Site picker — only matters once there's real ambiguity (2+ saved cloud
  // designs); with 0 or 1, behaviour is unchanged (straight to the device's
  // local design, same as before this feature existed).
  const [myDesignsList, setMyDesignsList] = useState<Design[] | null>(null);
  const [chosenDesignId, setChosenDesignId] = useState<string | null>(null);
  // Reopened on demand (e.g. "switch site") so the picker acts as a proper
  // crop-planning landing page you can always get back to, not just a
  // one-time gate on first load.
  const [switchingSite, setSwitchingSite] = useState(false);
  // When beds come from the Design Studio (?canvasSite) the facilitator/Firestore
  // picker is bypassed entirely — there's exactly one source of beds.
  const needsSitePicker = !canvasSite && !!myDesignsList && (switchingSite || (myDesignsList.length > 1 && chosenDesignId === null));

  const [favouriteCropKeys, setFavouriteCropKeys] = useState<Set<string>>(new Set());
  function toggleFavourite(cropKey: string) {
    setFavouriteCropKeys((prev) => {
      const next = new Set(prev);
      if (next.has(cropKey)) next.delete(cropKey); else next.add(cropKey);
      saveFavouriteCropKeys(next);
      return next;
    });
  }

  // Off by default — sharing a bed between crops (intercropping, or just a
  // manual split) needs a bit of gardening judgement, so it's a one-time
  // opt-in rather than offered unprompted on every crop added (same
  // reasoning as space-hungry vines defaulting to "grow elsewhere").
  const [allowBedSharing, setAllowBedSharing] = useState(false);
  const [showLookingAhead, setShowLookingAhead] = useState(false);
  const monthHeaderScrollRef = useRef<HTMLDivElement>(null);
  const bedRowsScrollRef = useRef<HTMLDivElement>(null);
  function toggleAllowBedSharing() {
    setAllowBedSharing((prev) => {
      const next = !prev;
      saveAllowBedSharing(next);
      return next;
    });
  }

  // Farmer edits to the researched default retail/wholesale prices (see
  // lib/crop-prices.ts) — persisted so a correction sticks across sessions.
  const [priceOverrides, setPriceOverrides] = useState<Record<string, CropPrice>>({});
  function updatePriceOverride(cropKey: string, price: CropPrice) {
    setPriceOverrides((prev) => {
      const next = { ...prev, [cropKey]: price };
      saveCropPriceOverrides(next);
      return next;
    });
  }

  // Cashflow view settings — % of harvestable value actually sold (the rest
  // feeds the household) and % assumed lost to disease/failure/underperformance
  // before it ever becomes harvestable. No default loss (0%) — inventing a
  // "typical" loss rate isn't something to guess at; it's the farmer's own
  // estimate to set.
  const [cashflowSettings, setCashflowSettings] = useState<CashflowSettings>({ sellPercent: 100, lossPercent: 0 });
  function updateCashflowSettings(next: CashflowSettings) {
    setCashflowSettings(next);
    saveCashflowSettings(next);
  }

  // Estimated-harvest box view — defaults to per-crop since that's the more
  // commonly wanted read ("how much tomato will I get"), with per-bed as the
  // other view of the exact same underlying total (see yieldByCrop's doc comment).
  const [harvestBoxView, setHarvestBoxView] = useState<'crop' | 'bed'>('crop');

  useEffect(() => {
    setDesign(loadFacilitatorState());
    setPlan(loadCropPlan());
    setCurrentMonth(new Date().getMonth() + 1);
    setFavouriteCropKeys(loadFavouriteCropKeys());
    setAllowBedSharing(loadAllowBedSharing());
    setPriceOverrides(loadCropPriceOverrides());
    setCashflowSettings(loadCashflowSettings());
    setMounted(true);
    myDesigns().then(setMyDesignsList).catch(() => setMyDesignsList([]));
  }, []);

  // Live bed feed from the Design Studio canvas when arriving via ?canvasSite —
  // loads on mount and re-reads on every canvas change (mirrors how the planner
  // reloads facilitator state), so placing another bed in the Studio (another
  // tab) refreshes the bed list here without a reload.
  useEffect(() => {
    if (!canvasSite) return;
    const refresh = () => setCanvasBeds(bedsFromDesignCanvas(loadCanvasState(canvasSite)));
    refresh();
    window.addEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(DESIGN_CANVAS_CHANGED_EVENT, refresh);
  }, [canvasSite]);

  function chooseSite(id: string) {
    setChosenDesignId(id);
    setSwitchingSite(false);
    if (id === 'local') return; // keep the device's local design already loaded above
    const row = myDesignsList?.find((d) => d.id === id);
    if (row) setDesign(designStateFromCloudRow(row));
  }

  // Debounced persistence — saves ~400ms after the last edit.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!plan) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveCropPlan(plan), 400);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [plan]);

  const designBeds = useMemo(() => computeDesignBeds(design ?? null), [design]);
  const beds = canvasSite
    ? canvasBeds
    : (designBeds.length > 0 ? designBeds : (useVirtual ? [VIRTUAL_BED] : []));

  // ?canvasSite carries the real lat/lon in its "site:<lat>,<lon>" form (5 dp) —
  // parse it so the Simple-Path plan uses the correct rainfall pattern rather
  // than whatever facilitator design happens to be cached on the device.
  const canvasLatLon = useMemo(() => {
    if (!canvasSite) return null;
    const m = /^site:(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/.exec(canvasSite);
    if (!m) return null;
    const lat = parseFloat(m[1]);
    const lon = parseFloat(m[2]);
    return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
  }, [canvasSite]);

  const region = canvasLatLon
    ? nearestRainfall(canvasLatLon.lat, canvasLatLon.lon)
    : (design?.bgSite ? nearestRainfall(design.bgSite.lat, design.bgSite.lon) : null);

  // ?canvasSite&auto=1 → open the auto-suggest questionnaire once, as soon as at
  // least one bed has loaded. Ref-guarded so a bed refresh (canvas-change event)
  // can't reopen it after the farmer has moved on.
  const autoParamHandled = useRef(false);
  useEffect(() => {
    if (autoParamHandled.current) return;
    if (!mounted || autoParam !== '1' || beds.length < 1) return;
    autoParamHandled.current = true;
    openAutoSuggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, autoParam, beds.length]);
  // A region flagged 'mild' frostRisk (e.g. Durban's coastal hinterland) still
  // gets the same warm-season windows as plain 'summer' — those crops don't
  // shrug off even light frost — but frost-hardy crops get 'mild-frost'
  // windows (as forgiving as 'all-year') instead of sitting idle May-Aug.
  const pattern: RainPattern =
    region?.frostRisk === 'mild' && region.pattern === 'summer' ? 'mild-frost' : (region?.pattern ?? 'summer');
  const patternMeta = PATTERN_META[pattern];
  const designTitle = design?.title || design?.bgSite?.name || 'Garden design';

  // Plantings whose bed no longer exists in the current design (a bed was
  // deleted/replaced since they were added) are dropped from every computed
  // view — they'd otherwise surface as a confusing "Unknown bed" in tasks/
  // yield/BOQ/report while already being invisible on the bed grid itself
  // (each BedRow only ever shows plantings matching its OWN bed.id). The
  // underlying plan.plantings array is left untouched, only this derived
  // read is filtered, so nothing is actually deleted.
  const plantings = useMemo(() => {
    const bedIds = new Set(beds.map((b) => b.id));
    return (plan?.plantings ?? []).filter((p) => bedIds.has(p.bedId));
  }, [plan, beds]);
  const bedAreaFor = (bedId: string) => beds.find((b) => b.id === bedId)?.areaM2 ?? 0;

  function addPlanting(bedId: string, cropKey: string, sowMonth: number, areaFraction: number, existing: boolean) {
    pushPlanHistory();
    setPlan((prev) => {
      const base = prev ?? { version: 1 as const, plantings: [], updatedAt: Date.now() };
      const next: Planting = {
        id: genId('pl'), bedId, cropKey, sowMonth,
        areaFraction: areaFraction < 1 ? areaFraction : undefined,
        existing: existing || undefined,
      };
      return { version: 1, plantings: [...base.plantings, next], updatedAt: Date.now() };
    });
  }
  function updatePlanting(id: string, cropKey: string, sowMonth: number, areaFraction: number, existing: boolean) {
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        version: 1,
        plantings: prev.plantings.map((p) => p.id === id
          ? { ...p, cropKey, sowMonth, areaFraction: areaFraction < 1 ? areaFraction : undefined, existing: existing || undefined }
          : p),
        updatedAt: Date.now(),
      };
    });
  }
  function removePlanting(id: string) {
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      return { version: 1, plantings: prev.plantings.filter((p) => p.id !== id), updatedAt: Date.now() };
    });
  }
  // Swap a planting for a different crop in place (same bed/fraction/
  // existing-flag) — re-derives the sow month for the NEW crop nearest the
  // old one's, since the replacement crop's own valid sow window may not
  // include the original month at all.
  function replacePlanting(id: string, newCropKey: string) {
    const p = plantings.find((pl) => pl.id === id);
    const newCrop = cropByKey(newCropKey);
    if (!p || !newCrop) return;
    const sowMonth = nextValidSowMonth(newCrop, pattern, p.sowMonth);
    updatePlanting(id, newCropKey, sowMonth, p.areaFraction ?? 1, !!p.existing);
  }
  // Only drops plantings on beds actually shown right now (matches the
  // `plantings` derived read below) — never touches plantings parked under a
  // bed id that no longer exists in this design, same care as removePlanting.
  function clearAllPlantings() {
    if (!plantings.length) return;
    if (!window.confirm(`Clear all ${plantings.length} planting${plantings.length > 1 ? 's' : ''} from every bed? You can undo this once right after.`)) return;
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      const bedIds = new Set(beds.map((b) => b.id));
      return { version: 1, plantings: prev.plantings.filter((p) => !bedIds.has(p.bedId)), updatedAt: Date.now() };
    });
  }

  const allTasks = useMemo(() => (mounted ? tasksForPlan(plantings, beds) : []), [mounted, plantings, beds]);
  const nextMonth = wrapMonth(currentMonth + 1);
  const currentTasks = allTasks.filter((t) => t.month === currentMonth);
  const nextTasks = allTasks.filter((t) => t.month === nextMonth);
  // The rolling DISPLAY_MONTHS-month display order — column 0 is always THIS
  // month, not always January, so opening the plan never shows already-past
  // months before anything useful starts. Scrollable out to a full 2 years
  // ahead rather than a hard 12-month wall.
  const monthOrder = useMemo(() => Array.from({ length: DISPLAY_MONTHS }, (_, i) => wrapMonth(currentMonth + i)), [currentMonth]);
  // The resilience chart and the "Looking ahead" task list keep the shorter
  // window. Both are ANNUAL readings — "what does a year of this plan put on
  // the table", "what do I do next" — and a second identical copy of every
  // month would add a repeated task list and a mirrored chart, neither of
  // which tells the farmer anything the first year didn't. Only the timeline
  // needs the repeat, because only the timeline has bars that wrap.
  const chartMonthOrder = useMemo(() => Array.from({ length: CHART_MONTHS }, (_, i) => wrapMonth(currentMonth + i)), [currentMonth]);

  const totalYieldKg = plantings.reduce((sum, p) => sum + estimatedYieldKgAdjusted(p, bedAreaFor(p.bedId), plantings), 0);
  // Already-growing crops are informational (the farmer planted them before
  // using the app) — split them out of the "to plant" total the same way
  // the design map's BOQ keeps existing features out of the budget.
  const existingYieldKg = plantings.filter((p) => p.existing).reduce((sum, p) => sum + estimatedYieldKgAdjusted(p, bedAreaFor(p.bedId), plantings), 0);
  const newYieldKg = totalYieldKg - existingYieldKg;
  const yieldByBed = beds
    .map((b) => ({
      bed: b,
      kg: plantings.filter((p) => p.bedId === b.id).reduce((sum, p) => sum + estimatedYieldKgAdjusted(p, b.areaM2, plantings), 0),
    }))
    .filter((row) => row.kg > 0);
  const yieldByCropList = useMemo(() => yieldByCrop(plantings, beds), [plantings, beds]);
  // Same loss% the Retail/Wholesale value tabs use (cashflowSettings,
  // shared/persisted state) — one loss control for the whole plan, not a
  // second independent slider that could disagree with it.
  const harvestLossFactor = 1 - cashflowSettings.lossPercent / 100;

  const seedBoq = useMemo(() => seedBoqForPlan(plantings, beds), [plantings, beds]);
  const yearReport = useMemo(() => buildYearReport(plantings, beds), [plantings, beds]);
  // TWO honest years, one chart (2026-08-04, Rory: "i want to show what a full years season
  // will look like... i am tired of not seeing a full ideal planting").
  // 'established' omits nowMonth, so the builders fold every planting mod-12 — the plan
  // repeated every year, the steady state a garden grows into. It is the DEFAULT because it
  // is the picture the plan is FOR; a garden starting today inevitably shows near-empty
  // early months, which reads as a broken plan rather than a young one.
  // 'fromToday' passes currentMonth so the aggregations drop the ALREADY-FINISHED months of
  // existing crops — without that, a crop sown last March stamps Mar-May as occupied forever
  // and utilization reads 100% over beds the Gantt correctly shows empty.
  const [yearMode, setYearMode] = useState<'established' | 'fromToday'>('established');
  const chartNowMonth = yearMode === 'fromToday' ? currentMonth : undefined;
  const foodAvailability = useMemo(() => buildFoodAvailability(plantings, beds, chartNowMonth), [plantings, beds, chartNowMonth]);
  const foodValueByMonth = useMemo(() => buildFoodValueByMonth(plantings, beds, priceOverrides, chartNowMonth), [plantings, beds, priceOverrides, chartNowMonth]);
  const fieldUtilizationByMonth = useMemo(() => buildFieldUtilizationByMonth(plantings, beds, chartNowMonth), [plantings, beds, chartNowMonth]);

  // Cover-page facts for the printed plan and the calendar's name. Built from
  // the same values the header and the bed-check strip already show, so the
  // paper copy can't claim a different garden from the screen.
  const exportMeta = useMemo(() => {
    const plotCount = beds.filter((b) => b.kind === 'plot').length;
    const bedCount = beds.length - plotCount;
    return {
      planTitle: (canvasSite ? placeName : null) ?? designTitle,
      siteLine: region ? `${region.name} · ${patternMeta.label}` : `No site set · assuming ${patternMeta.label.toLowerCase()}`,
      // The same two facts as separate values, because the PDF needs them apart and recovering
      // them by splitting siteLine printed "Climate: Not set" for every region in the country.
      locationLine: region ? region.name : 'No site set',
      climateLine: region ? patternMeta.label : `Assuming ${patternMeta.label.toLowerCase()}`,
      bedsSummary: `${bedCount} bed${bedCount === 1 ? '' : 's'}`
        + `${plotCount ? ` · ${plotCount} staple plot${plotCount === 1 ? '' : 's'}` : ''}`
        + ` · ${beds.reduce((s, b) => s + b.areaM2, 0).toFixed(1)} m² of growing space`,
      dateLabel: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }),
      estimatedKgPerYear: newYieldKg * harvestLossFactor,
      lossPercent: cashflowSettings.lossPercent,
    };
  }, [beds, canvasSite, placeName, designTitle, region, patternMeta, newYieldKg, harvestLossFactor, cashflowSettings.lossPercent]);

  function shareTasks() {
    const text = `🌱 Crop plan tasks\n${monthLabel(currentMonth)}: ${taskSentence(currentTasks)}\n${monthLabel(nextMonth)}: ${taskSentence(nextTasks)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function openPicker(bedId: string) {
    setEditingPlantingId(null);
    setPickerBedId(bedId);
    setPickerSearch('');
    setPickerCrop(null);
    setPickerFraction(1);
    setPickerExisting(false);
  }
  // Reopens the same picker pre-filled with an existing planting's values —
  // the crop is already set so the modal opens straight on the detail view
  // (the crop-search list only shows when pickerCrop is null), skipping the
  // "pick a crop" step. confirmAdd below detects editingPlantingId and
  // updates in place instead of creating a new planting.
  function openEditPicker(p: Planting) {
    const crop = cropByKey(p.cropKey);
    if (!crop) return;
    setEditingPlantingId(p.id);
    setPickerBedId(p.bedId);
    setPickerSearch('');
    setPickerCrop(crop);
    setPickerMonth(p.sowMonth);
    setPickerFraction(p.areaFraction ?? 1);
    setPickerExisting(!!p.existing);
  }
  function closePicker() {
    setPickerBedId(null);
    setPickerCrop(null);
    setEditingPlantingId(null);
  }
  function pickCrop(crop: CropDef) {
    setPickerCrop(crop);
    setPickerMonth(nextValidSowMonth(crop, pattern, currentMonth));
    // Space-hungry crops default to their own whole bed rather than a split —
    // the recommendation is enforced as a sane default, not a hard block.
    setPickerFraction(isSpaceHungry(crop) ? 1 : pickerFraction);
  }
  function confirmAdd() {
    if (!pickerBedId || !pickerCrop) return;
    if (editingPlantingId) {
      updatePlanting(editingPlantingId, pickerCrop.key, pickerMonth, pickerFraction, pickerExisting);
    } else {
      addPlanting(pickerBedId, pickerCrop.key, pickerMonth, pickerFraction, pickerExisting);
    }
    closePicker();
  }
  // Overlap warning: how much of the bed is already committed (by OTHER
  // plantings whose sow→harvest window overlaps this one) before adding this
  // one — shown as a soft nudge, never a hard block.
  const pickerOverlap = useMemo(() => {
    if (!pickerBedId || !pickerCrop) return 0;
    const harvest = harvestMonth(pickerMonth, pickerCrop.daysToHarvest);
    // Exclude the planting being edited from its own overlap check — otherwise
    // editing would always see itself as "already committed" on this bed.
    return bedOverlapFraction(pickerBedId, pickerMonth, harvest, plantings, editingPlantingId ?? undefined);
  }, [pickerBedId, pickerCrop, pickerMonth, plantings, editingPlantingId]);

  const loading = design === undefined || plan === null || !mounted;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-x-auto" style={{ height: 56, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="flex-shrink-0 flex items-center justify-center rounded-xl"
          style={{ width: 34, height: 34, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
        >
          <Menu size={17} strokeWidth={1.7} />
        </button>
        <Link
          href="/home"
          aria-label="Home"
          title="Home"
          className="flex-shrink-0 flex items-center justify-center rounded-xl"
          style={{ width: 34, height: 34, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', textDecoration: 'none' }}
        >
          <Home size={16} strokeWidth={1.7} />
        </Link>
        <Link
          href={designHref}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
          style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#20190F', textDecoration: 'none' }}
        >
          ‹ Back to design
        </Link>
        {!canvasSite && myDesignsList && myDesignsList.length > 0 && (
          <button
            onClick={() => setSwitchingSite(true)}
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
            style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#20190F', cursor: 'pointer' }}
            title="Switch to a different design's crop plan"
          >
            ‹ All crop plans
          </button>
        )}
        <div className="w-px h-5 flex-shrink-0" style={{ background: '#E2D8C4' }} />
        {!canvasSite && myDesignsList && myDesignsList.length > 0 ? (
          <button
            onClick={() => setSwitchingSite(true)}
            className="flex-shrink-0 flex items-center gap-1.5 min-w-0"
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left' }}
          >
            <div className="flex flex-col min-w-0">
              <span className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>Crop plan</span>
              <span className="font-sans truncate" style={{ fontSize: 11, color: '#8C7A62', maxWidth: 220 }}>{designTitle}</span>
            </div>
            <ChevronDown size={13} style={{ color: '#9A8268', flexShrink: 0 }} />
          </button>
        ) : (
          <div className="flex flex-col min-w-0 flex-shrink-0">
            <span className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>Crop plan</span>
            <span className="font-sans truncate" style={{ fontSize: 11, color: '#8C7A62', maxWidth: 220 }}>
              {canvasSite ? 'Beds from your Design Studio map' : designTitle}
            </span>
          </div>
        )}
        <div className="flex-1" />
        {beds.length > 0 && (
          <button
            onClick={() => setShowBedCheck((v) => !v)}
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans font-semibold"
            title="Check the beds and plots this plan is using — count, sizes and where they came from"
            style={{
              fontSize: 12, cursor: 'pointer',
              background: showBedCheck ? '#1F4D2B' : '#F5F0E8',
              color: showBedCheck ? '#F7F2E9' : '#5C5040',
              border: `1px solid ${showBedCheck ? '#1F4D2B' : '#E2D8C4'}`,
            }}
          >
            📐 {beds.filter((b) => b.kind !== 'plot').length} beds{beds.some((b) => b.kind === 'plot') ? ` · ${beds.filter((b) => b.kind === 'plot').length} plots` : ''}
          </button>
        )}
        <LessonLink id="crops:planner" label="Learn" />
        {region ? (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans" style={{ fontSize: 12, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.18)' }}>
            {patternMeta.icon} {region.name} · {patternMeta.label}
          </span>
        ) : (
          <span className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans" style={{ fontSize: 12, background: '#F5F0E8', color: '#8C7A62', border: '1px solid #E2D8C4' }}>
            {patternMeta.icon} No site set · assuming {patternMeta.label.toLowerCase()}
          </span>
        )}
      </header>

      {/* Bed check — "button or clicker... to verify number and size" (Rory, 2026-08-03).
          Reads the SAME beds array the plan itself uses, so what it lists is by
          construction what the engine plans over — no separate lookup to drift. */}
      {showBedCheck && beds.length > 0 && (
        <div className="flex-shrink-0 px-4 py-3" style={{ background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
          <div className="font-sans mb-2" style={{ fontSize: 11.5, color: '#5C5040' }}>
            This plan grows on{' '}
            <strong style={{ color: '#20190F' }}>
              {beds.filter((b) => b.kind !== 'plot').length} bed{beds.filter((b) => b.kind !== 'plot').length === 1 ? '' : 's'}
              {beds.some((b) => b.kind === 'plot') ? ` and ${beds.filter((b) => b.kind === 'plot').length} staple plot${beds.filter((b) => b.kind === 'plot').length === 1 ? '' : 's'}` : ''}
            </strong>{' '}
            — {beds.reduce((s, b) => s + b.areaM2, 0).toFixed(1)} m² of growing space
            {canvasSite ? ', traced in your Design Studio map. Resize or add beds there and they update here.' : '.'}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {beds.map((b) => (
              <span
                key={b.id}
                className="font-mono inline-flex items-center gap-1 px-2 py-1 rounded-lg"
                style={{ fontSize: 11, color: '#20190F', background: '#FFFEFA', border: `1px solid ${b.kind === 'plot' ? '#E0CD9E' : '#E2D8C4'}` }}
              >
                {b.kind === 'plot' ? '🌽' : '🌱'} {b.label} · {b.areaM2.toFixed(1)} m²
                {b.minDimM !== undefined ? ` · ${b.minDimM.toFixed(1)}m wide` : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <span className="font-display text-sm" style={{ color: '#8C7A62' }}>Loading crop plan…</span>
        </div>
      ) : needsSitePicker ? (
        <div className="flex-1 overflow-y-auto flex items-start justify-center py-8 px-4">
          <div className="w-full space-y-2" style={{ maxWidth: 480 }}>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display font-semibold" style={{ fontSize: 18, color: '#20190F' }}>Which site are you planning?</h1>
              {chosenDesignId !== null && (
                <button
                  onClick={() => setSwitchingSite(false)}
                  aria-label="Cancel"
                  className="flex-shrink-0 flex items-center justify-center rounded-full"
                  style={{ width: 28, height: 28, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <p className="font-sans mb-3" style={{ fontSize: 13, color: '#5C5040' }}>You have {myDesignsList?.length} saved designs — pick one to see its beds.</p>
            {myDesignsList?.map((d) => (
              <button
                key={d.id}
                onClick={() => chooseSite(d.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left transition-all"
                style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
              >
                <span className="font-display font-semibold" style={{ fontSize: 14, color: '#20190F' }}>{d.title || 'Untitled design'}</span>
                <span className="font-sans" style={{ fontSize: 11, color: '#9A8268' }}>›</span>
              </button>
            ))}
            <button
              onClick={() => chooseSite('local')}
              className="w-full px-4 py-3 rounded-xl text-left font-sans transition-all"
              style={{ background: 'transparent', border: '1px dashed #C7BCA6', color: '#8C7A62', fontSize: 13 }}
            >
              or use whatever design is currently open on this device
            </button>
          </div>
        </div>
      ) : beds.length === 0 ? (
        <EmptyState onVirtual={() => setUseVirtual(true)} designHref={designHref} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-3 md:px-5 py-4" style={{ maxWidth: 1100 }}>
            {useVirtual && designBeds.length === 0 && (
              <div className="mb-3 px-3 py-2 rounded-xl font-sans" style={{ fontSize: 12, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                Planning without a map — one virtual 10 m² bed.{' '}
                <Link href={designHref} style={{ color: '#1F4D2B', textDecoration: 'underline' }}>Place real beds on the Planting step</Link> to replace it.
              </div>
            )}

            <div className="flex gap-2 mb-3">
              <button
                onClick={openAutoSuggest}
                className="flex-1 py-2.5 rounded-xl font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                style={{ fontSize: 13, background: 'rgba(31,77,43,0.10)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B', cursor: 'pointer' }}
              >
                ✨ Auto-suggest a plan
              </button>
              {planHistory.length > 0 && (
                <button
                  onClick={undoLastChange}
                  className="px-4 py-2.5 rounded-xl font-display font-semibold transition-all inline-flex items-center justify-center gap-1"
                  style={{ fontSize: 13, background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
                  title="Undo the last change to this plan"
                >
                  ↩ Undo
                </button>
              )}
              {plantings.length > 0 && (
                <button
                  onClick={clearAllPlantings}
                  className="px-4 py-2.5 rounded-xl font-display font-semibold transition-all inline-flex items-center justify-center gap-1"
                  style={{ fontSize: 13, background: '#FFFFFF', border: '1px solid rgba(179,58,58,0.3)', color: '#B33A3A', cursor: 'pointer' }}
                  title="Clear every planting from this plan"
                >
                  🗑 Clear all
                </button>
              )}
            </div>

            {/* Timeline. The month header and the bed-rows body are TWO
                separate horizontal-scroll regions kept in sync by JS
                (headerScrollRef mirrors bodyScrollRef's scrollLeft on every
                scroll), not one shared overflow-x:auto wrapper. This is
                deliberate, not an oversight: position:sticky only tracks the
                real page scroll if NO ancestor between it and the page has
                overflow set to anything but 'visible' — but overflow-x:auto
                on a shared wrapper implicitly forces overflow-y:auto too
                (CSS spec: a 'visible'/non-'visible' pair on the two axes
                isn't allowed, the visible one is promoted), which silently
                turns that wrapper into the sticky row's containing block
                instead of the page — so the header would scroll away with
                the body instead of freezing, exactly the bug this fixes. */}
            <div className="rounded-2xl mb-5" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
              {/* Month header row — sticky top so it stays visible past many
                  bed rows; the Bed-label cell below keeps its own
                  sticky-left independently, so both axes pin correctly. */}
              <div
                className="flex"
                style={{ borderBottom: '1px solid #E2D8C4', position: 'sticky', top: 52, zIndex: 3, background: '#FFFEFA', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
              >
                <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#FFFEFA', borderRight: '1px solid #E2D8C4', padding: '8px 10px' }}>
                  <span className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Bed</span>
                </div>
                <div
                  ref={monthHeaderScrollRef}
                  className="flex-1"
                  style={{ overflowX: 'hidden' }}
                >
                  <div className="flex" style={{ minWidth: GRID_MIN_WIDTH - 128 }}>
                    {monthOrder.map((m, i) => (
                      <div
                        key={i}
                        className="text-center font-sans"
                        style={{
                          flex: 1, padding: '8px 2px', fontSize: 11,
                          fontWeight: i === 0 ? 700 : 500,
                          color: i === 0 ? '#1F4D2B' : i >= 12 ? '#A89A82' : '#8C7A62',
                          background: i === 0 ? 'rgba(31,77,43,0.08)' : 'transparent',
                          // A month label repeats every 12 columns (no year field
                          // anywhere in this data model) — a visible seam at the
                          // 1-year mark stops "Jul" (this year) and "Jul" (next
                          // year) reading as the same column.
                          borderLeft: i === 12 ? '2px solid #C4A46A' : undefined,
                        }}
                        title={i >= 12 ? `${MONTHS_SHORT[m - 1]}, next year` : undefined}
                      >
                        {i === 12 ? '↻ ' : ''}{MONTHS_SHORT[m - 1]}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bed rows — the body owns the REAL horizontal scrollbar; its
                  onScroll mirrors scrollLeft onto the header above. */}
              <div
                ref={bedRowsScrollRef}
                onScroll={(e) => {
                  if (monthHeaderScrollRef.current) monthHeaderScrollRef.current.scrollLeft = e.currentTarget.scrollLeft;
                }}
                style={{ overflowX: 'auto' }}
              >
                <div style={{ minWidth: GRID_MIN_WIDTH }}>
                  {beds.map((bed) => (
                    <BedRow
                      key={bed.id}
                      bed={bed}
                      plantings={plantings.filter((p) => p.bedId === bed.id)}
                      currentMonth={currentMonth}
                      onAddCrop={() => openPicker(bed.id)}
                      onTapPlanting={(p) => setActivePlanting(p)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="font-sans mb-5" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.5, marginTop: -12 }}>
              <span
                className="font-sans"
                style={{ fontWeight: 600, color: '#9A6018', border: '1px solid rgba(154,96,24,0.35)', borderRadius: 4, padding: '0 3px', fontSize: 10 }}
              >
                🪴 transplant
              </span>{' '}
              marks the month seedlings raised in a tray move out into the bed — tap it (or the crop bar) for that
              planting&apos;s details. Only crops started in trays show one.
              <br />
              ↻ marks where year two begins. The timeline shows <strong style={{ color: '#5C5040' }}>two full years</strong> — pan
              sideways to reach the second one. This plan holds one annual cycle rather than a separate plan per
              year, so year two is that same cycle coming round again, drawn <em>faded</em> to say so: it is what
              these beds do if nothing changes, not a second year you have decided on. When a new season actually
              starts, tap{' '}
              <strong style={{ color: '#5C5040' }}>Auto-suggest a plan</strong> again with{' '}
              <strong style={{ color: '#5C5040' }}>Rotate crops</strong> on: it reads what&apos;s currently in each
              bed as last season&apos;s history and plans the next rotation around it, so re-running this each
              season is how &quot;planning next year&quot; actually works here.
            </div>

            {/* Food/field/cashflow resilience — moved directly under the plan
                itself (Tend-style) rather than buried below Tasks/BOQ/Year-ahead,
                since it's the single view most likely to answer "am I actually
                covered month to month" at a glance. */}
            <FoodAvailabilityChart
              monthOrder={chartMonthOrder}
              availability={foodAvailability}
              valueByMonth={foodValueByMonth}
              utilizationByMonth={fieldUtilizationByMonth}
              plantings={plantings}
              priceOverrides={priceOverrides}
              onPriceOverrideChange={updatePriceOverride}
              cashflowSettings={cashflowSettings}
              onCashflowSettingsChange={updateCashflowSettings}
              yearMode={yearMode}
              onYearModeChange={setYearMode}
            />

            {/* Tasks + harvest */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>📋 Tasks</div>
                <div className="font-sans mb-1" style={{ fontSize: 13, color: '#20190F' }}>
                  <strong>{monthLabel(currentMonth)}:</strong> <span style={{ color: '#5C5040' }}>{taskSentence(currentTasks)}</span>
                </div>
                <div className="font-sans mb-3" style={{ fontSize: 13, color: '#20190F' }}>
                  <strong>{monthLabel(nextMonth)}:</strong> <span style={{ color: '#5C5040' }}>{taskSentence(nextTasks)}</span>
                </div>
                <button
                  onClick={shareTasks}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-display font-semibold mb-3"
                  style={{ fontSize: 12, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
                >
                  📱 Share tasks
                </button>
                <div style={{ borderTop: '1px solid #E2D8C4', paddingTop: 8 }}>
                  <button
                    onClick={() => setShowLookingAhead((v) => !v)}
                    className="font-sans uppercase tracking-widest w-full flex items-center justify-between"
                    style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <span>Looking ahead</span>
                    <span>{showLookingAhead ? '▾' : '▸'}</span>
                  </button>
                  {showLookingAhead && (
                    <div className="space-y-1 mt-1.5">
                      {/* i<2 (this month, next month) is already shown above — repeating it here just eats space for no new information. */}
                      {chartMonthOrder.map((m, i) => {
                        if (i < 2) return null;
                        const t = allTasks.filter((task) => task.month === m);
                        if (t.length === 0) return null;
                        return (
                          <div key={i} className="font-sans" style={{ fontSize: 12, color: '#5C5040' }}>
                            <strong style={{ color: '#20190F' }}>{monthLabel(m)}{i >= 12 ? ' (next year)' : ''}</strong> — {taskSentence(t)}
                          </div>
                        );
                      })}
                      {allTasks.length === 0 && (
                        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>No plantings yet — tap + crop on a bed above.</div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="flex items-center justify-between mb-2 gap-2">
                  <div className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>🥬 Estimated harvest</div>
                  <div className="flex rounded-lg overflow-hidden flex-shrink-0" style={{ border: '1px solid #E2D8C4' }}>
                    {(['crop', 'bed'] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setHarvestBoxView(v)}
                        className="font-sans"
                        style={{
                          fontSize: 11, padding: '3px 9px', cursor: 'pointer',
                          background: harvestBoxView === v ? '#1F4D2B' : 'transparent',
                          color: harvestBoxView === v ? '#FFFEFA' : '#5C5040',
                        }}
                      >
                        {v === 'crop' ? 'By crop' : 'By bed'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="font-mono font-bold mb-1" style={{ fontSize: 26, color: '#1F4D2B' }}>
                  {(newYieldKg * harvestLossFactor).toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500, color: '#8C7A62' }}>kg/yr to plant</span>
                </div>
                <div className="font-sans mb-2" style={{ fontSize: 11, color: '#8C7A62' }}>
                  {cashflowSettings.lossPercent > 0 ? `after ~${cashflowSettings.lossPercent}% loss` : 'no loss assumed yet'} · gross {newYieldKg.toFixed(1)} kg/yr
                </div>
                {existingYieldKg > 0 && (
                  <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                    + {(existingYieldKg * harvestLossFactor).toFixed(1)} kg/yr already growing (not new)
                  </div>
                )}

                {/* Same loss% as the Retail/Wholesale value-tab slider below (shared
                    cashflowSettings) — dragging either one moves both, so there's
                    exactly one "expected loss" number for the whole plan. */}
                <div className="flex items-center justify-between mb-1">
                  <span className="font-sans" style={{ fontSize: 11, color: '#8C7A62' }}>% expected loss (disease, failure, underperformance)</span>
                  <span className="font-mono font-semibold" style={{ fontSize: 12, color: '#20190F' }}>{cashflowSettings.lossPercent}%</span>
                </div>
                <input
                  type="range" min={0} max={100} value={cashflowSettings.lossPercent}
                  onChange={(e) => updateCashflowSettings({ ...cashflowSettings, lossPercent: Number(e.target.value) })}
                  className="w-full mb-3" style={{ accentColor: '#1F4D2B' }}
                />

                <div className="space-y-1">
                  {harvestBoxView === 'crop' ? (
                    <>
                      {yieldByCropList.map(({ cropKey, name, icon, kg }) => (
                        <div key={cropKey} className="flex items-center justify-between font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                          <span>{icon} {name}</span>
                          <span className="font-mono" style={{ color: '#20190F' }}>{(kg * harvestLossFactor).toFixed(1)} kg</span>
                        </div>
                      ))}
                      {yieldByCropList.length === 0 && (
                        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing planted yet.</div>
                      )}
                    </>
                  ) : (
                    <>
                      {yieldByBed.map(({ bed, kg }) => (
                        <div key={bed.id} className="flex items-center justify-between font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                          <span>{bed.label}</span>
                          <span className="font-mono" style={{ color: '#20190F' }}>{(kg * harvestLossFactor).toFixed(1)} kg</span>
                        </div>
                      ))}
                      {yieldByBed.length === 0 && (
                        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing planted yet.</div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Off the screen and onto a calendar / a piece of paper. Sits
                between the task list it exports and the seed BOQ it prints,
                so it is next to both things it is about. */}
            <CropPlanExportCard
              plantings={plantings}
              beds={beds}
              tasks={allTasks}
              yearReport={yearReport}
              meta={exportMeta}
            />

            {/* Seed BOQ + year-ahead report */}
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>🌱 Seeds & seedlings — and how to sow them</div>
                <div className="space-y-2">
                  {seedBoq.map((row) => {
                    const crop = cropByKey(row.cropKey);
                    return (
                      <div key={row.cropKey} className="pb-2" style={{ borderBottom: '1px solid #F0EAD8' }}>
                        <div className="flex items-center justify-between font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                          <span>{row.icon} {row.cropName}</span>
                          <span className="font-mono" style={{ color: '#20190F' }}>~{row.count} {row.unit}</span>
                        </div>
                        {crop && (
                          <div className="font-sans mt-0.5 flex items-center gap-1" style={{ fontSize: 11, color: '#8C7A62' }}>
                            <SeedBadge transplant={!!crop.transplant} />
                            <span>{crop.transplant ? 'transplant' : 'direct-sow'} · {sowingInstruction(crop)}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {seedBoq.length === 0 && (
                    <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing new to buy yet.</div>
                  )}
                </div>
                <p className="font-mono mt-2" style={{ fontSize: 10, color: '#9A8268' }}>
                  Quantities estimated from bed area and each crop's usual spacing — direct-sow counts include a buffer for germination loss. Row/in-row spacing and sowing depth are shown where a source confirms them; otherwise just the overall plant spacing.
                </p>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>📖 Year ahead</div>
                {yearReport.length > 0 ? (
                  <div className="space-y-2">
                    {yearReport.map((line, i) => (
                      <p key={i} className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>{line}</p>
                    ))}
                  </div>
                ) : (
                  <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Add some plantings to see a year-ahead summary.</div>
                )}
              </div>
            </div>

            <RotationExplanationCard />
            <OrganicGuideCard />

            <div className="font-sans mt-4 text-center" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5 }}>
              Planning guide only — sow windows are general. Adjust to your local rainfall, frost dates and microclimate.
            </div>
          </div>
        </div>
      )}

      {/* Crop picker modal */}
      {pickerBedId && (
        <CropPickerModal
          search={pickerSearch}
          onSearch={setPickerSearch}
          crop={pickerCrop}
          month={pickerMonth}
          pattern={pattern}
          fraction={pickerFraction}
          onFraction={setPickerFraction}
          existing={pickerExisting}
          onExisting={setPickerExisting}
          overlap={pickerOverlap}
          isEditing={!!editingPlantingId}
          favouriteCropKeys={favouriteCropKeys}
          onToggleFavourite={toggleFavourite}
          allowBedSharing={allowBedSharing}
          onEnableBedSharing={toggleAllowBedSharing}
          onPick={pickCrop}
          onBack={() => setPickerCrop(null)}
          onMonth={setPickerMonth}
          onConfirm={confirmAdd}
          onClose={closePicker}
          isPlot={beds.find((b) => b.id === pickerBedId)?.kind === 'plot'}
        />
      )}

      {/* Planting popover */}
      {activePlanting && (
        <PlantingPopover
          planting={activePlanting}
          bedAreaM2={bedAreaFor(activePlanting.bedId)}
          allPlantings={plantings}
          substitute={suggestSubstituteCrop(activePlanting, plantings)}
          onEdit={() => { openEditPicker(activePlanting); setActivePlanting(null); }}
          onRemove={() => { removePlanting(activePlanting.id); setActivePlanting(null); }}
          onReplace={(cropKey) => { replacePlanting(activePlanting.id, cropKey); setActivePlanting(null); }}
          onClose={() => setActivePlanting(null)}
        />
      )}

      {/* Auto-suggest: questionnaire + review */}
      {autoPhase !== 'idle' && (
        <AutoSuggestModal
          phase={autoPhase}
          goal={aGoal} onGoal={chooseGoal}
          household={aHousehold} onHousehold={setAHousehold}
          focusCount={aFocusCount} onFocusCount={setAFocusCount}
          groups={aGroups} onToggleGroup={toggleGroup}
          rhythm={aRhythm} onRhythm={setARhythm}
          rotateCrops={aRotateCrops} onRotateCrops={setARotateCrops}
          allowVinesInBeds={aAllowVinesInBeds} onAllowVinesInBeds={setAAllowVinesInBeds}
          result={autoResult}
          onGenerate={runAutoSuggest}
          onAccept={acceptAutoSuggest}
          onBackToQuestions={() => setAutoPhase('questions')}
          onClose={() => setAutoPhase('idle')}
        />
      )}

      <NavDrawer open={navOpen} onClose={() => setNavOpen(false)} />
    </div>
  );
}

export default function FacilitatorCropsPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', background: '#FBF7EF' }} />}>
      <FacilitatorCropsPageInner />
    </Suspense>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ onVirtual, designHref }: { onVirtual: () => void; designHref: string }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center" style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 40 }}>🌱</div>
        <div className="font-display font-semibold mt-2" style={{ fontSize: 18, color: '#20190F' }}>No beds designed yet</div>
        <p className="font-sans mt-1.5" style={{ fontSize: 14, color: '#5C5040', lineHeight: 1.5 }}>
          Place veg beds on the Planting step first — then come back here to plan what goes in them.
        </p>
        <Link
          href={designHref}
          className="inline-flex items-center justify-center mt-4 px-4 py-2 rounded-xl font-display font-semibold"
          style={{ fontSize: 14, background: '#1F4D2B', color: '#F7F2E9', textDecoration: 'none' }}
        >
          ‹ Back to design
        </Link>
        <div className="mt-3">
          <button
            onClick={onVirtual}
            className="font-sans underline"
            style={{ fontSize: 13, color: '#8C7A62', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            or plan without a map — use one 10 m² bed
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Food availability + rotation explanation ────────────────────────────

/**
 * Shared line-chart renderer for utilization/retail/wholesale — a
 * continuous trend over the month axis reads a gap or a dip far faster
 * than comparing adjacent bar heights, and a dashed reference line (100%
 * bed capacity) only makes sense as a line a series can cross. Availability
 * stays a stacked bar (fresh vs storage is a composition, not a single
 * trend, so a bar reads better there).
 */
function MonthLineChart({
  monthOrder, values, max, color, formatLabel, labelColor, dotColor, referenceValue, tooltipFor,
}: {
  monthOrder: number[];
  values: number[];
  max: number;
  color: string;
  formatLabel: (v: number) => string;
  labelColor?: (v: number) => string;
  dotColor?: (v: number) => string;
  referenceValue?: number;
  /** Optional per-point hover text (e.g. a crop-by-crop kg breakdown) — rendered as a native SVG <title>. */
  tooltipFor?: (i: number) => string | undefined;
}) {
  const H = 56;
  const colW = 56;
  const W = monthOrder.length * colW;
  const xAt = (i: number) => (i + 0.5) * colW;
  const yAt = (v: number) => H - Math.max(0, Math.min(1, v / max)) * (H - 6) - 3;
  const points = monthOrder.map((_, i) => ({ x: xAt(i), y: yAt(values[i]), v: values[i] }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${H} L ${points[0].x.toFixed(1)} ${H} Z`;
  const defaultDotColor = (v: number) => (v <= 0 ? '#D8CFBC' : color);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: GRID_MIN_WIDTH }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none" style={{ display: 'block' }}>
          {referenceValue !== undefined && (
            <line x1={0} x2={W} y1={yAt(referenceValue)} y2={yAt(referenceValue)} stroke="#C4A46A" strokeWidth={1} strokeDasharray="4 3" />
          )}
          <path d={areaPath} fill={color} opacity={0.15} />
          <path d={linePath} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={4} fill={(dotColor ?? defaultDotColor)(p.v)} stroke="#FBF6EC" strokeWidth={1.5}>
              {tooltipFor?.(i) && <title>{tooltipFor(i)}</title>}
            </circle>
          ))}
        </svg>
        <div className="flex" style={{ width: W }}>
          {monthOrder.map((m, i) => (
            <div key={i} style={{ width: colW, textAlign: 'center' }}>
              <div className="font-sans" style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#1F4D2B' : '#8C7A62', marginTop: 4 }}>
                {MONTHS_SHORT[m - 1]}
              </div>
              <div className="font-mono font-semibold" style={{ fontSize: 11, color: labelColor ? labelColor(values[i]) : '#20190F', marginTop: 2 }}>
                {formatLabel(values[i])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type FoodValueMode = 'availability' | 'harvest' | 'utilization' | 'retail' | 'wholesale';

function FoodAvailabilityChart({
  monthOrder, availability, valueByMonth, utilizationByMonth, plantings, priceOverrides, onPriceOverrideChange,
  cashflowSettings, onCashflowSettingsChange, yearMode, onYearModeChange,
}: {
  monthOrder: number[];
  availability: FoodAvailabilityItem[][];
  valueByMonth: FoodValueMonth[];
  utilizationByMonth: number[];
  plantings: Planting[];
  priceOverrides: Record<string, CropPrice>;
  onPriceOverrideChange: (cropKey: string, price: CropPrice) => void;
  cashflowSettings: CashflowSettings;
  onCashflowSettingsChange: (s: CashflowSettings) => void;
  yearMode: 'established' | 'fromToday';
  onYearModeChange: (m: 'established' | 'fromToday') => void;
}) {
  const [mode, setMode] = useState<FoodValueMode>('availability');
  const [editingPrices, setEditingPrices] = useState(false);
  const isMoneyMode = mode === 'retail' || mode === 'wholesale';

  const cols = monthOrder.map((m) => {
    const items = availability[m] ?? [];
    return { m, fresh: items.filter((it) => it.status === 'fresh'), stored: items.filter((it) => it.status === 'stored') };
  });
  const maxTotal = Math.max(1, ...cols.map((c) => c.fresh.length + c.stored.length));
  const BAR_MAX_H = 56;
  const isEmpty = cols.every((c) => c.fresh.length + c.stored.length === 0);
  const lossFactor = 1 - cashflowSettings.lossPercent / 100;
  const sellFactor = cashflowSettings.sellPercent / 100;
  const moneyMax = Math.max(1, ...monthOrder.map((m) => (mode === 'retail' ? valueByMonth[m].retailValue : valueByMonth[m].wholesaleValue) * lossFactor));
  const utilMax = Math.max(1, ...monthOrder.map((m) => utilizationByMonth[m] ?? 0));
  const kgMax = Math.max(1, ...monthOrder.map((m) => valueByMonth[m].kg));
  // Whole-year total from the SAME per-month figures the chart plots — always
  // reconciles to "Estimated harvest" above by construction (buildFoodValueByMonth
  // spreads each planting's total yield across its real harvest window, so
  // summing all 12 calendar months recovers that total exactly once).
  const totalHarvestKg = valueByMonth.slice(1, 13).reduce((s, v) => s + v.kg, 0);

  const pricedCropKeys = [...new Set(plantings.map((p) => p.cropKey))].filter((k) => !UNPRICED_CROPS.has(k)).sort();

  // Total across the TRUE 12-month cycle (indices 1-12), not the display
  // width — buildFoodValueByMonth is keyed by calendar month regardless of
  // how many columns DISPLAY_MONTHS happens to show, so this is the honest
  // "whole year" figure even when the timeline itself is showing 15+ columns.
  const fullHarvestableValue = (mode === 'retail' || mode === 'wholesale')
    ? valueByMonth.slice(1, 13).reduce((s, v) => s + (mode === 'retail' ? v.retailValue : v.wholesaleValue), 0)
    : 0;
  const totalHarvestableValue = fullHarvestableValue * lossFactor;
  const totalCashIncome = totalHarvestableValue * sellFactor;
  const totalHomeValue = totalHarvestableValue * (1 - sellFactor);

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>🍽️ Food, field & cashflow — resilience by month</div>

      <div className="inline-flex flex-wrap rounded-full p-0.5 mb-2" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
        {([['availability', '🍽️ Availability'], ['harvest', '⚖️ Kg harvested'], ['utilization', '🌱 Field utilization'], ['retail', '💰 Retail value'], ['wholesale', '💰 Wholesale value']] as [FoodValueMode, string][]).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="font-sans font-semibold"
            style={{
              fontSize: 11.5, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer',
              background: mode === m ? '#1F4D2B' : 'transparent',
              color: mode === m ? '#F7F2E9' : '#5C5040',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Which YEAR the charts describe — see the parent's yearMode comment. */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="inline-flex rounded-full p-0.5" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
          {([['established', '🌳 An established year'], ['fromToday', '🌱 From today']] as ['established' | 'fromToday', string][]).map(([m, label]) => (
            <button
              key={m}
              onClick={() => onYearModeChange(m)}
              className="font-sans font-semibold"
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                background: yearMode === m ? '#5C5040' : 'transparent',
                color: yearMode === m ? '#F7F2E9' : '#5C5040',
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span className="font-sans" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.4 }}>
          {yearMode === 'established'
            ? 'The full yearly rhythm once this plan repeats every season — a garden starting now grows into this picture over its first year.'
            : 'Only what is actually ahead of a garden starting now — already-finished months of existing crops don’t count.'}
        </span>
      </div>

      {mode === 'availability' ? (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          What this plan should put on the table each month — fresh picks, plus anything still keeping in storage
          from an earlier harvest (maize, pumpkin, onions and other storable crops). Shows what&apos;s on hand, not
          an exact kg count — see the &quot;Kg harvested&quot; view for that.
        </p>
      ) : mode === 'harvest' ? (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          How many kg actually come off the beds each month — each planting&apos;s total estimated yield spread
          evenly across its real fresh-harvest window (one lump for a one-shot crop like onions, several months
          for a cut-and-come-again crop like Swiss chard), so every month is only counted once and the 12 months
          add up to the {totalHarvestKg.toFixed(1)}kg/yr total exactly. Hover a point for which crops make up
          that month.
        </p>
      ) : mode === 'utilization' ? (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          How much of your total bed area is actually growing something each month — a quick way to spot a bed
          sitting idle between plantings. A bed counts as occupied from sowing through the end of its harvest
          window (storage life afterward doesn&apos;t count — that&apos;s off the bed, not in the ground).{' '}
          {yearMode === 'fromToday'
            ? 'Crops you marked as already growing only count from today onward — a crop that finished months ago no longer holds its bed here, matching the timeline above.'
            : 'In an established year every planting counts in its calendar months, because the plan repeats — high utilization with low kg in the same month simply means beds full of young crops.'}
        </p>
      ) : (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          Estimated Rand value of what&apos;s harvested each month, using researched South African {mode} prices
          (2026-07-14) — a one-time researched snapshot, not a live market feed, spread across each crop&apos;s own
          harvest window so the same batch is never counted twice.{' '}
          {mode === 'retail' ? (
            <>This is what you&apos;d get selling direct to the customer yourself — a farm stall, neighbours, a
            local market stand — at ordinary non-organic retail prices, not a premium organic markup. You keep the
            full retail margin because there&apos;s no middleman.</>
          ) : (
            <>This is what you&apos;d get selling in bulk to someone else who then resells it — another retailer,
            a stall-holder, a trader — lower per-kg than retail, but in volume and off your hands in one sale
            rather than piece by piece.</>
          )}{' '}
          Edit the prices below to match your own market.
        </p>
      )}

      {isMoneyMode && !isEmpty && (
        <div className="rounded-xl p-3 mb-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
              % sold (rest feeds the household)
            </span>
            <span className="font-mono font-semibold" style={{ fontSize: 12, color: '#20190F' }}>{cashflowSettings.sellPercent}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={cashflowSettings.sellPercent}
            onChange={(e) => onCashflowSettingsChange({ ...cashflowSettings, sellPercent: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#1F4D2B' }}
          />
          <div className="flex items-center justify-between mb-2 mt-2">
            <span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>
              % expected loss (disease, failure, underperformance)
            </span>
            <span className="font-mono font-semibold" style={{ fontSize: 12, color: '#20190F' }}>{cashflowSettings.lossPercent}%</span>
          </div>
          <input
            type="range" min={0} max={100} value={cashflowSettings.lossPercent}
            onChange={(e) => onCashflowSettingsChange({ ...cashflowSettings, lossPercent: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#B33A3A' }}
          />
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
            <div className="font-sans uppercase tracking-widest mb-1" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>
              Estimated for the year
            </div>
            <div className="font-mono font-bold" style={{ fontSize: 20, color: '#1F4D2B' }}>
              R{Math.round(totalCashIncome).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: '#8C7A62' }}>cash income ({cashflowSettings.sellPercent}% sold)</span>
            </div>
            {totalHomeValue > 0.5 && (
              <div className="font-mono" style={{ fontSize: 13, color: '#5C5040', marginTop: 2 }}>
                + R{Math.round(totalHomeValue).toLocaleString()} <span style={{ fontSize: 11.5, color: '#8C7A62' }}>home-consumption value (not cash — what you&apos;d have paid to buy it)</span>
              </div>
            )}
            {(cashflowSettings.sellPercent < 100 || cashflowSettings.lossPercent > 0) && (
              <div className="font-mono" style={{ fontSize: 11.5, color: '#8C7A62', marginTop: 6, paddingTop: 6, borderTop: '1px dashed #E2D8C4' }}>
                R{Math.round(fullHarvestableValue).toLocaleString()} full {mode} value if everything sold, nothing lost
              </div>
            )}
          </div>
        </div>
      )}

      {isEmpty ? (
        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Add some plantings to see what&apos;s available month to month.</div>
      ) : mode === 'availability' ? (
        <>
          <div className="flex items-center gap-4 mb-3 font-sans" style={{ fontSize: 11, color: '#5C5040' }}>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#7FAE6E', display: 'inline-block' }} /> Fresh harvest
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span style={{ width: 9, height: 9, borderRadius: 2, background: '#D4A017', display: 'inline-block' }} /> In storage
            </span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <div className="flex" style={{ minWidth: GRID_MIN_WIDTH, gap: 6 }}>
              {cols.map(({ m, fresh, stored }, i) => {
                const total = fresh.length + stored.length;
                const hPx = total === 0 ? 0 : Math.max(8, Math.round((total / maxTotal) * BAR_MAX_H));
                const storedHPx = total === 0 ? 0 : Math.round((stored.length / total) * hPx);
                const freshHPx = hPx - storedHPx;
                const title = [...stored, ...fresh]
                  .map((it) => `${it.icon} ${it.name} — ${it.status === 'fresh' ? 'fresh' : 'stored'}`)
                  .join('\n');
                return (
                  <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 56 }}>
                    <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                      {total === 0 ? (
                        <div style={{ width: '60%', height: 2, background: '#E2D8C4', borderRadius: 1 }} />
                      ) : (
                        <div
                          style={{ width: '60%', display: 'flex', flexDirection: 'column', borderRadius: 4, overflow: 'hidden' }}
                          title={title}
                        >
                          {storedHPx > 0 && <div style={{ height: storedHPx, background: '#D4A017' }} />}
                          {storedHPx > 0 && freshHPx > 0 && <div style={{ height: 2, background: '#FFFEFA' }} />}
                          {freshHPx > 0 && <div style={{ height: freshHPx, background: '#7FAE6E' }} />}
                        </div>
                      )}
                    </div>
                    <div className="font-sans" style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#1F4D2B' : '#8C7A62', marginTop: 4 }}>
                      {MONTHS_SHORT[m - 1]}
                    </div>
                    <div style={{ fontSize: 13, lineHeight: 1.3, minHeight: 16 }}>{fresh.map((it) => it.icon).join('')}</div>
                    <div style={{ fontSize: 13, lineHeight: 1.3, minHeight: 16, opacity: 0.6 }}>{stored.map((it) => it.icon).join('')}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : mode === 'harvest' ? (
        <MonthLineChart
          monthOrder={monthOrder}
          values={monthOrder.map((m) => valueByMonth[m].kg)}
          max={kgMax}
          color="#7FAE6E"
          formatLabel={(v) => (v > 0 ? `${v.toFixed(1)}kg` : '')}
          tooltipFor={(i) => {
            const byCrop = valueByMonth[monthOrder[i]].byCrop;
            const rows = Object.entries(byCrop).filter(([, kg]) => kg > 0.05).sort((a, b) => b[1] - a[1]);
            if (!rows.length) return undefined;
            return rows.map(([cropKey, kg]) => `${cropByKey(cropKey)?.name ?? cropKey}: ${kg.toFixed(1)}kg`).join('\n');
          }}
        />
      ) : mode === 'utilization' ? (
        <MonthLineChart
          monthOrder={monthOrder}
          values={monthOrder.map((m) => utilizationByMonth[m] ?? 0)}
          max={utilMax}
          color="#5C7FA6"
          referenceValue={1}
          dotColor={(v) => (v <= 0 ? '#D8CFBC' : v > 1 ? '#B33A3A' : '#5C7FA6')}
          labelColor={(v) => (v > 1 ? '#B33A3A' : '#20190F')}
          formatLabel={(v) => `${Math.round(v * 100)}%`}
        />
      ) : (
        <MonthLineChart
          monthOrder={monthOrder}
          values={monthOrder.map((m) => (mode === 'retail' ? valueByMonth[m].retailValue : valueByMonth[m].wholesaleValue) * lossFactor)}
          max={moneyMax}
          color={mode === 'retail' ? '#D4A017' : '#C4A46A'}
          formatLabel={(v) => (v > 0 ? `R${Math.round(v)}` : '')}
        />
      )}

      {!isEmpty && pricedCropKeys.length > 0 && (
        <div className="mt-3" style={{ borderTop: '1px solid #E2D8C4', paddingTop: 8 }}>
          <button
            onClick={() => setEditingPrices((v) => !v)}
            className="font-sans underline"
            style={{ fontSize: 11.5, color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            {editingPrices ? 'Hide prices' : '✏️ Edit prices used above'}
          </button>
          {editingPrices && (
            <div className="mt-2 space-y-1.5">
              {pricedCropKeys.map((cropKey) => {
                const crop = cropByKey(cropKey);
                const price = priceFor(cropKey, priceOverrides);
                if (!crop || !price) return null;
                return (
                  <div key={cropKey} className="flex items-center gap-2 font-sans" style={{ fontSize: 12, color: '#5C5040' }}>
                    <span style={{ flex: 1 }}>{crop.icon} {crop.name}</span>
                    <label className="flex items-center gap-1">
                      R
                      <input
                        type="number"
                        min="0"
                        value={price.retailPerKg}
                        onChange={(e) => onPriceOverrideChange(cropKey, { ...price, retailPerKg: Number(e.target.value) || 0, confidence: 'estimated' })}
                        style={{ width: 54, padding: '2px 4px', border: '1px solid #E2D8C4', borderRadius: 4, background: '#FFFFFF' }}
                      />
                      /kg retail
                    </label>
                    <label className="flex items-center gap-1">
                      R
                      <input
                        type="number"
                        min="0"
                        value={price.wholesalePerKg}
                        onChange={(e) => onPriceOverrideChange(cropKey, { ...price, wholesalePerKg: Number(e.target.value) || 0, confidence: 'estimated' })}
                        style={{ width: 54, padding: '2px 4px', border: '1px solid #E2D8C4', borderRadius: 4, background: '#FFFFFF' }}
                      />
                      /kg wholesale
                    </label>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RotationExplanationCard() {
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>🔄 Why rotate by food group</div>
      <p className="font-sans mb-3" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
        Each bed&apos;s label above shows which food group is currently growing there. With &quot;Rotate crops&quot;
        turned on in Auto-suggest, each bed actively targets the NEXT group in this order (falling back to
        whatever fits if nothing from that group is available) — not just avoiding a repeat, but following the
        cycle below. This keeps soil-borne pests and diseases from building up, and matches each group&apos;s
        needs to what the last crop left behind — general permaculture practice, not a guaranteed schedule.
      </p>
      <div className="space-y-1.5">
        {ROTATION_SEQUENCE.map((g) => {
          const meta = FOOD_GROUP_META[g];
          return (
            <div key={g} className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
              <strong style={{ color: '#20190F' }}>{meta.icon} {meta.label}</strong> — {ROTATION_BLURB[g]}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Static organic-inputs reference (2026-07-15 agronomy handoff) — read-only
 * guidance, NOT per-crop numeric fields and NOT auto-scheduled spray tasks.
 * Fertilisation is the derived-from-commercial-rate general amounts the
 * handoff explicitly said are safe to ship as a reference card, not a fixed
 * per-crop schedule (Talborne's own FAQ says rates should come from soil/
 * leaf testing). Pest section is monitoring-first — "if you see X, consider
 * Y" — deliberately no numeric economic thresholds and no auto-inserted
 * spray tasks, since no SA-specific source backs either.
 */
function OrganicGuideCard() {
  const [openSection, setOpenSection] = useState<'feed' | 'protect' | null>(null);
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>🌿 Growing organically</div>
      <p className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.5 }}>
        General guidance, not a fixed schedule — adjust to your soil, local conditions and (if certified) your organic certifier&apos;s rules. Not a substitute for an extension officer.
      </p>

      <button
        onClick={() => setOpenSection((s) => (s === 'feed' ? null : 'feed'))}
        className="w-full flex items-center justify-between font-display font-semibold"
        style={{ fontSize: 13, color: '#20190F', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
      >
        <span>🌾 Feeding your crops</span><span>{openSection === 'feed' ? '▾' : '▸'}</span>
      </button>
      {openSection === 'feed' && (
        <div className="space-y-2 pb-2 mb-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Bed prep:</strong> compost worked into the top 15-20cm (~2-3 kg/m²), plus well-rotted kraal (cattle) manure — ~0.5-1 kg/m² for most crops, up to 2-4 kg/m² for heavy feeders. Manure must be well-rotted and worked in at least 3-4 weeks before sowing/transplanting — fresh manure is a food-safety risk, especially for root crops and leafy greens.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Legumes help the next crop:</strong> dry beans, green beans, peas, broad beans and groundnuts all reduce the following crop&apos;s fertiliser need — already built into this plan&apos;s bed rotation.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#20190F', lineHeight: 1.5 }}>
            <strong>Real SA organic products</strong> (label rates, not universal science — check the current label):
          </p>
          <ul className="font-sans space-y-1" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.5, paddingLeft: 16 }}>
            <li>Talborne Vita Veg 6:3:4(16) — leafy/fruiting veg, apply at the base and water in, reapply every 6-8 weeks.</li>
            <li>Talborne Vita Bone Phos 4:10:0(14) (bonemeal) — till into new beds before planting, especially low-phosphorus soils.</li>
            <li>Talborne Soft Rock Phosphate — ~25g/m²/year, broadcast, banded, or in the planting hole.</li>
            <li>Atlantic Bio Ocean (seaweed, fishmeal, humic acid, poultry manure pellets) — 1-2 handfuls/m² every 6 weeks, pH-neutral and won&apos;t burn plants.</li>
            <li>Biogrow Bio Ganic / Bio Rock — real SA organic products; confirm the current application rate on the label.</li>
          </ul>
          <p className="font-sans" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5 }}>
            No fixed per-crop feeding schedule is given here on purpose — even Talborne&apos;s own guidance says rates should come from a soil or leaf test, not a blanket number. PGS SA (Participatory Guarantee System) is a realistic low-cost organic-certification route for smallholders, if that&apos;s a goal.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpenSection((s) => (s === 'protect' ? null : 'protect'))}
        className="w-full flex items-center justify-between font-display font-semibold"
        style={{ fontSize: 13, color: '#20190F', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0' }}
      >
        <span>🐛 Protecting your crops</span><span>{openSection === 'protect' ? '▾' : '▸'}</span>
      </button>
      {openSection === 'protect' && (
        <div className="space-y-2">
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Prevent first:</strong> rotate crops (built into this plan), companion planting (marigold against nematodes/whitefly; garlic, onion or wild garlic/Artemisia afra as general repellents; basil near tomatoes; let some carrot, fennel, dill or yarrow flower for beneficial insects), sanitation (remove diseased material — don&apos;t compost it unless hot-composting; clean tools; avoid late-day overhead watering), disease-resistant varieties where labelled, and insect mesh over brassica/seedling beds.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Scout weekly:</strong> walk your beds and note what you see — no diagnosis needed, just catching problems while they&apos;re small. Yellow sticky traps give early warning of flying pests.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#20190F', lineHeight: 1.5 }}>
            <strong>If you see it, consider this</strong> — confirm the diagnosis before spraying anything:
          </p>
          <ul className="font-sans space-y-1" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.5, paddingLeft: 16 }}>
            <li><strong>Caterpillars</strong> — Bt (Bacillus thuringiensis kurstaki), e.g. Margaret Roberts Biological Caterpillar Insecticide — targets caterpillars only, safe for other insects.</li>
            <li><strong>Aphids, whitefly, mites, mealybug, thrips, scale</strong> — rotate between neem (Biogrow Bioneem), insecticidal soap (Biogrow Neudosan) and pyrethrum (Biogrow Pyrol — evening only, toxic to bees while wet), or a garlic/canola contact spray (Margaret Roberts Organic Insecticide).</li>
            <li><strong>Fungal disease</strong> (powdery/downy mildew, rust, blight, black rot) — sulphur-based sprays (watch temperatures above 30°C) or preventive copper soap. Go easy on copper — it builds up in soil over years; check your certifier&apos;s limit rather than assuming a number.</li>
            <li><strong>Slugs, snails, cutworms</strong> — physical barriers and hand-removal first; an iron/ferric-phosphate bait as a spot treatment if it&apos;s still a problem.</li>
          </ul>
          <p className="font-sans" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5 }}>
            This is a starting point, not a spray calendar — nothing in this plan auto-schedules a spray. Confirm what you&apos;re seeing before treating it, and check your organic certifier&apos;s current approved-input list if you&apos;re certified.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Bed row + planting bars ─────────────────────────────────────────────

function BedRow({ bed, plantings, currentMonth, onAddCrop, onTapPlanting }: {
  bed: PlanBed;
  plantings: Planting[];
  currentMonth: number;
  onAddCrop: () => void;
  onTapPlanting: (p: Planting) => void;
}) {
  // Which food group(s) are currently in this bed — usually just one, but an
  // intercropped/split bed or a rolling window spanning a succession swap can
  // show more than one. Purely informational (rotation is chosen by the
  // farmer or the auto-suggest engine, not enforced here).
  const bedGroups = Array.from(new Set(
    plantings.map((p) => cropByKey(p.cropKey)).filter((c): c is CropDef => !!c).map((c) => foodGroupOf(c)),
  ));

  return (
    <div className="flex" style={{ borderBottom: '1px solid #E2D8C4' }}>
      <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: bed.kind === 'plot' ? '#FBF6EC' : '#FFFEFA', borderRight: '1px solid #E2D8C4', padding: '10px 10px' }}>
        <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>
          {bed.label}
          {bed.kind === 'plot' && (
            <span
              className="font-sans font-semibold uppercase"
              title="A staple plot from your Design Studio map — one field crop at full area per season, rotating year to year"
              style={{ fontSize: 8.5, letterSpacing: '0.06em', color: '#7A5B24', background: '#F0E4C8', border: '1px solid #E0CD9E', borderRadius: 6, padding: '1px 5px', marginLeft: 5, verticalAlign: 'middle' }}
            >
              🌽 plot
            </span>
          )}
        </div>
        <div className="font-mono" style={{ fontSize: 11, color: '#8C7A62' }}>{bed.areaM2.toFixed(1)} m²</div>
        {bedGroups.length > 0 && (
          <div
            className="font-sans"
            style={{ fontSize: 10, color: '#5C5040', marginTop: 3, lineHeight: 1.3 }}
            title={bedGroups.map((g) => FOOD_GROUP_META[g].label).join(', ')}
          >
            {bedGroups.length === 1
              ? `${FOOD_GROUP_META[bedGroups[0]].icon} ${FOOD_GROUP_META[bedGroups[0]].label}`
              : bedGroups.map((g) => FOOD_GROUP_META[g].icon).join(' ')}
          </div>
        )}
      </div>
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        {/* month gridlines (background) — column 0 is always "this month" now */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
          {Array.from({ length: DISPLAY_MONTHS }, (_, i) => i).map((i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRight: i < DISPLAY_MONTHS - 1 ? '1px solid #EDE7DB' : 'none',
                borderLeft: i === 12 ? '2px solid #C4A46A' : undefined,
                background: i === 0 ? 'rgba(31,77,43,0.05)' : 'transparent',
              }}
            />
          ))}
        </div>
        <div style={{ position: 'relative', padding: '6px 0' }}>
          {plantings.map((p) => (
            <PlantingBar key={p.id} planting={p} currentMonth={currentMonth} onTap={() => onTapPlanting(p)} />
          ))}
          <div style={{ padding: '2px 8px' }}>
            <button
              onClick={onAddCrop}
              className="font-sans"
              style={{ fontSize: 12, color: '#1F4D2B', background: 'rgba(31,77,43,0.08)', border: '1px dashed rgba(31,77,43,0.3)', borderRadius: 8, padding: '3px 10px', cursor: 'pointer' }}
            >
              + crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlantingBar({ planting, currentMonth, onTap }: { planting: Planting; currentMonth: number; onTap: () => void }) {
  const crop = cropByKey(planting.cropKey);
  if (!crop) return null;
  const harvest = harvestMonth(planting.sowMonth, crop.daysToHarvest);
  // Harvest isn't always a single-month instant — cut-and-come-again crops
  // (harvestWindowMonths) go on yielding for several more months after the
  // first picking, and the bar should show the WHOLE window you can pick
  // from, not just claim "ready" for one month then vanish while the plant
  // is still actively producing. storageMonths crops (one-shot harvest,
  // kept afterward) are deliberately NOT extended here — that's a
  // fresh-in-the-BED question, not a stored-on-the-shelf one; see the Food
  // availability chart for the storage story.
  const harvestEnd = harvest + (crop.harvestWindowMonths ?? 0);
  // A farmer-confirmed already-growing crop can legitimately be a few
  // months in the past (nearest direction); a planned-but-not-yet-sown one
  // (auto-suggested or manually added) never can be — it hasn't happened,
  // so it always resolves to its NEXT reachable occurrence. See
  // forwardOnlyOffset's own comment for why this matters concretely now.
  const sowOffset = planting.existing
    ? nearestSignedOffset(planting.sowMonth, currentMonth)
    : forwardOnlyOffset(planting.sowMonth, currentMonth);
  // One entry per visible repeat of the annual cycle (see barInstances).
  const instances = barInstances(sowOffset, planting.sowMonth, harvestEnd);
  if (!instances.length) return null; // entirely outside the visible window
  const fraction = planting.areaFraction ?? 1;
  const fLabel = fractionLabel(fraction);
  // Existing (already-growing) crops get a muted olive treatment so the eye
  // separates "already there" from "still to sow" at a glance. Each bar also
  // fades from "just sown" to a golden "ready to harvest" tone across its
  // length, so you can see how far along a planting is at a glance.
  const [barFrom, barTo] = planting.existing ? ['#8C8654', '#B8934A'] : ['#7FAE6E', '#D4A017'];
  const segMonthCount = (seg: Segment) => seg.end - seg.start + 1;
  // How many of a copy's months are its "ready to pick" window. Anchored to
  // where harvest actually STARTS (that copy's OWN unclipped start + green
  // duration), not a flat harvestWindowMonths+1 count — a flat count is only
  // correct when nothing gets clipped. When the window's right edge clips the
  // bar (a long harvestWindowMonths crop landing near the far edge), a flat
  // count swallows still-green months into the gold cap, painting the whole
  // bar as "ready" when part of it hasn't started growing yet. Clamping
  // against seg.start also still correctly renders 100% gold for an existing
  // crop whose green phase is entirely in the past.
  //
  // Measured per COPY (seg.rawStart, not the shared sowOffset): the second
  // cycle's harvest starts 12 months after the first one's, and measuring
  // both from cycle 0 would paint the repeat gold from end to end.
  const greenSpan = ((harvest - planting.sowMonth) % 12 + 12) % 12;
  const readyMonthsFor = (seg: Segment) =>
    Math.max(0, Math.min(seg.end - Math.max(seg.rawStart + greenSpan, seg.start) + 1, segMonthCount(seg)));
  // Year two is a POSITION on the axis (past the ↻ seam), not "the second copy
  // of this bar". Those two are not the same thing and using the copy index
  // looked wrong on screen: an already-growing crop resolves to a negative sow
  // offset, so ITS second copy lands in, say, March — inside year one — and
  // faded it while the bed's other bars stayed solid. Whatever sits left of the
  // seam is the year the farmer is planting; that reads full strength.
  const isYearTwo = (seg: Segment) => seg.rawStart >= 12;
  const harvestLabel = crop.harvestWindowMonths ? `${monthLabel(harvest)}-${monthLabel(harvestEnd)}` : monthLabel(harvest);

  return (
    <div style={{ position: 'relative', height: 30, marginBottom: 3 }}>
      {instances.map((seg, i) => (
        <button
          key={i}
          onClick={onTap}
          className="font-sans"
          style={{
            position: 'absolute', left: `${leftPct(seg.start)}%`, width: `${widthPct(seg)}%`, top: 2, bottom: 2,
            background: BAR_STYLE === 'gradient' ? barGradient(seg, seg.start, segMonthCount(seg), barFrom, barTo) : barFrom,
            color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 11, fontWeight: 600, textAlign: 'left', paddingLeft: 6, paddingRight: 4,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer',
            // The repeat is drawn quieter than the year you are about to
            // plant. It is the same plan coming round again, not a second,
            // separately-decided year — and with Rotate crops on it is
            // explicitly NOT what next season will look like. Full-strength
            // colour on both would claim a certainty this plan doesn't have.
            opacity: isYearTwo(seg) ? 0.5 : 1,
          }}
          title={`${crop.name} — sow ${monthLabel(planting.sowMonth)}, harvest ${harvestLabel}${fraction < 1 ? ` · ${fLabel} of bed` : ''}${planting.existing ? ' · already growing' : ''}${isYearTwo(seg) ? ' · year two, the same cycle coming round again' : ''}`}
        >
          {BAR_STYLE === 'solid' && (
            // The "ready to harvest" marker — a hard colour + a line, not a
            // blend: a solid gold cap over the crop's WHOLE fresh-harvest
            // window (one month for a one-shot harvest, several for a
            // cut-and-come-again crop), with a crisp divider where it meets
            // the growing colour. Can legitimately reach 100% width (viewing
            // a crop from partway through its own harvest window, once the
            // growing part has scrolled off the left edge) — MUST render
            // behind the name label below, or a wide "ready" cap blots the
            // name out entirely.
            <div
              style={{
                position: 'absolute', top: 0, bottom: 0, right: 0, width: `${(100 * readyMonthsFor(seg)) / segMonthCount(seg)}%`,
                background: barTo, borderLeft: '2px solid rgba(255,255,255,0.85)',
              }}
            />
          )}
          {/* Every copy carries the crop name. A repeat with no label is the
              thing that made the far columns unreadable in the first place —
              a farmer panning right must be able to see WHAT is in the bed
              there without panning back a year to find out. */}
          <span style={{ position: 'relative', zIndex: 1 }}>
            {crop.icon} {crop.name}{fLabel ? ` (${fLabel})` : ''}
          </span>
        </button>
      ))}
      {/* The transplant marker. It used to read "(tr)", which the app's own
          owner looked at and asked what it stood for — an abbreviation nobody
          can decode is not a label, it's a puzzle. It now says the word, wears
          the same 🪴 seedling glyph the picker and the seed BOQ use for
          "raised in a tray first", and is TAPPABLE (opening the same planting
          popover the bar itself opens) so the meaning is reachable rather than
          guessable. The timeline legend below the grid spells it out too. */}
      {crop.transplant && !planting.existing && instances.map((seg, i) => {
        // Anchored to THIS copy's own unclipped sow offset (not re-derived
        // independently, and not shared across copies) so it always lands
        // right after that copy's sow month and never contradicts the bar
        // it belongs to.
        const trOffset = seg.rawStart + 1;
        if (trOffset < 0 || trOffset > DISPLAY_MONTHS - 1) return null;
        return (
          <button
            key={`tr${i}`}
            onClick={onTap}
            className="font-sans"
            style={{
              position: 'absolute', left: `${leftPct(trOffset) + COL_PCT / 2}%`, top: -3, transform: 'translateX(-50%)',
              fontSize: 9, fontWeight: 700, color: '#9A6018', background: '#FFFEFA',
              border: '1px solid rgba(154,96,24,0.35)', padding: '0 3px', borderRadius: 4,
              whiteSpace: 'nowrap', cursor: 'pointer', lineHeight: 1.5, zIndex: 2,
              opacity: isYearTwo(seg) ? 0.5 : 1,
            }}
            title={`Transplant — move the ${crop.name.toLowerCase()} seedlings out of their tray and into the bed in ${monthLabel(planting.sowMonth + 1)}`}
            aria-label={`Transplant ${crop.name} in ${monthLabel(planting.sowMonth + 1)}`}
          >
            🪴 transplant
          </button>
        );
      })}
    </div>
  );
}

// ── Crop picker modal ────────────────────────────────────────────────────

function CropPickerModal({
  search, onSearch, crop, month, pattern, fraction, onFraction, existing, onExisting, overlap,
  isEditing, favouriteCropKeys, onToggleFavourite, allowBedSharing, onEnableBedSharing, onPick, onBack, onMonth, onConfirm, onClose,
  isPlot,
}: {
  search: string;
  onSearch: (v: string) => void;
  crop: CropDef | null;
  month: number;
  pattern: RainPattern;
  fraction: number;
  onFraction: (f: number) => void;
  existing: boolean;
  onExisting: (v: boolean) => void;
  overlap: number;
  isEditing: boolean;
  favouriteCropKeys: Set<string>;
  onToggleFavourite: (cropKey: string) => void;
  allowBedSharing: boolean;
  onEnableBedSharing: () => void;
  onPick: (c: CropDef) => void;
  onBack: () => void;
  onMonth: (m: number) => void;
  onConfirm: () => void;
  onClose: () => void;
  /** A staple plot takes one crop at FULL area — no fraction presets, no sharing opt-in. */
  isPlot: boolean;
}) {
  // Favourites sort to the top of whatever's currently filtered — a quick-
  // access shortlist, same idea as Tend's personal Crop Library, just
  // without per-farmer custom crop data.
  const filtered = CROPS
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(favouriteCropKeys.has(b.key)) - Number(favouriteCropKeys.has(a.key)));
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,10,0.35)' }} />
      <div
        className="rounded-2xl"
        style={{ position: 'relative', width: '100%', maxWidth: 440, maxHeight: '82vh', overflowY: 'auto', background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4', position: 'sticky', top: 0, background: '#FFFEFA', zIndex: 1 }}>
          <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F' }}>
            {crop ? `${crop.icon} ${crop.name}` : 'Add a crop'}
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62' }}>
            <X size={18} />
          </button>
        </div>

        {!crop ? (
          <div className="p-4">
            <div className="flex items-center gap-2 rounded-xl px-3 py-2 mb-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
              <Search size={14} style={{ color: '#8C7A62' }} />
              <input
                autoFocus
                value={search}
                onChange={(e) => onSearch(e.target.value)}
                placeholder="Search crops…"
                className="flex-1 font-sans outline-none bg-transparent"
                style={{ fontSize: 14, color: '#20190F' }}
              />
            </div>
            <div className="space-y-1">
              {filtered.map((c) => {
                const windowMonths = c.sowMonths[pattern];
                const isFav = favouriteCropKeys.has(c.key);
                return (
                  <div
                    key={c.key}
                    className="w-full flex items-center gap-1 pl-2.5 pr-1.5 py-2 rounded-xl"
                    style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}
                  >
                    <button
                      onClick={() => onPick(c)}
                      className="flex-1 min-w-0 flex items-center gap-2.5 text-left"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      <span style={{ fontSize: 20 }}>{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{c.name}</span>
                          <SeedBadge transplant={!!c.transplant} />
                          {isSpaceHungry(c) && <span title="Space-hungry — wants its own bed" style={{ fontSize: 11 }}>📏</span>}
                        </div>
                        <div className="flex gap-0.5 mt-1">
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                            <span key={m} style={{ width: 6, height: 6, borderRadius: 2, background: windowMonths.includes(m) ? '#3F7A3C' : '#E2D8C4' }} />
                          ))}
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => onToggleFavourite(c.key)}
                      aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 6, fontSize: 16, color: isFav ? '#C07A1E' : '#D8CFBC' }}
                    >
                      {isFav ? '★' : '☆'}
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="font-sans text-center py-6" style={{ fontSize: 13, color: '#8C7A62' }}>No crops match “{search}”.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <button onClick={onBack} className="font-sans" style={{ fontSize: 12, color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ‹ Back to list
              </button>
              <button
                onClick={() => onToggleFavourite(crop.key)}
                aria-label={favouriteCropKeys.has(crop.key) ? 'Remove from favourites' : 'Add to favourites'}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: favouriteCropKeys.has(crop.key) ? '#C07A1E' : '#D8CFBC' }}
              >
                {favouriteCropKeys.has(crop.key) ? '★' : '☆'}
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              <SeedBadge transplant={!!crop.transplant} large />
              {isSpaceHungry(crop) && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-sans" style={{ fontSize: 11, background: 'rgba(192,122,30,0.12)', color: '#9A6018', border: '1px solid rgba(192,122,30,0.3)' }}>
                  📏 space-hungry
                </span>
              )}
            </div>
            <div className="font-sans mb-3" style={{ fontSize: 13, color: '#5C5040', lineHeight: 1.5 }}>
              {sowingInstruction(crop)} · {crop.daysToHarvest} days to harvest<br />
              {crop.note}
            </div>
            {isSpaceHungry(crop) && (
              <div className="font-sans mb-3 px-2.5 py-2 rounded-lg" style={{ fontSize: 12, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                📏 {crop.name} wants room to spread — best in its own dedicated bed rather than shared or split with other crops.
              </div>
            )}
            {crop.varieties && crop.varieties.length > 0 && (
              <div className="mb-3">
                <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Which variety?</div>
                <div className="space-y-1.5">
                  {crop.varieties.map((v, i) => (
                    <div key={i} className="px-2.5 py-2 rounded-lg" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
                      <div className="font-sans font-semibold" style={{ fontSize: 12.5, color: '#20190F' }}>{v.name}</div>
                      <div className="font-mono" style={{ fontSize: 10.5, color: '#8C7A62', marginBottom: 2 }}>Best for: {v.bestFor}</div>
                      <div className="font-sans" style={{ fontSize: 12, color: '#5C5040' }}>{v.note}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Sow month</div>
            <div className="grid grid-cols-6 gap-1.5 mb-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const inWindow = crop.sowMonths[pattern].includes(m);
                const selected = m === month;
                return (
                  <button
                    key={m}
                    onClick={() => onMonth(m)}
                    className="font-sans font-semibold rounded-lg py-1.5"
                    style={{
                      fontSize: 12,
                      background: selected ? '#1F4D2B' : inWindow ? 'rgba(63,122,60,0.12)' : 'rgba(192,122,30,0.12)',
                      color: selected ? '#F7F2E9' : inWindow ? '#1F4D2B' : '#9A6018',
                      border: selected ? 'none' : `1px solid ${inWindow ? 'rgba(63,122,60,0.3)' : 'rgba(192,122,30,0.35)'}`,
                      cursor: 'pointer',
                    }}
                  >
                    {MONTHS_SHORT[m - 1]}
                  </button>
                );
              })}
            </div>
            <div className="font-sans mb-1.5" style={{ fontSize: 12, color: '#5C5040' }}>
              Harvest window: <strong style={{ color: '#20190F' }}>{monthLabel(harvestMonth(month, crop.daysToHarvest))}</strong>
              {crop.transplant && <> · transplant around <strong style={{ color: '#20190F' }}>{monthLabel(month + 1)}</strong></>}
            </div>
            {!crop.sowMonths[pattern].includes(month) && (
              <div className="font-sans mb-3" style={{ fontSize: 11, color: '#9A6018' }}>⚠ Outside the usual sowing window for this region — still allowed.</div>
            )}

            <div className="font-sans uppercase tracking-widest mb-1.5 mt-2" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>{isPlot ? 'How much of the plot?' : 'How much of the bed?'}</div>
            {isPlot ? (
              <div className="font-sans mb-2 px-2.5 py-2 rounded-lg" style={{ fontSize: 11.5, color: '#5C5040', background: '#FBF6EC', border: '1px solid #E0CD9E' }}>
                🌽 The whole plot — a staple plot grows one field crop at a time and rotates to a
                different group next season, so there are no half-shares here.
              </div>
            ) : allowBedSharing || fraction < 1 ? (
              <>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {FRACTION_PRESETS.map((f) => (
                    <button
                      key={f.label}
                      onClick={() => onFraction(f.value)}
                      className="font-sans font-semibold rounded-lg py-1.5"
                      style={{
                        fontSize: 11.5,
                        background: fraction === f.value ? '#1F4D2B' : '#F5F0E8',
                        color: fraction === f.value ? '#F7F2E9' : '#5C5040',
                        border: `1px solid ${fraction === f.value ? '#1F4D2B' : '#E2D8C4'}`,
                        cursor: 'pointer',
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {overlap + fraction > 1.001 && (
                  <div className="font-sans mb-2" style={{ fontSize: 11, color: '#9A6018' }}>
                    ⚠ This bed already has {Math.round(overlap * 100)}% committed to other crops over this period — {Math.round((overlap + fraction) * 100)}% total is more than the bed. Still allowed, but they'll compete for space.
                  </div>
                )}
              </>
            ) : (
              // Off by default — splitting/intercropping a bed needs a bit of
              // gardening judgement, so it's a one-time opt-in rather than
              // offered unprompted on every crop (same reasoning as vines
              // defaulting to "grow elsewhere"). Once enabled it stays on.
              <div className="flex items-center justify-between mb-2 px-2.5 py-2 rounded-lg" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
                <span className="font-sans font-semibold" style={{ fontSize: 12, color: '#5C5040' }}>Whole bed</span>
                <button
                  onClick={onEnableBedSharing}
                  className="font-sans underline"
                  style={{ fontSize: 11.5, color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  Split this bed (intercrop or stagger a succession)?
                </button>
              </div>
            )}

            <label className="flex items-center gap-2 font-sans mb-3 cursor-pointer" style={{ fontSize: 13, color: '#5C5040' }}>
              <input type="checkbox" checked={existing} onChange={(e) => onExisting(e.target.checked)} style={{ accentColor: '#1F4D2B' }} />
              This is already growing (not a new planting)
            </label>

            <button
              onClick={onConfirm}
              className="w-full font-display font-semibold rounded-xl py-2.5 mt-1"
              style={{ fontSize: 14, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
            >
              {isEditing ? 'Save changes' : existing ? 'Add as existing' : 'Add to bed'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Planting popover ─────────────────────────────────────────────────────

function PlantingPopover({ planting, bedAreaM2, allPlantings, substitute, onEdit, onRemove, onReplace, onClose }: {
  planting: Planting;
  bedAreaM2: number;
  allPlantings: Planting[];
  substitute: CropDef | null;
  onEdit: () => void;
  onRemove: () => void;
  onReplace: (cropKey: string) => void;
  onClose: () => void;
}) {
  // Remove asks first, rather than removing immediately — the substitute
  // suggestion (when there is one) IS the "can't get this seed, what
  // instead?" answer, and this is the natural place to offer it: right when
  // the farmer has already decided this crop isn't happening.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const crop = cropByKey(planting.cropKey);
  if (!crop) return null;
  const harvest = harvestMonth(planting.sowMonth, crop.daysToHarvest);
  const harvestEnd = harvest + (crop.harvestWindowMonths ?? 0);
  const harvestLabel = crop.harvestWindowMonths ? `${monthLabel(harvest)}-${monthLabel(harvestEnd)}` : monthLabel(harvest);
  const yieldKg = estimatedYieldKgAdjusted(planting, bedAreaM2, allPlantings);
  const genuinelyIntercropped = isGenuinelyIntercropped(planting, allPlantings);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,10,0.35)' }} />
      <div
        className="rounded-2xl p-4"
        style={{ position: 'relative', width: '100%', maxWidth: 300, background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
      >
        <div className="flex items-start justify-between mb-2">
          <span className="font-display font-semibold flex items-center gap-1.5" style={{ fontSize: 15, color: '#20190F' }}>
            {crop.icon} {crop.name} <SeedBadge transplant={!!crop.transplant} />
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62' }}>
            <X size={16} />
          </button>
        </div>
        {(planting.areaFraction ?? 1) < 1 && (
          <div className="inline-block font-sans font-semibold mb-2 px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(63,122,60,0.12)', color: '#1F4D2B' }}>
            {fractionLabel(planting.areaFraction ?? 1)} of bed{genuinelyIntercropped ? ' — intercropped' : ''}
          </div>
        )}
        {genuinelyIntercropped && (
          <p className="font-sans mb-2" style={{ fontSize: 11, color: '#9A8268' }}>
            Sharing this bed with another crop at the same time — yield estimated at 90% to allow for the two competing a little, not counted as fully independent.
          </p>
        )}
        {planting.existing && (
          <div className="inline-block font-sans font-semibold mb-2 ml-1 px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(140,134,84,0.18)', color: '#5C5040' }}>
            Already growing
          </div>
        )}
        <div className="font-sans space-y-1 mb-3" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
          <div>Sow {monthLabel(planting.sowMonth)} → harvest {harvestLabel}</div>
          <div>{sowingInstruction(crop)} · {crop.daysToHarvest} days to harvest</div>
          <div>{crop.note}</div>
        </div>
        <div className="font-mono font-bold mb-3" style={{ fontSize: 18, color: '#1F4D2B' }}>≈ {yieldKg.toFixed(1)} kg est. yield</div>
        {confirmingRemove ? (
          <div className="space-y-2">
            <div className="font-sans" style={{ fontSize: 12.5, color: '#5C5040' }}>Remove {crop.name}?</div>
            {substitute && (
              <button
                onClick={() => onReplace(substitute.key)}
                className="w-full text-left font-display font-semibold rounded-xl py-2 px-3"
                style={{ fontSize: 13, background: 'rgba(31,77,43,0.10)', border: '1px solid rgba(31,77,43,0.3)', color: '#1F4D2B', cursor: 'pointer' }}
              >
                🔄 Replace with {substitute.icon} {substitute.name} instead
              </button>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingRemove(false)}
                className="flex-1 font-display font-semibold rounded-xl py-2"
                style={{ fontSize: 13, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={onRemove}
                className="flex-1 font-display font-semibold rounded-xl py-2"
                style={{ fontSize: 13, background: 'rgba(180,50,40,0.1)', color: '#A83A2C', border: '1px solid rgba(180,50,40,0.25)', cursor: 'pointer' }}
              >
                Remove without replacing
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex-1 font-display font-semibold rounded-xl py-2"
              style={{ fontSize: 13, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
            >
              Edit
            </button>
            <button
              onClick={() => setConfirmingRemove(true)}
              className="flex-1 font-display font-semibold rounded-xl py-2"
              style={{ fontSize: 13, background: 'rgba(180,50,40,0.1)', color: '#A83A2C', border: '1px solid rgba(180,50,40,0.25)', cursor: 'pointer' }}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Auto-suggest: goals questionnaire + review ──────────────────────────

const GOAL_OPTIONS: { key: GardenGoal; label: string; blurb: string }[] = [
  { key: 'family', label: 'Feed my family', blurb: 'Grow a variety for the household' },
  { key: 'commercial', label: 'Grow extra to sell', blurb: 'Concentrate on a few crops' },
  { key: 'hybrid', label: 'Both', blurb: 'Feed us first, sell the surplus' },
];
const HOUSEHOLD_OPTIONS: { key: HouseholdSize; label: string }[] = [
  { key: 'small', label: '1-2 people' },
  { key: 'medium', label: '3-5 people' },
  { key: 'large', label: '6+ people' },
];
const RHYTHM_OPTIONS: { key: HarvestRhythm; label: string; blurb: string }[] = [
  { key: 'steady', label: 'Steady supply', blurb: 'A little, regularly' },
  { key: 'few-big', label: 'A few big harvests', blurb: 'One flush at a time is fine' },
];

function AutoSuggestModal({
  phase, goal, onGoal, household, onHousehold, focusCount, onFocusCount,
  groups, onToggleGroup, rhythm, onRhythm, rotateCrops, onRotateCrops,
  allowVinesInBeds, onAllowVinesInBeds, result, onGenerate, onAccept, onBackToQuestions, onClose,
}: {
  phase: 'questions' | 'review';
  goal: GardenGoal; onGoal: (g: GardenGoal) => void;
  household: HouseholdSize; onHousehold: (h: HouseholdSize) => void;
  focusCount: number; onFocusCount: (n: number) => void;
  groups: FoodGroup[]; onToggleGroup: (g: FoodGroup) => void;
  rhythm: HarvestRhythm; onRhythm: (r: HarvestRhythm) => void;
  rotateCrops: boolean; onRotateCrops: (v: boolean) => void;
  allowVinesInBeds: boolean; onAllowVinesInBeds: (v: boolean) => void;
  result: AutoSuggestResult | null;
  onGenerate: () => void; onAccept: () => void; onBackToQuestions: () => void; onClose: () => void;
}) {
  const tileStyle = (active: boolean): CSSProperties => ({
    background: active ? '#1F4D2B' : '#FFFFFF', color: active ? '#F7F2E9' : '#5C5040',
    border: `1px solid ${active ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer',
  });

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,10,0.35)' }} />
      <div
        className="rounded-2xl"
        style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', background: '#FFFEFA', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4', position: 'sticky', top: 0, background: '#FFFEFA', zIndex: 1 }}>
          <span className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: '#20190F' }}>
            ✨ {phase === 'questions' ? 'Auto-suggest a plan' : 'Suggested plan'}
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62' }}>
            <X size={18} />
          </button>
        </div>

        {phase === 'questions' ? (
          <div className="p-4 space-y-4">
            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>What's the main reason you're growing this year?</div>
              <div className="space-y-1.5">
                {GOAL_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => onGoal(o.key)} className="w-full text-left px-3 py-2 rounded-xl transition-all" style={tileStyle(goal === o.key)}>
                    <div className="font-display font-semibold" style={{ fontSize: 13 }}>{o.label}</div>
                    <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>{o.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            {goal !== 'commercial' && (
              <div>
                <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>About how many people eat from this garden?</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {HOUSEHOLD_OPTIONS.map((o) => (
                    <button key={o.key} onClick={() => onHousehold(o.key)} className="py-1.5 rounded-lg text-center font-display font-semibold transition-all" style={{ ...tileStyle(household === o.key), fontSize: 12.5 }}>
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {goal !== 'family' && (
              <div>
                <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>How many crops do you want to focus on selling?</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 2, 3].map((n) => (
                    <button key={n} onClick={() => onFocusCount(n)} className="py-1.5 rounded-lg text-center font-display font-semibold transition-all" style={{ ...tileStyle(focusCount === n), fontSize: 12.5 }}>
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>
                What do you want to grow? {goal === 'commercial' ? '(pick 1-3)' : ''}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ALL_GROUPS.map((g) => {
                  const meta = FOOD_GROUP_META[g];
                  return (
                    <button key={g} onClick={() => onToggleGroup(g)} className="py-1.5 px-2 rounded-lg text-left font-sans font-semibold transition-all inline-flex items-center gap-1.5" style={{ ...tileStyle(groups.includes(g)), fontSize: 12 }}>
                      <span>{meta.icon}</span> {meta.label}
                    </button>
                  );
                })}
              </div>
              <p className="font-mono mt-1.5" style={{ fontSize: 10.5, color: '#9A8268' }}>
                {groups.length === 0
                  ? (goal === 'commercial'
                    ? 'Nothing picked yet — leave it this way to rank the whole catalogue by productivity, or pick 1-3 to focus on a specific kind of crop.'
                    : "Not sure — we'll suggest for you.")
                  : `${groups.length} of ${ALL_GROUPS.length} selected.`}
              </p>
            </div>

            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>How do you want your harvests spread out?</div>
              <div className="grid grid-cols-2 gap-1.5">
                {RHYTHM_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => onRhythm(o.key)} className="py-1.5 px-2 rounded-lg text-left transition-all" style={tileStyle(rhythm === o.key)}>
                    <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>{o.label}</div>
                    <div className="font-mono" style={{ fontSize: 10, opacity: 0.85 }}>{o.blurb}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={() => onRotateCrops(!rotateCrops)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5"
              style={tileStyle(rotateCrops)}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{rotateCrops ? '🔁' : '⭘'}</span>
              <span>
                <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>Rotate crops between beds</div>
                <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>
                  Avoids repeating the same crop family on a bed that just grew it — good practice, and keeps
                  next season's beds rotation-friendly too (run this again next season with this year's plan still
                  showing, and it reads that history).
                </div>
              </span>
            </button>

            <button
              onClick={() => onAllowVinesInBeds(!allowVinesInBeds)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5"
              style={tileStyle(allowVinesInBeds)}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{allowVinesInBeds ? '🍉' : '⭘'}</span>
              <span>
                <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>Grow big vines in a veg bed anyway</div>
                <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>
                  Off by default: watermelon, pumpkin and butternut sprawl too much for a veg bed and only fill it
                  for part of the year — we'll recommend a dedicated plot, a property edge, or a food forest area
                  instead. Turn this on only if you'd rather use one of your regular beds for them anyway.
                </div>
              </span>
            </button>

            <button
              onClick={onGenerate}
              className="w-full font-display font-semibold rounded-xl py-2.5"
              style={{ fontSize: 14, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
            >
              ✨ Suggest a plan
            </button>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {!result || result.plantings.length === 0 ? (
              <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                Nothing fit this time — your beds may already be full, or the crops you picked are all out of season right now. Try different food groups, or check "Later this year" below.
              </p>
            ) : (
              <>
                <p className="font-sans mb-2" style={{ fontSize: 13, color: '#5C5040' }}>{result.plantings.length} planting{result.plantings.length > 1 ? 's' : ''} suggested:</p>
                <div className="space-y-1 mb-2">
                  {result.plantings.map((p) => {
                    const crop = cropByKey(p.cropKey);
                    if (!crop) return null;
                    const h = harvestMonth(p.sowMonth, crop.daysToHarvest);
                    return (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg font-sans" style={{ fontSize: 12.5, background: '#FFFFFF', border: '1px solid #E2D8C4' }}>
                        <span>{crop.icon} {crop.name}{p.areaFraction && p.areaFraction < 1 ? ` (${fractionLabel(p.areaFraction)})` : ''}</span>
                        <span style={{ color: '#8C7A62' }}>sow {monthLabel(p.sowMonth)} → harvest {monthLabel(h)}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {result && result.notes.length > 0 && (
              <div className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 11.5, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                {result.notes.map((n, i) => <div key={i}>{n}</div>)}
              </div>
            )}
            {result && result.laterThisYear.length > 0 && (
              <div className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 11.5, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                <div className="font-display font-semibold mb-1" style={{ fontSize: 11.5, color: '#20190F' }}>Later this year</div>
                {result.laterThisYear.map((l) => {
                  const crop = cropByKey(l.cropKey);
                  return <div key={l.cropKey}>{crop?.icon} {crop?.name} — best sown around {monthLabel(l.nextWindowMonth)}</div>;
                })}
              </div>
            )}
            <div className="flex gap-2 pt-1">
              <button onClick={onBackToQuestions} className="px-3 py-2 rounded-xl font-mono transition-all" style={{ fontSize: 12, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                ‹ Back
              </button>
              {result && result.plantings.length > 0 && (
                <button onClick={onAccept} className="flex-1 font-display font-semibold rounded-xl py-2" style={{ fontSize: 13, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}>
                  Add {result.plantings.length} planting{result.plantings.length > 1 ? 's' : ''} to my plan
                </button>
              )}
              <button onClick={onClose} className="px-3 py-2 rounded-xl font-mono transition-all" style={{ fontSize: 12, background: '#EDE7DB', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

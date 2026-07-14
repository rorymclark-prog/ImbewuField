'use client';

// Facilitator crop plan — a Tend-style planting timeline built on the beds
// the facilitator has already placed on the design canvas (Planting layer).
//
// Reads the shared facilitator design (localStorage, read-only) for bed
// geometry + derives the site's rainfall pattern from bgSite, then keeps its
// own crop-plan store (lib/crop-plan.ts) for what's actually sown where.
// Zero network, zero new deps.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Search, X, Menu, ChevronDown } from 'lucide-react';
import NavDrawer from '@/components/NavDrawer';
import type { FacilitatorDesignState } from '@/lib/facilitator-design';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import type { Design } from '@/lib/db/types';
import { myDesigns } from '@/lib/db/queries';
import { nearestRainfall } from '@/lib/water-calc';
import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import { CROPS, cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed, Planting, CropPlanState, CropTask, FoodAvailabilityItem, FoodValueMonth } from '@/lib/crop-plan';
import {
  loadCropPlan, saveCropPlan, harvestMonth, tasksForPlan, estimatedYieldKgAdjusted, nextValidSowMonth,
  isSpaceHungry, bedOverlapFraction, seedBoqForPlan, buildYearReport, buildFoodAvailability, buildFoodValueByMonth, suggestSubstituteCrop,
  loadFavouriteCropKeys, saveFavouriteCropKeys, isGenuinelyIntercropped, loadAllowBedSharing, saveAllowBedSharing,
} from '@/lib/crop-plan';
import type { FoodGroup } from '@/lib/crop-groups';
import { FOOD_GROUP_META, foodGroupOf, ROTATION_SEQUENCE, ROTATION_BLURB } from '@/lib/crop-groups';
import type { AutoSuggestAnswers, AutoSuggestResult, GardenGoal, HouseholdSize, HarvestRhythm } from '@/lib/crop-autosuggest';
import { autoSuggestPlan } from '@/lib/crop-autosuggest';
import type { CropPrice } from '@/lib/crop-prices';
import { UNPRICED_CROPS, priceFor, loadCropPriceOverrides, saveCropPriceOverrides } from '@/lib/crop-prices';

const ALL_GROUPS: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium_aromatic', 'fruiting_veg', 'staple_grain'];

// The rolling timeline shows this many months ahead from today (column 0),
// scrollable — a full 2 years rather than a hard 12-month wall, so a
// genuinely-reachable future planting (or a farmer just wanting to look
// ahead into "next year") isn't cut off arbitrarily at column 12. Grid
// container min-widths below scale off this so columns stay a readable
// size rather than getting squeezed as this grows.
const DISPLAY_MONTHS = 24;
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

// Segment.start/end are already DISPLAY-COLUMN indices (0-11, 0 = this
// month) — not real calendar months. There's only ever one segment now (see
// barSegments below), clipped to the visible window if it runs off either
// edge.
interface Segment { start: number; end: number }

// The grid is a ROLLING 12-month window starting from the current real
// month (column 0 = this month), not a fixed Jan-Dec calendar year — a
// farmer opening the plan in July should see Jul-Jun ahead, not stare at
// six already-past, unfillable months before anything useful starts.
//
// A sowMonth on its own is ambiguous without a year (there's no year field
// anywhere in this data model) — it could mean "the next time this month
// comes around" OR "the most recent time it happened" (e.g. an `existing`
// crop sown a couple of months ago, already growing). Resolving it as
// ALWAYS-FORWARD broke exactly that case: an existing tomato planting sown
// in May rendered as if it wouldn't be sown for another 10 months, instead
// of showing it already in progress with harvest coming up soon. Instead,
// pick whichever direction (forward or back) is NEARER to today — auto-
// suggest's own output is always ≤5 months forward anyway (its own
// DELAYED_START_THRESHOLD_MONTHS gate), so this never changes behaviour
// there; it only fixes the ambiguous manual/existing cases.
function nearestSignedOffset(m: number, originMonth: number): number {
  const fwd = ((m - originMonth) % 12 + 12) % 12; // 0..11
  return fwd > 6 ? fwd - 12 : fwd; // prefer whichever direction is closer; ties favour forward
}

/**
 * The single visible bar segment for a sow→harvest span, in display-column
 * space, clipped to the DISPLAY_MONTHS-column window. `harvest` is always
 * the crop's OWN forward span from `sowMonth` (a crop never takes longer
 * than ~12 months, so this offset is unambiguous regardless of "today");
 * only the sow event's OWN position relative to today needs the
 * nearest-direction resolution above. Returns [] if the whole span falls
 * outside the visible window (a long-since-fully-harvested existing crop,
 * or a genuinely far-future manual entry).
 */
function barSegments(sowMonth: number, harvest: number, originMonth: number): Segment[] {
  const sowOffset = nearestSignedOffset(sowMonth, originMonth);
  const spanMonths = ((harvest - sowMonth) % 12 + 12) % 12; // crop's own forward duration, 0-11
  const harvestOffset = sowOffset + spanMonths;
  const start = Math.max(sowOffset, 0);
  const end = Math.min(harvestOffset, DISPLAY_MONTHS - 1);
  if (end < start) return [];
  return [{ start, end }];
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

// Verb phrase per task action — 'prep'/'mulch' need a bit more than a single
// word to say what's actually involved (compost/kraal manure, water-in), the
// others read fine as plain verbs.
const TASK_VERB: Record<CropTask['action'], string> = {
  prep: 'prep bed (compost + kraal manure, then let it rest) for',
  sow: 'sow',
  transplant: 'transplant',
  mulch: 'water in & mulch',
  harvest: 'harvest',
};

function taskSentence(tasks: CropTask[]): string {
  if (tasks.length === 0) return 'nothing due';
  return tasks.map((t) => `${TASK_VERB[t.action]} ${t.cropName.toLowerCase()} (${t.bedLabel})`).join(' · ');
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function FacilitatorCropsPage() {
  const [design, setDesign] = useState<FacilitatorDesignState | null | undefined>(undefined);
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
  const needsSitePicker = !!myDesignsList && (switchingSite || (myDesignsList.length > 1 && chosenDesignId === null));

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

  useEffect(() => {
    setDesign(loadFacilitatorState());
    setPlan(loadCropPlan());
    setCurrentMonth(new Date().getMonth() + 1);
    setFavouriteCropKeys(loadFavouriteCropKeys());
    setAllowBedSharing(loadAllowBedSharing());
    setPriceOverrides(loadCropPriceOverrides());
    setMounted(true);
    myDesigns().then(setMyDesignsList).catch(() => setMyDesignsList([]));
  }, []);

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
  const beds = designBeds.length > 0 ? designBeds : (useVirtual ? [VIRTUAL_BED] : []);

  const region = design?.bgSite ? nearestRainfall(design.bgSite.lat, design.bgSite.lon) : null;
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

  const seedBoq = useMemo(() => seedBoqForPlan(plantings, beds), [plantings, beds]);
  const yearReport = useMemo(() => buildYearReport(plantings, beds), [plantings, beds]);
  const foodAvailability = useMemo(() => buildFoodAvailability(plantings, beds), [plantings, beds]);
  const foodValueByMonth = useMemo(() => buildFoodValueByMonth(plantings, beds, priceOverrides), [plantings, beds, priceOverrides]);

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
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-x-auto" style={{ height: 56, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          className="flex-shrink-0 flex items-center justify-center rounded-xl"
          style={{ width: 34, height: 34, background: 'rgba(32,25,15,0.06)', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
        >
          <Menu size={17} strokeWidth={1.7} />
        </button>
        <Link
          href="/facilitator"
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
          style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#20190F', textDecoration: 'none' }}
        >
          ‹ Back to design
        </Link>
        {myDesignsList && myDesignsList.length > 0 && (
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
        {myDesignsList && myDesignsList.length > 0 ? (
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
            <span className="font-sans truncate" style={{ fontSize: 11, color: '#8C7A62', maxWidth: 220 }}>{designTitle}</span>
          </div>
        )}
        <div className="flex-1" />
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
                style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
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
        <EmptyState onVirtual={() => setUseVirtual(true)} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-3 md:px-5 py-4" style={{ maxWidth: 1100 }}>
            {useVirtual && designBeds.length === 0 && (
              <div className="mb-3 px-3 py-2 rounded-xl font-sans" style={{ fontSize: 12, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                Planning without a map — one virtual 10 m² bed.{' '}
                <Link href="/facilitator" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>Place real beds on the Planting step</Link> to replace it.
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

            {/* Timeline */}
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: GRID_MIN_WIDTH }}>
                  {/* Month header row */}
                  <div className="flex" style={{ borderBottom: '1px solid #E2D8C4' }}>
                    <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#FBF6EC', borderRight: '1px solid #E2D8C4', padding: '8px 10px' }}>
                      <span className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Bed</span>
                    </div>
                    <div className="flex" style={{ flex: '1 1 auto' }}>
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

                  {/* Bed rows */}
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

            {/* Tasks + harvest */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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
                  <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Looking ahead</div>
                  <div className="space-y-1">
                    {monthOrder.map((m, i) => {
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
                </div>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>🥬 Estimated harvest</div>
                <div className="font-mono font-bold mb-2" style={{ fontSize: 26, color: '#1F4D2B' }}>
                  {newYieldKg.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500, color: '#8C7A62' }}>kg/yr to plant</span>
                </div>
                {existingYieldKg > 0 && (
                  <div className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                    + {existingYieldKg.toFixed(1)} kg/yr already growing (not new)
                  </div>
                )}
                <div className="space-y-1">
                  {yieldByBed.map(({ bed, kg }) => (
                    <div key={bed.id} className="flex items-center justify-between font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                      <span>{bed.label}</span>
                      <span className="font-mono" style={{ color: '#20190F' }}>{kg.toFixed(1)} kg</span>
                    </div>
                  ))}
                  {yieldByBed.length === 0 && (
                    <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing planted yet.</div>
                  )}
                </div>
              </div>
            </div>

            {/* Seed BOQ + year-ahead report */}
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold mb-2" style={{ fontSize: 15, color: '#20190F' }}>🌱 Seeds & seedlings to get</div>
                <div className="space-y-1">
                  {seedBoq.map((row) => (
                    <div key={row.cropKey} className="flex items-center justify-between font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                      <span>{row.icon} {row.cropName}</span>
                      <span className="font-mono" style={{ color: '#20190F' }}>~{row.count} {row.unit}</span>
                    </div>
                  ))}
                  {seedBoq.length === 0 && (
                    <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing new to buy yet.</div>
                  )}
                </div>
                <p className="font-mono mt-2" style={{ fontSize: 10, color: '#9A8268' }}>
                  Estimated from bed area and each crop's usual spacing — direct-sow counts include a buffer for germination loss.
                </p>
              </div>

              <div className="rounded-2xl p-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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

            <FoodAvailabilityChart
              monthOrder={monthOrder}
              availability={foodAvailability}
              valueByMonth={foodValueByMonth}
              plantings={plantings}
              priceOverrides={priceOverrides}
              onPriceOverrideChange={updatePriceOverride}
            />
            <RotationExplanationCard />

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

// ── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ onVirtual }: { onVirtual: () => void }) {
  return (
    <div className="flex-1 flex items-center justify-center px-6">
      <div className="text-center" style={{ maxWidth: 360 }}>
        <div style={{ fontSize: 40 }}>🌱</div>
        <div className="font-display font-semibold mt-2" style={{ fontSize: 18, color: '#20190F' }}>No beds designed yet</div>
        <p className="font-sans mt-1.5" style={{ fontSize: 14, color: '#5C5040', lineHeight: 1.5 }}>
          Place veg beds on the Planting step first — then come back here to plan what goes in them.
        </p>
        <Link
          href="/facilitator"
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

type FoodValueMode = 'availability' | 'retail' | 'wholesale';

function FoodAvailabilityChart({ monthOrder, availability, valueByMonth, plantings, priceOverrides, onPriceOverrideChange }: {
  monthOrder: number[];
  availability: FoodAvailabilityItem[][];
  valueByMonth: FoodValueMonth[];
  plantings: Planting[];
  priceOverrides: Record<string, CropPrice>;
  onPriceOverrideChange: (cropKey: string, price: CropPrice) => void;
}) {
  const [mode, setMode] = useState<FoodValueMode>('availability');
  const [editingPrices, setEditingPrices] = useState(false);

  const cols = monthOrder.map((m) => {
    const items = availability[m] ?? [];
    return { m, fresh: items.filter((it) => it.status === 'fresh'), stored: items.filter((it) => it.status === 'stored') };
  });
  const maxTotal = Math.max(1, ...cols.map((c) => c.fresh.length + c.stored.length));
  const BAR_MAX_H = 56;
  const isEmpty = cols.every((c) => c.fresh.length + c.stored.length === 0);
  const moneyMax = Math.max(1, ...monthOrder.map((m) => (mode === 'retail' ? valueByMonth[m].retailValue : valueByMonth[m].wholesaleValue)));

  const pricedCropKeys = [...new Set(plantings.map((p) => p.cropKey))].filter((k) => !UNPRICED_CROPS.has(k)).sort();

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>🍽️ Food availability — resilience by month</div>

      <div className="inline-flex rounded-full p-0.5 mb-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
        {([['availability', '🍽️ Availability'], ['retail', '💰 Retail value'], ['wholesale', '💰 Wholesale value']] as [FoodValueMode, string][]).map(([m, label]) => (
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

      {mode === 'availability' ? (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          What this plan should put on the table each month — fresh picks, plus anything still keeping in storage
          from an earlier harvest (maize, pumpkin, onions and other storable crops). Shows what&apos;s on hand, not
          an exact kg count — see Estimated harvest above for that.
        </p>
      ) : (
        <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
          Estimated Rand value of what&apos;s harvested each month, using researched South African {mode} prices
          (2026-07-14) — a one-time researched snapshot, not a live market feed, spread across each crop&apos;s own
          harvest window so the same batch is never counted twice. Edit the prices below to match your own market.
        </p>
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
                          {storedHPx > 0 && freshHPx > 0 && <div style={{ height: 2, background: '#FBF6EC' }} />}
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
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <div className="flex" style={{ minWidth: GRID_MIN_WIDTH, gap: 6 }}>
            {monthOrder.map((m, i) => {
              const val = mode === 'retail' ? valueByMonth[m].retailValue : valueByMonth[m].wholesaleValue;
              const hPx = val <= 0 ? 0 : Math.max(4, Math.round((val / moneyMax) * BAR_MAX_H));
              return (
                <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 56 }}>
                  <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                    {val <= 0 ? (
                      <div style={{ width: '60%', height: 2, background: '#E2D8C4', borderRadius: 1 }} />
                    ) : (
                      <div
                        style={{ width: '60%', height: hPx, borderRadius: 4, background: mode === 'retail' ? '#D4A017' : '#C4A46A' }}
                        title={`R${val.toFixed(0)} ${mode} value`}
                      />
                    )}
                  </div>
                  <div className="font-sans" style={{ fontSize: 10, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#1F4D2B' : '#8C7A62', marginTop: 4 }}>
                    {MONTHS_SHORT[m - 1]}
                  </div>
                  <div className="font-mono font-semibold" style={{ fontSize: 11, color: '#20190F', marginTop: 2 }}>
                    {val > 0 ? `R${Math.round(val)}` : ''}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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
      <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#FBF6EC', borderRight: '1px solid #E2D8C4', padding: '10px 10px' }}>
        <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{bed.label}</div>
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
  const segments = barSegments(planting.sowMonth, harvestEnd, currentMonth);
  if (!segments.length) return null; // entirely outside the visible 12-month window
  // The transplant marker is anchored to THIS crop's own sow offset (not
  // re-derived independently) so it always lands right after the sow
  // segment, never contradicting it.
  const sowOffset = nearestSignedOffset(planting.sowMonth, currentMonth);
  const trOffset = crop.transplant && !planting.existing ? sowOffset + 1 : null;
  const fraction = planting.areaFraction ?? 1;
  const fLabel = fractionLabel(fraction);
  // Existing (already-growing) crops get a muted olive treatment so the eye
  // separates "already there" from "still to sow" at a glance. Each bar also
  // fades from "just sown" to a golden "ready to harvest" tone across its
  // length, so you can see how far along a planting is at a glance.
  const [barFrom, barTo] = planting.existing ? ['#8C8654', '#B8934A'] : ['#7FAE6E', '#D4A017'];
  const segMonthCount = (seg: Segment) => seg.end - seg.start + 1;
  const totalMonths = segments.reduce((s, seg) => s + segMonthCount(seg), 0);
  const lastSegIdx = segments.length - 1;
  // How many of the LAST segment's months are the "ready to pick" window —
  // clipped to that segment's own length, since barSegments may have
  // trimmed the window at the visible edge.
  const readyMonths = Math.min((crop.harvestWindowMonths ?? 0) + 1, segMonthCount(segments[lastSegIdx]));
  const harvestLabel = crop.harvestWindowMonths ? `${monthLabel(harvest)}-${monthLabel(harvestEnd)}` : monthLabel(harvest);

  return (
    <div style={{ position: 'relative', height: 30, marginBottom: 3 }}>
      {segments.map((seg, i) => (
        <button
          key={i}
          onClick={onTap}
          className="font-sans"
          style={{
            position: 'absolute', left: `${leftPct(seg.start)}%`, width: `${widthPct(seg)}%`, top: 2, bottom: 2,
            background: BAR_STYLE === 'gradient' ? barGradient(seg, seg.start, totalMonths, barFrom, barTo) : barFrom,
            color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 11, fontWeight: 600, textAlign: 'left', paddingLeft: 6, paddingRight: 4,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer',
          }}
          title={`${crop.name} — sow ${monthLabel(planting.sowMonth)}, harvest ${harvestLabel}${fraction < 1 ? ` · ${fLabel} of bed` : ''}${planting.existing ? ' · already growing' : ''}`}
        >
          {BAR_STYLE === 'solid' && i === lastSegIdx && (
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
                position: 'absolute', top: 0, bottom: 0, right: 0, width: `${(100 * readyMonths) / segMonthCount(seg)}%`,
                background: barTo, borderLeft: '2px solid rgba(255,255,255,0.85)',
              }}
            />
          )}
          {i === 0 && (
            <span style={{ position: 'relative', zIndex: 1 }}>
              {crop.icon} {crop.name}{fLabel ? ` (${fLabel})` : ''}
            </span>
          )}
        </button>
      ))}
      {trOffset !== null && trOffset >= 0 && trOffset <= 11 && (
        <div
          style={{
            position: 'absolute', left: `${leftPct(trOffset) + COL_PCT / 2}%`, top: -2, transform: 'translateX(-50%)',
            fontSize: 9, fontWeight: 700, color: '#9A6018', background: '#FBF6EC', padding: '0 2px', borderRadius: 3,
            pointerEvents: 'none', whiteSpace: 'nowrap',
          }}
        >
          (tr)
        </div>
      )}
    </div>
  );
}

// ── Crop picker modal ────────────────────────────────────────────────────

function CropPickerModal({
  search, onSearch, crop, month, pattern, fraction, onFraction, existing, onExisting, overlap,
  isEditing, favouriteCropKeys, onToggleFavourite, allowBedSharing, onEnableBedSharing, onPick, onBack, onMonth, onConfirm, onClose,
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
        style={{ position: 'relative', width: '100%', maxWidth: 440, maxHeight: '82vh', overflowY: 'auto', background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4', position: 'sticky', top: 0, background: '#FBF6EC', zIndex: 1 }}>
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
                    style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}
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
              Spacing {crop.spacingCm} cm · {crop.daysToHarvest} days to harvest<br />
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

            <div className="font-sans uppercase tracking-widest mb-1.5 mt-2" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>How much of the bed?</div>
            {allowBedSharing || fraction < 1 ? (
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
  const yieldKg = estimatedYieldKgAdjusted(planting, bedAreaM2, allPlantings);
  const genuinelyIntercropped = isGenuinelyIntercropped(planting, allPlantings);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 61, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(20,16,10,0.35)' }} />
      <div
        className="rounded-2xl p-4"
        style={{ position: 'relative', width: '100%', maxWidth: 300, background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
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
          <div>Sow {monthLabel(planting.sowMonth)} → harvest {monthLabel(harvest)}</div>
          <div>Spacing {crop.spacingCm} cm · {crop.daysToHarvest} days to harvest</div>
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
        style={{ position: 'relative', width: '100%', maxWidth: 480, maxHeight: '86vh', overflowY: 'auto', background: '#FBF6EC', border: '1px solid #E2D8C4', boxShadow: '0 8px 32px rgba(32,25,15,0.2)' }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #E2D8C4', position: 'sticky', top: 0, background: '#FBF6EC', zIndex: 1 }}>
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

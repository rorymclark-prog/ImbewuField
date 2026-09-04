'use client';

// Facilitator crop plan — a Tend-style planting timeline built on the beds
// the facilitator has already placed on the design canvas (Planting layer).
//
// Reads the shared facilitator design (localStorage, read-only) for bed
// geometry + derives the site's rainfall pattern from bgSite, then keeps its
// own crop-plan store (lib/crop-plan.ts) for what's actually sown where.
// Zero network, zero new deps.

import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Search, X, ChevronDown, Home } from 'lucide-react';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import LessonLink from '@/components/design/LessonLink';
import CropPlanExportCard from '@/components/crops/CropPlanExportCard';
import CropIcon from '@/components/CropIcon';
import MiniPlanPlate from '@/components/MiniPlanPlate';
import { planValue } from '@/lib/plan-value';
import { miniPlanFromCanvas, miniPlanFromFacilitator, type MiniPlan } from '@/lib/mini-plan';
import { loadCanvasState, DESIGN_CANVAS_CHANGED_EVENT } from '@/lib/design-canvas';
import { bedsFromDesignCanvas, canvasSiteIdForPlace, studioPlanChoices, type StudioPlanChoice } from '@/lib/design-beds-bridge';
import { loadPlaces, resolveMainSite } from '@/lib/saved-places';
import type { FacilitatorDesignState } from '@/lib/facilitator-design';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import type { Design } from '@/lib/db/types';
import { myDesigns } from '@/lib/db/queries';
import { nearestRainfall } from '@/lib/water-calc';
import { driestMonths, resolveSiteClimate, type SiteClimate } from '@/lib/site-climate';
import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import { CROPS, cropByKey, hasAutomaticPlanningBasis, hasPlanningYield, hasVerifiedSchedule, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed, Planting, CropPlanState, FoodAvailabilityItem, PlanYieldBenchmark, CashflowSettings, BedOverlapWarning, CropTask } from '@/lib/crop-plan';
import {
  loadCropPlan, saveCropPlan, bedEntryMonth, latestBedEntryMonth, plannedBedEntryMonth, harvestEndMonthForCrop, harvestMonthForCrop, tasksForPlan, taskMonthsFromNow, estimatedYieldKgAdjusted, nextValidSowMonth,
  isSpaceHungry, bedOverlapWarning, benchmarkAreaConflictDetails, bedHasUnverifiedTiming, buildYearReport, buildFoodAvailability, buildPlanYieldBenchmark,
  buildFieldUtilizationByMonth, loadFavouriteCropKeys, saveFavouriteCropKeys, isGenuinelyIntercropped, plantingBedEntryOffsets, plantingIsActiveOrPlanned, recurringPlanPlantings,
  loadAllowBedSharing, saveAllowBedSharing, loadCashflowSettings, saveCashflowSettings, DEFAULT_CASHFLOW_SETTINGS, planNotesDateLabel,
  restampEditedOnce,
} from '@/lib/crop-plan';
import type { FoodGroup } from '@/lib/crop-groups';
import { FOOD_GROUP_META, foodGroupOf, ROTATION_FAMILY_META, rotationFamilyOf } from '@/lib/crop-groups';
import type { AutoSuggestAnswers, AutoSuggestResult, GardenGoal, HarvestRhythm, PlanNote } from '@/lib/crop-autosuggest';
import { autoSuggestPlan, PLAN_NOTES_PANEL_COPY } from '@/lib/crop-autosuggest';
import type { IdealYearPlan, PlanTiming } from '@/lib/crop-plan-ideal';
import { IDEAL_PLAN_COPY, suggestIdealYearPlan } from '@/lib/crop-plan-ideal';
import type { CropPrice } from '@/lib/crop-prices';
import { UNPRICED_CROPS, asFarmerOwnPrice, isUsablePrice, priceFor, loadCropPriceOverrides, saveCropPriceOverrides } from '@/lib/crop-prices';
// The one place the price book's dates become farmer-visible copy on this page. Imported rather
// than retyped so the wording cannot drift from the book it describes (that drift is exactly what
// left this sentence naming a single day after a crop was priced five weeks later).
import { PRICE_SNAPSHOT_MONTHS } from '@/components/prices/CropPriceGuide.format';
// Task wording lives in the export module now, not here: the screen, the
// calendar file and the printed plan all have to describe a task the same way,
// and three copies of that sentence is how they stop doing so.
import type { BuyingMonth } from '@/lib/crop-export-schedule';
import {
  buildBuyingSchedule, positionRangeLabel, sowingInstruction, SUCCESSION_TIMING_GUIDANCE,
  taskSentence, groupTasksByAction, TRANSPLANT_NURSERY_GUIDANCE,
} from '@/lib/crop-export-schedule';

const ALL_GROUPS: FoodGroup[] = ['leafy_green', 'legume', 'root_tuber', 'allium_aromatic', 'fruiting_veg', 'staple_grain'];

// The rolling timeline shows this many months ahead from today (column 0),
// scrollable. TWO FULL YEARS as of 2026-08-05 (Rory: "the last month i feel
// is not fully utilised... should we make it 2 years and then we just pan
// sideways").
//
// The previous 15 was a half-measure that actively created the problem it
// was meant to soften. A planting is drawn from an offset forced into 0-11
// (the first annual occurrence), so NO bar can ever START in column 12, 13 or 14 —
// those columns could only ever hold the tail of something sown earlier.
// The window's last months were therefore blank BY CONSTRUCTION, on every
// bed, however good the plan was. Widening alone would have made that
// worse; the fix is width PLUS drawing the cycle's repeat (see
// barInstances), which is what this plan literally is — one annual cycle
// repeated for visibility, not a stored second-season rotation.
const DISPLAY_MONTHS = 24;
// The resilience chart below keeps the previous window: it plots the annual
// RHYTHM, and a second identical copy of every column adds no information
// there (unlike the timeline, where the repeat is what makes a wrapped bar
// legible). Deliberately not DISPLAY_MONTHS.
const CHART_MONTHS = 15;
const GRID_MIN_WIDTH = Math.round((760 * DISPLAY_MONTHS) / 12);

// One emoji per kind of work, so a farmer scanning the month sees the SHAPE of
// it — three rows of ground prep, one of harvest — before reading a word. Kept
// here and not beside TASK_TITLE in lib/, because that module also feeds the
// ICS export and the PDF, and pdfSafe strips emoji outright.
const TASK_ACTION_ICON: Record<CropTask['action'], string> = {
  prep: '🪵',
  sow: '🌱',
  transplant: '🪴',
  mulch: '💧',
  harvest: '🧺',
  'terminate-cover': '✂️',
  'weed-early': '🌿',
  'weed-mid': '🐛',
};

/**
 * One line of the harvest list: what it is, how much, and how big a share of the
 * plan's total it is.
 *
 * Rory, 2026-09-04: "on the percentage of veg make graphics bigger make a slider
 * o show proportions". The list was icon + name + kg and nothing else, so which
 * crop actually carried the plan was arithmetic you had to do yourself across a
 * dozen rows.
 *
 * `share` is null for a crop with no verified kg/m² benchmark and for a soil-cover
 * crop, and those rows then draw NO bar at all — an empty track beside them would
 * read as 0%, which is exactly the claim the rest of this panel refuses to make.
 */
function HarvestShareRow({
  cropKey, icon, name, share, relative, children,
}: {
  cropKey?: string;
  icon?: string;
  name: string;
  /** Share of the plan's verified kg total — the number printed beside the bar. */
  share: number | null;
  /** Length of the bar as a fraction of the biggest row's, so the comparison
   *  uses the whole track instead of the left sixth of it. Still one shared
   *  linear scale from zero — only the reference point differs from `share`,
   *  and the caption above the list says which is which. */
  relative: number | null;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div className="flex items-center justify-between gap-2 font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
        <span className="font-sans" style={{ color: '#20190F' }}>
          {cropKey ? <CropIcon cropKey={cropKey} icon={icon ?? '🌱'} size={20} /> : null} {name}
        </span>
        <span className="font-mono flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{children}</span>
      </div>
      {share !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
          <div style={{ flex: 1, height: 8, background: '#EFE9DA', borderRadius: 4, overflow: 'hidden' }}>
            {/* Floor of 2% so a real but tiny crop still draws something. The
                number beside it is the honest figure; the bar is the glance. */}
            <div style={{ width: `${Math.max(2, Math.round((relative ?? share) * 100))}%`, height: '100%', background: '#5B8F4E', borderRadius: '0 4px 4px 0' }} />
          </div>
          <span className="font-mono flex-shrink-0" style={{ fontSize: 11, color: '#8C7A62', fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'right' }}>
            {Math.round(share * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A month's work as a grouped list.
 *
 * REPLACES a single ` · `-joined sentence. Rory, 2026-09-04: "i cant see whats
 * happening on the tasks make this much much better". On a twelve-bed plan that
 * sentence ran to several hundred words, because every bed repeated its crop's
 * full spacing instruction — the same twenty-two words five times over. Nothing
 * was missing from it; it just could not be read. Same tasks, same wording,
 * grouped by kind of work, then by crop, with the beds as chips and the how-to
 * stated once. taskSentence() stays for the WhatsApp share and the PDF, where a
 * flat line is the right shape.
 */
function TaskList({ tasks }: { tasks: CropTask[] }) {
  const groups = groupTasksByAction(tasks);
  if (groups.length === 0) {
    return <div className="font-sans" style={{ fontSize: 12.5, color: '#8C7A62' }}>Nothing due.</div>;
  }
  return (
    <div className="space-y-2">
      {groups.map((group) => {
        // Ground prep says the same sentence for every crop in the month — it is
        // about the ground, not the crop — so four crops meant four identical
        // lines. When the whole group shares one how-to, it is said once under
        // the heading and the crop rows carry only their beds. Sowing, where
        // each crop's spacing genuinely differs, keeps its per-crop line.
        const shared = group.crops.length > 1 && group.crops[0].detail
          && group.crops.every((c) => c.detail === group.crops[0].detail)
          ? group.crops[0].detail
          : null;
        return (
          <div key={group.action} className="rounded-xl" style={{ background: '#F8F4EA', border: '1px solid #EAE2D0', padding: '7px 9px' }}>
            <div className="flex items-baseline gap-1.5">
              <span style={{ fontSize: 13 }}>{TASK_ACTION_ICON[group.action]}</span>
              <span className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{group.label}</span>
              <span className="font-mono" style={{ fontSize: 10.5, color: '#8C7A62' }}>
                {group.jobCount} {group.jobCount === 1 ? 'job' : 'jobs'}
              </span>
            </div>
            {shared && (
              <div className="font-sans mb-1.5" style={{ fontSize: 11.5, color: '#5C5040', lineHeight: 1.4 }}>{shared}</div>
            )}
            <div className={shared ? 'space-y-1' : 'space-y-1.5 mt-1'}>
              {group.crops.map((row) => (
                <div key={`${row.cropKey}-${row.bedLabels[0]}`}>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                    <span className="font-sans font-semibold" style={{ fontSize: 12.5, color: '#20190F' }}>
                      <CropIcon cropKey={row.cropKey} icon={row.icon} size={16} /> {row.cropName}
                    </span>
                    {row.bedLabels.map((bed) => (
                      <span
                        key={bed}
                        className="font-sans"
                        style={{ fontSize: 10.5, color: '#1F4D2B', background: '#E4EEDF', border: '1px solid #CBDDC2', borderRadius: 999, padding: '1px 7px', whiteSpace: 'nowrap' }}
                      >
                        {bed}
                      </span>
                    ))}
                  </div>
                  {!shared && row.detail && (
                    <div className="font-sans" style={{ fontSize: 11.5, color: '#5C5040', lineHeight: 1.4, marginTop: 1 }}>{row.detail}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
// Widest the planning page is allowed to get on a desktop or landscape tablet.
// Not an arbitrary round number: the wrapper carries 20px of padding a side at
// md and up (40px) and the timeline card draws a 1px border on each side (2px),
// so GRID_MIN_WIDTH + 42 leaves exactly GRID_MIN_WIDTH of content — the width at
// which every one of the DISPLAY_MONTHS columns is on screen and the timeline's
// own horizontal scrollbar disappears. Measured, not assumed: at +40 the grid
// still had 2px of scroll left, which is enough to summon a classic scrollbar on
// a platform that draws one. Below this the page is fluid and fills whatever it
// is given; the timeline keeps scrolling.
const PAGE_MAX_WIDTH = GRID_MIN_WIDTH + 42;

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

/** The header below carries its own ways back (Home, "Back to design", "All crop
 *  plans"), so the global floating Back pill must stand down — without this it
 *  rendered on top of those very controls. Rendered INSIDE the header so the
 *  registration exactly mirrors the header's own presence. */
function RegisterInFlowBack() {
  useRegisterBackControl();
  return null;
}

function wrapMonth(m: number): number {
  return ((m - 1) % 12 + 12) % 12 + 1;
}
function monthLabel(m: number): string {
  return MONTHS_SHORT[wrapMonth(m) - 1];
}

/** "Jun", "Jun–Aug", or "Jun, Aug, Oct" — a run of months reads as a span, a
 * broken set stays a list rather than being smoothed into a false range. */
function monthSpanLabel(months: number[]): string {
  if (months.length === 0) return '';
  if (months.length === 1) return monthLabel(months[0]);
  const contiguous = months.every((month, i) => i === 0 || month === wrapMonth(months[i - 1] + 1));
  return contiguous
    ? `${monthLabel(months[0])}–${monthLabel(months[months.length - 1])}`
    : months.map(monthLabel).join(', ');
}

/** "maize", "maize and cabbage", "maize, cabbage and beans". */
function listNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function cropDurationLabel(crop: CropDef): string {
  if (crop.timingVerified === false) return 'timing not verified';
  if (crop.daysToHarvestRange) {
    const [minimum, maximum] = crop.daysToHarvestRange;
    return `${minimum}–${maximum} days`;
  }
  return `about ${crop.daysToHarvest} days`;
}

function pickingPeriodLabel(crop: CropDef): string | null {
  if (crop.harvestPeriodNote) return crop.harvestPeriodNote;
  if (crop.harvestPeriodRangeWeeks) {
    const [minimum, maximum] = crop.harvestPeriodRangeWeeks;
    return minimum === maximum
      ? `${minimum} week${minimum === 1 ? '' : 's'}`
      : `${minimum}–${maximum} weeks`;
  }
  if (!crop.harvestPeriodRangeMonths) return null;
  const [minimum, maximum] = crop.harvestPeriodRangeMonths;
  return minimum === maximum
    ? `${minimum} month${minimum === 1 ? '' : 's'}`
    : `${minimum}–${maximum} months`;
}
function genId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Compact glyph for a bed-share fraction — falls back to a rounded percentage. */
function fractionLabel(f: number): string {
  if (f >= 1) return '1/1';
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

/** How many buying months stay open on screen. The rest sit behind a
 * disclosure: a shopping list you can act on this season is the point, and a
 * full year of months scrolled the actionable ones off a phone. */
const VISIBLE_BUYING_MONTHS = 3;

/** One month of the buying calendar. Same rows the printed plan's buying
 * schedule prints, in the same order, so the paper and the screen agree. */
function BuyingMonthBlock({ monthGroup, isNow }: { monthGroup: BuyingMonth; isNow: boolean }) {
  return (
    <div>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 13, color: isNow ? '#1F4D2B' : '#20190F' }}>
        {monthLabel(monthGroup.month)}{isNow ? ' · this month' : ''}
      </div>
      <div className="space-y-2">
        {monthGroup.items.map((item) => (
          <div key={`${item.cropKey}-${item.sowMonth}`} className="pb-2" style={{ borderBottom: '1px solid #F0EAD8' }}>
            <div className="flex items-center justify-between font-sans gap-2" style={{ fontSize: 13, color: '#5C5040' }}>
              <span><CropIcon cropKey={item.cropKey} icon={item.icon} size={14} /> {item.cropName}</span>
              <span className="font-mono text-right" style={{ color: '#20190F' }}>
                {item.quantityStatus === 'spacing-confirmation-required'
                  ? 'confirm spacing first'
                  : item.quantityStatus === 'packet-rate-required'
                    ? 'packet rate needed'
                    : item.quantityStatus === 'counted-piece-range' && item.countRange
                      ? `~${positionRangeLabel(item.countRange)} ${item.unit} positions`
                      : item.count === null
                        ? 'confirm quantity'
                        : `~${item.count.toLocaleString('en-ZA')} ${item.unit} positions`}
              </span>
            </div>
            <div className="font-sans mt-0.5 flex items-start gap-1" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.4 }}>
              <SeedBadge transplant={item.transplant} />
              <span>{item.note}{item.bedLabels.length > 0 ? ` · for ${item.bedLabels.join(', ')}` : ''}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
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
/**
 * Every visible copy of a sow→harvest span, in display-column space, clipped
 * to the DISPLAY_MONTHS-column window. `harvest` is always the crop's OWN
 * forward span from `sowMonth` (a crop never takes longer than ~12 months, so
 * this offset is unambiguous regardless of "today"); `sowOffset` is the
 * `sowOffsets` carries the caller's absolute bed-entry occurrences. Planned
 * rows repeat annually; an existing row contributes one observed cohort.
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
function barInstances(sowOffsets: number[], sowMonth: number, harvest: number): Segment[] {
  const spanMonths = ((harvest - sowMonth) % 12 + 12) % 12; // crop's own forward duration, 0-11
  const out: Segment[] = [];
  for (const rawStart of sowOffsets) {
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


/**
 * One site in the crop-plan picker.
 *
 * The picture is the point. Before this card the picker was a stack of text
 * rows, and two saved designs of the same farm — or two farms with six beds
 * each — read identically; a farmer had to open one to find out which it was.
 * The geometry was already in memory in both cases (see lib/mini-plan.ts), so
 * the plate costs nothing but pixels.
 *
 * NOTE THE MISSING TOTAL. There is deliberately no "N designs · X beds · Y m²
 * altogether" line across the cards: two saved designs are very often two
 * versions of ONE farm, so summing them would report a farmer's land as twice
 * its size. Per-card numbers are the only ones that are true.
 */
function SiteCard({
  title, plan, bedCount, plotCount, areaM2, source, tag, href, onClick,
}: {
  title: string;
  plan: MiniPlan | null;
  bedCount: number;
  plotCount: number;
  areaM2: number;
  /** Where this design lives — shown only so two similar cards are tellable apart. */
  source: string;
  /** Extra distinguishing detail, set ONLY when another card shares this title. */
  tag: string | null;
  href?: string;
  onClick?: () => void;
}) {
  const parts: string[] = [];
  // Em-dash, never a zero: a site with no beds at all says so in words, and a
  // site with no staple plot simply does not mention staple plots.
  parts.push(bedCount === 0 ? 'No beds yet' : `${bedCount} bed${bedCount === 1 ? '' : 's'}`);
  if (plotCount > 0) parts.push(`${plotCount} staple plot${plotCount === 1 ? '' : 's'}`);
  if (areaM2 > 0) parts.push(`${areaM2.toFixed(1)} m²`);

  const inner = (
    <>
      <div style={{ borderBottom: '1px solid #E2D8C4', background: '#F6F1E6' }}>
        {plan ? (
          <MiniPlanPlate plan={plan} />
        ) : (
          <div
            className="flex items-center justify-center font-sans"
            style={{ aspectRatio: '8 / 5', fontSize: 11.5, color: '#9A8268' }}
          >
            No map traced for this one
          </div>
        )}
      </div>
      <div className="px-3 py-2.5 flex flex-col" style={{ gap: 2 }}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-display font-semibold truncate" style={{ fontSize: 14, color: '#20190F' }}>{title}</span>
          <span className="font-sans flex-shrink-0" style={{ fontSize: 12, color: '#9A8268' }}>›</span>
        </div>
        <span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>{parts.join(' · ')}</span>
        <span className="font-sans" style={{ fontSize: 10.5, color: '#9A8268' }}>
          {source}{tag ? ` · ${tag}` : ''}
        </span>
      </div>
    </>
  );

  const style = {
    background: '#FFFEFA',
    border: '1px solid #E2D8C4',
    borderRadius: 14,
    overflow: 'hidden',
    textAlign: 'left' as const,
    textDecoration: 'none',
    display: 'block',
    padding: 0,
    cursor: 'pointer',
  };

  return href ? (
    <Link href={href} onClick={onClick} className="w-full transition-all" style={style}>{inner}</Link>
  ) : (
    <button type="button" onClick={onClick} className="w-full transition-all" style={style}>{inner}</button>
  );
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
  // ?switch=1 — arrive with the site picker open and the main-site fallback held
  // back. This is how a plan that IS on a Studio canvas offers "All crop plans":
  // the picker needs a bare URL to render, but a bare URL would otherwise
  // auto-jump straight back into the main site's canvas.
  const switchParam = searchParams.get('switch');

  // FALLBACK when no ?canvasSite (home progress card, task board, nav drawer, /cropplan, /plan
  // all link here bare): use the MAIN saved place's Design-Studio canvas if it has beds. Without
  // this, a farmer who designed beds in /design and tapped 'Plan your crops' from Home landed on
  // 'No beds designed yet' with a back-link to the OLD canvas — the flow audit's worst blocker.
  const [fallbackCanvasSite, setFallbackCanvasSite] = useState<string | null>(null);
  useEffect(() => {
    // Not just an early-out: client-side nav from a plan's "All crop plans" chip
    // arrives with the fallback ALREADY set from the previous render, and a stale
    // fallback keeps canvasSite truthy — which is exactly what blocks the picker.
    if (switchParam === '1') { setFallbackCanvasSite(null); return; }
    if (canvasSiteParam) return;
    try {
      const main = resolveMainSite(loadPlaces());
      if (!main) return;
      const sid = canvasSiteIdForPlace(main);
      if (bedsFromDesignCanvas(loadCanvasState(sid)).length > 0) setFallbackCanvasSite(sid);
    } catch { /* corrupt cache — legacy behaviour stands */ }
  }, [canvasSiteParam, switchParam]);
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
  const [aFocusCount, setAFocusCount] = useState(1);
  const [aGroups, setAGroups] = useState<FoodGroup[]>(ALL_GROUPS);
  const [aCropKeys, setACropKeys] = useState<string[]>([]);
  const [aRhythm, setARhythm] = useState<HarvestRhythm>('steady');
  // Default on — prevents an immediate repeat of the same botanical family.
  // This one-year plan does not claim to hold a complete multi-year history.
  const [aRotateCrops, setARotateCrops] = useState(true);
  // Default off — a vine dedicating a whole veg bed for months, filling it
  // with nothing else all year, is a bad outcome for precious rotational bed
  // space. Off by default = recommend a dedicated plot/edge/food-forest area
  // instead; the farmer has to actively opt in to place one in a veg bed.
  const [aAllowVinesInBeds, setAAllowVinesInBeds] = useState(false);
  // Rory asked for full, half, third and quarter-bed plantings so one long
  // crop does not force the rest of a bed to sit blank. These are adjacent
  // bed sections, not an invented claim that arbitrary crops intercrop well.
  const [aAllowMixedCropsInBed, setAAllowMixedCropsInBed] = useState(true);
  const [aReliableIrrigation, setAReliableIrrigation] = useState(false);
  const [autoResult, setAutoResult] = useState<AutoSuggestResult | null>(null);
  // Whole-year mode (lib/crop-plan-ideal.ts): 'fromNow' keeps today's exact
  // behaviour; 'idealYear' sweeps all 12 starting months and keeps the best
  // repeating cycle. idealMeta is transient review-only metadata (like
  // laterThisYear) — nothing new is persisted, the whole-year basis note
  // rides the existing planNotes contract.
  // Defaults to the whole-year plan: it is the better plan on almost every
  // farm, and left opt-in behind this toggle most farmers never saw it. The
  // review card names the two years out loud (twoYearLine) so a thin first
  // year reads as a farm filling up rather than a broken plan.
  const [aPlanTiming, setAPlanTiming] = useState<PlanTiming>('idealYear');
  const [idealMeta, setIdealMeta] = useState<IdealYearPlan | null>(null);
  const [autoGenerating, setAutoGenerating] = useState(false);

  function openAutoSuggest() {
    setAGoal('family');
    setAFocusCount(1);
    setAGroups(ALL_GROUPS); // family default = all checked (diversify); commercial flips this on toggle
    setACropKeys([]);
    setARhythm('steady');
    setARotateCrops(true);
    setAAllowVinesInBeds(false);
    setAAllowMixedCropsInBed(true);
    setAReliableIrrigation(false);
    setAPlanTiming('idealYear');
    setIdealMeta(null);
    setAutoGenerating(false);
    setAutoResult(null);
    setAutoPhase('questions');
  }
  function chooseGoal(g: GardenGoal) {
    setAGoal(g);
    setAGroups(g === 'commercial' ? [] : ALL_GROUPS); // commercial starts empty — must actively concentrate
    setACropKeys([]);
  }
  function toggleGroup(g: FoodGroup) {
    setAGroups((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  }
  function toggleAutoCrop(cropKey: string) {
    setACropKeys((prev) => prev.includes(cropKey) ? prev.filter((key) => key !== cropKey) : [...prev, cropKey]);
  }
  function runAutoSuggest() {
    const answers: AutoSuggestAnswers = {
      goal: aGoal,
      focusCropCount: aGoal !== 'family' ? aFocusCount : undefined,
      groups: aGroups,
      cropKeys: aCropKeys,
      rhythm: aRhythm,
      rotateCrops: aRotateCrops,
      allowVinesInBeds: aAllowVinesInBeds,
      allowMixedCropsInBed: aAllowMixedCropsInBed,
      reliableIrrigation: aReliableIrrigation,
    };
    // Say WHERE the climate came from, not just what it is — a satellite-derived
    // per-site profile and a reference city 250 km away are different claims.
    // Resolved at generate time for BOTH branches: climate can still be loading
    // when the modal opens, so it is never precomputed.
    const climateNote = climateSource === 'site'
      ? `Climate derived from satellite climate records for this site: ${PATTERN_META[pattern].label}.`
      : climateSource === 'reference'
        ? `Climate from nearest reference region — ${region?.name} (fallback): ${PATTERN_META[pattern].label}.`
        : `No mapped site — assuming ${PATTERN_META[pattern].label.toLowerCase()}.`;
    if (aPlanTiming === 'idealYear') {
      // Busy label first, sweep second: the 12-anchor sweep is synchronous
      // (~0.5 s on a 12-bed farm, more on a low-end phone), so the button must
      // repaint to its busy state before the work starts. The flag also
      // guards a double tap while the sweep runs.
      setAutoGenerating(true);
      setTimeout(() => {
        const ideal = suggestIdealYearPlan(answers, pattern, beds, plantings, currentMonth, new Date().getFullYear());
        setIdealMeta(ideal);
        setAutoResult({
          ...ideal.best.result,
          notes: [{ kind: 'basis', text: climateNote }, ...ideal.best.result.notes],
        });
        setAutoGenerating(false);
        setAutoPhase('review');
      }, 30);
      return;
    }
    setIdealMeta(null);
    const suggested = autoSuggestPlan(
      answers, pattern, beds, plantings, currentMonth,
      { year: new Date().getFullYear(), month: currentMonth },
    );
    setAutoResult({
      ...suggested,
      notes: [{ kind: 'basis', text: climateNote }, ...suggested.notes],
    });
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
      return {
        ...base,
        version: 1,
        rainPattern: pattern,
        plantings: [...base.plantings, ...autoResult.plantings],
        // The reasons the farmer just read stay with the plan. They REPLACE any
        // earlier set rather than accumulating: two suggestions run months apart
        // explain two different plans, and stacking them would put contradictory
        // sentences under one date label.
        planNotes: autoResult.notes,
        planNotesAt: Date.now(),
        updatedAt: Date.now(),
      };
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
  useEffect(() => {
    if (switchParam === '1') setSwitchingSite(true);
  }, [switchParam]);
  // Design Studio sites on this device whose canvas holds plantable beds — the
  // picker lists these alongside the cloud designs, because a farm designed
  // purely in the Studio otherwise never appears there at all (it was reachable
  // only through the Studio's own "plan crops" deep link).
  const [studioChoices, setStudioChoices] = useState<StudioPlanChoice[]>([]);
  // When beds come from the Design Studio (?canvasSite) the facilitator/Firestore
  // picker is bypassed entirely — there's exactly one source of beds. A single
  // cloud design still skips the picker as before — unless Studio sites exist
  // too, at which point there is real ambiguity, or the ONLY designs are Studio
  // ones, which a bare URL could otherwise never reach.
  const needsSitePicker = !canvasSite && !!myDesignsList && (switchingSite || (chosenDesignId === null
    && (myDesignsList.length + studioChoices.length > 1 || (myDesignsList.length === 0 && studioChoices.length > 0))));

  // ── the picker's cards ────────────────────────────────────────────────────
  //
  // Both sources already hold their geometry in memory — a cloud row carries its
  // items in the row itself, and a Studio canvas has to be read from localStorage
  // to be counted at all — so drawing each site costs one more pass over data
  // already in hand, and no network. A design whose geometry will not parse is
  // still listed, just without its picture: losing a site from the picker is far
  // worse than a card with no plate on it.
  const cloudCards = useMemo(() => (myDesignsList ?? []).map((d) => {
    let plan: MiniPlan | null = null;
    let beds: PlanBed[] = [];
    try {
      const st = designStateFromCloudRow(d);
      plan = miniPlanFromFacilitator(st);
      beds = computeDesignBeds(st);
    } catch { /* unreadable row data — the card still identifies it */ }
    const t = d as { updated_at?: { toMillis?: () => number }; created_at?: { toMillis?: () => number } };
    const ms = t.updated_at?.toMillis?.() ?? t.created_at?.toMillis?.() ?? null;
    return {
      id: d.id,
      title: (d.title || '').trim() || 'Untitled design',
      plan,
      bedCount: beds.length,
      areaM2: beds.reduce((sum, b) => sum + b.areaM2, 0),
      savedLabel: ms
        ? `saved ${new Date(ms).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : null,
    };
  }), [myDesignsList]);

  const studioCards = useMemo(() => studioChoices.map((c) => {
    let plan: MiniPlan | null = null;
    let beds: PlanBed[] = [];
    try {
      const st = loadCanvasState(c.siteId);
      plan = miniPlanFromCanvas(st);
      beds = bedsFromDesignCanvas(st);
    } catch { /* as above — the card lists, the plate is what is lost */ }
    return {
      siteId: c.siteId,
      title: c.name,
      plan,
      bedCount: c.bedCount,
      plotCount: c.plotCount,
      areaM2: beds.reduce((sum, b) => sum + b.areaM2, 0),
      // Two saved places really can share a name; their coordinates never do.
      coordLabel: c.siteId.replace(/^site:/, '').split(',').map((n) => Number(n).toFixed(3)).join(', '),
    };
  }), [studioChoices]);

  // A distinguishing tag ONLY where two cards share a title. Tagging every card
  // with its date or its coordinates would bury the one case it exists for.
  const duplicateTitles = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of [...cloudCards.map((c) => c.title), ...studioCards.map((c) => c.title)]) {
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([t]) => t));
  }, [cloudCards, studioCards]);

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
      const next = { ...prev };
      // The inputs below build the edit by spreading the researched default, so the book's own
      // research date would ride along into the farmer's number — and the farm-gate card would
      // then date a figure typed today to a market day weeks ago. asFarmerOwnPrice strips it,
      // the same reset the inputs already apply to `confidence`. Applied to the in-memory state
      // too, not just on save, so the current session shows the honest date immediately.
      const own = asFarmerOwnPrice(price);
      if (isUsablePrice(own)) next[cropKey] = own;
      else delete next[cropKey];
      saveCropPriceOverrides(next);
      return next;
    });
  }

  // Cashflow view settings — % of harvestable value actually sold (the rest
  // feeds the household) and % assumed lost to disease/failure/underperformance
  // before it ever becomes harvestable. The loss slider OPENS at the sourced
  // 25% SA-smallholder figure (see DEFAULT_CASHFLOW_SETTINGS in lib/crop-plan.ts
  // for the citations) but stays behind confirmed:false — the farmer still
  // reviews both sliders before any Rand figure is shown.
  const [cashflowSettings, setCashflowSettings] = useState<CashflowSettings>({ ...DEFAULT_CASHFLOW_SETTINGS });
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
    try {
      setStudioChoices(studioPlanChoices(loadPlaces(), loadCanvasState));
    } catch { /* corrupt cache — the cloud rows still render */ }
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
  //
  // THIS IS AN AUTOSAVE, so there is no button and no confirmation — which is precisely why a
  // failure has to announce itself. A farmer whose phone is full otherwise keeps planning into
  // nothing and only finds out after a reload, by which point the session cannot be recovered.
  const [planSaveFailed, setPlanSaveFailed] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!plan) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setPlanSaveFailed(!saveCropPlan(plan)), 400);
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

  // Per-site climate (Task: climatically correct plans for ANY SA site). When the
  // site has coordinates, the pattern comes from the site's OWN monthly climate —
  // the same NASA POWER/Open-Meteo → Köppen path the Atlas and site reports use —
  // via the shared imbewu_loc_v4 localStorage cache (offline-safe) with a network
  // fetch behind it. nearestRainfall() above remains the explicit, labelled
  // fallback: it put the demo farm's frost-free Mkuze-valley coordinates on
  // Durban's mild-frost profile from 255 km away, which is exactly the mistake
  // this path exists to stop.
  const siteLat = canvasLatLon?.lat ?? design?.bgSite?.lat;
  const siteLon = canvasLatLon?.lon ?? design?.bgSite?.lon;
  const hasSiteCoords = typeof siteLat === 'number' && typeof siteLon === 'number';
  const [siteClimate, setSiteClimate] = useState<SiteClimate | null>(null);
  useEffect(() => {
    if (!hasSiteCoords) { setSiteClimate(null); return; }
    let cancelled = false;
    // Reset immediately so a site switch can never keep the previous site's pattern
    // on screen while the new site's climate is still resolving.
    setSiteClimate(null);
    resolveSiteClimate(siteLat!, siteLon!).then((sc) => {
      if (!cancelled) setSiteClimate(sc);
    });
    return () => { cancelled = true; };
  }, [hasSiteCoords, siteLat, siteLon]);

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
  // A region flagged 'mild' frostRisk (e.g. Durban's coastal hinterland) uses
  // KZN DARD's warm/light-frost sowing column rather than treating coast and
  // frost-prone interior as interchangeable. This mapped result is shown to
  // the farmer for transparency but is not turned into a rainfall quiz.
  const mapPattern: RainPattern =
    region?.frostRisk === 'mild' && region.pattern === 'summer' ? 'mild-frost' : (region?.pattern ?? 'summer');
  // Climate is a site fact, not a questionnaire. Rory's field test made the
  // problem plain: many farmers do not know which rainfall label describes
  // them, while the app already has the mapped location needed to decide it.
  // A plan made without a mapped site uses the visible summer-rain fallback;
  // it never invites the farmer to make an uninformed climate guess.
  //
  // Resolution order: the site's own satellite-derived climate wins; the
  // 7-point nearest-reference table is the labelled fallback (no coords, API
  // down, offline with nothing cached); no site at all assumes summer rain.
  // `climateSource` travels with the pattern so every surface that prints the
  // climate can say WHICH of the three it is printing.
  const pattern: RainPattern = siteClimate?.pattern ?? mapPattern;
  const climateSource: 'site' | 'reference' | 'none' = siteClimate ? 'site' : (region ? 'reference' : 'none');
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
      return { ...base, version: 1, plantings: [...base.plantings, next], updatedAt: Date.now() };
    });
  }
  function updatePlanting(id: string, cropKey: string, sowMonth: number, areaFraction: number, existing: boolean) {
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        version: 1,
        // A hand-edited one-time starter needs its stamp re-derived, not just
        // carried through the spread: the stamp is what settleOnceRows reads,
        // so a stale one settles the row against the month the farmer moved
        // away from. See restampEditedOnce.
        plantings: prev.plantings.map((p) => p.id === id
          ? restampEditedOnce(
            { ...p, cropKey, sowMonth, areaFraction: areaFraction < 1 ? areaFraction : undefined, existing: existing || undefined },
            new Date().getFullYear(),
            currentMonth,
          )
          : p),
        updatedAt: Date.now(),
      };
    });
  }
  function removePlanting(id: string) {
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      return { ...prev, version: 1, plantings: prev.plantings.filter((p) => p.id !== id), updatedAt: Date.now() };
    });
  }
  // Only drops plantings on beds actually shown right now (matches the
  // `plantings` derived read below) — never touches plantings parked under a
  // bed id that no longer exists in this design, same care as removePlanting.
  //
  // The confirmation is an IN-APP two-step, not window.confirm: embedded
  // webviews (the Claude browser pane, some Android PWA wrappers) suppress
  // native dialogs and return false without ever showing anything, which made
  // this button silently dead there. confirmingClear swaps the button row for
  // an inline question instead — no native dialog anywhere in this flow.
  const [confirmingClear, setConfirmingClear] = useState(false);
  function clearAllPlantings() {
    if (!plantings.length) return;
    setConfirmingClear(false);
    pushPlanHistory();
    setPlan((prev) => {
      if (!prev) return prev;
      const bedIds = new Set(beds.map((b) => b.id));
      return { ...prev, version: 1, plantings: prev.plantings.filter((p) => !bedIds.has(p.bedId)), updatedAt: Date.now() };
    });
  }

  // Existing crops are real, one-off plantings rather than an annual template:
  // pass today so a harvest that already happened is not rolled forward and
  // shown again next year on screen or in the PDF built from this same list.
  const allTasks = useMemo(
    () => (mounted ? tasksForPlan(plantings, beds, currentMonth) : []),
    [mounted, plantings, beds, currentMonth],
  );
  const nextMonth = wrapMonth(currentMonth + 1);
  const currentTasks = allTasks.filter((task) => taskMonthsFromNow(task, currentMonth) === 0);
  const nextTasks = allTasks.filter((task) => taskMonthsFromNow(task, currentMonth) === 1);
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

  const benchmarkPlantings = useMemo(
    () => plantings.filter((planting) => plantingIsActiveOrPlanned(planting, currentMonth)),
    [plantings, currentMonth],
  );
  const planYieldBenchmark = useMemo(
    () => buildPlanYieldBenchmark(plantings, beds, currentMonth),
    [plantings, beds, currentMonth],
  );
  const hasAreaConflict = planYieldBenchmark.areaConflictBedLabels.length > 0;
  // Naming the bed was never enough to act on: the farmer still had to find
  // which two crops were standing on it. Same authority as the labels above,
  // so the headline and this list cannot disagree.
  const areaConflictDetails = useMemo(
    () => benchmarkAreaConflictDetails(plantings, beds, currentMonth),
    [plantings, beds, currentMonth],
  );
  const totalYieldKg = planYieldBenchmark.knownKg;
  // Share of the VERIFIED kg total — the same number printed above the list, so
  // the bars and the headline cannot disagree. Null whenever there is no total to
  // be a share of (bed space in conflict, nothing planted, no verified crop), and
  // the row then draws no bar rather than a 0% one.
  const shareOfHarvest = (kg: number): number | null =>
    totalYieldKg !== null && totalYieldKg > 0 && Number.isFinite(kg) ? kg / totalYieldKg : null;
  const unknownYieldPlantings = benchmarkPlantings.filter((planting) => {
    const crop = cropByKey(planting.cropKey);
    return crop?.yieldKgPerM2 === null;
  });
  const coverCropPlantings = benchmarkPlantings.filter((planting) => cropByKey(planting.cropKey)?.yieldKgPerM2 === 0);
  const unknownYieldNames = planYieldBenchmark.unknownYieldCrops;
  const coverCropNames = planYieldBenchmark.nonFoodCrops;
  const hasKnownYield = !hasAreaConflict && benchmarkPlantings.some((planting) => {
    const crop = cropByKey(planting.cropKey);
    return crop !== undefined && hasPlanningYield(crop);
  });
  const yieldByBed = hasAreaConflict ? [] : beds
    .map((bed) => {
      const bedPlantings = benchmarkPlantings.filter((planting) => planting.bedId === bed.id);
      return {
        bed,
        kg: bedPlantings.reduce((sum, planting) => sum + estimatedYieldKgAdjusted(planting, bed.areaM2, plantings), 0),
        unknownNames: [...new Set(bedPlantings.flatMap((planting) => {
          const crop = cropByKey(planting.cropKey);
          return crop?.yieldKgPerM2 === null ? [crop.name] : [];
        }))],
        coverNames: [...new Set(bedPlantings.flatMap((planting) => {
          const crop = cropByKey(planting.cropKey);
          return crop?.yieldKgPerM2 === 0 ? [crop.name] : [];
        }))],
        hasPlantings: bedPlantings.length > 0,
      };
    })
    .filter((row) => row.hasPlantings);
  const yieldByCropList = planYieldBenchmark.byCrop;
  // The biggest single row in whichever view is showing, so the longest bar
  // fills the track. Against the TOTAL the longest bar was 16% of a 622px row
  // and all twelve crops crushed into the left sixth of it — technically
  // truthful, useless to compare.
  const biggestCropKg = Math.max(0, ...yieldByCropList.map((row) => row.kg));
  const biggestBedKg = Math.max(0, ...yieldByBed.map((row) => row.kg));
  const relativeTo = (kg: number, biggest: number): number | null =>
    biggest > 0 && Number.isFinite(kg) ? kg / biggest : null;
  const buyingSchedule = useMemo(
    () => (mounted ? buildBuyingSchedule(plantings, beds, currentMonth) : []),
    [mounted, plantings, beds, currentMonth],
  );
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
  const chartPlantings = useMemo(
    () => yearMode === 'established' ? recurringPlanPlantings(plantings) : plantings,
    [yearMode, plantings],
  );
  const foodAvailability = useMemo(() => buildFoodAvailability(chartPlantings, beds, chartNowMonth), [chartPlantings, beds, chartNowMonth]);
  const fieldUtilizationByMonth = useMemo(() => buildFieldUtilizationByMonth(chartPlantings, beds, chartNowMonth), [chartPlantings, beds, chartNowMonth]);

  // Cover-page facts for the printed plan and the calendar's name. Built from
  // the same values the header and the bed-check strip already show, so the
  // paper copy can't claim a different garden from the screen.
  const exportMeta = useMemo(() => {
    const plotCount = beds.filter((b) => b.kind === 'plot').length;
    const bedCount = beds.length - plotCount;
    // Provenance travels onto paper too: a printed plan must say whether its
    // climate is the site's own satellite-derived profile or a reference city.
    const locationLine = climateSource === 'site'
      ? 'This site (satellite climate records)'
      : region ? `Nearest reference: ${region.name} (fallback)` : 'No site set';
    return {
      planTitle: (canvasSite ? placeName : null) ?? designTitle,
      siteLine: climateSource === 'none'
        ? `No site set · assuming ${patternMeta.label.toLowerCase()}`
        : `${locationLine} · ${patternMeta.label}`,
      // The same two facts as separate values, because the PDF needs them apart and recovering
      // them by splitting siteLine printed "Climate: Not set" for every region in the country.
      locationLine,
      climateLine: climateSource === 'none' ? `Assuming ${patternMeta.label.toLowerCase()}` : patternMeta.label,
      bedsSummary: `${bedCount} bed${bedCount === 1 ? '' : 's'}`
        + `${plotCount ? ` · ${plotCount} staple plot${plotCount === 1 ? '' : 's'}` : ''}`
        + ` · ${beds.reduce((s, b) => s + b.areaM2, 0).toFixed(1)} m² of growing space`,
      dateLabel: new Date().toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }),
      estimatedKgPerYear: totalYieldKg,
      lossPercent: cashflowSettings.lossPercent,
      lossAllowanceConfirmed: cashflowSettings.confirmed === true,
    };
  }, [beds, canvasSite, placeName, designTitle, region, patternMeta, climateSource, totalYieldKg, cashflowSettings.lossPercent, cashflowSettings.confirmed]);

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
    if (pickerCrop.timingVerified === false) return;
    if (editingPlantingId) {
      updatePlanting(editingPlantingId, pickerCrop.key, pickerMonth, pickerFraction, pickerExisting);
    } else {
      addPlanting(pickerBedId, pickerCrop.key, pickerMonth, pickerFraction, pickerExisting);
    }
    closePicker();
  }
  // Overlap warning: which OTHER crops are already holding this bed over the
  // same months, and how much of it they hold — a soft nudge, never a block.
  //
  // This used to be computed for the fraction picker and rendered inside it,
  // so the DEFAULT whole-bed add (which shows no fraction picker) got no
  // capacity feedback at all: the farmer only found out later, from the
  // benchmark card's "Resolve overlapping bed space". It now runs for every
  // share, whole bed included, and is rendered outside that branch.
  const pickerOverlapWarning = useMemo(() => {
    if (!pickerBedId || !pickerCrop) return null;
    // The reservation edge: the bed is committed from the printed earliest
    // field-entry month (see TRANSPLANT_BED_RESERVED_FROM_MONTHS).
    const entry = bedEntryMonth(pickerMonth, pickerCrop);
    const harvest = harvestEndMonthForCrop(pickerMonth, pickerCrop);
    // Exclude the planting being edited from its own overlap check — otherwise
    // editing would always see itself as "already committed" on this bed.
    return bedOverlapWarning(
      pickerBedId, entry, harvest, pickerFraction, plantings, editingPlantingId ?? undefined,
    );
  }, [pickerBedId, pickerCrop, pickerMonth, pickerFraction, plantings, editingPlantingId]);
  const pickerHasUnverifiedTiming = useMemo(() =>
    pickerBedId
      ? bedHasUnverifiedTiming(pickerBedId, plantings, editingPlantingId ?? undefined)
      : false,
  [pickerBedId, plantings, editingPlantingId]);

  const loading = design === undefined || plan === null || !mounted;

  return (
    // EVERY surface on this screen is a hard-coded light one (#E4DCC6 paper,
    // #FFFEFA cards, #FFFFFF rows) — none of them read a theme token. But text
    // colour was left to inherit, and body's inherited colour IS a theme token:
    // in Earth Dark `--color-ink` is #EEE4D0, a pale cream. So on a dark theme
    // every child that did not name its own colour rendered pale cream on white
    // — the Auto-suggest crop names were invisible. Pinning the ink at the root
    // fixes all of them at once and, unlike colouring the 31 light containers
    // one by one, cannot be regressed by the next child someone adds.
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#E4DCC6', color: '#20190F' }}>
      {/* AUTOSAVE FAILED — above the header, because everything below it is now unsaved work.
          It stays until a later autosave succeeds; there is no dismiss, since dismissing it would
          not save anything and the farmer would be back to believing the plan is stored. */}
      {planSaveFailed && (
        <div
          role="alert"
          className="flex-shrink-0 px-3 md:px-5 py-2"
          style={{ background: '#9A3412', color: '#FDF3EC', fontSize: 12.5, lineHeight: 1.35 }}
        >
          <strong>Not saving.</strong> This phone has no space left, so changes to your crop plan
          are not being kept. Free up space — your plan is still on screen until you close it.
        </div>
      )}
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-x-auto" style={{ height: 56, background: '#FFFEFA', borderBottom: '1px solid #E2D8C4' }}>
        <RegisterInFlowBack />
        <MenuButton />
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
        {canvasSite && ((myDesignsList?.length ?? 0) + studioChoices.length > 1) && (
          // On a Studio-canvas plan the picker can't render in place (beds are
          // pinned to ?canvasSite), so "All crop plans" goes through ?switch=1 —
          // a bare URL with the fallback held back and the picker forced open.
          <Link
            href="/facilitator/crops?switch=1"
            className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
            style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#20190F', textDecoration: 'none' }}
            title="Switch to a different design's crop plan"
          >
            ‹ All crop plans
          </Link>
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
        {climateSource === 'site' ? (
          <span
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans"
            title="Rainfall pattern derived from satellite climate records (NASA POWER / ERA5) for this site's own coordinates"
            style={{ fontSize: 12, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.18)' }}
          >
            {patternMeta.icon} {patternMeta.label} · satellite records for this site
          </span>
        ) : region ? (
          <span
            className="flex-shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-sans"
            title="No per-site climate available (offline or not yet fetched) — using the nearest regional reference point instead"
            style={{ fontSize: 12, background: 'rgba(31,77,43,0.08)', color: '#1F4D2B', border: '1px solid rgba(31,77,43,0.18)' }}
          >
            {patternMeta.icon} {patternMeta.label} · nearest reference: {region.name} (fallback)
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
        <div className="flex-1 overflow-y-auto py-7 px-4">
          <div className="mx-auto w-full" style={{ maxWidth: 760 }}>
            <div className="flex items-start justify-between gap-3">
              <h1 className="font-display font-semibold" style={{ fontSize: 19, color: '#20190F', letterSpacing: '-0.01em' }}>Which site are you planning?</h1>
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
            <p className="font-sans mb-4" style={{ fontSize: 13, color: '#5C5040' }}>
              {/* Zero IS reachable — arriving with ?switch=1 opens the picker before any
                  design exists — and "0 saved designs. Each one is drawn…" was nonsense
                  in exactly the moment a farmer most needs telling what to do next. */}
              {cloudCards.length + studioCards.length === 0
                ? 'No saved designs yet. Draw your beds in the Design Studio and this is where they will appear.'
                : cloudCards.length + studioCards.length === 1
                  ? 'One saved design — here is what is on it.'
                  : `${cloudCards.length + studioCards.length} saved designs. Each one is drawn as it sits on the ground.`}
            </p>

            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(215px, 1fr))' }}>
              {cloudCards.map((c) => (
                <SiteCard
                  key={c.id}
                  title={c.title}
                  plan={c.plan}
                  bedCount={c.bedCount}
                  plotCount={0}
                  areaM2={c.areaM2}
                  source={c.savedLabel ? `Saved design · ${c.savedLabel}` : 'Saved design'}
                  tag={duplicateTitles.has(c.title) && !c.savedLabel ? 'this device' : null}
                  onClick={() => chooseSite(c.id)}
                />
              ))}
              {studioCards.map((c) => (
                <SiteCard
                  key={c.siteId}
                  title={c.title}
                  plan={c.plan}
                  bedCount={c.bedCount}
                  plotCount={c.plotCount}
                  areaM2={c.areaM2}
                  source="Design Studio map"
                  tag={duplicateTitles.has(c.title) ? c.coordLabel : null}
                  href={`/facilitator/crops?canvasSite=${encodeURIComponent(c.siteId)}`}
                  onClick={() => setSwitchingSite(false)}
                />
              ))}
            </div>

            <button
              onClick={() => chooseSite('local')}
              className="w-full mt-3 px-4 py-3 rounded-xl text-left font-sans transition-all"
              style={{ background: 'transparent', border: '1px dashed #C7BCA6', color: '#8C7A62', fontSize: 13 }}
            >
              Or use the design already open on this device
            </button>
          </div>
        </div>
      ) : beds.length === 0 ? (
        <EmptyState onVirtual={() => setUseVirtual(true)} designHref={designHref} />
      ) : (
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full px-3 md:px-5 py-4" style={{ maxWidth: PAGE_MAX_WIDTH }}>
            {useVirtual && designBeds.length === 0 && (
              <div className="mb-3 px-3 py-2 rounded-xl font-sans" style={{ fontSize: 12, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                Planning without a map — one virtual 10 m² bed.{' '}
                <Link href={designHref} style={{ color: '#1F4D2B', textDecoration: 'underline' }}>Place real beds on the Planting step</Link> to replace it.
              </div>
            )}

            {confirmingClear && plantings.length > 0 ? (
              <div
                className="flex items-center gap-2 mb-3 px-3 py-2 rounded-xl"
                style={{ background: 'rgba(179,58,58,0.06)', border: '1px solid rgba(179,58,58,0.3)' }}
              >
                <span className="font-sans flex-1" style={{ fontSize: 13, color: '#20190F' }}>
                  Clear all {plantings.length} planting{plantings.length > 1 ? 's' : ''} from every bed? You can undo once right after.
                </span>
                <button
                  onClick={clearAllPlantings}
                  className="px-4 py-2 rounded-xl font-display font-semibold flex-shrink-0"
                  style={{ fontSize: 13, background: '#B33A3A', border: '1px solid #B33A3A', color: '#FFFFFF', cursor: 'pointer' }}
                >
                  Yes, clear
                </button>
                <button
                  onClick={() => setConfirmingClear(false)}
                  className="px-4 py-2 rounded-xl font-display font-semibold flex-shrink-0"
                  style={{ fontSize: 13, background: '#FFFFFF', border: '1px solid #E2D8C4', color: '#5C5040', cursor: 'pointer' }}
                >
                  Keep
                </button>
              </div>
            ) : (
            <div className="flex gap-2 mb-3">
              <button
                onClick={openAutoSuggest}
                className="flex-1 py-2.5 rounded-xl font-display font-semibold transition-all inline-flex items-center justify-center gap-1.5"
                style={{ fontSize: 14, background: '#1F4D2B', border: '1px solid #1F4D2B', color: '#F7F2E9', cursor: 'pointer' }}
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
                  onClick={() => setConfirmingClear(true)}
                  className="px-4 py-2.5 rounded-xl font-display font-semibold transition-all inline-flex items-center justify-center gap-1"
                  style={{ fontSize: 13, background: '#FFFFFF', border: '1px solid rgba(179,58,58,0.3)', color: '#B33A3A', cursor: 'pointer' }}
                  title="Clear every planting from this plan"
                >
                  🗑 Clear all
                </button>
              )}
            </div>
            )}

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
                style={{
                  borderBottom: '1px solid #D8CDB4',
                  position: 'sticky',
                  // top:0, not 52. The 56px page header is a FLEX SIBLING of the
                  // scroll container, not an overlay inside it, so the scrollport
                  // already begins below it — the old 52px offset was pure dead
                  // band, and the crop grid scrolled past *above* the frozen row
                  // instead of under it.
                  top: 0,
                  // Above every mark in the body (the tallest is the transplant
                  // chip at 2) with headroom, so nothing can paint over the row.
                  zIndex: 5,
                  // Warm paper, not the card's own #FFFEFA: frozen chrome has to
                  // read as chrome. With both the same colour there was nothing
                  // to tell a farmer this row was pinned rather than scrolled to.
                  background: '#F5F0E8',
                  // Content passes underneath, so say so.
                  boxShadow: '0 6px 12px -6px rgba(32,25,15,0.28)',
                  borderTopLeftRadius: 16,
                  borderTopRightRadius: 16,
                }}
              >
                {/* Same paper as the row around it — otherwise the frozen bar
                    is two-tone and the corner cell reads as a separate card. */}
                <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#F5F0E8', borderRight: '1px solid #D8CDB4', padding: '8px 10px', display: 'flex', alignItems: 'flex-end' }}>
                  <span className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Bed</span>
                </div>
                <div
                  ref={monthHeaderScrollRef}
                  className="flex-1"
                  style={{ overflowX: 'hidden' }}
                >
                  <div style={{ minWidth: GRID_MIN_WIDTH - 128 }}>
                    {/* Year band. The two years were already on this axis —
                        DISPLAY_MONTHS has been 24 for a long time — but the
                        only thing naming them was a ↻ glyph and a paragraph
                        below the grid, so a farmer scrolling right had no way
                        to tell the settled year from the one being filled.
                        Spans are derived from DISPLAY_MONTHS, not two 12s, so
                        widening the window doesn't silently mislabel it. */}
                    <div className="flex" style={{ borderBottom: '1px solid #EDE7DB' }}>
                      <div
                        className="font-sans uppercase tracking-widest"
                        style={{ flex: 12, padding: '5px 8px', fontSize: 9.5, letterSpacing: '0.08em', color: '#5F735F', background: 'rgba(31,77,43,0.05)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {IDEAL_PLAN_COPY.yearOneBand}
                      </div>
                      {DISPLAY_MONTHS > 12 && (
                        <div
                          className="font-sans uppercase tracking-widest"
                          style={{ flex: DISPLAY_MONTHS - 12, padding: '5px 8px', fontSize: 9.5, letterSpacing: '0.08em', color: '#8C7A62', borderLeft: '2px solid #C4A46A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                          {IDEAL_PLAN_COPY.yearTwoBand}
                        </div>
                      )}
                    </div>
                    <div className="flex">
                    {monthOrder.map((m, i) => (
                      <div
                        key={i}
                        className="text-center font-sans"
                        style={{
                          flex: 1, padding: '8px 2px', fontSize: 11,
                          fontWeight: i === 0 ? 700 : 500,
                          color: i === 0 ? '#1F4D2B' : i >= 12 ? '#A89A82' : '#8C7A62',
                          background: i === 0 ? 'rgba(31,77,43,0.08)' : i >= 12 ? 'rgba(196,164,106,0.07)' : 'transparent',
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
            <div className="font-sans mb-5" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.5, marginTop: -12, maxWidth: 820 }}>
              <span
                className="font-sans"
                style={{ fontWeight: 600, color: '#9A6018', border: '1px solid rgba(154,96,24,0.35)', borderRadius: 4, padding: '0 3px', fontSize: 10 }}
              >
                🪴 check / transplant
              </span>{' '}
              marks when to start checking seedlings raised in a tray. The crop bar starts at the planned transplant month;
              if seedlings are delayed, update the planting instead of treating the bed as occupied. Tap it (or the crop bar) for details.
              <details className="mt-1.5">
                <summary className="font-sans" style={{ cursor: 'pointer', color: '#5C5040', fontWeight: 600 }}>
                  How the two-year timeline works (↻, faded bars, rotation)
                </summary>
                <div className="mt-1">
                  ↻ marks where year two begins. The timeline shows <strong style={{ color: '#5C5040' }}>two full years</strong> — pan
                  sideways to reach the second one. This plan holds one annual cycle rather than a separate plan per
                  year, so year two is that same cycle coming round again, drawn <em>faded</em> to say so: it is what
                  these beds do if nothing changes, not a second year you have decided on.{' '}
                  <strong style={{ color: '#5C5040' }}>Rotate crops</strong> only avoids immediate same-family
                  sequences inside this annual plan and after a crop marked as already growing. A sound multi-year
                  rotation needs dated records from earlier seasons; this screen does not store or invent them.
                </div>
              </details>
            </div>

            {/* Food/field/cashflow resilience — moved directly under the plan
                itself (Tend-style) rather than buried below Tasks/BOQ/Year-ahead,
                since it's the single view most likely to answer "am I actually
                covered month to month" at a glance. */}
            <FoodAvailabilityChart
              monthOrder={chartMonthOrder}
              availability={foodAvailability}
              yieldBenchmark={planYieldBenchmark}
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
                {([[currentMonth, currentTasks], [nextMonth, nextTasks]] as [number, CropTask[]][]).map(([m, t], idx) => (
                  <div key={m} className="mb-2.5">
                    <div className="font-display font-semibold flex items-baseline gap-2 mb-1" style={{ fontSize: 13.5, color: '#20190F' }}>
                      {monthLabel(m)}
                      <span className="font-sans" style={{ fontSize: 10, color: '#8C7A62', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                        {idx === 0 ? 'this month' : 'next month'}
                      </span>
                    </div>
                    <TaskList tasks={t} />
                  </div>
                ))}
                <div className="font-sans rounded-lg px-2.5 py-2 mb-3" style={{ fontSize: 11.5, color: '#7A4A12', lineHeight: 1.45, background: '#FFF8E8', border: '1px solid rgba(154,96,24,0.3)' }}>
                  {SUCCESSION_TIMING_GUIDANCE}
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
                        const t = allTasks.filter((task) => taskMonthsFromNow(task, currentMonth) === i);
                        if (t.length === 0) return null;
                        return (
                          <div key={i} className="mb-2">
                            <div className="font-display font-semibold mb-1" style={{ fontSize: 12.5, color: '#20190F' }}>
                              {monthLabel(m)}{i >= 12 ? ' (next year)' : ''}
                            </div>
                            <TaskList tasks={t} />
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
                  <div className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>🥬 Harvest total — conservative benchmark</div>
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
                  {hasAreaConflict ? (
                    <span style={{ fontSize: 18 }}>Resolve overlapping bed space</span>
                  ) : hasKnownYield && totalYieldKg !== null ? (
                    <>{totalYieldKg.toFixed(1)} <span style={{ fontSize: 14, fontWeight: 500, color: '#8C7A62' }}>kg across active and planned crop cycles</span></>
                  ) : unknownYieldNames.length > 0 ? (
                    <span style={{ fontSize: 18 }}>No verified kg total</span>
                  ) : coverCropNames.length > 0 ? (
                    <span style={{ fontSize: 18 }}>No food-yield total</span>
                  ) : (
                    <>0.0 <span style={{ fontSize: 14, fontWeight: 500, color: '#8C7A62' }}>kg · no crops to plant</span></>
                  )}
                </div>
                {!hasAreaConflict && hasKnownYield && planYieldBenchmark.kgPerM2 !== null && (
                  <div className="mb-2" style={{ fontSize: 12, color: '#8C7A62' }}>
                    {planYieldBenchmark.kgPerM2.toFixed(2)} kg/m² across {planYieldBenchmark.growingAreaM2.toFixed(1)} m² of growing space — a density figure for comparing plans, not a yield promise
                  </div>
                )}
                {hasAreaConflict && (
                  <div className="mb-2">
                    {/* One sentence that has to hold for EVERY row the list can
                        contain. A bed reaches this state for three different
                        reasons — crops sharing months, a share that is not a
                        usable fraction, or a crop whose finish timing the app
                        will not reason about — so the headline says only the
                        thing all three have in common, and each row states its
                        own reason underneath. */}
                    <div className="font-sans mb-1.5" style={{ fontSize: 11.5, color: '#A83A2C', lineHeight: 1.45 }}>
                      No kg or value total is shown because the space on these beds does not add up. Open a crop below and change its bed, month or share — the app will not guess which crop loses space.
                    </div>
                    {areaConflictDetails.map((conflict) => (
                      <div key={conflict.bedId} className="mb-1.5">
                        <div className="font-display font-semibold" style={{ fontSize: 12, color: '#20190F' }}>{conflict.bedLabel}</div>
                        {conflict.plantings.map((row) => {
                          const planting = plantings.find((p) => p.id === row.plantingId);
                          const span = monthSpanLabel(row.months);
                          const detail = row.reason === 'invalid-share'
                            ? (Number.isFinite(row.areaFraction)
                              ? `share recorded as ${Math.round(row.areaFraction * 100)}% of the bed`
                              : 'no usable share recorded')
                            : row.reason === 'unverified-timing'
                              ? 'finish timing not verified, so its months cannot be checked'
                              : [span, row.areaFraction < 1 ? `${Math.round(row.areaFraction * 100)}% of the bed` : '']
                                .filter(Boolean).join(' · ');
                          return (
                            <button
                              key={row.plantingId}
                              onClick={() => { if (planting) setActivePlanting(planting); }}
                              disabled={!planting}
                              className="w-full flex items-center justify-between font-sans text-left rounded-lg px-2 py-1 mt-0.5"
                              style={{
                                fontSize: 12, color: '#5C5040', background: '#FBF3F0',
                                border: '1px solid #E8CFC7', cursor: planting ? 'pointer' : 'default',
                              }}
                            >
                              <span>
                                <CropIcon cropKey={row.cropKey} icon={cropByKey(row.cropKey)?.icon ?? '🌱'} size={14} /> {row.cropName}
                                {detail ? <span style={{ color: '#8C7A62' }}> · {detail}</span> : null}
                              </span>
                              <span className="font-sans" style={{ fontSize: 11, color: '#A83A2C' }}>Open ›</span>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
                {hasKnownYield && (
                  <div className="font-sans mb-2" style={{ fontSize: 11, color: '#8C7A62' }}>
                    Conservative mapped-area comparison for one cycle of each active or planned planting; no loss allowance or within-month picking curve is applied here. A finished one-off crop is not repeated into a later year.
                  </div>
                )}
                {unknownYieldNames.length > 0 && (
                  <div className="font-sans mb-2" style={{ fontSize: 11, color: '#9A6018', lineHeight: 1.45 }}>
                    Excludes {unknownYieldNames.join(', ')}: no verified kg/m² benchmark is available, so the app does not turn those crops into zero or invent a total.
                  </div>
                )}
                {coverCropNames.length > 0 && (
                  <div className="font-sans mb-2" style={{ fontSize: 11, color: '#7A5B24', lineHeight: 1.45 }}>
                    {coverCropNames.join(', ')} {coverCropNames.length === 1 ? 'is a' : 'are'} soil-cover crop{coverCropNames.length === 1 ? '' : 's'}, recorded as 0 food kg rather than counted as harvest.
                  </div>
                )}

                {totalYieldKg !== null && totalYieldKg > 0 && (
                  <div className="font-sans mb-1.5" style={{ fontSize: 10.5, color: '#8C7A62', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Bar length compares crops · % is share of the {totalYieldKg.toFixed(1)} kg above
                  </div>
                )}
                <div>
                  {harvestBoxView === 'crop' ? (
                    <>
                      {yieldByCropList.map(({ cropKey, name, icon, kg }) => (
                        <HarvestShareRow
                          key={cropKey}
                          cropKey={cropKey}
                          icon={icon}
                          name={name}
                          share={shareOfHarvest(kg)}
                          relative={relativeTo(kg, biggestCropKg)}
                        >
                          <span style={{ color: '#20190F' }}>{kg.toFixed(1)} kg</span>
                        </HarvestShareRow>
                      ))}
                      {[...new Set(unknownYieldPlantings.map((planting) => planting.cropKey))].map((cropKey) => {
                        const crop = cropByKey(cropKey);
                        if (!crop) return null;
                        return (
                          <HarvestShareRow key={cropKey} cropKey={crop.key} icon={crop.icon} name={crop.name} share={null} relative={null}>
                            <span style={{ color: '#9A6018' }}>not verified</span>
                          </HarvestShareRow>
                        );
                      })}
                      {[...new Set(coverCropPlantings.map((planting) => planting.cropKey))].map((cropKey) => {
                        const crop = cropByKey(cropKey);
                        if (!crop) return null;
                        return (
                          <HarvestShareRow key={cropKey} cropKey={crop.key} icon={crop.icon} name={crop.name} share={null} relative={null}>
                            <span style={{ color: '#7A5B24' }}>soil cover · 0 food kg</span>
                          </HarvestShareRow>
                        );
                      })}
                      {plantings.length === 0 && (
                        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing planted yet.</div>
                      )}
                    </>
                  ) : (
                    <>
                      {yieldByBed.map(({ bed, kg, unknownNames, coverNames }) => (
                        <HarvestShareRow key={bed.id} name={bed.label} share={kg > 0 ? shareOfHarvest(kg) : null} relative={kg > 0 ? relativeTo(kg, biggestBedKg) : null}>
                          <span className="text-right" style={{ color: '#20190F', display: 'inline-block' }}>
                            {kg > 0 && `${kg.toFixed(1)} kg known`}
                            {kg > 0 && unknownNames.length > 0 && <br />}
                            {unknownNames.length > 0 && <span style={{ color: '#9A6018' }}>{unknownNames.join(', ')} not verified</span>}
                            {(kg > 0 || unknownNames.length > 0) && coverNames.length > 0 && <br />}
                            {coverNames.length > 0 && <span style={{ color: '#7A5B24' }}>{coverNames.join(', ')} soil cover</span>}
                          </span>
                        </HarvestShareRow>
                      ))}
                      {plantings.length === 0 && (
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
              planNotes={plan?.planNotes}
              planNotesAt={plan?.planNotesAt}
              meta={exportMeta}
            />

            {/* Seed BOQ + year-ahead report */}
            <div className="grid gap-4 mt-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
              <div className="rounded-2xl p-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
                <div className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>🌱 Seeds &amp; seedlings — what to buy, and when</div>
                <p className="font-sans mb-2 mt-0.5" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.4 }}>
                  {/* The subtitle must not promise which month comes first:
                      buildBuyingSchedule drops months with nothing to buy, so
                      the first block is frequently a later one. The month
                      headings say which months these actually are. */}
                  Grouped by the month to get it. Ready-grown seedlings are listed for the month they go in the ground.
                </p>
                {/* Was one flat alphabetical list of every crop in the plan — the
                    same aggregate the PDF stopped printing. buildBuyingSchedule
                    is the calendar the printed plan already uses, including the
                    buy-seedlings-at-planting-month distinction, so the screen and
                    the paper now say the same thing in the same order. */}
                <div className="space-y-3">
                  {buyingSchedule.slice(0, VISIBLE_BUYING_MONTHS).map((monthGroup) => (
                    <BuyingMonthBlock key={monthGroup.month} monthGroup={monthGroup} isNow={monthGroup.month === currentMonth} />
                  ))}
                  {buyingSchedule.length > VISIBLE_BUYING_MONTHS && (
                    <details className="rounded-xl px-3 py-2" style={{ border: '1px solid #E2D8C4', background: '#FBF6EC' }}>
                      <summary className="font-display font-semibold" style={{ fontSize: 12.5, color: '#1F4D2B', cursor: 'pointer' }}>
                        {/* The schedule is a ROLLING twelve months from this
                            one (rollingMonths), so for any plan opened after
                            about March "later in the year" named the wrong
                            year for half these months. */}
                        Later in the next 12 months ({buyingSchedule.length - VISIBLE_BUYING_MONTHS} more {buyingSchedule.length - VISIBLE_BUYING_MONTHS === 1 ? 'month' : 'months'})
                      </summary>
                      <div className="space-y-3 mt-2">
                        {buyingSchedule.slice(VISIBLE_BUYING_MONTHS).map((monthGroup) => (
                          <BuyingMonthBlock key={monthGroup.month} monthGroup={monthGroup} isNow={false} />
                        ))}
                      </div>
                    </details>
                  )}
                  {buyingSchedule.length === 0 && (
                    <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing new to buy yet.</div>
                  )}
                </div>
                <details className="mt-2">
                  <summary className="font-sans" style={{ fontSize: 11, color: '#8C7A62', cursor: 'pointer' }}>
                    What these quantities do and do not cover
                  </summary>
                  <p className="font-mono mt-1" style={{ fontSize: 10, color: '#9A8268' }}>
                    Field-position ranges come from mapped area and published spacing; they are not guaranteed buy quantities
                    or germination/loss allowances. Supplier and crop-specific guidance may change what to purchase. Botanical seed quantity is
                    not inferred from mature spacing: use the packet&apos;s crop-specific direct-sowing rate and germination
                    guidance. Planting-piece ranges are shown only for seedlings, cloves, corms, slips and seed potatoes when both spacing
                    axes are verified. Where a row layout is not verified, confirm it locally before buying material.
                  </p>
                </details>
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

            {/* Only for a plan that came from an accepted suggestion — a
                hand-built plan has no such notes and must not get an empty
                card implying it does. */}
            {plan?.planNotes?.length && plan.planNotesAt && plantings.length > 0
              ? <AcceptedPlanNotesCard notes={plan.planNotes} generatedAt={plan.planNotesAt} />
              : null}

            <DisclosureCard
              title="🔎 What the planner can prove"
              // The card collapses; the CLAIM does not. This line is always on
              // screen, so the honesty statement itself is what a farmer reads
              // at a glance and the eleven sentences of method sit behind the
              // tap — rather than the claim going behind it too.
              summary="Every yield figure and date here is either from a published source or labelled as an estimate to confirm locally — tap for the method and the sources."
            >
              <p className="font-sans mb-2" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
                Yield points use the conservative end of published commercial KZN benchmarks where that crop is
                listed. They compare plans; they do not predict this household&apos;s harvest. The warm/light-frost
                windows, spacing and duration use the official tables where those tables cover the crop; catalog
                fallbacks and other regional patterns still need local confirmation. Bed occupancy uses the upper
                published maturity/picking endpoint so two crops are not booked onto the same ground, but the
                source says these times are approximate and assume optimum conditions; actual crops may mature later.
                Every later sowing or transplant is conditional on observing that the previous crop is finished and the bed is clear. The
                app does not split a crop-cycle total into invented monthly kilograms. Auto-suggest only ranks crops
                with verified yield, duration and field-spacing support. A family plan starts from a supported diverse
                mix; an exact crop list becomes a strict whitelist. It requires irrigation because intensive
                succession without a farm water plan is not defensible. Its packing is a transparent
                heuristic, not proof of a global maximum or of a physical row layout. Commercial ranking is fresh
                weight per crop cycle; it is not profit, nutrition or evidence of buyer demand.
              </p>
              <p className="font-sans" style={{ fontSize: 11.5, color: '#5C5040', lineHeight: 1.55 }}>
                Official KZN DARD tables:{' '}
                <a href="https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/expected_yields.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>yield benchmarks</a>,{' '}
                <a href="https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/plant_establishment.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>sowing and establishment</a>,{' '}
                <a href="https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/length_of_growing_period.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>growing and picking periods</a>, and{' '}
                <a href="https://www.kzndard.gov.za/images/Documents/Horticulture/Veg_prod/successional_cropping.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>succession limits and farmer choice</a>.
              </p>
            </DisclosureCard>

            {/* Two standing explainers. Side by side once there is room for
                two readable columns, stacked below that — left full-width they
                would run to a 200-character measure on a desktop. */}
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))' }}>
              <RotationExplanationCard />
              <OrganicGuideCard />
            </div>

            <div className="font-sans mt-4 text-center mx-auto" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5, maxWidth: 820 }}>
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
          overlapWarning={pickerOverlapWarning}
          hasUnverifiedTiming={pickerHasUnverifiedTiming}
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
          onEdit={() => { openEditPicker(activePlanting); setActivePlanting(null); }}
          onRemove={() => { removePlanting(activePlanting.id); setActivePlanting(null); }}
          onClose={() => setActivePlanting(null)}
        />
      )}

      {/* Auto-suggest: questionnaire + review */}
      {autoPhase !== 'idle' && (
        <AutoSuggestModal
          phase={autoPhase}
          goal={aGoal} onGoal={chooseGoal}
          focusCount={aFocusCount} onFocusCount={setAFocusCount}
          groups={aGroups} onToggleGroup={toggleGroup}
          cropKeys={aCropKeys} onToggleCrop={toggleAutoCrop} onSetCrops={setACropKeys}
          rhythm={aRhythm} onRhythm={setARhythm}
          planTiming={aPlanTiming} onPlanTiming={setAPlanTiming}
          generating={autoGenerating} idealMeta={idealMeta}
          hasCurrentPlantings={plantings.length > 0}
          pattern={pattern} climateSource={climateSource} referenceName={region?.name ?? null}
          rotateCrops={aRotateCrops} onRotateCrops={setARotateCrops}
          allowVinesInBeds={aAllowVinesInBeds} onAllowVinesInBeds={setAAllowVinesInBeds}
          allowMixedCropsInBed={aAllowMixedCropsInBed} onAllowMixedCropsInBed={setAAllowMixedCropsInBed}
          reliableIrrigation={aReliableIrrigation} onReliableIrrigation={setAReliableIrrigation}
          siteClimate={siteClimate}
          result={autoResult}
          onGenerate={runAutoSuggest}
          onAccept={acceptAutoSuggest}
          onBackToQuestions={() => setAutoPhase('questions')}
          onClose={() => setAutoPhase('idle')}
        />
      )}

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

// ── The storage story, in one place ─────────────────────────────────────
//
// The catalog has carried a sourced storageMonths, the storage CONDITIONS it
// depends on, and the source URL for ten crops — and none of it reached a
// farmer. The shelf life became a gold bar on one chart; the conditions and the
// source rendered nowhere at all. A shelf life without its conditions is not a
// fact about food, it is a number: FAO's two months for butternut is two months
// for a CURED, undamaged, ventilated fruit and nothing at all for a bruised one.
// So the two always travel together, from here, wherever storage is mentioned.

function CropStorageLine({ crop }: { crop: CropDef }) {
  if (crop.storageMonths === undefined || !crop.storageConditions) return null;
  return (
    <div>
      Keeps about {crop.storageMonths} month{crop.storageMonths === 1 ? '' : 's'} in store — {crop.storageConditions}
      {crop.storageSourceUrl && (
        <>
          {' '}
          <a
            href={crop.storageSourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1F4D2B', textDecoration: 'underline' }}
          >
            source
          </a>
        </>
      )}
    </div>
  );
}

/**
 * One month of the availability chart, opened by tapping its column.
 *
 * Fresh rows say only that the crop is in its picking window — that is all the
 * chart ever claimed. Stored rows carry the shelf life, the conditions and the
 * source, exactly as the planting sheet does, because those three together are
 * what make a "stored" square mean anything.
 */
function MonthAvailabilityDetail({
  month, items, onClose,
}: {
  month: number;
  items: FoodAvailabilityItem[];
  onClose: () => void;
}) {
  const fresh = items.filter((item) => item.status === 'fresh');
  const stored = items.filter((item) => item.status === 'stored');
  return (
    <div className="rounded-xl p-3 mt-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{monthLabel(month)}</div>
        <button onClick={onClose} aria-label={`Close ${monthLabel(month)} detail`} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62', padding: 0 }}>
          <X size={14} />
        </button>
      </div>
      {/* "with a sourced shelf life", not "inside its shelf life": only crops
          with a researched storageMonths ever show as stored, so about every
          other crop this panel knows nothing — it must not claim the pantry
          is empty, only that it has nothing sourced to report. */}
      {items.length === 0 && (
        <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Nothing is scheduled for picking, and nothing with a sourced shelf life is still in store.</div>
      )}
      {fresh.length > 0 && (
        <div className="mb-2">
          <div className="font-sans uppercase tracking-widest mb-1" style={{ fontSize: 9.5, color: '#8C7A62', letterSpacing: '0.08em' }}>Ready to pick</div>
          {fresh.map((item) => (
            <div key={item.cropKey} className="font-sans flex items-center gap-1.5" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.5 }}>
              <CropIcon cropKey={item.cropKey} icon={item.icon} size={13} /> {item.name}
            </div>
          ))}
        </div>
      )}
      {stored.length > 0 && (
        <div>
          <div className="font-sans uppercase tracking-widest mb-1" style={{ fontSize: 9.5, color: '#8C7A62', letterSpacing: '0.08em' }}>From store</div>
          {stored.map((item) => {
            const crop = cropByKey(item.cropKey);
            return (
              <div key={item.cropKey} className="mb-1.5">
                <div className="font-sans flex items-center gap-1.5" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.5 }}>
                  <CropIcon cropKey={item.cropKey} icon={item.icon} size={13} /> {item.name}
                </div>
                {crop && (
                  <div className="font-sans" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.45 }}>
                    <CropStorageLine crop={crop} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Plan notes, grouped by kind ─────────────────────────────────────────
//
// ONE renderer, two places. The review modal shows the notes of a suggestion
// the farmer has not accepted yet; the plan page shows the notes of the
// suggestion they DID accept, read back off the saved plan. They are the same
// sentences and must be ranked, grouped and collapsed the same way — a second
// copy of this markup is how the two drift until the persisted one quietly
// becomes the flat amber wall this grouping was written to kill.

function PlanNoteGroups({ notes }: { notes: PlanNote[] }) {
  // Grouped by kind, not stacked into one amber wall: the two load-bearing
  // vine warnings used to sit at positions 5-6 under twenty-six copies of a
  // per-bed rest note.
  const warnings = notes.filter((n) => n.kind === 'warning');
  const choices = notes.filter((n) => n.kind === 'choice');
  const gaps = notes.filter((n) => n.kind === 'gap');
  const basis = notes.filter((n) => n.kind === 'basis');
  return (
    <div className="flex flex-col gap-2">
      {warnings.length > 0 && (
        <div className="px-3 py-2 rounded-lg font-sans flex flex-col gap-1.5" style={{ fontSize: 12.5, background: 'rgba(192,122,30,0.12)', border: '1px solid rgba(192,122,30,0.4)', color: '#8A5210' }}>
          {warnings.map((n, i) => <div key={i}>{n.text}</div>)}
        </div>
      )}
      {choices.length > 0 && (
        <details className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 11.5, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040' }}>
          <summary style={{ cursor: 'pointer' }}>What the planner chose, bed by bed ({choices.length})</summary>
          <ul className="flex flex-col gap-1 pt-1.5" style={{ listStyle: 'disc', paddingInlineStart: 26 }}>
            {choices.map((n, i) => <li key={i}>{n.text}</li>)}
          </ul>
        </details>
      )}
      {gaps.length > 0 && (
        <details className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 11.5, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040' }}>
          <summary style={{ cursor: 'pointer' }}>
            {/* Count BEDS, deduped: one bed can be named by two gap notes (a
                stranded-bed note plus a grouped rest one), and summing bedIds
                lengths counted it twice. */}
            {PLAN_NOTES_PANEL_COPY.gapsHeading} ({(() => {
              const seen = new Set<string>();
              let unattributed = 0;
              for (const n of gaps) {
                if (n.bedIds?.length) for (const id of n.bedIds) seen.add(id);
                else unattributed++;
              }
              return seen.size + unattributed;
            })()})
          </summary>
          <div className="flex flex-col gap-1.5 pt-1.5">
            {gaps.map((n, i) => <div key={i}>{n.text}</div>)}
          </div>
        </details>
      )}
      {basis.length > 0 && (
        <details className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 10.5, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#8C7A62' }}>
          <summary style={{ cursor: 'pointer' }}>{PLAN_NOTES_PANEL_COPY.basisHeading}</summary>
          <div className="flex flex-col gap-1.5 pt-1.5">
            {basis.map((n, i) => <div key={i}>{n.text}</div>)}
          </div>
        </details>
      )}
    </div>
  );
}

/**
 * The accepted suggestion's reasons, on the plan page itself.
 *
 * The date label is not decoration. Nothing invalidates these notes when the
 * farmer edits the plan afterwards — they describe the suggestion as it was
 * made, and the honest fix for that is to SAY when it was made rather than to
 * silently drop notes on the first hand edit (which would delete the warnings
 * exactly when a farmer started changing things).
 */
function AcceptedPlanNotesCard({ notes, generatedAt }: { notes: PlanNote[]; generatedAt: number }) {
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>🧭 Why this plan chose what it chose</div>
      <p className="font-sans mb-3 mt-0.5" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.4 }}>
        From the plan suggested in {planNotesDateLabel(generatedAt)}. Anything you have changed by hand since is not
        described here.
      </p>
      <PlanNoteGroups notes={notes} />
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
      {/* GRID_MIN_WIDTH belongs to the OTHER (24-month bed-timeline) chart
       * elsewhere in this file — MonthLineChart has exactly one call site
       * (the 15-month Field utilization tab below) and its own natural width
       * is W, not that constant. Borrowing it left the wrapper's floor wider
       * than this chart's own coordinate space, and the SVG's width="100%"
       * meant it always stretched to fill that (or any wider ancestor)
       * regardless of the floor — while the label row below stays pinned at
       * a literal W. The two drifted apart increasingly toward the right
       * (2026-08-22, screenshot repro: percentages read correctly, but sat
       * far right of the point they belonged to). Fixed by giving the SVG
       * the SAME literal pixel width as the label row, so neither one can
       * ever stretch independently of the other. */}
      <div style={{ minWidth: W }}>
        <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block' }}>
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

type FoodValueMode = 'availability' | 'utilization' | 'value';

function FoodAvailabilityChart({
  monthOrder, availability, yieldBenchmark, utilizationByMonth, plantings, priceOverrides, onPriceOverrideChange,
  cashflowSettings, onCashflowSettingsChange, yearMode, onYearModeChange,
}: {
  monthOrder: number[];
  availability: FoodAvailabilityItem[][];
  yieldBenchmark: PlanYieldBenchmark;
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
  // Which month column is expanded. Null = none; tapping the open one closes it.
  const [openMonth, setOpenMonth] = useState<number | null>(null);
  const [valuePriceMode, setValuePriceMode] = useState<'retail' | 'wholesale'>('retail');
  const [editingPrices, setEditingPrices] = useState(false);
  // Collapsed by default: the comparison bands are orientation, not part of
  // the plan's own numbers, and the card is already dense.
  const [showComparison, setShowComparison] = useState(false);
  // DISPLAY-ONLY household guideline (docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md
  // bans headcount as a planting input). This state exists purely to render a
  // consumption-guideline sentence; it is never persisted and must never be
  // passed to autoSuggestPlan, bed sizing, repetitions or any lib/ function.
  // The household-guideline-guardrail test enforces both properties.
  const [householdSizeGuideline, setHouseholdSizeGuideline] = useState('');
  const cols = monthOrder.map((m) => {
    const items = availability[m] ?? [];
    return { m, fresh: items.filter((it) => it.status === 'fresh'), stored: items.filter((it) => it.status === 'stored') };
  });
  const maxTotal = Math.max(1, ...cols.map((c) => c.fresh.length + c.stored.length));
  const hasStoredItems = cols.some((c) => c.stored.length > 0);
  const isAvailabilityEmpty = cols.every((c) => c.fresh.length + c.stored.length === 0);
  const utilMax = Math.max(1, ...monthOrder.map((m) => utilizationByMonth[m] ?? 0));
  const pricedCropKeys = [...new Set(plantings.map((p) => p.cropKey))].filter((key) => !UNPRICED_CROPS.has(key)).sort();
  const unpricedBenchmarkCrops = yieldBenchmark.byCrop.filter((row) => !priceFor(row.cropKey, priceOverrides)).map((row) => row.name);
  const assumptionsConfirmed = cashflowSettings.confirmed === true;
  // ONE value computation for the blended Production score AND the per-kind
  // beds/plots split under it (2026-08-22, Rory: "should we give a veg beds
  // figure and a staple crops figure seperately?") — three R/m² figures off
  // one formula, so they cannot drift onto different price/slider rules.
  //
  // The formula itself now lives in lib/plan-value.ts, because the Finance
  // screen's forward card values kilograms the same way. A second inline copy
  // there would have been a second answer to "what is my plan worth", drifting
  // the first time either the loss slider, the sale channel or the home-
  // consumption rule changed — with nothing failing to say so. (That module also
  // keeps the rule that produce kept at home is valued at RETAIL whichever
  // channel is selected: reusing the wholesale toggle there understated the home
  // side and made one label describe two different calculations.)
  const scenarioValues = (rows: PlanYieldBenchmark['byCrop']) =>
    planValue(rows, priceOverrides, valuePriceMode, cashflowSettings);
  const { cash: cashIncome, home: homeValue } = scenarioValues(yieldBenchmark.byCrop);
  // 128, not the 56 it was. Rory, 2026-09-04, on a laptop: "can you make these
  // graphics bigger we have space so make use of it so we can see them better".
  // The chart sits in a card that is already GRID_MIN_WIDTH (1520px) wide for
  // its 15 columns, so height was the only axis still starved — at 56px a
  // one-crop month and a three-crop month were 8px apart and read the same.
  const BAR_MAX_H = 128;

  // 2026-08-22, Rory: "i dont think this start from today function works."
  // Traced (background diagnosis workflow, confirmed live against the
  // Ubhejane Creche sample plan) to a real design edge case, not a wiring
  // bug: "From today" only differs from "An established year" for plantings
  // marked existing/once (see recurringPlanPlantings + slotIsPast in
  // lib/crop-plan.ts) — a plan built purely by auto-suggest has none of
  // those, so the toggle is a genuine no-op on it. Say so plainly instead of
  // silently doing nothing.
  const hasHistoryToTrim = plantings.some((p) => p.existing === true || typeof p.once === 'string');

  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>🍽️ Food, field & value</div>
      <div className="inline-flex flex-wrap rounded-full p-0.5 mb-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
        {([['availability', '🍽️ Availability'], ['utilization', '🌱 Field utilization'], ['value', '💰 Plan-cycle value']] as [FoodValueMode, string][]).map(([nextMode, label]) => (
          <button key={nextMode} onClick={() => setMode(nextMode)} className="font-sans font-semibold" style={{ fontSize: 11.5, padding: '5px 12px', borderRadius: 999, border: 'none', cursor: 'pointer', background: mode === nextMode ? '#1F4D2B' : 'transparent', color: mode === nextMode ? '#F7F2E9' : '#5C5040' }}>
            {label}
          </button>
        ))}
      </div>

      {mode !== 'value' && (
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="inline-flex rounded-full p-0.5" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
            {([['established', '🌳 An established year'], ['fromToday', '🌱 From today']] as ['established' | 'fromToday', string][]).map(([nextYearMode, label]) => (
              <button key={nextYearMode} onClick={() => onYearModeChange(nextYearMode)} className="font-sans font-semibold" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', background: yearMode === nextYearMode ? '#5C5040' : 'transparent', color: yearMode === nextYearMode ? '#F7F2E9' : '#5C5040' }}>
                {label}
              </button>
            ))}
          </div>
          <span className="font-sans" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.4 }}>
            {!hasHistoryToTrim
              ? 'Both views match for now — this plan has no already-growing or one-off crops yet for "From today" to trim.'
              : yearMode === 'established' ? 'The repeated annual timing of planned rows; one-off existing crops are not repeated.' : 'Only timing still ahead from today; finished existing crops do not remain on the chart.'}
          </span>
        </div>
      )}

      {mode === 'availability' && (
        <>
          <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
            Fresh-picking windows only. Storage appears only with sourced conditions. The source does not provide a within-window kg curve, so this chart deliberately shows no monthly kilograms or money.
          </p>
          {isAvailabilityEmpty ? (
            <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Add a planting with verified timing to see availability.</div>
          ) : (
            <>
              <div className="flex items-center gap-4 mb-3 font-sans" style={{ fontSize: 11, color: '#5C5040' }}>
                <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 2, background: '#7FAE6E', display: 'inline-block' }} /> Fresh</span>
                {hasStoredItems && <span className="inline-flex items-center gap-1.5"><span style={{ width: 9, height: 9, borderRadius: 2, background: '#D4A017', display: 'inline-block' }} /> Stored under named conditions</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <div className="flex" style={{ minWidth: GRID_MIN_WIDTH, gap: 6 }}>
                  {cols.map(({ m, fresh, stored }, i) => {
                    const total = fresh.length + stored.length;
                    const height = total === 0 ? 0 : Math.max(10, Math.round((total / maxTotal) * BAR_MAX_H));
                    // The two fills are separated by a 2px strip of the card, so
                    // a stored month reads as two quantities rather than one bar
                    // with a colour change. That gap has to come OUT of the bar,
                    // not be added to it, or a split month would stand taller
                    // than a solid month holding the same number of crops.
                    const GAP = 2;
                    const split = stored.length > 0 && fresh.length > 0;
                    const body = Math.max(0, height - (split ? GAP : 0));
                    const storedHeight = total === 0 ? 0 : Math.round((stored.length / total) * body);
                    const freshHeight = body - storedHeight;
                    return (
                      <div key={i} style={{ flex: 1, textAlign: 'center', minWidth: 64 }}>
                        {/* A BUTTON, not a div with a tooltip. The stored half of
                            this chart carried its only explanation in a `title`
                            attribute, which on a phone — where this app is used —
                            never appears at all: the sourced shelf life and the
                            conditions it depends on were desktop-only. The hover
                            text stays for a mouse; the tap opens the same detail. */}
                        <button
                          type="button"
                          onClick={() => setOpenMonth(openMonth === m ? null : m)}
                          aria-expanded={openMonth === m}
                          aria-label={`${MONTHS_SHORT[m - 1]} — ${total === 0 ? 'nothing scheduled' : `${total} crop${total === 1 ? '' : 's'}`}, tap for detail`}
                          style={{ display: 'block', width: '100%', background: openMonth === m ? '#F5F0E8' : 'none', border: 'none', borderRadius: 6, padding: '2px 0', cursor: 'pointer' }}
                        >
                          {/* The bar's own number, on the bar. The icon rows
                              below say WHICH crops; without this you had to
                              count them to learn how many, which is the one
                              thing the bar height is there to tell you. */}
                          <div className="font-mono" style={{ fontSize: 12, fontWeight: 700, height: 16, color: total === 0 ? '#C9BFA8' : '#20190F' }}>
                            {total === 0 ? '–' : total}
                          </div>
                          <div style={{ height: BAR_MAX_H, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
                            {total === 0 ? <div style={{ width: '68%', height: 3, background: '#E2D8C4', borderRadius: 2 }} /> : (
                              <div title={[...stored, ...fresh].map((item) => `${item.icon} ${item.name} — ${item.status}`).join('\n')} style={{ width: '68%', display: 'flex', flexDirection: 'column', gap: split ? GAP : 0 }}>
                                {/* Rounded at the data end only — the top of the
                                    column, away from the baseline it grows off. */}
                                {storedHeight > 0 && <div style={{ height: storedHeight, background: '#D4A017', borderRadius: '4px 4px 0 0' }} />}
                                {freshHeight > 0 && <div style={{ height: freshHeight, background: '#7FAE6E', borderRadius: '4px 4px 0 0' }} />}
                              </div>
                            )}
                          </div>
                          <div className="font-sans" style={{ fontSize: 12, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? '#1F4D2B' : '#8C7A62', marginTop: 6 }}>{MONTHS_SHORT[m - 1]}</div>
                          <div style={{ fontSize: 18, minHeight: 22, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', marginTop: 2 }}>
                            {fresh.map((item, idx) => (
                              <CropIcon key={`${item.cropKey}-${idx}`} cropKey={item.cropKey} icon={item.icon} size={18} />
                            ))}
                          </div>
                          <div style={{ fontSize: 18, minHeight: 22, opacity: 0.6, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                            {stored.map((item, idx) => (
                              <CropIcon key={`${item.cropKey}-${idx}`} cropKey={item.cropKey} icon={item.icon} size={18} />
                            ))}
                          </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
              {openMonth !== null && (
                <MonthAvailabilityDetail
                  month={openMonth}
                  items={availability[openMonth] ?? []}
                  onClose={() => setOpenMonth(null)}
                />
              )}
            </>
          )}
        </>
      )}

      {mode === 'utilization' && (
        <>
          <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.4 }}>
            Share of mapped growing area occupied each month. The planner reserves each crop through the upper end of its supported maturity and picking range to avoid double-booking; finish a crop earlier only after checking the bed.
          </p>
          <MonthLineChart monthOrder={monthOrder} values={monthOrder.map((m) => utilizationByMonth[m] ?? 0)} max={utilMax} color="#5C7FA6" referenceValue={1} dotColor={(value) => (value <= 0 ? '#D8CFBC' : value > 1 ? '#B33A3A' : '#5C7FA6')} labelColor={(value) => (value > 1 ? '#B33A3A' : '#20190F')} formatLabel={(value) => `${Math.round(value * 100)}%`} />
        </>
      )}

      {mode === 'value' && (
        <>
          <p className="font-sans mb-3" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.45 }}>
            What-if value for the saved plan&apos;s crop-cycle benchmark totals. It is not a monthly cashflow forecast, annual profit, live market quote or harvest promise. Default prices are an editable South African snapshot from {PRICE_SNAPSHOT_MONTHS}; confirm a real buyer and current local price before planting for sale.
          </p>
          <div className="inline-flex rounded-full p-0.5 mb-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
            {(['retail', 'wholesale'] as const).map((priceMode) => <button key={priceMode} onClick={() => setValuePriceMode(priceMode)} className="font-sans font-semibold" style={{ fontSize: 11, padding: '4px 10px', borderRadius: 999, border: 'none', cursor: 'pointer', background: valuePriceMode === priceMode ? '#5C5040' : 'transparent', color: valuePriceMode === priceMode ? '#F7F2E9' : '#5C5040' }}>{priceMode === 'retail' ? 'Direct retail' : 'Wholesale'}</button>)}
          </div>
          {plantings.length === 0 ? <div className="font-sans" style={{ fontSize: 12, color: '#8C7A62' }}>Add plantings before building a value scenario.</div> : yieldBenchmark.areaConflictBedLabels.length > 0 ? (
            <div className="font-sans rounded-xl p-3" style={{ fontSize: 12, color: '#A83A2C', lineHeight: 1.45, background: '#FFF6F3', border: '1px solid rgba(168,58,44,0.25)' }}>
              No value subtotal is calculated because {yieldBenchmark.areaConflictBedLabels.join(', ')} {yieldBenchmark.areaConflictBedLabels.length === 1 ? 'has' : 'have'} overlapping or invalid planting shares. Resolve the bed layout first.
            </div>
          ) : (
            <div className="rounded-xl p-3" style={{ background: '#F5F0E8', border: '1px solid #E2D8C4' }}>
              <div className="flex items-center justify-between mb-1"><span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>% sold (rest kept at home)</span><span className="font-mono font-semibold" style={{ fontSize: 12 }}>{cashflowSettings.sellPercent}%</span></div>
              <input aria-label="Percent sold" type="range" min={0} max={100} value={cashflowSettings.sellPercent} onChange={(event) => onCashflowSettingsChange({ ...cashflowSettings, sellPercent: Number(event.target.value), confirmed: false })} style={{ width: '100%', accentColor: '#1F4D2B' }} />
              <div className="flex items-center justify-between mb-1 mt-2"><span className="font-sans" style={{ fontSize: 11.5, color: '#5C5040' }}>% loss or underperformance</span><span className="font-mono font-semibold" style={{ fontSize: 12 }}>{cashflowSettings.lossPercent}%</span></div>
              <input aria-label="Percent loss" type="range" min={0} max={100} value={cashflowSettings.lossPercent} onChange={(event) => onCashflowSettingsChange({ ...cashflowSettings, lossPercent: Number(event.target.value), confirmed: false })} style={{ width: '100%', accentColor: '#B33A3A' }} />
              {/* The 25% starting position and this 10-50% context come from CSIR (2021)
                  9% production + 18.3% post-harvest ≈ 25.6% cumulative, FAO Food Loss Index
                  fruit & veg 25.4%, and Molelekoa et al. (2025) 25.15% measured on 3,115
                  tomatoes across 8 SA smallholder farms — triangulation with shared data
                  ancestry, not three independent lines. */}
              <div className="font-sans mt-1" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.45 }}>
                Typical South African smallholder losses run 10–50%. A home garden eaten within the week is often around 15%; far from a market, or in a first season, 35–50% is common.
              </div>
              <div className="mt-3 pt-3" style={{ borderTop: '1px dashed #E2D8C4' }}>
                <label className="font-sans flex items-center gap-2" style={{ fontSize: 11.5, color: '#5C5040' }}>
                  <span>Household size (optional, context only)</span>
                  <input
                    aria-label="Household size for the eating guideline"
                    type="number" min={1} max={30} inputMode="numeric" placeholder="e.g. 4"
                    value={householdSizeGuideline}
                    onChange={(event) => setHouseholdSizeGuideline(event.target.value)}
                    className="font-mono rounded-lg px-2 py-1"
                    style={{ width: 64, fontSize: 12, border: '1px solid #E2D8C4', background: '#FFFFFF', color: '#20190F' }}
                  />
                </label>
                {(() => {
                  // Display-only guideline: SA food-based dietary guidelines' 240 g of
                  // vegetables per person per day ≈ 88 kg per person per year. It describes
                  // what a household eats from ALL sources (garden, shops, neighbours); it
                  // is not a planting target and never reaches the planner.
                  const n = Math.floor(Number(householdSizeGuideline));
                  const valid = Number.isFinite(n) && n >= 1 && n <= 30;
                  return (
                    <div className="font-sans mt-1" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.45 }}>
                      {valid
                        ? `A household of ${n} typically eats about ${n} × 88 ≈ ${Math.round((n * 88) / 10) * 10} kg of vegetables a year (South African dietary guidelines: 240 g per person per day). A household of 4 ≈ 350 kg. This is an eating guideline covering all food sources — garden and shops together — not a planting target; it does not change your plan.`
                        : 'A household of N typically eats about N × 88 kg of vegetables a year (South African dietary guidelines: 240 g per person per day). A household of 4 ≈ 350 kg. This is an eating guideline covering all food sources, not a planting target — it does not change your plan.'}
                    </div>
                  );
                })()}
              </div>
              {!assumptionsConfirmed ? (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
                  <div className="font-sans mb-2" style={{ fontSize: 12, color: '#9A6018' }}>Not calculated yet: the sliders start at typical placeholders (100% sold, 25% loss), not an estimate for your farm. Review both assumptions first.</div>
                  <button onClick={() => onCashflowSettingsChange({ ...cashflowSettings, confirmed: true })} className="font-display font-semibold rounded-lg px-3 py-2" style={{ fontSize: 12.5, color: '#F7F2E9', background: '#1F4D2B', border: 'none', cursor: 'pointer' }}>Use these assumptions</button>
                </div>
              ) : (
                <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E2D8C4' }}>
                  {yieldBenchmark.growingAreaM2 > 0 && (
                    // Prominent by request (2026-08-22, Rory: "where oh where is my
                    // production score metric!!!! R/m2!"). Cash + home-use value
                    // together, because a garden that's mostly eaten at home is not
                    // less productive — it just cashes out differently. Divided by
                    // the SAME mapped growing area the kg/m² density card above
                    // uses, so the two density figures are directly comparable.
                    <div className="rounded-xl p-3 mb-3" style={{ background: '#1F4D2B' }}>
                      <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#B9CDB4' }}>Production score</div>
                      <div className="font-mono font-bold" style={{ fontSize: 28, color: '#F7F2E9' }}>
                        R{Math.round((cashIncome + homeValue) / yieldBenchmark.growingAreaM2).toLocaleString()}
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#B9CDB4' }}> /m² this plan cycle</span>
                      </div>
                      <div className="font-sans mt-1" style={{ fontSize: 11, color: '#B9CDB4', lineHeight: 1.4 }}>
                        {/* 2026-08-22, Rory: "so thats the value regardless if selling or
                            consumption and its wholesale or retail" — the one-line caption
                            said "cash + home-use value" without saying what mix of selling
                            vs. eating that blends, or which price basis the sold half uses.
                            Spell out both: it is BOTH scenarios blended by the sliders above
                            (not "regardless of" them — the split is exactly what you set),
                            and the two halves are priced differently on purpose (sold produce
                            at whichever channel is picked above; produce you eat is always
                            valued at retail, since that is the cost it replaces). */}
                        Blends both: {cashflowSettings.sellPercent}% of the harvest sold at {valuePriceMode === 'retail' ? 'direct retail' : 'wholesale'} prices, the rest ({100 - cashflowSettings.sellPercent}%) valued at what it would have cost to buy at retail instead of growing it — divided by {yieldBenchmark.growingAreaM2.toFixed(1)} m² of mapped growing area. A density figure for comparing plans or layouts, not a profit guarantee.
                      </div>
                      {/* 2026-08-22, Rory: "should we give a veg beds figure and a
                          staple crops figure seperately? that would be more heloful
                          i think" — the blend hides that beds and staple plots are
                          different economic animals: maize/dry-bean ground reads at
                          field-crop value per m² by NATURE, and averaging it into
                          the veg beds makes both halves unreadable. Shown only when
                          the plan actually has both kinds of ground — a beds-only
                          plan's split would just restate the headline. Same
                          scenarioValues() formula and the benchmark's own partition
                          fields, so the two sub-figures can never disagree with the
                          blend they sit under. */}
                      {yieldBenchmark.bedAreaM2 > 0 && yieldBenchmark.plotAreaM2 > 0 && (() => {
                        const bedsSplit = scenarioValues(yieldBenchmark.byCropBeds);
                        const plotsSplit = scenarioValues(yieldBenchmark.byCropPlots);
                        const rows: [string, { cash: number; home: number }, number][] = [
                          ['Veg beds', bedsSplit, yieldBenchmark.bedAreaM2],
                          ['Staple plots', plotsSplit, yieldBenchmark.plotAreaM2],
                        ];
                        return (
                          <div className="mt-2 pt-2" style={{ borderTop: '1px dashed rgba(185,205,180,0.4)' }}>
                            {rows.map(([label, split, areaM2]) => (
                              <div key={label} className="flex items-baseline justify-between" style={{ gap: 8 }}>
                                <span className="font-sans" style={{ fontSize: 11, color: '#B9CDB4' }}>{label} · {areaM2.toFixed(1).replace(/\.0$/, '')} m²</span>
                                <span className="font-mono font-semibold" style={{ fontSize: 14, color: '#F7F2E9' }}>
                                  R{Math.round((split.cash + split.home) / areaM2).toLocaleString()}<span style={{ fontSize: 10.5, fontWeight: 500, color: '#B9CDB4' }}> /m²</span>
                                </span>
                              </div>
                            ))}
                            <div className="font-sans mt-1" style={{ fontSize: 10.5, color: '#B9CDB4', lineHeight: 1.4 }}>
                              Same sliders and prices as the blended figure. Staple ground reads low per m² by nature — maize, beans and potatoes are cheap per kilogram but store and feed the household through the year — so compare beds with beds and plots with plots, not one against the other.
                            </div>
                          </div>
                        );
                      })()}
                      {/* 2026-08-22, Rory: "can you also add what is typical forr
                          farmers market gardeners small scale farmers with limited
                          irrigation and maybe add what will reduce prodiction value
                          sucha badd irrigation etc etc". The bands below are NOT a
                          published statistic — nobody publishes smallholder value
                          in R/m² — they are derived: SA home-garden productivity
                          averages ~1.8 kg/m²/yr (≈18 t/ha across cabbage, chard,
                          beans, tomato, potato — Khumalo et al. 2021, S.Afr.J.Sci
                          home-gardening/food-insecurity study), intensive
                          market-garden beds reach 3–6 kg/m²/yr, dryland maize runs
                          0.1–0.5 kg/m² smallholder — each valued at the same
                          typical mixed retail R20–35/kg era as the price snapshot
                          this card already uses. That derivation MUST stay stated
                          in the on-screen caveat below; bands presented as a
                          published benchmark would be invented authority (see
                          docs/CROP-PLAN-TRUTH-AUDIT-2026-08-06.md's ban on
                          invented precision — the page-ux test pins the caveat to
                          this block). */}
                      <div className="mt-2 pt-2" style={{ borderTop: '1px dashed rgba(185,205,180,0.4)' }}>
                        <button onClick={() => setShowComparison((open) => !open)} className="font-sans underline" style={{ fontSize: 11, color: '#B9CDB4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          {showComparison ? 'Hide the comparison' : 'How does this compare to other growers?'}
                        </button>
                        {showComparison && (
                          <div className="mt-2">
                            {([
                              ['Dryland staple plot — maize, dry beans, pumpkin, no irrigation', 'R2–10'],
                              ['Home garden, limited watering', 'R10–30'],
                              ['Community or school garden, reliable basic irrigation', 'R30–60'],
                              ['Intensive market-garden beds — drip, tight succession', 'R60–150+'],
                            ] as [string, string][]).map(([label, band]) => (
                              <div key={label} className="flex items-baseline justify-between" style={{ gap: 8, marginBottom: 2 }}>
                                <span className="font-sans" style={{ fontSize: 10.5, color: '#B9CDB4', lineHeight: 1.35 }}>{label}</span>
                                <span className="font-mono" style={{ fontSize: 11.5, color: '#F7F2E9', whiteSpace: 'nowrap' }}>{band} /m²</span>
                              </div>
                            ))}
                            <div className="font-sans mt-1.5" style={{ fontSize: 10, color: '#B9CDB4', lineHeight: 1.4, fontStyle: 'italic' }}>
                              Rough bands, not a published statistic: derived from published South African yields valued at typical retail prices from the same era as this card&apos;s price snapshot. Orientation only — not targets, and not promises.
                            </div>
                            <div className="font-sans uppercase tracking-widest mt-2.5" style={{ fontSize: 9.5, color: '#B9CDB4' }}>What pulls the figure down</div>
                            <ul className="font-sans mt-1" style={{ fontSize: 10.5, color: '#B9CDB4', lineHeight: 1.5, paddingLeft: 16, margin: '4px 0 0' }}>
                              <li>Water that fails in the dry months — the single biggest driver here; one missed month can cost the whole crop cycle, which is the gap between the two irrigated bands above and the two that are not.</li>
                              <li>Ground standing bare between crops — the Field utilization tab above shows exactly which months yours stands empty.</li>
                              <li>Harvest lost or unsold — that is the % loss slider above, already in this figure.</li>
                              <li>A crop mix weighted to low price-per-kg crops. That can still be the right choice — staples store and feed the household — which is why the beds and plots figures are shown separately.</li>
                              <li>Patchy stands: poor germination never re-sown, or spacing wider than the packet calls for, quietly harvests a fraction of the bed you prepared.</li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62' }}>Known benchmark subtotal for this plan cycle</div>
                  <div className="font-mono font-bold" style={{ fontSize: 20, color: '#1F4D2B' }}>R{Math.round(cashIncome).toLocaleString()} <span style={{ fontSize: 12, fontWeight: 500, color: '#8C7A62' }}>cash scenario</span></div>
                  <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', lineHeight: 1.35 }}>{cashflowSettings.sellPercent}% of harvest sold, priced at {valuePriceMode === 'retail' ? 'direct retail' : 'wholesale'} rates (change the price toggle above to switch).</div>
                  {homeValue > 0.5 && (
                    <>
                      <div className="font-mono mt-1.5" style={{ fontSize: 13, color: '#5C5040' }}>+ R{Math.round(homeValue).toLocaleString()} <span style={{ fontSize: 11.5, color: '#8C7A62' }}>home-use replacement-value scenario</span></div>
                      <div className="font-sans" style={{ fontSize: 10.5, color: '#8C7A62', lineHeight: 1.35 }}>The {100 - cashflowSettings.sellPercent}% kept at home — always valued at retail, whichever price toggle is selected above, because retail is the price you'd otherwise pay to replace it.</div>
                    </>
                  )}
                </div>
              )}
              {(yieldBenchmark.unknownYieldCrops.length > 0 || unpricedBenchmarkCrops.length > 0) && <div className="font-sans mt-2" style={{ fontSize: 11, color: '#9A6018', lineHeight: 1.4 }}>Subtotal excludes {[...new Set([...yieldBenchmark.unknownYieldCrops, ...unpricedBenchmarkCrops])].join(', ')} because a verified yield or usable per-kg price is missing.</div>}
            </div>
          )}
          {pricedCropKeys.length > 0 && (
            <div className="mt-3" style={{ borderTop: '1px solid #E2D8C4', paddingTop: 8 }}>
              <button onClick={() => setEditingPrices((open) => !open)} className="font-sans underline" style={{ fontSize: 11.5, color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer' }}>{editingPrices ? 'Hide price assumptions' : '✏️ Review and edit price assumptions'}</button>
              {editingPrices && <div className="mt-2 space-y-2">{pricedCropKeys.map((cropKey) => {
                const crop = cropByKey(cropKey);
                const price = priceFor(cropKey, priceOverrides);
                if (!crop || !price) return null;
                return <div key={cropKey} className="font-sans rounded-lg p-2" style={{ fontSize: 12, color: '#5C5040', background: '#FFFFFF', border: '1px solid #E2D8C4' }}>
                  <div className="flex items-center justify-between mb-1"><span><CropIcon cropKey={crop.key} icon={crop.icon} size={14} /> {crop.name}</span><span style={{ fontSize: 10, color: price.confidence === 'sourced' ? '#1F4D2B' : '#9A6018' }}>{price.confidence === 'sourced' ? 'dated source snapshot' : 'rough estimate'}</span></div>
                  <div className="flex flex-wrap gap-2">
                    <label>Retail R <input type="number" min="0.01" step="0.01" value={price.retailPerKg} onChange={(event) => onPriceOverrideChange(cropKey, { ...price, retailPerKg: Number(event.target.value), confidence: 'estimated' })} style={{ width: 62, padding: '2px 4px', border: '1px solid #E2D8C4', borderRadius: 4 }} /> /kg</label>
                    <label>Wholesale R <input type="number" min="0.01" step="0.01" value={price.wholesalePerKg} onChange={(event) => onPriceOverrideChange(cropKey, { ...price, wholesalePerKg: Number(event.target.value), confidence: 'estimated' })} style={{ width: 62, padding: '2px 4px', border: '1px solid #E2D8C4', borderRadius: 4 }} /> /kg</label>
                  </div>
                </div>;
              })}</div>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * A reference card that opens when the farmer wants it. Same collapsed-by-
 * default behaviour as the Feeding/Protecting sections below, applied to the
 * two long reference cards that were permanently expanded: on a phone they put
 * ten-odd sentences of caveat between the plan and the rest of the page. The
 * always-visible summary line says what is inside, so nothing is hidden — no
 * text is removed, it is one tap away.
 */
function DisclosureCard({ title, summary, children }: {
  title: string;
  summary: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-2 text-left"
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
      >
        <span>
          <span className="font-display font-semibold block" style={{ fontSize: 15, color: '#20190F' }}>{title}</span>
          <span className="font-sans block mt-0.5" style={{ fontSize: 11.5, color: '#8C7A62', lineHeight: 1.4 }}>{summary}</span>
        </span>
        <span style={{ fontSize: 14, color: '#5C5040' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

function RotationExplanationCard() {
  return (
    <DisclosureCard
      title="🔄 Rotate by botanical family"
      summary="Which crops count as relatives, and why that is not the same as a food group."
    >
      <p className="font-sans mb-3" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
        Food groups describe what a household eats; rotation follows plant relatives that share pests and
        diseases. With &quot;Rotate crops&quot; on, Auto-suggest avoids an immediate repeat of the same family — for
        example potato after tomato, or beetroot after Swiss chard. It does not prescribe a universal sequence.
        The ARC crop-rotation manual treats rotation as a multi-season decision, so keep earlier-season records too.{' '}
        <a href="https://www.arc.agric.za/arc-iscw/CSA-Toolbox/Climate%20Smart%20Production%20Types/Manual/Microsoft%20Word%20-%20CA%20Crop%20rotation%20Manual.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>Read the ARC manual</a>.
      </p>
      <div className="font-sans" style={{ fontSize: 12, color: '#5C5040', lineHeight: 1.55 }}>
        {Object.entries(ROTATION_FAMILY_META).map(([family, meta]) => {
          const names = CROPS.filter((crop) => rotationFamilyOf(crop) === family).map((crop) => crop.name).join(', ');
          return <div key={family}><strong style={{ color: '#20190F' }}>{meta.label}:</strong> {names}</div>;
        })}
      </div>
    </DisclosureCard>
  );
}

/** Read-only safety boundaries for inputs and crop protection. The previous
 * card printed generic product rates and efficacy/safety claims without a
 * current registered label for the farmer's exact crop and problem. */
function OrganicGuideCard() {
  const [openSection, setOpenSection] = useState<'feed' | 'protect' | null>(null);
  return (
    <div className="rounded-2xl p-4 mt-4" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="font-display font-semibold mb-1" style={{ fontSize: 15, color: '#20190F' }}>🌿 Growing organically</div>
      <p className="font-sans mb-2" style={{ fontSize: 12, color: '#8C7A62', lineHeight: 1.5 }}>
        This plan does not prescribe a fertiliser or pesticide programme. Soil condition, the diagnosed problem,
        the exact crop and the current South African label all matter; ask a local extension officer or qualified adviser where possible.
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
            <strong>Check before adding:</strong> look at drainage, soil condition and prior amendments. Use a soil or compost analysis where accessible and local advice before deciding whether an amendment is needed. The app does not turn a generic crop name into a compost, manure, lime or fertiliser rate.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Legumes can support a following crop:</strong> dry beans, green beans, peas, broad beans and groundnuts are useful rotation crops. This planner avoids immediate family repeats; it does not calculate a fertiliser credit.
          </p>
          <p className="font-sans" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5 }}>
            If you use a commercial input, check the current product label and your certifier&apos;s current rules. “Organic” does not establish a safe dose or prove that a product suits this soil.
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
            <strong>Observe and record:</strong> note the affected crop, symptoms, which part of the plant is damaged and how the problem changes. Confirm the pest, disease or nutrient problem before treating it; similar symptoms can need different responses.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
            <strong>Use the least hazardous suitable response:</strong> after a sound diagnosis, consider appropriate sanitation, barriers, removal or other non-chemical controls. This app does not claim that a named companion plant controls a pest.
          </p>
          <p className="font-sans" style={{ fontSize: 12.5, color: '#20190F', lineHeight: 1.5 }}>
            <strong>If an agricultural remedy is needed in South Africa:</strong> use only a product currently registered for the exact crop and problem. Follow its current label for dose, protective equipment, re-entry, pre-harvest interval, storage and disposal. Never infer safety from “natural” or “organic.”
          </p>
          <p className="font-sans" style={{ fontSize: 11, color: '#9A8268', lineHeight: 1.5 }}>
            Check the Department of Agriculture&apos;s{' '}
            <a href="https://www.nda.gov.za/index.php/publication/616-registered-products" target="_blank" rel="noopener noreferrer" style={{ color: '#1F4D2B', textDecoration: 'underline' }}>current registered-products lists</a>{' '}
            and the label on the product in hand. Nothing in this crop plan automatically schedules a spray.
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
              title="A staple plot from your Design Studio map — one field crop at full area; multi-year rotation needs dated records"
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
                background: i === 0 ? 'rgba(31,77,43,0.05)' : i >= 12 ? 'rgba(196,164,106,0.07)' : 'transparent',
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
  const readinessStart = bedEntryMonth(planting.sowMonth, crop);
  // `entry` stays the PLANNED working transplant month for the tooltip copy;
  // the BAR geometry starts at the reservation edge (readinessStart), the
  // same edge plantingBedEntryOffsets and occupiedMonthsForPlanting use —
  // mixing the two edges drew the bar one month late and released it one
  // month past the true bed hold for tray crops.
  const entry = plannedBedEntryMonth(planting.sowMonth, crop);
  const holdStart = readinessStart;
  const harvest = crop.timingVerified === false
    ? entry
    : harvestMonthForCrop(planting.sowMonth, crop);
  // Harvest isn't always a single-month instant — cut-and-come-again crops
  // (harvestWindowMonths) go on yielding for several more months after the
  // first picking, and the bar should show the WHOLE window you can pick
  // from, not just claim "ready" for one month then vanish while the plant
  // is still actively producing. storageMonths crops (one-shot harvest,
  // kept afterward) are deliberately NOT extended here — that's a
  // fresh-in-the-BED question, not a stored-on-the-shelf one; see the Food
  // availability chart for the storage story.
  const harvestEnd = crop.timingVerified === false
    ? entry
    : harvestEndMonthForCrop(planting.sowMonth, crop);
  const latestEntry = latestBedEntryMonth(planting.sowMonth, crop);
  // Resolve the recorded SOW occurrence first, then add the nursery offset.
  // Resolving January field-entry independently from a December sowing moves
  // an existing tray cohort back a year. Planned rows repeat annually for the
  // second-year preview; observed existing rows have exactly one occurrence.
  const entryOffsets = plantingBedEntryOffsets(planting, currentMonth, DISPLAY_MONTHS);
  const instances = barInstances(entryOffsets, holdStart, harvestEnd);
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
  const greenSpan = ((harvest - holdStart) % 12 + 12) % 12;
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
  const finishLabel = crop.timingVerified === false
    ? 'termination timing not verified'
    : crop.yieldKgPerM2 === 0 ? `cut or roll down ${harvestLabel}` : `harvest ${harvestLabel}`;

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
          title={`${crop.name} — sow ${monthLabel(planting.sowMonth)}, ${finishLabel} · ${fLabel} bed${planting.inNursery ? ' · trays sown, not yet planted out' : planting.existing ? ' · already growing' : ''}${isYearTwo(seg) ? ' · year two, the same cycle coming round again' : ''}`}
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
            <CropIcon cropKey={crop.key} icon={crop.icon} size={14} /> {crop.name}{fLabel ? ` (${fLabel})` : ''}
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
      {crop.transplant && (!planting.existing || planting.inNursery) && instances.map((seg, i) => {
        // Anchored to THIS copy's own unclipped sow offset (not re-derived
        // independently, and not shared across copies) so it always lands
        // right after that copy's sow month and never contradicts the bar
        // it belongs to.
        const trOffset = seg.rawStart;
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
            title={`Plan to transplant ${crop.name.toLowerCase()} in ${monthLabel(entry)}. Start checking seedlings in ${monthLabel(readinessStart)}; if they are still not ready by ${monthLabel(latestEntry)}, update the plan instead of treating the bed as occupied.`}
            aria-label={`Plan to transplant ${crop.name} in ${monthLabel(entry)}`}
          >
            🪴 check / transplant
          </button>
        );
      })}
    </div>
  );
}

// ── Crop picker modal ────────────────────────────────────────────────────

function CropPickerModal({
  search, onSearch, crop, month, pattern, fraction, onFraction, existing, onExisting, overlapWarning, hasUnverifiedTiming,
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
  /** Null when the bed can carry this planting alongside what is already there. */
  overlapWarning: BedOverlapWarning | null;
  hasUnverifiedTiming: boolean;
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
    // A crop with no verified duration cannot truthfully be placed onto this
    // month-by-month schedule. Keep it in the catalog for legacy records, but
    // do not offer it as a new manual planting.
    .filter((c) => c.timingVerified !== false)
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
          <span className="font-display font-semibold" style={{ fontSize: 16, color: '#20190F', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            {crop ? (<><CropIcon cropKey={crop.key} icon={crop.icon} size={16} /> {crop.name}</>) : 'Add a crop'}
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
            <p className="font-sans mb-2" style={{ fontSize: 11, color: '#8C7A62', lineHeight: 1.4 }}>
              Twelve dots = Jan to Dec. Green marks the months you can sow that crop in this site's rainfall pattern.
            </p>
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
                      <CropIcon cropKey={c.key} icon={c.icon} size={20} />
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
              {sowingInstruction(crop)}
              {crop.timingVerified === false
                ? ' · exact sow-to-finish timing is not verified'
                : ` · ${cropDurationLabel(crop)} ${crop.yieldKgPerM2 === 0 ? 'to flowering, then cut or roll down' : crop.transplant ? 'from transplant to harvest' : 'from sowing to harvest'}`}<br />
              {pickingPeriodLabel(crop) && <>Usual picking period: {pickingPeriodLabel(crop)}; the plan keeps the bed occupied through the upper end unless you finish it earlier.<br /></>}
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
            {crop.timingVerified === false && (
              <div className="font-sans mb-3 px-2.5 py-2 rounded-lg" style={{ fontSize: 12, background: 'rgba(192,122,30,0.08)', border: '1px solid rgba(192,122,30,0.25)', color: '#9A6018' }}>
                This legacy record can be kept or removed, but it cannot be rescheduled until a source-backed local duration is available.
              </div>
            )}
            {crop.timingVerified === false ? (
              <div className="font-sans mb-3" style={{ fontSize: 12, color: '#5C5040' }}>
                Recorded sowing: <strong style={{ color: '#20190F' }}>{monthLabel(month)}</strong> · finish timing: <strong style={{ color: '#20190F' }}>confirm locally</strong>
              </div>
            ) : (
              <>
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
                  {crop.transplant ? 'Conservative harvest window' : 'Harvest window'}: <strong style={{ color: '#20190F' }}>
                    {(() => {
                      const start = harvestMonthForCrop(month, crop);
                      const end = harvestEndMonthForCrop(month, crop);
                      return start === end ? monthLabel(start) : `${monthLabel(start)}–${monthLabel(end)}`;
                    })()}
                  </strong>
                  {crop.transplant && <> · check/transplant when ready <strong style={{ color: '#20190F' }}>{monthLabel(bedEntryMonth(month, crop))}–{monthLabel(latestBedEntryMonth(month, crop))}</strong></>}
                </div>
              </>
            )}
            {crop.transplant && (
              <div className="font-sans mb-2" style={{ fontSize: 11, color: '#8C7A62' }}>{TRANSPLANT_NURSERY_GUIDANCE}</div>
            )}
            {crop.timingVerified !== false && !crop.sowMonths[pattern].includes(month) && (
              <div className="font-sans mb-3" style={{ fontSize: 11, color: '#9A6018' }}>⚠ Outside the usual sowing window for this region — still allowed.</div>
            )}

            <div className="font-sans uppercase tracking-widest mb-1.5 mt-2" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>{isPlot ? 'How much of the plot?' : 'How much of the bed?'}</div>
            {isPlot ? (
              <div className="font-sans mb-2 px-2.5 py-2 rounded-lg" style={{ fontSize: 11.5, color: '#5C5040', background: '#FBF6EC', border: '1px solid #E0CD9E' }}>
                🌽 The whole plot — a staple plot grows one field crop at a time and rotates to a
                different botanical family in a later rotation, so there are no half-shares here.
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

            {/* Outside the fraction branch on purpose: the DEFAULT add is a whole
                bed, which shows no fraction picker, and used to get no capacity
                feedback at all. Plain words first, arithmetic in brackets after —
                this screen is read by farmers, not by a spreadsheet. */}
            {overlapWarning && crop && (
              <div className="font-sans mb-2" style={{ fontSize: 11.5, color: '#9A6018', lineHeight: 1.45 }}>
                {/* A staple plot reaches this too — "+ crop" is unconditional on
                    every row, and two whole-plot crops in the same months is
                    exactly the double-booking a plot most needs told about. So
                    it gets its own wording rather than being called a bed four
                    lines under "there are no half-shares here", and no
                    percentage: on a plot the answer is never a share. */}
                ⚠ This {isPlot ? 'plot' : 'bed'} is already carrying {listNames(overlapWarning.clashes.map((clash) => (
                  clash.months.length > 0 ? `${clash.cropName} in ${monthSpanLabel(clash.months)}` : clash.cropName
                )))}
                {' — '}adding {crop.name}{isPlot ? '' : fraction >= 1 ? ' to the whole bed' : ' on top of that'} means
                they compete for the same ground{isPlot ? ', and a staple plot grows one field crop at a time' : ''}. Still allowed.
                {isPlot ? null : (
                  <>
                    {' '}
                    <span style={{ color: '#8C7A62' }}>
                      (Together they need {Math.round(overlapWarning.totalFraction * 100)}% of the bed.)
                    </span>
                  </>
                )}
              </div>
            )}

            {hasUnverifiedTiming && (
              <div className="font-sans mb-2" style={{ fontSize: 11, color: '#9A6018' }}>
                {/* "the space check above" is only a real reference when the
                    overlap warning actually rendered — with no overlap it
                    pointed at nothing on screen. */}
                ⚠ This {isPlot ? 'plot' : 'bed'} has a legacy crop whose finish timing is not verified.{' '}
                {overlapWarning
                  ? 'It is left out of the space check above; check that the ground is actually free before adding another crop.'
                  : 'The app cannot tell whether it still holds this ground, so check that the ground is actually free before adding another crop.'}
              </div>
            )}

            <label className="flex items-center gap-2 font-sans mb-3 cursor-pointer" style={{ fontSize: 13, color: '#5C5040' }}>
              <input type="checkbox" checked={existing} onChange={(e) => onExisting(e.target.checked)} style={{ accentColor: '#1F4D2B' }} />
              This is already growing (not a new planting)
            </label>

            <button
              onClick={onConfirm}
              disabled={crop.timingVerified === false}
              className="w-full font-display font-semibold rounded-xl py-2.5 mt-1"
              style={{ fontSize: 14, background: crop.timingVerified === false ? '#D8D3C9' : '#1F4D2B', color: crop.timingVerified === false ? '#81796D' : '#F7F2E9', border: 'none', cursor: crop.timingVerified === false ? 'not-allowed' : 'pointer' }}
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

function PlantingPopover({ planting, bedAreaM2, allPlantings, onEdit, onRemove, onClose }: {
  planting: Planting;
  bedAreaM2: number;
  allPlantings: Planting[];
  onEdit: () => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  // Removal stays deliberately separate from choosing a crop. The accepted
  // plan does not persist the farmer's original whitelist, so this screen
  // cannot safely infer which alternative food they would actually choose.
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const crop = cropByKey(planting.cropKey);
  if (!crop) return null;
  const harvest = harvestMonthForCrop(planting.sowMonth, crop);
  const harvestEnd = harvestEndMonthForCrop(planting.sowMonth, crop);
  const harvestLabel = crop.harvestWindowMonths ? `${monthLabel(harvest)}-${monthLabel(harvestEnd)}` : monthLabel(harvest);
  const isCoverCrop = crop.yieldKgPerM2 === 0;
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
            <CropIcon cropKey={crop.key} icon={crop.icon} size={15} /> {crop.name} <SeedBadge transplant={!!crop.transplant} />
          </span>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8C7A62' }}>
            <X size={16} />
          </button>
        </div>
        <div className="inline-block font-sans font-semibold mb-2 px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(63,122,60,0.12)', color: '#1F4D2B' }}>
          {fractionLabel(planting.areaFraction ?? 1)} bed{genuinelyIntercropped ? ' — intercropped' : ''}
        </div>
        {genuinelyIntercropped && (
          <p className="font-sans mb-2" style={{ fontSize: 11, color: '#9A8268' }}>
            Sharing this bed with another crop at the same time. The kilogram comparison uses each crop&apos;s allocated area only; no generic intercropping bonus or penalty is invented.
          </p>
        )}
        {planting.existing && (
          <div className="inline-block font-sans font-semibold mb-2 ml-1 px-2 py-0.5 rounded-full" style={{ fontSize: 11, background: 'rgba(140,134,84,0.18)', color: '#5C5040' }}>
            {planting.inNursery ? 'Trays sown — not yet planted out' : 'Already growing'}
          </div>
        )}
        <div className="font-sans space-y-1 mb-3" style={{ fontSize: 12.5, color: '#5C5040', lineHeight: 1.5 }}>
          <div>{crop.timingVerified === false
            ? `Recorded sowing: ${monthLabel(planting.sowMonth)} · finish timing not verified`
            : `Sow ${monthLabel(planting.sowMonth)} → ${isCoverCrop ? 'cut or roll down' : 'harvest'} ${harvestLabel}`}</div>
          <div>{sowingInstruction(crop)}{crop.timingVerified === false ? '' : ` · ${cropDurationLabel(crop)} ${crop.transplant ? 'after transplant' : 'from sowing'} ${isCoverCrop ? 'to flowering' : 'to first harvest'}`}</div>
          {pickingPeriodLabel(crop) && <div>Usual picking period: {pickingPeriodLabel(crop)} · bed reserved through the upper end unless you finish it earlier</div>}
          {crop.transplant && <div>Field-readiness window: {monthLabel(bedEntryMonth(planting.sowMonth, crop))}–{monthLabel(latestBedEntryMonth(planting.sowMonth, crop))}; transplant when ready.</div>}
          {crop.transplant && <div>{TRANSPLANT_NURSERY_GUIDANCE}</div>}
          <CropStorageLine crop={crop} />
          <div>{crop.note}</div>
        </div>
        <div className="font-mono font-bold mb-3" style={{ fontSize: 18, color: '#1F4D2B' }}>
          {hasPlanningYield(crop)
            ? `≈ ${yieldKg.toFixed(1)} kg benchmark`
            : crop.yieldKgPerM2 === 0
              ? 'Soil cover crop · no food yield'
              : 'Yield benchmark not verified'}
        </div>
        {confirmingRemove ? (
          <div className="space-y-2">
            <div className="font-sans" style={{ fontSize: 12.5, color: '#5C5040' }}>
              Remove {crop.name}? To choose another crop yourself, cancel and use Edit.
            </div>
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
                Remove crop
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
  { key: 'commercial', label: 'Grow crops to sell', blurb: 'Concentrate chosen sale crops in a few beds' },
  { key: 'hybrid', label: 'Household and sales', blurb: 'Set aside sale beds and use the rest for household crops' },
];
const RHYTHM_OPTIONS: { key: HarvestRhythm; label: string; blurb: string }[] = [
  { key: 'steady', label: 'More regular harvests', blurb: 'Prefer staggered opportunities' },
  { key: 'few-big', label: 'A few big harvests', blurb: 'One flush at a time is fine' },
];
// Labels live in lib (IDEAL_PLAN_COPY), not here — the voice lint and the
// truth gates read the lib, and a sentence hardcoded in a component is a
// sentence no test reads.
const TIMING_OPTIONS: { key: PlanTiming; label: string; blurb: string }[] = [
  { key: 'fromNow', label: IDEAL_PLAN_COPY.fromNowLabel, blurb: IDEAL_PLAN_COPY.fromNowBlurb },
  { key: 'idealYear', label: IDEAL_PLAN_COPY.idealLabel, blurb: IDEAL_PLAN_COPY.idealBlurb },
];
function AutoSuggestModal({
  phase, goal, onGoal, focusCount, onFocusCount,
  groups, onToggleGroup, cropKeys, onToggleCrop, onSetCrops, rhythm, onRhythm,
  planTiming, onPlanTiming, generating, idealMeta, hasCurrentPlantings,
  pattern, climateSource, referenceName, rotateCrops, onRotateCrops,
  allowVinesInBeds, onAllowVinesInBeds, allowMixedCropsInBed, onAllowMixedCropsInBed, reliableIrrigation, onReliableIrrigation,
  siteClimate, result, onGenerate, onAccept, onBackToQuestions, onClose,
}: {
  phase: 'questions' | 'review';
  goal: GardenGoal; onGoal: (g: GardenGoal) => void;
  focusCount: number; onFocusCount: (n: number) => void;
  groups: FoodGroup[]; onToggleGroup: (g: FoodGroup) => void;
  cropKeys: string[]; onToggleCrop: (cropKey: string) => void; onSetCrops: (cropKeys: string[]) => void;
  rhythm: HarvestRhythm; onRhythm: (r: HarvestRhythm) => void;
  planTiming: PlanTiming; onPlanTiming: (t: PlanTiming) => void;
  /** True while the whole-year sweep runs — the Suggest button shows its busy label. */
  generating: boolean;
  /** Whole-year review metadata; null in from-now mode (review stays pixel-identical to before). */
  idealMeta: IdealYearPlan | null;
  hasCurrentPlantings: boolean;
  pattern: RainPattern;
  /** Where the pattern came from: the site's own satellite climate, the nearest reference region, or no site at all. */
  climateSource: 'site' | 'reference' | 'none';
  /** Reference-region name when climateSource is 'reference'. */
  referenceName: string | null;
  rotateCrops: boolean; onRotateCrops: (v: boolean) => void;
  allowVinesInBeds: boolean; onAllowVinesInBeds: (v: boolean) => void;
  allowMixedCropsInBed: boolean; onAllowMixedCropsInBed: (v: boolean) => void;
  reliableIrrigation: boolean; onReliableIrrigation: (v: boolean) => void;
  /** The site's own monthly climate, when it resolved. Null keeps the irrigation
   * question generic rather than quoting a reference region's rain as this site's. */
  siteClimate: SiteClimate | null;
  result: AutoSuggestResult | null;
  onGenerate: () => void; onAccept: () => void; onBackToQuestions: () => void; onClose: () => void;
}) {
  const [cropSearch, setCropSearch] = useState('');
  const tileStyle = (active: boolean): CSSProperties => ({
    background: active ? '#1F4D2B' : '#FFFFFF', color: active ? '#F7F2E9' : '#5C5040',
    border: `1px solid ${active ? '#1F4D2B' : '#E2D8C4'}`, cursor: 'pointer',
  });
  const cropChoices = CROPS
    .filter((crop) => groups.length === 0 || groups.includes(foodGroupOf(crop)))
    .filter((crop) => crop.name.toLowerCase().includes(cropSearch.trim().toLowerCase()));

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

            <details className="rounded-xl px-3 py-2.5" style={{ border: '1px solid #E2D8C4', background: '#FFFEFA' }}>
              <summary className="font-display font-semibold" style={{ fontSize: 12.5, color: '#1F4D2B', cursor: 'pointer' }}>
                Optional: change the recommended crop mix
              </summary>
              <div className="mt-3 space-y-3">
            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>
                Filter crop types (optional)
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
                  ? 'No type filter: the crop list below shows every crop. Crops without enough local evidence stay selectable for manual review but are not auto-scheduled.'
                  : `${groups.length} of ${ALL_GROUPS.length} selected.`}
              </p>
            </div>

            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>
                Only use these exact crops (optional)
              </div>
              <input
                value={cropSearch}
                onChange={(event) => setCropSearch(event.target.value)}
                placeholder="Search crops, e.g. maize or tomatoes"
                className="w-full font-sans rounded-lg px-2.5 py-2"
                style={{ fontSize: 12.5, color: '#5C5040', background: '#FFFFFF', border: '1px solid #E2D8C4' }}
              />
              <div className="flex gap-2 my-2">
                <button type="button" onClick={() => onSetCrops([...new Set([...cropKeys, ...cropChoices.map((crop) => crop.key)])])} className="font-sans rounded-lg px-2 py-1" style={{ fontSize: 11, border: '1px solid #B9C9B9', color: '#1F4D2B', background: '#F5F8F3' }}>Select all shown</button>
                <button type="button" onClick={() => onSetCrops([])} className="font-sans rounded-lg px-2 py-1" style={{ fontSize: 11, border: '1px solid #E2D8C4', color: '#5C5040', background: '#FFFFFF' }}>Clear</button>
              </div>
              <div className="rounded-lg" style={{ maxHeight: 220, overflowY: 'auto', border: '1px solid #E2D8C4', background: '#FFFFFF' }}>
                {cropChoices.map((crop) => {
                  const schedulable = hasVerifiedSchedule(crop);
                  const hasYieldBenchmark = hasAutomaticPlanningBasis(crop);
                  return (
                    <label key={crop.key} className="flex items-center gap-2 px-2.5 py-2 font-sans" style={{ fontSize: 12, borderBottom: '1px solid #F0E9DC', cursor: 'pointer' }}>
                      <input type="checkbox" checked={cropKeys.includes(crop.key)} onChange={() => onToggleCrop(crop.key)} />
                      <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}><CropIcon cropKey={crop.key} icon={crop.icon} size={14} /> {crop.name}</span>
                      {schedulable && !hasYieldBenchmark && <span style={{ fontSize: 9.5, color: '#9A6018' }}>no yield estimate</span>}
                      {!schedulable && <span style={{ fontSize: 9.5, color: '#9A6018' }}>selected for manual review</span>}
                    </label>
                  );
                })}
              </div>
              <p className="font-mono mt-1.5" style={{ fontSize: 10.5, color: '#9A6018', lineHeight: 1.4 }}>
                Every crop can be ticked. Crops with verified field timing and establishment can be scheduled; a crop still missing those facts remains selected for manual review and is not silently replaced. “No yield estimate” leaves kilograms and value blank rather than guessing.
              </p>
              {cropKeys.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {cropKeys.map((key) => {
                    const crop = cropByKey(key);
                    if (!crop) return null;
                    return (
                      <button key={key} onClick={() => onToggleCrop(key)} className="font-sans rounded-full px-2 py-1" style={{ fontSize: 11, color: '#1F4D2B', background: 'rgba(31,77,43,0.09)', border: '1px solid rgba(31,77,43,0.22)', cursor: 'pointer' }}>
                        <CropIcon cropKey={crop.key} icon={crop.icon} size={12} /> {crop.name} ×
                      </button>
                    );
                  })}
                </div>
              )}
              <p className="font-mono mt-1.5" style={{ fontSize: 10.5, color: '#9A8268' }}>
                {cropKeys.length
                  ? (goal === 'commercial'
                    ? 'Only these crops will be used. Commercial mode compares conservative fresh-weight kg/m² per crop cycle where a supported sowing slot fits; it is not profit, nutrition, buyer demand or proof of a global annual maximum.'
                    : 'Only these crops will be used. The planner balances supported sowing slots, variety and your harvest rhythm; it will not substitute an unchosen crop or claim a guaranteed maximum.')
                  : 'No exact list selected: the family plan will use a diverse supported mix, including the mapped staple plots. Open this section only when you want to exclude crops or name exact household choices.'}
              </p>
              </div>
              </div>
            </details>

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

            <div>
              <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>{IDEAL_PLAN_COPY.timingHeading}</div>
              <div className="grid grid-cols-2 gap-1.5">
                {TIMING_OPTIONS.map((o) => (
                  <button key={o.key} onClick={() => onPlanTiming(o.key)} className="py-1.5 px-2 rounded-lg text-left transition-all" style={tileStyle(planTiming === o.key)}>
                    <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>{o.label}</div>
                    <div className="font-mono" style={{ fontSize: 10, opacity: 0.85 }}>{o.blurb}</div>
                  </button>
                ))}
              </div>
              {planTiming === 'idealYear' && hasCurrentPlantings && (
                <p className="font-mono mt-1.5" style={{ fontSize: 10.5, color: '#9A8268', lineHeight: 1.4 }}>
                  {IDEAL_PLAN_COPY.fullPlanHint}
                </p>
              )}
            </div>

            <div className="rounded-xl px-3 py-2.5" style={{ background: '#F5F8F3', border: '1px solid #B9C9B9' }}>
              <div className="font-sans uppercase tracking-widest mb-1" style={{ fontSize: 10, color: '#5F735F', letterSpacing: '0.08em' }}>Climate used automatically</div>
              <div className="font-display font-semibold" style={{ fontSize: 12.5, color: '#1F4D2B' }}>
                {PATTERN_META[pattern].icon} {PATTERN_META[pattern].label}
              </div>
              <p className="font-mono mt-1" style={{ fontSize: 10.5, color: '#687768', lineHeight: 1.4 }}>
                {climateSource === 'site'
                  ? 'Derived from satellite climate records for this site. You do not need to choose a rainfall type.'
                  : climateSource === 'reference'
                    ? `Per-site climate is not available right now (offline or still loading), so this uses the nearest reference: ${referenceName ?? 'regional point'} (fallback).`
                    : 'No mapped location is attached, so the planner is using the visible summer-rainfall fallback. Map the garden for a location-based climate profile.'}
              </p>
            </div>

            <button
              onClick={() => onAllowMixedCropsInBed(!allowMixedCropsInBed)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5"
              style={tileStyle(allowMixedCropsInBed)}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{allowMixedCropsInBed ? '▦' : '⭘'}</span>
              <span>
                <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>Divide beds into crop sections</div>
                <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>
                  On by default: Auto-suggest may use full, half, third or quarter-bed sections side by side so a long crop does not leave the whole bed blank. These are area shares, not a claimed intercropping row layout; check the section positions on the ground.
                </div>
              </span>
            </button>

            <button
              onClick={() => onRotateCrops(!rotateCrops)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5"
              style={tileStyle(rotateCrops)}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{rotateCrops ? '🔁' : '⭘'}</span>
              <span>
                <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>Rotate crops between beds</div>
                <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>
                  Avoids immediate same-family sequences inside this plan and after a crop marked already
                  growing — including tomato after potato and beetroot after Swiss chard. This is not a stored
                  multi-year rotation history.
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
              onClick={() => onReliableIrrigation(!reliableIrrigation)}
              className="w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-start gap-2.5"
              style={reliableIrrigation ? tileStyle(true) : { ...tileStyle(false), background: '#FFF8E8', border: '1px solid #C07A1E' }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>{reliableIrrigation ? '💧' : '⭘'}</span>
              <span>
                <div className="font-display font-semibold" style={{ fontSize: 12.5 }}>Reliable irrigation for every crop cycle (required)</div>
                <div className="font-mono" style={{ fontSize: 10.5, opacity: 0.85 }}>
                  This automatic plan deliberately packs successive crop cycles. A rainfall region does not
                  prove farm water, so it stays off unless you can irrigate throughout every suggested cycle.
                </div>
              </span>
            </button>

            {/* The site's OWN driest months, in its own numbers — the page already
                resolves this record and was throwing everything but the pattern
                away. Descriptive only: rainfall as recorded, no water requirement
                and no evaporation maths invented on top of it. */}
            {(() => {
              const driest = siteClimate ? driestMonths(siteClimate.monthlyRainMm, 3) : [];
              if (driest.length === 0) return null;
              return (
                <div className="rounded-xl px-3 py-2.5" style={{ background: '#F3F6FA', border: '1px solid #C2CEDC' }}>
                  <div className="font-sans uppercase tracking-widest mb-1" style={{ fontSize: 10, color: '#5D6B7C', letterSpacing: '0.08em' }}>Your driest months</div>
                  <p className="font-sans" style={{ fontSize: 12, color: '#3E4A57', lineHeight: 1.45 }}>
                    This site gets about {driest.map((m) => Math.round(m.rainMm)).join(' / ')} mm of rain
                    in {driest.map((m) => monthLabel(m.month)).join(' / ')} — its three driest months
                    (satellite record for this location).
                  </p>
                  <p className="font-sans mt-1" style={{ fontSize: 12, color: '#3E4A57', lineHeight: 1.45 }}>
                    “Reliable irrigation” means your water, not the rain, carries every crop through months like these.
                  </p>
                </div>
              );
            })()}

            <p className="font-mono" style={{ fontSize: 10.5, color: '#9A8268', lineHeight: 1.45 }}>
              {allowMixedCropsInBed
                ? 'Auto-suggest will use only full, half, third or quarter-bed sections. It does not claim a globally maximum plan or invent an exact row layout.'
                : 'Whole-bed mode is on. Short blank periods can remain between full-bed crop cycles because the planner will not overlap two different crops in one bed.'}
            </p>

            {/* WHY THE BUTTON IS GREY. Both gates are deliberate, but neither
                said anything: tapping a dead button just did nothing. The
                irrigation gate stays on — it is an honesty gate, not a default
                to soften — so the fix is to say what to tap, not to pre-tick it. */}
            {(() => {
              const needsCrops = goal !== 'family' && cropKeys.length === 0;
              const blockers = [
                needsCrops ? 'Pick at least one crop above before the planner can suggest anything.' : null,
                reliableIrrigation
                  ? null
                  : 'Turn on “Reliable irrigation for every crop cycle” above to generate a plan. This plan packs crop cycles back to back, so it only holds if you can water them through.',
              ].filter((line): line is string => line !== null);
              const canGenerate = blockers.length === 0 && !generating;
              return (
                <>
                  <button
                    onClick={onGenerate}
                    disabled={!canGenerate}
                    className="w-full font-display font-semibold rounded-xl py-2.5"
                    style={{
                      fontSize: 14,
                      background: canGenerate ? '#1F4D2B' : '#D8D3C9',
                      color: canGenerate ? '#F7F2E9' : '#81796D',
                      border: 'none',
                      cursor: canGenerate ? 'pointer' : 'not-allowed',
                    }}
                  >
                    {generating ? IDEAL_PLAN_COPY.busyLabel : '✨ Suggest a plan'}
                  </button>
                  {blockers.map((line) => (
                    <p key={line} className="font-sans mt-1.5" style={{ fontSize: 12, color: '#9A6018', lineHeight: 1.45 }}>{line}</p>
                  ))}
                </>
              );
            })()}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {!result || result.plantings.length === 0 ? (
              <p className="font-sans" style={{ fontSize: 13, color: '#5C5040' }}>
                Nothing fit this time — your beds may already be full, or the exact crops you picked have no supported slot that fits. Review the climate choice or crop list, or check "Waiting for their sowing window" below.
              </p>
            ) : (
              <>
                {idealMeta && (() => {
                  // The whole-year story, all sentences from IDEAL_PLAN_COPY so
                  // the truth gates read them. Ramp lines only when the winner
                  // differs from today; the residual/transition gap lines only
                  // when the gaps are real — never a promise of 12/12.
                  const startNowNames = idealMeta.startNowCropKeys
                    .map((key) => cropByKey(key)?.name)
                    .filter((name): name is string => Boolean(name))
                    .join(', ');
                  const transitionOnly = idealMeta.firstYearZeroFreshMonths
                    .filter((month) => !idealMeta.best.score.zeroFreshMonths.includes(month));
                  const line = { fontSize: 11.5, color: '#3E5240', lineHeight: 1.45 } as const;
                  return (
                    <div className="rounded-xl px-3 py-2.5 mb-2 space-y-1" style={{ background: '#F5F8F3', border: '1px solid #B9C9B9' }}>
                      <div className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#5F735F', letterSpacing: '0.08em' }}>{IDEAL_PLAN_COPY.twoYearHeading}</div>
                      <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.twoYearLine}</p>
                      <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.fullBedsLine}</p>
                      <p className="font-sans" style={line}>
                        {idealMeta.sameAsToday ? IDEAL_PLAN_COPY.sameAsTodayLine : IDEAL_PLAN_COPY.chosenLine}
                      </p>
                      {!idealMeta.sameAsToday && startNowNames && (
                        <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.startNowLine(startNowNames)}</p>
                      )}
                      {!idealMeta.sameAsToday && idealMeta.rampInMonths.length > 0 && (
                        <p className="font-sans" style={line}>
                          {IDEAL_PLAN_COPY.rampInLine(idealMeta.rampInMonths.length, monthLabel(idealMeta.fullCycleByMonth))}
                        </p>
                      )}
                      {(() => {
                        // One-time starters ride the plantings list itself (the
                        // `once` stamp), so the card derives rather than stores.
                        // Not gated on sameAsToday: a from-now-optimal cycle has
                        // the same first-year holes and gets the same starters.
                        const starterNames = idealMeta.best.result.plantings
                          .filter((p) => typeof p.once === 'string')
                          .map((p) => {
                            const crop = cropByKey(p.cropKey);
                            return crop ? `${crop.name} (${monthLabel(p.sowMonth)})` : null;
                          })
                          .filter((name): name is string => Boolean(name))
                          .join(', ');
                        return starterNames
                          ? <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.starterLine(starterNames)}</p>
                          : null;
                      })()}
                      {idealMeta.best.score.zeroFreshMonths.length > 0 && (
                        <p className="font-sans" style={line}>
                          {IDEAL_PLAN_COPY.residualGapLine(idealMeta.best.score.zeroFreshMonths.map(monthLabel).join(', '))}
                        </p>
                      )}
                      {transitionOnly.length > 0 && (
                        <p className="font-sans" style={line}>
                          {IDEAL_PLAN_COPY.transitionGapLine(transitionOnly.map(monthLabel).join(', '))}
                        </p>
                      )}
                      {rhythm === 'few-big' && <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.fewBigNote}</p>}
                      {goal === 'commercial' && <p className="font-sans" style={line}>{IDEAL_PLAN_COPY.commercialNote}</p>}
                    </div>
                  );
                })()}
                <p className="font-sans mb-2" style={{ fontSize: 13, color: '#5C5040' }}>{result.plantings.length} planting{result.plantings.length > 1 ? 's' : ''} suggested:</p>
                <div className="space-y-1 mb-2">
                  {result.plantings.map((p) => {
                    const crop = cropByKey(p.cropKey);
                    if (!crop) return null;
                    const h = harvestMonthForCrop(p.sowMonth, crop);
                    const fieldEntry = plannedBedEntryMonth(p.sowMonth, crop);
                    return (
                      <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg font-sans" style={{ fontSize: 12.5, background: '#FFFFFF', border: '1px solid #E2D8C4' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <CropIcon cropKey={crop.key} icon={crop.icon} size={14} /> {crop.name} ({fractionLabel(p.areaFraction ?? 1)} bed)
                          {typeof p.once === 'string' && (
                            <span className="font-sans uppercase" style={{ fontSize: 8.5, letterSpacing: '0.06em', color: '#5F735F', background: '#F5F8F3', border: '1px solid #B9C9B9', borderRadius: 6, padding: '1px 5px' }}>
                              {IDEAL_PLAN_COPY.starterBadge}
                            </span>
                          )}
                        </span>
                        <span style={{ color: '#8C7A62', textAlign: 'right' }}>
                          {crop.transplant
                            ? `start tray ${monthLabel(p.sowMonth)} → transplant ${monthLabel(fieldEntry)} → harvest ${monthLabel(h)} (${cropDurationLabel(crop)} in bed)`
                            : `sow ${monthLabel(p.sowMonth)} → ${crop.yieldKgPerM2 === 0 ? 'cut/roll down' : 'harvest'} ${monthLabel(h)}`}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
            {result && result.notes.length > 0 && <PlanNoteGroups notes={result.notes} />}
            {result && result.laterThisYear.length > 0 && (
              <div className="px-3 py-2 rounded-lg font-sans" style={{ fontSize: 11.5, background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#5C5040' }}>
                <div className="font-display font-semibold" style={{ fontSize: 11.5, color: '#20190F' }}>{PLAN_NOTES_PANEL_COPY.laterHeading}</div>
                <div className="mb-1" style={{ fontSize: 10.5, color: '#8C7A62' }}>
                  {PLAN_NOTES_PANEL_COPY.laterSubtitle}
                </div>
                {/* The sentence is written in lib (LaterThisYearEntry.text) so
                    the voice lint and the truth gates can read it — and so the
                    "window opens in X but nothing can take it until Y" case is
                    never flattened back into a single month here. */}
                {result.laterThisYear.map((l) => {
                  const crop = cropByKey(l.cropKey);
                  return (
                    <div key={l.cropKey} style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                      {crop && <CropIcon cropKey={l.cropKey} icon={crop.icon} size={14} />} {l.text}
                    </div>
                  );
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

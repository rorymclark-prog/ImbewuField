'use client';

// Facilitator crop plan — a Tend-style planting timeline built on the beds
// the facilitator has already placed on the design canvas (Planting layer).
//
// Reads the shared facilitator design (localStorage, read-only) for bed
// geometry + derives the site's rainfall pattern from bgSite, then keeps its
// own crop-plan store (lib/crop-plan.ts) for what's actually sown where.
// Zero network, zero new deps.

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, X } from 'lucide-react';
import type { FacilitatorDesignState } from '@/lib/facilitator-design';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import { nearestRainfall } from '@/lib/water-calc';
import type { CropDef, RainPattern } from '@/lib/crop-catalog';
import { CROPS, cropByKey, MONTHS_SHORT } from '@/lib/crop-catalog';
import type { PlanBed, Planting, CropPlanState, CropTask } from '@/lib/crop-plan';
import {
  loadCropPlan, saveCropPlan, harvestMonth, tasksForPlan, estimatedYieldKg, nextValidSowMonth,
  isSpaceHungry, bedOverlapFraction,
} from '@/lib/crop-plan';

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

interface Segment { start: number; end: number }

/** Bar segments for a sow→harvest span, split in two when it crosses the year boundary. */
function barSegments(sowMonth: number, harvest: number): Segment[] {
  if (harvest >= sowMonth) return [{ start: sowMonth, end: harvest }];
  return [{ start: sowMonth, end: 12 }, { start: 1, end: harvest }];
}

const COL_PCT = 100 / 12;
const leftPct = (m: number) => (m - 1) * COL_PCT;
const widthPct = (seg: Segment) => (seg.end - seg.start + 1) * COL_PCT;

const VIRTUAL_BED: PlanBed = { id: 'virtual-bed-1', label: 'Bed 1', areaM2: 10 };

/** Beds = design items of type 'bed'/'hugel', in placement (array) order. */
function computeDesignBeds(state: FacilitatorDesignState | null): PlanBed[] {
  if (!state) return [];
  const beds: PlanBed[] = [];
  let bedN = 0;
  let hugelN = 0;
  for (const it of state.items) {
    if (it.type === 'bed') {
      bedN += 1;
      beds.push({ id: it.id, label: `Bed ${bedN}`, areaM2: (it.wM || 1) * (it.hM || 1) });
    } else if (it.type === 'hugel') {
      hugelN += 1;
      beds.push({ id: it.id, label: `Hügel ${hugelN}`, areaM2: (it.wM || 1) * (it.hM || 1) });
    }
  }
  return beds;
}

const PATTERN_META: Record<RainPattern, { icon: string; label: string }> = {
  summer: { icon: '☀️', label: 'Summer rainfall' },
  winter: { icon: '🌧️', label: 'Winter rainfall' },
  'all-year': { icon: '🌦️', label: 'All-year rainfall' },
};

function taskSentence(tasks: CropTask[]): string {
  if (tasks.length === 0) return 'nothing due';
  return tasks.map((t) => `${t.action} ${t.cropName.toLowerCase()} (${t.bedLabel})`).join(' · ');
}

// ── Page ─────────────────────────────────────────────────────────────────

export default function FacilitatorCropsPage() {
  const [design, setDesign] = useState<FacilitatorDesignState | null | undefined>(undefined);
  const [plan, setPlan] = useState<CropPlanState | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(1);
  const [useVirtual, setUseVirtual] = useState(false);

  const [pickerBedId, setPickerBedId] = useState<string | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCrop, setPickerCrop] = useState<CropDef | null>(null);
  const [pickerMonth, setPickerMonth] = useState(1);
  const [pickerFraction, setPickerFraction] = useState(1);
  const [pickerExisting, setPickerExisting] = useState(false);

  const [activePlanting, setActivePlanting] = useState<Planting | null>(null);

  useEffect(() => {
    setDesign(loadFacilitatorState());
    setPlan(loadCropPlan());
    setCurrentMonth(new Date().getMonth() + 1);
    setMounted(true);
  }, []);

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
  const pattern: RainPattern = region?.pattern ?? 'summer';
  const patternMeta = PATTERN_META[pattern];
  const designTitle = design?.title || design?.bgSite?.name || 'Garden design';

  const plantings = plan?.plantings ?? [];
  const bedAreaFor = (bedId: string) => beds.find((b) => b.id === bedId)?.areaM2 ?? 0;

  function addPlanting(bedId: string, cropKey: string, sowMonth: number, areaFraction: number, existing: boolean) {
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
  function removePlanting(id: string) {
    setPlan((prev) => {
      if (!prev) return prev;
      return { version: 1, plantings: prev.plantings.filter((p) => p.id !== id), updatedAt: Date.now() };
    });
  }

  const allTasks = useMemo(() => (mounted ? tasksForPlan(plantings, beds) : []), [mounted, plantings, beds]);
  const nextMonth = wrapMonth(currentMonth + 1);
  const currentTasks = allTasks.filter((t) => t.month === currentMonth);
  const nextTasks = allTasks.filter((t) => t.month === nextMonth);

  const totalYieldKg = plantings.reduce((sum, p) => sum + estimatedYieldKg(p, bedAreaFor(p.bedId)), 0);
  // Already-growing crops are informational (the farmer planted them before
  // using the app) — split them out of the "to plant" total the same way
  // the design map's BOQ keeps existing features out of the budget.
  const existingYieldKg = plantings.filter((p) => p.existing).reduce((sum, p) => sum + estimatedYieldKg(p, bedAreaFor(p.bedId)), 0);
  const newYieldKg = totalYieldKg - existingYieldKg;
  const yieldByBed = beds
    .map((b) => ({
      bed: b,
      kg: plantings.filter((p) => p.bedId === b.id).reduce((sum, p) => sum + estimatedYieldKg(p, b.areaM2), 0),
    }))
    .filter((row) => row.kg > 0);

  function shareTasks() {
    const text = `🌱 Crop plan tasks\n${monthLabel(currentMonth)}: ${taskSentence(currentTasks)}\n${monthLabel(nextMonth)}: ${taskSentence(nextTasks)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  }

  function openPicker(bedId: string) {
    setPickerBedId(bedId);
    setPickerSearch('');
    setPickerCrop(null);
    setPickerFraction(1);
    setPickerExisting(false);
  }
  function closePicker() {
    setPickerBedId(null);
    setPickerCrop(null);
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
    addPlanting(pickerBedId, pickerCrop.key, pickerMonth, pickerFraction, pickerExisting);
    closePicker();
  }
  // Overlap warning: how much of the bed is already committed (by OTHER
  // plantings whose sow→harvest window overlaps this one) before adding this
  // one — shown as a soft nudge, never a hard block.
  const pickerOverlap = useMemo(() => {
    if (!pickerBedId || !pickerCrop) return 0;
    const harvest = harvestMonth(pickerMonth, pickerCrop.daysToHarvest);
    return bedOverlapFraction(pickerBedId, pickerMonth, harvest, plantings);
  }, [pickerBedId, pickerCrop, pickerMonth, plantings]);

  const loading = design === undefined || plan === null || !mounted;

  return (
    <div className="flex flex-col overflow-hidden" style={{ height: '100dvh', background: '#F7F2E9' }}>
      {/* Header */}
      <header className="flex-shrink-0 flex items-center px-3 md:px-5 gap-2 md:gap-3 overflow-x-auto" style={{ height: 56, background: '#FBF6EC', borderBottom: '1px solid #E2D8C4' }}>
        <Link
          href="/facilitator"
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-display"
          style={{ background: '#F5F0E8', border: '1px solid #E2D8C4', color: '#20190F', textDecoration: 'none' }}
        >
          ‹ Back to design
        </Link>
        <div className="w-px h-5 flex-shrink-0" style={{ background: '#E2D8C4' }} />
        <div className="flex flex-col min-w-0 flex-shrink-0">
          <span className="font-display font-semibold" style={{ fontSize: 15, color: '#20190F' }}>Crop plan</span>
          <span className="font-sans truncate" style={{ fontSize: 11, color: '#8C7A62', maxWidth: 220 }}>{designTitle}</span>
        </div>
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

            {/* Timeline */}
            <div className="rounded-2xl overflow-hidden mb-5" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: 760 }}>
                  {/* Month header row */}
                  <div className="flex" style={{ borderBottom: '1px solid #E2D8C4' }}>
                    <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#FBF6EC', borderRight: '1px solid #E2D8C4', padding: '8px 10px' }}>
                      <span className="font-sans uppercase tracking-widest" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Bed</span>
                    </div>
                    <div className="flex" style={{ flex: '1 1 auto' }}>
                      {MONTHS_SHORT.map((m, i) => (
                        <div
                          key={m}
                          className="text-center font-sans"
                          style={{
                            flex: 1, padding: '8px 2px', fontSize: 11,
                            fontWeight: (i + 1) === currentMonth ? 700 : 500,
                            color: (i + 1) === currentMonth ? '#1F4D2B' : '#8C7A62',
                            background: (i + 1) === currentMonth ? 'rgba(31,77,43,0.08)' : 'transparent',
                          }}
                        >
                          {m}
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
                  <div className="font-sans uppercase tracking-widest mb-1.5" style={{ fontSize: 10, color: '#8C7A62', letterSpacing: '0.08em' }}>Full year</div>
                  <div className="space-y-1">
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                      const t = allTasks.filter((task) => task.month === m);
                      if (t.length === 0) return null;
                      return (
                        <div key={m} className="font-sans" style={{ fontSize: 12, color: '#5C5040' }}>
                          <strong style={{ color: '#20190F' }}>{monthLabel(m)}</strong> — {taskSentence(t)}
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
          onRemove={() => { removePlanting(activePlanting.id); setActivePlanting(null); }}
          onClose={() => setActivePlanting(null)}
        />
      )}
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

// ── Bed row + planting bars ─────────────────────────────────────────────

function BedRow({ bed, plantings, currentMonth, onAddCrop, onTapPlanting }: {
  bed: PlanBed;
  plantings: Planting[];
  currentMonth: number;
  onAddCrop: () => void;
  onTapPlanting: (p: Planting) => void;
}) {
  return (
    <div className="flex" style={{ borderBottom: '1px solid #E2D8C4' }}>
      <div style={{ position: 'sticky', left: 0, zIndex: 2, width: 128, flexShrink: 0, background: '#FBF6EC', borderRight: '1px solid #E2D8C4', padding: '10px 10px' }}>
        <div className="font-display font-semibold" style={{ fontSize: 13, color: '#20190F' }}>{bed.label}</div>
        <div className="font-mono" style={{ fontSize: 11, color: '#8C7A62' }}>{bed.areaM2.toFixed(1)} m²</div>
      </div>
      <div style={{ flex: '1 1 auto', position: 'relative' }}>
        {/* month gridlines (background) */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', pointerEvents: 'none' }}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <div
              key={m}
              style={{ flex: 1, borderRight: m < 12 ? '1px solid #EDE7DB' : 'none', background: m === currentMonth ? 'rgba(31,77,43,0.05)' : 'transparent' }}
            />
          ))}
        </div>
        <div style={{ position: 'relative', padding: '6px 0' }}>
          {plantings.map((p) => (
            <PlantingBar key={p.id} planting={p} onTap={() => onTapPlanting(p)} />
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

function PlantingBar({ planting, onTap }: { planting: Planting; onTap: () => void }) {
  const crop = cropByKey(planting.cropKey);
  if (!crop) return null;
  const harvest = harvestMonth(planting.sowMonth, crop.daysToHarvest);
  const segments = barSegments(planting.sowMonth, harvest);
  const trMonth = crop.transplant && !planting.existing ? wrapMonth(planting.sowMonth + 1) : null;
  const fraction = planting.areaFraction ?? 1;
  const fLabel = fractionLabel(fraction);
  // Existing (already-growing) crops get a muted olive treatment so the eye
  // separates "already there" from "still to sow" at a glance.
  const barColor = planting.existing ? '#8C8654' : '#3F7A3C';

  return (
    <div style={{ position: 'relative', height: 30, marginBottom: 3 }}>
      {segments.map((seg, i) => (
        <button
          key={i}
          onClick={onTap}
          className="font-sans"
          style={{
            position: 'absolute', left: `${leftPct(seg.start)}%`, width: `${widthPct(seg)}%`, top: 2, bottom: 2,
            background: barColor, color: '#fff', border: 'none', borderRadius: 6,
            fontSize: 11, fontWeight: 600, textAlign: 'left', paddingLeft: 6, paddingRight: 4,
            overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: 'pointer',
          }}
          title={`${crop.name} — sow ${monthLabel(planting.sowMonth)}, harvest ${monthLabel(harvest)}${fraction < 1 ? ` · ${fLabel} of bed` : ''}${planting.existing ? ' · already growing' : ''}`}
        >
          {i === 0 ? `${crop.icon} ${crop.name}${fLabel ? ` (${fLabel})` : ''}` : ''}
        </button>
      ))}
      {trMonth !== null && (
        <div
          style={{
            position: 'absolute', left: `${leftPct(trMonth) + COL_PCT / 2}%`, top: -2, transform: 'translateX(-50%)',
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
  onPick, onBack, onMonth, onConfirm, onClose,
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
  onPick: (c: CropDef) => void;
  onBack: () => void;
  onMonth: (m: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const filtered = CROPS.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));
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
                return (
                  <button
                    key={c.key}
                    onClick={() => onPick(c)}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left"
                    style={{ background: '#FBF6EC', border: '1px solid #E2D8C4', cursor: 'pointer' }}
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
                );
              })}
              {filtered.length === 0 && (
                <div className="font-sans text-center py-6" style={{ fontSize: 13, color: '#8C7A62' }}>No crops match “{search}”.</div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4">
            <button onClick={onBack} className="font-sans mb-3" style={{ fontSize: 12, color: '#1F4D2B', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              ‹ Back to list
            </button>
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

            <label className="flex items-center gap-2 font-sans mb-3 cursor-pointer" style={{ fontSize: 13, color: '#5C5040' }}>
              <input type="checkbox" checked={existing} onChange={(e) => onExisting(e.target.checked)} style={{ accentColor: '#1F4D2B' }} />
              This is already growing (not a new planting)
            </label>

            <button
              onClick={onConfirm}
              className="w-full font-display font-semibold rounded-xl py-2.5 mt-1"
              style={{ fontSize: 14, background: '#1F4D2B', color: '#F7F2E9', border: 'none', cursor: 'pointer' }}
            >
              {existing ? 'Add as existing' : 'Add to bed'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Planting popover ─────────────────────────────────────────────────────

function PlantingPopover({ planting, bedAreaM2, onRemove, onClose }: {
  planting: Planting;
  bedAreaM2: number;
  onRemove: () => void;
  onClose: () => void;
}) {
  const crop = cropByKey(planting.cropKey);
  if (!crop) return null;
  const harvest = harvestMonth(planting.sowMonth, crop.daysToHarvest);
  const yieldKg = estimatedYieldKg(planting, bedAreaM2);
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
            {fractionLabel(planting.areaFraction ?? 1)} of bed — intercropped
          </div>
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
        <button
          onClick={onRemove}
          className="w-full font-display font-semibold rounded-xl py-2"
          style={{ fontSize: 13, background: 'rgba(180,50,40,0.1)', color: '#A83A2C', border: '1px solid rgba(180,50,40,0.25)', cursor: 'pointer' }}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, AlertTriangle, Sprout } from 'lucide-react';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { loadCropPlan } from '@/lib/crop-plan';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import { bedsFromDesign, buildReconciliation, type Period, type CropRow, type UnplannedRow } from '@/lib/harvest-reconciliation';
import { getCropArt } from '@/lib/crop-art';

interface Props {
  production: ProductionLog[];
  sales: SalesLog[];
  period: Period;
  now: Date;
  loading: boolean;
}

function fmtKg(n: number): string {
  return `${n.toFixed(n > 0 && n < 10 ? 1 : 0)} kg`;
}

const PERIOD_LABEL: Record<Period, string> = { month: 'this month', season: 'this season', year: 'this year' };

function MatchedRow({ row }: { row: CropRow }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-display font-medium" style={{ color: '#20190F', display: 'flex', alignItems: 'center', gap: 4 }}>
          {getCropArt(row.cropKey) ? (
            <img src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 16, height: 16, objectFit: 'contain' }} />
          ) : (
            <span>{row.icon}</span>
          )}{' '}
          {row.cropName}
        </p>
        <p className="text-xs font-mono flex-shrink-0" style={{ color: '#8C7A62' }}>
          Harvested {fmtKg(row.harvestedKg)} · Sold {fmtKg(row.soldKg)}
        </p>
      </div>
      {row.intendedKg !== null && (
        <p className="text-xs font-sans mt-1.5" style={{ color: '#8C7A62' }}>
          Plan context: {fmtKg(row.intendedKg)} is the benchmark for one complete crop-plan cycle, not an expectation for this calendar year.
        </p>
      )}
      {row.keptGap && row.keptKg !== null && (
        <p className="text-xs font-sans mt-1.5" style={{ color: '#5C5040' }}>
          Harvested {fmtKg(row.harvestedKg)}, sold {fmtKg(row.soldKg)} — {fmtKg(row.keptKg)} kept: eaten at home, given away, fed out, saved for seed or spoiled.
        </p>
      )}
      {/* SAYING "I DO NOT KNOW" IS THE FEATURE. This branch used to be unreachable: the kept figure
          was clamped to zero, so a farmer who had logged only some of her picking was told she kept
          nothing — most wrongly, in the exact case where she had kept most of it. The two possible
          causes are named because the app genuinely cannot tell them apart, and naming only the
          farmer's omission would blame her for the app's blind spot. */}
      {row.soldExceedsHarvested && (
        <p className="text-xs font-sans mt-1.5" style={{ color: '#5C5040' }}>
          Sold {fmtKg(row.soldKg)} but only {fmtKg(row.harvestedKg)} logged as harvested, so how much you kept is not known — either some picking was not written down, or these sales came from an earlier harvest.
        </p>
      )}
    </div>
  );
}

function SoftRow({ row }: { row: CropRow }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <p className="text-sm font-display" style={{ color: '#20190F', display: 'flex', alignItems: 'center', gap: 4 }}>
        {getCropArt(row.cropKey) ? (
          <img src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} />
        ) : (
          <span>{row.icon}</span>
        )}{' '}
        {row.cropName}
      </p>
      <p className="text-xs font-sans text-right" style={{ color: '#8C7A62' }}>
        No harvest logged this year
        {row.intendedKg !== null && <><br />{fmtKg(row.intendedKg)} one-cycle benchmark</>}
      </p>
    </div>
  );
}

function UnplannedRowView({ row }: { row: UnplannedRow }) {
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-display" style={{ color: '#20190F' }}>{row.label}</p>
        <p className="text-xs font-mono flex-shrink-0" style={{ color: '#8C7A62' }}>
          {row.harvestedKg > 0 && `Harvested ${fmtKg(row.harvestedKg)}`}
          {row.harvestedKg > 0 && row.soldKg > 0 && ' · '}
          {row.soldKg > 0 && `Sold ${fmtKg(row.soldKg)}`}
        </p>
      </div>
      {row.ambiguous && (
        <p className="text-xs font-sans mt-1 flex items-start gap-1.5" style={{ color: '#C07A1E' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>“{row.label}” could be several crops — log a fuller name to count it against the right one.</span>
        </p>
      )}
    </div>
  );
}

export default function HarvestReconciliation({ production, sales, period, now, loading }: Props) {
  const [plantings, setPlantings] = useState<Planting[]>([]);
  const [beds, setBeds] = useState<PlanBed[]>([]);
  const [planLoaded, setPlanLoaded] = useState(false);

  useEffect(() => {
    setPlantings(loadCropPlan().plantings);
    setBeds(bedsFromDesign(loadFacilitatorState()));
    setPlanLoaded(true);
  }, []);

  const result = useMemo(
    () => buildReconciliation(plantings, beds, production, sales, period, now),
    [plantings, beds, production, sales, period, now],
  );

  const periodLabel = PERIOD_LABEL[period];
  const isLoading = loading || !planLoaded;
  const hasPlan = plantings.length > 0;
  const hasAnything = result.matched.length > 0 || result.notYetHarvested.length > 0
    || result.unmatchedPlanned.length > 0 || result.unplannedActivity.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFEFA', border: '1px solid #E2D8C4' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid #E2D8C4' }}>
        <ClipboardList size={14} style={{ color: '#5C5040' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#5C5040' }}>
          Harvest reconciliation
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: '#8C7A62' }}>Loading…</div>
      ) : !hasPlan ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
          <Sprout size={20} style={{ color: '#1F4D2B' }} />
          <p className="text-sm font-display" style={{ color: '#5C5040' }}>
            No crop plan yet — build one in Design & Plan to view the plan beside actual harvest records.
          </p>
        </div>
      ) : !hasAnything ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: '#8C7A62' }}>
          Nothing logged {periodLabel}. Monthly and seasonal targets are not invented from a crop-cycle benchmark.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#E2D8C4' }}>
          {result.matched.map((row) => (
            <MatchedRow key={row.cropKey} row={row} />
          ))}
          {result.unmatchedPlanned.map((row) => (
            <SoftRow key={row.cropKey} row={row} />
          ))}
          {result.notYetHarvested.map((row) => (
            <SoftRow key={row.cropKey} row={row} />
          ))}
          {result.unplannedActivity.length > 0 && (
            <div>
              <div className="px-4 pt-2.5 pb-1 text-xs font-sans uppercase tracking-wider" style={{ color: '#94876F' }}>
                Other activity — not in your crop plan
              </div>
              {result.unplannedActivity.map((row) => (
                <UnplannedRowView key={row.label} row={row} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

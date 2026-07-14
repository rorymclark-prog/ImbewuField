'use client';

import { useEffect, useMemo, useState } from 'react';
import { ClipboardList, AlertTriangle, Sprout } from 'lucide-react';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { loadCropPlan } from '@/lib/crop-plan';
import { loadFacilitatorState } from '@/lib/facilitator-design';
import { bedsFromDesign, buildReconciliation, type Period, type CropRow, type UnplannedRow } from '@/lib/harvest-reconciliation';

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

function MatchedRow({ row, periodLabel }: { row: CropRow; periodLabel: string }) {
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-display font-medium" style={{ color: '#20190F' }}>
          {row.icon} {row.cropName}
        </p>
        <p className="text-xs font-mono flex-shrink-0" style={{ color: '#8C7A62' }}>
          Harvested {fmtKg(row.harvestedKg)} · Sold {fmtKg(row.soldKg)}
        </p>
      </div>
      {row.yieldGap && (
        <p className="text-xs font-sans mt-1.5 flex items-start gap-1.5" style={{ color: '#C07A1E' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>Harvested {fmtKg(row.harvestedKg)} — plan expected ~{fmtKg(row.intendedKg)} {periodLabel}.</span>
        </p>
      )}
      {row.unaccountedGap && (
        <p className="text-xs font-sans mt-1.5" style={{ color: '#5C5040' }}>
          Harvested {fmtKg(row.harvestedKg)}, only {fmtKg(row.soldKg)} sold — {fmtKg(row.unaccountedKg)} unaccounted for: home-eaten, given away, or spoiled?
        </p>
      )}
    </div>
  );
}

function SoftRow({ row, tone }: { row: CropRow; tone: 'wait' | 'flag' }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <p className="text-sm font-display" style={{ color: '#20190F' }}>{row.icon} {row.cropName}</p>
      <p className="text-xs font-sans flex-shrink-0" style={{ color: tone === 'flag' ? '#C07A1E' : '#8C7A62' }}>
        {tone === 'flag'
          ? `Expected ~${fmtKg(row.intendedKg)} — nothing logged yet`
          : 'Not yet harvested'}
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
    <div className="rounded-2xl overflow-hidden" style={{ background: '#FBF6EC', border: '1px solid #E2D8C4' }}>
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
            No crop plan yet — build one in Design & Plan to compare intended vs actual harvest.
          </p>
        </div>
      ) : !hasAnything ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: '#8C7A62' }}>
          Nothing to reconcile {periodLabel} — no plan activity due and nothing logged.
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: '#E2D8C4' }}>
          {result.matched.map((row) => (
            <MatchedRow key={row.cropKey} row={row} periodLabel={periodLabel} />
          ))}
          {result.unmatchedPlanned.map((row) => (
            <SoftRow key={row.cropKey} row={row} tone="flag" />
          ))}
          {result.notYetHarvested.map((row) => (
            <SoftRow key={row.cropKey} row={row} tone="wait" />
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

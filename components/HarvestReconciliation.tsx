'use client';

import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, Sprout } from 'lucide-react';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { buildReconciliation, type Period, type CropRow, type UnplannedRow } from '@/lib/harvest-reconciliation';
import { getCropArt } from '@/lib/crop-art';
import { useLanguage } from '@/lib/i18n';

interface Props {
  production: ProductionLog[];
  sales: SalesLog[];
  period: Period;
  now: Date;
  loading: boolean;
  /** From lib/finance-plan-source — the SAME beds and plan every other card on
   *  /finances is given, so no two cards can measure different land. */
  plantings: Planting[];
  beds: PlanBed[];
  planLoaded: boolean;
}

function fmtKg(n: number): string {
  return `${n.toFixed(n > 0 && n < 10 ? 1 : 0)} kg`;
}

const PERIOD_LABEL: Record<Period, string> = { month: 'this month', season: 'this season', year: 'this year' };

function MatchedRow({ row }: { row: CropRow }) {
  const { lang } = useLanguage();
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-display font-medium" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {getCropArt(row.cropKey) ? (
            <img className="produce-art" src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 16, height: 16, objectFit: 'contain' }} />
          ) : (
            <span>{row.icon}</span>
          )}{' '}
          {row.cropName}
        </p>
        <p className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {lang === 'zu' ? `Kuvunyiwe ${fmtKg(row.harvestedKg)} · Kuthengisiwe ${fmtKg(row.soldKg)}` : `Harvested ${fmtKg(row.harvestedKg)} · Sold ${fmtKg(row.soldKg)}`}
        </p>
      </div>
      {row.intendedKg !== null && (
        <p className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {lang === 'zu' ? `Incazelo enemininingwane ngesiNgisi okwamanje: Plan context: ${fmtKg(row.intendedKg)} is the benchmark for one complete crop-plan cycle, not an expectation for this calendar year.` : `Plan context: ${fmtKg(row.intendedKg)} is the benchmark for one complete crop-plan cycle, not an expectation for this calendar year.`}
        </p>
      )}
      {row.keptGap && row.keptKg !== null && (
        <p className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {lang === 'zu' ? `Incazelo enemininingwane ngesiNgisi okwamanje: Harvested ${fmtKg(row.harvestedKg)}, sold ${fmtKg(row.soldKg)} — ${fmtKg(row.keptKg)} kept: eaten at home, given away, fed out, saved for seed or spoiled.` : `Harvested ${fmtKg(row.harvestedKg)}, sold ${fmtKg(row.soldKg)} — ${fmtKg(row.keptKg)} kept: eaten at home, given away, fed out, saved for seed or spoiled.`}
        </p>
      )}
      {/* SAYING "I DO NOT KNOW" IS THE FEATURE. This branch used to be unreachable: the kept figure
          was clamped to zero, so a farmer who had logged only some of her picking was told she kept
          nothing — most wrongly, in the exact case where she had kept most of it. The two possible
          causes are named because the app genuinely cannot tell them apart, and naming only the
          farmer's omission would blame her for the app's blind spot. */}
      {row.soldExceedsHarvested && (
        <p className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-secondary)' }}>
          {lang === 'zu' ? `Incazelo enemininingwane ngesiNgisi okwamanje: Sold ${fmtKg(row.soldKg)} but only ${fmtKg(row.harvestedKg)} logged as harvested, so how much you kept is not known — either some picking was not written down, or these sales came from an earlier harvest.` : `Sold ${fmtKg(row.soldKg)} but only ${fmtKg(row.harvestedKg)} logged as harvested, so how much you kept is not known — either some picking was not written down, or these sales came from an earlier harvest.`}
        </p>
      )}
    </div>
  );
}

function SoftRow({ row }: { row: CropRow }) {
  const { lang } = useLanguage();
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5">
      <p className="text-sm font-display" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {getCropArt(row.cropKey) ? (
          <img className="produce-art" src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} />
        ) : (
          <span>{row.icon}</span>
        )}{' '}
        {row.cropName}
      </p>
      <p className="text-xs font-sans text-right" style={{ color: 'var(--text-muted)' }}>
        {lang === 'zu' ? 'Asikho isivuno esirekhodiwe kulo nyaka' : 'No harvest logged this year'}
        {row.intendedKg !== null && <><br />{fmtKg(row.intendedKg)} {lang === 'zu' ? 'isilinganiso somjikelezo owodwa' : 'one-cycle benchmark'}</>}
      </p>
    </div>
  );
}

function UnplannedRowView({ row }: { row: UnplannedRow }) {
  const { lang } = useLanguage();
  return (
    <div className="px-4 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-display" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
        <p className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
          {row.harvestedKg > 0 && `${lang === 'zu' ? 'Kuvunyiwe' : 'Harvested'} ${fmtKg(row.harvestedKg)}`}
          {row.harvestedKg > 0 && row.soldKg > 0 && ' · '}
          {row.soldKg > 0 && `${lang === 'zu' ? 'Kuthengisiwe' : 'Sold'} ${fmtKg(row.soldKg)}`}
        </p>
      </div>
      {row.ambiguous && (
        <p className="text-xs font-sans mt-1 flex items-start gap-1.5" style={{ color: 'var(--gold)' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{lang === 'zu' ? `“${row.label}” kungaba izitshalo eziningana — rekhoda igama eligcwele ukuze kubalwe ngaphansi kwesitshalo esifanele.` : `“${row.label}” could be several crops — log a fuller name to count it against the right one.`}</span>
        </p>
      )}
    </div>
  );
}

/**
 * THE BEDS NOW ARRIVE AS A PROP, and that is the whole point of the change.
 *
 * This card used to read `bedsFromDesign(loadFacilitatorState())` — the LEGACY
 * facilitator canvas — while the FarmMetrics card directly above it read the
 * Design Studio canvas. On the sample farm that is 44 m² against 128 m², so the
 * two adjacent cards reported production densities three times apart, both
 * presented as facts about one farm. lib/finance-plan-source.ts is now the one
 * authority for the screen and hands the same beds to both.
 */
export default function HarvestReconciliation({ production, sales, period, now, loading, plantings, beds, planLoaded }: Props) {
  const { lang } = useLanguage();
  const result = useMemo(
    () => buildReconciliation(plantings, beds, production, sales, period, now),
    [plantings, beds, production, sales, period, now],
  );

  const periodLabel = lang === 'zu' ? ({ month: 'kule nyanga', season: 'kule sizini', year: 'kulo nyaka' } as const)[period] : PERIOD_LABEL[period];
  const isLoading = loading || !planLoaded;
  const hasPlan = plantings.length > 0;
  const hasAnything = result.matched.length > 0 || result.notYetHarvested.length > 0
    || result.unmatchedPlanned.length > 0 || result.unplannedActivity.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <ClipboardList size={14} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {lang === 'zu' ? 'Ukuqhathanisa isivuno nerekhodi' : 'Harvest reconciliation'}
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: 'var(--text-muted)' }}>{lang === 'zu' ? 'Kuyalayishwa…' : 'Loading…'}</div>
      ) : !hasPlan ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
          <Sprout size={20} style={{ color: 'var(--color-forest-800)' }} />
          <p className="text-sm font-display" style={{ color: 'var(--text-secondary)' }}>
            {lang === 'zu' ? 'Incazelo enemininingwane ngesiNgisi okwamanje: No crop plan yet — build one in Design & Plan to view the plan beside actual harvest records.' : 'No crop plan yet — build one in Design & Plan to view the plan beside actual harvest records.'}
          </p>
        </div>
      ) : !hasAnything ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: 'var(--text-muted)' }}>
          {lang === 'zu' ? `Akukho okurekhodiwe ${periodLabel}. Incazelo enemininingwane ngesiNgisi okwamanje: Monthly and seasonal targets are not invented from a crop-cycle benchmark.` : `Nothing logged ${periodLabel}. Monthly and seasonal targets are not invented from a crop-cycle benchmark.`}
        </div>
      ) : (
        <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
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
              <div className="px-4 pt-2.5 pb-1 text-xs font-sans uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {lang === 'zu' ? 'Omunye umsebenzi — awukho ohlelweni lwezitshalo' : 'Other activity — not in your crop plan'}
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

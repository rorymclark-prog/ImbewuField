'use client';

import { useMemo } from 'react';
import { ClipboardList, AlertTriangle, Sprout } from 'lucide-react';
import type { ProductionLog, SalesLog } from '@/lib/db/types';
import type { PlanBed, Planting } from '@/lib/crop-plan';
import { buildReconciliation, type Period, type CropRow, type UnplannedRow } from '@/lib/harvest-reconciliation';
import { getCropArt } from '@/lib/crop-art';
import { useLanguage } from '@/lib/i18n';
import IsiZuluDraftSource from '@/components/IsiZuluDraftSource';
import { recordsFill, recordsTemplate } from '@/lib/records-regional-drafts';

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


function MatchedRow({ row }: { row: CropRow }) {
  const { lang } = useLanguage();
  return (
    <div className="px-4 py-3">
      {/* flex-wrap: a drafted "Harvested X · Sold Y" is longer than the English and used to be cut off at
          the right edge on a 390px phone; it now drops under the crop name instead. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-display font-medium" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {getCropArt(row.cropKey) ? (
            <img className="produce-art" src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 16, height: 16, objectFit: 'contain' }} />
          ) : (
            <span>{row.icon}</span>
          )}{' '}
          {row.cropName}
        </p>
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {recordsTemplate(lang, 'Harvested {harvested} · Sold {sold}', 'Kuvunyiwe {harvested} · Kuthengisiwe {sold}', { harvested: fmtKg(row.harvestedKg), sold: fmtKg(row.soldKg) })}
        </p>
      </div>
      {row.intendedKg !== null && (
        <IsiZuluDraftSource className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-muted)' }} lang={lang}
          template="Plan context: {kg} is the benchmark for one complete crop-plan cycle, not an expectation for this calendar year." vars={{ kg: fmtKg(row.intendedKg) }}
          english={`Plan context: ${fmtKg(row.intendedKg)} is the benchmark for one complete crop-plan cycle, not an expectation for this calendar year.`}
          zulu={`Ngokohlelo: ${fmtKg(row.intendedKg)} kuyisilinganiso sesivuno somjikelezo owodwa ophelele wohlelo lwezitshalo; akusona isivuno esilindelekile salo nyaka wekhalenda.`} />
      )}
      {row.keptGap && row.keptKg !== null && (
        <IsiZuluDraftSource className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-secondary)' }} lang={lang}
          template="Harvested {harvested}, sold {sold} — {kept} kept: eaten at home, given away, fed out, saved for seed or spoiled." vars={{ harvested: fmtKg(row.harvestedKg), sold: fmtKg(row.soldKg), kept: fmtKg(row.keptKg) }}
          english={`Harvested ${fmtKg(row.harvestedKg)}, sold ${fmtKg(row.soldKg)} — ${fmtKg(row.keptKg)} kept: eaten at home, given away, fed out, saved for seed or spoiled.`}
          zulu={`Kuvunyiwe ${fmtKg(row.harvestedKg)}, kwathengiswa ${fmtKg(row.soldKg)} — okungadayiswanga okungu-${fmtKg(row.keptKg)}: kungenzeka kudliwe ekhaya, kuphiwe abanye, kondliwe izilwane, kugcinelwe imbewu noma konakele.`} />
      )}
      {/* SAYING "I DO NOT KNOW" IS THE FEATURE. This branch used to be unreachable: the kept figure
          was clamped to zero, so a farmer who had logged only some of her picking was told she kept
          nothing — most wrongly, in the exact case where she had kept most of it. The two possible
          causes are named because the app genuinely cannot tell them apart, and naming only the
          farmer's omission would blame her for the app's blind spot. */}
      {row.soldExceedsHarvested && (
        <IsiZuluDraftSource className="text-xs font-sans mt-1.5" style={{ color: 'var(--text-secondary)' }} lang={lang}
          template="Sold {sold} but only {harvested} logged as harvested, so how much you kept is not known — either some picking was not written down, or these sales came from an earlier harvest." vars={{ sold: fmtKg(row.soldKg), harvested: fmtKg(row.harvestedKg) }}
          english={`Sold ${fmtKg(row.soldKg)} but only ${fmtKg(row.harvestedKg)} logged as harvested, so how much you kept is not known — either some picking was not written down, or these sales came from an earlier harvest.`}
          zulu={`Kudayiswe ${fmtKg(row.soldKg)}, kodwa kurekhodwe ukuvunwa kuka-${fmtKg(row.harvestedKg)} kuphela. Ngakho asazi ukuthi kungakanani okusele: kungenzeka ukuthi okunye ukuvunwa akubhalwanga, noma lokhu kudayisa kuvela esivunweni sangaphambilini.`} />
      )}
    </div>
  );
}

function SoftRow({ row }: { row: CropRow }) {
  const { lang } = useLanguage();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2.5">
      <p className="text-sm font-display" style={{ color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 4 }}>
        {getCropArt(row.cropKey) ? (
          <img className="produce-art" src={getCropArt(row.cropKey)} alt="" aria-hidden style={{ width: 14, height: 14, objectFit: 'contain' }} />
        ) : (
          <span>{row.icon}</span>
        )}{' '}
        {row.cropName}
      </p>
      <div className="text-xs font-sans text-right" style={{ color: 'var(--text-muted)' }}>
        <IsiZuluDraftSource lang={lang}
          template={row.intendedKg !== null ? 'No harvest logged this year · {kg} one-cycle benchmark' : 'No harvest logged this year'} vars={{ kg: row.intendedKg !== null ? fmtKg(row.intendedKg) : '' }}
          english={`No harvest logged this year${row.intendedKg !== null ? ` · ${fmtKg(row.intendedKg)} one-cycle benchmark` : ''}`}
          zulu={`Asikho isivuno esirekhodiwe kulo nyaka${row.intendedKg !== null ? ` · ${fmtKg(row.intendedKg)} kuyisilinganiso somjikelezo owodwa` : ''}`} />
      </div>
    </div>
  );
}

function UnplannedRowView({ row }: { row: UnplannedRow }) {
  const { lang } = useLanguage();
  return (
    <div className="px-4 py-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-display" style={{ color: 'var(--text-primary)' }}>{row.label}</p>
        <p className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
          {row.harvestedKg > 0 && recordsTemplate(lang, 'Harvested {kg}', 'Kuvunyiwe {kg}', { kg: fmtKg(row.harvestedKg) })}
          {row.harvestedKg > 0 && row.soldKg > 0 && ' · '}
          {row.soldKg > 0 && recordsTemplate(lang, 'Sold {kg}', 'Kuthengisiwe {kg}', { kg: fmtKg(row.soldKg) })}
        </p>
      </div>
      {row.ambiguous && (
        <p className="text-xs font-sans mt-1 flex items-start gap-1.5" style={{ color: 'var(--gold)' }}>
          <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{lang === 'zu'
            ? <>“{row.label}” kungaba izitshalo eziningana — rekhoda igama eligcwele ukuze kubalwe ngaphansi kwesitshalo esifanele. <small className="block text-xs text-stone-600">Unreviewed isiZulu draft. English source: “{row.label}” could be several crops — log a fuller name to count it against the right one.</small></>
            : <IsiZuluDraftSource lang={lang} template="“{label}” could be several crops — log a fuller name to count it against the right one." vars={{ label: row.label }} zulu="" english={`“${row.label}” could be several crops — log a fuller name to count it against the right one.`} />}</span>
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

  const periodLabel = ({ month: 'kule nyanga', season: 'kule sizini', year: 'kulo nyaka' } as const)[period];
  const tx = (en: string, zu: string) => lang === 'zu' ? zu : recordsFill(lang, en);
  // Whole sentences, one per period, so a draft is bound to the exact English rather than to a spliced fragment.
  const NOTHING_LOGGED: Record<Period, string> = {
    month: 'Nothing logged this month. Monthly and seasonal targets are not invented from a crop-cycle benchmark.',
    season: 'Nothing logged this season. Monthly and seasonal targets are not invented from a crop-cycle benchmark.',
    year: 'Nothing logged this year. Monthly and seasonal targets are not invented from a crop-cycle benchmark.',
  };
  const isLoading = loading || !planLoaded;
  const hasPlan = plantings.length > 0;
  const hasAnything = result.matched.length > 0 || result.notYetHarvested.length > 0
    || result.unmatchedPlanned.length > 0 || result.unplannedActivity.length > 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <ClipboardList size={14} style={{ color: 'var(--text-secondary)' }} />
        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {tx('Harvest reconciliation', 'Ukuqhathanisa isivuno nerekhodi')}
        </span>
      </div>

      {isLoading ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: 'var(--text-muted)' }}>{tx('Loading…', 'Kuyalayishwa…')}</div>
      ) : !hasPlan ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center">
          <Sprout size={20} style={{ color: 'var(--color-forest-800)' }} />
          <div className="text-sm font-display" style={{ color: 'var(--text-secondary)' }}>
            <IsiZuluDraftSource lang={lang} zulu="Alukho uhlelo lwezitshalo okwamanje. Dala uhlelo ku-Design & Plan ukuze uqhathanise ukuhlelile namarekhodi okuvunwa kwangempela." english="No crop plan yet — build one in Design & Plan to view the plan beside actual harvest records." />
          </div>
        </div>
      ) : !hasAnything ? (
        <div className="px-4 py-6 text-xs font-sans" style={{ color: 'var(--text-muted)' }}>
          <IsiZuluDraftSource lang={lang} zulu={`Akukho okurekhodiwe ${periodLabel}. Asenzi izinhloso zenyanga noma zesizini ngokuthatha isilinganiso somjikelezo wezitshalo njengesisekelo.`} english={NOTHING_LOGGED[period]} />
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
                {tx('Other activity — not in your crop plan', 'Omunye umsebenzi — awukho ohlelweni lwezitshalo')}
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

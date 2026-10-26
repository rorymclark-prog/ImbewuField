'use client';
import { useLanguage } from '@/lib/i18n';
import { cropExportText, isCropExportDraftLanguage } from '@/lib/crop-export-copy';
import { productGuideText } from '@/lib/production-product-guidance';
import { recordsMonthShort } from '@/lib/records-months';

import { Trees } from 'lucide-react';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { formatMonthSpan, isHouseholdFoodHarvest, type PlacedTreeGroup, type TreeSeasonChoices, type UnidentifiedPlantGroup } from '@/lib/perennial-harvest';
import TreeAgeEditor from './TreeAgeEditor';

/** Source windows remain references until the farmer confirms the plants and local months. */
export default function TreeSeasonsCard({ groups, unidentified, choices, onChoose }: {
  groups: PlacedTreeGroup[];
  unidentified: UnidentifiedPlantGroup[];
  choices: TreeSeasonChoices;
  onChoose: (speciesId: string, value: NonNullable<TreeSeasonChoices[string]>) => void;
}) {
  const { lang } = useLanguage();
  const t = (source: string, values?: Record<string, string | number>) => cropExportText(source, lang, values);
  if (groups.length === 0 && unidentified.length === 0) return null;
  return <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-tree-seasons>
    <div className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><Trees size={16} aria-hidden /> {t("Fruit, nuts & berries on your map")}</div>
    <p className="font-sans mt-1 mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t("Picking months vary by place and variety. Outlined calendar marks are planning references when established. Confirm months for plants that already give food here to count them in food totals. Plants stay on the printed plan while dates are unknown.")}</p>
    <p className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t("These confirmations are kept on this device for this design.")}</p>
    {isCropExportDraftLanguage(lang) && <p className="font-sans mt-2 mb-2" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('Tree and harvest translations are unreviewed drafts. Some source references remain in English.')}</p>}
    {unidentified.map((g) => <p key={g.speciesId ?? g.defId} className="font-sans mb-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t('{name} · {existing}{proposed} on your map. {check}', { name: g.label, existing: t('{count} existing', { count: g.existing }), proposed: g.proposed ? t(', {count} proposed', { count: g.proposed }) : '', check: g.legalCheck ?? t('Choose the species in the Design Studio; picking dates are not yet known.') })}</p>)}
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const choice = choices[g.harvest.speciesId] ?? { months: [], bearing: false };
        const update = (next: typeof choice) => onChoose(g.harvest.speciesId, next);
        const foodHeld = !isHouseholdFoodHarvest(g.harvest);
        return <details key={g.harvest.speciesId} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <summary className="font-sans font-semibold" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>{g.harvest.name} · {t('{count} existing', { count: g.existing })}{g.proposed ? t(', {count} proposed', { count: g.proposed }) : ''} · {foodHeld ? t('food use needs review') : choice.bearing && choice.months.length ? formatMonthSpan(choice.months, lang) : t('confirm picking months')}</summary>
          {foodHeld ? <p className="font-sans mt-3" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t("Kept as mapped inventory. Check the sourced food-use guidance below before planning household harvest. This plant is held out of ordinary food totals and picking jobs.")}</p> : <>
          <label className="font-sans flex items-start gap-2 mt-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={choice.bearing} disabled={g.existing === 0} onChange={(event) => update({ ...choice, bearing: event.target.checked })} /> {t("All existing plants of this kind already give food here.")}
          </label>
          {g.existing === 0 && <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t("Only proposed plants: no current picking dates.")}</p>}
          <TreeAgeEditor group={g} choice={choice} onChange={update} />
          <div className="font-sans mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t("Tap the months you pick from these plants here:")}</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('{plant} local picking months', { plant: g.harvest.name })}>
            {MONTHS_SHORT.map((name, i) => {
              const on = choice.months.includes(i + 1);
              return <button key={name} type="button" aria-pressed={on} onClick={() => update({ ...choice, months: on ? choice.months.filter((m) => m !== i + 1) : [...choice.months, i + 1].sort((a, b) => a - b) })} className="font-sans rounded-lg" style={{ minWidth: 44, minHeight: 44, fontSize: 12, border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{recordsMonthShort(lang, i + 1)}</button>;
            })}
          </div>
          </>}
          <div className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong>{t(g.referenceMissing ? 'No harvest reference is available in this plan:' : 'Reference seasons — check place and variety:')}</strong>
            {g.harvest.windows.length ? <ul style={{ listStyle: 'disc', paddingInlineStart: 18 }}>
              {g.harvest.windows.map((w, i) => <li key={i}>{productGuideText(w.region, lang)}: {formatMonthSpan(w.months, lang)}. <a href={w.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{w.source.doc}{w.source.page ? `, p. ${w.source.page}` : ''}</a></li>)}
            </ul> : <p>{t(foodHeld ? 'No food picking calendar is assigned while food use needs review.' : 'No picking months are verified in the source record. Local observations can still be recorded above.')}</p>}
          </div>
        </details>;
      })}
    </div>
  </div>;
}

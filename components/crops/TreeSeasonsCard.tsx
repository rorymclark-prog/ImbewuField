'use client';

import { Trees } from 'lucide-react';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { formatMonthSpan, type PlacedTreeGroup, type TreeSeasonChoices, type UnidentifiedPlantGroup } from '@/lib/perennial-harvest';
import TreeAgeEditor from './TreeAgeEditor';

/** Source windows remain references until the farmer confirms the plants and local months. */
export default function TreeSeasonsCard({ groups, unidentified, choices, onChoose }: {
  groups: PlacedTreeGroup[];
  unidentified: UnidentifiedPlantGroup[];
  choices: TreeSeasonChoices;
  onChoose: (speciesId: string, value: NonNullable<TreeSeasonChoices[string]>) => void;
}) {
  if (groups.length === 0 && unidentified.length === 0) return null;
  return <div className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-tree-seasons>
    <div className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><Trees size={16} aria-hidden /> Fruit, nuts &amp; berries on your map</div>
    <p className="font-sans mt-1 mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Picking months vary by place and variety. Outlined calendar marks are planning references when established. Confirm months for plants that already give food here to count them in food totals. Plants stay on the printed plan while dates are unknown.</p>
    <p className="font-sans mb-3" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>These confirmations are kept on this device for this design.</p>
    {unidentified.map((g) => <p key={g.speciesId ?? g.defId} className="font-sans mb-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{g.label} · {g.existing} existing{g.proposed ? `, ${g.proposed} proposed` : ''} on your map. {g.legalCheck ?? 'Choose the species in the Design Studio; picking dates are not yet known.'}</p>)}
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const choice = choices[g.harvest.speciesId] ?? { months: [], bearing: false };
        const update = (next: typeof choice) => onChoose(g.harvest.speciesId, next);
        return <details key={g.harvest.speciesId} style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
          <summary className="font-sans font-semibold" style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-primary)' }}>{g.harvest.name} · {g.existing} existing{g.proposed ? `, ${g.proposed} proposed` : ''} · {choice.bearing && choice.months.length ? formatMonthSpan(choice.months) : 'confirm picking months'}</summary>
          <label className="font-sans flex items-start gap-2 mt-3" style={{ fontSize: 13, color: 'var(--text-primary)' }}>
            <input type="checkbox" checked={choice.bearing} disabled={g.existing === 0} onChange={(event) => update({ ...choice, bearing: event.target.checked })} /> All existing plants of this kind already give food here.
          </label>
          {g.existing === 0 && <p className="font-sans mt-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Only proposed plants: no current picking dates.</p>}
          <TreeAgeEditor group={g} choice={choice} onChange={update} />
          <div className="font-sans mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Tap the months you pick from these plants here:</div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={`${g.harvest.name} local picking months`}>
            {MONTHS_SHORT.map((name, i) => {
              const on = choice.months.includes(i + 1);
              return <button key={name} type="button" aria-pressed={on} onClick={() => update({ ...choice, months: on ? choice.months.filter((m) => m !== i + 1) : [...choice.months, i + 1].sort((a, b) => a - b) })} className="font-sans rounded-lg" style={{ minWidth: 44, minHeight: 44, fontSize: 12, border: `1px solid ${on ? 'var(--emerald)' : 'var(--border)'}`, background: on ? 'var(--bg-2)' : 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>{name}</button>;
            })}
          </div>
          <div className="font-sans mt-3" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong>{g.referenceMissing ? 'No harvest reference is available in this plan:' : 'Reference seasons — check place and variety:'}</strong>
            {g.harvest.windows.length ? <ul style={{ listStyle: 'disc', paddingInlineStart: 18 }}>
              {g.harvest.windows.map((w, i) => <li key={i}>{w.region}: {formatMonthSpan(w.months)}. <a href={w.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{w.source.doc}{w.source.page ? `, p. ${w.source.page}` : ''}</a></li>)}
            </ul> : <p>No picking months are verified in the source record. Local observations can still be recorded above.</p>}
          </div>
        </details>;
      })}
    </div>
  </div>;
}

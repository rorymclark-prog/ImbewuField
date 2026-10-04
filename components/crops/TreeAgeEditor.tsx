'use client';
import { speciesFruitArtworkUrl } from '@/lib/species-art';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { firstCropAgeLabel, formatRange, type PlacedTreeGroup, type TreeAgeGroup, type TreeSeasonChoices } from '@/lib/perennial-harvest';

export default function TreeAgeEditor({ group, choice, onChange }: { group: PlacedTreeGroup; choice: NonNullable<TreeSeasonChoices[string]>; onChange: (next: NonNullable<TreeSeasonChoices[string]>) => void }) {
  const groups = choice.production ?? [];
  const change = (next: TreeAgeGroup[]) => onChange({ ...choice, production: next });
  const edit = (index: number, next: TreeAgeGroup) => change(groups.map((g, i) => i === index ? next : g));
  const assigned = (status: 'existing' | 'proposed') => groups.filter(g => g.status === status).reduce((sum, g) => sum + g.plants, 0);
  const remaining = group.existing + group.proposed - groups.reduce((sum, g) => sum + g.plants, 0);
  const fieldStyle = { background: 'var(--bg-0)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px', minHeight: 44, width: '100%', fontSize: 13 };
  const buttonStyle = { ...fieldStyle, width: 'auto', cursor: 'pointer', padding: '8px 12px' };
  const numericValue = (value: number) => Number.isFinite(value) ? value : '';
  const numeric = (text: string) => text === '' ? NaN : Number(text);
  return <div className="font-sans mt-4" data-tree-age-editor>
    <div className="flex items-center gap-2 font-semibold" style={{ fontSize: 14, color: 'var(--text-primary)' }}>
      {speciesFruitArtworkUrl(group.harvest.speciesId) && <img src={speciesFruitArtworkUrl(group.harvest.speciesId)!} alt="" width={28} height={28} />} Plant ages &amp; future harvest
    </div>
    <p className="mt-1 mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Put plants planted together in one group. Keep older and younger plants separate. Dates and expected kg stay on this device with your picking months.</p>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      {group.harvest.yearsToFirstCrop ? <p>First-crop reference: {firstCropAgeLabel(group.harvest.yearsToFirstCrop.value)} after planting. <a href={group.harvest.yearsToFirstCrop.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Source</a></p> : <p>First-crop age is not sourced. Add a locally checked yield schedule.</p>}
      {group.harvest.yearsToFullBearing && <p>Established production reference: {formatRange(group.harvest.yearsToFullBearing.value)} years. Check the source&apos;s cultivar and conditions. <a href={group.harvest.yearsToFullBearing.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Source</a></p>}
    </div>
    {groups.map((g, index) => <fieldset key={index} className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>Age group {index + 1}</legend>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <label style={{ fontSize: 12 }}>On the map<select aria-label={`${group.harvest.name} group ${index + 1} status`} value={g.status} style={fieldStyle} onChange={e => edit(index, { ...g, status: e.target.value as TreeAgeGroup['status'] })}><option value="existing">Already planted</option><option value="proposed">To be planted</option></select></label>
        <label style={{ fontSize: 12 }}>Number of plants<input aria-label={`${group.harvest.name} group ${index + 1} plants`} type="number" min={1} step={1} value={numericValue(g.plants)} style={fieldStyle} onChange={e => edit(index, { ...g, plants: numeric(e.target.value) })} /></label>
        <label style={{ fontSize: 12 }}>{g.status === 'existing' ? 'Month planted' : 'Intended planting month'}<select aria-label={`${group.harvest.name} group ${index + 1} planting month`} value={g.planted.split('-')[1] ?? ''} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${g.planted.split('-')[0]}-${e.target.value}` })}><option value="">Choose month</option>{MONTHS_SHORT.map((name, month) => <option key={name} value={String(month + 1).padStart(2, '0')}>{name}</option>)}</select></label>
        <label style={{ fontSize: 12 }}>Year planted<select aria-label={`${group.harvest.name} group ${index + 1} planting year`} value={g.planted.split('-')[0]} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${e.target.value}-${g.planted.split('-')[1] ?? ''}` })}><option value="">Choose year</option>{Array.from({ length: new Date().getFullYear() + 11 - 1900 }, (_, i) => new Date().getFullYear() + 10 - i).map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      </div>
      <p className="mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>Expected harvest per plant in a year at each age. Use your records or a nursery&apos;s advice for this site. A value holds until the next age you enter; change it if older plants produce less.</p>
      {g.yields.map((p, i) => <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>Age in years<input aria-label={`${group.harvest.name} group ${index + 1} yield ${i + 1} age`} type="number" min={0} step="any" value={numericValue(p.age)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, age: numeric(e.target.value) } : v) })} /></label>
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>kg / plant / year<input aria-label={`${group.harvest.name} group ${index + 1} yield ${i + 1} kg`} type="number" min={0} step="any" value={numericValue(p.kg)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, kg: numeric(e.target.value) } : v) })} /></label>
        <button type="button" aria-label={`Remove ${group.harvest.name} yield ${i + 1} from group ${index + 1}`} style={buttonStyle} onClick={() => edit(index, { ...g, yields: g.yields.filter((_, j) => j !== i) })}>Remove</button>
      </div>)}
      <div className="flex flex-wrap gap-2 mt-2"><button type="button" style={buttonStyle} onClick={() => edit(index, { ...g, yields: [...g.yields, { age: NaN, kg: NaN }] })}>+ Add age &amp; yield</button><button type="button" style={buttonStyle} onClick={() => change(groups.filter((_, i) => i !== index))}>Remove age group</button></div>
    </fieldset>)}
    {(assigned('existing') > group.existing || assigned('proposed') > group.proposed) && <p role="alert" className="mt-2" style={{ fontSize: 12, color: 'var(--gold)' }}>These groups have more plants than your map. Correct the numbers before using the projection.</p>}
    {remaining > 0 && <p className="mt-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{remaining} plants still need an age group.</p>}
    <button type="button" className="mt-3" style={buttonStyle} onClick={() => change([...groups, { status: assigned('existing') < group.existing ? 'existing' : 'proposed', plants: 1, planted: '', yields: [] }])}>+ Add age group</button>
  </div>;
}

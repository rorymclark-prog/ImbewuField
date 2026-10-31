'use client';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { speciesFruitArtworkUrl } from '@/lib/species-art';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { formatRange, type PlacedTreeGroup, type TreeAgeGroup, type TreeSeasonChoices } from '@/lib/perennial-harvest';

export default function TreeAgeEditor({ group, choice, onChange }: { group: PlacedTreeGroup; choice: NonNullable<TreeSeasonChoices[string]>; onChange: (next: NonNullable<TreeSeasonChoices[string]>) => void }) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  // Same wording as firstCropAgeLabel in lib/perennial-harvest, with the unit word in the reader's language.
  const firstCropAge = (range: [number, number]) => range[1] < 2
    ? inlineTemplate(lang, '{n} months', null, { n: formatRange([Math.round(range[0] * 12), Math.round(range[1] * 12)]) })
    : inlineTemplate(lang, '{n} years', null, { n: formatRange(range) });
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
      {speciesFruitArtworkUrl(group.harvest.speciesId) && <img src={speciesFruitArtworkUrl(group.harvest.speciesId)!} alt="" width={28} height={28} />} {ui('Plant ages & future harvest')}
    </div>
    <p className="mt-1 mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{ui('Put plants planted together in one group. Keep older and younger plants separate. Dates and expected kg stay on this device with your picking months.')}</p>
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      {group.harvest.yearsToFirstCrop ? <p>{inlineTemplate(lang, 'First-crop reference: {age} after planting.', null, { age: firstCropAge(group.harvest.yearsToFirstCrop.value) })} <a href={group.harvest.yearsToFirstCrop.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{ui('Source')}</a></p> : <p>{ui('First-crop age is not sourced. Add a locally checked yield schedule.')}</p>}
      {group.harvest.yearsToFullBearing && <p>{inlineTemplate(lang, "Established production reference: {range} years. Check the source's cultivar and conditions.", null, { range: formatRange(group.harvest.yearsToFullBearing.value) })} <a href={group.harvest.yearsToFullBearing.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{ui('Source')}</a></p>}
      {(group.harvest.yieldKgPerTree || group.harvest.supplementaryReferences?.length || group.harvest.yearsToFirstCrop?.note || group.harvest.yearsToFullBearing?.note) && <details className="mt-2 p-3 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, minHeight: 44, display: 'list-item', paddingTop: 10 }}>{ui('Age & production references')}</summary>
        <p className="mt-2">{ui('Check variety, planting stock, site and units before using a reference. Your entered kg schedule supplies the projection.')}</p>
        {group.harvest.yearsToFirstCrop?.note && <p className="mt-2"><strong>{ui('First crop:')}</strong> {ui(group.harvest.yearsToFirstCrop.note)}</p>}
        {group.harvest.yearsToFullBearing?.note && <p className="mt-2"><strong>{ui('Established production:')}</strong> {ui(group.harvest.yearsToFullBearing.note)}</p>}
        {group.harvest.yieldKgPerTree && <p className="mt-2"><strong>{ui('Source production:')}</strong> {formatRange(group.harvest.yieldKgPerTree.value)} kg/plant. {group.harvest.yieldKgPerTree.note ? ui(group.harvest.yieldKgPerTree.note) : ''} <a href={group.harvest.yieldKgPerTree.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{ui('Source')}</a></p>}
        {group.harvest.supplementaryReferences?.map((reference, index) => <p key={index} className="mt-2"><strong>{ui(reference.title)}:</strong> {ui(reference.note)} <a href={reference.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{ui('Source')}{reference.source.page ? ` p. ${reference.source.page}` : ''}</a></p>)}
      </details>}
    </div>
    {groups.map((g, index) => <fieldset key={index} className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{inlineTemplate(lang, 'Age group {n}', null, { n: index + 1 })}</legend>
      <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <label style={{ fontSize: 12 }}>{ui('On the map')}<select aria-label={inlineTemplate(lang, '{name} group {n} status', null, { name: group.harvest.name, n: index + 1 })} value={g.status} style={fieldStyle} onChange={e => edit(index, { ...g, status: e.target.value as TreeAgeGroup['status'] })}><option value="existing">{ui('Already planted')}</option><option value="proposed">{ui('To be planted')}</option></select></label>
        <label style={{ fontSize: 12 }}>{ui('Number of plants')}<input aria-label={inlineTemplate(lang, '{name} group {n} plants', null, { name: group.harvest.name, n: index + 1 })} type="number" min={1} step={1} value={numericValue(g.plants)} style={fieldStyle} onChange={e => edit(index, { ...g, plants: numeric(e.target.value) })} /></label>
        <label style={{ fontSize: 12 }}>{g.status === 'existing' ? ui('Month planted') : ui('Intended planting month')}<select aria-label={inlineTemplate(lang, '{name} group {n} planting month', null, { name: group.harvest.name, n: index + 1 })} value={g.planted.split('-')[1] ?? ''} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${g.planted.split('-')[0]}-${e.target.value}` })}><option value="">{ui('Choose month')}</option>{MONTHS_SHORT.map((name, month) => <option key={name} value={String(month + 1).padStart(2, '0')}>{name}</option>)}</select></label>
        <label style={{ fontSize: 12 }}>{ui('Year planted')}<select aria-label={inlineTemplate(lang, '{name} group {n} planting year', null, { name: group.harvest.name, n: index + 1 })} value={g.planted.split('-')[0]} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${e.target.value}-${g.planted.split('-')[1] ?? ''}` })}><option value="">{ui('Choose year')}</option>{Array.from({ length: new Date().getFullYear() + 11 - 1900 }, (_, i) => new Date().getFullYear() + 10 - i).map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      </div>
      <p className="mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{ui("Expected harvest per plant in a year at each age. Use your records or a nursery's advice for this site. A value holds until the next age you enter; change it if older plants produce less.")}</p>
      {g.yields.map((p, i) => <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>{ui('Age in years')}<input aria-label={inlineTemplate(lang, '{name} group {n} yield {i} age', null, { name: group.harvest.name, n: index + 1, i: i + 1 })} type="number" min={0} step="any" value={numericValue(p.age)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, age: numeric(e.target.value) } : v) })} /></label>
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>{ui('kg / plant / year')}<input aria-label={inlineTemplate(lang, '{name} group {n} yield {i} kg', null, { name: group.harvest.name, n: index + 1, i: i + 1 })} type="number" min={0} step="any" value={numericValue(p.kg)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, kg: numeric(e.target.value) } : v) })} /></label>
        <button type="button" aria-label={inlineTemplate(lang, 'Remove {name} yield {i} from group {n}', null, { name: group.harvest.name, i: i + 1, n: index + 1 })} style={buttonStyle} onClick={() => edit(index, { ...g, yields: g.yields.filter((_, j) => j !== i) })}>{ui('Remove')}</button>
      </div>)}
      <div className="flex flex-wrap gap-2 mt-2"><button type="button" style={buttonStyle} onClick={() => edit(index, { ...g, yields: [...g.yields, { age: NaN, kg: NaN }] })}>{ui('+ Add age & yield')}</button><button type="button" style={buttonStyle} onClick={() => change(groups.filter((_, i) => i !== index))}>{ui('Remove age group')}</button></div>
    </fieldset>)}
    {(assigned('existing') > group.existing || assigned('proposed') > group.proposed) && <p role="alert" className="mt-2" style={{ fontSize: 12, color: 'var(--gold)' }}>{ui('These groups have more plants than your map. Correct the numbers before using the projection.')}</p>}
    {remaining > 0 && <p className="mt-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{inlineTemplate(lang, '{n} plants still need an age group.', null, { n: remaining })}</p>}
    <button type="button" className="mt-3" style={buttonStyle} onClick={() => change([...groups, { status: assigned('existing') < group.existing ? 'existing' : 'proposed', plants: 1, planted: '', yields: [] }])}>{ui('+ Add age group')}</button>
  </div>;
}

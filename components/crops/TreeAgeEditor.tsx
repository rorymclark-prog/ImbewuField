'use client';
import { useLanguage } from '@/lib/i18n';
import { cropExportText, isCropExportDraftLanguage } from '@/lib/crop-export-copy';
import { productGuideText } from '@/lib/production-product-guidance';
import { recordsMonthShort } from '@/lib/records-months';
import { speciesFruitArtworkUrl } from '@/lib/species-art';
import { MONTHS_SHORT } from '@/lib/crop-catalog';
import { firstCropAgeLabel, formatRange, type PlacedTreeGroup, type TreeAgeGroup, type TreeSeasonChoices } from '@/lib/perennial-harvest';

export default function TreeAgeEditor({ group, choice, onChange }: { group: PlacedTreeGroup; choice: NonNullable<TreeSeasonChoices[string]>; onChange: (next: NonNullable<TreeSeasonChoices[string]>) => void }) {
  const { lang } = useLanguage();
  const t = (source: string, values?: Record<string, string | number>) => cropExportText(source, lang, values);
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
      {speciesFruitArtworkUrl(group.harvest.speciesId) && <img src={speciesFruitArtworkUrl(group.harvest.speciesId)!} alt="" width={28} height={28} />} {t("Plant ages & future harvest")}
    </div>
    <p className="mt-1 mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t("Put plants planted together in one group. Keep older and younger plants separate. Dates and expected kg stay on this device with your picking months.")}</p>
    {isCropExportDraftLanguage(lang) && <p className="font-sans mt-2 mb-2" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('Tree and harvest translations are unreviewed drafts. Some source references remain in English.')}</p>}
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
      {group.harvest.yearsToFirstCrop ? <p>{t('First-crop reference: {age} after planting.', { age: firstCropAgeLabel(group.harvest.yearsToFirstCrop.value, (age, unit) => productGuideText(`{age} ${unit}`, lang, { age })) })} <a href={group.harvest.yearsToFirstCrop.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{t('Source')}</a></p> : <p>{t("First-crop age is not sourced. Add a locally checked yield schedule.")}</p>}
      {group.harvest.yearsToFullBearing && <p>{t("Established production reference: {age} years. Check the source's cultivar and conditions.", { age: formatRange(group.harvest.yearsToFullBearing.value) })} <a href={group.harvest.yearsToFullBearing.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{t('Source')}</a></p>}
      {(group.harvest.yieldKgPerTree || group.harvest.supplementaryReferences?.length || group.harvest.yearsToFirstCrop?.note || group.harvest.yearsToFullBearing?.note) && <details className="mt-2 p-3 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
        <summary style={{ cursor: 'pointer', color: 'var(--text-primary)', fontWeight: 600, minHeight: 44, display: 'list-item', paddingTop: 10 }}>{t("Age & production references")}</summary>
        <p className="mt-2">{t("Check variety, planting stock, site and units before using a reference. Your entered kg schedule supplies the projection.")}</p>
        {group.harvest.yearsToFirstCrop?.note && <p className="mt-2"><strong>{t("First crop:")}</strong> {productGuideText(group.harvest.yearsToFirstCrop.note, lang)}</p>}
        {group.harvest.yearsToFullBearing?.note && <p className="mt-2"><strong>{t("Established production:")}</strong> {productGuideText(group.harvest.yearsToFullBearing.note, lang)}</p>}
        {group.harvest.yieldKgPerTree && <p className="mt-2"><strong>{t("Source production:")}</strong> {t('{range} kg/plant.', { range: formatRange(group.harvest.yieldKgPerTree.value) })} {group.harvest.yieldKgPerTree.note && productGuideText(group.harvest.yieldKgPerTree.note, lang)} <a href={group.harvest.yieldKgPerTree.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{t('Source')}</a></p>}
        {group.harvest.supplementaryReferences?.map((reference, index) => <p key={index} className="mt-2"><strong>{productGuideText(reference.title, lang)}:</strong> {productGuideText(reference.note, lang)} <a href={reference.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{t('Source')}{reference.source.page ? ` p. ${reference.source.page}` : ''}</a></p>)}
      </details>}
    </div>
    {groups.map((g, index) => <fieldset key={index} className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
      <legend style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t('Age group {number}', { number: index + 1 })}</legend>
      <div className="grid gap-3" style={{ gridTemplateColumns: isCropExportDraftLanguage(lang) ? 'repeat(auto-fit, minmax(180px, 1fr))' : 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        <label style={{ fontSize: 12 }}>{t("On the map")}<select aria-label={t('{plant} group {number} status', { plant: group.harvest.name, number: index + 1 })} value={g.status} style={fieldStyle} onChange={e => edit(index, { ...g, status: e.target.value as TreeAgeGroup['status'] })}><option value="existing">{t("Already planted")}</option><option value="proposed">{t("To be planted")}</option></select></label>
        <label style={{ fontSize: 12 }}>{t("Number of plants")}<input aria-label={t('{plant} group {number} plants', { plant: group.harvest.name, number: index + 1 })} type="number" min={1} step={1} value={numericValue(g.plants)} style={fieldStyle} onChange={e => edit(index, { ...g, plants: numeric(e.target.value) })} /></label>
        <label style={{ fontSize: 12 }}>{t(g.status === 'existing' ? 'Month planted' : 'Intended planting month')}<select aria-label={t('{plant} group {number} planting month', { plant: group.harvest.name, number: index + 1 })} value={g.planted.split('-')[1] ?? ''} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${g.planted.split('-')[0]}-${e.target.value}` })}><option value="">{t("Choose month")}</option>{MONTHS_SHORT.map((name, month) => <option key={name} value={String(month + 1).padStart(2, '0')}>{recordsMonthShort(lang, month + 1)}</option>)}</select></label>
        <label style={{ fontSize: 12 }}>{t("Year planted")}<select aria-label={t('{plant} group {number} planting year', { plant: group.harvest.name, number: index + 1 })} value={g.planted.split('-')[0]} style={fieldStyle} onChange={e => edit(index, { ...g, planted: `${e.target.value}-${g.planted.split('-')[1] ?? ''}` })}><option value="">{t("Choose year")}</option>{Array.from({ length: new Date().getFullYear() + 11 - 1900 }, (_, i) => new Date().getFullYear() + 10 - i).map(year => <option key={year} value={year}>{year}</option>)}</select></label>
      </div>
      <p className="mt-3 mb-2" style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{t("Expected harvest per plant in a year at each age. Use your records or a nursery's advice for this site. A value holds until the next age you enter; change it if older plants produce less.")}</p>
      {g.yields.map((p, i) => <div key={i} className="flex flex-wrap items-end gap-2 mb-2">
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>{t("Age in years")}<input aria-label={t('{plant} group {number} yield {yield} age', { plant: group.harvest.name, number: index + 1, yield: i + 1 })} type="number" min={0} step="any" value={numericValue(p.age)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, age: numeric(e.target.value) } : v) })} /></label>
        <label style={{ fontSize: 12, flex: '1 1 90px' }}>{t("kg / plant / year")}<input aria-label={t('{plant} group {number} yield {yield} kg', { plant: group.harvest.name, number: index + 1, yield: i + 1 })} type="number" min={0} step="any" value={numericValue(p.kg)} style={fieldStyle} onChange={e => edit(index, { ...g, yields: g.yields.map((v, j) => j === i ? { ...v, kg: numeric(e.target.value) } : v) })} /></label>
        <button type="button" aria-label={t('Remove {plant} yield {yield} from group {number}', { plant: group.harvest.name, number: index + 1, yield: i + 1 })} style={buttonStyle} onClick={() => edit(index, { ...g, yields: g.yields.filter((_, j) => j !== i) })}>{t("Remove")}</button>
      </div>)}
      <div className="flex flex-wrap gap-2 mt-2"><button type="button" style={buttonStyle} onClick={() => edit(index, { ...g, yields: [...g.yields, { age: NaN, kg: NaN }] })}>{t("+ Add age & yield")}</button><button type="button" style={buttonStyle} onClick={() => change(groups.filter((_, i) => i !== index))}>{t("Remove age group")}</button></div>
    </fieldset>)}
    {(assigned('existing') > group.existing || assigned('proposed') > group.proposed) && <p role="alert" className="mt-2" style={{ fontSize: 12, color: 'var(--gold)' }}>{t("These groups have more plants than your map. Correct the numbers before using the projection.")}</p>}
    {remaining > 0 && <p className="mt-2" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('{count} plants still need an age group.', { count: remaining })}</p>}
    <button type="button" className="mt-3" style={buttonStyle} onClick={() => change([...groups, { status: assigned('existing') < group.existing ? 'existing' : 'proposed', plants: 1, planted: '', yields: [] }])}>{t("+ Add age group")}</button>
  </div>;
}

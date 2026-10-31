'use client';
import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { speciesFruitArtworkUrl } from '@/lib/species-art';
import { projectedKgLabel, projectionText, type ProductionProjection } from '@/lib/production-projection';

export default function ProductionProjectionCard({ projection }: { projection: ProductionProjection }) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  const [selected, setSelected] = useState(0);
  const maximum = Math.max(1, ...projection.years.map(y => y.combinedKg?.[1] ?? y.treeKg[1]).filter(Number.isFinite));
  const width = (kg: number) => Number.isFinite(kg) ? `${Math.max(0, Math.min(1, kg / maximum)) * 100}%` : '0%';
  const year = projection.years[selected] ?? projection.years[0];
  if (!year) return null;
  return <section className="mt-4 rounded-2xl p-4 font-sans" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-production-projection>
    <h2 className="font-display font-semibold flex items-center gap-2" style={{ fontSize: 17, color: 'var(--text-primary)' }}><TrendingUp size={20} /> {ui('How production changes as plants grow')}</h2>
    <p className="mt-1 mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{ui('The next ten years, starting this month. Add planting dates and expected yields under each plant above. Missing yields remain visible; young trees do not receive a mature-tree yield.')}</p>
    <div className="flex flex-wrap gap-3 mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span><span style={{ color: 'var(--emerald)' }}>●</span> {ui('Vegetables & staples')}</span><span><span style={{ color: 'var(--gold)' }}>●</span> {ui('Fruit, nuts & berries')}</span><span>{ui('Numbers are projections in kg')}</span></div>
    <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 260 }}>
      {projection.years.map((y, i) => <button key={y.label} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)} className="grid gap-2 items-center w-full rounded-lg px-2 py-2 text-left" style={{ gridTemplateColumns: '85px 1fr 100px', background: i === selected ? 'var(--bg-2)' : 'transparent', border: 'none', minHeight: 44, cursor: 'pointer', color: 'var(--text-primary)' }}>
        <span style={{ fontSize: 12, fontWeight: i === selected ? 700 : 400 }}>{y.label.split(' – ')[0]}</span>
        <span className="flex rounded-full overflow-hidden" style={{ height: 14, background: 'var(--border)', position: 'relative' }}><span style={{ width: width(y.vegetableKg ?? 0), background: 'var(--emerald)' }} /><span style={{ width: width(y.treeKg[0]), background: 'var(--gold)', opacity: 0.75 }} /><span style={{ width: width(y.treeKg[1] - y.treeKg[0]), background: 'repeating-linear-gradient(135deg, var(--gold) 0 2px, transparent 2px 5px)' }} /></span>
        <span style={{ fontSize: 11, textAlign: 'right' }}>{y.trees.some(tree => tree.numericOverflow) ? ui('Check quantities') : y.combinedKg ? projectedKgLabel(y.combinedKg) : ui('Check beds')}{y.partial ? ' *' : ''}</span>
      </button>)}
    </div></div>
    <p className="mt-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{ui('* Known subtotal only. Missing production is not zero. Striped ends show harvest that changes as plants age during the year.')}</p>
    <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{year.label}</h3>
      <p className="mt-2" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{ui('Vegetables & staples:')} {year.vegetableKg === null ? ui('Resolve bed conflicts') : inlineTemplate(lang, '{kg} from cycles starting harvest in this period', null, { kg: projectedKgLabel([year.vegetableKg, year.vegetableKg]) })}</p>
      {year.vegetableMissing.length > 0 && <p style={{ fontSize: 12, color: 'var(--gold)' }}>{inlineTemplate(lang, 'Not quantified: {items}', null, { items: year.vegetableMissing.map((item) => projectionText(lang, item)).join('; ') })}</p>}
      {year.trees.map(tree => <div key={tree.speciesId} className="flex items-start gap-2 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {speciesFruitArtworkUrl(tree.speciesId) && <img src={speciesFruitArtworkUrl(tree.speciesId)!} alt="" width={32} height={32} />}
        <div style={{ minWidth: 0, flex: 1, color: 'var(--text-primary)' }}><div className="flex flex-wrap justify-between gap-1" style={{ fontSize: 13, fontWeight: 600 }}><span>{tree.name} · {tree.plants} {tree.plants === 1 ? ui('plant') : ui('plants')}</span><span>{tree.kg ? projectedKgLabel(tree.kg) : tree.knownKg[1] > 0 ? inlineTemplate(lang, '{kg} known + missing yields', null, { kg: projectedKgLabel(tree.knownKg) }) : ui('Needs information')}</span></div><p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{projectionText(lang, tree.ages)} · {projectionText(lang, tree.stage)}</p>{tree.missing.length > 0 && <p style={{ fontSize: 12, color: 'var(--gold)' }}>{tree.missing.map((item) => projectionText(lang, item)).join('; ')}</p>}</div>
      </div>)}
    </div>
    <details className="mt-3" style={{ color: 'var(--text-secondary)', fontSize: 12 }}><summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 12 }}>{ui('What the projection assumes')}</summary>{projection.assumptions.map(note => <p key={note} className="mt-2" style={{ lineHeight: 1.5 }}>{projectionText(lang, note)}</p>)}</details>
  </section>;
}

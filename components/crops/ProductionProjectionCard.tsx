'use client';
import {useLanguage} from '@/lib/i18n';
import {cropExportText,isCropExportDraftLanguage,cropProjectionPeriodText,cropProjectionDetailText,cropProjectionAgeText} from '@/lib/crop-export-copy';


import { useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { speciesFruitArtworkUrl } from '@/lib/species-art';
import { projectedKgLabel, type ProductionProjection } from '@/lib/production-projection';

export default function ProductionProjectionCard({ projection }: { projection: ProductionProjection }) {
  const {lang}=useLanguage();
  const t=(source:string,values:Record<string,string|number>={})=>cropExportText(source,lang,values);
  const [selected, setSelected] = useState(0);
  const maximum = Math.max(1, ...projection.years.map(y => y.combinedKg?.[1] ?? y.treeKg[1]).filter(Number.isFinite));
  const width = (kg: number) => Number.isFinite(kg) ? `${Math.max(0, Math.min(1, kg / maximum)) * 100}%` : '0%';
  const year = projection.years[selected] ?? projection.years[0];
  if (!year) return null;
  return <section className="mt-4 rounded-2xl p-4 font-sans" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} data-production-projection>
    {isCropExportDraftLanguage(lang)&&<p data-production-translation-draft="true" className="font-sans" style={{fontSize:11.5,color:'var(--text-muted)',lineHeight:1.5}}>{t('Production and food-record translations are unreviewed drafts.')}</p>}
    <h2 className="font-display font-semibold flex items-center gap-2" style={{ fontSize: 17, color: 'var(--text-primary)' }}><TrendingUp size={20} />{" "+t("How production changes as plants grow")}</h2>
    <p className="mt-1 mb-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t("The next ten years, starting this month. Add planting dates and expected yields under each plant above. Missing yields remain visible; young trees do not receive a mature-tree yield.")}</p>
    <div className="flex flex-wrap gap-3 mb-3" style={{ fontSize: 12, color: 'var(--text-secondary)' }}><span><span style={{ color: 'var(--emerald)' }}>●</span>{" "+t("Vegetables & staples")}</span><span><span style={{ color: 'var(--gold)' }}>●</span>{" "+t("Fruit, nuts & berries")}</span><span>{t("Numbers are projections in kg")}</span></div>
    <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 260 }}>
      {projection.years.map((y, i) => <button key={y.label} type="button" aria-pressed={i === selected} onClick={() => setSelected(i)} className="grid gap-2 items-center w-full rounded-lg px-2 py-2 text-left" style={{ gridTemplateColumns: '85px 1fr 100px', background: i === selected ? 'var(--bg-2)' : 'transparent', border: 'none', minHeight: 44, cursor: 'pointer', color: 'var(--text-primary)' }}>
        <span style={{ fontSize: 12, fontWeight: i === selected ? 700 : 400 }}>{cropProjectionPeriodText(y.label,lang).split(' – ')[0]}</span>
        <span className="flex rounded-full overflow-hidden" style={{ height: 14, background: 'var(--border)', position: 'relative' }}><span style={{ width: width(y.vegetableKg ?? 0), background: 'var(--emerald)' }} /><span style={{ width: width(y.treeKg[0]), background: 'var(--gold)', opacity: 0.75 }} /><span style={{ width: width(y.treeKg[1] - y.treeKg[0]), background: 'repeating-linear-gradient(135deg, var(--gold) 0 2px, transparent 2px 5px)' }} /></span>
        <span style={{ fontSize: 11, textAlign: 'right' }}>{y.trees.some(tree => tree.numericOverflow) ? t("Check quantities") : y.combinedKg ? projectedKgLabel(y.combinedKg) : t("Check beds")}{y.partial ? ' *' : ''}</span>
      </button>)}
    </div></div>
    <p className="mt-2" style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t("* Known subtotal only. Missing production is not zero. Striped ends show harvest that changes as plants age during the year.")}</p>
    <div className="mt-4 rounded-xl p-3" style={{ background: 'var(--bg-0)', border: '1px solid var(--border)' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{cropProjectionPeriodText(year.label,lang)}</h3>
      <p className="mt-2" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{t("Vegetables & staples:")+" "}{year.vegetableKg === null ? t("Resolve bed conflicts") : t('{amount} from cycles starting harvest in this period',{amount:projectedKgLabel([year.vegetableKg,year.vegetableKg])})}</p>
      {year.vegetableMissing.length > 0 && <p style={{ fontSize: 12, color: 'var(--gold)' }}>{t("Not quantified:")+" "}{year.vegetableMissing.map(value=>value==='Resolve double-booked beds'?t(value):value).join('; ')}</p>}
      {year.trees.map(tree => <div key={tree.speciesId} className="flex items-start gap-2 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        {speciesFruitArtworkUrl(tree.speciesId) && <img src={speciesFruitArtworkUrl(tree.speciesId)!} alt="" width={32} height={32} />}
        <div style={{ minWidth: 0, flex: 1, color: 'var(--text-primary)' }}><div className="flex flex-wrap justify-between gap-1" style={{ fontSize: 13, fontWeight: 600 }}><span>{tree.name} · {t(tree.plants===1?'{count} plant':'{count} plants',{count:tree.plants})}</span><span>{tree.kg ? projectedKgLabel(tree.kg) : tree.knownKg[1] > 0 ? t('{amount} known + missing yields',{amount:projectedKgLabel(tree.knownKg)}) : t("Needs information")}</span></div><p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{cropProjectionAgeText(tree.ages,lang)} · {tree.stage.split('; ').map(stage=>cropProjectionDetailText(stage,lang)).join('; ')}</p>{tree.missing.length > 0 && <p style={{ fontSize: 12, color: 'var(--gold)' }}>{tree.missing.map(value=>cropProjectionDetailText(value,lang)).join('; ')}</p>}</div>
      </div>)}
    </div>
    <details className="mt-3" style={{ color: 'var(--text-secondary)', fontSize: 12 }}><summary style={{ cursor: 'pointer', minHeight: 44, paddingTop: 12 }}>{t("What the projection assumes")}</summary>{projection.assumptions.map(note => <p key={note} className="mt-2" style={{ lineHeight: 1.5 }}>{cropProjectionDetailText(note,lang)}</p>)}</details>
  </section>;
}

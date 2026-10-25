'use client';

import { ClipboardList } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { inlineText, inlineTemplate } from '@/lib/xh-inline';
import { productionGuideText, type ProductionGuide, type ProductionGuideItem } from '@/lib/crop-export-schedule';
import { growingAreaText } from '@/lib/growing-zones';

function GuideBody({ item, lines = item.lines }: { item: ProductionGuideItem; lines?: string[] }) {
  const { lang } = useLanguage();
  return <>
    {lines.map((line) => <p key={line} className="font-sans mt-1" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{productionGuideText(lang, line)}</p>)}
    {!!item.sources?.length && <ul className="font-sans mt-1" style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', listStyle: 'disc', paddingInlineStart: 18 }}>
      {item.sources.map((source) => <li key={`${source.label}:${source.url}`}>
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{source.label}</a> : source.label}
      </li>)}
    </ul>}
  </>;
}

/** `named`: the title is a crop or plant name, which stays as the catalogue spells it. */
function GuideItem({ item, product = false, named = false }: { item: ProductionGuideItem; product?: boolean; named?: boolean }) {
  const { lang } = useLanguage();
  return <div className="py-2" style={{ borderTop: '1px solid var(--border)' }}>
    <h4 className="font-sans font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{named ? item.title : productionGuideText(lang, item.title)}</h4>
    {item.expectedSeason && <div className="my-2" role="img" aria-label={`${productionGuideText(lang, item.expectedSeason.label)}: ${item.expectedSeason.months.map(m => ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]).join(', ')}. ${productionGuideText(lang, item.expectedSeason.basis)}`}>
      <p className="font-sans text-xs mb-2">{productionGuideText(lang, item.expectedSeason.label)} · {inlineText(lang, 'expected when established')}</p>
      <div className="grid grid-cols-12 gap-0.5">{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((label, i) => <div key={i} className="text-center font-sans text-xs rounded py-2" style={{ background: item.expectedSeason!.months.includes(i + 1) ? 'var(--emerald)' : 'var(--bg-2)', color: item.expectedSeason!.months.includes(i + 1) ? 'white' : 'var(--text-secondary)' }}>{label}</div>)}</div>
    </div>}
    {product && <p className="font-sans mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{productionGuideText(lang, item.lines[0])}</p>}
    {product ? <details>
      <summary className="font-sans text-sm py-3 cursor-pointer" style={{ minHeight: 44 }}>{inlineText(lang, 'Care and what to buy')}</summary>
      <GuideBody item={item} lines={item.lines.slice(1)} />
    </details> : <GuideBody item={item} />}

  </div>;
}

/** These facts belong to the site survey; saving a crop plan must not silently answer them. */
export default function ProductionGuideCard({ guide, canSurvey, onSurvey }: {
  guide: ProductionGuide;
  canSurvey: boolean;
  onSurvey: () => void;
}) {
  const { lang } = useLanguage();
  const ui = (english: string) => inlineText(lang, english);
  return <section className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} aria-labelledby="production-guide-heading" data-production-guide>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="production-guide-heading" className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><ClipboardList size={16} aria-hidden /> {ui('Check your farm conditions')}</h3>
      <button type="button" onClick={onSurvey} disabled={!canSurvey} className="font-sans px-3 rounded-lg" style={{ minHeight: 44, fontSize: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: canSurvey ? 1 : 0.6 }}>{ui('Update site survey')}</button>
    </div>
    <p className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{inlineTemplate(lang, 'Climate area: {area}.', null, { area: growingAreaText(lang, guide.area) })} {canSurvey ? ui('Your survey supplies the observations below.') : ui('Choose a mapped site before recording farm observations.')}</p>
    {!!guide.foodForest?.length && <div className="mt-4" data-product-guidance="food-forest">
      <h3 className="font-display text-lg font-semibold">{ui('Fruit, nuts and indigenous foods')}</h3>
      <p className="font-sans text-xs my-2" style={{ color: 'var(--text-secondary)' }}>{ui('Bars use a labelled variety assumption or regional reference. New plants need time to produce. Only locally confirmed months enter your food totals.')}</p>
      {guide.foodForest.map((item, i) => <GuideItem key={`${item.title}:${i}`} item={item} product named />)}
    </div>}
    {!!guide.animalProducts?.length && <div className="mt-4" data-product-guidance="animals">
      <h3 className="font-display text-lg font-semibold">{ui('Animal products')}</h3>
      {guide.animalProducts.map(item => <GuideItem key={item.title} item={item} product />)}
    </div>}
    {guide.siteObservations.map((item) => <GuideItem key={item.title} item={item} />)}
    {guide.cropChoices.length > 0 && <details className="mt-3">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>{inlineTemplate(lang, guide.cropChoices.length === 1 ? 'Crop varieties to check locally ({n} crop)' : 'Crop varieties to check locally ({n} crops)', null, { n: guide.cropChoices.length })}</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{ui('Research groupings can infer climate fit. Confirm the season, soil, water and current stock with a local grower or extension officer. A recorded variety does not change this plan’s crop timing.')}</p>
      {guide.cropChoices.map((item) => <GuideItem key={item.title} item={item} named />)}
    </details>}
    {guide.recordedProduction.length > 0 && <details className="mt-2">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>{ui('Past production recorded in your survey')}</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{ui('Use these records to compare with what you actually collect. They do not predict the coming year or set picking dates.')}</p>
      {guide.recordedProduction.map((item, i) => <GuideItem key={`${item.title}:${i}`} item={item} />)}
    </details>}
  </section>;
}

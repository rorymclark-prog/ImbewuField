'use client';
import { useLanguage } from '@/lib/i18n';
import { cropExportText, isCropExportDraftLanguage } from '@/lib/crop-export-copy';
import { productGuideText } from '@/lib/production-product-guidance';
import { recordsMonthShort } from '@/lib/records-months';

import { ClipboardList } from 'lucide-react';
import type { ProductionGuide, ProductionGuideItem } from '@/lib/crop-export-schedule';

function GuideBody({ item, lines = item.lines }: { item: ProductionGuideItem; lines?: string[] }) {
  return <>
    {lines.map((line) => <p key={line} className="font-sans mt-1" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</p>)}
    {!!item.sources?.length && <ul className="font-sans mt-1" style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', listStyle: 'disc', paddingInlineStart: 18 }}>
      {item.sources.map((source) => <li key={`${source.label}:${source.url}`}>
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{source.label}</a> : source.label}
      </li>)}
    </ul>}
  </>;
}

function GuideItem({ item, product = false }: { item: ProductionGuideItem; product?: boolean }) {
  const { lang } = useLanguage();
  const t = (source: string, values?: Record<string, string | number>) => cropExportText(source, lang, values);
  return <div className="py-2" style={{ borderTop: '1px solid var(--border)' }}>
    <h4 className="font-sans font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.title}</h4>
    {item.expectedSeason && <div className="my-2" role="img" aria-label={`${item.expectedSeason.label}: ${item.expectedSeason.months.map(m => recordsMonthShort(lang, m)).join(', ')}. ${item.expectedSeason.basis}`}>
      <p className="font-sans text-xs mb-2">{t('{label} · expected when established', { label: item.expectedSeason.label })}</p>
      <div className={isCropExportDraftLanguage(lang) ? "grid grid-cols-6 sm:grid-cols-12 gap-0.5" : "grid grid-cols-12 gap-0.5"}>{['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((_, i) => <div key={i} className="text-center font-sans text-xs rounded py-2" style={{ background: item.expectedSeason!.months.includes(i + 1) ? 'var(--emerald)' : 'var(--bg-2)', color: item.expectedSeason!.months.includes(i + 1) ? 'white' : 'var(--text-secondary)' }}>{recordsMonthShort(lang, i + 1)}</div>)}</div>
    </div>}
    {product && <p className="font-sans mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{item.lines[0]}</p>}
    {product ? <details>
      <summary className="font-sans text-sm py-3 cursor-pointer" style={{ minHeight: 44 }}>{t("Care and what to buy")}</summary>
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
  const t = (source: string, values?: Record<string, string | number>) => cropExportText(source, lang, values);
  return <section className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} aria-labelledby="production-guide-heading" data-production-guide>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="production-guide-heading" className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><ClipboardList size={16} aria-hidden /> {t("Check your farm conditions")}</h3>
      <button type="button" onClick={onSurvey} disabled={!canSurvey} className="font-sans px-3 rounded-lg" style={{ minHeight: 44, fontSize: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: canSurvey ? 1 : 0.6 }}>{t("Update site survey")}</button>
    </div>
    <p className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t('Climate area: {area}. {observation}', { area: guide.area, observation: t(canSurvey ? 'Your survey supplies the observations below.' : 'Choose a mapped site before recording farm observations.') })}</p>
    {isCropExportDraftLanguage(lang) && <p className="font-sans mt-2 mb-2" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('Tree and harvest translations are unreviewed drafts. Some source references remain in English.')}</p>}
    {!!guide.foodForest?.length && <div className="mt-4" data-product-guidance="food-forest">
      <h3 className="font-display text-lg font-semibold">{t("Fruit, nuts and indigenous foods")}</h3>
      <p className="font-sans text-xs my-2" style={{ color: 'var(--text-secondary)' }}>{t("Bars use a labelled variety assumption or regional reference. New plants need time to produce. Only locally confirmed months enter your food totals.")}</p>
      {guide.foodForest.map((item, i) => <GuideItem key={`${item.title}:${i}`} item={item} product />)}
    </div>}
    {!!guide.animalProducts?.length && <div className="mt-4" data-product-guidance="animals">
      <h3 className="font-display text-lg font-semibold">{t("Animal products")}</h3>
      {guide.animalProducts.map(item => <GuideItem key={item.title} item={item} product />)}
    </div>}
    {guide.siteObservations.map((item) => <GuideItem key={item.title} item={item} />)}
    {guide.cropChoices.length > 0 && <details className="mt-3">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>{t('Crop varieties to check locally ({count} {unit})', { count: guide.cropChoices.length, unit: t(guide.cropChoices.length === 1 ? 'crop' : 'crops') })}</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t("Research groupings can infer climate fit. Confirm the season, soil, water and current stock with a local grower or extension officer. A recorded variety does not change this plan’s crop timing.")}</p>
      {guide.cropChoices.map((item) => <GuideItem key={item.title} item={item} />)}
    </details>}
    {guide.recordedProduction.length > 0 && <details className="mt-2">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>{t("Past production recorded in your survey")}</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{t("Use these records to compare with what you actually collect. They do not predict the coming year or set picking dates.")}</p>
      {guide.recordedProduction.map((item, i) => <GuideItem key={`${item.title}:${i}`} item={item} />)}
    </details>}
  </section>;
}

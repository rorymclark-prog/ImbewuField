'use client';

import { ClipboardList } from 'lucide-react';
import type { ProductionGuide, ProductionGuideItem } from '@/lib/crop-export-schedule';

function GuideItem({ item }: { item: ProductionGuideItem }) {
  return <div className="py-2" style={{ borderTop: '1px solid var(--border)' }}>
    <h4 className="font-sans font-semibold" style={{ fontSize: 13, color: 'var(--text-primary)' }}>{item.title}</h4>
    {item.lines.map((line) => <p key={line} className="font-sans mt-1" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{line}</p>)}
    {!!item.sources?.length && <ul className="font-sans mt-1" style={{ fontSize: 11, lineHeight: 1.5, color: 'var(--text-muted)', listStyle: 'disc', paddingInlineStart: 18 }}>
      {item.sources.map((source) => <li key={`${source.label}:${source.url}`}>
        {source.url ? <a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{source.label}</a> : source.label}
      </li>)}
    </ul>}
  </div>;
}

/** These facts belong to the site survey; saving a crop plan must not silently answer them. */
export default function ProductionGuideCard({ guide, canSurvey, onSurvey }: {
  guide: ProductionGuide;
  canSurvey: boolean;
  onSurvey: () => void;
}) {
  return <section className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} aria-labelledby="production-guide-heading" data-production-guide>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id="production-guide-heading" className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><ClipboardList size={16} aria-hidden /> Check your farm conditions</h3>
      <button type="button" onClick={onSurvey} disabled={!canSurvey} className="font-sans px-3 rounded-lg" style={{ minHeight: 44, fontSize: 12, border: '1px solid var(--border)', color: 'var(--text-primary)', opacity: canSurvey ? 1 : 0.6 }}>Update site survey</button>
    </div>
    <p className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Climate area: {guide.area}. {canSurvey ? 'Your survey supplies the observations below.' : 'Choose a mapped site before recording farm observations.'}</p>
    {guide.siteObservations.map((item) => <GuideItem key={item.title} item={item} />)}
    {guide.cropChoices.length > 0 && <details className="mt-3">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>Crop varieties to check locally ({guide.cropChoices.length} {guide.cropChoices.length === 1 ? 'crop' : 'crops'})</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Research groupings can infer climate fit. Confirm the season, soil, water and current stock with a local grower or extension officer. A recorded variety does not change this plan’s crop timing.</p>
      {guide.cropChoices.map((item) => <GuideItem key={item.title} item={item} />)}
    </details>}
    {guide.recordedProduction.length > 0 && <details className="mt-2">
      <summary className="font-sans font-semibold" style={{ cursor: 'pointer', minHeight: 44, fontSize: 13, color: 'var(--text-primary)' }}>Past production recorded in your survey</summary>
      <p className="font-sans mb-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>Use these records to compare with what you actually collect. They do not predict the coming year or set picking dates.</p>
      {guide.recordedProduction.map((item, i) => <GuideItem key={`${item.title}:${i}`} item={item} />)}
    </details>}
  </section>;
}

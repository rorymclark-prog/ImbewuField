'use client';

import { Bird } from 'lucide-react';
import type { PoultryGuidance } from '@/lib/animal-enterprises';

const PURPOSE_LABEL: Record<PoultryGuidance['purpose'], string> = {
  eggs: 'Eggs', meat: 'Meat', both: 'Eggs and meat', unknown: 'Not yet recorded',
};

/** The print view takes this same guidance model; neither view makes a breed selection or
 * turns a coop, a breed name or a recorded hen count into forecast production. */
export default function PoultryGuidanceCard({ guidance }: { guidance: PoultryGuidance }) {
  return <section className="rounded-2xl p-4 mt-4" style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }} aria-labelledby="poultry-guidance-heading" data-poultry-guidance>
    <h3 id="poultry-guidance-heading" className="font-display font-semibold inline-flex items-center gap-1.5" style={{ fontSize: 16, color: 'var(--text-primary)' }}><Bird size={16} aria-hidden /> Chickens: choose with local advice</h3>
    <p className="font-sans mt-2" style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-primary)' }}><strong>{guidance.statusText}.</strong> Purpose: {PURPOSE_LABEL[guidance.purpose]}.</p>
    {(guidance.recordedBreed !== null || guidance.recordedLayingHens !== null) && <p className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
      {guidance.recordedBreed !== null && <>Your recorded breed: {guidance.recordedBreed}. </>}
      {guidance.recordedLayingHens !== null && <>Laying hens you recorded: {guidance.recordedLayingHens}. </>}
      These are your observations; they do not promise a yield.
    </p>}
    {guidance.attention.length > 0 && <ul className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-primary)', listStyle: 'disc', paddingInlineStart: 18 }}>
      {guidance.attention.map((text) => <li key={text}>{text}</li>)}
    </ul>}
    {guidance.missing.length > 0 && <div className="font-sans mt-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>
      <strong>Still to check in your site survey:</strong>
      <ul style={{ listStyle: 'disc', paddingInlineStart: 18 }}>{guidance.missing.map((text) => <li key={text}>{text}</li>)}</ul>
    </div>}
    <p className="font-sans mt-3" style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-secondary)' }}>{guidance.careNotes.map((point) => point.text).join(' ')}</p>
    <details className="font-sans mt-3" style={{ fontSize: 12, lineHeight: 1.5 }}>
      <summary style={{ cursor: 'pointer', minHeight: 44, color: 'var(--text-primary)' }}>Breeds and production systems to discuss locally</summary>
      <div className="flex flex-col gap-2 mt-1">
        {guidance.options.map((option) => <div key={option.id} style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
          <strong style={{ color: 'var(--text-primary)' }}>{option.name}</strong>
          <p style={{ color: 'var(--text-secondary)' }}>{option.detail} <a href={option.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Source</a></p>
        </div>)}
      </div>
    </details>
    <details className="font-sans mt-2" style={{ fontSize: 12, lineHeight: 1.5 }}>
      <summary style={{ cursor: 'pointer', minHeight: 44, color: 'var(--text-primary)' }}>Weather, housing and source references</summary>
      <ul style={{ listStyle: 'disc', paddingInlineStart: 18, color: 'var(--text-secondary)' }}>{guidance.climateNotes.map((point) => <li key={point.text}>{point.text} <a href={point.source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Source</a></li>)}</ul>
      <ul className="mt-2" style={{ listStyle: 'disc', paddingInlineStart: 18 }}>{guidance.sources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>{source.doc}{source.page ? `, p. ${source.page}` : ''}</a></li>)}</ul>
    </details>
    <p className="font-sans mt-2" style={{ fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.5 }}>{guidance.localCheck}</p>
  </section>;
}

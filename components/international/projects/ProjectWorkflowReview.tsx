'use client';

import Link from 'next/link';
import MenuButton from '@/components/MenuButton';
import { useRegisterBackControl } from '@/components/BackControl';
import { useState } from 'react';
import { PROJECT_TEMPLATES } from '@/lib/international/projects/templates';
import { PROJECT_SOURCE_BOUNDARIES } from '@/lib/international/projects/sources';
import { reviewProjectIndicator } from '@/lib/international/projects/evaluate';
import { PROJECT_DEMO_CONTEXT, projectDemoEvidence, type ProjectDemoScenario } from '@/lib/international/projects/demo';

const fieldClass = 'w-full min-h-[44px] rounded-lg border px-3 py-2';
const fieldStyle = { background: 'var(--bg-0)', color: 'var(--text-primary)', borderColor: 'var(--border)' };
const panelStyle = { background: 'var(--bg-1)', borderColor: 'var(--border)' };
const SCENARIOS: { id: ProjectDemoScenario; title: string }[] = [
  { id: 'observed', title: 'Complete fictional observations' },
  { id: 'estimate', title: 'Planned / estimated values only' },
  { id: 'missing-value', title: 'Observation value missing' },
  { id: 'withheld', title: 'Consent withheld' },
  { id: 'duplicate', title: 'Duplicate source reference' },
  { id: 'different-site', title: 'Evidence from another site' },
  { id: 'missing-baseline', title: 'Baseline missing' },
  { id: 'mixed-currency', title: 'Mixed recorded currencies' },
];
const number = (value: number) => new Intl.NumberFormat('en', { maximumFractionDigits: 4 }).format(value);

export default function ProjectWorkflowReview() {
  // This page already has an in-flow return link; the floating Back covered it on phones.
  useRegisterBackControl();
  const [templateId, setTemplateId] = useState(PROJECT_TEMPLATES[0].id);
  const template = PROJECT_TEMPLATES.find(item => item.id === templateId)!;
  const [indicatorId, setIndicatorId] = useState('');
  const indicator = template.indicators.find(item => item.id === indicatorId) ?? template.indicators[0];
  const [scenario, setScenario] = useState<ProjectDemoScenario>('observed');
  const [periodStart, setPeriodStart] = useState(PROJECT_DEMO_CONTEXT.periodStart);
  const [periodEnd, setPeriodEnd] = useState(PROJECT_DEMO_CONTEXT.periodEnd);
  const [cutoffDate, setCutoffDate] = useState(PROJECT_DEMO_CONTEXT.cutoffDate);
  const [timeZone, setTimeZone] = useState(PROJECT_DEMO_CONTEXT.timeZone);
  const [objective, setObjective] = useState('');
  const evidence = projectDemoEvidence(indicator, scenario);
  const review = reviewProjectIndicator(indicator, evidence, { ...PROJECT_DEMO_CONTEXT, periodStart, periodEnd, cutoffDate, timeZone });
  const scenarios = SCENARIOS.filter(item => (item.id !== 'missing-baseline' || indicator.requirements.baseline)
    && (item.id !== 'mixed-currency' || indicator.unit === 'currency'));

  return (
    <main className="h-[100dvh] overflow-y-auto px-4 py-6 sm:px-8" style={{ background: 'var(--bg-0)', color: 'var(--text-primary)' }}>
      <div className="mx-auto max-w-5xl space-y-6 pb-28">
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-3"><MenuButton /><Link href="/international" className="inline-flex min-h-[44px] items-center underline">International foundation</Link></div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Grower project references · English review draft</p>
          <h1 className="text-3xl font-semibold">Build the evidence around the grower’s work</h1>
          <p>Choose a workflow, inspect the records it needs and try the evidence checks. Country-specific farming support requires separate review.</p>
          <div className="rounded-xl border p-4" style={panelStyle}>
            <strong>Fictional demonstration only.</strong> All quantities and observations below are arithmetic examples. This screen reads no farm records, saves no changes and publishes no results. The controls let you review the workflow and its gaps.
          </div>
        </header>

        <section className="rounded-xl border p-4 sm:p-6 space-y-4" style={panelStyle} aria-labelledby="workflow-choice">
          <h2 id="workflow-choice" className="text-xl font-semibold">Choose the project purpose</h2>
          <label className="block space-y-2"><span>Workflow template</span>
            <select className={fieldClass} style={fieldStyle} value={templateId} onChange={event => {
              setTemplateId(event.target.value as typeof templateId); setIndicatorId(''); setScenario('observed'); setObjective('');
            }}>
              {PROJECT_TEMPLATES.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
          </label>
          <p>{template.objective}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Led by the grower. Support may come from: {template.supportRoles.join('; ')}.</p>
          <label className="block space-y-2"><span>Try your own objective · stays in this screen</span>
            <textarea maxLength={400} rows={2} className={fieldClass} style={fieldStyle} value={objective} placeholder={template.objective} onChange={event => setObjective(event.target.value)} />
          </label>
          {objective && <p><strong>Draft objective:</strong> {objective}</p>}
          <ol className="list-decimal space-y-4 pl-6">
            {template.steps.map(step => <li key={step.title} className="pl-1"><h3 className="font-semibold">{step.title}</h3><p>{step.action}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{step.review} Source: {step.authority}.</p></li>)}
          </ol>
        </section>

        <section className="rounded-xl border p-4 sm:p-6 space-y-4" style={panelStyle} aria-labelledby="evidence-check">
          <h2 id="evidence-check" className="text-xl font-semibold">Try an evidence review</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2"><span>Indicator</span>
              <select className={fieldClass} style={fieldStyle} value={indicator.id} onChange={event => { setIndicatorId(event.target.value); setScenario('observed'); }}>
                {template.indicators.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
            <label className="block space-y-2"><span>Fictional evidence scenario</span>
              <select className={fieldClass} style={fieldStyle} value={scenario} onChange={event => setScenario(event.target.value as ProjectDemoScenario)}>
                {scenarios.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}
              </select>
            </label>
          </div>
          <p>{indicator.definition}</p>
          <p><strong>Evidence needed:</strong> {indicator.evidenceNeeded}</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-2"><span>Period starts · inclusive</span><input type="date" value={periodStart} onChange={event => setPeriodStart(event.target.value)} className={fieldClass} style={fieldStyle} /></label>
            <label className="block space-y-2"><span>Period ends · inclusive</span><input type="date" value={periodEnd} onChange={event => setPeriodEnd(event.target.value)} className={fieldClass} style={fieldStyle} /></label>
            <label className="block space-y-2"><span>Evidence submission cutoff</span><input type="date" value={cutoffDate} onChange={event => setCutoffDate(event.target.value)} className={fieldClass} style={fieldStyle} /></label>
          </div>
          <label className="block space-y-2"><span>Reporting time zone</span><input value={timeZone} onChange={event => setTimeZone(event.target.value)} className={fieldClass} style={fieldStyle} /></label>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Scope: one fictional project and garden. Dates are local calendar dates in the stated time zone; no timestamp conversion is performed. Example currency stays ZAR. Example soil unit is a fictional score, not a validated protocol.</p>

          <div className="rounded-xl border p-4 space-y-3" style={fieldStyle} role="status" aria-live="polite" aria-atomic="true">
            <h3 className="font-semibold">{review.state === 'reported' ? 'Fictional example meets the evidence checks' : review.state === 'incomplete' ? 'Evidence remains incomplete' : 'Result unavailable'}</h3>
            <p className="text-2xl font-semibold">{review.value === null ? 'No complete result' : `${number(review.value)} ${review.currency ?? review.unit}`}</p>
            {review.knownSubtotal !== null && review.value === null && <p>Known partial evidence: {number(review.knownSubtotal)} {review.currency ?? review.unit}. This is not a complete total.</p>}
            <p>{review.accepted.length} accepted reference{review.accepted.length === 1 ? '' : 's'}; {review.rejected.length} excluded.</p>
            {!!review.gaps.length && <ul className="list-disc pl-5 space-y-1">{review.gaps.map(gap => <li key={gap}>{gap}</li>)}</ul>}
            <p>{review.interpretation}</p>
          </div>

          <details className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">Inspect fictional source references and exclusion reasons</summary>
            <ul className="space-y-3 pt-3">
              {evidence.map((item, index) => <li key={`${item.reference.id}-${index}`} className="break-words text-sm">
                <strong>{item.reference.authority} / {item.reference.id}</strong>
                <p>{item.stage} · {item.periodStart} to {item.periodEnd} · {item.basis} · {item.quantity ?? 'missing'} {item.currency ?? item.unit} · {item.provenance}</p>
              </li>)}
            </ul>
            {review.rejected.map((item, index) => <div key={`${item.reference.id}-${index}`} className="mt-4 text-sm break-words"><strong>Excluded: {item.reference.id}</strong><ul className="list-disc pl-5">{item.reasons.map(reason => <li key={reason}>{reason}</li>)}</ul></div>)}
          </details>
        </section>

        <section className="space-y-4" aria-labelledby="source-boundary">
          <h2 id="source-boundary" className="text-xl font-semibold">Keep one record of the work</h2>
          <p>The existing books remain the authorities. A future authorised integration can supply their reviewed references; this demonstration does not fetch them or create a second ledger.</p>
          <div className="grid gap-3 sm:grid-cols-2">{PROJECT_SOURCE_BOUNDARIES.map(source => <details key={source.authority} className="rounded-xl border p-3" style={panelStyle}>
            <summary className="min-h-[44px] cursor-pointer py-2 font-semibold">{source.authority}</summary><p className="pt-2 text-sm">{source.integration}</p>
          </details>)}</div>
          <ul className="list-disc pl-5 space-y-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{template.limits.map(limit => <li key={limit}>{limit}</li>)}</ul>
        </section>
      </div>
    </main>
  );
}

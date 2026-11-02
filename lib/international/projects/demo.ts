import type { ProjectEvidence, ProjectIndicator, ProjectReviewContext } from './types';

export type ProjectDemoScenario = 'observed' | 'estimate' | 'missing-value' | 'withheld' | 'duplicate' | 'different-site' | 'missing-baseline' | 'mixed-currency';
export const PROJECT_DEMO_CONTEXT: ProjectReviewContext = {
  projectId: 'fictional-project', siteId: 'fictional-garden', periodStart: '2026-10-01', periodEnd: '2026-10-31',
  cutoffDate: '2026-11-02', timeZone: 'Africa/Johannesburg', audience: 'grower-review', allowDemo: true,
  currency: 'ZAR', measurementUnit: 'example-score',
};

/** Arithmetic-only examples, not farming recommendations, real records or validated outcomes. */
export function projectDemoEvidence(indicator: ProjectIndicator, scenario: ProjectDemoScenario): ProjectEvidence[] {
  const row: ProjectEvidence = {
    reference: { authority: indicator.authorities[0], id: `fictional-${indicator.id}-observation` },
    projectId: PROJECT_DEMO_CONTEXT.projectId, siteId: PROJECT_DEMO_CONTEXT.siteId,
    kind: indicator.kind, level: indicator.level, basis: 'actual', provenance: 'fictional-demo',
    periodStart: '2026-10-14', periodEnd: '2026-10-14', recordedOn: '2026-10-15',
    stage: indicator.requirements.followUp ? 'follow-up' : 'current',
    quantity: indicator.aggregation === 'ratio' ? 8 : 4,
    unit: indicator.unit === 'method-defined' ? 'example-score' : indicator.unit,
    ...(indicator.unit === 'currency' ? { currency: 'ZAR' } : {}),
    ...(indicator.requirements.denominator ? { denominator: 10 } : {}),
    population: 'fictional-fixed-cohort', method: 'Fictional demonstration method; not a validated measurement protocol',
    consent: 'granted', published: false,
  };
  let rows: ProjectEvidence[] = indicator.requirements.baseline ? [{ ...row,
    reference: { ...row.reference, id: `fictional-${indicator.id}-baseline` }, stage: 'baseline',
    periodStart: '2026-09-30', periodEnd: '2026-09-30', recordedOn: '2026-09-30', quantity: 10,
  }, row] : [row];
  if (scenario === 'estimate') rows = rows.map(item => ({ ...item, basis: 'estimate' }));
  if (scenario === 'missing-value') rows = rows.map(item => ({ ...item, quantity: null }));
  if (scenario === 'withheld') rows = rows.map(item => ({ ...item, consent: 'withheld' }));
  if (scenario === 'different-site') rows = rows.map(item => ({ ...item, siteId: 'another-fictional-garden' }));
  if (scenario === 'missing-baseline') rows = rows.filter(item => item.stage !== 'baseline');
  if (scenario === 'duplicate') rows = [...rows, { ...row }];
  if (scenario === 'mixed-currency') rows = [...rows, { ...row, reference: { ...row.reference, id: 'fictional-other-currency' }, currency: 'USD' }];
  return rows;
}

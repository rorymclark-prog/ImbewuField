import type { ProjectIndicator, ProjectTemplate } from './types';

const ordinary = { baseline: false, followUp: false, denominator: false, method: false };
const indicator = (value: Omit<ProjectIndicator, 'requirements'> & { requirements?: ProjectIndicator['requirements'] }): ProjectIndicator =>
  ({ ...value, requirements: value.requirements ?? ordinary });
const commonLimits = [
  'Workflow reference only: country-specific farming advice and funding eligibility are not reviewed here.',
  'Existing access controls and consent apply. This review creates no new sharing permission.',
  'Observed change does not establish causal impact. Participation and completed work are separate from outcomes.',
];

export const PROJECT_TEMPLATES: readonly ProjectTemplate[] = [
  {
    id: 'food-security', title: 'Food security', owner: 'grower', readiness: 'workflow-reference',
    objective: 'Understand what the garden actually produces and what food is retained or used, then agree the next growing priorities.',
    supportRoles: ['Grower-selected household representative', 'Mentor reviewing records', 'Organisation supporting agreed needs'],
    steps: [
      { title: 'Agree food priorities', action: 'Record the grower’s priorities and what is unknown before planning.', authority: 'mel', review: 'Use the existing baseline assessment with consent; avoid treating a late baseline as a previous observation.' },
      { title: 'Plan and carry out work', action: 'Review the existing crop tasks and record what actually happened.', authority: 'task-board', review: 'A planned harvest task is not harvested food.' },
      { title: 'Record harvest and food use', action: 'Link weighed harvest records and separate dated records of food kept, donated or used.', authority: 'farm-records', review: 'Do not double-count a transfer or add household use as another harvest.' },
      { title: 'Review access separately', action: 'Discuss household food access through the consented follow-up, alongside production.', authority: 'mel', review: 'Harvest weight alone does not establish nutrition or sufficient food.' },
    ],
    indicators: [
      indicator({ id: 'harvest-recorded', existingProgrammeTemplateId: 'harvest', title: 'Recorded harvest', kind: 'harvest', level: 'output', unit: 'kg', aggregation: 'sum',
        authorities: ['production-records', 'farm-records'], definition: 'Known harvested weight in the selected site and reporting period.',
        evidenceNeeded: 'Actual dated harvest weights with stable source references and site assignment.', limits: 'Known recorded weight only; no estimate from area, task completion, packages or crop forecasts. Coverage may be incomplete.' }),
      indicator({ id: 'food-use-recorded', existingProgrammeTemplateId: 'food-distributed', title: 'Food kept or used', kind: 'food-use', level: 'output', unit: 'kg', aggregation: 'sum',
        authorities: ['programme-evidence', 'farm-records'], definition: 'Weighed produce retained or used for food, counted once per disposition.',
        evidenceNeeded: 'Dated disposition records linked to the original harvest or transfer.', limits: 'This is a use of production, not additional production or proof of household food security.' }),
    ], limits: commonLimits,
  },
  {
    id: 'livelihoods', title: 'Livelihoods', owner: 'grower', readiness: 'workflow-reference',
    objective: 'Review recorded receipts and the evidence still needed to understand costs and livelihood changes.',
    supportRoles: ['Grower’s chosen record keeper', 'Mentor', 'Organisation supporting market access'],
    steps: [
      { title: 'Define the activity and period', action: 'Agree which enterprise, currency and reporting dates the review covers.', authority: 'mel', review: 'Keep household income separate from one enterprise’s sales.' },
      { title: 'Record sales and payments', action: 'Use the existing sales and invoice books; reconcile receipts with source transactions.', authority: 'invoices', review: 'An unpaid invoice is not cash received. Do not count a linked sale and invoice twice.' },
      { title: 'Review costs and gaps', action: 'Review the existing cost book for the same activity and dates.', authority: 'farm-records', review: 'Missing costs do not mean zero costs; receipts alone do not establish profit.' },
      { title: 'Agree support', action: 'Record the grower’s next action in the existing journal or programme review.', authority: 'field-journal', review: 'Keep planned support distinct from delivered work and income outcomes.' },
    ],
    indicators: [
      indicator({ id: 'receipts-recorded', existingProgrammeTemplateId: 'sales', title: 'Recorded receipts', kind: 'payment', level: 'output', unit: 'currency', aggregation: 'sum',
        authorities: ['farm-records', 'invoices'], definition: 'Confirmed payments received in a single recorded currency during the period.',
        evidenceNeeded: 'Payment date, amount, currency, paid status and reconciled original source reference.', limits: 'Revenue received, not profit, household income or causal livelihood impact. Existing invoice schema is rand-based; no new currency is inferred.' }),
      indicator({ id: 'costs-recorded', title: 'Recorded enterprise costs', kind: 'cost', level: 'output', unit: 'currency', aggregation: 'sum',
        authorities: ['farm-records'], definition: 'Known recorded enterprise costs in a single recorded currency during the period.',
        evidenceNeeded: 'Dated cost entries for the same activity and currency, linked to their original source records.',
        limits: 'Known costs only; missing costs do not mean zero. No profit or household-income result is derived automatically.' }),
    ], limits: [...commonLimits, 'No household income or profit indicator is derived automatically.'],
  },
  {
    id: 'agroforestry', title: 'Agroforestry', owner: 'grower', readiness: 'workflow-reference',
    objective: 'Track confirmed planting and revisit the same planting cohort without mistaking proposed trees for established outcomes.',
    supportRoles: ['Grower-selected planting team', 'Local extension reviewer', 'Organisation supporting follow-up'],
    steps: [
      { title: 'Confirm local checks', action: 'Obtain the appropriate local suitability and legality review before planting decisions.', authority: 'field-journal', review: 'This template approves no species or planting density.' },
      { title: 'Record actual planting', action: 'Link a dated planting register to a stable site and cohort code.', authority: 'programme-evidence', review: 'Mapped trees remain a proposal until planting is confirmed.' },
      { title: 'Revisit the same cohort', action: 'Record living trees and the original cohort size at a stated follow-up.', authority: 'programme-evidence', review: 'Replacement trees are a separate planting, not survivors of the original cohort.' },
      { title: 'Review further evidence', action: 'Use the journal to agree maintenance and later observation needs.', authority: 'field-journal', review: 'Tree counts do not establish carbon storage, biodiversity gain or yield.' },
    ],
    indicators: [
      indicator({ id: 'planting-confirmed', existingProgrammeTemplateId: 'trees', title: 'Confirmed trees planted', kind: 'planting', level: 'output', unit: 'trees', aggregation: 'sum',
        authorities: ['programme-evidence'], definition: 'Distinct confirmed planted trees in the stated reporting period.', evidenceNeeded: 'Dated planting register with site/cohort reference, separating new and replacement planting.', limits: 'Planting output only; no inference from map symbols or subsequent survival.' }),
      indicator({ id: 'cohort-survival', existingProgrammeTemplateId: 'surviving-trees', title: 'Original cohort alive at follow-up', kind: 'survival', level: 'outcome', unit: 'trees', aggregation: 'ratio',
        authorities: ['programme-evidence'], definition: 'Living trees at follow-up divided by the confirmed original cohort count.',
        evidenceNeeded: 'Baseline count and positive denominator, follow-up count, same cohort and observation method; exclude replacements.', limits: 'Observed cohort survival only; not carbon, ecosystem restoration or causal project impact.',
        requirements: { baseline: true, followUp: true, denominator: true, method: true } }),
    ], limits: commonLimits,
  },
  {
    id: 'agroecology', title: 'Agroecology', owner: 'grower', readiness: 'workflow-reference',
    objective: 'Document agreed practices and compare observations using a consistent method, without assuming the practice caused an improvement.',
    supportRoles: ['Grower-selected observer', 'Local soil or extension specialist', 'Mentor'],
    steps: [
      { title: 'Define an observation method', action: 'Agree what will be measured, with units, location context and repeatable sampling.', authority: 'programme-evidence', review: 'Use locally reviewed methods; this template prescribes no soil thresholds.' },
      { title: 'Record a baseline', action: 'Link an actual pre-intervention observation, disclosing retrospective evidence.', authority: 'programme-evidence', review: 'A missing baseline stays missing.' },
      { title: 'Document the practice', action: 'Record completed work and supporting journal observations.', authority: 'field-journal', review: 'Completing a practice is an output, not measured soil change.' },
      { title: 'Repeat and review', action: 'Repeat the observation with the same method and population, then discuss limitations.', authority: 'programme-evidence', review: 'Check sampling depth, season and method; do not attribute change to the project automatically.' },
    ],
    indicators: [
      indicator({ id: 'practice-observed', existingProgrammeTemplateId: 'adoption', title: 'Agreed practice observed', kind: 'practice', level: 'output', unit: 'gardens', aggregation: 'latest',
        authorities: ['programme-evidence'], definition: 'Gardens in the stated site scope with a dated checklist observation of the agreed practice.', evidenceNeeded: 'Observed checklist, scope and count, not a task checkbox alone.', limits: 'Observed practice only; not a soil, biodiversity or resilience outcome.', requirements: { ...ordinary, method: true } }),
      indicator({ id: 'soil-comparison', existingProgrammeTemplateId: 'soil', title: 'Comparable soil observation change', kind: 'soil-observation', level: 'outcome', unit: 'method-defined', aggregation: 'change',
        authorities: ['programme-evidence'], definition: 'Difference between a matched baseline and follow-up value in the explicitly selected method unit.', evidenceNeeded: 'Same population, method, units and comparable sampling context, with dated source observations.', limits: 'A measured difference can be adverse, beneficial or inconclusive; it does not prove improved soil or causal impact.',
        requirements: { baseline: true, followUp: true, denominator: false, method: true } }),
    ], limits: commonLimits,
  },
  {
    id: 'market-garden', title: 'Commercial market gardening', owner: 'grower', readiness: 'workflow-reference',
    objective: 'Connect the grower’s production work, observed harvest and sales records to an honest trading review.',
    supportRoles: ['Grower’s chosen record keeper', 'Market-support mentor', 'Organisation supporting infrastructure'],
    steps: [
      { title: 'Review the production plan', action: 'Use existing crop plans and task records for the grower’s planned work.', authority: 'task-board', review: 'A seasonal estimate is not a weekly delivery commitment.' },
      { title: 'Record actual picking', action: 'Use dated harvest records with their original quantities and pack units.', authority: 'farm-records', review: 'A crate or bunch has no universal kg conversion.' },
      { title: 'Reconcile trading', action: 'Link actual sales, invoices and receipts in their existing books.', authority: 'invoices', review: 'Avoid duplicated sales and keep unpaid amounts separate.' },
      { title: 'Review the next cycle', action: 'Compare observed production and sales with planned work and remaining evidence gaps.', authority: 'programme-evidence', review: 'No guarantee of profitability, market demand or continuous weekly supply.' },
    ],
    indicators: [
      indicator({ id: 'market-harvest', existingProgrammeTemplateId: 'harvest', title: 'Recorded market-garden harvest', kind: 'harvest', level: 'output', unit: 'kg', aggregation: 'sum', authorities: ['farm-records', 'production-records'],
        definition: 'Known actual harvested kg in the selected reporting window.', evidenceNeeded: 'Dated weights in the existing production/harvest book.', limits: 'Unknown pack conversions remain unknown; this is not saleable yield or weekly supply.' }),
      indicator({ id: 'market-sales', existingProgrammeTemplateId: 'sales', title: 'Recorded sales quantity', kind: 'sale', level: 'output', unit: 'kg', aggregation: 'sum', authorities: ['farm-records'],
        definition: 'Known weight recorded as sold during the reporting window.', evidenceNeeded: 'Existing sale records with known kg and stable original references.', limits: 'Weight sold is separate from receipts, profit, household income and expected orders.' }),
    ], limits: commonLimits,
  },
];

export const projectTemplate = (id: string): ProjectTemplate | undefined => PROJECT_TEMPLATES.find(template => template.id === id);

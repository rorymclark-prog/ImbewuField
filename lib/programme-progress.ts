import { portfolioTotals, type NetworkFarmerSummary } from './network';
import type { productionAreaSummary } from './production-sites';
import type { ProgrammeMilestone } from './programme-evidence';

export const PROGRESS_AREAS = [
  { id: 'growing', title: 'Growing & production', examples: 'Gardens producing, vegetable beds, staple plots, harvests and food distributed.' },
  { id: 'water-energy', title: 'Water & energy', examples: 'Installed storage, reliable water access, water collected and commissioned solar.' },
  { id: 'land-nature', title: 'Land & biodiversity', examples: 'Trees planted and surviving, soil condition, compost and land restored.' },
  { id: 'livelihoods', title: 'Income & livelihoods', examples: 'Produce sold, recorded income and costs, paid work and market access.' },
  { id: 'participation', title: 'Participation & households', examples: 'Active growers, households reached, food access and completed follow-ups.' },
  { id: 'learning', title: 'Learning & practice', examples: 'Attendance, demonstrated skills and farming practices adopted after training.' },
  { id: 'delivery', title: 'Delivery & support', examples: 'Completed installations, mentor visits, agreed actions and evidence checks.' },
  { id: 'other', title: 'Other agreed measures', examples: 'Additional indicators defined by the implementing organisation.' },
] as const;
export type ProgressArea = typeof PROGRESS_AREAS[number]['id'];
export const validProgressArea = (value: unknown): value is ProgressArea => PROGRESS_AREAS.some(a => a.id === value);
export const progressArea = (m: ProgrammeMilestone): ProgressArea => m.category ?? 'other';

export const PROGRESS_TEMPLATES: { id: string; category: ProgressArea; title: string; unit: string; method: string }[] = [
  { id:'gardens', category:'growing', title:'Gardens actively producing', unit:'gardens', method:'Count distinct physical gardens with a dated production check. State the reporting period and garden codes; count each garden once.' },
  { id:'vegetable-area', category:'growing', title:'Vegetable beds in production', unit:'m²', method:'Use the checked production-area register for the stated project and date. Exclude paths, buildings and unplanted ground; count each physical bed once.' },
  { id:'staple-area', category:'growing', title:'Staple plots in production', unit:'m²', method:'Use the checked production-area register. State the date and scope; exclude overlap with vegetable beds and repeated crop cycles.' },
  { id:'harvest', category:'growing', title:'Harvest recorded', unit:'kg', method:'Use dated harvest records for a stated start and end date. Report a cumulative total within that period; record missing weights and participating gardens.' },
  { id:'food-distributed', category:'growing', title:'Produce kept or distributed for food', unit:'kg', method:'Use dated disposition records for produce kept, donated or used in meals. State the period and avoid counting a transfer more than once.' },
  { id:'storage', category:'water-energy', title:'Installed water storage capacity', unit:'litres', method:'Sum stated capacities of distinct installed tanks with site IDs, installation checks and dated evidence. Planned tanks and water currently in the tanks are separate measures.' },
  { id:'water-collected', category:'water-energy', title:'Water collected', unit:'litres', method:'Use measured inflow or collection records for a stated period. Do not substitute tank capacity or modelled rainfall for measured water.' },
  { id:'solar', category:'water-energy', title:'Commissioned solar capacity', unit:'kWp', method:'Use commissioning records and equipment ratings for distinct systems. Record sites and commissioning dates; energy generated requires a separate meter reading.' },
  { id:'trees', category:'land-nature', title:'Trees planted', unit:'trees', method:'Count individual trees in a dated planting register by site. Distinguish new planting and replacements; retain a separate survival check.' },
  { id:'surviving-trees', category:'land-nature', title:'Trees alive at follow-up', unit:'trees', method:'Revisit a fixed planting cohort and count living trees on the observation date. State the original cohort count and dates. Do not add replacement trees to survival without disclosing them.' },
  { id:'soil', category:'land-nature', title:'Sites with comparable soil checks', unit:'sites', method:'Count distinct sites with baseline and follow-up observations using the same method, depth and season where practicable. Link results; a completed test does not establish soil improvement.' },
  { id:'restored-area', category:'land-nature', title:'Land under restoration measures', unit:'m²', method:'Use dated mapped or measured areas with a defined restoration practice. Exclude overlap. Record establishment separately from later vegetation and soil outcomes.' },
  { id:'sales', category:'livelihoods', title:'Recorded produce sales', unit:'R', method:'Use dated sales records for the defined project and reporting period. State coverage and whether figures represent receipts or invoices. This is revenue, not profit.' },
  { id:'paid-work', category:'livelihoods', title:'Paid work provided', unit:'person-days', method:'Use verified work and payment registers for a stated period. Define one person-day and keep unique worker counts separate from days worked.' },
  { id:'households', category:'participation', title:'Households reached', unit:'households', method:'Count distinct consenting household IDs with a recorded service in the reporting period. Repeated visits and several household members must not increase the household total.' },
  { id:'food-access', category:'participation', title:'Households reporting improved food access', unit:'households', method:'Use a consistently worded baseline and follow-up question with matched consenting households. State the number responding and the period; distinguish reported change from attribution to the project.' },
  { id:'skills', category:'learning', title:'Participants demonstrating the agreed skill', unit:'people', method:'Use a defined practical assessment and distinct participant IDs. State who was assessed, the criterion and date. Attendance alone does not qualify.' },
  { id:'adoption', category:'learning', title:'Gardens applying the agreed practice', unit:'gardens', method:'Use a dated follow-up observation against a defined practice checklist. Count each garden once and state how many were checked.' },
  { id:'visits', category:'delivery', title:'Mentor visits completed', unit:'visits', method:'Count dated visit records with a site reference, observations and agreed next actions in the reporting period. Scheduled visits do not count as completed.' },
  { id:'actions', category:'delivery', title:'Agreed support actions completed', unit:'actions', method:'Use the action register with stable IDs, completion dates and supporting evidence. State the full set due in the reporting period and do not count reopened actions twice.' },
];

export type ProgressMetric = { id: string; category: ProgressArea; label: string; value: number | null; unit: string; note: string };
export type AreaSummary = ReturnType<typeof productionAreaSummary>;
export type ProgrammeRecords = { metrics: ProgressMetric[]; notes: string[]; errors: string[] };
const number = (n: number, digits = 2) => n.toLocaleString('en-ZA', { maximumFractionDigits: digits });
export function progressValue(value: number | null, unit = '') {
  if (value === null) return 'Not reported';
  return unit === 'R' ? `R ${number(value)}` : `${number(value,unit==='ha'?4:2)}${unit ? ` ${unit}` : ''}`;
}

/** These sources cover different registers and periods. Keep their denominators visible;
 * do not divide portfolio sales by garden areas to manufacture profitability. */
export function programmeRecordMetrics(rows: NetworkFarmerSummary[] | null, areas: AreaSummary | null, withheld = 0): ProgrammeRecords {
  const totals = rows === null ? null : portfolioTotals(rows);
  const areaNote = areas?.sites ? `${areas.sites} distinct gardens · observations ${areas.firstObserved} to ${areas.lastObserved}` : 'No shared area observations available';
  const recordCoverage = (kind: 'production' | 'sales' | 'expenses') => rows === null ? 'Portfolio records unavailable' : `${rows.filter(r => r.metrics.coverage[kind]).length} of ${rows.length} visible farmer records include ${kind}`;
  const metrics: ProgressMetric[] = [
    { id:'gardens', category:'growing', label:'Gardens with area records', value:areas?.sites ? areas.sites : null, unit:'', note:areaNote },
    { id:'vegetables', category:'growing', label:'Vegetable beds', value:areas?.sites ? areas.vegetableM2 : null, unit:'m²', note:areaNote },
    { id:'staples', category:'growing', label:'Staple plots', value:areas?.sites ? areas.stapleM2 : null, unit:'m²', note:areaNote },
    { id:'hectares', category:'growing', label:'Total planted area', value:areas?.sites ? areas.hectares : null, unit:'ha', note:'Vegetable beds + staple plots; physical area counted once' },
    { id:'harvest', category:'growing', label:'Harvest logged', value:totals?.producedKg ?? null, unit:'kg', note:recordCoverage('production') },
    { id:'sold', category:'livelihoods', label:'Produce sold', value:totals?.soldKg ?? null, unit:'kg', note:recordCoverage('sales') },
    { id:'income', category:'livelihoods', label:'Recorded sales', value:totals?.incomeZar ?? null, unit:'R', note:recordCoverage('sales') },
    { id:'costs', category:'livelihoods', label:'Recorded costs', value:totals?.expensesZar ?? null, unit:'R', note:recordCoverage('expenses') },
    { id:'reporting', category:'participation', label:'Farmers with production or sales records', value:totals?.reportingCount ?? null, unit:'', note:totals ? `${totals.farmerCount} visible farmer records; coverage is not total project reach` : 'Portfolio records unavailable' },
    { id:'active', category:'participation', label:'Farmers active in the last 90 days', value:totals?.activeLast90Days ?? null, unit:'', note:'Based on recorded activity; this does not establish continued participation' },
  ];
  return { metrics, errors:[], notes:[
    'Area figures use each garden’s latest observation. Farmer production and finances use available cumulative records, whose reporting periods and coverage may differ.',
    'Sales are revenue. Profit and R/m² require costs, production area and dates matched to the same activity; those ratios are not calculated here.',
    ...(withheld ? [`${withheld} enrolled farmers are withheld from the portfolio for consent.`] : []),
  ] };
}

export function progressRecordSections(records: ProgrammeRecords) {
  return PROGRESS_AREAS.map(a => ({ title:`${a.title} · latest organisation records`, lines:records.metrics.filter(m=>m.category===a.id).map(m=>`${m.label}: ${progressValue(m.value,m.unit)}. ${m.note}`) })).filter(s=>s.lines.length);
}

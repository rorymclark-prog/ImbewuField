// The frost caveat on the printed bed-by-bed table, for each thing a grower can have said about frost.
//   node --import ./tests/register-alias.mjs docs/audits/2026-11-11/evidence-cp117/scripts/frost-table-pdf.ts
// OFFLINE, with the app's own PDF builder (buildCropPlanPdf) and production-guide builder: no browser, no
// network. The plantings are the 27 the app's Auto-suggest made for the local fixture farm on 11 November
// (evidence-decisions/artifacts/crop-plan-local-farm.json) and the beds are the sample farm's. The survey
// objects are constructed here; they are not a grower's record. This shows what the builder prints. It is
// not a browser export: the browser path to the survey's frost question was not driven successfully.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { buildCropPlanPdf, planTableFrost, type CropPlanPdfInput } from '@/lib/crop-export-pdf';
import { buildPlanTableRows } from '@/lib/crop-export-benchmark';
import { buildProductionGuide } from '@/lib/crop-export-schedule';
import { tasksForPlan, type PlanBed, type Planting } from '@/lib/crop-plan';
import { buildDemoDesignCanvasState } from '@/lib/demo-farm';
import { bedsFromDesignCanvas } from '@/lib/design-beds-bridge';
import type { SiteSurvey } from '@/lib/site-survey';

const root = new URL('../', import.meta.url);
const saved = JSON.parse(readFileSync(new URL('../evidence-decisions/artifacts/crop-plan-local-farm.json', root), 'utf8'));
// The saved value is the app's storage envelope; the plan itself is its `bookRaw` string.
const plan = JSON.parse(JSON.parse(saved.imbewu_crop_plan_v2).bookRaw);
const plantings: Planting[] = plan.plantings;
const beds: PlanBed[] = bedsFromDesignCanvas(buildDemoDesignCanvasState() as never) as PlanBed[];
const now = new Date('2026-11-11T08:00:00.000Z');
const survey = (conditions: Record<string, unknown> | undefined): SiteSurvey => ({
  siteId: 'site:-27.72623,31.96304', placeId: 'demo-place-ubhejane', savedAt: '2026-11-11T08:00:00Z', siteType: 'community', adults: '2-5', goals: ['food'],
  waterSource: [], waterDelivery: [], waterStorage: [], roofMainM2: null, roofSecondaryM2: null, hasGutters: false, landPrepMethod: 'hand', soilCondition: 'unknown',
  soilAmendments: [], hasFencing: 'partial', existingCrops: [], existingGrowingAreaM2: null, livestock: [], otherInfra: [], farmingPractice: 'mostly-organic', challenges: [],
  isCommercial: false, notes: '', ...(conditions ? { productionConditions: conditions } : {}) } as unknown as SiteSurvey);
const CASES: Array<[string, SiteSurvey | null]> = [
  ['not-recorded', null],
  ['no-frost-observed', survey({ frost: 'no' })],
  ['recorded-apr-jul-dec', survey({ frost: 'yes', frostMonths: [4, 7, 12] })],
];
mkdirSync(new URL('artifacts/', root), { recursive: true });
const out: string[] = [`plantings ${plantings.length}; beds ${beds.length}; "now" ${now.toISOString().slice(0, 10)}`, ''];
const baseline = buildPlanTableRows(plantings, beds).map(({ frostCaveat: _c, ...rest }) => JSON.stringify(rest));
for (const [name, s] of CASES) {
  const guide = buildProductionGuide(s, plantings, [], now.getMonth() + 1);
  const frost = planTableFrost({ productionGuide: guide, now });
  const rows = buildPlanTableRows(plantings, beds, frost);
  const same = JSON.stringify(rows.map(({ frostCaveat: _c, ...rest }) => JSON.stringify(rest))) === JSON.stringify(baseline);
  out.push(`== ${name}`, `table frost input: ${JSON.stringify(frost)}`, `rows ${rows.length}; with a caveat ${rows.filter((r) => r.frostCaveat).length}; every other field identical to the no-survey table: ${same}`);
  for (const r of rows.filter((x) => x.frostCaveat)) out.push(`  ${r.area || '     '} | ${r.crop} | harvest ${r.harvest} | ${r.frostCaveat}`);
  out.push('guide:');
  for (const entry of guide.siteObservations.filter((e) => /frost/i.test(e.title))) { out.push(`  [${entry.title}]`); for (const line of entry.lines) out.push(`    ${line}`); }
  out.push('');
  const input: CropPlanPdfInput = { plantings, beds, tasks: tasksForPlan(plantings, beds), productionGuide: guide, now,
    meta: { planTitle: 'Ubhejane Crèche garden', siteLine: 'This site (satellite climate records) · Hot area, no frost - summer rain', locationLine: 'This site (satellite climate records)', climateLine: 'Hot area, no frost - summer rain', rainPattern: 'all-year', bedsSummary: `${beds.length} beds`, dateLabel: '11 November 2026', estimatedKgPerYear: null, lossPercent: 0 } };
  const blob = await buildCropPlanPdf(input);
  writeFileSync(new URL(`artifacts/builder-frost-${name}.pdf`, root), Buffer.from(await blob.arrayBuffer()));
}
writeFileSync(new URL('outputs/frost-table-cases.txt', root), out.join('\n') + '\n');
console.log(out.join('\n'));

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFarmReport, farmComparisonReference, farmReportPeriod, type FarmReportOptions } from '../lib/farm-report';
import { financePeriodBounds, isInFinancePeriod } from '../lib/farm-metrics';
import { recordQuantityPayload } from '../lib/farm-records';
import type { ProductionLog, SalesLog } from '../lib/db/types';
import type { SavedInvoice } from '../lib/invoices';
import { buildMelEvidenceReport, type MelReportOptions } from '../lib/mel-report';
import { cleanDonorIndicator, freshEvidenceData, validProgrammeMilestone, type DonorIndicator, type ProgrammeMilestone } from '../lib/programme-evidence';
import { buildProgrammeReport, previousReportDateRange, programmeComparisonRange, programmeReportFilename, type ProgrammeReportOptions } from '../lib/programme-report';
import { DEMO_NETWORK, DEMO_COHORT_MONTHLY } from '../lib/network-demo';
import { buildTrainingReport } from '../lib/training-report';
import { buildFieldReport } from '../lib/field-report';
import { freshFieldWorkspace } from '../lib/field-teams';
import { buildProgrammePdf } from '../lib/programme-report-pdf';
import { pdfContentStreams } from './pdf-content-streams';

const now = new Date('2026-10-26T12:00:00');
const harvest = (id:string,date:string,kg:number):ProductionLog=>({id,profile_id:'owner',garden_id:null,crop:'Recorded produce',kg,logged_at:date,created_at:date,photo_url:null});
const sale = (id:string,date:string,amount:number):SalesLog=>({...harvest(id,date,1),sold_at:date,amount,buyer:null});
const farm = (extra:Partial<FarmReportOptions>={}):FarmReportOptions=>({kind:'finance',period:'month',reference:new Date('2025-01-15T12:00:00'),comparison:'previous',now,farm:'Fictional farm',sample:true,production:[],sales:[],expenses:[],invoices:[],...extra});
const comparison = (report:ReturnType<typeof buildFarmReport>)=>report.tables.find(t=>t.title==='Historical period comparison')!;
const donor:DonorIndicator={funder:'Fictional donor',agreement:'TEST-AGREEMENT',code:'TEST-01',periodStart:'2026-08-01',periodEnd:'2026-09-30',population:'Six explicitly identified demonstration gardens; no repeated sites.',disaggregation:'No demographic breakdown agreed; retain aggregate site counts.',frequency:'Monthly',basis:'cumulative'};
const milestone = (extra:Partial<ProgrammeMilestone>={}):ProgrammeMilestone=>({...freshEvidenceData().milestones[0],id:'test-indicator',project:'Test project',title:'Fictional agreed output',donor:{...donor},observations:[{date:'2026-08-15',actual:2,evidence:'TEST-EVIDENCE-A',recordedAt:'2026-08-15'},{date:'2026-09-01',actual:4,evidence:'TEST-EVIDENCE-B',recordedAt:'2026-09-01'}],...extra});
const mel=(extra:Partial<MelReportOptions>={}):MelReportOptions=>({organisation:'Fictional organisation',project:'',funder:false,sample:true,today:'2026-10-26',asOf:'2026-09-30',comparisonAsOf:'2026-08-31',assessments:[],milestones:[milestone()],assessmentSource:true,milestoneSource:true,selectedId:'',beforeId:'',analysis:null,...extra});

test('historical summer uses the same calendar boundaries as the book across New Year',()=>{
  const reference=new Date('2024-01-31T12:00:00'),bounds=financePeriodBounds('season',reference);
  assert.equal(bounds.start.getFullYear(),2023);assert.equal(bounds.start.getMonth(),11);
  assert.equal(bounds.end.getFullYear(),2024);assert.equal(bounds.end.getMonth(),2);
  assert.equal(isInFinancePeriod('2024-02-29T12:00:00','season',reference),true);
  assert.equal(isInFinancePeriod('2024-03-01T00:00:00','season',reference),false);
  assert.match(farmReportPeriod('season',reference,now),/2023-12-01 to 2024-02-29.*past calendar period/);
  assert.equal(farmComparisonReference('season',reference,'previous').getMonth(),8);
  assert.equal(farmComparisonReference('season',reference,'year').getFullYear(),2022);
});

test('a historical cash comparison reconciles linked invoices once and keeps preparation time current',()=>{
  const invoice:SavedInvoice={id:'paid',no:1,billTo:'PRIVATE',dateISO:'2024-12-04',paidAt:'2024-12-04',status:'paid',total:75,items:[{desc:'Recorded produce',qty:1,unit:'kg',price:75}]};
  const report=buildFarmReport(farm({sales:[{...sale('linked','2024-12-04',75),invoice_id:'paid'},sale('current','2025-01-10',25)],invoices:[invoice]}));
  assert.deepEqual(comparison(report).rows[0],['Money received','R75,00','R25,00','-R50,00']);
  assert.equal(report.date,'2026-10-26');
  assert.match(report.period,/2025-01-01 to 2025-01-31/);
  assert.ok(!JSON.stringify(report).includes('PRIVATE'));
  assert.match(comparison(report).note,/Unpaid invoices are today's snapshot/);
});

test('missing comparison books do not become zero income, zero costs or apparent improvement',()=>{
  const report=buildFarmReport(farm({sales:[sale('one','2025-01-10',20)]}));
  assert.deepEqual(comparison(report).rows[0],['Money received','No usable entries','R20,00','Not comparable']);
  assert.equal(comparison(report).rows[2][3],'Not comparable');
});

test('one invalid cash value withholds that period comparison rather than using its known subtotal',()=>{
  const report=buildFarmReport(farm({sales:[sale('old','2024-12-10',10),sale('known','2025-01-10',20),sale('bad','2025-01-11',Number.NaN)]}));
  assert.equal(comparison(report).rows[0][2],'No usable entries');assert.equal(comparison(report).rows[0][3],'Not comparable');
});

test('historical production compares each recorded unit without converting eggs or crates to weight',()=>{
  const report=buildFarmReport(farm({kind:'production',production:[harvest('a','2024-12-10',5),harvest('b','2025-01-10',7),{...harvest('eggs','2025-01-10',0),...recordQuantityPayload(12,'eggs')}]}));
  assert.deepEqual(comparison(report).rows.find(r=>r[0]==='Harvest · kg'),['Harvest · kg','5 kg','7 kg','+2 kg']);
  assert.deepEqual(comparison(report).rows.find(r=>r[0]==='Harvest · eggs'),['Harvest · eggs','No usable entries','12 eggs','Not comparable']);
});

test('an unknown quantity in one unit withholds that comparison without hiding the other units',()=>{
  const report=buildFarmReport(farm({kind:'production',production:[harvest('old','2024-12-10',5),harvest('known','2025-01-10',7),{...harvest('bad','2025-01-11',0),kg:null}]}));
  assert.equal(comparison(report).rows.find(r=>r[0]==='Harvest · kg')![3],'Not comparable');
});

test('historical monthly breakdowns retain the full selected year rather than the last twelve months today',()=>{
  const report=buildFarmReport(farm({period:'year',comparison:'none',sales:[sale('old','2025-01-10',20),sale('late','2025-12-10',30)]}));
  const table=report.tables.find(t=>t.title==='Month by month')!;
  assert.equal(table.rows.length,12);assert.equal(table.rows[0][0],'Jan 2025');assert.equal(table.rows.at(-1)![0],'Dec 2025');
  assert.equal(table.rows.at(-1)![1],'R30,00');
});

test('a one-month report does not inherit the chart authority’s minimum two-month frame',()=>{
  const report=buildFarmReport(farm({sales:[sale('old','2024-12-10',10),sale('selected','2025-01-10',20)]}));
  const table=report.tables.find(t=>t.title==='Month by month')!;
  assert.deepEqual(table.rows.map(row=>row[0]),['Jan 2025']);
  assert.equal(table.rows[0][1],'R20,00');
});

test('invalid or future reporting dates cannot produce a farmer export',()=>{
  assert.throws(()=>buildFarmReport(farm({reference:new Date('bad')})),/report date/);
  assert.throws(()=>buildFarmReport(farm({reference:new Date('2027-01-01')})),/report date/);
});

const programme=(extra:Partial<ProgrammeReportOptions>={}):ProgrammeReportOptions=>({rows:structuredClone(DEMO_NETWORK.farmers),monthly:structuredClone(DEMO_COHORT_MONTHLY),kind:'production',funder:true,sample:true,organisation:'Fictional organisation',basis:'window',withheldForConsent:0,date:'2026-10-26',...extra});
test('programme month ranges shift across years and retain the selected number of months',()=>{
  assert.deepEqual(programmeComparisonRange('2026-01','2026-03','previous'),{startMonth:'2025-10',endMonth:'2025-12'});
  assert.deepEqual(programmeComparisonRange('2026-01','2026-03','year'),{startMonth:'2025-01',endMonth:'2025-03'});
});

test('programme comparison refuses unavailable months and never relabels organisation history as a cohort',()=>{
  const o=programme(),month=o.monthly.months.at(-1)!;
  const opts={...o,startMonth:month.key,endMonth:month.key,comparison:{startMonth:'1900-01',endMonth:'1900-01'}};
  const report=buildProgrammeReport(opts),table=report.tables.find(t=>t.title==='Historical ledger comparison')!;
  assert.equal(table.rows[0][1],'Not available');assert.equal(table.rows[0][3],'Not comparable');
  assert.ok(!buildProgrammeReport({...opts,cohortId:'missing'}).tables.some(t=>t.title==='Historical ledger comparison'));
  assert.ok(!buildProgrammeReport({...opts,kind:'training'}).tables.some(t=>t.title==='Historical ledger comparison'));
});

test('programme comparison cannot hide an unshared month inside an otherwise readable range',()=>{
  const o=programme(),months=o.monthly.months.slice(-4);assert.equal(months.length,4);
  months.forEach(m=>{m.producedKg=10;m.hasRecords=true;});months[0].producedKg=null;
  const report=buildProgrammeReport({...o,startMonth:months[2].key,endMonth:months[3].key,comparison:{startMonth:months[0].key,endMonth:months[1].key}});
  const row=report.tables.find(t=>t.title==='Historical ledger comparison')!.rows[0];
  assert.equal(row[1],'Not available');assert.equal(row[3],'Not comparable');
});

test('comparison exports cannot overwrite a different baseline under the same downloaded filename',()=>{
  const o=programme({startMonth:'2026-09',endMonth:'2026-09'});
  const plain=buildProgrammeReport(o),previous=buildProgrammeReport({...o,comparison:{startMonth:'2026-08',endMonth:'2026-08'}}),year=buildProgrammeReport({...o,comparison:{startMonth:'2025-09',endMonth:'2025-09'}});
  const names=[plain,previous,year].map(r=>programmeReportFilename(r,o.date));
  assert.equal(new Set(names).size,3);assert.match(names[1],/vs-2026-08-to-2026-08/);
});

test('staff comparison dates use inclusive calendar days across leap day',()=>{
  assert.deepEqual(previousReportDateRange('2024-03-01','2024-03-02'),{from:'2024-02-28',to:'2024-02-29'});
  assert.equal(previousReportDateRange('2024-02-30','2024-03-01'),null);
  assert.equal(previousReportDateRange('2024-03-02','2024-03-01'),null);
});

test('mentor period comparisons exclude current action counts and retain the selected participant',()=>{
  const data=freshFieldWorkspace(),visit=data.visits[0];
  data.visits=[{...visit,id:'old',date:'2026-08-01'},{...visit,id:'later',date:'2026-08-03'},{...visit,id:'outside-person',farmerId:'different',date:'2026-08-03'}];
  const report=buildFieldReport(data,{from:'2026-08-03',to:'2026-08-04',farmerId:visit.farmerId,today:'2026-10-26',comparePrevious:true});
  const table=report.tables.find(t=>t.title==='Historical fieldwork comparison')!;
  assert.deepEqual(table.rows[0],['Saved visits','1','1','0']);
  assert.ok(!table.rows.some(row=>/action/i.test(row[0])));
});

test('facilitator comparisons keep project and record-owner filters on both sides',()=>{
  const s=freshEvidenceData().sessions[0];
  const report=buildTrainingReport([{...s,id:'old',date:'2026-08-01'},{...s,id:'new',date:'2026-08-03'},{...s,id:'other',date:'2026-08-03',project:'Other'}],{project:s.project,ownerId:s.ownerId,from:'2026-08-03',to:'2026-08-04',today:'2026-10-26',comparePrevious:true});
  assert.deepEqual(report.tables.find(t=>t.title==='Historical training delivery comparison')!.rows[0],['Sessions recorded','1','1','0']);
});

test('donor definitions require real dates, a denominator, basis and agreement reference',()=>{
  assert.equal(validProgrammeMilestone(milestone(),'2026-10-26'),true);
  for(const extra of [{code:''},{population:''},{disaggregation:''},{periodStart:'2026-02-30'},{periodEnd:'2026-07-01'},{basis:'sum-every-observation'}]) assert.equal(validProgrammeMilestone(milestone({donor:{...donor,...extra} as DonorIndicator}),'2026-10-26'),false);
  const cleaned=cleanDonorIndicator({...donor,funder:'  Fictional donor  ',unexpected:'PRIVATE'} as DonorIndicator);
  assert.equal(cleaned.funder,'Fictional donor');assert.ok(!JSON.stringify(cleaned).includes('PRIVATE'));
  assert.equal(validProgrammeMilestone(milestone({donor:undefined}),'2026-10-26'),true);
});

test('donor results use observations inside the agreement even when a later observation exists',()=>{
  const m=milestone();m.observations.push({date:'2026-10-01',actual:999,evidence:'OUTSIDE-PERIOD',recordedAt:'2026-10-01'});
  const report=buildMelEvidenceReport(mel({asOf:'2026-10-26',milestones:[m]}));
  const table=report.tables.find(t=>t.title==='Donor results & evidence checks')!;
  assert.match(table.rows[0][2],/4.*2026-09-01/);assert.ok(!JSON.stringify(table).includes('OUTSIDE-PERIOD'));
});

test('a historical milestone reading is not summed or presented as interval production',()=>{
  const report=buildMelEvidenceReport(mel());
  const table=report.tables.find(t=>t.title==='Historical milestone comparison')!;
  assert.match(table.rows[0][3],/^\+2/);assert.match(table.rows[0][3],/cumulative total/);
  const carry=buildMelEvidenceReport(mel({comparisonAsOf:'2026-09-10'})).tables.find(t=>t.title==='Historical milestone comparison')!;
  assert.match(carry.rows[0][3],/No new dated observation.*withheld/);
});

test('funder donor filters cannot recover private indicators or widen a vanished donor selection',()=>{
  const privateRecord=milestone({id:'private',title:'PRIVATE-INDICATOR',published:false});
  const report=buildMelEvidenceReport(mel({funder:true,donorName:donor.funder,milestones:[privateRecord]}));
  assert.ok(!JSON.stringify(report).includes('PRIVATE-INDICATOR'));assert.equal(report.metrics[0].value,'0');
  const absent=buildMelEvidenceReport(mel({donorName:'Donor no longer visible'}));
  assert.equal(absent.metrics[0].value,'0');
});

test('the SEF reporting reference remains optional and explicitly separates donor finance from farm cash',()=>{
  assert.ok(!buildMelEvidenceReport(mel()).tables.some(t=>t.title==='IDC / SEF reporting reference'));
  const table=buildMelEvidenceReport(mel({donorReference:'sef'})).tables.find(t=>t.title==='IDC / SEF reporting reference')!;
  assert.match(table.note,/May 2025/);assert.match(JSON.stringify(table),/Farmer sales and costs cannot substitute/);
});

test('invalid or reversed milestone cutoffs cannot produce a labelled historical comparison',()=>{
  assert.throws(()=>buildMelEvidenceReport(mel({comparisonAsOf:'2026-09-30'})),/cutoffs/);
  assert.throws(()=>buildMelEvidenceReport(mel({asOf:'2026-02-30'})),/cutoffs/);
});

test('brief and full PDFs retain donor codes, period comparisons and evidence limits',async()=>{
  const report=buildMelEvidenceReport(mel({donorReference:'sef'}));
  for(const format of ['summary','full'] as const){
    const pdf=await buildProgrammePdf(report.title,true,report.sections,format,undefined,[],'Evidence',undefined,{metrics:report.metrics,tables:report.tables,date:'2026-10-26'});
    const text=pdfContentStreams(pdf.output('arraybuffer'));
    assert.match(text,/TEST-AGREEMENT/);assert.match(text,/TEST-01/);assert.match(text,/Historical milestone comparison/);assert.match(text,/IDC \/ SEF reporting reference/);
  }
});

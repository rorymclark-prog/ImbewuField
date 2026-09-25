import { numberLabel } from '@/lib/format-figures';
import type { CompletionScoreInputs } from './completion-score';
import type { EvidenceItem } from './site-evidence';
import { hasDrawnDesign, type ReportSiteFacts } from './report-site-facts';

export type ReportDesignRecords = {
  /** Current site facts, never the earlier saved report's snapshot. */
  facts?: ReportSiteFacts | null;
  /** Same selected sheets the report displays; null while their metadata loads. */
  maps?: { count: number; latestAt?: string } | null;
};

function designPreparation(inputs: CompletionScoreInputs, records: ReportDesignRecords): ReportPreparation[] {
  const boundary = records.facts?.boundary;
  const perimeter = boundary?.perimeterM;
  const fenceM = records.facts?.design?.routes.filter(route => route.kind === 'fence')
    .reduce((sum, route) => sum + route.totalLengthM, 0) ?? 0;
  const number = (value: number) => numberLabel(value, 1);
  const dimensions = [
    boundary && boundary.areaM2 > 0 ? `Area ${number(boundary.areaM2)} m²` : '',
    perimeter && perimeter > 0 ? `perimeter ${number(perimeter)} m` : '',
  ].filter(Boolean).join(' · ');
  const fence = fenceM > 0 ? `Fence lines: ${number(fenceM)} m. These may include internal fences.` : '';
  const traced = inputs.boundaryPointCount >= 3 || !!dimensions;
  const hasDesign = inputs.zoneCount > 0 || inputs.elementCount > 0 || hasDrawnDesign(records.facts);
  const mapCount = records.maps?.count ?? 0;
  const latest = records.maps?.latestAt;
  const date = latest && Number.isFinite(Date.parse(latest))
    ? new Date(latest).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  return [
    {
      id: 'boundary', title: 'Boundary & measurements',
      status: dimensions ? 'Boundary measurements available' : fenceM > 0 ? 'Fence measurements available' : traced ? 'Boundary outline saved' : 'Boundary not recorded',
      hasRecord: traced || fenceM > 0,
      action: traced || fenceM > 0 ? 'View boundary and measurements' : 'Add boundary',
      detail: dimensions
        ? `${dimensions}. ${boundary?.source ?? ''}. ${fence} Use the saved dimensions; record any ground-check corrections in the design.`
        : `${traced ? 'The outline is saved; dimensions are not available in this view.' : fenceM > 0 ? 'A fence line does not establish the complete property outline.' : 'Trace the property outline in the Design Map to calculate its area and perimeter.'} ${fence}`.trim(),
    },
    {
      id: 'design', title: 'Site design',
      status: mapCount > 0 ? `${mapCount} saved design map${mapCount === 1 ? '' : 's'} available` : hasDesign ? 'Design records saved' : records.maps === null ? 'Checking saved design maps…' : 'Design not recorded',
      hasRecord: hasDesign || mapCount > 0,
      action: mapCount > 0 ? 'View saved design maps' : hasDesign ? 'View saved design' : 'Open Design Map',
      detail: mapCount > 0
        ? `Your saved sheets are available in this report${date ? `; latest saved ${date}` : ''}. Open them to review or include them in the full PDF.`
        : `${hasDesign ? 'Your saved layout is available in the Design Map. ' : ''}${records.maps === null ? 'Checking this browser for saved sheets.' : 'No saved map sheets found in this browser for this site. If you saved them on another device, open that device’s report.'}`,
    },
  ];
}

export type ReportPreparation = { id: 'photos'|'soil'|'water'|'survey'|'boundary'|'design'|'crops'; title:string; status:string; detail:string; action:string; hasRecord:boolean };
/** Presence is preparation, never a claim of accuracy, lab verification or a finished design. */
export function reportPreparation(inputs: CompletionScoreInputs, evidence: Record<string,EvidenceItem[]>, records: ReportDesignRecords = {}): ReportPreparation[] {
  const photos=Object.entries(evidence).filter(([key])=>!key.startsWith('land_legal_')&&!key.endsWith('_lab_result')).flatMap(([,rows])=>rows).filter(row=>row.type==='photo'&&!!row.dataUrl).length;
  function lab(kind:'soil'|'water'): ReportPreparation {
    const rows=evidence[`${kind}_lab_result`]??[];
    const notes=rows.some(row=>!!row.note?.trim());
    const files=rows.some(row=>!!row.documentId||row.type==='photo'&&!!row.dataUrl);
    const references=rows.some(row=>row.type==='pdf'&&!!row.name);
    return {id:kind,title:kind==='soil'?'Soil sample & test results':'Water sample & test results',status:notes?'Results entered · review source':files?'Document added · enter key results':references?'Filename only · original needed':'Test results not recorded',hasRecord:notes||files,action:kind==='soil'?'Add soil test results':'Add water test results',detail:'Add the sampling date, location / sample ID, laboratory and results with units. Retain the original PDF or photograph and enter the values the report should use.'};
  }
  return [
    {id:'photos',title:'Site photographs',status:photos?`${photos} site photograph${photos===1?'':'s'} saved`:'Site photos needed',hasRecord:photos>0,action:'Add site photos',detail:'Show the whole site, growing areas, slopes, access and water sources. Include views that explain the conditions on the ground.'},
    lab('soil'),lab('water'),
    {id:'survey',title:'Site & household survey',status:`${inputs.surveyFilledFields} of ${inputs.surveyTotalFields} key checks recorded`,hasRecord:inputs.surveyFilledFields>0,action:'Complete or review survey',detail:'Record your goals, people, current production, water access, soil observations and challenges. Review the full survey before generating.'},
    ...designPreparation(inputs, records),
    {id:'crops',title:'Planting plan',status:inputs.hasCropPlan?'Plantings recorded · review coverage':'Planting plan not recorded',hasRecord:inputs.hasCropPlan,action:'Complete planting plan',detail:'Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.'},
  ];
}

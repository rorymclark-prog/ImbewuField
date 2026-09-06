import type { CompletionScoreInputs } from './completion-score';
import type { EvidenceItem } from './site-evidence';

export type ReportPreparation = { id: 'photos'|'soil'|'water'|'survey'|'boundary'|'design'|'crops'; title:string; status:string; detail:string; action:string; hasRecord:boolean };
/** Presence is preparation, never a claim of accuracy, lab verification or a finished design. */
export function reportPreparation(inputs: CompletionScoreInputs, evidence: Record<string,EvidenceItem[]>): ReportPreparation[] {
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
    {id:'boundary',title:'Boundary & measurements',status:inputs.boundaryPointCount>=3?'Boundary traced · check on the ground':'Boundary still needs tracing',hasRecord:inputs.boundaryPointCount>=3,action:'Trace or check boundary',detail:'Trace the site and key structures, then check their dimensions. A map outline does not replace a measured survey.'},
    {id:'design',title:'Site design',status:inputs.zoneCount||inputs.elementCount?'Design started · review layout':'Design not started',hasRecord:inputs.zoneCount>0||inputs.elementCount>0,action:'Complete or review design',detail:'Place beds, water systems, access, structures and planting areas. Distinguish existing features from proposed work.'},
    {id:'crops',title:'Planting plan',status:inputs.hasCropPlan?'Plantings recorded · review coverage':'Planting plan not recorded',hasRecord:inputs.hasCropPlan,action:'Complete planting plan',detail:'Choose crops for the site’s beds and record planting dates. Check any areas that still have no plan.'},
  ];
}

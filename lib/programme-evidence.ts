import { SAMPLE_BRANDING } from './sample-branding';
import { validFieldId } from './field-teams';
import { PROGRESS_TEMPLATES, validProgressArea, type ProgressArea } from './programme-progress';
import { validEvidenceImage } from './invoice-logo';
export { validEvidenceImage } from './invoice-logo';

export type ProgrammeLogo = { label: string; image: string };
export type ProgrammeBranding = { organisation: ProgrammeLogo; garden: ProgrammeLogo; funder: ProgrammeLogo };
export type VenuePhoto = { image: string; caption: string };
export type Attendance = { id: string; name: string; present: boolean };
export type TrainingRecord = {
  id: string; project: string; title: string; date: string; venue: string; latitude: number | null; longitude: number | null;
  facilitator: string; ownerId: string; attendance: Attendance[]; presentCount: number; registeredCount: number;
  report: string; nextSteps: string; assessmentId: string; published: boolean; photos: VenuePhoto[]; photoCount: number; updatedAt: string;
};
export type MilestoneObservation = { date: string; actual: number; evidence: string; recordedAt: string };
export type ProgrammeMilestone = { id: string; project: string; title: string; category?: ProgressArea; unit: string; baseline: number | null; target: number | null; due: string; owner: string; method: string; published: boolean; observations: MilestoneObservation[]; updatedAt: string };
export type EvidenceData = { brandingOnly?: boolean; sessions: TrainingRecord[]; milestones: ProgrammeMilestone[]; branding: ProgrammeBranding; people: { id: string; name: string }[]; assessments: { id: string; title: string }[]; canManage: boolean; canRecord: boolean; canBrand: boolean; sample: boolean; revision: string };
export const blankBranding = (): ProgrammeBranding => ({ organisation: { label: '', image: '' }, garden: { label: '', image: '' }, funder: { label: '', image: '' } });
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
export const validEvidenceDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export function validProgrammeBranding(b: unknown): b is ProgrammeBranding { return !!b && typeof b === 'object' && ['organisation','garden','funder'].every(key => { const l = (b as Record<string, ProgrammeLogo>)[key]; return !!l && text(l.label, 120) && (l.image === '' || validEvidenceImage(l.image)); }); }
export function validTrainingRecord(s: unknown, today: string): s is TrainingRecord {
  if (!s || typeof s !== 'object') return false; const r = s as TrainingRecord;
  return validFieldId(r.id) && text(r.project,120,true) && text(r.title,160,true) && validEvidenceDate(r.date) && r.date <= today
    && text(r.venue,160,true) && ((r.latitude === null && r.longitude === null) || typeof r.latitude === 'number' && Number.isFinite(r.latitude) && Math.abs(r.latitude)<=90 && typeof r.longitude === 'number' && Number.isFinite(r.longitude) && Math.abs(r.longitude)<=180)
    && text(r.facilitator,120,true) && text(r.report,4000,true) && text(r.nextSteps,2000) && text(r.assessmentId,128) && (!r.assessmentId || validFieldId(r.assessmentId))
    && typeof r.published === 'boolean' && Array.isArray(r.attendance) && r.attendance.length<=250 && new Set(r.attendance.map(a=>a?.id)).size === r.attendance.length
    && r.attendance.every(a=>!!a && validFieldId(a.id) && text(a.name,120,true) && typeof a.present === 'boolean')
    && Array.isArray(r.photos) && r.photos.length<=2 && r.photos.every(p=>!!p && validEvidenceImage(p.image) && text(p.caption,240,true));
}
export function validProgrammeMilestone(s: unknown, today: string): s is ProgrammeMilestone {
  if (!s || typeof s !== 'object') return false; const m=s as ProgrammeMilestone;
  return validFieldId(m.id) && text(m.project,120,true) && text(m.title,160,true) && text(m.unit,40,true) && (m.baseline===null || Number.isFinite(m.baseline) && m.baseline>=0)
    && (m.category === undefined || validProgressArea(m.category))
    && (m.target === null || Number.isFinite(m.target) && m.target>0) && validEvidenceDate(m.due) && text(m.owner,120,true) && text(m.method,1000,true) && typeof m.published==='boolean'
    && Array.isArray(m.observations) && m.observations.length<=100 && new Set(m.observations.map(o=>o?.date)).size===m.observations.length
    && m.observations.every(o=>!!o && validEvidenceDate(o.date) && o.date<=today && Number.isFinite(o.actual) && o.actual>=0 && text(o.evidence,1500,true));
}
export function milestoneAt(m: ProgrammeMilestone, date: string) {
  const observation=m.observations.filter(o=>o.date<=date).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const actual=observation?.actual ?? null;
  return { actual, percent: actual===null || m.target===null ? null : actual/m.target*100, remaining: actual===null || m.target===null ? null : Math.max(0,m.target-actual), status: m.target===null ? (actual===null ? 'Awaiting evidence' : 'Reported · no target') : actual!==null && actual>=m.target ? 'Target met' : m.due<date ? 'Overdue' : 'In progress', evidence: observation?.evidence ?? 'No observation by this date', observedOn: observation?.date ?? null };
}
/** Never send attendee names, private next steps, staff IDs or precise venue coordinates to a funder. */
export function publishedTraining(r: TrainingRecord): TrainingRecord {
  return { id:r.id, project:r.project, title:r.title, date:r.date, venue:r.venue, latitude:null, longitude:null, facilitator:'', ownerId:'', attendance:[], presentCount:r.presentCount, registeredCount:r.registeredCount, report:r.report, nextSteps:'', assessmentId:'', published:true, photos:r.photos, photoCount:r.photoCount, updatedAt:r.updatedAt };
}
export function trainingTotals(sessions: TrainingRecord[], asOf: string, deduplicated = true) {
  const records=sessions.filter(s=>s.date<=asOf);
  return { sessions:records.length, attendances:records.reduce((n,s)=>n+s.presentCount,0), uniqueParticipants:deduplicated ? new Set(records.flatMap(s=>s.attendance.filter(a=>a.present).map(a=>a.id))).size : null };
}
export function freshEvidenceData(): EvidenceData {
  const attendance=[{id:'s1',name:'Nomvula Dlamini',present:true},{id:'s2',name:'Sipho Nkosi',present:true}];
  const project='Garden delivery · August 2026';
  // Rory asked the tour to demonstrate a whole programme, not an almost-empty
  // training register. These invented observations belong only to the disposable
  // six-garden delivery cohort; they are not added to the live portfolio totals.
  const examples: { template: string; target: number | null; actual: [number,number]; evidence: [string,string]; baseline?: number }[] = [
    { template:'gardens', target:6, actual:[2,4], evidence:[
      'GP-01 and GP-02: dated bed checks show growing crops; the other four gardens are still being prepared.',
      'GP-01 to GP-04 have planted beds and harvest entries. GP-05 and GP-06 remain in preparation; six distinct garden codes were checked.',
    ] },
    { template:'vegetable-area', target:900, actual:[320,640], evidence:[
      'Bed measurements GP-01 and GP-02: 160 m² planted at each garden. Paths and storage areas excluded.',
      'Checked bed schedules GP-01 to GP-04: 160 m² per garden, 640 m² combined. No overlap with paths, buildings or restoration strips.',
    ] },
    { template:'harvest', target:1800, actual:[540,1260], evidence:[
      'Harvest register H-08, 1–15 August: 540 kg weighed after subtracting empty-container weight.',
      'Harvest register H-08, 1–31 August: 1,260 kg from GP-01 to GP-04. Disposition check: 744 kg sold, 432 kg used for food and 84 kg in storage.',
    ] },
    { template:'food-distributed', target:600, actual:[180,432], evidence:[
      'Food-use register F-08: 180 kg retained by participating households or delivered for community meals, with each transfer counted once.',
      'Food-use register F-08: 432 kg reached 32 distinct households. This is part of the 1,260 kg harvest, not additional production.',
    ] },
    { template:'storage', target:30000, actual:[10000,20000], evidence:[
      'Installation checks W-01 and W-02: two installed 5,000-litre tanks at GP-01 and GP-02.',
      'Installation checks W-01 to W-04: four installed 5,000-litre tanks, one at each producing garden. The two tanks planned for GP-05 and GP-06 are excluded.',
    ] },
    { template:'water-collected', target:null, actual:[6200,14500], evidence:[
      'Collection log W-08: inlet readings total 6,200 litres during 1–15 August. This measures water collected, not tank size.',
      'Collection log W-08: inlet readings total 14,500 litres during August. Water drawn from storage is logged separately; the collection total is not water remaining.',
    ] },
    { template:'trees', target:90, actual:[72,72], evidence:[
      'Planting register T-08: 72 individually coded trees established on 8 August across six gardens; no replacement trees included.',
      'Register T-08 remains at 72 planted trees. The remaining 18 are planned and have not been counted as planted.',
    ] },
    { template:'surviving-trees', target:null, baseline:72, actual:[70,67], evidence:[
      'First check of the fixed 72-tree cohort planted on 8 August: 70 alive and two lost. All original tree codes revisited.',
      'Follow-up of the same 72 original tree codes: 67 alive and five lost. Replacements are recorded separately and do not increase survival.',
    ] },
    { template:'soil', target:6, actual:[2,4], evidence:[
      'Soil-check sheets S-01 and S-02 have matched baseline and follow-up observations using the same sampling depth and method.',
      'Sheets S-01 to S-04 contain paired checks for four gardens; GP-05 and GP-06 still need follow-up. Completion is recorded here, not a claim of improved soil.',
    ] },
    { template:'restored-area', target:600, actual:[225,450], evidence:[
      'Restoration map R-08 marks 225 m² of mulched and protected ground outside the vegetable-bed footprints.',
      'R-08 checks confirm 450 m² under mulch and planted cover across six gardens. Areas are measured once; later vegetation establishment needs another check.',
    ] },
    { template:'sales', target:20000, actual:[6200,14880], evidence:[
      'Sales register INV-GP-08: paid produce invoices total R6,200 for 310 kg during 1–15 August.',
      'August paid invoices in INV-GP-08 total R14,880 for 744 kg. Recorded input and transport costs are R5,200; turnover is shown here, with costs kept separate.',
    ] },
    { template:'paid-work', target:60, actual:[20,44], evidence:[
      'Work register PW-08: five workers completed 20 paid person-days; one day is six recorded working hours.',
      'PW-08 and payment records: eight distinct workers completed 44 paid person-days. Repeat days are counted as work days, not new workers.',
    ] },
    { template:'households', target:40, actual:[18,32], evidence:[
      'Household register HH-08: 18 distinct household codes received produce or a recorded garden service; repeat visits deduplicated.',
      'HH-08: 32 distinct households reached during August, including the households in F-08. Multiple household members and repeat deliveries count once.',
    ] },
    { template:'skills', target:12, actual:[2,2], evidence:[
      'Practical checklist SK-08 for training record sample-training-1: two participants demonstrated reading the bed plan and recording a weighed harvest.',
      'SK-08 follow-up: the same two participants passed the agreed practical checklist again. Repeat assessments did not add new participants.',
    ] },
    { template:'visits', target:12, actual:[3,8], evidence:[
      'Visit register V-08: three completed garden visits have dated observations and agreed next actions.',
      'V-08: eight completed visits across six gardens. Two repeat visits are included in the visit count; planned visits are excluded.',
    ] },
    { template:'actions', target:12, actual:[4,9], evidence:[
      'Action register A-08: four of 12 agreed actions have a completion date and a checked result.',
      'A-08: nine of 12 actions completed. Three remain open: finish GP-05 beds, finish GP-06 beds and collect their follow-up soil checks.',
    ] },
  ];
  const milestones: ProgrammeMilestone[] = examples.map(example=>{
    const template=PROGRESS_TEMPLATES.find(t=>t.id===example.template)!;
    return { id:`sample-progress-${template.id}`,project,title:template.title,category:template.category,unit:template.unit,
      baseline:example.baseline??0,target:example.target,due:'2026-11-30',owner:'Programme coordinator',published:true,
      method:`${template.method} Scope: six gardens, GP-01 to GP-06; the August 2026 delivery period. Observations on 15 August cover activity to that date; the 1 September observation closes 31 August.`,
      observations:example.actual.map((actual,index)=>({ date:index===0?'2026-08-15':'2026-09-01',actual,evidence:example.evidence[index],recordedAt:index===0?'2026-08-15T12:00:00Z':'2026-09-01T12:00:00Z' })),
      updatedAt:'2026-09-01T12:00:00Z',
    };
  });
  return { sessions:[{id:'sample-training-1',project,title:'Practical garden planning',date:'2026-08-15',venue:'Community training garden',latitude:null,longitude:null,facilitator:'Sibusiso Ndlovu',ownerId:'sample-mentor',attendance,presentCount:2,registeredCount:2,report:'Participants practised reading the bed plan, weighing a harvest and completing the production record. Both demonstrated the steps against the practical checklist.',nextSteps:'Review the next crop plan during the follow-up visit.',assessmentId:'',published:true,photos:[],photoCount:0,updatedAt:'2026-08-15T12:00:00Z'}], milestones:[{id:'sample-training-target',category:'learning',project,title:'Practical training sessions delivered',unit:'sessions',baseline:0,target:4,due:'2026-11-30',owner:'Programme coordinator',method:'Count completed sessions with an attendance register and session report. Cumulative total; repeated attendees are not new people.',published:true,observations:[{date:'2026-08-15',actual:1,evidence:'Training register, 15 August: Practical garden planning; two recorded attendances and a completed session report.',recordedAt:'2026-08-15T12:00:00Z'}],updatedAt:'2026-08-15T12:00:00Z'},...milestones], branding: structuredClone(SAMPLE_BRANDING), people:attendance.map(({id,name})=>({id,name})),assessments:[],canManage:true,canRecord:true,canBrand:true,sample:true,revision:'' };
}

/** Existing tours gain the new examples without replacing a visitor's edits. */
export function completeSampleEvidence(data: EvidenceData): EvidenceData {
  if (!data.sample) return data;
  const fresh=freshEvidenceData();
  const sessionIds=new Set(data.sessions.map(s=>s.id));
  const milestoneIds=new Set(data.milestones.map(m=>m.id));
  return { ...data,
    sessions:[...data.sessions,...fresh.sessions.filter(s=>!sessionIds.has(s.id))],
    milestones:[...data.milestones,...fresh.milestones.filter(m=>!milestoneIds.has(m.id))],
  };
}

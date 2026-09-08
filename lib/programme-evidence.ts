import { TOUR_TRAINING_PHOTOS } from './sample-training-media';
import { SAMPLE_BRANDING } from './sample-branding';
import { validFieldId } from './field-teams';
import { PROGRESS_TEMPLATES, validProgressArea, type ProgressArea } from './programme-progress';
import { analyseAssessment, validAnswers, type MelAssessment, type MelResponse } from './mel';
import { MEL_TEMPLATES } from './mel-templates';

export type ProgrammeLogo = { label: string; image: string };
export type ProgrammeBranding = { organisation: ProgrammeLogo; garden: ProgrammeLogo; funder: ProgrammeLogo };
export const TRAINING_PHOTO_KINDS = { activity: 'Training activities', group: 'Group photograph', certificates: 'Certificates of attendance', venue: 'Training venue', register: 'Signed paper register' } as const;
export type TrainingPhotoKind = keyof typeof TRAINING_PHOTO_KINDS;
export type VenuePhoto = { image: string; caption: string; kind?: TrainingPhotoKind; shared?: boolean };
export type AttendanceSignature = { strokes: [number, number][][]; signedAt: string };
export type Attendance = { id: string; name: string; present: boolean; reference?: string; signature?: AttendanceSignature; certificate?: string };
export type TrainingFeedback = { participantId: string; answers: Record<string,string>; language: 'en'|'zu'; consent: true; recordedAt: string };
export const TRAINING_FEEDBACK_TEMPLATE = { ...MEL_TEMPLATES.course_after, questions: MEL_TEMPLATES.course_after.questions.filter(q=>['course_clear','course_practice','course_language','course_change','course_apply'].includes(q.id)) };
export type TrainingRecord = {
  id: string; project: string; title: string; date: string; venue: string; latitude: number | null; longitude: number | null;
  facilitator: string; ownerId: string; attendance: Attendance[]; presentCount: number; registeredCount: number;
  report: string; nextSteps: string; assessmentId: string; published: boolean; photos: VenuePhoto[]; photoCount: number; updatedAt: string;
  feedback?: TrainingFeedback[]; feedbackSummary?: ReturnType<typeof analyseAssessment>;
};
export type MilestoneObservation = { date: string; actual: number; evidence: string; recordedAt: string };
export type ProgrammeMilestone = { id: string; project: string; title: string; category?: ProgressArea; unit: string; baseline: number | null; target: number | null; due: string; owner: string; method: string; published: boolean; observations: MilestoneObservation[]; updatedAt: string };
export type EvidenceData = { brandingOnly?: boolean; sessions: TrainingRecord[]; milestones: ProgrammeMilestone[]; branding: ProgrammeBranding; people: { id: string; name: string }[]; assessments: { id: string; title: string }[]; canManage: boolean; canRecord: boolean; canBrand: boolean; canAssess?: boolean; canAnalyse?: boolean; sample: boolean; revision: string };
export const blankBranding = (): ProgrammeBranding => ({ organisation: { label: '', image: '' }, garden: { label: '', image: '' }, funder: { label: '', image: '' } });
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
export const validEvidenceDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export const validEvidenceImage = (s: unknown): s is string => typeof s === 'string' && s.length <= 200000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
export function validAttendanceSignature(value: unknown): value is AttendanceSignature {
  if (!value || typeof value !== 'object') return false;
  const s = value as AttendanceSignature;
  return text(s.signedAt, 30, true) && Number.isFinite(Date.parse(s.signedAt)) && Array.isArray(s.strokes) && s.strokes.length > 0 && s.strokes.length <= 40
    && s.strokes.every(stroke => Array.isArray(stroke) && stroke.length >= 2 && stroke.every(p => Array.isArray(p) && p.length === 2 && p.every(n => Number.isInteger(n) && n >= 0 && n <= 1000)))
    && s.strokes.reduce((n, stroke) => n + stroke.length, 0) <= 800;
}
/** Paper registers and unreviewed photographs never enter a funder projection. */
export function sharedTrainingPhotos(photos: VenuePhoto[]) {
  return photos.filter(p => p.kind !== 'register' && p.shared === true);
}
/** Firestore forbids nested arrays. Store bounded drawing coordinates as JSON,
 * and restore the public wire format before any projection or edit. */
export function trainingForStorage(record: TrainingRecord) {
  return {...record,attendance:record.attendance.map(({signature,...a})=>({...a,...(signature?{signature:{signedAt:signature.signedAt,strokesJson:JSON.stringify(signature.strokes)}}:{})}))};
}
export function trainingFromStorage(value: unknown): TrainingRecord {
  const record=value as TrainingRecord;
  return {...record,attendance:(record.attendance??[]).map(({signature,...a})=>{
    if (!signature) return a;
    const saved=signature as AttendanceSignature & {strokesJson?:string};
    try {
      const restored={signedAt:saved.signedAt,strokes:saved.strokesJson?JSON.parse(saved.strokesJson):saved.strokes};
      return validAttendanceSignature(restored)?{...a,signature:restored}:a;
    } catch { return a; }
  })};
}
export function trainingEvidenceSummary(s: TrainingRecord) {
  const present = s.attendance.filter(a => a.present);
  return { signed: present.filter(a => a.signature).length, certificates: present.filter(a => a.certificate?.trim()).length, photos: s.photoCount, attendanceRate: s.registeredCount ? Math.round(s.presentCount / s.registeredCount * 100) : null };
}
export function trainingFeedbackSummary(s: TrainingRecord, funder = false) {
  if (funder && s.feedbackSummary) return s.feedbackSummary;
  const a: MelAssessment = { id:s.id,orgId:s.project,project:s.project,title:s.title,stage:'course_after',version:1,participantIds:s.attendance.filter(p=>p.present).map(p=>p.id),due:s.date,state:'closed',published:s.published,createdAt:s.updatedAt,updatedAt:s.updatedAt,action:'',actionOwner:'',actionDue:'',actionDone:false };
  const rows: MelResponse[]=(s.feedback??[]).map(r=>({assessmentId:s.id,orgId:s.project,participantId:r.participantId,version:1,answers:r.answers,language:r.language,consent:r.consent,submittedAt:r.recordedAt}));
  return analyseAssessment(a,TRAINING_FEEDBACK_TEMPLATE,rows,funder);
}
export function validProgrammeBranding(b: unknown): b is ProgrammeBranding { return !!b && typeof b === 'object' && ['organisation','garden','funder'].every(key => { const l = (b as Record<string, ProgrammeLogo>)[key]; return !!l && text(l.label, 120) && (l.image === '' || validEvidenceImage(l.image)); }); }
export function validTrainingRecord(s: unknown, today: string): s is TrainingRecord {
  if (!s || typeof s !== 'object') return false; const r = s as TrainingRecord;
  return validFieldId(r.id) && text(r.project,120,true) && text(r.title,160,true) && validEvidenceDate(r.date) && r.date <= today
    && text(r.venue,160,true) && ((r.latitude === null && r.longitude === null) || typeof r.latitude === 'number' && Number.isFinite(r.latitude) && Math.abs(r.latitude)<=90 && typeof r.longitude === 'number' && Number.isFinite(r.longitude) && Math.abs(r.longitude)<=180)
    && text(r.facilitator,120,true) && text(r.report,4000,true) && text(r.nextSteps,2000) && text(r.assessmentId,128) && (!r.assessmentId || validFieldId(r.assessmentId))
    && typeof r.published === 'boolean' && Array.isArray(r.attendance) && r.attendance.length<=250 && new Set(r.attendance.map(a=>a?.id)).size === r.attendance.length
    && r.attendance.every(a=>!!a && validFieldId(a.id) && text(a.name,120,true) && typeof a.present === 'boolean'
      && (a.reference === undefined || text(a.reference,80)) && (a.certificate === undefined || text(a.certificate,80))
      && (a.signature === undefined || a.present && validAttendanceSignature(a.signature) && a.signature.signedAt.slice(0,10) <= today))
    && (r.feedback === undefined || Array.isArray(r.feedback) && r.feedback.length <= 250 && new Set(r.feedback.map(f=>f?.participantId)).size===r.feedback.length
      && r.feedback.every(f=>!!f && r.attendance.some(a=>a.id===f.participantId&&a.present) && f.consent===true && ['en','zu'].includes(f.language) && text(f.recordedAt,30,true) && Number.isFinite(Date.parse(f.recordedAt)) && f.recordedAt.slice(0,10)<=today && validAnswers(TRAINING_FEEDBACK_TEMPLATE,f.answers) && Object.values(f.answers).some(a=>a.trim())))
    && new TextEncoder().encode(JSON.stringify({attendance:r.attendance,feedback:r.feedback})).length <= 650000
    && Array.isArray(r.photos) && r.photos.length<=8 && r.photos.every(p=>!!p && validEvidenceImage(p.image) && text(p.caption,240,true)
      && (p.kind === undefined || Object.hasOwn(TRAINING_PHOTO_KINDS,p.kind)) && (p.shared === undefined || typeof p.shared === 'boolean') && !(p.kind === 'register' && p.shared))
    && r.photos.reduce((n,p)=>n+p.image.length,0) <= 600000;
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
  const photos=sharedTrainingPhotos(r.photos);
  return { id:r.id, project:r.project, title:r.title, date:r.date, venue:r.venue, latitude:null, longitude:null, facilitator:'', ownerId:'', attendance:[], presentCount:r.presentCount, registeredCount:r.registeredCount, report:r.report, nextSteps:'', assessmentId:'', published:true, photos, photoCount:(r as TrainingRecord & {sharedPhotoCount?:number}).sharedPhotoCount ?? photos.length, updatedAt:r.updatedAt,feedbackSummary:trainingFeedbackSummary(r,true) };
}
export function trainingTotals(sessions: TrainingRecord[], asOf: string, deduplicated = true) {
  const records=sessions.filter(s=>s.date<=asOf);
  return { sessions:records.length, attendances:records.reduce((n,s)=>n+s.presentCount,0), uniqueParticipants:deduplicated ? new Set(records.flatMap(s=>s.attendance.filter(a=>a.present).map(a=>a.id))).size : null };
}
export function freshEvidenceData(): EvidenceData {
  const attendance:Attendance[]=[
    {id:'s1',name:'Nomvula Dlamini',present:true,reference:'GP-01-001',certificate:'ATT-2026-0815-001',signature:{signedAt:'2026-08-15T12:00:00Z',strokes:[[[60,780],[110,200],[160,680],[210,250],[250,660],[300,500],[340,550],[390,400],[450,510],[530,440],[590,530],[650,420],[720,500],[880,380]],[[260,800],[600,700],[920,650]]]}},
    {id:'s2',name:'Sipho Nkosi',present:true,reference:'GP-01-002',certificate:'ATT-2026-0815-002',signature:{signedAt:'2026-08-15T12:03:00Z',strokes:[[[230,240],[140,170],[60,290],[150,430],[240,540],[190,720],[60,680]],[[270,680],[330,250],[380,610],[450,360],[500,620],[570,450],[620,560],[700,400],[760,490],[920,420]]]}}
  ];
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
  return { sessions:[{id:'sample-training-1',project,title:'Practical garden planning',date:'2026-08-15',venue:'Community training garden · Ubhejane',latitude:-27.726231,longitude:31.963044,facilitator:'Sibusiso Ndlovu',ownerId:'sample-mentor',attendance,presentCount:2,registeredCount:2,report:'Participants practised reading the bed plan, weighing a harvest and completing the production record. Both demonstrated the steps against the practical checklist.',nextSteps:'Review the next crop plan during the follow-up visit.',assessmentId:'sample-course_after',published:true,photos:structuredClone(TOUR_TRAINING_PHOTOS),photoCount:TOUR_TRAINING_PHOTOS.length,feedback:[
      {participantId:'s1',answers:{course_clear:'5',course_practice:'5',course_language:'yes',course_change:'Allow more time to practise recording the harvest.',course_apply:'Weigh and record the next harvest before sharing it.'},language:'en',consent:true,recordedAt:'2026-08-15T12:20:00Z'},
      {participantId:'s2',answers:{course_clear:'4',course_practice:'5',course_language:'yes',course_change:'Bring a second scale so both participants can practise together.',course_apply:'Check the bed labels against the planting plan.'},language:'en',consent:true,recordedAt:'2026-08-15T12:24:00Z'}],updatedAt:'2026-08-15T12:00:00Z'}], milestones:[{id:'sample-training-target',category:'learning',project,title:'Practical training sessions delivered',unit:'sessions',baseline:0,target:4,due:'2026-11-30',owner:'Programme coordinator',method:'Count completed sessions with an attendance register and session report. Cumulative total; repeated attendees are not new people.',published:true,observations:[{date:'2026-08-15',actual:1,evidence:'Training register, 15 August: Practical garden planning; two recorded attendances and a completed session report.',recordedAt:'2026-08-15T12:00:00Z'}],updatedAt:'2026-08-15T12:00:00Z'},...milestones], branding: structuredClone(SAMPLE_BRANDING), people:attendance.map(({id,name})=>({id,name})),assessments:[],canManage:true,canRecord:true,canBrand:true,sample:true,revision:'' };
}

/** Existing tours gain the new examples without replacing a visitor's edits. */
export function completeSampleEvidence(data: EvidenceData): EvidenceData {
  if (!data.sample) return data;
  const fresh=freshEvidenceData();
  const sessionIds=new Set(data.sessions.map(s=>s.id));
  const milestoneIds=new Set(data.milestones.map(m=>m.id));
  return { ...data,
    sessions:[...data.sessions.map(s=>s.id==='sample-training-1'&&s.updatedAt==='2026-08-15T12:00:00Z'&&s.photos.length===0&&s.feedback===undefined?fresh.sessions[0]:s),...fresh.sessions.filter(s=>!sessionIds.has(s.id))],
    milestones:[...data.milestones,...fresh.milestones.filter(m=>!milestoneIds.has(m.id))],
  };
}

import { validFieldId } from './field-teams';

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
export type ProgrammeMilestone = { id: string; project: string; title: string; unit: string; baseline: number | null; target: number; due: string; owner: string; method: string; published: boolean; observations: MilestoneObservation[]; updatedAt: string };
export type EvidenceData = { brandingOnly?: boolean; sessions: TrainingRecord[]; milestones: ProgrammeMilestone[]; branding: ProgrammeBranding; people: { id: string; name: string }[]; assessments: { id: string; title: string }[]; canManage: boolean; canRecord: boolean; canBrand: boolean; sample: boolean; revision: string };
export const blankBranding = (): ProgrammeBranding => ({ organisation: { label: '', image: '' }, garden: { label: '', image: '' }, funder: { label: '', image: '' } });
const text = (v: unknown, max: number, required = false): v is string => typeof v === 'string' && v.length <= max && (!required || v.trim().length > 0);
export const validEvidenceDate = (s: unknown): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && Number.isFinite(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
export const validEvidenceImage = (s: unknown): s is string => typeof s === 'string' && s.length <= 200000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/.test(s);
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
    && Number.isFinite(m.target) && m.target>0 && validEvidenceDate(m.due) && text(m.owner,120,true) && text(m.method,1000,true) && typeof m.published==='boolean'
    && Array.isArray(m.observations) && m.observations.length<=100 && new Set(m.observations.map(o=>o?.date)).size===m.observations.length
    && m.observations.every(o=>!!o && validEvidenceDate(o.date) && o.date<=today && Number.isFinite(o.actual) && o.actual>=0 && text(o.evidence,1500,true));
}
export function milestoneAt(m: ProgrammeMilestone, date: string) {
  const observation=m.observations.filter(o=>o.date<=date).sort((a,b)=>a.date.localeCompare(b.date)).at(-1);
  const actual=observation?.actual ?? null;
  return { actual, percent: actual===null ? null : actual/m.target*100, remaining: actual===null ? null : Math.max(0,m.target-actual), status: actual!==null && actual>=m.target ? 'Target met' : m.due<date ? 'Overdue' : 'In progress', evidence: observation?.evidence ?? 'No observation by this date', observedOn: observation?.date ?? null };
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
  const attendance=[{id:'s1',name:'Nomvula Dlamini (sample)',present:true},{id:'s2',name:'Sipho Nkosi (sample)',present:true}];
  return { sessions:[{id:'sample-training-1',project:'Demonstration programme',title:'Practical garden planning',date:'2026-08-15',venue:'Example community training garden',latitude:null,longitude:null,facilitator:'Sample mentor',ownerId:'sample-mentor',attendance,presentCount:2,registeredCount:2,report:'Fictional session: participants practised reading a garden plan and recording a harvest.',nextSteps:'Review the next crop plan during the follow-up visit.',assessmentId:'',published:true,photos:[],photoCount:0,updatedAt:'2026-08-15T12:00:00Z'}], milestones:[{id:'sample-training-target',project:'Demonstration programme',title:'Practical training sessions delivered',unit:'sessions',baseline:0,target:4,due:'2026-11-30',owner:'Programme coordinator',method:'Count completed sessions with an attendance register and session report. Cumulative total; repeated attendees are not new people.',published:true,observations:[{date:'2026-08-15',actual:1,evidence:'Fictional demonstration record: sample-training-1.',recordedAt:'2026-08-15T12:00:00Z'}],updatedAt:'2026-08-15T12:00:00Z'}], branding: {organisation:{label:'Sample implementing organisation',image:''},garden:{label:'Sample community garden',image:''},funder:{label:'Sample funding partner',image:''}}, people:attendance.map(({id,name})=>({id,name})),assessments:[],canManage:true,canRecord:true,canBrand:true,sample:true,revision:'' };
}
